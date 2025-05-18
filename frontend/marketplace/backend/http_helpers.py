import json
import azure.functions as func

def add_cors_headers(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS, PUT, PATCH, DELETE'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type,Authorization,X-User-Email'
    return response

def handle_options_request():
    response = func.HttpResponse(status_code=200)
    return add_cors_headers(response)

def create_error_response(error_message, status_code=400):
    response = func.HttpResponse(
        body=json.dumps({"error": str(error_message)}),
        mimetype="application/json",
        status_code=status_code
    )
    return add_cors_headers(response)

def create_success_response(data, status_code=200):
    response = func.HttpResponse(
        body=json.dumps(data, default=str),
        mimetype="application/json",
        status_code=status_code
    )
    return add_cors_headers(response)

def extract_user_id(req):
    # Multiple ways to extract user ID
    user_id = (
        req.params.get('userId') or 
        req.params.get('email') or 
        req.headers.get('X-User-Email')
    )
    
    # Try to get from JSON body if not found in params/headers
    if not user_id:
        try:
            body = req.get_json()
            user_id = body.get('userId') or body.get('email')
        except:
            pass
    
    return user_id