# http_helpers.py
import json
import azure.functions as func

def add_cors_headers(response):
    """Add CORS headers to HTTP responses."""
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS, PUT, PATCH, DELETE'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type,Authorization,X-User-Email'
    return response

def handle_options_request():
    """Handle OPTIONS preflight requests"""
    response = func.HttpResponse(status_code=200)
    return add_cors_headers(response)

def create_error_response(error_message, status_code=400):
    """Create standardized error response"""
    response = func.HttpResponse(
        body=json.dumps({"error": error_message}),
        mimetype="application/json",
        status_code=status_code
    )
    return add_cors_headers(response)

def create_success_response(data, status_code=200):
    """Create standardized success response"""
    response = func.HttpResponse(
        body=json.dumps(data, default=str),
        mimetype="application/json",
        status_code=status_code
    )
    return add_cors_headers(response)

def extract_user_id(req):
    """Extract user ID from request (query params, body, or headers)"""
    # Try to get from query parameters
    user_id = req.params.get('userId') or req.params.get('email')
    
    # If not in params, try from JSON body
    if not user_id and req.get_body():
        try:
            req_body = req.get_json()
            user_id = req_body.get('userId') or req_body.get('email') or req_body.get('sender')
        except ValueError:
            pass
    
    # If still not found, try from headers
    if not user_id:
        user_id = req.headers.get('X-User-Email')
    
    return user_id