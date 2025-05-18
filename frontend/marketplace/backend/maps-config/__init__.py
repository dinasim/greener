# maps-config/__init__.py - With detailed error logging
import logging
import json
import os
import sys
import traceback
import azure.functions as func

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Processing maps-config request with detailed error logging')
    
    # Add CORS headers
    headers = {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type,Authorization,X-User-Email"
    }
    
    # Handle OPTIONS request for CORS
    if req.method == 'OPTIONS':
        return func.HttpResponse(
            status_code=200,
            headers=headers
        )
    
    try:
        # Check if environment variables are accessible
        env_vars = list(os.environ.keys())
        logging.info(f"Found {len(env_vars)} environment variables")
        
        # Look for the Azure Maps key
        azure_maps_key = os.environ.get('AZURE_MAPS_MARKETPLACE_KEY')
        logging.info(f"Azure Maps key present: {'Yes' if azure_maps_key else 'No'}")
        
        # Also try any environment variable with "AZURE" or "MAP" in the name
        potential_keys = []
        for key in env_vars:
            if 'AZURE' in key.upper() or 'MAP' in key.upper():
                potential_keys.append(key)
        
        if not azure_maps_key:
            # Try using a temporary hardcoded key
            # IMPORTANT: Replace with your actual Azure Maps key for testing
            azure_maps_key = "YOUR_AZURE_MAPS_KEY"
            logging.info("Using hardcoded key as fallback")
        
        # Return detailed response
        return func.HttpResponse(
            json.dumps({
                "azureMapsKey": azure_maps_key,
                "debug": {
                    "env_var_count": len(env_vars),
                    "potential_azure_vars": potential_keys,
                    "python_version": sys.version,
                    "has_key": azure_maps_key is not None
                }
            }),
            status_code=200,
            headers=headers
        )
    except Exception as e:
        # Capture full error details
        error_type = type(e).__name__
        error_message = str(e)
        error_traceback = traceback.format_exc()
        
        logging.error(f"Error in maps-config: {error_type}: {error_message}")
        logging.error(f"Traceback: {error_traceback}")
        
        return func.HttpResponse(
            json.dumps({
                "error": error_message,
                "error_type": error_type,
                "traceback": error_traceback.split("\n"),
                "info": "This is a detailed error response for debugging"
            }),
            status_code=500,
            headers=headers
        )