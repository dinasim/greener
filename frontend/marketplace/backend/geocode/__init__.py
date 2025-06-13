# geo code: 
# Backend: /backend/geocode/__init__.py - Updated version

import logging
import json
import azure.functions as func
import os
import requests
from http_helpers import add_cors_headers, handle_options_request, create_error_response, create_success_response, extract_user_id

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Python HTTP trigger function for geocoding processed a request.')
    
    # Handle OPTIONS method for CORS preflight
    if req.method == 'OPTIONS':
        return handle_options_request()
    
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
        
        # Access the Azure Maps API
        azure_maps_key = os.environ.get("AZURE_MAPS_MARKETPLACE_KEY")
        
        if not azure_maps_key:
            return create_error_response("Azure Maps configuration is missing", 500)
        
        # Call Azure Maps Search API for geocoding
        url = "https://atlas.microsoft.com/search/address/json"
        params = {
            "api-version": "1.0",
            "subscription-key": azure_maps_key,
            "query": address,
            "limit": 1
        }
        
        response = requests.get(url, params=params)
        
        if not response.ok:
            return create_error_response(f"Azure Maps API error: {response.status_code}", 500)
        
        data = response.json()
        
        # Check if we got any results
        if 'results' not in data or len(data['results']) == 0:
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
            "houseNumber": result.get('address', {}).get('streetNumber', '')
        }
        
        # Log what we found
        logging.info(f"Geocoded '{address}' to {formatted_result['latitude']}, {formatted_result['longitude']}")
        
        return create_success_response(formatted_result)
    
    except Exception as e:
        logging.error(f"Error geocoding address: {str(e)}")
        return create_error_response(str(e), 500)