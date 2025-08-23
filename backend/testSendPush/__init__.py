import json, os
import azure.functions as func
from shared.notification_sender import fetch_valid_tokens, send_chat_message_notifications

def _resp(code, obj):
    return func.HttpResponse(json.dumps(obj), status_code=code, mimetype="application/json")

def main(req: func.HttpRequest) -> func.HttpResponse:
    if req.method != "POST":
        return _resp(405, {"error": "method_not_allowed"})
    try:
        body = req.get_json()
    except ValueError:
        return _resp(400, {"error": "invalid_json"})
    user_ids = body.get("userIds") or []
    title = body.get("title") or "Test Notification"
    body_text = body.get("body") or "This is a test push"
    data = body.get("data") or {"type": "test_push"}

    if not isinstance(user_ids, list) or not user_ids:
        return _resp(400, {"error": "userIds array required"})

    tokens = fetch_valid_tokens(user_ids)
    if not tokens:
        return _resp(200, {"ok": True, "message": "no tokens"})
    stats = send_chat_message_notifications(tokens, title, body_text, data)
    return _resp(200, {"ok": True, "targets": len(user_ids), "tokens": len(tokens), "stats": stats})
