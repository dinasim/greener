import logging
import azure.functions as func
import os
import requests
import json
from dotenv import load_dotenv

# Load environment variables
load_dotenv()
AZURE_MAPS_KEY = os.getenv("AZURE_MAPS_KEY")
EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('getWeatherAdvice function triggered.')

    try:
        # Parse request data
        data = req.get_json()
        lat = data.get("latitude")
        lon = data.get("longitude")
        expo_token = data.get("expoPushToken")

        # ✅ Exit early if location or token is missing
        if not lat or not lon or not expo_token:
            return func.HttpResponse(
                "Location not provided or missing Expo token. Skipping notification.",
                status_code=200
            )

        # Fetch weather forecast from Azure Maps
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
        forecast_data = res.json()

        today = forecast_data["forecasts"][0]
        temp_max = today["temperature"]["maximum"]["value"]
        wind_speed = today["day"]["wind"]["speed"]["value"]
        rain_chance = today["day"].get("precipitationProbability", 0)

        # Determine advice
        advice_list = []

        if rain_chance > 50:
            advice_list.append("🌧️ Rain expected today — bring your plants inside.")
        if wind_speed > 20:
            advice_list.append("💨 Strong winds today — protect your plants!")
        if temp_max > 86:
            advice_list.append("🌡️ It's hot today — consider moving your plants to shade.")
        if not advice_list:
            advice_list.append("✅ Weather looks good for your plants today.")

        # Send notification via Expo
        notification = {
            "to": expo_token,
            "sound": "default",
            "title": "🌿 Plant Weather Alert",
            "body": advice_list[0]  # First relevant message
        }

        push_res = requests.post(EXPO_PUSH_URL, json=notification)
        push_res.raise_for_status()

        return func.HttpResponse(
            json.dumps({
                "temperature": temp_max,
                "wind_speed": wind_speed,
                "rain_chance": rain_chance,
                "advice": advice_list,
                "notification_status": "sent"
            }),
            mimetype="application/json"
        )

    except Exception as e:
        logging.error(f"Error in getWeatherAdvice: {e}")
        return func.HttpResponse("Server error", status_code=500)
