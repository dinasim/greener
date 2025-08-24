import os, json, logging, base64, math
import azure.functions as func
from datetime import datetime, timezone
from azure.cosmos import CosmosClient, exceptions
import firebase_admin
from firebase_admin import credentials, messaging


def _today_utc_date():
    # Compare by day (no time) using UTC so "today/late" matches your app's logic closely.
    return datetime.utcnow().date()

def _parse_date(dstr):
    if not dstr: 
        return None
    try:
        # ISO or plain yyyy-mm-dd both work
        return datetime.fromisoformat(dstr.replace("Z","")).date()
    except Exception:
        # Fallback: try just first 10 chars yyyy-mm-dd
        try:
            return datetime.fromisoformat(dstr[:10]).date()
        except Exception:
            return None

def _due_status(date_str):
    """Return ('late'|'today'|'future'|None), days_diff for a next_* date"""
    dt = _parse_date(date_str)
    if not dt:
        return None, None
    today = _today_utc_date()
    diff = (dt - today).days
    if diff < 0:  return 'late', diff
    if diff == 0: return 'today', diff
    return 'future', diff

def _init_firebase():
    if firebase_admin._apps:
        return
    b64 = (os.environ.get("FIREBASE_SA_JSON_B64") or "").strip()
    raw = (os.environ.get("FIREBASE_SA_JSON") or "").strip()
    path = (os.environ.get("FIREBASE_SA_JSON_PATH") or "").strip()

    if b64:
        sa = json.loads(base64.b64decode(b64).decode("utf-8"))
        cred = credentials.Certificate(sa)
    elif raw:
        sa = json.loads(raw)
        cred = credentials.Certificate(sa)
    elif path:
        cred = credentials.Certificate(path)
    else:
        raise RuntimeError("Missing Firebase service account env")

    firebase_admin.initialize_app(cred)

def _get_cosmos_clients():
    endpoint = os.environ.get("COSMOS_URI") 
    key = os.environ.get("COSMOS_KEY")
    if not endpoint or not key:
        raise RuntimeError("Missing COSMOS_URI/COSMOS_URL or COSMOS_KEY")

    dbname =  "GreenerDB"
    plants_container = os.environ.get("COSMOS_CONTAINER_PLANTS", "userPlants")
    tokens_container = os.environ.get("COSMOS_CONTAINER_TOKENS", "push_tokens")

    client = CosmosClient(endpoint, credential=key)
    db = client.get_database_client(dbname)
    c_plants = db.get_container_client(plants_container)
    c_tokens = db.get_container_client(tokens_container)
    return c_plants, c_tokens

def _iter_all_plants(c_plants):
    # Pull minimal fields for efficiency; we’ll compute due-ness in Python.
    query = """
    SELECT c.id, c.email, c.nickname, c.common_name, 
           c.next_water, c.next_feed, c.next_repot
    FROM c
    """
    for item in c_plants.query_items(query=query, enable_cross_partition_query=True):
        yield item

def _load_tokens_for_email(c_tokens, email):
    try:
        doc = c_tokens.read_item(item=email, partition_key=email)
        toks = [t.get("token") for t in (doc.get("tokens") or []) if t.get("token")]
        # skip Expo-only tokens (not FCM)
        return [t for t in toks if not str(t).startswith("ExponentPushToken")]
    except exceptions.CosmosResourceNotFoundError:
        return []

def _summarize_due(plant):
    """
    For a plant, return dict counts of due types and a short list of labels for display.
    """
    due = []
    for key, tlabel in (("next_water","Water"), ("next_feed","Feed"), ("next_repot","Repot")):
        st, _ = _due_status(plant.get(key))
        if st in ("today","late"):
            due.append(tlabel)

    return due  # list like ["Water","Feed"]

def _compose_message_for_user(plants_due_by_type):
    """
    plants_due_by_type: dict like {"Water": [names...], "Feed": [...], "Repot":[...]}
    Return (title, body, data_dict)
    """
    parts = []
    for t in ("Water","Feed","Repot"):
        n = len(plants_due_by_type.get(t, []))
        if n:
            parts.append(f"{t} {n}")
    if not parts:
        return None, None, None

    body = " · ".join(parts)
    title = "Today's plant care 🌿"
    # Show up to 3 plant names inline for friendliness
    sample_names = []
    for t in ("Water","Feed","Repot"):
        sample_names.extend(plants_due_by_type.get(t, [])[:3-len(sample_names)])
        if len(sample_names) >= 3: break
    if sample_names:
        body += f" — {', '.join(sample_names)}"

    data = {
        "type": "CARE_REMINDER",
        "water": str(len(plants_due_by_type.get("Water", []))),
        "feed": str(len(plants_due_by_type.get("Feed", []))),
        "repot": str(len(plants_due_by_type.get("Repot", []))),
        "screen": "home",
        "tab": "today"
    }
    return title, body, data

def _chunk(lst, size):
    for i in range(0, len(lst), size):
        yield lst[i:i+size]

def _send_push_to_tokens(tokens, title, body, data):
    if not tokens:
        return (0, 0, [])
    message = messaging.MulticastMessage(
        tokens=tokens,
        notification=messaging.Notification(title=title, body=body),
        data={k: str(v) for (k, v) in (data or {}).items()},
        android=messaging.AndroidConfig(
            priority="high",
            notification=messaging.AndroidNotification(channel_id="default"),
        ),
    )
    resp = messaging.send_each_for_multicast(message)
    invalid = []
    for idx, r in enumerate(resp.responses):
        if not r.success:
            msg = getattr(r.exception, "message", str(r.exception))
            logging.warning(f"[FCM] failure: {msg}")
            if "registration-token-not-registered" in msg or "invalid-argument" in msg:
                invalid.append(tokens[idx])
    return (resp.success_count, resp.failure_count, invalid)

def main(myTimer: func.TimerRequest) -> None:
    logging.info("⏰ careReminders timer fired")
    try:
        _init_firebase()
        plants_c, tokens_c = _get_cosmos_clients()

        # 1) Collect plants that are due today/late, grouped by user
        #    users[email] = {"Water":[names], "Feed":[names], "Repot":[names]}
        users = {}
        for p in _iter_all_plants(plants_c):
            email = (p.get("email") or "").strip()
            if not email: 
                continue

            due_types = _summarize_due(p)
            if not due_types:
                continue

            # label to show
            name = p.get("nickname") or p.get("common_name") or "Your plant"
            u = users.setdefault(email, {"Water": [], "Feed": [], "Repot": []})
            for t in due_types:
                u[t].append(name)

        if not users:
            logging.info("No users with due tasks right now.")
            return

        # 2) Send pushes per user
        total_req = total_ok = total_fail = 0
        for email, bytype in users.items():
            title, body, data = _compose_message_for_user(bytype)
            if not title:
                continue

            toks = _load_tokens_for_email(tokens_c, email)
            if not toks:
                logging.info(f"Skip {email}: no tokens")
                continue

            # FCM max 500 per call
            for batch in _chunk(toks, 500):
                ok, fail, invalid = _send_push_to_tokens(batch, title, body, data)
                total_req += len(batch)
                total_ok += ok
                total_fail += fail
                if invalid:
                    logging.info(f"[{email}] invalid tokens: {len(invalid)}")

            logging.info(f"Sent to {email}: {title} | {body}")

        logging.info(f"✅ careReminders done. requested={total_req} ok={total_ok} fail={total_fail}")

    except Exception as e:
        logging.exception(f"careReminders failed: {e}")
