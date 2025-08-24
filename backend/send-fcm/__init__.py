import os, json, base64, logging, requests
import azure.functions as func
from google.oauth2 import service_account
from google.auth.transport.requests import Request as GoogleRequest
from azure.cosmos import CosmosClient

FIREBASE_PROJECT_ID = os.environ.get("FIREBASE_PROJECT_ID")
SA_B64 = os.environ.get("FIREBASE_SA_JSON_B64")

COSMOS_URL = os.environ.get("COSMOS_URL")
COSMOS_KEY = os.environ.get("COSMOS_KEY")
COSMOS_DB  = os.environ.get("COSMOS_DB", "greener")
COSMOS_CONTAINER_TOKENS = os.environ.get("COSMOS_CONTAINER_TOKENS", "push_tokens")

def _ok(obj, code=200):
    return func.HttpResponse(json.dumps(obj), status_code=code, headers={"Content-Type":"application/json","Access-Control-Allow-Origin":"*"})

def _cors204():
    return func.HttpResponse(status_code=204, headers={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"*","Access-Control-Allow-Methods":"*"})

def _get_access_token():
    sa_info = json.loads(base64.b64decode(SA_B64).decode("utf-8"))
    creds = service_account.Credentials.from_service_account_info(
        sa_info,
        scopes=["https://www.googleapis.com/auth/firebase.messaging"]
    )
    creds.refresh(GoogleRequest())
    return creds.token

def _get_user_tokens(user_id: str):
    client = CosmosClient(COSMOS_URL, COSMOS_KEY)
    db = client.get_database_client(COSMOS_DB)
    c  = db.get_container_client(COSMOS_CONTAINER_TOKENS)
    try:
        doc = c.read_item(item=user_id, partition_key=user_id)
        return [t["token"] for t in doc.get("tokens", [])]
    except:
        return []

def _send_to_token(access_token: str, token: str, title: str, body: str, data: dict):
    url = f"https://fcm.googleapis.com/v1/projects/{FIREBASE_PROJECT_ID}/messages:send"
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json; charset=UTF-8"
    }
    payload = {
        "message": {
            "token": token,
            "notification": {"title": title, "body": body},
            "data": {k: str(v) for k, v in (data or {}).items()}
        }
    }
    r = requests.post(url, headers=headers, json=payload, timeout=10)
    return r.status_code, r.text

def main(req: func.HttpRequest) -> func.HttpResponse:
    if req.method == "OPTIONS":
        return _cors204()

    try:
        body = req.get_json()
    except:
        return _ok({"ok": False, "error": "Invalid JSON"}, 400)

    token = (body.get("token") or "").strip()
    user_id = (body.get("userId") or "").strip()
    title = body.get("title", "Greener")
    text  = body.get("body", "Test push from Azure via FCM")
    data  = body.get("data", {})

    if not FIREBASE_PROJECT_ID or not SA_B64:
        return _ok({"ok": False, "error": "FCM env not configured"}, 500)

    targets = []
    if token:
        targets = [token]
    elif user_id:
        targets = _get_user_tokens(user_id)
    else:
        return _ok({"ok": False, "error": "Provide token or userId"}, 400)

    if not targets:
        return _ok({"ok": False, "error": "No target tokens found"}, 404)

    try:
        access_token = _get_access_token()
        results = []
        for t in targets:
            code, text_resp = _send_to_token(access_token, t, title, text, data)
            results.append({"token": t[:12]+"…", "status": code, "response": text_resp})
        return _ok({"ok": True, "sent": len(results), "results": results})
    except Exception as e:
        logging.exception("send-fcm failed")
        return _ok({"ok": False, "error": str(e)}, 500)
