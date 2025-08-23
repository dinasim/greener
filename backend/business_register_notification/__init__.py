import json, re
import azure.functions as func
from ..shared.notification_sender import store_token
import os

EXPO_RE = re.compile(r"^ExponentPushToken\[[A-Za-z0-9\-+/_=]+\]$")

def main(req: func.HttpRequest) -> func.HttpResponse:
    try:
        body = req.get_json()
    except ValueError:
        return func.HttpResponse(json.dumps({"error": "invalid json"}), status_code=400)

    # Accept businessId fallback
    user_id = body.get("userId") or body.get("email") or body.get("businessId")
    token = body.get("token")
    platform = body.get("platform") or "android"
    provider = body.get("provider") or "expo"

    if not user_id or not token:
        return func.HttpResponse(json.dumps({"error": "userId/email/businessId and token required"}), status_code=400)

    if provider == "expo" and not EXPO_RE.match(token):
        return func.HttpResponse(json.dumps({"error": "invalid expo token"}), status_code=400)

    try:
        if not (os.getenv("COSMOSDB_MARKETPLACE_CONNECTION_STRING") or os.getenv("COSMOS_CONN")):
            return func.HttpResponse(json.dumps({"error": "config_missing"}), status_code=500)
        res = store_token(user_id, token, platform, provider)
        doc_id, _updated = res if isinstance(res, (tuple, list)) else (res, True)
        return func.HttpResponse(json.dumps({"ok": True, "id": doc_id}), status_code=200)
    except Exception as e:
        return func.HttpResponse(json.dumps({"error": "internal", "detail": str(e)}), status_code=500)
