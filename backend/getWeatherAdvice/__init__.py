import logging
import azure.functions as func
import os
import requests
import json
from azure.cosmos import CosmosClient
from dotenv import load_dotenv

# Load env vars
load_dotenv()
AZURE_MAPS_KEY = os.getenv("AZURE_MAPS_KEY")
COSMOS_URI = os.getenv("COSMOS_URI")
COSMOS_KEY = os.getenv("COSMOS_KEY")
EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"

# Cosmos setup
client = CosmosClient(COSMOS_URI, credential=COSMOS_KEY)
database = client.get_database_client("GreenerDB")
users_container = database.get_container_client("Users")

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info("🌿 Weather notification function started.")

    try:
        # Fetch all users
        users = list(users_container.read_all_items())
        sent_notifications = []

        for user in users:
            location = user.get("location")
            token = user.get("expoPushToken")

            if not location or not token:
                continue

            # Handle both formats: string or dict with coords
            if isinstance(location, dict) and "latitude" in location:
                lat = location["latitude"]
                lon = location["longitude"]
            elif isinstance(location, dict) and "city" in location:
                # Optional: convert city to lat/lon (needs Azure Maps geocoding)
                continue
            else:
                continue

            # Get forecast
            weather_url = "https://atlas.microsoft.com/weather/forecast/daily/json"
            params = {
                "api-version": "1.1",
                "query": f"{lat},{lon}",
                "subscription-key": AZURE_MAPS_KEY,
                "duration": 1,
                "unit": "imperial"
            }

            res = requests.get(weather_url, params=params)
            res.raise_for_status()
            forecast = res.json()["forecasts"][0]

            temp = forecast["temperature"]["maximum"]["value"]
            wind = forecast["day"]["wind"]["speed"]["value"]
            rain = forecast["day"].get("precipitationProbability", 0)

            # Weather advice
            if rain > 50:
                message = "🌧️ Rain expected today — bring your plants inside."
            elif wind > 20:
                message = "💨 Strong winds today — protect your plants!"
            elif temp > 86:
                message = "🌡️ It's hot today — move your plants to the shade."
            else:
                message = "✅ Weather looks great for your plants today!"

            # Send Expo push
            push_payload = {
                "to": token,
                "sound": "default",
                "title": "🌿 Plant Weather Alert",
                "body": message
            }

            push_res = requests.post(EXPO_PUSH_URL, json=push_payload)
            push_res.raise_for_status()
            sent_notifications.append(user["email"])

        return func.HttpResponse(
            json.dumps({
                "status": "done",
                "notified_users": sent_notifications
            }),
            mimetype="application/json"
        )

    except Exception as e:
        logging.error(f"🔥 Error sending weather advice: {e}")
        return func.HttpResponse("Server error", status_code=500)
