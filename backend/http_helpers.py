# http_helpers.py
import azure.functions as func
import json
from datetime import datetime

def add_cors_headers(response):
    """Add comprehensive CORS headers to response"""
    response.headers.update({
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, PUT, PATCH, DELETE',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Email, X-Business-ID, X-User-Type'
    })
    return response

def handle_options_request():
    """Handle CORS preflight requests"""
    response = func.HttpResponse(status_code=200)
    return add_cors_headers(response)

def create_success_response(data, status_code=200):
    """Create a standardized success response with CORS headers"""
    response = func.HttpResponse(
        body=json.dumps(data, default=str),
        status_code=status_code,
        mimetype="application/json"
    )
    return add_cors_headers(response)

def create_error_response(message, status_code=400):
    """Create a standardized error response with CORS headers"""
    response = func.HttpResponse(
        body=json.dumps({"error": message}),
        status_code=status_code,
        mimetype="application/json"
    )
    return add_cors_headers(response)

# Standardized header validation and user ID extraction
def get_user_id_from_request(req):
    """
    FIXED: Standardized function to extract user ID from request headers
    Priority order: X-User-Email > X-Business-ID > query params
    """
    # Try headers first (most reliable)
    user_id = req.headers.get('X-User-Email')
    
    if not user_id:
        user_id = req.headers.get('X-Business-ID')
    
    if not user_id:
        # Try query parameters as fallback
        user_id = req.params.get('businessId') or req.params.get('userId')
    
    if not user_id:
        # Try route parameters last
        user_id = req.route_params.get('businessId') or req.route_params.get('userId')
    
    return user_id

def validate_business_authentication(req):
    """
    FIXED: Standardized business authentication validation
    Returns (business_id, error_response) - error_response is None if valid
    """
    business_id = get_user_id_from_request(req)
    
    if not business_id:
        return None, create_error_response(
            "Business authentication required. Please provide X-User-Email or X-Business-ID header", 
            401
        )
    
    return business_id, None

def create_standardized_response(data, success=True, status_code=200, message=None):
    """
    FIXED: Standardized response format for all business endpoints
    """
    response_data = {
        "success": success,
        "data": data,
        "timestamp": datetime.utcnow().isoformat()
    }
    
    if message:
        response_data["message"] = message
    
    if not success and isinstance(data, str):
        response_data["error"] = data
        response_data["data"] = None
    
    response = func.HttpResponse(
        body=json.dumps(response_data, default=str),
        status_code=status_code,
        mimetype="application/json"
    )
    return add_cors_headers(response)

def extract_user_id(req):
    """Legacy function - redirect to new standardized function"""
    return get_user_id_from_request(req)

def get_user_type_from_request(req):
    """Get user type from request headers"""
    user_type = req.headers.get('X-User-Type')
    return user_type.strip().lower() if user_type else 'user'

def validate_required_fields(data, required_fields):
    """Validate that required fields are present in data"""
    missing_fields = []
    for field in required_fields:
        if field not in data or data[field] is None or data[field] == '':
            missing_fields.append(field)
    
    if missing_fields:
        raise ValueError(f"Missing required fields: {', '.join(missing_fields)}")
    
    return True

def sanitize_input(value, field_type='string', max_length=None):
    """Sanitize input values"""
    if value is None:
        return None
    
    if field_type == 'string':
        value = str(value).strip()
        if max_length and len(value) > max_length:
            value = value[:max_length]
        return value
    elif field_type == 'email':
        value = str(value).strip().lower()
        if max_length and len(value) > max_length:
            value = value[:max_length]
        return value
    elif field_type == 'number':
        try:
            return float(value)
        except (ValueError, TypeError):
            return 0
    elif field_type == 'int':
        try:
            return int(value)
        except (ValueError, TypeError):
            return 0
    elif field_type == 'bool':
        if isinstance(value, bool):
            return value
        if isinstance(value, str):
            return value.lower() in ('true', '1', 'yes', 'on')
        return bool(value)
    
    return value