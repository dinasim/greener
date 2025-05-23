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

def get_coordinates_from_city(city):
    try:
        url = "https://atlas.microsoft.com/search/address/json"
        params = {
            "api-version": "1.0",
            "subscription-key": AZURE_MAPS_KEY,
            "query": city,
            "countrySet": "IL"
        }
        response = requests.get(url, params=params)
        response.raise_for_status()
        data = response.json()

        if data["results"]:
            coords = data["results"][0]["position"]
            return coords["lat"], coords["lon"]
        else:
            logging.warning(f"No coordinates found for city: {city}")
            return None, None
    except Exception as e:
        logging.error(f"Error fetching coordinates for {city}: {str(e)}")
        return None, None

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info("✅ main() function entered")  # Very first line
    logging.info("🌿 Weather notification function started.")

    # Log env var checks
    logging.info(f"🔧 AZURE_MAPS_KEY loaded: {AZURE_MAPS_KEY is not None}")
    logging.info(f"🔧 COSMOS_URI loaded: {COSMOS_URI is not None}")
    logging.info(f"🔧 COSMOS_KEY loaded: {COSMOS_KEY is not None}")

    try:
        try:
            client = CosmosClient(COSMOS_URI, credential=COSMOS_KEY)
            database = client.get_database_client("GreenerDB")
            users_container = database.get_container_client("Users")
        except Exception as cosmos_error:
            logging.error("❌ Failed to initialize Cosmos DB client")
            logging.exception(cosmos_error)
            return func.HttpResponse("Cosmos DB setup error", status_code=500)        
        users = list(users_container.read_all_items())
        logging.info(f"📥 Fetched {len(users)} users from Cosmos DB")
        sent_notifications = []

        for user in users:
            email = user.get("email", "[no email]")
            location = user.get("location")
            token = user.get("expoPushToken")

            logging.info(f"🔍 Processing user: {email}")

            if not location:
                logging.warning(f"⚠️ Skipping {email} — no location data.")
                continue

            if not token or not isinstance(token, str):
                logging.warning(f"⚠️ Skipping {email} — missing or invalid push token.")
                continue

            # Determine coordinates
            if isinstance(location, dict) and "latitude" in location:
                lat = location["latitude"]
                lon = location["longitude"]
                logging.info(f"📍 Coordinates for {email}: {lat}, {lon}")
            elif isinstance(location, dict) and "city" in location:
                city = location["city"]
                logging.info(f"🌆 Getting coordinates for city: {city}")
                lat, lon = get_coordinates_from_city(city)
                if not lat or not lon:
                    logging.warning(f"❌ Skipping {email} — failed to geocode city.")
                    continue
            else:
                logging.warning(f"⚠️ Skipping {email} — unrecognized location format.")
                continue

            # Weather forecast call
            weather_url = "https://atlas.microsoft.com/weather/forecast/daily/json"
            params = {
                "api-version": "1.1",
                "query": f"{lat},{lon}",
                "subscription-key": AZURE_MAPS_KEY,
                "duration": 1,
                "unit": "metric"
            }

            res = requests.get(weather_url, params=params)
            res.raise_for_status()
            forecast = res.json()["forecasts"][0]

            temp = forecast["temperature"]["maximum"]["value"]
            wind = forecast["day"]["wind"]["speed"]["value"]
            rain = forecast["day"].get("precipitationProbability", 0)

            # Choose message
            if rain > 50:
                message = "☔ Rain expected today — bring your plants inside."
            elif wind > 20:
                message = "🌬️ Strong winds today — protect your plants!"
            elif temp > 30:
                message = "🌡️ It's hot today — move your plants to the shade."
            else:
                message = "✅ Weather looks great for your plants today!"

            push_payload = {
                "to": token,
                "sound": "default",
                "title": "🌿 Plant Weather Alert",
                "body": message
            }

            push_res = requests.post(EXPO_PUSH_URL, json=push_payload)
            push_res.raise_for_status()
            sent_notifications.append(email)

        return func.HttpResponse(
            json.dumps({
                "status": "done",
                "notified_users": sent_notifications
            }),
            mimetype="application/json"
        )

    except Exception as e:
        logging.error("🔥 Error sending weather advice:")
        logging.exception(e)
        return func.HttpResponse(f"Server error: {str(e)}", status_code=500)
