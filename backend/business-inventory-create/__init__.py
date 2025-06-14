# backend/business-inventory-create/__init__.py - FIXED VERSION
import logging
import json
import azure.functions as func
from azure.cosmos import CosmosClient
from datetime import datetime
import os
import uuid

# Import standardized helpers
import sys
sys.path.append('..')
from http_helpers import add_cors_headers, get_user_id_from_request, create_success_response, create_error_response, validate_required_fields, sanitize_input

# Database connection details for marketplace
MARKETPLACE_CONNECTION_STRING = os.environ.get("COSMOSDB__MARKETPLACE_CONNECTION_STRING")
MARKETPLACE_DATABASE_NAME = os.environ.get("COSMOSDB_MARKETPLACE_DATABASE_NAME", "greener-marketplace-db")

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Business inventory create function processed a request.')
    
    # Handle OPTIONS method for CORS preflight
    if req.method == 'OPTIONS':
        return add_cors_headers(func.HttpResponse("", status_code=200))
    
    try:
        # FIXED: Get business ID using standardized function
        business_id = get_user_id_from_request(req)
        
        if not business_id:
            return create_error_response("Business authentication required", 401)
        
        # Parse request body
        try:
            request_body = req.get_json()
        except ValueError:
            return create_error_response("Invalid JSON body", 400)
        
        if not request_body:
            return create_error_response("Request body is required", 400)
        
        logging.info(f"Creating inventory item for business {business_id}")
        
        # Connect to marketplace database
        try:
            params = dict(param.split('=', 1) for param in MARKETPLACE_CONNECTION_STRING.split(';'))
            account_endpoint = params.get('AccountEndpoint')
            account_key = params.get('AccountKey')
            
            if not account_endpoint or not account_key:
                raise ValueError("Invalid marketplace connection string")
            
            client = CosmosClient(account_endpoint, credential=account_key)
            database = client.get_database_client(MARKETPLACE_DATABASE_NAME)
            inventory_container = database.get_container_client("inventory")
            
            # FIXED: Validate required fields
            required_fields = ['name', 'quantity', 'price']
            try:
                validate_required_fields(request_body, required_fields)
            except ValueError as e:
                return create_error_response(str(e), 400)
            
            # Generate unique inventory item ID
            inventory_id = str(uuid.uuid4())
            current_time = datetime.utcnow().isoformat()
            
            # FIXED: Create inventory item with all required fields and proper sanitization
            inventory_item = {
                "id": inventory_id,
                "businessId": business_id,  # This is the partition key
                
                # Basic product info
                "name": sanitize_input(request_body.get('name'), 'string', 100),
                "common_name": sanitize_input(request_body.get('common_name', request_body.get('name')), 'string', 100),
                "scientific_name": sanitize_input(request_body.get('scientific_name'), 'string', 100),
                "productName": sanitize_input(request_body.get('productName', request_body.get('name')), 'string', 100),
                "productType": sanitize_input(request_body.get('productType', 'plant'), 'string', 50),
                "category": sanitize_input(request_body.get('category', 'Plants'), 'string', 50),
                "description": sanitize_input(request_body.get('description'), 'string', 1000),
                "notes": sanitize_input(request_body.get('notes'), 'string', 500),
                
                # Quantity and pricing
                "quantity": sanitize_input(request_body.get('quantity'), 'int'),
                "originalQuantity": sanitize_input(request_body.get('originalQuantity', request_body.get('quantity')), 'int'),
                "price": sanitize_input(request_body.get('price'), 'number'),
                "finalPrice": sanitize_input(request_body.get('finalPrice', request_body.get('price')), 'number'),
                "discount": sanitize_input(request_body.get('discount', 0), 'number'),
                "minThreshold": sanitize_input(request_body.get('minThreshold', 5), 'int'),
                
                # Status and tracking
                "status": sanitize_input(request_body.get('status', 'active'), 'string', 20),
                "soldCount": 0,
                "viewCount": 0,
                
                # Images
                "mainImage": sanitize_input(request_body.get('mainImage'), 'string', 500),
                "images": request_body.get('images', []) if isinstance(request_body.get('images'), list) else [],
                "imageUrls": request_body.get('imageUrls', []) if isinstance(request_body.get('imageUrls'), list) else [],
                
                # Location and plant info
                "location": request_body.get('location', {}),
                "plantInfo": request_body.get('plantInfo', {}),
                "wateringSchedule": request_body.get('wateringSchedule', {}),
                
                # Timestamps
                "addedAt": current_time,
                "createdAt": current_time,
                "updatedAt": current_time,
                "lastUpdated": current_time
            }
            
            # Create the inventory item
            created_item = inventory_container.create_item(inventory_item)
            logging.info(f"Created inventory item {inventory_id} for business {business_id}")
            
            # FIXED: Return consistent response structure
            response_data = {
                "success": True,
                "message": "Inventory item created successfully",
                "inventoryItem": created_item,
                "itemId": inventory_id
            }
            
            return create_success_response(response_data, 201)
            
        except Exception as db_error:
            logging.error(f"Database error: {str(db_error)}")
            return create_error_response(f"Database error: {str(db_error)}", 500)
        
    except Exception as e:
        logging.error(f'Inventory creation error: {str(e)}')
        return create_error_response(f"Internal server error: {str(e)}", 500)