import logging
import azure.functions as func
import os
import requests
import json
import urllib.parse
import hmac
import hashlib
import base64
import time
from azure.cosmos import CosmosClient
from dotenv import load_dotenv

# Load environment variables
load_dotenv()
AZURE_MAPS_KEY = os.getenv("AZURE_MAPS_KEY")
COSMOS_URI = os.getenv("COSMOS_URI")
COSMOS_KEY = os.getenv("COSMOS_KEY")
NH_NAMESPACE = os.getenv("NH_NAMESPACE")
HUB_NAME = os.getenv("HUB_NAME")
NH_ACCESS_KEY = os.getenv("AZURE_NH_FULL_ACCESS_KEY")

# Cosmos setup
client = CosmosClient(COSMOS_URI, credential=COSMOS_KEY)
database = client.get_database_client("GreenerDB")
users_container = database.get_container_client("Users")

# Helper to generate SAS token
def generate_sas_token(uri, key_name, key_value, expiry=3600):
    ttl = int(time.time() + expiry)
    encoded_uri = urllib.parse.quote_plus(uri)
    sign_key = f"{encoded_uri}\n{ttl}"
    signature = base64.b64encode(
        hmac.new(
            key_value.encode("utf-8"),
            sign_key.encode("utf-8"),
            hashlib.sha256
        ).digest()
    )
    return f"SharedAccessSignature sr={encoded_uri}&sig={urllib.parse.quote_plus(signature)}&se={ttl}&skn={key_name}"

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info("✅ Weather notification function started.")

    try:
        users = list(users_container.read_all_items())
        logging.info(f"📥 Fetched {len(users)} users from Cosmos DB")
        sent_notifications = []

        for user in users:
            email = user.get("email", "[no email]")
            location = user.get("location")
            token = user.get("webPushSubscription")

            logging.info(f"🔍 Processing user: {email}")

            if not location or "city" not in location:
                logging.warning(f"⚠️ Skipping {email} — invalid or missing location.")
                continue

            if not token or not isinstance(token, dict) or not token.get("endpoint"):
                logging.warning(f"⚠️ Skipping {email} — invalid web push token.")
                continue

            # Geocode city
            city = location["city"]
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
            logging.info(f"📍 City {city} resolved to {lat}, {lon}")

            # Fetch weather
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

            if rain > 50:
                message = "☔ Rain expected today — bring your plants inside."
            elif wind > 20:
                message = "🌬️ Strong winds today — protect your plants!"
            elif temp > 30:
                message = "🌡️ It's hot today — move your plants to the shade."
            else:
                message = "✅ Weather looks great for your plants today!"

            # ✅ Send notification via Notification Hub
            hub_uri = f"https://{NH_NAMESPACE}.servicebus.windows.net/{HUB_NAME}"
            send_uri = f"{hub_uri}/messages/?api-version=2015-01"
            sas_token = generate_sas_token(hub_uri, "DefaultFullSharedAccessSignature", NH_ACCESS_KEY)

            headers = {
                "Authorization": sas_token,
                "Content-Type": "application/json",
                "ServiceBusNotification-Format": "webpush",
                "ServiceBusNotification-Tags": f"user:{email}"
            }

            payload = {
                "data": {
                    "title": "🌱 Plant Weather Update",
                    "body": message
                }
            }

            response = requests.post(send_uri, headers=headers, json=payload)
            response.raise_for_status()
            logging.info(f"✅ Notification sent to {email}")
            sent_notifications.append(email)

        return func.HttpResponse(
            json.dumps({"status": "done", "notified_users": sent_notifications}),
            mimetype="application/json"
        )

    except Exception as e:
        logging.error("🔥 Error sending weather advice:")
        logging.exception(e)
        return func.HttpResponse(f"Server error: {str(e)}", status_code=500)
