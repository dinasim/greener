# register_device_token/__init__.py
import os, json, logging, re, uuid, datetime, traceback
import azure.functions as func
from azure.cosmos import CosmosClient, PartitionKey
from shared.notification_sender import store_token  # same as update function

LOGGER = logging.getLogger("register_device_token")
if not LOGGER.handlers:
    logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))

EXPO_RE = re.compile(r"^ExponentPushToken\[[A-Za-z0-9\-+/_=]+\]$")
ALLOWED_PROVIDERS = {"expo", "fcm", "apns"}
ALLOWED_PLATFORMS = {"android", "ios", "web"}

_raw_origins = os.getenv("ALLOWED_ORIGINS", "*")
if _raw_origins.strip() == "*":
    ORIGINS = ["*"]
else:
    ORIGINS = [o.strip() for o in _raw_origins.split(",") if o.strip()]

def _with_cors(req: func.HttpRequest, resp: func.HttpResponse):
    origin = req.headers.get("Origin") or ""
    if "*" in ORIGINS:
        resp.headers["Access-Control-Allow-Origin"] = "*"
    elif origin in ORIGINS:
        resp.headers["Access-Control-Allow-Origin"] = origin
    resp.headers["Vary"] = "Origin"
    resp.headers["Access-Control-Allow-Credentials"] = "true"
    resp.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, X-Request-ID"
    resp.headers["Access-Control-Allow-Methods"] = "POST, OPTIONS, GET"
    return resp

def _resp(req: func.HttpRequest, status: int, body: dict):
    cid = getattr(req, "_cid", None) or req.headers.get("X-Request-ID") or str(uuid.uuid4())
    req._cid = cid
    body.setdefault("correlationId", cid)
    return _with_cors(req, func.HttpResponse(json.dumps(body), status_code=status, mimetype="application/json"))

def _store_business_pref(business_id: str, token: str, notification_time: str):
    # Optional; skip if missing config
    endpoint = (os.getenv("COSMOS_ACCOUNT_URI") or
                os.getenv("COSMOS_ENDPOINT") or
                os.getenv("COSMOSDB__MARKETPLACE_CONNECTION_STRING"))
    key = os.getenv("COSMOS_KEY") or os.getenv("COSMOSDB_KEY")
    if not endpoint or not key:
        LOGGER.warning("business_pref_skip missing_cosmos_credentials")
        return False
    database_id = os.getenv("COSMOSDB_MARKETPLACE_DATABASE_NAME", "GreenerMarketplace")
    container_id = "watering_notifications"
    client = CosmosClient(endpoint, credential=key)
    db = client.get_database_client(database_id)
    try:
        container = db.get_container_client(container_id)
        container.read()
    except Exception:
        container = db.create_container(
            id=container_id,
            partition_key=PartitionKey(path="/businessId"),
            offer_throughput=400
        )
    notification_id = f"{business_id}-{token[-12:].replace('[','').replace(']','')}"
    utc_now = datetime.datetime.utcnow().isoformat()
    try:
        existing = container.read_item(notification_id, partition_key=business_id)
        existing.update({
            "notificationTime": notification_time,
            "deviceToken": token,
            "status": "active",
            "updatedAt": utc_now
        })
        container.replace_item(notification_id, existing)
        return True
    except Exception:
        container.create_item({
            "id": notification_id,
            "businessId": business_id,
            "deviceToken": token,
            "notificationTime": notification_time,
            "status": "active",
            "lastSent": None,
            "createdAt": utc_now,
            "updatedAt": utc_now
        })
        return True

def main(req: func.HttpRequest) -> func.HttpResponse:
    cid = req.headers.get("X-Request-ID") or str(uuid.uuid4())
    req._cid = cid

    # Health
    if req.method == "GET" and req.params.get("health") == "1":
        return _resp(req, 200, {"ok": True, "health": "ok"})

    if req.method == "OPTIONS":
        return _resp(req, 200, {"ok": True})

    if req.method != "POST":
        return _resp(req, 405, {"error": "method_not_allowed"})

    try:
        body = req.get_json()
    except ValueError:
        return _resp(req, 400, {"error": "invalid_json"})

    # Field aliases
    token = body.get("token") or body.get("deviceToken")
    user_id = body.get("userId") or body.get("email")
    business_id = body.get("businessId")
    notification_time = body.get("notificationTime", "07:00")
    platform = (body.get("platform") or "android").lower()
    provider = (body.get("provider") or "expo").lower()

    if user_id:
        user_id = user_id.strip()
        if "@" in user_id:
            local, _, domain = user_id.partition("@")
            user_id = f"{local}@{domain.lower()}"

    if not user_id or not token:
        return _resp(req, 400, {"error": "missing_fields", "required": ["userId/email", "token|deviceToken"]})
    if provider not in ALLOWED_PROVIDERS:
        return _resp(req, 400, {"error": "invalid_provider", "allowed": sorted(ALLOWED_PROVIDERS)})
    if platform not in ALLOWED_PLATFORMS:
        return _resp(req, 400, {"error": "invalid_platform", "allowed": sorted(ALLOWED_PLATFORMS)})
    if len(token) > 512:
        return _resp(req, 400, {"error": "token_too_long"})
    if provider == "expo" and not EXPO_RE.match(token):
        return _resp(req, 400, {"error": "invalid_expo_token"})

    token_preview = token[:12] + "..." if len(token) > 12 else token

    try:
        result = store_token(user_id=user_id, token=token, platform=platform, provider=provider)
        doc_id, updated = result if isinstance(result, (tuple, list)) else (result, True)

        pref_saved = False
        if business_id:
            try:
                pref_saved = _store_business_pref(business_id, token, notification_time)
            except Exception as e:
                LOGGER.error("business_pref_store_failed correlationId=%s business=%s err=%s", cid, business_id, e)

        LOGGER.info("METRIC register_device_token correlationId=%s user=%s business=%s provider=%s platform=%s updated=%s tokenPreview=%s",
                    cid, user_id, business_id, provider, platform, updated, token_preview)

        return _resp(req, 200, {
            "ok": True,
            "updated": updated,
            "id": doc_id,
            "userId": user_id,
            "businessId": business_id,
            "provider": provider,
            "platform": platform,
            "tokenPreview": token_preview,
            "preferencesSaved": pref_saved,
            "notificationTime": notification_time if business_id else None
        })
    except Exception as e:
        trace = traceback.format_exc(limit=5)
        debug = os.getenv("DEBUG_PUSH_TOKEN", "0") == "1"
        LOGGER.error("token_register_failed correlationId=%s user=%s provider=%s platform=%s err=%s trace=%s",
                     cid, user_id, provider, platform, e, trace)
        return _resp(req, 500, {
            "error": "internal",
            "detail": str(e) if debug else "failed_to_store_token"
        })