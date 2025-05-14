# backend/user-profile/__init__.py
import logging
import json
import azure.functions as func
from shared.marketplace.db_client import get_container, get_main_container
from datetime import datetime

def add_cors_headers(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS, PUT, PATCH, DELETE'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type,Authorization,X-User-Email'
    return response

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Python HTTP trigger function for marketplace user profile processed a request.')
    
    # Handle OPTIONS method for CORS preflight
    if req.method == 'OPTIONS':
        response = func.HttpResponse()
        return add_cors_headers(response)
    
    try:
        # Get user ID from route parameters or query
        user_id = req.route_params.get('id') or req.params.get('id')
        
        if not user_id:
            error_response = func.HttpResponse(
                body=json.dumps({"error": "User ID is required"}),
                mimetype="application/json",
                status_code=400
            )
            return add_cors_headers(error_response)
        
        # Try to get the user from Users container
        try:
            main_users_container = get_main_container("Users")
            
            # In main DB, email is the primary identifier
            main_query = "SELECT * FROM c WHERE c.email = @email"
            main_params = [{"name": "@email", "value": user_id}]
            
            main_users = list(main_users_container.query_items(
                query=main_query,
                parameters=main_params,
                enable_cross_partition_query=True
            ))
            
            if main_users:
                user = main_users[0]
                
                # Return the user data
                response = func.HttpResponse(
                    body=json.dumps({"user": user}, default=str),
                    mimetype="application/json",
                    status_code=200
                )
                return add_cors_headers(response)
        except Exception as e:
            logging.warning(f"Error fetching user from main database: {str(e)}")
        
        # If we get here, the user wasn't found
        error_response = func.HttpResponse(
            body=json.dumps({"error": "User not found"}),
            mimetype="application/json",
            status_code=404
        )
        return add_cors_headers(error_response)
    
    except Exception as e:
        logging.error(f"Error getting user profile: {str(e)}")
        
        # Return error response with CORS headers
        error_response = func.HttpResponse(
            body=json.dumps({"error": str(e)}),
            mimetype="application/json",
            status_code=500
        )
        return add_cors_headers(error_response)