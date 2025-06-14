# maps-config/__init__.py
import logging
import json
import os
import azure.functions as func
from http_helpers import add_cors_headers, handle_options_request, create_error_response, create_success_response

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Processing maps-config request')
    
    # Handle OPTIONS method for CORS preflight
    if req.method == 'OPTIONS':
        return handle_options_request()
    
    try:
        # Get Azure Maps key from environment variables
        azure_maps_key = os.environ.get('AZURE_MAPS_MARKETPLACE_KEY')
        
        if not azure_maps_key:
            logging.error("AZURE_MAPS_MARKETPLACE_KEY environment variable not found")
            return create_error_response("Azure Maps key configuration is missing", 500)
        
        # Return the key in the response
        return create_success_response({
            "azureMapsKey": azure_maps_key
        })
    
    except Exception as e:
        logging.error(f"Error retrieving Azure Maps key: {str(e)}")
        return create_error_response(f"Error retrieving Azure Maps key: {str(e)}", 500)