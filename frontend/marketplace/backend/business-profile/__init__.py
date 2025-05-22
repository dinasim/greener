# backend/business-profile/__init__.py
import logging
import json
import azure.functions as func
from azure.cosmos import CosmosClient
from datetime import datetime
import os

# Database connection details for marketplace
MARKETPLACE_CONNECTION_STRING = os.environ.get("COSMOSDB__MARKETPLACE_CONNECTION_STRING")
MARKETPLACE_DATABASE_NAME = os.environ.get("COSMOSDB_MARKETPLACE_DATABASE_NAME", "GreenerMarketplace")

def add_cors_headers(response):
    """Add CORS headers to response"""
    response.headers.update({
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Email'
    })
    return response

def get_user_id_from_request(req):
    """Extract user ID from request headers or query params"""
    user_id = req.headers.get('X-User-Email')
    if not user_id:
        user_id = req.params.get('businessId')
    return user_id

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Business profile function processed a request.')
    
    # Handle OPTIONS method for CORS preflight
    if req.method == 'OPTIONS':
        response = func.HttpResponse("", status_code=200)
        return add_cors_headers(response)
    
    try:
        # Get business ID from headers or params
        business_id = get_user_id_from_request(req)
        
        if not business_id:
            response = func.HttpResponse(
                json.dumps({"error": "Business ID is required"}),
                status_code=400,
                mimetype="application/json"
            )
            return add_cors_headers(response)
        
        logging.info(f"Processing business profile request for: {business_id}")
        
        # Connect to marketplace database
        try:
            # Parse connection string
            params = dict(param.split('=', 1) for param in MARKETPLACE_CONNECTION_STRING.split(';'))
            account_endpoint = params.get('AccountEndpoint')
            account_key = params.get('AccountKey')
            
            if not account_endpoint or not account_key:
                raise ValueError("Invalid marketplace connection string")
            
            # Create client and get container
            client = CosmosClient(account_endpoint, credential=account_key)
            database = client.get_database_client(MARKETPLACE_DATABASE_NAME)
            business_users_container = database.get_container_client("business_users")
            
            if req.method == 'GET':
                # Get business profile
                try:
                    business_profile = business_users_container.read_item(item=business_id, partition_key=business_id)
                    logging.info(f"Retrieved business profile for {business_id}")
                    
                    response = func.HttpResponse(
                        json.dumps(business_profile, default=str),
                        status_code=200,
                        mimetype="application/json"
                    )
                    return add_cors_headers(response)
                    
                except Exception as read_error:
                    logging.error(f"Business profile not found: {str(read_error)}")
                    response = func.HttpResponse(
                        json.dumps({"error": "Business profile not found"}),
                        status_code=404,
                        mimetype="application/json"
                    )
                    return add_cors_headers(response)
            
            elif req.method in ['POST', 'PATCH']:
                # Create or update business profile
                try:
                    request_body = req.get_json()
                except ValueError:
                    response = func.HttpResponse(
                        json.dumps({"error": "Invalid JSON body"}),
                        status_code=400,
                        mimetype="application/json"
                    )
                    return add_cors_headers(response)
                
                if not request_body:
                    response = func.HttpResponse(
                        json.dumps({"error": "Request body is required"}),
                        status_code=400,
                        mimetype="application/json"
                    )
                    return add_cors_headers(response)
                
                current_time = datetime.utcnow().isoformat()
                
                if req.method == 'POST':
                    # Create new business profile
                    business_profile = {
                        "id": business_id,
                        "email": business_id,
                        "businessName": request_body.get('businessName', f"{business_id.split('@')[0].title()} Business"),
                        "name": request_body.get('name', request_body.get('contactName', 'Business Owner')),
                        "businessType": request_body.get('businessType', 'Plant Business'),
                        "description": request_body.get('description', ''),
                        "logo": request_body.get('logo'),
                        "contactPhone": request_body.get('contactPhone', request_body.get('phone')),
                        "contactEmail": request_body.get('contactEmail', business_id),
                        "address": request_body.get('address', {}),
                        "businessHours": request_body.get('businessHours', []),
                        "socialMedia": request_body.get('socialMedia', {}),
                        "joinDate": current_time,
                        "status": "active",
                        "paymentMethods": request_body.get('paymentMethods', ["cash", "pickup"]),
                        "businessId": business_id,
                        "rating": 0,
                        "reviewCount": 0,
                        "isVerified": False,
                        "settings": {
                            "notifications": True,
                            "messages": True,
                            "lowStockThreshold": request_body.get('lowStockThreshold', 5)
                        }
                    }
                    
                    created_profile = business_users_container.create_item(business_profile)
                    logging.info(f"Created business profile for {business_id}")
                    
                    response = func.HttpResponse(
                        json.dumps(created_profile, default=str),
                        status_code=201,
                        mimetype="application/json"
                    )
                    return add_cors_headers(response)
                
                else:  # PATCH
                    # Update existing business profile
                    try:
                        existing_profile = business_users_container.read_item(item=business_id, partition_key=business_id)
                        
                        # Update fields
                        for key, value in request_body.items():
                            if key not in ['id', 'businessId', 'email', 'joinDate']:  # Protect immutable fields
                                existing_profile[key] = value
                        
                        # Update timestamp
                        existing_profile['updatedAt'] = current_time
                        
                        updated_profile = business_users_container.replace_item(
                            item=business_id,
                            body=existing_profile,
                            partition_key=business_id
                        )
                        
                        logging.info(f"Updated business profile for {business_id}")
                        
                        response = func.HttpResponse(
                            json.dumps(updated_profile, default=str),
                            status_code=200,
                            mimetype="application/json"
                        )
                        return add_cors_headers(response)
                        
                    except Exception as update_error:
                        logging.error(f"Failed to update business profile: {str(update_error)}")
                        response = func.HttpResponse(
                            json.dumps({"error": f"Failed to update profile: {str(update_error)}"}),
                            status_code=500,
                            mimetype="application/json"
                        )
                        return add_cors_headers(response)
            
            else:
                response = func.HttpResponse(
                    json.dumps({"error": "Method not allowed"}),
                    status_code=405,
                    mimetype="application/json"
                )
                return add_cors_headers(response)
            
        except Exception as db_error:
            logging.error(f"Database error: {str(db_error)}")
            response = func.HttpResponse(
                json.dumps({"error": f"Database error: {str(db_error)}"}),
                status_code=500,
                mimetype="application/json"
            )
            return add_cors_headers(response)
    
    except Exception as e:
        logging.error(f"Unexpected error: {str(e)}")
        response = func.HttpResponse(
            json.dumps({"error": f"Internal server error: {str(e)}"}),
            status_code=500,
            mimetype="application/json"
        )
        return add_cors_headers(response)