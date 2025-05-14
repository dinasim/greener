# user-profile/__init__.py
import logging
import json
import azure.functions as func
from db_helpers import get_container, get_main_container
from http_helpers import add_cors_headers, handle_options_request, create_error_response, create_success_response, extract_user_id
from datetime import datetime

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Python HTTP trigger function for marketplace user profile processed a request.')
    
    # Handle OPTIONS method for CORS preflight
    if req.method == 'OPTIONS':
        return handle_options_request()
    
    try:
        # Get user ID from route parameters or query
        user_id = req.route_params.get('id') or extract_user_id(req)
        
        if not user_id:
            return create_error_response("User ID is required", 400)
        
        # Try to get the user from main Users container first
        try:
            main_users_container = get_main_container("Users")
            
            # In main DB, email is often the primary identifier
            main_query = "SELECT * FROM c WHERE c.email = @email OR c.id = @id"
            main_params = [
                {"name": "@email", "value": user_id},
                {"name": "@id", "value": user_id}
            ]
            
            main_users = list(main_users_container.query_items(
                query=main_query,
                parameters=main_params,
                enable_cross_partition_query=True
            ))
            
            if main_users:
                user = main_users[0]
                
                # Enhance with marketplace stats if available
                try:
                    # Check for plants, wishlists, etc.
                    plants_container = get_container("marketplace-plants")
                    plant_query = "SELECT VALUE COUNT(1) FROM c WHERE c.sellerId = @sellerId"
                    plant_params = [{"name": "@sellerId", "value": user_id}]
                    plant_count = list(plants_container.query_items(
                        query=plant_query,
                        parameters=plant_params,
                        enable_cross_partition_query=True
                    ))
                    
                    if plant_count and plant_count[0] > 0:
                        if 'stats' not in user:
                            user['stats'] = {}
                        user['stats']['plantsCount'] = plant_count[0]
                except Exception as e:
                    logging.warning(f"Error getting plant stats: {str(e)}")
                
                # Return the user data
                return create_success_response({"user": user})
        except Exception as e:
            logging.warning(f"Error fetching user from main database: {str(e)}")
        
        # If not found in main database, try marketplace users container
        try:
            users_container = get_container("users")
            
            user_query = "SELECT * FROM c WHERE c.email = @email OR c.id = @id"
            user_params = [
                {"name": "@email", "value": user_id},
                {"name": "@id", "value": user_id}
            ]
            
            users = list(users_container.query_items(
                query=user_query,
                parameters=user_params,
                enable_cross_partition_query=True
            ))
            
            if users:
                return create_success_response({"user": users[0]})
        except Exception as e:
            logging.warning(f"Error fetching user from marketplace database: {str(e)}")
        
        # If still not found, create a basic user entry
        try:
            # Create a new user record
            user_id_str = str(user_id)  # Ensure it's a string
            new_user = {
                "id": user_id_str,
                "email": user_id_str,
                "name": user_id_str.split('@')[0] if '@' in user_id_str else user_id_str,
                "joinDate": datetime.utcnow().isoformat(),
                "stats": {
                    "plantsCount": 0,
                    "salesCount": 0,
                    "rating": 0
                }
            }
            
            users_container = get_container("users")
            users_container.create_item(body=new_user)
            
            logging.info(f"Created new user profile for {user_id}")
            return create_success_response({"user": new_user})
        except Exception as e:
            logging.error(f"Error creating new user: {str(e)}")
        
        # If we get here, the user wasn't found and couldn't be created
        return create_error_response("User not found and could not be created", 404)
    
    except Exception as e:
        logging.error(f"Error getting user profile: {str(e)}")
        return create_error_response(str(e), 500)