import logging
import os
import requests
import json
from azure.cosmos import CosmosClient
import firebase_admin
from firebase_admin import credentials, messaging
import azure.functions as func

logging.warning("🟡 [IMPORT] File started loading...")

# Top-level import & setup with debugging/logging protection
try:
    logging.warning("🟢 [IMPORT] azure.functions OK")
    logging.warning("🟢 [IMPORT] os OK")
    logging.warning("🟢 [IMPORT] requests OK")
    logging.warning("🟢 [IMPORT] json OK")
    logging.warning("🟢 [IMPORT] CosmosClient OK")
    logging.warning("🟢 [IMPORT] firebase_admin OK")
    logging.warning("🟢 [IMPORT] firebase_admin.credentials, messaging OK")
except Exception as e:
    logging.error(f"❌ [IMPORT CRASHED] {e}")
    raise

# Setup & config (should NOT be indented)
firebase_initialized = False

def init_firebase():
    global firebase_initialized
    if not firebase_initialized:
        logging.warning("⚙️ Initializing Firebase...")
        cred = credentials.Certificate(os.path.join(os.path.dirname(__file__), 'serviceAccountKey.json'))
        firebase_admin.initialize_app(cred)
        firebase_initialized = True
        logging.warning("✅ Firebase initialized.")

# Load environment variables
AZURE_MAPS_KEY = os.getenv("AZURE_MAPS_KEY")
COSMOS_URI = os.getenv("COSMOS_URI")
COSMOS_KEY = os.getenv("COSMOS_KEY")

# Log keys for debugging (first 6 chars only for safety)
logging.warning(f"🔑 [IMPORT] AZURE_MAPS_KEY: {str(AZURE_MAPS_KEY)[:6]}... (type={type(AZURE_MAPS_KEY)})")
logging.warning(f"🔑 [IMPORT] COSMOS_URI: {str(COSMOS_URI)[:6]}... (type={type(COSMOS_URI)})")
logging.warning(f"🔑 [IMPORT] COSMOS_KEY: {str(COSMOS_KEY)[:6]}... (type={type(COSMOS_KEY)})")

# Cosmos setup
try:
    client = CosmosClient(COSMOS_URI, credential=COSMOS_KEY)
    database = client.get_database_client("GreenerDB")
    users_container = database.get_container_client("Users")
except Exception as top_level_exc:
    import sys
    logging.error(f"🔥 [TOP-LEVEL ERROR] Import or setup failed: {top_level_exc}")
    sys.exit(1)

# -------------------------------------------
def main(mytimer: func.TimerRequest) -> None:
    if mytimer.past_due:
        logging.warning('The timer is past due!')
    logging.warning("🚀 getWeatherAdvice function started")

    try:
        init_firebase()
    except Exception as e:
        logging.error(f"🔥 Firebase initialization failed: {e}")
        return

    try:
        users = list(users_container.read_all_items())
        logging.info(f"📥 Fetched {len(users)} users from Cosmos DB")
        sent_notifications = []

        for user in users:
            email = user.get("email", "[no email]")
            location = user.get("location")
            token = user.get("webPushSubscription") or user.get("fcmToken")

            logging.info(f"🔍 Processing user: {email}")

            if not location or "city" not in location:
                logging.warning(f"⚠️ Skipping {email} — invalid or missing location.")
                continue

            if not token:
                logging.warning(f"⚠️ Skipping {email} — invalid push token.")
                continue

            city = location["city"]
            logging.warning(f"🌆 [DEBUG] City: {city}")
            logging.warning(f"🔑 [DEBUG] Azure Maps Key: {AZURE_MAPS_KEY[:6]}... (length={len(AZURE_MAPS_KEY) if AZURE_MAPS_KEY else 0})")

            logging.info(f"🌍 Attempting to geocode city: {city}")

            try:
                geo_url = "https://atlas.microsoft.com/search/address/json"
                geo_params = {
                    "api-version": "1.0",
                    "subscription-key": AZURE_MAPS_KEY,
                    "query": city,
                    "countrySet": "IL"
                }
                geo_res = requests.get(geo_url, params=geo_params)
                geo_res.raise_for_status()
                geo_data = geo_res.json()
                if not geo_data["results"]:
                    logging.warning(f"❌ Skipping {email} — failed to geocode city.")
                    continue
                coords = geo_data["results"][0]["position"]
                lat, lon = coords["lat"], coords["lon"]
                logging.info(f"📍 {city} resolved to coordinates: {lat}, {lon}")
            except Exception as geo_err:
                logging.error(f"❌ Geocoding failed for {email}: {geo_err}")
                continue

            try:
                weather_url = "https://atlas.microsoft.com/weather/forecast/daily/json"
                weather_params = {
                    "api-version": "1.1",
                    "query": f"{lat},{lon}",
                    "subscription-key": AZURE_MAPS_KEY,
                    "duration": 1,
                    "unit": "metric"
                }
                res = requests.get(weather_url, params=weather_params)
                res.raise_for_status()
                forecast = res.json()["forecasts"][0]
                temp = forecast["temperature"]["maximum"]["value"]
                wind = forecast["day"]["wind"]["speed"]["value"]
                rain = forecast["day"].get("precipitationProbability", 0)
                logging.info(f"🌡️ Temp: {temp}°C, 💨 Wind: {wind} km/h, 🌧️ Rain Chance: {rain}%")
                if rain > 50:
                    message = "☔ Rain expected today — bring your plants inside."
                elif wind > 20:
                    message = "🌬️ Strong winds today — protect your plants!"
                elif temp > 30:
                    message = "🌡️ It's hot today — move your plants to the shade."
                elif temp < 27:
                    message = f"🧪 Test: It's {temp}°C today — sending test notification."
                else:
                    message = "✅ Weather looks great for your plants today!"
            except Exception as weather_err:
                logging.error(f"❌ Weather fetch failed for {email}: {weather_err}")
                continue

            # Send Firebase push
            try:
                firebase_message = messaging.Message(
                    notification=messaging.Notification(
                        title="🌱 Plant Weather Update",
                        body=message
                    ),
                    token=token
                )
                response = messaging.send(firebase_message)
                logging.info(f"✅ Notification sent to {email}: {response}")
                sent_notifications.append(email)
            except Exception as send_err:
                logging.error(f"❌ Push send failed for {email}: {send_err}")

        logging.info(f"✅ Weather advice notifications sent: {sent_notifications}")

    except Exception as outer_err:
        logging.error("🔥 Unhandled error in main logic:")
        logging.exception(outer_err)
        # No return, just log

