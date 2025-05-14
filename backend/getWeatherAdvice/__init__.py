import logging
import azure.functions as func
import os
import requests
import json
from dotenv import load_dotenv

# Load environment variables
load_dotenv()
AZURE_MAPS_KEY = os.getenv("AZURE_MAPS_KEY")

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('🌱 getWeatherAdvice function triggered.')

    try:
        data = req.get_json()
        lat = data.get("latitude")
        lon = data.get("longitude")
        location_name = data.get("locationName")  # e.g., "Tel Aviv, Israel"
        placement = data.get("placement", "outsidePotted")

        if not AZURE_MAPS_KEY:
            return func.HttpResponse("Missing Azure Maps Key", status_code=500)

        # Resolve location to coordinates if locationName is provided
        if location_name and not (lat and lon):
            geocode_url = "https://atlas.microsoft.com/search/address/json"
            geo_params = {
                "api-version": "1.0",
                "subscription-key": AZURE_MAPS_KEY,
                "query": location_name
            }
            geo_res = requests.get(geocode_url, params=geo_params)
            geo_res.raise_for_status()
            geo_data = geo_res.json()

            if geo_data["results"]:
                coords = geo_data["results"][0]["position"]
                lat = coords["lat"]
                lon = coords["lon"]
            else:
                return func.HttpResponse("Location not found", status_code=404)

        if not lat or not lon:
            return func.HttpResponse("Missing coordinates or location name", status_code=400)

        # Fetch weather data
        weather_url = "https://atlas.microsoft.com/weather/currentConditions/json"
        weather_params = {
            "api-version": "1.1",
            "query": f"{lat},{lon}",
            "subscription-key": AZURE_MAPS_KEY
        }
        weather_res = requests.get(weather_url, params=weather_params)
        weather_res.raise_for_status()
        weather_data = weather_res.json()
        temp_c = weather_data["results"][0]["temperature"]["value"]

        # Determine advice
        if placement == "inside":
            advice = "Your plant is inside — no action needed."
        elif temp_c > 30:
            advice = "It's hot 🌞. Move your plant to shade."
        elif temp_c < 10:
            advice = "It's cold 🥶. Bring your plant inside."
        else:
            advice = "Weather looks good for your plant outside! ✅"

        return func.HttpResponse(
            json.dumps({
                "temperature": temp_c,
                "advice": advice
            }),
            mimetype="application/json"
        )

    except Exception as e:
        logging.error(f"❌ Error in getWeatherAdvice: {e}")
        return func.HttpResponse("Server error", status_code=500)
