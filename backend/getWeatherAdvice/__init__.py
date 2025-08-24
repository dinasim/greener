# getWeatherAdviceFree/__init__.py
import os, json, logging, base64
from datetime import datetime
import requests
import azure.functions as func
from azure.cosmos import CosmosClient, exceptions

import firebase_admin
from firebase_admin import credentials, messaging

# ---------- Env ----------
COSMOS_URI = os.environ.get("COSMOS_URI") or os.environ.get("COSMOS_URL")
COSMOS_KEY = os.environ.get("COSMOS_KEY")
DB_NAME = os.environ.get("COSMOS_DATABASE_NAME", "GreenerDB")

USERS_CONTAINER  = os.environ.get("COSMOS_USERS_CONTAINER", "Users")
TOKENS_CONTAINER = os.environ.get("COSMOS_TOKENS_CONTAINER", "push_tokens")

OPENWEATHER_API_KEY = os.environ.get("OPENWEATHER_API_KEY")

logger = logging.getLogger(__name__)

# ---------- Firebase init (same as your working test) ----------
def _init_firebase():
    if firebase_admin._apps:
        return
    b64  = os.environ.get("FIREBASE_SA_JSON_B64")
    raw  = os.environ.get("FIREBASE_SA_JSON")
    path = os.environ.get("FIREBASE_SA_JSON_PATH")

    if b64:
        sa = json.loads(base64.b64decode(b64).decode("utf-8"))
        cred = credentials.Certificate(sa)
    elif raw:
        sa = json.loads(raw)
        cred = credentials.Certificate(sa)
    elif path:
        cred = credentials.Certificate(path)
    else:
        raise RuntimeError("Missing Firebase SA (FIREBASE_SA_JSON_B64 / FIREBASE_SA_JSON / FIREBASE_SA_JSON_PATH)")
    firebase_admin.initialize_app(cred)
    logger.info("✅ Firebase initialized")

# ---------- Cosmos ----------
def _cosmos():
    if not COSMOS_URI or not COSMOS_KEY:
        raise RuntimeError("Missing COSMOS_URI/COSMOS_URL or COSMOS_KEY")
    client = CosmosClient(COSMOS_URI, credential=COSMOS_KEY)
    db = client.get_database_client(DB_NAME)
    users  = db.get_container_client(USERS_CONTAINER)
    tokens = db.get_container_client(TOKENS_CONTAINER)
    return users, tokens

# ---------- Weather (24h look-ahead snapshot) ----------
def get_weather_forecast(lat, lon):
    try:
        url = "https://api.openweathermap.org/data/2.5/forecast"
        params = {
            "lat": lat, "lon": lon,
            "appid": OPENWEATHER_API_KEY,
            "units": "metric",
            "cnt": 8,  # ~24h (3h steps)
        }
        res = requests.get(url, params=params, timeout=10)
        res.raise_for_status()
        data = res.json()
        entry = data["list"][0]
        return {
            "temp": entry["main"]["temp"],
            "wind": entry["wind"]["speed"],
            "rain": entry.get("pop", 0) * 100.0,  # %
        }
    except Exception as e:
        logger.error(f"🌧️ Weather fetch error: {e}")
        return None

# ---------- Token + user lookups ----------
def _iterate_users_with_tokens(tokens_container):
    """
    Token docs: { id:<email>, userId:<email>, tokens:[{token, platform, app, lastSeen}] }
    We only return users that actually have non-Expo FCM tokens.
    """
    for doc in tokens_container.read_all_items():
        email = doc.get("id") or doc.get("userId")
        toks = [t.get("token") for t in (doc.get("tokens") or []) if t.get("token")]
        toks = [t for t in toks if t and not t.startswith("ExponentPushToken")]
        if email and toks:
            yield email, toks

def _load_user(users_container, email):
    try:
        return users_container.read_item(item=email, partition_key=email)
    except Exception:
        rows = list(users_container.query_items(
            query="SELECT * FROM c WHERE c.email = @e OR c.id = @e",
            parameters=[{"name": "@e", "value": email}],
            enable_cross_partition_query=True,
        ))
        return rows[0] if rows else None

# ---------- Send ----------
def _send_multicast(tokens, title, body, data=None):
    msg = messaging.MulticastMessage(
        tokens=tokens,
        notification=messaging.Notification(title=title, body=body),
        data=data or {},
        android=messaging.AndroidConfig(
            priority="high",
            notification=messaging.AndroidNotification(channel_id="default"),
        ),
    )
    resp = messaging.send_each_for_multicast(msg)
    invalid = []
    for idx, r in enumerate(resp.responses):
        if not r.success:
            msg = getattr(r.exception, "message", str(r.exception))
            logger.warning(f"[FCM] send failed for token[{idx}]: {msg}")
            if "registration-token-not-registered" in msg or "invalid-argument" in msg:
                invalid.append(tokens[idx])
    return resp.success_count, resp.failure_count, invalid

# ---------- Main timer ----------
def main(mytimer: func.TimerRequest) -> None:
    if mytimer.past_due:
        logger.warning("Timer is past due")

    logger.info("🚀 Weather advice push started")
    _init_firebase()

    try:
        users_c, tokens_c = _cosmos()
    except Exception as e:
        logger.error(f"Cosmos init failed: {e}")
        return

    sent = 0
    for email, token_list in _iterate_users_with_tokens(tokens_c):
        try:
            user = _load_user(users_c, email)
            if not user:
                logger.info(f"Skip {email}: user doc not found")
                continue

            # Optional: honor user settings if present
            ns = (user.get("notificationSettings") or {})
            if ns.get("enabled") is False:
                logger.info(f"Skip {email}: notifications disabled")
                continue

            loc = user.get("location") or {}
            lat, lon = loc.get("latitude"), loc.get("longitude")
            if lat is None or lon is None:
                logger.info(f"Skip {email}: no coordinates")
                continue

            wx = get_weather_forecast(lat, lon)
            if not wx:
                continue

            temp, wind, rain = wx["temp"], wx["wind"], wx["rain"]
            if rain > 50:
                message = "☔ Rain expected today — bring your plants inside."
            elif wind > 20:
                message = "🌬️ Strong winds today — protect your plants!"
            elif temp > 30:
                message = "🌡️ It's hot today — move your plants to the shade."
            else:
                message = "✅ Weather looks great for your plants today!"

            title = "🌱 Plant Weather Update"
            data = {
                "type": "WEATHER_TIP",
                "ts": str(datetime.utcnow().timestamp()),
            }

            ok, fail, invalid = _send_multicast(token_list, title, message, data)
            sent += ok
            if invalid:
                logger.warning(f"[{email}] invalid tokens={len(invalid)}")
        except Exception as e:
            logger.exception(f"User {email} failed: {e}")

    logger.info(f"📤 Weather advice done. Sent: {sent}")
