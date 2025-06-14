# backend/business-inventory-update/__init__.py - FIXED VERSION
import logging
import json
import azure.functions as func
from azure.cosmos import CosmosClient
from datetime import datetime
import os

# Import standardized helpers
import sys
sys.path.append('..')
from http_helpers import add_cors_headers, get_user_id_from_request, create_success_response, create_error_response, sanitize_input

# Database connection details for marketplace
MARKETPLACE_CONNECTION_STRING = os.environ.get("COSMOSDB__MARKETPLACE_CONNECTION_STRING")
MARKETPLACE_DATABASE_NAME = os.environ.get("COSMOSDB_MARKETPLACE_DATABASE_NAME", "greener-marketplace-db")

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Business inventory update function processed a request.')
    
    # Handle OPTIONS method for CORS preflight
    if req.method == 'OPTIONS':
        return add_cors_headers(func.HttpResponse("", status_code=200))
    
    try:
        # FIXED: Get business ID and inventory ID using standardized functions
        business_id = get_user_id_from_request(req)
        inventory_id = req.route_params.get('inventoryId')
        
        if not business_id:
            return create_error_response("Business authentication required", 401)
        
        if not inventory_id:
            return create_error_response("Inventory ID is required", 400)
        
        # Parse request body
        try:
            request_body = req.get_json()
        except ValueError:
            return create_error_response("Invalid JSON body", 400)
        
        if not request_body:
            return create_error_response("Request body is required", 400)
        
        logging.info(f"Updating inventory item {inventory_id} for business {business_id}")
        
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
            
            # Get existing inventory item to verify ownership
            try:
                existing_item = inventory_container.read_item(item=inventory_id, partition_key=business_id)
                
                # Verify the item belongs to the requesting business
                if existing_item.get('businessId') != business_id:
                    return create_error_response("Access denied: Item belongs to another business", 403)
                
            except Exception as read_error:
                logging.error(f"Item not found: {str(read_error)}")
                return create_error_response("Inventory item not found", 404)
            
            # FIXED: Update item with proper sanitization and timestamp
            current_time = datetime.utcnow().isoformat()
            
            # Prepare update data with sanitization
            update_data = {}
            
            # Basic product info updates
            if 'name' in request_body:
                update_data['name'] = sanitize_input(request_body['name'], 'string', 100)
            if 'common_name' in request_body:
                update_data['common_name'] = sanitize_input(request_body['common_name'], 'string', 100)
            if 'scientific_name' in request_body:
                update_data['scientific_name'] = sanitize_input(request_body['scientific_name'], 'string', 100)
            if 'productName' in request_body:
                update_data['productName'] = sanitize_input(request_body['productName'], 'string', 100)
            if 'productType' in request_body:
                update_data['productType'] = sanitize_input(request_body['productType'], 'string', 50)
            if 'category' in request_body:
                update_data['category'] = sanitize_input(request_body['category'], 'string', 50)
            if 'description' in request_body:
                update_data['description'] = sanitize_input(request_body['description'], 'string', 1000)
            if 'notes' in request_body:
                update_data['notes'] = sanitize_input(request_body['notes'], 'string', 500)
            
            # Quantity and pricing updates
            if 'quantity' in request_body:
                update_data['quantity'] = sanitize_input(request_body['quantity'], 'int')
            if 'price' in request_body:
                update_data['price'] = sanitize_input(request_body['price'], 'number')
                update_data['finalPrice'] = update_data['price']  # Update finalPrice when price changes
            if 'finalPrice' in request_body:
                update_data['finalPrice'] = sanitize_input(request_body['finalPrice'], 'number')
            if 'discount' in request_body:
                update_data['discount'] = sanitize_input(request_body['discount'], 'number')
            if 'minThreshold' in request_body:
                update_data['minThreshold'] = sanitize_input(request_body['minThreshold'], 'int')
            
            # Status updates
            if 'status' in request_body:
                update_data['status'] = sanitize_input(request_body['status'], 'string', 20)
            
            # Image updates
            if 'mainImage' in request_body:
                update_data['mainImage'] = sanitize_input(request_body['mainImage'], 'string', 500)
            if 'images' in request_body and isinstance(request_body['images'], list):
                update_data['images'] = request_body['images']
            if 'imageUrls' in request_body and isinstance(request_body['imageUrls'], list):
                update_data['imageUrls'] = request_body['imageUrls']
            
            # Complex object updates
            if 'location' in request_body and isinstance(request_body['location'], dict):
                update_data['location'] = request_body['location']
            if 'plantInfo' in request_body and isinstance(request_body['plantInfo'], dict):
                update_data['plantInfo'] = request_body['plantInfo']
            if 'wateringSchedule' in request_body and isinstance(request_body['wateringSchedule'], dict):
                update_data['wateringSchedule'] = request_body['wateringSchedule']
            
            # Update timestamps
            update_data['updatedAt'] = current_time
            update_data['lastUpdated'] = current_time
            
            # Apply updates to existing item
            for key, value in update_data.items():
                existing_item[key] = value
            
            # Update the item in the database
            updated_item = inventory_container.replace_item(
                item=inventory_id,
                body=existing_item,
                partition_key=business_id
            )
            
            logging.info(f"Updated inventory item {inventory_id} for business {business_id}")
            
            # FIXED: Return consistent response structure
            response_data = {
                "success": True,
                "message": "Inventory item updated successfully",
                "inventoryItem": updated_item,
                "itemId": inventory_id,
                "updatedFields": list(update_data.keys())
            }
            
            return create_success_response(response_data)
            
        except Exception as db_error:
            logging.error(f"Database error: {str(db_error)}")
            return create_error_response(f"Database error: {str(db_error)}", 500)
        
    except Exception as e:
        logging.error(f'Inventory update error: {str(e)}')
        return create_error_response(f"Internal server error: {str(e)}", 500)