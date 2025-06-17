# business-weather-get/__init__.py - OPTIMIZED to use ONLY OpenWeatherMap free tier
import logging
import json
import azure.functions as func
from azure.cosmos import CosmosClient
import os
import requests
from datetime import datetime, timedelta
import time

# Database connection
MARKETPLACE_CONNECTION_STRING = os.environ.get("COSMOSDB__MARKETPLACE_CONNECTION_STRING")
MARKETPLACE_DATABASE_NAME = os.environ.get("COSMOSDB_MARKETPLACE_DATABASE_NAME", "greener-marketplace-db")

# OpenWeatherMap API key - FREE TIER (up to 1000 calls/day)
OPENWEATHER_API_KEY = os.environ.get("OPENWEATHER_API_KEY")

# Weather data caching to minimize API calls
_weather_cache = {}
_weather_cache_expiry = 30 * 60  # 30 minutes cache for weather (reasonable refresh rate)

def add_cors_headers(response):
    response.headers.update({
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Email'
    })
    return response

def get_cached_weather(lat, lon):
    """Check if weather data is cached and not expired"""
    cache_key = f"{round(lat, 3)},{round(lon, 3)}"  # Round for cache efficiency
    if cache_key in _weather_cache:
        cached_data, timestamp = _weather_cache[cache_key]
        if time.time() - timestamp < _weather_cache_expiry:
            logging.info(f"✅ WEATHER CACHE HIT - Using cached data for: {lat}, {lon}")
            return cached_data
    return None

def cache_weather_data(lat, lon, data):
    """Cache weather data for 30 minutes"""
    cache_key = f"{round(lat, 3)},{round(lon, 3)}"
    _weather_cache[cache_key] = (data, time.time())

def get_weather_data(lat, lon):
    """Get real weather data from OpenWeatherMap API FREE TIER"""
    if not OPENWEATHER_API_KEY:
        raise Exception("OpenWeatherMap API key not configured")
    
    # Check cache first
    cached_weather = get_cached_weather(lat, lon)
    if cached_weather:
        return cached_weather
    
    # Call OpenWeatherMap Current Weather API (FREE)
    url = f"http://api.openweathermap.org/data/2.5/weather"
    params = {
        'lat': lat,
        'lon': lon,
        'appid': OPENWEATHER_API_KEY,
        'units': 'metric',
        'lang': 'en'
    }
    
    logging.info(f"🌤️ Making OpenWeatherMap API call for: {lat}, {lon}")
    response = requests.get(url, params=params, timeout=10)
    response.raise_for_status()
    
    weather_data = response.json()
    
    # Cache the result
    cache_weather_data(lat, lon, weather_data)
    
    return weather_data

def get_business_location(business_id):
    """Get business location from database - NO Azure Maps usage"""
    try:
        params = dict(param.split('=', 1) for param in MARKETPLACE_CONNECTION_STRING.split(';'))
        client = CosmosClient(params['AccountEndpoint'], credential=params['AccountKey'])
        database = client.get_database_client(MARKETPLACE_DATABASE_NAME)
        business_container = database.get_container_client("business_users")
        
        business = business_container.read_item(item=business_id, partition_key=business_id)
        
        # Return location from stored business profile
        location = business.get('location', {})
        return {
            'lat': location.get('latitude', 32.0853),  # Default: Hadera, Israel
            'lon': location.get('longitude', 34.7818),
            'city': location.get('city', 'Hadera'),
            'country': location.get('country', 'Israel')
        }
    except Exception as e:
        logging.warning(f"Could not retrieve business location: {str(e)}")
        # Default location: Hadera, Israel (central Israel location)
        return {
            'lat': 32.0853,
            'lon': 34.7818,
            'city': 'Hadera',
            'country': 'Israel'
        }

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Getting business weather data - OpenWeatherMap FREE tier only')
    
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
        
        # Get business location from database (no external API calls)
        location = get_business_location(business_id)
        
        # Get weather data from OpenWeatherMap FREE tier with caching
        weather_data = get_weather_data(location['lat'], location['lon'])
        
        # Format response with comprehensive weather info
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
            "weatherCode": weather_data['weather'][0]['id'],
            "pressure": weather_data['main']['pressure'],
            "visibility": weather_data.get('visibility', 10000) / 1000,  # Convert to km
            "uvIndex": weather_data.get('uvi', 0),
            "sunrise": datetime.fromtimestamp(weather_data['sys']['sunrise']).isoformat(),
            "sunset": datetime.fromtimestamp(weather_data['sys']['sunset']).isoformat(),
            "source": "OpenWeatherMap-Free"
        }
        
        # Add cloud coverage if available
        if 'clouds' in weather_data:
            response_data['cloudiness'] = weather_data['clouds']['all']
        
        # Add snow data if available
        if 'snow' in weather_data:
            response_data['snow1h'] = weather_data['snow'].get('1h', 0)
        
        response = func.HttpResponse(
            json.dumps(response_data),
            status_code=200,
            headers={"Content-Type": "application/json"}
        )
        return add_cors_headers(response)
        
    except requests.RequestException as e:
        logging.error(f'OpenWeatherMap API error: {str(e)}')
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