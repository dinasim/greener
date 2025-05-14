# backend/marketplace-products-specific/__init__.py
import logging
import json
import azure.functions as func
from shared.marketplace.db_client import get_container

def add_cors_headers(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS, PUT, PATCH, DELETE'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type,Authorization,X-User-Email'
    return response

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Python HTTP trigger function for marketplace specific product processed a request.')
    
    # Handle OPTIONS method for CORS preflight
    if req.method == 'OPTIONS':
        response = func.HttpResponse()
        return add_cors_headers(response)
    
    try:
        # Get plant ID from route parameters
        plant_id = req.route_params.get('id')
        
        if not plant_id:
            error_response = func.HttpResponse(
                body=json.dumps({"error": "Plant ID is required"}),
                mimetype="application/json",
                status_code=400
            )
            return add_cors_headers(error_response)
        
        # Get user ID for wishlist status check
        user_id = req.params.get('userId')
        
        # Access the marketplace-plants container
        container = get_container("marketplace-plants")
        
        # Query for the specific plant
        query = "SELECT * FROM c WHERE c.id = @id"
        parameters = [{"name": "@id", "value": plant_id}]
        
        items = list(container.query_items(
            query=query,
            parameters=parameters,
            enable_cross_partition_query=True
        ))
        
        if not items:
            error_response = func.HttpResponse(
                body=json.dumps({"error": "Plant not found"}),
                mimetype="application/json",
                status_code=404
            )
            return add_cors_headers(error_response)
        
        plant = items[0]
        
        # Check if this item is in the user's wishlist
        if user_id:
            try:
                wishlist_container = get_container("marketplace-wishlists")
                
                wishlist_query = "SELECT * FROM c WHERE c.userId = @userId AND c.plantId = @plantId"
                wishlist_params = [
                    {"name": "@userId", "value": user_id},
                    {"name": "@plantId", "value": plant_id}
                ]
                
                wishlist_items = list(wishlist_container.query_items(
                    query=wishlist_query,
                    parameters=wishlist_params,
                    enable_cross_partition_query=True
                ))
                
                plant['isWished'] = len(wishlist_items) > 0
            except Exception as e:
                logging.warning(f"Error checking wishlist status: {str(e)}")
                plant['isWished'] = False
        
        # Return success response with CORS headers
        response = func.HttpResponse(
            body=json.dumps(plant, default=str),
            mimetype="application/json",
            status_code=200
        )
        return add_cors_headers(response)
    
    except Exception as e:
        logging.error(f"Error retrieving specific plant: {str(e)}")
        
        # Return error response with CORS headers
        error_response = func.HttpResponse(
            body=json.dumps({"error": str(e)}),
            mimetype="application/json",
            status_code=500
        )
        return add_cors_headers(error_response)