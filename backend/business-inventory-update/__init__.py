# backend/business-inventory-update/__init__.py
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
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Email'
    })
    return response

def get_user_id_from_request(req):
    """Extract user ID from request headers"""
    return req.headers.get('X-User-Email')

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Business inventory update function processed a request.')
    
    # Handle OPTIONS method for CORS preflight
    if req.method == 'OPTIONS':
        response = func.HttpResponse("", status_code=200)
        return add_cors_headers(response)
    
    try:
        # Get inventory ID from route
        inventory_id = req.route_params.get('inventoryId')
        if not inventory_id:
            response = func.HttpResponse(
                json.dumps({"error": "Inventory ID is required"}),
                status_code=400,
                mimetype="application/json"
            )
            return add_cors_headers(response)
        
        # Get business ID from headers
        business_id = get_user_id_from_request(req)
        if not business_id:
            response = func.HttpResponse(
                json.dumps({"error": "Business authentication required"}),
                status_code=401,
                mimetype="application/json"
            )
            return add_cors_headers(response)
        
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
        
        logging.info(f"Updating inventory item {inventory_id} for business {business_id}")
        
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
            inventory_container = database.get_container_client("inventory")
            
            # Get existing item
            existing_item = inventory_container.read_item(item=inventory_id, partition_key=business_id)
            
            # Verify ownership
            if existing_item.get('businessId') != business_id:
                response = func.HttpResponse(
                    json.dumps({"error": "Unauthorized to edit this item"}),
                    status_code=403,
                    mimetype="application/json"
                )
                return add_cors_headers(response)
            
            # Update fields
            current_time = datetime.utcnow().isoformat()
            
            # Update allowed fields only
            allowed_updates = [
                'quantity', 'price', 'minThreshold', 'discount', 'notes', 
                'status', 'productName', 'description', 'category'
            ]
            
            updated_fields = []
            for field in allowed_updates:
                if field in request_body:
                    # Validate numeric fields
                    if field in ['quantity', 'minThreshold'] and request_body[field] is not None:
                        try:
                            value = int(request_body[field])
                            if value < 0:
                                raise ValueError(f"{field} cannot be negative")
                            existing_item[field] = value
                            updated_fields.append(field)
                        except (ValueError, TypeError):
                            response = func.HttpResponse(
                                json.dumps({"error": f"Invalid {field}: must be a non-negative integer"}),
                                status_code=400,
                                mimetype="application/json"
                            )
                            return add_cors_headers(response)
                    
                    elif field in ['price', 'discount'] and request_body[field] is not None:
                        try:
                            value = float(request_body[field])
                            if field == 'price' and value <= 0:
                                raise ValueError("Price must be greater than 0")
                            if field == 'discount' and (value < 0 or value > 100):
                                raise ValueError("Discount must be between 0 and 100")
                            existing_item[field] = value
                            updated_fields.append(field)
                        except (ValueError, TypeError):
                            response = func.HttpResponse(
                                json.dumps({"error": f"Invalid {field}: {str(ValueError)}"}),
                                status_code=400,
                                mimetype="application/json"
                            )
                            return add_cors_headers(response)
                    
                    elif field in ['status'] and request_body[field] is not None:
                        if request_body[field] in ['active', 'inactive', 'discontinued']:
                            existing_item[field] = request_body[field]
                            updated_fields.append(field)
                        else:
                            response = func.HttpResponse(
                                json.dumps({"error": "Status must be 'active', 'inactive', or 'discontinued'"}),
                                status_code=400,
                                mimetype="application/json"
                            )
                            return add_cors_headers(response)
                    
                    else:
                        # String fields
                        existing_item[field] = request_body[field]
                        updated_fields.append(field)
            
            # Recalculate final price if price or discount changed
            if 'price' in updated_fields or 'discount' in updated_fields:
                price = existing_item.get('price', 0)
                discount = existing_item.get('discount', 0)
                existing_item['finalPrice'] = round(price * (1 - discount / 100), 2)
                updated_fields.append('finalPrice')
            
            # Update timestamp
            existing_item['updatedAt'] = current_time
            updated_fields.append('updatedAt')
            
            # Update water tracking fields if this is a plant
            if existing_item.get('productType') == 'plant' and 'quantity' in updated_fields:
                # Initialize watering tracking if not exists
                if 'wateringStatus' not in existing_item:
                    water_days = existing_item.get('plantInfo', {}).get('water_days', 7)
                    existing_item['wateringStatus'] = {
                        'nextWateringDate': current_time,
                        'daysUntilWatering': water_days,
                        'defaultWaterDays': water_days,
                        'lastWatered': None,
                        'needsWatering': []  # Array of plant instances that need watering
                    }
                    updated_fields.append('wateringStatus')
            
            # Save updated item
            updated_item = inventory_container.replace_item(
                item=inventory_id,
                body=existing_item
            )
            
            logging.info(f"Successfully updated inventory item {inventory_id}. Updated fields: {updated_fields}")
            
            # Format response
            response_data = {
                "success": True,
                "message": "Inventory item updated successfully",
                "updatedFields": updated_fields,
                "item": {
                    "id": updated_item['id'],
                    "businessId": updated_item['businessId'],
                    "productType": updated_item['productType'],
                    "name": updated_item.get('name') or updated_item.get('common_name') or updated_item.get('productName'),
                    "quantity": updated_item.get('quantity', 0),
                    "price": updated_item.get('price', 0),
                    "finalPrice": updated_item.get('finalPrice', 0),
                    "minThreshold": updated_item.get('minThreshold', 5),
                    "discount": updated_item.get('discount', 0),
                    "status": updated_item.get('status', 'active'),
                    "notes": updated_item.get('notes', ''),
                    "updatedAt": updated_item['updatedAt']
                }
            }
            
            response = func.HttpResponse(
                json.dumps(response_data, default=str),
                status_code=200,
                mimetype="application/json"
            )
            return add_cors_headers(response)
            
        except Exception as db_error:
            logging.error(f"Database error: {str(db_error)}")
            
            error_message = str(db_error).lower()
            if "not found" in error_message:
                error_msg = "Inventory item not found"
                status_code = 404
            else:
                error_msg = f"Database error: {str(db_error)}"
                status_code = 500
            
            response = func.HttpResponse(
                json.dumps({"error": error_msg}),
                status_code=status_code,
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