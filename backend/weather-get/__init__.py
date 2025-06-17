# weather-get/__init__.py - Consumer Weather Function - REAL API ONLY
import logging
import json
import azure.functions as func
import os
import requests
from datetime import datetime
import time

# OpenWeatherMap API key - REQUIRED
OPENWEATHER_API_KEY = os.environ.get("OPENWEATHER_API_KEY")

# Weather data caching to minimize API calls
_weather_cache = {}
_weather_cache_expiry = 30 * 60  # 30 minutes cache

def add_cors_headers(response):
    response.headers.update({
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Email'
    })
    return response

def get_cached_weather(lat, lon):
    """Check if weather data is cached and not expired"""
    cache_key = f"{round(lat, 3)},{round(lon, 3)}"
    if cache_key in _weather_cache:
        cached_data, timestamp = _weather_cache[cache_key]
        if time.time() - timestamp < _weather_cache_expiry:
            logging.info(f"✅ WEATHER CACHE HIT for: {lat}, {lon}")
            return cached_data
    return None

def cache_weather_data(lat, lon, data):
    """Cache weather data for 30 minutes"""
    cache_key = f"{round(lat, 3)},{round(lon, 3)}"
    _weather_cache[cache_key] = (data, time.time())

def get_weather_data(lat, lon):
    """Get REAL weather data from OpenWeatherMap - NO FALLBACKS"""
    if not OPENWEATHER_API_KEY:
        raise Exception("OpenWeatherMap API key not configured - cannot provide weather data")
    
    # Check cache first
    cached_weather = get_cached_weather(lat, lon)
    if cached_weather:
        return cached_weather
    
    logging.info(f"🌤️ Making OpenWeatherMap API call for: {lat}, {lon}")
    
    # Current weather API call
    current_url = f"http://api.openweathermap.org/data/2.5/weather"
    current_params = {
        'lat': lat,
        'lon': lon,
        'appid': OPENWEATHER_API_KEY,
        'units': 'metric'
    }
    
    # 5-day forecast API call
    forecast_url = f"http://api.openweathermap.org/data/2.5/forecast"
    forecast_params = {
        'lat': lat,
        'lon': lon,
        'appid': OPENWEATHER_API_KEY,
        'units': 'metric',
        'cnt': 40  # 5 days * 8 (3-hour intervals)
    }
    
    # Make both API calls - FAIL if either fails
    current_response = requests.get(current_url, params=current_params, timeout=15)
    current_response.raise_for_status()
    
    forecast_response = requests.get(forecast_url, params=forecast_params, timeout=15)
    forecast_response.raise_for_status()
    
    current_data = current_response.json()
    forecast_data = forecast_response.json()
    
    # Process forecast data to create daily summaries
    daily_data = {}
    for item in forecast_data['list']:
        date = datetime.fromtimestamp(item['dt']).strftime('%Y-%m-%d')
        if date not in daily_data:
            daily_data[date] = {
                'dt': item['dt'],
                'temp': {'min': item['main']['temp'], 'max': item['main']['temp']},
                'humidity': item['main']['humidity'],
                'wind_speed': item['wind']['speed'],
                'weather': item['weather'],
                'rain': item.get('rain', {}).get('3h', 0),
                'snow': item.get('snow', {}).get('3h', 0)
            }
        else:
            daily_data[date]['temp']['min'] = min(daily_data[date]['temp']['min'], item['main']['temp'])
            daily_data[date]['temp']['max'] = max(daily_data[date]['temp']['max'], item['main']['temp'])
            daily_data[date]['rain'] += item.get('rain', {}).get('3h', 0)
            daily_data[date]['snow'] += item.get('snow', {}).get('3h', 0)
    
    # Format response data structure
    combined_data = {
        'current': {
            'dt': current_data['dt'],
            'sunrise': current_data['sys']['sunrise'],
            'sunset': current_data['sys']['sunset'],
            'temp': current_data['main']['temp'],
            'feels_like': current_data['main']['feels_like'],
            'humidity': current_data['main']['humidity'],
            'uvi': 0,  # Not available in free tier
            'visibility': current_data.get('visibility', 10000),
            'wind_speed': current_data['wind']['speed'],
            'weather': current_data['weather'],
            'rain': current_data.get('rain', {}),
            'snow': current_data.get('snow', {})
        },
        'daily': list(daily_data.values())[:5]  # 5 days only
    }
    
    # Cache the REAL data
    cache_weather_data(lat, lon, combined_data)
    return combined_data

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Consumer weather function - REAL API ONLY')
    
    if req.method == 'OPTIONS':
        response = func.HttpResponse("", status_code=200)
        return add_cors_headers(response)
    
    try:
        if req.method == 'POST':
            req_body = req.get_json()
            if not req_body:
                return func.HttpResponse(
                    json.dumps({"error": "Request body required"}),
                    status_code=400,
                    headers={"Content-Type": "application/json"}
                )
            
            latitude = req_body.get('latitude')
            longitude = req_body.get('longitude')
        else:
            latitude = req.params.get('lat')
            longitude = req.params.get('lon')
        
        if not latitude or not longitude:
            return func.HttpResponse(
                json.dumps({"error": "Latitude and longitude are required"}),
                status_code=400,
                headers={"Content-Type": "application/json"}
            )
        
        lat = float(latitude)
        lon = float(longitude)
        
        # Validate coordinates
        if not (-90 <= lat <= 90) or not (-180 <= lon <= 180):
            return func.HttpResponse(
                json.dumps({"error": "Invalid coordinates"}),
                status_code=400,
                headers={"Content-Type": "application/json"}
            )
        
        # Get REAL weather data - NO FALLBACKS
        weather_data = get_weather_data(lat, lon)
        
        # Return real API response
        response_data = {
            "current": weather_data['current'],
            "daily": weather_data.get('daily', []),
            "location": {
                "latitude": lat,
                "longitude": lon
            },
            "timestamp": datetime.utcnow().isoformat(),
            "source": "OpenWeatherMap-RealAPI"
        }
        
        response = func.HttpResponse(
            json.dumps(response_data),
            status_code=200,
            headers={"Content-Type": "application/json"}
        )
        return add_cors_headers(response)
        
    except ValueError as e:
        logging.error(f'Invalid input: {str(e)}')
        return func.HttpResponse(
            json.dumps({"error": "Invalid latitude or longitude format"}),
            status_code=400,
            headers={"Content-Type": "application/json"}
        )
    except requests.RequestException as e:
        logging.error(f'OpenWeatherMap API error: {str(e)}')
        # NO FALLBACK - Real API failed
        return func.HttpResponse(
            json.dumps({"error": "Weather service unavailable - real API failed"}),
            status_code=503,
            headers={"Content-Type": "application/json"}
        )
    except Exception as e:
        logging.error(f'Weather function error: {str(e)}')
        return func.HttpResponse(
            json.dumps({"error": "Weather API error - no fallback available"}),
            status_code=500,
            headers={"Content-Type": "application/json"}
        )