# business-weather-get/__init__.py
import logging
import json
import azure.functions as func
from azure.cosmos import CosmosClient
import os
import requests
from datetime import datetime, timedelta

# Database connection
MARKETPLACE_CONNECTION_STRING = os.environ.get("COSMOSDB__MARKETPLACE_CONNECTION_STRING")
MARKETPLACE_DATABASE_NAME = os.environ.get("COSMOSDB_MARKETPLACE_DATABASE_NAME", "greener-marketplace-db")

# OpenWeatherMap API key - Add this to Azure Function App Settings
OPENWEATHER_API_KEY = os.environ.get("OPENWEATHER_API_KEY")

def add_cors_headers(response):
    response.headers.update({
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Email'
    })
    return response

def get_weather_data(lat, lon):
    """Get real weather data from OpenWeatherMap API"""
    if not OPENWEATHER_API_KEY:
        raise Exception("OpenWeatherMap API key not configured")
    
    url = f"http://api.openweathermap.org/data/2.5/weather"
    params = {
        'lat': lat,
        'lon': lon,
        'appid': OPENWEATHER_API_KEY,
        'units': 'metric'
    }
    
    response = requests.get(url, params=params, timeout=10)
    response.raise_for_status()
    
    return response.json()

def get_business_location(business_id):
    """Get business location from database"""
    try:
        params = dict(param.split('=', 1) for param in MARKETPLACE_CONNECTION_STRING.split(';'))
        client = CosmosClient(params['AccountEndpoint'], credential=params['AccountKey'])
        database = client.get_database_client(MARKETPLACE_DATABASE_NAME)
        business_container = database.get_container_client("business_users")
        
        business = business_container.read_item(item=business_id, partition_key=business_id)
        
        # Return default location if not found in business profile
        location = business.get('location', {})
        return {
            'lat': location.get('latitude', 32.0853),  # Default: Hadera, Israel
            'lon': location.get('longitude', 34.7818),
            'city': location.get('city', 'Hadera'),
            'country': location.get('country', 'Israel')
        }
    except:
        # Default location: Hadera, Israel
        return {
            'lat': 32.0853,
            'lon': 34.7818,
            'city': 'Hadera',
            'country': 'Israel'
        }

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Getting business weather data')
    
    if req.method == 'OPTIONS':
        response = func.HttpResponse("", status_code=200)
        return add_cors_headers(response)
    
    try:
        business_id = req.params.get('businessId') or req.headers.get('X-User-Email')
        
        if not business_id:
            return func.HttpResponse(
                json.dumps({"error": "Business ID is required"}),
                status_code=400,
                headers={"Content-Type": "application/json"}
            )
        
        # Get business location
        location = get_business_location(business_id)
        
        # Get real weather data
        weather_data = get_weather_data(location['lat'], location['lon'])
        
        # Format response
        response_data = {
            "location": f"{location['city']}, {location['country']}",
            "coordinates": {
                "latitude": location['lat'],
                "longitude": location['lon']
            },
            "temperature": round(weather_data['main']['temp']),
            "feelsLike": round(weather_data['main']['feels_like']),
            "condition": weather_data['weather'][0]['description'].title(),
            "humidity": weather_data['main']['humidity'],
            "windSpeed": weather_data['wind']['speed'],
            "precipitation": weather_data.get('rain', {}).get('1h', 0),
            "icon": weather_data['weather'][0]['icon'],
            "timestamp": datetime.utcnow().isoformat(),
            "rainToday": weather_data.get('rain', {}).get('1h', 0) > 0,
            "weatherCode": weather_data['weather'][0]['id']
        }
        
        response = func.HttpResponse(
            json.dumps(response_data),
            status_code=200,
            headers={"Content-Type": "application/json"}
        )
        return add_cors_headers(response)
        
    except requests.RequestException as e:
        logging.error(f'Weather API error: {str(e)}')
        return func.HttpResponse(
            json.dumps({"error": "Weather service temporarily unavailable"}),
            status_code=503,
            headers={"Content-Type": "application/json"}
        )
    except Exception as e:
        logging.error(f'Weather function error: {str(e)}')
        return func.HttpResponse(
            json.dumps({"error": str(e)}),
            status_code=500,
            headers={"Content-Type": "application/json"}
        )