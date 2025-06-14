# backend/business-profile/__init__.py - FIXED VERSION WITH ROUTE PARAM
import logging
import json
import azure.functions as func
from azure.cosmos import CosmosClient
import os
from datetime import datetime

# Import standardized helpers
import sys
sys.path.append('..')
from http_helpers import add_cors_headers, get_user_id_from_request, create_success_response, create_error_response

# Database connection details for marketplace
MARKETPLACE_CONNECTION_STRING = os.environ.get("COSMOSDB__MARKETPLACE_CONNECTION_STRING")
MARKETPLACE_DATABASE_NAME = os.environ.get("COSMOSDB_MARKETPLACE_DATABASE_NAME", "greener-marketplace-db")

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Business profile function processed a request.')
    
    # Handle OPTIONS method for CORS preflight
    if req.method == 'OPTIONS':
        response = func.HttpResponse("", status_code=200)
        return add_cors_headers(response)
    
    try:
        # FIXED: Get business ID from route params first, then fallback to headers
        business_id = req.route_params.get('businessId') or get_user_id_from_request(req)
        
        if not business_id:
            return create_error_response("Business ID is required", 400)
        
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
            inventory_container = database.get_container_client("inventory")
            
            if req.method == 'GET':
                # Get business profile with inventory
                try:
                    business_profile = business_users_container.read_item(item=business_id, partition_key=business_id)
                    logging.info(f"Retrieved business profile for {business_id}")
                    
                    # Get business inventory
                    try:
                        inventory_query = "SELECT * FROM c WHERE c.businessId = @businessId AND c.status = 'active'"
                        inventory_items = list(inventory_container.query_items(
                            query=inventory_query,
                            parameters=[{"name": "@businessId", "value": business_id}],
                            enable_cross_partition_query=True
                        ))
                        
                        logging.info(f"Found {len(inventory_items)} inventory items")
                    except Exception as e:
                        logging.warning(f"Error getting inventory: {str(e)}")
                        inventory_items = []
                    
                    # FIXED: Return consistent response structure that matches frontend expectations
                    response_data = {
                        "success": True,
                        "business": {
                            **business_profile,
                            "inventory": inventory_items,
                            "isBusiness": True
                        },
                        "inventory": inventory_items,
                        "inventoryCount": len(inventory_items)
                    }
                    
                    return create_success_response(response_data)
                    
                except Exception as read_error:
                    logging.error(f"Business profile not found: {str(read_error)}")
                    return create_error_response("Business profile not found", 404)
                
            elif req.method in ['POST', 'PATCH']:
                # Create or update business profile
                try:
                    request_body = req.get_json()
                except ValueError:
                    return create_error_response("Invalid JSON body", 400)
                
                if not request_body:
                    return create_error_response("Request body is required", 400)
                
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
                        },
                        "createdAt": current_time
                    }
                    
                    created_profile = business_users_container.create_item(business_profile)
                    logging.info(f"Created business profile for {business_id}")
                    
                    return create_success_response({
                        "success": True,
                        "business": created_profile
                    }, 201)
                
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
                        
                        return create_success_response({
                            "success": True,
                            "business": updated_profile
                        })
                        
                    except Exception as update_error:
                        logging.error(f"Failed to update business profile: {str(update_error)}")
                        return create_error_response(f"Failed to update profile: {str(update_error)}", 500)
            
            else:
                return create_error_response("Method not allowed", 405)
            
        except Exception as db_error:
            logging.error(f"Database error: {str(db_error)}")
            return create_error_response(f"Database error: {str(db_error)}", 500)
    
    except Exception as e:
        logging.error(f"Unexpected error: {str(e)}")
        return create_error_response(f"Internal server error: {str(e)}", 500)