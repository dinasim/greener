import logging
import json
import os
import azure.functions as func

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Processing maps-config request')
    
    try:
        # Get Azure Maps key from environment variables
        azure_maps_key = os.environ.get('AZURE_MAPS_MARKETPLACE_KEY')
        
        # Log for debugging
        logging.info(f"Environment variables: {list(os.environ.keys())}")
        logging.info(f"Has API key: {azure_maps_key is not None}")
        
        if not azure_maps_key:
            logging.error("Azure Maps key not configured in application settings")
            return func.HttpResponse(
                json.dumps({"error": "Map configuration not available"}),
                status_code=500,
                mimetype="application/json"
            )
        
        # More relaxed authentication - make it optional for testing
        user_email = req.headers.get('x-user-email', 'anonymous@user.com')
        
        # Return the API key
        response_body = {
            "azureMapsKey": azure_maps_key
        }
        
        # Add CORS headers
        headers = {
            "Content-Type": "application/json",
            "Cache-Control": "private, max-age=3600",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, X-User-Email, Authorization"
        }
        
        logging.info(f"Maps config successfully sent to user: {user_email}")
        
        return func.HttpResponse(
            json.dumps(response_body),
            status_code=200,
            headers=headers,
            mimetype="application/json"
        )
        
    except Exception as e:
        logging.error(f"Error in maps-config: {str(e)}")
        # Return a more detailed error message for debugging
        return func.HttpResponse(
            json.dumps({
                "error": "An internal server error occurred",
                "details": str(e),
                "env_keys": list(os.environ.keys())[:5]  # Just show first 5 keys for security
            }),
            status_code=500,
            mimetype="application/json"
        )