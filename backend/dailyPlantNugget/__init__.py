import os
import json
import random
import logging
import datetime
import azure.functions as func
from azure.cosmos import CosmosClient

# --- Optional Gemini for generating a daily tip ---
USE_GEMINI = True
try:
    import google.generativeai as genai  # pip install google-generativeai
except Exception:
    USE_GEMINI = False

# --- Firebase Admin for FCM ---
import firebase_admin
from firebase_admin import credentials, messaging

import requests  # for Expo push

# ====== CONFIG ======
COSMOS_URI = os.environ.get("COSMOS_URI")
COSMOS_KEY = os.environ.get("COSMOS_KEY")
COSMOS_DB_NAME = os.environ.get("COSMOS_DATABASE_NAME", "GreenerDB")  # keep in sync with your env
USERS_CONTAINER = os.environ.get("USERS_CONTAINER_NAME", "Users")

# If you use Gemini, supply the key via env (safer than hardcoding)
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-1.5-flash")

# Path to your Firebase service account JSON (same as your other function)
FIREBASE_SA_PATH = os.path.join(os.path.dirname(__file__), "serviceAccountKey.json")

# Optional: Deep link / route when users tap notification
DEEPLINK_ROUTE = os.environ.get("DAILY_TIP_DEEPLINK", "greener://learn/daily-tip")

# A tiny curated fallback list if Gemini is unavailable
STATIC_TIPS = [
    "Most houseplants prefer bright, indirect light—direct midday sun can scorch leaves.",
    "Water less in winter: cooler temps and shorter days slow plant growth and water needs.",
    "Rotate your plants weekly for even growth and to prevent them from leaning to the light.",
    "Let the top 2–3 cm of soil dry before watering most tropical houseplants.",
    "Dusty leaves block light—wipe with a damp cloth to boost photosynthesis.",
    "Terracotta pots breathe and help prevent overwatering, but dry out faster than plastic.",
    "Bottom watering can encourage deeper roots and reduce fungus gnats.",
    "Yellow leaves often signal overwatering; crispy brown tips often mean low humidity.",
]

firebase_initialized = False
def _init_firebase_once():
    global firebase_initialized
    if not firebase_initialized:
        if not os.path.exists(FIREBASE_SA_PATH):
            logging.warning("Firebase serviceAccountKey.json not found; FCM sends will fail.")
        else:
            cred = credentials.Certificate(FIREBASE_SA_PATH)
            firebase_admin.initialize_app(cred)
            firebase_initialized = True

def _init_gemini():
    global USE_GEMINI
    if not GEMINI_API_KEY:
        USE_GEMINI = False
        return None
    try:
        genai.configure(api_key=GEMINI_API_KEY)
        return genai.GenerativeModel(GEMINI_MODEL)
    except Exception as e:
        logging.warning(f"Gemini init failed: {e}")
        USE_GEMINI = False
        return None

def _today_iso_date() -> str:
    return datetime.datetime.utcnow().date().isoformat()

def _generate_daily_tip_once():
    """Generate one short tip for the whole run (so we don't spam Gemini)."""
    model = _init_gemini() if USE_GEMINI else None
    if model:
        try:
            prompt = (
                "Give ONE concise, beginner-friendly plant care fact or mini-lesson (max 180 chars). "
                "Focus on actionable, specific advice (not generic). No hashtags. No emojis."
            )
            r = model.generate_content(prompt)
            text = (r.text or "").strip()
            if text:
                # hard cap length just in case
                return text[:240]
        except Exception as e:
            logging.warning(f"Gemini generation failed, using fallback: {e}")
    return random.choice(STATIC_TIPS)

def _send_fcm(token: str, title: str, body: str, data: dict = None):
    try:
        msg = messaging.Message(
            notification=messaging.Notification(title=title, body=body),
            token=token,
            data=data or {},
            webpush=messaging.WebpushConfig(
                notification=messaging.WebpushNotification(title=title, body=body)
            )
        )
        resp = messaging.send(msg)
        logging.info(f"✅ FCM sent to {token[:12]}… resp={resp}")
        return True
    except Exception as e:
        logging.error(f"❌ FCM send failed: {e}")
        return False

def _send_expo(expo_token: str, title: str, body: str, data: dict = None):
    try:
        payload = {
            "to": expo_token,
            "title": title,
            "body": body,
            "data": data or {},
            "sound": "default"
        }
        r = requests.post("https://exp.host/--/api/v2/push/send", json=payload, timeout=10)
        if r.ok:
            logging.info(f"✅ Expo push sent to {expo_token[:16]}…")
            return True
        else:
            logging.error(f"❌ Expo push failed {r.status_code}: {r.text}")
            return False
    except Exception as e:
        logging.error(f"❌ Expo push exception: {e}")
        return False

def _should_send_today(user_doc: dict) -> bool:
    last = (user_doc or {}).get("lastDailyTipSent")
    if not last:
        return True
    try:
        return datetime.date.fromisoformat(last) < datetime.datetime.utcnow().date()
    except Exception:
        return True

def _mark_sent_today(container, user_doc):
    try:
        today = _today_iso_date()
        container.patch_item(
            item=user_doc["id"],
            partition_key=user_doc["email"],
            patch_operations=[{"op": "add", "path": "/lastDailyTipSent", "value": today}]
        )
    except Exception as e:
        logging.warning(f"Could not patch lastDailyTipSent for {user_doc.get('email')}: {e}")

def _guess_lang(user_doc: dict) -> str:
    # Minimal stub — keep English default. Extend later if you store language.
    return "English"

def main(mytimer: func.TimerRequest) -> None:
    logging.info(f"🟢 dailyPlantNugget fired at {datetime.datetime.utcnow().isoformat()}Z")

    # Init clients
    client = CosmosClient(COSMOS_URI, credential=COSMOS_KEY)
    db = client.get_database_client(COSMOS_DB_NAME)
    users = db.get_container_client(USERS_CONTAINER)

    _init_firebase_once()
    tip = _generate_daily_tip_once()
    title = "🌿 Daily Plant Nugget"

    # Query users with high interest (handle your current 'intersted' field + variants)
    query = """
    SELECT c.id, c.email, c.name, c.fcmToken, c.webPushSubscription, c.expoPushToken,
           c.lastDailyTipSent, c.intersted, c.interested, c.interest
    FROM c
    WHERE
      (
        (IS_DEFINED(c.intersted) AND LOWER(c.intersted) = "high") OR
        (IS_DEFINED(c.interested) AND LOWER(c.interested) = "high") OR
        (IS_DEFINED(c.interest) AND (
            (IS_STRING(c.interest) AND LOWER(c.interest) = "high") OR
            (NOT IS_STRING(c.interest) AND c.interest >= 0.8)
        ))
      )
    """
    candidates = list(users.query_items(query=query, enable_cross_partition_query=True))
    logging.info(f"👥 Found {len(candidates)} high-interest users.")

    data_payload = {
        "type": "daily_tip",
        "deeplink": DEEPLINK_ROUTE,
        "ts": str(int(datetime.datetime.utcnow().timestamp()))
    }

    sent_count = 0
    for u in candidates:
        try:
            if not _should_send_today(u):
                continue

            any_sent = False
            fcm = u.get("fcmToken")
            web = u.get("webPushSubscription")
            expo = u.get("expoPushToken")

            # Prefer sending to all available channels (adjust if you want to prioritize one)
            if fcm:
                any_sent = _send_fcm(fcm, title, tip, data=data_payload) or any_sent
            if web:
                any_sent = _send_fcm(web, title, tip, data=data_payload) or any_sent
            if expo and str(expo).startswith("ExponentPushToken") or str(expo).startswith("ExpoPushToken"):
                any_sent = _send_expo(expo, title, tip, data=data_payload) or any_sent

            if any_sent:
                _mark_sent_today(users, u)
                sent_count += 1
        except Exception as e:
            logging.warning(f"⚠️ Could not process {u.get('email')}: {e}")

    logging.info(f"✅ Daily tips sent to {sent_count} users. Tip: {tip}")
