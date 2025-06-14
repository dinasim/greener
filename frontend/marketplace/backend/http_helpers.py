# http_helpers.py
import azure.functions as func
import json

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

def get_user_id_from_request(req):
    """
    FIXED: Extract user ID from request using multiple fallback methods
    This function standardizes user ID extraction across all endpoints
    """
    # Method 1: Try X-User-Email header (primary method)
    user_id = req.headers.get('X-User-Email')
    if user_id:
        return user_id.strip()
    
    # Method 2: Try X-Business-ID header (for business accounts)
    user_id = req.headers.get('X-Business-ID')
    if user_id:
        return user_id.strip()
    
    # Method 3: Try route parameters (for URL-based IDs)
    user_id = req.route_params.get('businessId')
    if user_id:
        return user_id.strip()
    
    user_id = req.route_params.get('userId')
    if user_id:
        return user_id.strip()
    
    # Method 4: Try query parameters as fallback
    user_id = req.params.get('businessId')
    if user_id:
        return user_id.strip()
    
    user_id = req.params.get('userId')
    if user_id:
        return user_id.strip()
    
    # Method 5: Try request body (for POST requests)
    try:
        body = req.get_json()
        if body:
            user_id = body.get('businessId') or body.get('userId') or body.get('email')
            if user_id:
                return user_id.strip()
    except (ValueError, AttributeError):
        pass
    
    # If all methods fail, return None
    return None

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