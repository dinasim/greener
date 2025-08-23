import json, re, traceback, os, logging, uuid
import azure.functions as func
from shared.notification_sender import store_token  # existing import

EXPO_RE = re.compile(r"^ExponentPushToken\[[A-Za-z0-9\-+/_=]+\]$")
LOGGER = logging.getLogger("update_device_token")
if not LOGGER.handlers:
    logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))

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

def _resp(req: func.HttpRequest, status: int, body_dict: dict):
    # correlation id always
    cid = getattr(req, "_cid", None) or req.headers.get("X-Request-ID") or str(uuid.uuid4())
    req._cid = cid
    body_dict.setdefault("correlationId", cid)
    return _with_cors(req, func.HttpResponse(json.dumps(body_dict), status_code=status, mimetype="application/json"))

def main(req: func.HttpRequest) -> func.HttpResponse:
    cid = req.headers.get("X-Request-ID") or str(uuid.uuid4())
    req._cid = cid

    # Health probe
    if req.method == "GET" and req.params.get("health") == "1":
        return _resp(req, 200, {"ok": True, "health": "ok", "version": os.getenv("GIT_COMMIT", "unknown")})

    # CORS preflight
    if req.method == "OPTIONS":
        return _resp(req, 200, {"ok": True})

    if req.method != "POST":
        return _resp(req, 405, {"error": "method_not_allowed"})

    try:
        body = req.get_json()
    except ValueError:
        return _resp(req, 400, {"error": "invalid_json"})

    user_id = body.get("userId") or body.get("email")
    token = body.get("token")
    platform = (body.get("platform") or "android").lower()
    provider = (body.get("provider") or "expo").lower()
    app_version = body.get("appVersion")
    build_number = body.get("buildNumber")

    if user_id:
        user_id = user_id.strip()
        if "@" in user_id:
            local, at, domain = user_id.partition("@")
            user_id = f"{local}@{domain.lower()}"

    if not user_id or not token:
        return _resp(req, 400, {"error": "missing_fields", "required": ["userId/email", "token"]})

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
        # Pre-flight config check for clearer diagnostics
        if not (os.getenv("COSMOSDB_MARKETPLACE_CONNECTION_STRING") or os.getenv("COSMOS_CONN")):
            return _resp(req, 500, {"error": "config_missing", "detail": "Cosmos connection string not set"})
        if not os.getenv("COSMOSDB_MARKETPLACE_DATABASE_NAME"):
            return _resp(req, 500, {"error": "config_missing", "detail": "Cosmos database name not set"})
        result = store_token(user_id=user_id, token=token, platform=platform, provider=provider)
        doc_id, updated = result if isinstance(result, (tuple, list)) else (result, True)
        LOGGER.info(
            "METRIC push_token_registered correlationId=%s user=%s provider=%s platform=%s updated=%s tokenPreview=%s",
            cid, user_id, provider, platform, updated, token_preview
        )
        return _resp(req, 200, {
            "ok": True,
            "updated": updated,
            "id": doc_id,
            "userId": user_id,
            "provider": provider,
            "platform": platform,
            "tokenPreview": token_preview,
            "appVersion": app_version,
            "buildNumber": build_number
        })
    except Exception as e:
        trace = traceback.format_exc(limit=6)
        debug = os.getenv("DEBUG_PUSH_TOKEN", "0") == "1"
        LOGGER.error(
            "push_token_store_failed correlationId=%s user=%s provider=%s platform=%s error=%s trace=%s",
            cid, user_id, provider, platform, e, trace
        )
        return _resp(req, 500, {
            "error": "internal",
            "detail": str(e) if debug else "failed_to_store_token"
        })
