# signalr-negotiate/__init__.py
import logging
import json
import azure.functions as func
from http_helpers import add_cors_headers, handle_options_request, create_error_response, create_success_response, extract_user_id

def main(req: func.HttpRequest, connectionInfo) -> func.HttpResponse:
    logging.info('SignalR negotiate function processed a request.')
    
    # Handle OPTIONS method for CORS preflight
    if req.method == 'OPTIONS':
        return handle_options_request()
    
    try:
        # Get user ID from request
        user_id = extract_user_id(req)
        
        if not user_id:
            return create_error_response("User ID is required", 400)
        
        # Return the connection info from the SignalR binding
        connection_info_obj = json.loads(connectionInfo)
        
        # Add user ID to connection info if needed
        return create_success_response(connection_info_obj)
    
    except Exception as e:
        logging.error(f"Error in SignalR negotiate: {str(e)}")
        return create_error_response(str(e), 500)