import os, json, logging
import azure.functions as func
from azure.cosmos import CosmosClient, exceptions
import base64
import firebase_admin
from firebase_admin import credentials, messaging

# ---- ENV expected ----
# COSMOS_URL, COSMOS_KEY, COSMOS_DB (default 'greener'), COSMOS_CONTAINER_TOKENS (default 'push_tokens')
# FIREBASE_SA_JSON_B64  (preferred)  OR  FIREBASE_SA_JSON  OR  FIREBASE_SA_JSON_PATH

def _cors_headers():
    return {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type,Authorization,X-User-Email",
    }

def _ok(body: dict, code=200):
    return func.HttpResponse(
        body=json.dumps(body),
        status_code=code,
        mimetype="application/json",
        headers=_cors_headers(),
    )

def _bad(msg: str, code=400):
    return _ok({"ok": False, "error": msg}, code)

def _get_cosmos_container():
    url = os.environ.get("COSMOS_URI")
    key = os.environ.get("COSMOS_KEY")
    if not url or not key:
        raise RuntimeError("Missing COSMOS_URL or COSMOS_KEY env vars")

    db_name ="GreenerDB"
    c_name  = os.environ.get("COSMOS_CONTAINER_TOKENS", "push_tokens")

    client = CosmosClient(url, credential=key)
    db = client.get_database_client(db_name)
    return db.get_container_client(c_name)

def _init_firebase():
    if firebase_admin._apps:
        return
    # Priority: B64 -> raw JSON -> path
    b64 = os.environ.get("FIREBASE_SA_JSON_B64")
    raw = os.environ.get("FIREBASE_SA_JSON")
    path = os.environ.get("FIREBASE_SA_JSON_PATH")

    if b64:
        try:
            sa = json.loads(base64.b64decode(b64).decode("utf-8"))
            cred = credentials.Certificate(sa)
        except Exception as e:
            raise RuntimeError(f"FIREBASE_SA_JSON_B64 invalid: {e}")
    elif raw:
        try:
            sa = json.loads(raw)
            cred = credentials.Certificate(sa)
        except Exception as e:
            raise RuntimeError(f"FIREBASE_SA_JSON invalid: {e}")
    elif path:
        cred = credentials.Certificate(path)
    else:
        raise RuntimeError("Missing Firebase service account (set FIREBASE_SA_JSON_B64 or FIREBASE_SA_JSON or FIREBASE_SA_JSON_PATH)")

    firebase_admin.initialize_app(cred)

def _load_tokens_for_email(container, email: str):
    # Your token doc schema: { id: <email>, userId: <email>, tokens: [{token, platform, app, lastSeen}] }
    try:
        item = container.read_item(item=email, partition_key=email)
        tokens = [t.get("token") for t in item.get("tokens", []) if t.get("token")]
        return tokens
    except exceptions.CosmosResourceNotFoundError:
        return []

def main(req: func.HttpRequest) -> func.HttpResponse:
    if req.method == "OPTIONS":
        return func.HttpResponse(status_code=204, headers=_cors_headers())

    try:
        body = req.get_json()
    except Exception:
        return _bad("Invalid JSON body")

    email   = (body.get("email") or "").strip()
    title   = (body.get("title") or "Greener").strip()
    bodytxt = (body.get("body") or "Test notification").strip()
    # Optional: send to a specific token instead of all saved
    direct_token = (body.get("token") or "").strip()

    if not email and not direct_token:
        return _bad("Provide either 'email' (to load saved tokens) or 'token' (single device)")

    try:
        _init_firebase()
    except Exception as e:
        logging.exception("Firebase init failed")
        return _bad(f"Firebase init failed: {e}", 500)

    tokens = []
    try:
        if direct_token:
            tokens = [direct_token]
        else:
            container = _get_cosmos_container()
            tokens = _load_tokens_for_email(container, email)

        tokens = [t for t in tokens if t and not t.startswith("ExponentPushToken")]  # skip Expo-only tokens
        if not tokens:
            who = direct_token and "provided token" or f"user '{email}'"
            return _bad(f"No FCM tokens found for {who}", 404)

        # Build the message (both notification + data)
        message = messaging.MulticastMessage(
            tokens=tokens,
            notification=messaging.Notification(title=title, body=bodytxt),
            data={
                "type": "TEST_NOTIFICATION",
                "ts": str(__import__("time").time()),
            },
            android=messaging.AndroidConfig(
                priority="high",
                notification=messaging.AndroidNotification(channel_id="default"),
            ),
        )

        resp = messaging.send_each_for_multicast(message)
        # Collect invalid tokens for your own pruning, if you want
        invalid = []
        for idx, r in enumerate(resp.responses):
            if not r.success:
                code = getattr(r.exception, "code", "")
                msg = getattr(r.exception, "message", str(r.exception))
                logging.warning(f"[FCM] send failed for token[{idx}]: {code} {msg}")
                if "registration-token-not-registered" in msg or "invalid-argument" in msg:
                    invalid.append(tokens[idx])

        return _ok({
            "ok": True,
            "requested": len(tokens),
            "successCount": resp.success_count,
            "failureCount": resp.failure_count,
            "invalidTokens": invalid
        })
    except Exception as e:
        logging.exception("sendTestPush failed")
        return _bad(f"sendTestPush failed: {e}", 500)
