# geo code: 
# Backend: /backend/geocode/__init__.py - Updated version

import logging
import json
import azure.functions as func
import os
import requests

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

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Geocoding function processed a request.')
    
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
        
        logging.info(f"Geocoding address: {address}")
        
        # Access the Azure Maps API - try multiple possible environment variable names
        azure_maps_key = (
            os.environ.get("AZURE_MAPS_MARKETPLACE_KEY") or 
            os.environ.get("AZURE_MAPS_KEY") or 
            os.environ.get("AZURE_MAPS_SUBSCRIPTION_KEY")
        )
        
        if not azure_maps_key:
            logging.error("Azure Maps API key not found in environment variables")
            return create_error_response("Azure Maps configuration is missing", 500)
        
        # Call Azure Maps Search API for geocoding
        url = "https://atlas.microsoft.com/search/address/json"
        params = {
            "api-version": "1.0",
            "subscription-key": azure_maps_key,
            "query": address,
            "limit": 1
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
                "houseNumber": result.get('address', {}).get('streetNumber', '')
            }
            
            # Log success
            logging.info(f"Successfully geocoded '{address}' to {formatted_result['latitude']}, {formatted_result['longitude']}")
            
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