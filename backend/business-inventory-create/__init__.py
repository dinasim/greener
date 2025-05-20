# backend/business-inventory-create/__init__.py
import logging
import json
import uuid
from datetime import datetime
import azure.functions as func
from db_helpers import get_container
from http_helpers import add_cors_headers, handle_options_request, create_error_response, create_success_response, extract_user_id
from db_helpers import get_marketplace_container

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Business inventory create function processed a request.')
    
    # Handle OPTIONS method for CORS preflight
    if req.method == 'OPTIONS':
        return handle_options_request()
    
    try:
        # Get user ID from request headers for authentication
        user_id = extract_user_id(req)
        if not user_id:
            return create_error_response("User authentication required", 401)
        
        logging.info(f"Processing inventory creation for user: {user_id}")
        
        # Parse request body
        try:
            request_body = req.get_json()
        except ValueError:
            return create_error_response("Invalid JSON body", 400)
        
        if not request_body:
            return create_error_response("Request body is required", 400)
        
        # Validate required fields
        required_fields = ['productType', 'quantity', 'price']
        missing_fields = [field for field in required_fields if field not in request_body]
        
        if missing_fields:
            return create_error_response(f"Missing required fields: {', '.join(missing_fields)}", 400)
        
        # Use user_id as business_id
        business_id = user_id
        
        # Validate data types and values
        try:
            quantity = int(request_body['quantity'])
            price = float(request_body['price'])
            min_threshold = int(request_body.get('minThreshold', 5))
            discount = float(request_body.get('discount', 0))
            
            if quantity <= 0:
                return create_error_response("Quantity must be greater than 0", 400)
            if price <= 0:
                return create_error_response("Price must be greater than 0", 400)
            if min_threshold < 0:
                return create_error_response("Minimum threshold cannot be negative", 400)
            if discount < 0 or discount > 100:
                return create_error_response("Discount must be between 0 and 100", 400)
                
        except (ValueError, TypeError) as e:
            return create_error_response(f"Invalid numeric values: {str(e)}", 400)
        
        # Generate inventory item ID
        inventory_id = str(uuid.uuid4())
        current_time = datetime.utcnow().isoformat()
        
        # Create inventory item based on product type
        product_type = request_body['productType'].lower()
        
        if product_type == 'plant':
            # Validate plant data
            plant_data = request_body.get('plantData', {})
            if not plant_data or not plant_data.get('common_name'):
                return create_error_response("Plant data with common_name is required for plant products", 400)
            
            # Create plant inventory item
            inventory_item = {
                "id": inventory_id,
                "businessId": business_id,
                "productType": "plant",
                "productId": plant_data.get('id', f"plant_{inventory_id}"),
                "common_name": plant_data['common_name'],
                "scientific_name": plant_data.get('scientific_name', ''),
                "plantInfo": {
                    "origin": plant_data.get('origin', ''),
                    "water_days": plant_data.get('water_days', 7),
                    "light": plant_data.get('light', 'Bright indirect light'),
                    "humidity": plant_data.get('humidity', 'Average'),
                    "temperature": plant_data.get('temperature', 'Room temperature'),
                    "pets": plant_data.get('pets', 'Unknown'),
                    "difficulty": plant_data.get('difficulty', 5),
                    "repot": plant_data.get('repot', 'Every 2 years'),
                    "feed": plant_data.get('feed', 'Monthly in growing season'),
                    "common_problems": plant_data.get('common_problems', [])
                },
                "quantity": quantity,
                "originalQuantity": quantity,
                "price": price,
                "minThreshold": min_threshold,
                "discount": discount,
                "finalPrice": round(price * (1 - discount / 100), 2),
                "status": "active",
                "notes": request_body.get('notes', ''),
                "addedAt": current_time,
                "updatedAt": current_time,
                "soldCount": 0,
                "viewCount": 0
            }
            
        elif product_type in ['tool', 'accessory', 'supply']:
            # Create tool/accessory/supply inventory item
            if not request_body.get('productName'):
                return create_error_response("Product name is required for tools/accessories/supplies", 400)
            
            inventory_item = {
                "id": inventory_id,
                "businessId": business_id,
                "productType": product_type,
                "productId": f"{product_type}_{inventory_id}",
                "productName": request_body['productName'],
                "description": request_body.get('description', ''),
                "category": request_body.get('category', product_type),
                "brand": request_body.get('brand', ''),
                "model": request_body.get('model', ''),
                "specifications": request_body.get('specifications', {}),
                "quantity": quantity,
                "originalQuantity": quantity,
                "price": price,
                "minThreshold": min_threshold,
                "discount": discount,
                "finalPrice": round(price * (1 - discount / 100), 2),
                "status": "active",
                "notes": request_body.get('notes', ''),
                "addedAt": current_time,
                "updatedAt": current_time,
                "soldCount": 0,
                "viewCount": 0
            }
        else:
            return create_error_response("Invalid product type. Must be 'plant', 'tool', 'accessory', or 'supply'", 400)
        
        # Access the inventory container and create the item
        try:
            logging.info(f"Connecting to inventory container...")
            inventory_container = get_marketplace_container("inventory")
            
            logging.info(f"Creating item with businessId: {business_id}")
            logging.info(f"Item data: {json.dumps(inventory_item, default=str)}")
            
            # Create the item - the partition key should be automatically handled
            created_item = inventory_container.create_item(body=inventory_item)
            
            logging.info(f"Successfully created inventory item {inventory_id}")
            
            # Return success response
            return create_success_response({
                "success": True,
                "inventoryId": inventory_id,
                "message": f"{product_type.title()} added to inventory successfully",
                "item": {
                    "id": created_item['id'],
                    "businessId": created_item['businessId'],
                    "productType": created_item['productType'],
                    "common_name": created_item.get('common_name'),
                    "productName": created_item.get('productName'),
                    "quantity": created_item['quantity'],
                    "price": created_item['price'],
                    "finalPrice": created_item['finalPrice'],
                    "status": created_item['status'],
                    "addedAt": created_item['addedAt']
                }
            }, 201)
            
        except Exception as db_error:
            logging.error(f"Database error: {str(db_error)}")
            logging.error(f"Error type: {type(db_error).__name__}")
            
            # More specific error messages
            error_message = str(db_error).lower()
            if "partition key" in error_message:
                return create_error_response(f"Partition key error: {str(db_error)}", 500)
            elif "container" in error_message or "not found" in error_message:
                return create_error_response("Inventory container not found", 500)
            elif "already exists" in error_message:
                return create_error_response("Item with this ID already exists", 409)
            else:
                return create_error_response(f"Database error: {str(db_error)}", 500)
    
    except Exception as e:
        logging.error(f"Unexpected error: {str(e)}")
        return create_error_response(f"Internal server error: {str(e)}", 500)