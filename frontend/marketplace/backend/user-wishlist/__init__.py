# Backend: Fix for user-wishlist/__init__.py

import logging
import json
import azure.functions as func
from db_helpers import get_container
from http_helpers import add_cors_headers, handle_options_request, create_error_response, create_success_response, extract_user_id

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Python HTTP trigger function for getting user wishlist processed a request.')
    
    # Handle OPTIONS method for CORS preflight
    if req.method == 'OPTIONS':
        return handle_options_request()
    
    try:
        # Get user ID from route parameters
        user_id = req.route_params.get('id')
        
        if not user_id:
            return create_error_response("User ID is required", 400)
        
        # Get current user ID to verify permissions
        current_user_id = extract_user_id(req)
        
        # Only allow users to view their own wishlist
        if current_user_id and current_user_id != user_id:
            return create_error_response("You don't have permission to view this wishlist", 403)
        
        # Access the marketplace-wishlists container
        wishlists_container = get_container("marketplace-wishlists")
        
        # Query for the user's wishlist items
        query = "SELECT * FROM c WHERE c.userId = @userId ORDER BY c.addedAt DESC"
        parameters = [{"name": "@userId", "value": user_id}]
        
        wishlist_items = list(wishlists_container.query_items(
            query=query,
            parameters=parameters,
            enable_cross_partition_query=True
        ))
        
        # Get the plant details for each wishlist item
        plants_container = get_container("marketplace-plants")
        plants_data = []
        
        for item in wishlist_items:
            plant_id = item.get('plantId')
            
            if not plant_id:
                continue
            
            # Query for the plant
            plant_query = "SELECT * FROM c WHERE c.id = @id"
            plant_params = [{"name": "@id", "value": plant_id}]
            
            plants = list(plants_container.query_items(
                query=plant_query,
                parameters=plant_params,
                enable_cross_partition_query=True
            ))
            
            if plants:
                plant = plants[0]
                plant['wishlistId'] = item.get('id')  # Include the wishlist item ID for reference
                plant['addedToWishlistAt'] = item.get('addedAt')  # Add the date it was added to wishlist
                plant['isWished'] = True  # Flag this as a wishlist item
                plants_data.append(plant)
        
        # If we found no wishlist items or no plants, return an empty array
        if not plants_data:
            return create_success_response({
                "wishlist": [],
                "count": 0
            })
            
        return create_success_response({
            "wishlist": plants_data,
            "count": len(plants_data)
        })
    
    except Exception as e:
        logging.error(f"Error getting user wishlist: {str(e)}")
        return create_error_response(str(e), 500)