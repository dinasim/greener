# backend/business-inventory-create/__init__.py
import logging
import json
import uuid
from datetime import datetime
import azure.functions as func
from azure.cosmos import CosmosClient
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
    """Extract user ID from request headers or body"""
    # Try to get from headers first
    user_id = req.headers.get('X-User-Email')
    
    if not user_id:
        # Try to get from request body
        try:
            body = req.get_json()
            user_id = body.get('businessId') or body.get('userId')
        except:
            pass
    
    return user_id

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Business inventory create function processed a request.')
    
    # Handle OPTIONS method for CORS preflight
    if req.method == 'OPTIONS':
        response = func.HttpResponse("", status_code=200)
        return add_cors_headers(response)
    
    try:
        # Get user ID from request
        user_id = get_user_id_from_request(req)
        if not user_id:
            response = func.HttpResponse(
                json.dumps({"error": "User authentication required. Please provide X-User-Email header."}),
                status_code=401,
                mimetype="application/json"
            )
            return add_cors_headers(response)
        
        logging.info(f"Processing inventory creation for user: {user_id}")
        
        # Parse request body
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
        
        # Validate required fields
        required_fields = ['productType', 'quantity', 'price']
        missing_fields = [field for field in required_fields if field not in request_body]
        
        if missing_fields:
            response = func.HttpResponse(
                json.dumps({"error": f"Missing required fields: {', '.join(missing_fields)}"}),
                status_code=400,
                mimetype="application/json"
            )
            return add_cors_headers(response)
        
        # Use user_id as business_id
        business_id = user_id
        
        # Validate data types and values
        try:
            quantity = int(request_body['quantity'])
            price = float(request_body['price'])
            min_threshold = int(request_body.get('minThreshold', 5))
            discount = float(request_body.get('discount', 0))
            
            if quantity <= 0:
                raise ValueError("Quantity must be greater than 0")
            if price <= 0:
                raise ValueError("Price must be greater than 0")
            if min_threshold < 0:
                raise ValueError("Minimum threshold cannot be negative")
            if discount < 0 or discount > 100:
                raise ValueError("Discount must be between 0 and 100")
                
        except (ValueError, TypeError) as e:
            response = func.HttpResponse(
                json.dumps({"error": f"Invalid numeric values: {str(e)}"}),
                status_code=400,
                mimetype="application/json"
            )
            return add_cors_headers(response)
        
        # Generate inventory item ID
        inventory_id = str(uuid.uuid4())
        current_time = datetime.utcnow().isoformat()
        
        # Create inventory item based on product type
        product_type = request_body['productType'].lower()
        
        if product_type == 'plant':
            # Validate plant data
            plant_data = request_body.get('plantData', {})
            if not plant_data or not plant_data.get('common_name'):
                response = func.HttpResponse(
                    json.dumps({"error": "Plant data with common_name is required for plant products"}),
                    status_code=400,
                    mimetype="application/json"
                )
                return add_cors_headers(response)
            
            # Create plant inventory item
            inventory_item = {
                "id": inventory_id,
                "businessId": business_id,
                "productType": "plant",
                "productId": plant_data.get('id', f"plant_{inventory_id}"),
                "name": plant_data['common_name'],  # Add name field for easier querying
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
                response = func.HttpResponse(
                    json.dumps({"error": "Product name is required for tools/accessories/supplies"}),
                    status_code=400,
                    mimetype="application/json"
                )
                return add_cors_headers(response)
            
            inventory_item = {
                "id": inventory_id,
                "businessId": business_id,
                "productType": product_type,
                "productId": f"{product_type}_{inventory_id}",
                "name": request_body['productName'],  # Add name field for easier querying
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
            response = func.HttpResponse(
                json.dumps({"error": "Invalid product type. Must be 'plant', 'tool', 'accessory', or 'supply'"}),
                status_code=400,
                mimetype="application/json"
            )
            return add_cors_headers(response)
        
        # Connect to marketplace database and inventory container
        try:
            logging.info(f"Connecting to marketplace database...")
            
            # Parse connection string
            params = dict(param.split('=', 1) for param in MARKETPLACE_CONNECTION_STRING.split(';'))
            account_endpoint = params.get('AccountEndpoint')
            account_key = params.get('AccountKey')
            
            if not account_endpoint or not account_key:
                raise ValueError("Invalid marketplace connection string")
            
            # Create client and get container
            client = CosmosClient(account_endpoint, credential=account_key)
            database = client.get_database_client(MARKETPLACE_DATABASE_NAME)
            inventory_container = database.get_container_client("inventory")
            
            logging.info(f"Creating inventory item with businessId: {business_id}")
            logging.info(f"Item: {inventory_item['name']} - ${inventory_item['price']}")
            
            # Create the item with businessId as partition key
            created_item = inventory_container.create_item(body=inventory_item)
            
            logging.info(f"Successfully created inventory item {inventory_id}")
            
            # Return success response
            response_data = {
                "success": True,
                "inventoryId": inventory_id,
                "message": f"{product_type.title()} added to inventory successfully",
                "item": {
                    "id": created_item['id'],
                    "businessId": created_item['businessId'],
                    "productType": created_item['productType'],
                    "name": created_item.get('name'),
                    "common_name": created_item.get('common_name'),
                    "productName": created_item.get('productName'),
                    "quantity": created_item['quantity'],
                    "price": created_item['price'],
                    "finalPrice": created_item['finalPrice'],
                    "status": created_item['status'],
                    "addedAt": created_item['addedAt']
                }
            }
            
            response = func.HttpResponse(
                json.dumps(response_data, default=str),
                status_code=201,
                mimetype="application/json"
            )
            return add_cors_headers(response)
            
        except Exception as db_error:
            logging.error(f"Database error: {str(db_error)}")
            logging.error(f"Error type: {type(db_error).__name__}")
            
            # More specific error messages
            error_message = str(db_error).lower()
            if "partition key" in error_message:
                error_msg = f"Partition key error: {str(db_error)}"
            elif "container" in error_message or "not found" in error_message:
                error_msg = "Inventory container not found"
            elif "already exists" in error_message:
                error_msg = "Item with this ID already exists"
            else:
                error_msg = f"Database error: {str(db_error)}"
            
            response = func.HttpResponse(
                json.dumps({"error": error_msg}),
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