# http_helpers.py
import azure.functions as func
import json

def add_cors_headers(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS, PUT, PATCH, DELETE'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type,Authorization,X-User-Email'
    return response

def handle_options_request():
    response = func.HttpResponse(status_code=200)
    return add_cors_headers(response)

def create_success_response(data, status_code=200):
    response = func.HttpResponse(
        body=json.dumps(data),
        status_code=status_code,
        mimetype="application/json"
    )
    return add_cors_headers(response)

def create_error_response(message, status_code=400):
    response = func.HttpResponse(
        body=json.dumps({"error": message}),
        status_code=status_code,
        mimetype="application/json"
    )
    return add_cors_headers(response)

def extract_user_id(req):
    # Check Authorization header first (for token-based auth)
    # auth_header = req.headers.get('Authorization')
    # if auth_header and auth_header.startswith('Bearer '):
    #     # Parse token and extract user ID
    #     # This is a simplified example - in a real app, you'd verify the token
    #     pass
    
    # Check custom headers (for simple API key or email-based auth)
    user_email = req.headers.get('X-User-Email')
    if user_email:
        return user_email
    
    # Check query parameters as fallback
    user_id = req.params.get('userId')
    if user_id:
        return user_id
    
    # If all methods fail, return None
    return None