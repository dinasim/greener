# business-weather-forecast/__init__.py - OpenWeatherMap 5-day/7-day/14-day forecast (FREE tier)
import logging
import json
import azure.functions as func
from azure.cosmos import CosmosClient
import os
import requests
from datetime import datetime
import time

# Database connection
MARKETPLACE_CONNECTION_STRING = os.environ.get("COSMOSDB__MARKETPLACE_CONNECTION_STRING")
MARKETPLACE_DATABASE_NAME = os.environ.get("COSMOSDB_MARKETPLACE_DATABASE_NAME", "greener-marketplace-db")

# OpenWeatherMap API key - FREE TIER
OPENWEATHER_API_KEY = os.environ.get("OPENWEATHER_API_KEY")

# Forecast data caching to minimize API calls
_forecast_cache = {}
_forecast_cache_expiry = 60 * 60  # 1 hour cache for forecast data

def add_cors_headers(response):
    response.headers.update({
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Email'
    })
    return response

def get_cached_forecast(lat, lon, days):
    """Check if forecast data is cached and not expired"""
    cache_key = f"forecast_{round(lat, 3)},{round(lon, 3)}_{days}d"
    if cache_key in _forecast_cache:
        cached_data, timestamp = _forecast_cache[cache_key]
        if time.time() - timestamp < _forecast_cache_expiry:
            logging.info(f"✅ FORECAST CACHE HIT - Using cached {days}-day data for: {lat}, {lon}")
            return cached_data
    return None

def cache_forecast_data(lat, lon, days, data):
    """Cache forecast data for 1 hour"""
    cache_key = f"forecast_{round(lat, 3)},{round(lon, 3)}_{days}d"
    _forecast_cache[cache_key] = (data, time.time())

def get_forecast_data(lat, lon, days=5):
    """Get weather forecast from OpenWeatherMap API FREE TIER
    
    Args:
        lat: Latitude
        lon: Longitude
        days: Number of days (5, 7, or 14)
    
    Returns:
        Forecast data from OpenWeatherMap
    """
    if not OPENWEATHER_API_KEY:
        raise Exception("OpenWeatherMap API key not configured")
    
    # Check cache first
    cached_forecast = get_cached_forecast(lat, lon, days)
    if cached_forecast:
        return cached_forecast
    
    # Determine API endpoint and parameters based on days requested
    if days <= 5:
        # Use 5-day/3-hour forecast API (FREE)
        url = "http://api.openweathermap.org/data/2.5/forecast"
        params = {
            'lat': lat,
            'lon': lon,
            'appid': OPENWEATHER_API_KEY,
            'units': 'metric',
            'lang': 'en',
            'cnt': min(40, days * 8)  # 8 data points per day (3-hour intervals)
        }
        logging.info(f"🌤️ Using 5-day forecast API for {days} days")
    else:
        # Use 16-day daily forecast API (FREE - up to 16 days)
        url = "http://api.openweathermap.org/data/2.5/forecast/daily"
        params = {
            'lat': lat,
            'lon': lon,
            'appid': OPENWEATHER_API_KEY,
            'units': 'metric',
            'lang': 'en',
            'cnt': min(16, days)  # Maximum 16 days on free tier
        }
        logging.info(f"🌤️ Using 16-day daily forecast API for {days} days")
    
    logging.info(f"🌤️ Making OpenWeatherMap FORECAST API call for: {lat}, {lon} ({days} days)")
    response = requests.get(url, params=params, timeout=10)
    response.raise_for_status()
    
    forecast_data = response.json()
    
    # Normalize the response format for daily vs 3-hourly data
    if days > 5:
        # Daily forecast - convert to match 3-hourly format for consistency
        normalized_data = {
            'city': forecast_data.get('city', {}),
            'list': []
        }
        
        for item in forecast_data.get('list', []):
            # Convert daily forecast to match 3-hourly format
            wind_speed = item.get('wind_speed')
            # Fallback: OpenWeatherMap daily API uses 'wind_speed', but check for 'wind' dict for future compatibility
            if wind_speed is None and 'wind' in item and 'speed' in item['wind']:
                wind_speed = item['wind']['speed']
            daily_item = {
                "dt": item['dt'],
                "dt_txt": datetime.fromtimestamp(item['dt']).strftime('%Y-%m-%d 12:00:00'),
                "main": {
                    "temp": round(item['temp']['day'], 1),
                    "feels_like": round(item['feels_like']['day'], 1),
                    "temp_min": round(item['temp']['min'], 1),
                    "temp_max": round(item['temp']['max'], 1),
                    "pressure": item['pressure'],
                    "humidity": item['humidity']
                },
                "weather": item['weather'],
                "clouds": {"all": item.get('clouds', 0)},
                "wind": {
                    "speed": wind_speed if wind_speed is not None else 0,
                    "deg": item.get('wind_deg', 0)
                },
                "visibility": 10000,  # Default visibility
                "pop": item.get('pop', 0),  # Probability of precipitation
                "rain": {"3h": item.get('rain', 0)} if item.get('rain', 0) > 0 else {},
                "snow": {"3h": item.get('snow', 0)} if item.get('snow', 0) > 0 else {},
                "sys": {"pod": "d"}  # Day period
            }
            normalized_data['list'].append(daily_item)
        
        forecast_data = normalized_data
    
    # Cache the result
    cache_forecast_data(lat, lon, days, forecast_data)
    
    return forecast_data

def get_business_location(business_id):
    """Get business location from database"""
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
        # Default location: Hadera, Israel
        return {
            'lat': 32.0853,
            'lon': 34.7818,
            'city': 'Hadera',
            'country': 'Israel'
        }

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Getting weather forecast data - OpenWeatherMap FREE tier with 7/14 day support')
    
    if req.method == 'OPTIONS':
        response = func.HttpResponse("", status_code=200)
        return add_cors_headers(response)
    
    try:
        # Get forecast period from query params (default: 5 days)
        days_param = req.params.get('days', '5')
        try:
            days = int(days_param)
            # Validate days parameter
            if days not in [5, 7, 14]:
                return func.HttpResponse(
                    json.dumps({"error": "Invalid days parameter. Supported values: 5, 7, 14"}),
                    status_code=400,
                    headers={"Content-Type": "application/json"}
                )
        except ValueError:
            return func.HttpResponse(
                json.dumps({"error": "Days parameter must be a number (5, 7, or 14)"}),
                status_code=400,
                headers={"Content-Type": "application/json"}
            )
        
        # Get coordinates from query params or business location
        lat = req.params.get('lat')
        lon = req.params.get('lon')
        business_id = req.params.get('businessId') or req.headers.get('X-User-Email')
        
        if lat and lon:
            # Use provided coordinates
            try:
                lat = float(lat)
                lon = float(lon)
                location_name = f"Location: {lat:.4f}, {lon:.4f}"
            except ValueError:
                return func.HttpResponse(
                    json.dumps({"error": "Invalid coordinates provided"}),
                    status_code=400,
                    headers={"Content-Type": "application/json"}
                )
        elif business_id:
            # Get business location
            location = get_business_location(business_id)
            lat = location['lat']
            lon = location['lon']
            location_name = f"{location['city']}, {location['country']}"
        else:
            return func.HttpResponse(
                json.dumps({"error": "Either coordinates (lat/lon) or businessId is required"}),
                status_code=400,
                headers={"Content-Type": "application/json"}
            )
        
        # Get forecast data from OpenWeatherMap
        forecast_data = get_forecast_data(lat, lon, days)
        
        # Format response to match expected structure
        response_data = {
            "location": location_name,
            "coordinates": {
                "latitude": lat,
                "longitude": lon
            },
            "forecast_period": days,
            "forecast_type": "daily" if days > 5 else "3-hourly",
            "list": [],
            "city": forecast_data.get('city', {}),
            "country": forecast_data.get('city', {}).get('country', 'IL'),
            "timestamp": datetime.utcnow().isoformat(),
            "source": f"OpenWeatherMap-{days}Day-Forecast-Free"
        }
        
        # Process forecast items
        for item in forecast_data.get('list', []):
            forecast_item = {
                "dt": item['dt'],
                "dt_txt": item['dt_txt'],
                "main": {
                    "temp": round(item['main']['temp'], 1),
                    "feels_like": round(item['main']['feels_like'], 1),
                    "temp_min": round(item['main']['temp_min'], 1),
                    "temp_max": round(item['main']['temp_max'], 1),
                    "pressure": item['main']['pressure'],
                    "humidity": item['main']['humidity']
                },
                "weather": item['weather'],
                "clouds": item.get('clouds', {}),
                "wind": item.get('wind', {}),
                "visibility": item.get('visibility', 10000),
                "pop": item.get('pop', 0),  # Probability of precipitation
                "rain": item.get('rain', {}),
                "snow": item.get('snow', {}),
                "sys": item.get('sys', {})
            }
            response_data['list'].append(forecast_item)
        
        logging.info(f"✅ {days}-day forecast data retrieved for {lat}, {lon} - {len(response_data['list'])} forecast points")
        
        response = func.HttpResponse(
            json.dumps(response_data),
            status_code=200,
            headers={"Content-Type": "application/json"}
        )
        return add_cors_headers(response)
        
    except requests.RequestException as e:
        logging.error(f'OpenWeatherMap FORECAST API error: {str(e)}')
        return func.HttpResponse(
            json.dumps({"error": "Weather forecast service temporarily unavailable"}),
            status_code=503,
            headers={"Content-Type": "application/json"}
        )
    except Exception as e:
        logging.error(f'Forecast function error: {str(e)}')
        return func.HttpResponse(
            json.dumps({"error": str(e)}),
            status_code=500,
            headers={"Content-Type": "application/json"}
        )