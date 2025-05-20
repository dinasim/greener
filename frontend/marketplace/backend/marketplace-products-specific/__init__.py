# marketplace-products-specific/__init__.py
import logging
import json
import azure.functions as func
from db_helpers import get_container
from http_helpers import add_cors_headers, handle_options_request, create_error_response, create_success_response, extract_user_id

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Python HTTP trigger function for marketplace specific product processed a request.')
    
    # Handle OPTIONS method for CORS preflight
    if req.method == 'OPTIONS':
        return handle_options_request()
    
    try:
        # Get plant ID from route parameters
        plant_id = req.route_params.get('id')
        
        if not plant_id:
            return create_error_response("Plant ID is required", 400)
        
        # Get user ID for wishlist status check
        user_id = extract_user_id(req)
        
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
            return create_error_response("Plant not found", 404)
        
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
        
        # Return success response
        return create_success_response(plant)
    
    except Exception as e:
        logging.error(f"Error retrieving specific plant: {str(e)}")
        return create_error_response(str(e), 500)