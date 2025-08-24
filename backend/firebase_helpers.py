# firebase_helpers.py
import os, json, base64, logging
from typing import Dict, Any, List, Optional, Tuple
from azure.cosmos import CosmosClient, exceptions
import firebase_admin
from firebase_admin import credentials, messaging

log = logging.getLogger(__name__)

# ---- ENV expected ----
# COSMOS_URI or COSMOS_URL
# COSMOS_KEY
# COSMOS_DATABASE_NAME (default GreenerDB)
# COSMOS_CONTAINER_TOKENS (default push_tokens)
#
# FIREBASE_SA_JSON_B64 (preferred) OR FIREBASE_SA_JSON OR FIREBASE_SA_JSON_PATH

def _init_firebase_once():
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

def _get_tokens_container():
    endpoint = os.environ.get("COSMOS_URI") 
    key = os.environ.get("COSMOS_KEY")
    if not endpoint or not key:
        raise RuntimeError("Missing COSMOS_URI/COSMOS_URL or COSMOS_KEY")

    dbname = "GreenerDB"
    c_tokens = os.environ.get("COSMOS_CONTAINER_TOKENS", "push_tokens")

    client = CosmosClient(endpoint, credential=key)
    db = client.get_database_client(dbname)
    return db.get_container_client(c_tokens)

def _resolve_user_email(users_container, receiver_id: str) -> Optional[str]:
    """
    receiver_id might be an email already, or the user's id.
    We try both to get the email value to look up tokens.
    """
    if not receiver_id:
        return None

    # If it looks like an email, just return it
    if "@" in receiver_id:
        return receiver_id

    try:
        query = "SELECT TOP 1 c.id, c.email FROM c WHERE c.id = @id OR c.email = @id"
        params = [{"name":"@id", "value": receiver_id}]
        rows = list(users_container.query_items(query=query, parameters=params, enable_cross_partition_query=True))
        if rows:
            return rows[0].get("email") or rows[0].get("id")
    except Exception as e:
        log.warning(f"User lookup failed for {receiver_id}: {e}")
    return None

def _load_tokens_for_email(tokens_container, email: str) -> List[str]:
    try:
        doc = tokens_container.read_item(item=email, partition_key=email)
        toks = [t.get("token") for t in (doc.get("tokens") or []) if t.get("token")]
        # skip Expo-only tokens
        return [t for t in toks if not str(t).startswith("ExponentPushToken")]
    except exceptions.CosmosResourceNotFoundError:
        return []
    except Exception as e:
        log.warning(f"Token load failed for {email}: {e}")
        return []

def _send_multicast(tokens: List[str], title: str, body: str, data: Dict[str, Any]) -> Tuple[int,int,List[str]]:
    if not tokens:
        return (0,0,[])
    msg = messaging.MulticastMessage(
        tokens=tokens,
        notification=messaging.Notification(title=title, body=body),
        data={k: str(v) for k,v in (data or {}).items()},
        android=messaging.AndroidConfig(
            priority="high",
            notification=messaging.AndroidNotification(channel_id="default"),
        ),
    )
    resp = messaging.send_each_for_multicast(msg)
    invalid = []
    for idx, r in enumerate(resp.responses):
        if not r.success:
            m = getattr(r.exception, "message", str(r.exception))
            log.warning(f"[FCM] failure: {m}")
            if "registration-token-not-registered" in m or "invalid-argument" in m:
                invalid.append(tokens[idx])
    return (resp.success_count, resp.failure_count, invalid)

def send_fcm_notification_to_user(
    users_container,
    receiver_id: str,
    title: str,
    body: str,
    data: Dict[str, Any]
) -> Dict[str, Any]:
    """
    - resolve receiver email (id or email)
    - load tokens from push_tokens
    - send multicast
    """
    _init_firebase_once()
    email = _resolve_user_email(users_container, receiver_id)
    if not email:
        log.info(f"No email found for receiver_id={receiver_id}")
        return {"requested": 0, "success": 0, "fail": 0}

    tokens_c = _get_tokens_container()
    tokens = _load_tokens_for_email(tokens_c, email)
    if not tokens:
        log.info(f"No tokens for email={email}")
        return {"requested": 0, "success": 0, "fail": 0}

    ok, fail, invalid = _send_multicast(tokens, title, body, data or {})
    if invalid:
        log.info(f"Invalid tokens for {email}: {len(invalid)}")
    return {"requested": len(tokens), "success": ok, "fail": fail}
