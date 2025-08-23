import os, hashlib, datetime, logging, requests, math
from azure.cosmos import CosmosClient, PartitionKey, exceptions

_COSMOS_CONN = os.getenv("COSMOSDB_MARKETPLACE_CONNECTION_STRING") or os.getenv("COSMOS_CONN")
_DB_NAME = os.getenv("COSMOSDB_MARKETPLACE_DATABASE_NAME")
_CONTAINER_NAME = "notifications"

_client = None
_container = None
_container_checked = False

_logger = logging.getLogger("notification_sender")

def _init():
    global _client, _container
    if _client is None:
        if not _COSMOS_CONN or not _DB_NAME:
            raise RuntimeError("Cosmos DB settings missing")
        _client = CosmosClient.from_connection_string(_COSMOS_CONN)
        db = _client.get_database_client(_DB_NAME)
        try:
            _container = db.get_container_client(_CONTAINER_NAME)
            _container.read()
        except exceptions.CosmosResourceNotFoundError:
            _logger.warning('Creating notifications container (partition key /userId)')
            _container = db.create_container(
                id=_CONTAINER_NAME,
                partition_key=PartitionKey(path="/userId"),
                offer_throughput=400
            )
        globals()['_container'] = _container

def _ensure_container():
    # simplified: always ensures (idempotent)
    try:
        _init()
    except Exception as e:
        raise RuntimeError(f'Failed to access/create notifications container: {e}')

def _short_hash(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()[:10]

def store_token(user_id: str, token: str, platform: str = "android", provider: str = "expo"):
    """Store or refresh a token. Returns (doc_id, updated_flag)."""
    _ensure_container()
    now = datetime.datetime.utcnow().isoformat()
    doc_id = f"{user_id}:{_short_hash(token)}"
    try:
        existing = _container.read_item(doc_id, partition_key=user_id)
        # Already exists – refresh timestamps/platform/provider if changed.
        changed = False
        if existing.get("platform") != platform:
            existing["platform"] = platform; changed = True
        if existing.get("provider") != provider:
            existing["provider"] = provider; changed = True
        existing["lastSeenAt"] = now
        if changed:
            existing["updatedAt"] = now
        _container.upsert_item(existing)
        _logger.info("Token refresh user=%s id=%s changed=%s", user_id, doc_id, changed)
        return (doc_id, False)
    except exceptions.CosmosResourceNotFoundError:
        doc = {
            "id": doc_id,
            "userId": user_id,
            "token": token,
            "platform": platform,
            "provider": provider or "expo",
            "valid": True,
            "createdAt": now,
            "lastSeenAt": now
        }
        _container.upsert_item(doc)
        _logger.info("Stored new token doc_id=%s user=%s provider=%s", doc_id, user_id, provider)
        return (doc_id, True)

def fetch_valid_tokens(user_ids):
    """Return list of token strings for provided user ids."""
    if not user_ids:
        return []
    _ensure_container()
    tokens = []
    for uid in user_ids:
        query = {
            "query": "SELECT c.token FROM c WHERE c.userId = @u AND c.valid = true",
            "parameters": [{"name": "@u", "value": uid}]
        }
        for item in _container.query_items(query, partition_key=uid):
            if item.get("token"):
                tokens.append(item["token"])
    return tokens

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"
_MAX_CHUNK = 100

def send_expo_push(messages, log=None):
    """Send a list of expo push messages. Returns dict stats & invalid tokens."""
    if not messages:
        return {"sent": 0, "invalid": 0, "details": []}
    results = []
    invalid_tokens = set()
    for i in range(0, len(messages), _MAX_CHUNK):
        chunk = messages[i:i+_MAX_CHUNK]
        try:
            resp = requests.post(EXPO_PUSH_URL, json=chunk, timeout=10)
            data = resp.json()
            tickets = data.get("data") if isinstance(data, dict) else None
            if isinstance(tickets, list):
                for msg, ticket in zip(chunk, tickets):
                    status = ticket.get("status")
                    if status != "ok":
                        err = ticket.get("message")
                        details = ticket.get("details", {})
                        if log: log(f"expo_push_fail token={msg.get('to')[:16]} status={status} err={err} details={details}")
                        if details.get("error") in ("DeviceNotRegistered", "InvalidCredentials"):
                            invalid_tokens.add(msg.get("to"))
            results.append({"chunk": math.floor(i/_MAX_CHUNK)+1, "count": len(chunk), "http": resp.status_code})
        except Exception as e:
            if log: log(f"expo_push_exception {e}")
    # Mark invalid tokens
    if invalid_tokens:
        _ensure_container()
        for t in invalid_tokens:
            # token doc id pattern: userId:hash; need query to find docs
            query = {
                "query": "SELECT * FROM c WHERE c.token = @t",
                "parameters": [{"name": "@t", "value": t}]
            }
            for item in _container.query_items(query, enable_cross_partition_query=True):
                item["valid"] = False
                item["invalidatedAt"] = datetime.datetime.utcnow().isoformat()
                try:
                    _container.upsert_item(item)
                except Exception:
                    pass
    return {"sent": len(messages), "invalid": len(invalid_tokens), "details": results}

def send_chat_message_notifications(tokens, title, body, data, log=None):
    """High-level helper for chat message pushes (expo only)."""
    if not tokens:
        return {"expoSent": 0, "expoInvalid": 0}
    messages = [{
        "to": t,
        "title": title,
        "body": body,
        "data": data,
        "sound": "default",
        "channelId": "chat-messages",
        "priority": "high"
    } for t in tokens if t.startswith("ExponentPushToken")]
    stats = send_expo_push(messages, log=log)
    return {"expoSent": stats["sent"], "expoInvalid": stats["invalid"]}
