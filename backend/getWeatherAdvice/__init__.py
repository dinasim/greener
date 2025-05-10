import logging
import azure.functions as func
import os
import requests
import json
from dotenv import load_dotenv

# Load API key from .env file
load_dotenv()
AZURE_MAPS_KEY = os.getenv("AZURE_MAPS_KEY")

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('getWeatherAdvice function triggered.')

    try:
        # Parse incoming JSON from request body
        data = req.get_json()
        lat = data.get("latitude")
        lon = data.get("longitude")
        placement = data.get("placement", "outsidePotted")

        if not lat or not lon:
            return func.HttpResponse("Missing coordinates", status_code=400)

        # Call Azure Maps Weather API
        weather_url = "https://atlas.microsoft.com/weather/currentConditions/json"
        params = {
            "api-version": "1.1",
            "query": f"{lat},{lon}",
            "subscription-key": AZURE_MAPS_KEY
        }
        res = requests.get(weather_url, params=params)
        res.raise_for_status()

        weather_data = res.json()
        temp_c = weather_data["results"][0]["temperature"]["value"]

        # Generate plant care advice based on weather and placement
        if placement == "inside":
            advice = "Your plant is inside — no action needed."
        elif temp_c > 30:
            advice = "It's hot 🌞. Move your plant to shade."
        elif temp_c < 10:
            advice = "It's cold 🥶. Bring your plant inside."
        else:
            advice = "Weather looks good for your plant outside! ✅"
            
        print("✅ Using json module:", json)
        return func.HttpResponse(
            json.dumps({
                "temperature": temp_c,
                "advice": advice
            }),
            mimetype="application/json"
        )

    except Exception as e:
        logging.error(f"Error in getWeatherAdvice: {e}")
        return func.HttpResponse("Server error", status_code=500)