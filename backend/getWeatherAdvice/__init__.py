# getWeatherAdviceFree/__init__.py
import logging
import os
import requests
import json
from azure.cosmos import CosmosClient
import firebase_admin
from firebase_admin import credentials, messaging
import azure.functions as func
from datetime import datetime

# Firebase setup
firebase_initialized = False
def init_firebase():
    global firebase_initialized
    if not firebase_initialized:
        cred = credentials.Certificate(os.path.join(os.path.dirname(__file__), 'serviceAccountKey.json'))
        firebase_admin.initialize_app(cred)
        firebase_initialized = True
        logging.info("✅ Firebase initialized")

# Environment variables
COSMOS_URI = os.getenv("COSMOS_URI")
COSMOS_KEY = os.getenv("COSMOS_KEY")
OPENWEATHER_API_KEY = os.getenv("OPENWEATHER_API_KEY")

# Cosmos setup
client = CosmosClient(COSMOS_URI, credential=COSMOS_KEY)
database = client.get_database_client("GreenerDB")
users_container = database.get_container_client("Users")

# OpenWeatherMap API wrapper (1-day forecast)
def get_weather_forecast(lat, lon):
    try:
        url = "https://api.openweathermap.org/data/2.5/forecast"
        params = {
            "lat": lat,
            "lon": lon,
            "appid": OPENWEATHER_API_KEY,
            "units": "metric",
            "cnt": 8  # ~24h worth of 3-hourly data
        }
        res = requests.get(url, params=params, timeout=10)
        res.raise_for_status()
        data = res.json()
        # Use the first entry (now) as the representative forecast
        entry = data['list'][0]
        return {
            "temp": entry['main']['temp'],
            "wind": entry['wind']['speed'],
            "rain": entry.get('pop', 0) * 100  # convert to percent
        }
    except Exception as e:
        logging.error(f"🌧️ Weather fetch error: {e}")
        return None

def main(mytimer: func.TimerRequest) -> None:
    if mytimer.past_due:
        logging.warning('The timer is past due!')

    logging.info("🚀 getWeatherAdviceFree function started")
    init_firebase()

    users = list(users_container.read_all_items())
    logging.info(f"📥 Found {len(users)} users")
    sent_notifications = []

    for user in users:
        email = user.get("email", "[unknown]")
        location = user.get("location")
        token = user.get("webPushSubscription") or user.get("fcmToken")

        if not location or not token:
            logging.warning(f"⚠️ Skipping {email} — no location or token")
            continue

        lat = location.get("latitude")
        lon = location.get("longitude")
        if lat is None or lon is None:
            logging.warning(f"⚠️ Skipping {email} — incomplete coordinates")
            continue

        forecast = get_weather_forecast(lat, lon)
        if not forecast:
            logging.warning(f"❌ No forecast data for {email}")
            continue

        temp = forecast['temp']
        wind = forecast['wind']
        rain = forecast['rain']

        # Generate advice
        if rain > 50:
            message = "☔ Rain expected today — bring your plants inside."
        elif wind > 20:
            message = "🌬️ Strong winds today — protect your plants!"
        elif temp > 30:
            message = "🌡️ It's hot today — move your plants to the shade."
        elif temp < 28:
            message = f"🧪 Test: It's {temp}°C today — sending test notification."
        else:
            message = "✅ Weather looks great for your plants today!"



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
            logging.info(f"✅ Sent to {email}: {response}")
            sent_notifications.append(email)
        except Exception as send_err:
            logging.error(f"❌ Failed to send to {email}: {send_err}")

    logging.info(f"📤 Sent weather advice to: {sent_notifications}")

