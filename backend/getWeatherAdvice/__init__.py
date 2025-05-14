import logging
import azure.functions as func
import os
import requests
import json
from dotenv import load_dotenv
from datetime import datetime, timedelta

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

        # Call Azure Maps Weather Forecast API (1-day)
        weather_url = "https://atlas.microsoft.com/weather/forecast/daily/json"
        params = {
            "api-version": "1.1",
            "query": f"{lat},{lon}",
            "subscription-key": AZURE_MAPS_KEY,
            "duration": 1,
            "unit": "imperial"  # Fahrenheit
        }
        res = requests.get(weather_url, params=params)
        res.raise_for_status()

        forecast_data = res.json()
        today = forecast_data["forecasts"][0]
        temp_max = today["temperature"]['maximum']['value']
        wind_speed = today["day"]['wind']['speed']['value']

        advice_list = []

        if temp_max > 86:
            advice_list.append("It's over 86°F today 🌡️ — bring your plants inside.")

        if wind_speed > 20:
            advice_list.append("Strong winds expected today 💨 — protect your plants!")

        if not advice_list:
            advice_list.append("Weather looks good for your plants today ✅")

        return func.HttpResponse(
            json.dumps({
                "temperature": temp_max,
                "wind_speed": wind_speed,
                "advice": advice_list,
                "send_time": "08:00 local time"
            }),
            mimetype="application/json"
        )

    except Exception as e:
        logging.error(f"Error in getWeatherAdvice: {e}")
        return func.HttpResponse("Server error", status_code=500)




{
    "bindings": [
      {
        "authLevel": "function",
        "type": "httpTrigger",
        "direction": "in",
        "name": "req",
        "methods": ["post"]
      },
      {
        "type": "http",
        "direction": "out",
        "name": "$return"
      }
    ]
  }
