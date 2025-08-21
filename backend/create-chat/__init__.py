import json, logging, os, uuid, hashlib
from datetime import datetime

import azure.functions as func
from azure.cosmos import CosmosClient
from azure.cosmos.exceptions import CosmosHttpResponseError

# ---------------- CORS ----------------
def _cors_headers():
    return {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, X-User-Email, X-User-Type, X-Business-ID",
    }

def _resp(body="", status=200):
    if isinstance(body, dict):
        body = json.dumps(body)
    return func.HttpResponse(body, status_code=status, headers=_cors_headers())

def _err(msg, status=500, details=None):
    payload = {"error": msg}
    if details:
        payload["details"] = details
    logging.error(f"{msg} :: {details or ''}")
    return _resp(payload, status)

# ---------------- Cosmos helpers ----------------
def _cosmos_client():
    cs = os.environ.get("COSMOSDB__MARKETPLACE_CONNECTION_STRING")
    if not cs:
        return None, "Missing COSMOSDB__MARKETPLACE_CONNECTION_STRING"
    try:
        return CosmosClient.from_connection_string(cs), None
    except Exception as e:
        return None, f"Cosmos client error: {e}"

def _db_and_containers(client):
    db_name = os.environ.get("COSMOSDB_MARKETPLACE_DATABASE_NAME", "greener-marketplace-db")
    conv_name = os.environ.get("CONVERSATIONS_CONTAINER", "marketplace-conversations")
    msg_name  = os.environ.get("MESSAGES_CONTAINER", "marketplace-messages")
    db = client.get_database_client(db_name)
    return db, db.get_container_client(conv_name), db.get_container_client(msg_name)

def _pk_field_from_path(pk_path: str, default_field: str):
    return (pk_path or "").lstrip("/") or default_field

def _compute_conv_pk_value(pk_field: str, *, room_id: str, participants_key: str):
    """Map the conversation PK field to the right value."""
    fld = (pk_field or "").strip()
    if fld in ("id", "roomId", "conversationId"):
        return room_id
    if fld in ("participantsKey", "participants_key", "pk"):
        return participants_key
    # sensible default
    return room_id

def _ensure_field(doc: dict, field: str, value):
    if doc.get(field) is None:
        doc[field] = value
    return doc[field]

def _latest_ts(doc: dict) -> str:
    return str(doc.get("lastMessageAt") or doc.get("createdAt") or "")

# ---------------- Function entry ----------------
def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info("createChatRoom request")

    if req.method == "OPTIONS":
        return _resp("", 204)

    # Parse body + allow both naming styles
    try:
        body = req.get_json()
    except Exception:
        return _err("Invalid JSON body", 400, "Body is not valid JSON")

    sender = (body.get("sender") or body.get("senderId") or "").strip().lower()
    receiver = (body.get("receiver") or body.get("recipientId") or "").strip().lower()
    plant_id = body.get("plantId")  # optional (e.g., "order:123")
    message_text = body.get("message") or body.get("text")  # optional now

    if not sender:
        return _err("Sender ID is required", 400)
    if not receiver:
        return _err("Receiver ID is required", 400)

    conv_pk_path = os.environ.get("CONVERSATIONS_PK", "/id")
    msg_pk_path  = os.environ.get("MESSAGES_PK", "/conversationId")
    conv_pk_field = _pk_field_from_path(conv_pk_path, "id")
    msg_pk_field  = _pk_field_from_path(msg_pk_path, "conversationId")
    logging.info(f"PK fields -> conversations='{conv_pk_field}' | messages='{msg_pk_field}'")

    client, c_err = _cosmos_client()
    if not client:
        return _err("Database connection failed", 500, c_err)

    try:
        _, convs, msgs = _db_and_containers(client)

        # ---- Deterministic room id/idempotency ----
        participants_key = "|".join(sorted([sender, receiver]))
        raw_room_key = participants_key if not plant_id else f"{participants_key}|{plant_id}"
        room_id = hashlib.sha1(raw_room_key.encode("utf-8")).hexdigest()

        now = datetime.utcnow().replace(microsecond=0).isoformat() + "Z"

        # ---- Query for existing conversation (prefer partitioned read when possible) ----
        items = []
        try:
            if conv_pk_field in ("participantsKey",):
                q = "SELECT * FROM c WHERE c.participantsKey = @pk" + (" AND c.plantId = @pid" if plant_id else "")
                params = [{"name": "@pk", "value": participants_key}]
                if plant_id:
                    params.append({"name": "@pid", "value": plant_id})
                items = list(convs.query_items(
                    query=q,
                    parameters=params,
                    partition_key=participants_key,
                    enable_cross_partition_query=False
                ))
            elif conv_pk_field in ("id", "roomId", "conversationId"):
                q = "SELECT * FROM c WHERE c.roomId = @rid OR c.id = @rid"
                items = list(convs.query_items(
                    query=q,
                    parameters=[{"name":"@rid","value": room_id}],
                    partition_key=room_id,
                    enable_cross_partition_query=False
                ))
            else:
                # Fallback cross-partition
                q = "SELECT * FROM c WHERE c.participantsKey = @pk"
                params = [{"name":"@pk","value": participants_key}]
                if plant_id:
                    q += " AND c.plantId = @pid"
                    params.append({"name":"@pid","value": plant_id})
                items = list(convs.query_items(
                    query=q, parameters=params, enable_cross_partition_query=True
                ))
        except Exception as e:
            logging.warning(f"Partitioned query fell back to cross-partition: {e}")
            q = "SELECT * FROM c WHERE c.participantsKey = @pk"
            params = [{"name":"@pk","value": participants_key}]
            if plant_id:
                q += " AND c.plantId = @pid"
                params.append({"name":"@pid","value": plant_id})
            items = list(convs.query_items(query=q, parameters=params, enable_cross_partition_query=True))

        is_new = False
        conversation_id = room_id  # deterministic
        conv = None

        if items:
            conv = max(items, key=_latest_ts)
            # update timestamps/last message if we have one to add
            if message_text:
                conv["lastMessageAt"] = now
                conv["lastMessage"] = {"text": message_text, "senderId": sender, "timestamp": now}
                unread = conv.get("unreadCounts", {})
                unread[receiver] = unread.get(receiver, 0) + 1
                conv["unreadCounts"] = unread
        else:
            is_new = True
            conv = {
                "id": conversation_id,
                "roomId": conversation_id,            # keep both for flexibility
                "participants": [sender, receiver],
                "participantsKey": participants_key,
                "createdAt": now,
                "lastMessageAt": now if message_text else None,
                "lastMessage": {"text": message_text, "senderId": sender, "timestamp": now} if message_text else None,
                "unreadCounts": {receiver: 1, sender: 0} if message_text else {receiver: 0, sender: 0},
            }
            if plant_id:
                conv["plantId"] = plant_id

        # Ensure PK field value is correct and present
        conv_pk_value = _compute_conv_pk_value(conv_pk_field, room_id=conversation_id, participants_key=participants_key)
        _ensure_field(conv, conv_pk_field, conv_pk_value)

        # Upsert with explicit partition key (safer)
        conv = convs.upsert_item(body=conv, partition_key=conv_pk_value)

        # ---- Create initial message (best effort) ----
        message_id = None
        if message_text:
            try:
                msg_pk_value = conversation_id if msg_pk_field == "conversationId" else conv.get(msg_pk_field) or conversation_id
                message_id = str(uuid.uuid4())
                msg = {
                    "id": message_id,
                    "conversationId": conversation_id,
                    "senderId": sender,
                    "text": message_text,
                    "timestamp": now,
                    "status": {"delivered": True, "read": False, "readAt": None},
                }
                msg[msg_pk_field] = msg_pk_value
                msgs.create_item(body=msg, partition_key=msg_pk_value)
            except Exception as e:
                logging.warning(f"Create message failed: {e}")

        return _resp(
            {
                "success": True,
                "conversationId": conversation_id,
                "isNewConversation": is_new,
                "messageId": message_id,
            },
            201 if is_new else 200,
        )

    except CosmosHttpResponseError as ce:
        sc = getattr(ce, "status_code", None)
        headers = getattr(ce, "headers", {}) or {}
        details = {
            "status_code": sc,
            "sub_status": headers.get("x-ms-substatus") or headers.get("x-ms-sub-status"),
            "activity_id": headers.get("x-ms-activity-id"),
            "request_charge": headers.get("x-ms-request-charge"),
            "message": getattr(ce, "message", None) or str(ce),
        }
        return _err("Cosmos DB error", 500, json.dumps(details))
    except Exception as e:
        return _err("Unexpected server error", 500, str(e))
