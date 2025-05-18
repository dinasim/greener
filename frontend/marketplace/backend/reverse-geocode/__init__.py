# backend/reverse-geocode/__init__.py
import logging
import json
import azure.functions as func
import os
import requests
from http_helpers import add_cors_headers, handle_options_request, create_error_response, create_success_response, extract_user_id

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Python HTTP trigger function for reverse geocoding processed a request.')
    
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
        
        # Access the Azure Maps API
        azure_maps_key = os.environ.get("AZURE_MAPS_MARKETPLACE_KEY")
        
        if not azure_maps_key:
            return create_error_response("Azure Maps configuration is missing", 500)
        
        # Call Azure Maps Search API for reverse geocoding
        url = "https://atlas.microsoft.com/search/address/reverse/json"
        params = {
            "api-version": "1.0",
            "subscription-key": azure_maps_key,
            "query": f"{lat},{lon}"
        }
        
        response = requests.get(url, params=params)
        
        if not response.ok:
            return create_error_response(f"Azure Maps API error: {response.status_code}", 500)
        
        data = response.json()
        
        # Check if we got any results
        if 'addresses' not in data or len(data['addresses']) == 0:
            return create_error_response("No addresses found for the coordinates", 404)
        
        # Extract the first result
        address = data['addresses'][0]
        
        # Format the response
        formatted_result = {
            "latitude": lat,
            "longitude": lon,
            "formattedAddress": address.get('address', {}).get('freeformAddress', f"{lat}, {lon}"),
            "city": address.get('address', {}).get('municipality', ''),
            "country": address.get('address', {}).get('country', ''),
            "postalCode": address.get('address', {}).get('postalCode', ''),
            "street": address.get('address', {}).get('streetName', ''),
            "houseNumber": address.get('address', {}).get('streetNumber', '')
        }
        
        # Log what we found
        logging.info(f"Reverse geocoded '{lat}, {lon}' to {formatted_result['formattedAddress']}")
        
        return create_success_response(formatted_result)
    
    except Exception as e:
        logging.error(f"Error reverse geocoding: {str(e)}")
        return create_error_response(str(e), 500)