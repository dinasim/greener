# products-create/__init__.py
import logging
import json
import azure.functions as func
from db_helpers import get_container, get_main_container
from http_helpers import add_cors_headers, handle_options_request, create_error_response, create_success_response, extract_user_id
import uuid
from datetime import datetime

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Python HTTP trigger function for creating marketplace products processed a request.')
    
    # Handle OPTIONS method for CORS preflight
    if req.method == 'OPTIONS':
        return handle_options_request()
    
    try:
        # Get request body
        request_body = req.get_json()
        
        # Validate required fields
        required_fields = ['title', 'price', 'category', 'description']
        missing_fields = [field for field in required_fields if field not in request_body]
        
        if missing_fields:
            return create_error_response(f"Missing required fields: {', '.join(missing_fields)}", 400)
        
        # Access the marketplace-plants container
        container = get_container("marketplace-plants")
        
        # Get seller ID (user email) from the request
        seller_id = request_body.get('sellerId') or extract_user_id(req)
        
        if not seller_id:
            return create_error_response("Seller ID is required", 400)
        
        # Verify the seller exists in the Users container
        try:
            main_users_container = get_main_container("Users")
            
            query = "SELECT VALUE COUNT(1) FROM c WHERE c.email = @email OR c.id = @id"
            parameters = [
                {"name": "@email", "value": seller_id},
                {"name": "@id", "value": seller_id}
            ]
            
            results = list(main_users_container.query_items(
                query=query,
                parameters=parameters,
                enable_cross_partition_query=True
            ))
            
            if not results or results[0] == 0:
                # Try to check if user exists in marketplace users container
                marketplace_users_container = get_container("users")
                
                query = "SELECT VALUE COUNT(1) FROM c WHERE c.email = @email OR c.id = @id"
                parameters = [
                    {"name": "@email", "value": seller_id},
                    {"name": "@id", "value": seller_id}
                ]
                
                results = list(marketplace_users_container.query_items(
                    query=query,
                    parameters=parameters,
                    enable_cross_partition_query=True
                ))
                
                if not results or results[0] == 0:
                    # User not found in either container, create basic user record
                    user_id = str(uuid.uuid4())
                    user_item = {
                        "id": user_id,
                        "email": seller_id,
                        "name": seller_id.split('@')[0],  # Use part before @ as name
                        "joinDate": datetime.utcnow().isoformat(),
                        "stats": {
                            "plantsCount": 0,
                            "salesCount": 0,
                            "rating": 0
                        }
                    }
                    
                    marketplace_users_container.create_item(body=user_item)
                    logging.info(f"Created new user: {seller_id}")
        except Exception as e:
            logging.warning(f"Error verifying seller: {str(e)}")
            # Continue anyway - we'll create the listing even if we can't verify the seller
        
        # Create plant listing
        plant_id = str(uuid.uuid4())
        current_time = datetime.utcnow().isoformat()
        
        # Format price as a float
        try:
            price = float(request_body['price'])
        except (ValueError, TypeError):
            return create_error_response("Price must be a valid number", 400)
        
        # Create the plant item
        plant_item = {
            "id": plant_id,
            "title": request_body['title'],
            "description": request_body['description'],
            "price": price,
            "category": request_body['category'].lower(),
            "addedAt": current_time,
            "status": "active",
            "sellerId": seller_id,
            "images": request_body.get('images', []),
            "location": request_body.get('location', {}),
            "stats": {
                "views": 0,
                "wishlistCount": 0,
                "messageCount": 0
            }
        }
        
        # Add optional fields if provided
        if 'image' in request_body and request_body['image']:
            plant_item['image'] = request_body['image']
            
        if 'scientificName' in request_body and request_body['scientificName']:
            plant_item['scientificName'] = request_body['scientificName']
            
        if 'city' in request_body and request_body['city']:
            if 'location' not in plant_item:
                plant_item['location'] = {}
            plant_item['location']['city'] = request_body['city']
        
        # Create the item in the database
        container.create_item(body=plant_item)
        
        # Update the seller's plant count
        try:
            users_container = get_container("users")
            
            user_query = "SELECT * FROM c WHERE c.id = @id OR c.email = @email"
            user_params = [
                {"name": "@id", "value": seller_id},
                {"name": "@email", "value": seller_id}
            ]
            
            users = list(users_container.query_items(
                query=user_query,
                parameters=user_params,
                enable_cross_partition_query=True
            ))
            
            if users:
                user = users[0]
                if 'stats' not in user:
                    user['stats'] = {}
                
                # Increment plants count
                plants_count = user['stats'].get('plantsCount', 0)
                user['stats']['plantsCount'] = plants_count + 1
                
                # Update the user
                users_container.replace_item(item=user['id'], body=user)
        except Exception as e:
            logging.warning(f"Failed to update user stats: {str(e)}")
        
        # Return success response
        return create_success_response({
            "success": True,
            "productId": plant_id,
            "message": "Plant listing created successfully"
        }, 201)
    
    except Exception as e:
        logging.error(f"Error creating plant listing: {str(e)}")
        return create_error_response(str(e), 500)