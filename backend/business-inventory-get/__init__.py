# backend/business-inventory-get/__init__.py
import logging
import json
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
    """Extract user ID from request headers or route params"""
    # Try to get from headers first
    user_id = req.headers.get('X-User-Email')
    
    if not user_id:
        # Try to get from route parameters
        user_id = req.route_params.get('businessId')
    
    return user_id

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Business inventory get function processed a request.')
    
    # Handle OPTIONS method for CORS preflight
    if req.method == 'OPTIONS':
        response = func.HttpResponse("", status_code=200)
        return add_cors_headers(response)
    
    try:
        # Get business ID from route params or headers
        business_id = req.route_params.get('businessId') or get_user_id_from_request(req)
        
        if not business_id:
            response = func.HttpResponse(
                json.dumps({"error": "Business ID is required"}),
                status_code=400,
                mimetype="application/json"
            )
            return add_cors_headers(response)
        
        logging.info(f"Getting inventory for business: {business_id}")
        
        # Connect to marketplace database and inventory container
        try:
            logging.info("Connecting to marketplace database...")
            
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
            
            # Query inventory by businessId (which is the partition key)
            query = "SELECT * FROM c WHERE c.businessId = @businessId ORDER BY c.addedAt DESC"
            parameters = [{"name": "@businessId", "value": business_id}]
            
            logging.info(f"Executing query for businessId: {business_id}")
            
            # Execute query - using partition key so no cross-partition needed
            items = list(inventory_container.query_items(
                query=query,
                parameters=parameters,
                enable_cross_partition_query=False  # Using partition key
            ))
            
            logging.info(f"Found {len(items)} inventory items for business {business_id}")
            
            # Format items for frontend
            formatted_items = []
            for item in items:
                formatted_item = {
                    "id": item.get("id"),
                    "businessId": item.get("businessId"),
                    "productType": item.get("productType"),
                    "name": item.get("name") or item.get("common_name") or item.get("productName"),
                    "common_name": item.get("common_name"),
                    "scientific_name": item.get("scientific_name"),
                    "productName": item.get("productName"),
                    "plantInfo": item.get("plantInfo", {}),
                    "quantity": item.get("quantity", 0),
                    "originalQuantity": item.get("originalQuantity", 0),
                    "price": item.get("price", 0),
                    "finalPrice": item.get("finalPrice", 0),
                    "minThreshold": item.get("minThreshold", 5),
                    "discount": item.get("discount", 0),
                    "status": item.get("status", "active"),
                    "notes": item.get("notes", ""),
                    "addedAt": item.get("addedAt"),
                    "updatedAt": item.get("updatedAt"),
                    "soldCount": item.get("soldCount", 0),
                    "viewCount": item.get("viewCount", 0)
                }
                formatted_items.append(formatted_item)
            
            # Return inventory data
            response_data = {
                "success": True,
                "businessId": business_id,
                "inventory": formatted_items,
                "totalItems": len(formatted_items),
                "activeItems": len([item for item in formatted_items if item["status"] == "active"]),
                "lowStockItems": len([item for item in formatted_items 
                                   if item["quantity"] <= item["minThreshold"] and item["status"] == "active"])
            }
            
            response = func.HttpResponse(
                json.dumps(response_data, default=str),
                status_code=200,
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