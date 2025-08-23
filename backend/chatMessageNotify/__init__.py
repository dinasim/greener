import logging
from shared.notification_sender import fetch_valid_tokens, send_chat_message_notifications

def _truncate(s, n):
    return (s[:n-1] + "…") if s and len(s) > n else (s or "")

def main(inputDocuments: list):
    if not inputDocuments:
        return
    log = logging.getLogger("chatMessageNotify")
    for doc in inputDocuments:
        convo = doc.get("conversationId")
        sender = doc.get("senderId")
        participants = doc.get("participants") or []
        text = doc.get("text") or ""
        listing_title = doc.get("listingTitle") or "your listing"
        if not sender or not participants:
            continue
        recipients = [p for p in participants if p != sender]
        if not recipients:
            continue
        tokens = fetch_valid_tokens(recipients)
        if not tokens:
            continue
        title = f"New message about {listing_title}"
        body = f"{doc.get('senderDisplayName') or 'User'}: {_truncate(text,80)}"
        data = {
            "type": "chat_message",
            "conversationId": convo or "",
            "listingId": doc.get("listingId") or "",
            "senderId": sender,
            "messageId": doc.get("id") or ""
        }
        stats = send_chat_message_notifications(tokens, title, body, data, log=log.info)
        log.info("chat_push convo=%s recipients=%d tokens=%d sent=%s",
                 convo, len(recipients), len(tokens), stats)
