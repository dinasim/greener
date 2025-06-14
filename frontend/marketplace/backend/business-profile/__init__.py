# backend/business-profile/__init__.py - UPDATED FOR GREENERDB
import logging
import json
import azure.functions as func
from azure.cosmos import CosmosClient, exceptions
import os
from datetime import datetime

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

# Set up the Cosmos DB client using existing environment variables
endpoint = os.environ.get('COSMOS_URI')
key = os.environ.get('COSMOS_KEY')

if not endpoint or not key:
    logging.error("Missing COSMOS_URI or COSMOS_KEY environment variables")
    client = None
else:
    client = CosmosClient(endpoint, credential=key)

# Reference Cosmos DB database and containers
database_name = 'GreenerMarketplace'  # FIXED: Use correct marketplace database name

try:
    if client:
        database = client.get_database_client(database_name)
        business_container = database.get_container_client('business_users')  # FIXED: Use correct container name
        user_container = database.get_container_client('Users')
    else:
        business_container = None
        user_container = None
except Exception as e:
    logging.error(f"Failed to initialize Cosmos DB containers: {e}")
    business_container = None
    user_container = None

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Business profile function processed a request.')
    
    # Handle OPTIONS method for CORS preflight
    if req.method == 'OPTIONS':
        response = func.HttpResponse("", status_code=200)
        return add_cors_headers(response)
    
    if not business_container:
        return create_error_response("Database not available", 500)
    
    try:
        # Get email from route params (URL encoded) or from request body
        email = req.route_params.get('email')
        if email:
            # URL decode the email
            import urllib.parse
            email = urllib.parse.unquote(email)
            logging.info(f"Processing business profile request for email: {email}")
        else:
            # Try to get from request body for POST/PATCH requests
            try:
                request_body = req.get_json()
                email = request_body.get('email') if request_body else None
            except:
                pass
        
        if not email:
            return create_error_response("Email is required", 400)
        
        current_time = datetime.utcnow().isoformat()
        
        if req.method == 'GET':
            # Get business profile
            try:
                # Query for business profile
                query = "SELECT * FROM business_users b WHERE b.email = @email"  # FIXED: Use correct container name
                parameters = [{"name": "@email", "value": email}]
                
                business_profiles = list(business_container.query_items(
                    query=query,
                    parameters=parameters,
                    enable_cross_partition_query=True
                ))
                
                if business_profiles:
                    business_profile = business_profiles[0]
                    logging.info(f"Retrieved business profile for {email}")
                    
                    response_data = {
                        "success": True,
                        "business": business_profile,
                        "exists": True
                    }
                    
                    return create_success_response(response_data)
                else:
                    return create_success_response({
                        "success": True,
                        "business": None,
                        "exists": False
                    })
                
            except Exception as read_error:
                logging.error(f"Error reading business profile: {str(read_error)}")
                return create_error_response(f"Error reading profile: {str(read_error)}", 500)
        
        elif req.method in ['POST', 'PUT', 'PATCH']:
            # Create or update business profile
            try:
                request_body = req.get_json()
            except ValueError:
                return create_error_response("Invalid JSON body", 400)
            
            if not request_body:
                return create_error_response("Request body is required", 400)
            
            try:
                # Check if business profile exists
                query = "SELECT * FROM business_users b WHERE b.email = @email"  # FIXED: Use correct container name
                parameters = [{"name": "@email", "value": email}]
                
                existing_profiles = list(business_container.query_items(
                    query=query,
                    parameters=parameters,
                    enable_cross_partition_query=True
                ))
                
                if existing_profiles and req.method in ['PATCH', 'PUT']:
                    # Update existing profile
                    existing_profile = existing_profiles[0]
                    
                    # Update fields from request body
                    for key, value in request_body.items():
                        if key not in ['id', 'email']:  # Protect immutable fields
                            existing_profile[key] = value
                    
                    existing_profile['updatedAt'] = current_time
                    
                    updated_profile = business_container.replace_item(
                        item=existing_profile['id'],
                        body=existing_profile
                    )
                    
                    logging.info(f"Updated business profile for {email}")
                    
                    return create_success_response({
                        "success": True,
                        "business": updated_profile,
                        "created": False
                    })
                
                else:
                    # Create new business profile
                    business_profile = {
                        "id": email,  # Use email as document ID
                        "email": email,
                        "businessName": request_body.get('businessName', f"{email.split('@')[0].title()} Business"),
                        "name": request_body.get('name', request_body.get('contactName', 'Business Owner')),
                        "businessType": request_body.get('businessType', 'Plant Business'),
                        "description": request_body.get('description', ''),
                        "logo": request_body.get('logo'),
                        "contactPhone": request_body.get('contactPhone', request_body.get('phone')),
                        "contactEmail": request_body.get('contactEmail', email),
                        "address": request_body.get('address', {}),
                        "businessHours": request_body.get('businessHours', []),
                        "socialMedia": request_body.get('socialMedia', {}),
                        "status": "active",
                        "paymentMethods": request_body.get('paymentMethods', ["cash", "pickup"]),
                        "businessId": email,
                        "rating": request_body.get('rating', 0),
                        "reviewCount": request_body.get('reviewCount', 0),
                        "isVerified": request_body.get('isVerified', False),
                        "settings": {
                            "notifications": True,
                            "messages": True,
                            "lowStockThreshold": request_body.get('lowStockThreshold', 5)
                        },
                        "createdAt": current_time,
                        "updatedAt": current_time
                    }
                    
                    created_profile = business_container.create_item(business_profile)
                    logging.info(f"Created business profile for {email}")
                    
                    return create_success_response({
                        "success": True,
                        "business": created_profile,
                        "created": True
                    }, 201)
                
            except exceptions.CosmosHttpResponseError as e:
                logging.error(f"Cosmos DB error: {e}")
                return create_error_response(f"Database error: {str(e)}", 500)
            except Exception as e:
                logging.error(f"Error creating/updating business profile: {str(e)}")
                return create_error_response(f"Error processing request: {str(e)}", 500)
        
        elif req.method == 'DELETE':
            # Delete business profile
            try:
                query = "SELECT * FROM business_users b WHERE b.email = @email"  # FIXED: Use correct container name
                parameters = [{"name": "@email", "value": email}]
                
                existing_profiles = list(business_container.query_items(
                    query=query,
                    parameters=parameters,
                    enable_cross_partition_query=True
                ))
                
                if existing_profiles:
                    profile_to_delete = existing_profiles[0]
                    business_container.delete_item(item=profile_to_delete['id'], partition_key=profile_to_delete['id'])
                    logging.info(f"Deleted business profile for {email}")
                    
                    return create_success_response({
                        "success": True,
                        "message": "Business profile deleted successfully"
                    })
                else:
                    return create_error_response("Business profile not found", 404)
                
            except Exception as delete_error:
                logging.error(f"Failed to delete profile: {str(delete_error)}")
                return create_error_response("Failed to delete profile", 500)
        
        else:
            return create_error_response("Method not allowed", 405)
    
    except Exception as e:
        logging.error(f"Unexpected error in business profile: {str(e)}")
        return create_error_response(f"Internal server error: {str(e)}", 500)