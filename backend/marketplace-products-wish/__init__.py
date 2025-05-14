# This file should be placed at /marketplace-products-wish/__init__.py
# Example of restructured wishlist toggle function

import logging
import json
import azure.functions as func
from shared.marketplace.db_client import get_container
import uuid
from datetime import datetime

def add_cors_headers(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS, PUT, PATCH, DELETE'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type,Authorization,X-User-Email'
    return response

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Python HTTP trigger function for wishlist toggle processed a request.')
    
    try:
        # Get plant ID from route parameters
        plant_id = req.route_params.get('id')
        
        if not plant_id:
            return func.HttpResponse(
                body=json.dumps({"error": "Plant ID is required"}),
                mimetype="application/json",
                status_code=400
            )
        
        # Get user ID from request body or query parameter
        request_json = req.get_json() if req.get_body() else {}
        user_id = request_json.get('userId') or req.params.get('userId') or "default@example.com"
        
        # Access the marketplace_wishlists container
        wishlists_container = get_container('marketplace-wishlists')
        
        # Check if the item is already in the wishlist
        query = "SELECT * FROM c WHERE c.userId = @userId AND c.plantId = @plantId"
        parameters = [
            {"name": "@userId", "value": user_id},
            {"name": "@plantId", "value": plant_id}
        ]
        
        existing_items = list(wishlists_container.query_items(
            query=query,
            parameters=parameters,
            enable_cross_partition_query=True
        ))
        
        is_now_wished = False
        
        if existing_items:
            # Remove from wishlist
            for item in existing_items:
                wishlists_container.delete_item(item=item['id'], partition_key=user_id)
            
            # Update plant statistics
            try:
                plants_container = get_container('marketplace-plants')
                
                # Get the plant
                plant_query = "SELECT * FROM c WHERE c.id = @id"
                plant_params = [{"name": "@id", "value": plant_id}]
                plants = list(plants_container.query_items(
                    query=plant_query,
                    parameters=plant_params,
                    enable_cross_partition_query=True
                ))
                
                if plants:
                    plant = plants[0]
                    if 'stats' not in plant:
                        plant['stats'] = {}
                    
                    # Decrement wishlist count, ensuring it doesn't go below 0
                    current_count = plant['stats'].get('wishlistCount', 0)
                    plant['stats']['wishlistCount'] = max(0, current_count - 1)
                    
                    # Update the plant
                    plants_container.replace_item(item=plant['id'], body=plant)
            except Exception as e:
                logging.warning(f"Failed to update plant stats: {str(e)}")
            
            is_now_wished = False
        else:
            # Add to wishlist
            wishlist_item = {
                "id": str(uuid.uuid4()),
                "userId": user_id,
                "plantId": plant_id,
                "addedAt": datetime.utcnow().isoformat()
            }
            
            wishlists_container.create_item(body=wishlist_item)
            
            # Update plant statistics
            try:
                plants_container = get_container('marketplace-plants')
                
                # Get the plant
                plant_query = "SELECT * FROM c WHERE c.id = @id"
                plant_params = [{"name": "@id", "value": plant_id}]
                plants = list(plants_container.query_items(
                    query=plant_query,
                    parameters=plant_params,
                    enable_cross_partition_query=True
                ))
                
                if plants:
                    plant = plants[0]
                    if 'stats' not in plant:
                        plant['stats'] = {}
                    
                    # Increment wishlist count
                    current_count = plant['stats'].get('wishlistCount', 0)
                    plant['stats']['wishlistCount'] = current_count + 1
                    
                    # Update the plant
                    plants_container.replace_item(item=plant['id'], body=plant)
            except Exception as e:
                logging.warning(f"Failed to update plant stats: {str(e)}")
            
            is_now_wished = True
        
        return func.HttpResponse(
            body=json.dumps({
                "success": True,
                "isWished": is_now_wished,
                "message": f"Plant {'added to' if is_now_wished else 'removed from'} wishlist"
            }),
            mimetype="application/json",
            status_code=200
        )
    
    except Exception as e:
        logging.error(f"Error toggling wishlist: {str(e)}")
        return func.HttpResponse(
            body=json.dumps({"error": str(e)}),
            mimetype="application/json",
            status_code=500
        )
