# geo code: 
# Backend: /backend/geocode/__init__.py - COST-OPTIMIZED for greener-marketplace-maps

import logging
import json
import azure.functions as func
import os
import requests
import time
import hashlib

# Aggressive caching to minimize Azure Maps API calls
_geocode_cache = {}
_cache_expiry = 7 * 24 * 60 * 60  # 7 days for cost optimization
_request_count = 0
_last_minute_start = time.time()

def add_cors_headers(response):
    """Add CORS headers to response"""
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS, PUT, PATCH, DELETE'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type,Authorization,X-User-Email'
    return response

def create_success_response(data, status_code=200):
    """Create a successful response"""
    response = func.HttpResponse(
        body=json.dumps(data),
        status_code=status_code,
        mimetype="application/json"
    )
    return add_cors_headers(response)

def create_error_response(message, status_code=400):
    """Create an error response"""
    response = func.HttpResponse(
        body=json.dumps({"error": message, "success": False}),
        status_code=status_code,
        mimetype="application/json"
    )
    return add_cors_headers(response)

def normalize_address_for_cache(address):
    """Normalize address for better cache hit rates"""
    normalized = address.lower().strip()
    # Remove common variations
    normalized = normalized.replace(' israel', '').replace(', israel', '')
    normalized = normalized.replace('  ', ' ')
    return hashlib.md5(normalized.encode()).hexdigest()

def get_cached_geocode(address):
    """Check if address is cached and not expired - EXTENDED CACHE"""
    cache_key = normalize_address_for_cache(address)
    if cache_key in _geocode_cache:
        cached_data, timestamp = _geocode_cache[cache_key]
        if time.time() - timestamp < _cache_expiry:
            logging.info(f"✅ CACHE HIT - Saved Azure Maps API call for: {address}")
            return cached_data
    return None

def cache_geocode(address, data):
    """Cache geocode result with extended expiry"""
    cache_key = normalize_address_for_cache(address)
    _geocode_cache[cache_key] = (data, time.time())

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
    logging.info('Geocoding function - Cost-optimized for greener-marketplace-maps')
    
    # Handle OPTIONS method for CORS preflight
    if req.method == 'OPTIONS':
        response = func.HttpResponse("", status_code=200)
        return add_cors_headers(response)
    
    try:
        # Get address from query parameters or request body
        address = req.params.get('address')
        
        if not address and req.method == 'POST':
            try:
                request_body = req.get_json()
                address = request_body.get('address')
            except ValueError:
                pass
        
        if not address:
            return create_error_response("Address is required", 400)
        
        # PRIORITY 1: Check cache first to avoid API calls
        cached_result = get_cached_geocode(address)
        if cached_result:
            return create_success_response(cached_result)
        
        # PRIORITY 2: Rate limiting to control costs
        if not rate_limit_check():
            return create_error_response("Rate limit exceeded - please try again later", 429)
        
        logging.info(f"🗺️ Making Azure Maps API call for: {address}")
        
        # ONLY use greener-marketplace-maps key
        azure_maps_key = os.environ.get("AZURE_MAPS_MARKETPLACE_KEY")
        
        if not azure_maps_key:
            logging.error("AZURE_MAPS_MARKETPLACE_KEY environment variable not found")
            return create_error_response("Azure Maps configuration is missing", 500)
        
        # Call Azure Maps Search API for geocoding with cost optimization
        url = "https://atlas.microsoft.com/search/address/json"
        params = {
            "api-version": "1.0",
            "subscription-key": azure_maps_key,
            "query": address,
            "limit": 1,  # Minimize response size
            "countrySet": "IL"  # Restrict to Israel for better accuracy
        }
        
        try:
            response = requests.get(url, params=params, timeout=10)
            
            if not response.ok:
                logging.error(f"Azure Maps API error: {response.status_code}, {response.text}")
                return create_error_response(f"Geocoding service error: {response.status_code}", 500)
            
            data = response.json()
            
            # Check if we got any results
            if 'results' not in data or len(data['results']) == 0:
                logging.warning(f"No geocoding results found for address: {address}")
                return create_error_response("No results found for the address", 404)
            
            # Extract the first result
            result = data['results'][0]
            
            # Format the response
            formatted_result = {
                "latitude": result['position']['lat'],
                "longitude": result['position']['lon'],
                "formattedAddress": result.get('address', {}).get('freeformAddress', address),
                "city": result.get('address', {}).get('municipality', ''),
                "country": result.get('address', {}).get('country', ''),
                "postalCode": result.get('address', {}).get('postalCode', ''),
                "street": result.get('address', {}).get('streetName', ''),
                "houseNumber": result.get('address', {}).get('streetNumber', ''),
                "source": "greener-marketplace-maps"
            }
            
            # PRIORITY 3: Cache the result for future use (7 days)
            cache_geocode(address, formatted_result)
            
            logging.info(f"✅ Successfully geocoded '{address}' - cached for 7 days")
            
            return create_success_response(formatted_result)
            
        except requests.RequestException as e:
            logging.error(f"Request error calling Azure Maps API: {str(e)}")
            return create_error_response(f"Network error: {str(e)}", 500)
        except Exception as e:
            logging.error(f"Error processing Azure Maps response: {str(e)}")
            return create_error_response(f"Processing error: {str(e)}", 500)
    
    except Exception as e:
        logging.error(f"Unexpected error in geocoding: {str(e)}")
        return create_error_response(f"Internal server error: {str(e)}", 500)