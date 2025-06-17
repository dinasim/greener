# backend/reverse-geocode/__init__.py
import logging
import json
import azure.functions as func
import os
import requests
import time
import hashlib
from http_helpers import add_cors_headers, handle_options_request, create_error_response, create_success_response, extract_user_id

# Aggressive caching to minimize Azure Maps API calls
_reverse_cache = {}
_cache_expiry = 7 * 24 * 60 * 60  # 7 days for cost optimization
_request_count = 0
_last_minute_start = time.time()

def normalize_coords_for_cache(lat, lon):
    """Normalize coordinates for better cache hit rates"""
    # Round to 4 decimal places (~11m accuracy) for cache efficiency
    rounded_lat = round(float(lat), 4)
    rounded_lon = round(float(lon), 4)
    return f"{rounded_lat},{rounded_lon}"

def get_cached_reverse_geocode(lat, lon):
    """Check if coordinates are cached and not expired"""
    cache_key = normalize_coords_for_cache(lat, lon)
    if cache_key in _reverse_cache:
        cached_data, timestamp = _reverse_cache[cache_key]
        if time.time() - timestamp < _cache_expiry:
            logging.info(f"✅ REVERSE CACHE HIT - Saved Azure Maps API call for: {lat}, {lon}")
            return cached_data
    return None

def cache_reverse_geocode(lat, lon, data):
    """Cache reverse geocode result with extended expiry"""
    cache_key = normalize_coords_for_cache(lat, lon)
    _reverse_cache[cache_key] = (data, time.time())

def rate_limit_check():
    """Rate limiting to minimize costs - max 50 requests per minute"""
    global _request_count, _last_minute_start
    
    current_time = time.time()
    if current_time - _last_minute_start >= 60:
        _request_count = 0
        _last_minute_start = current_time
    
    if _request_count >= 50:
        logging.warning("⚠️ Rate limit reached - blocking request to save costs")
        return False
    
    _request_count += 1
    return True

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Reverse geocoding function - Cost-optimized for greener-marketplace-maps')
    
    # Handle OPTIONS method for CORS preflight
    if req.method == 'OPTIONS':
        return handle_options_request()
    
    try:
        # Get coordinates from query parameters or request body
        lat = req.params.get('lat')
        lon = req.params.get('lon')
        
        if not lat or not lon:
            if req.method == 'POST':
                try:
                    request_body = req.get_json()
                    lat = request_body.get('lat') or request_body.get('latitude')
                    lon = request_body.get('lon') or request_body.get('longitude')
                except ValueError:
                    pass
        
        if not lat or not lon:
            return create_error_response("Latitude and longitude are required", 400)
        
        try:
            lat = float(lat)
            lon = float(lon)
        except ValueError:
            return create_error_response("Invalid coordinate format", 400)
        
        # PRIORITY 1: Check cache first to avoid API calls
        cached_result = get_cached_reverse_geocode(lat, lon)
        if cached_result:
            return create_success_response(cached_result)
        
        # PRIORITY 2: Rate limiting to control costs
        if not rate_limit_check():
            return create_error_response("Rate limit exceeded - please try again later", 429)
        
        logging.info(f"🗺️ Making Azure Maps reverse geocode API call for: {lat}, {lon}")
        
        # ONLY use greener-marketplace-maps key
        azure_maps_key = os.environ.get("AZURE_MAPS_MARKETPLACE_KEY")
        
        if not azure_maps_key:
            return create_error_response("Azure Maps configuration is missing", 500)
        
        # Call Azure Maps Search API for reverse geocoding with cost optimization
        url = "https://atlas.microsoft.com/search/address/reverse/json"
        params = {
            "api-version": "1.0",
            "subscription-key": azure_maps_key,
            "query": f"{lat},{lon}",
            "language": "en-US"
        }
        
        response = requests.get(url, params=params, timeout=10)
        
        if not response.ok:
            return create_error_response(f"Azure Maps API error: {response.status_code}", 500)
        
        data = response.json()
        
        # Check if we got any results
        if 'addresses' not in data or len(data['addresses']) == 0:
            return create_error_response("No addresses found for the coordinates", 404)
        
        # Extract the first result
        result = data['addresses'][0]['address']
        
        # Format the response
        formatted_result = {
            "latitude": lat,
            "longitude": lon,
            "formattedAddress": result.get('freeformAddress', f"{lat}, {lon}"),
            "city": result.get('municipality', ''),
            "country": result.get('country', 'Israel'),
            "postalCode": result.get('postalCode', ''),
            "street": result.get('streetName', ''),
            "houseNumber": result.get('streetNumber', ''),
            "source": "greener-marketplace-maps"
        }
        
        # Add Hebrew fields if available (Israel-specific)
        if result.get('municipalitySubdivision'):
            formatted_result['neighborhood'] = result['municipalitySubdivision']
        
        # PRIORITY 3: Cache the result for future use (7 days)
        cache_reverse_geocode(lat, lon, formatted_result)
        
        logging.info(f"✅ Successfully reverse geocoded {lat}, {lon} - cached for 7 days")
        
        return create_success_response(formatted_result)
        
    except Exception as e:
        logging.error(f"Unexpected error in reverse geocoding: {str(e)}")
        return create_error_response(f"Internal server error: {str(e)}", 500)