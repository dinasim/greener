# reviews-submit/__init__.py - Fixed with correct parameter names
# For older Azure Cosmos DB SDK versions

import logging
import json
import azure.functions as func
from db_helpers import get_container
from http_helpers import add_cors_headers, handle_options_request, create_error_response, create_success_response, extract_user_id
import uuid
from datetime import datetime

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Python HTTP trigger function for submitting reviews processed a request.')
    logging.info(f'Request URL: {req.url}')
    logging.info(f'Request method: {req.method}')
    
    # Handle OPTIONS method for CORS preflight
    if req.method == 'OPTIONS':
        logging.info('Handling OPTIONS request')
        return handle_options_request()
    
    try:
        # Get user ID from request for review attribution
        user_id = extract_user_id(req)
        logging.info(f'User ID: {user_id}')
        
        if not user_id:
            logging.error("Missing user ID")
            return create_error_response("User ID is required", 400)
        
        # Get target type and ID from route parameters
        target_type = req.route_params.get('targetType')
        target_id = req.route_params.get('targetId')
        
        logging.info(f'Route parameters: targetType={target_type}, targetId={target_id}')
        
        if not target_type or not target_id:
            logging.error("Missing required route parameters")
            return create_error_response("Target type and ID are required", 400)
        
        # Parse request body
        try:
            request_body = req.get_body().decode('utf-8')
            logging.info(f'Request body: {request_body}')
            review_data = json.loads(request_body)
        except ValueError as e:
            logging.error(f"Error parsing request body: {str(e)}")
            return create_error_response("Invalid JSON body", 400)
        except Exception as e:
            logging.error(f"Error reading request body: {str(e)}")
            return create_error_response(f"Error reading request body: {str(e)}", 400)
        
        # Validate required fields
        if 'rating' not in review_data or 'text' not in review_data:
            logging.error("Missing required review fields")
            return create_error_response("Rating and text are required", 400)
        
        # Validate rating value
        try:
            rating = int(review_data['rating'])
            if rating < 1 or rating > 5:
                logging.error(f"Invalid rating value: {rating}")
                return create_error_response("Rating must be between 1 and 5", 400)
        except (ValueError, TypeError) as e:
            logging.error(f"Error parsing rating: {str(e)}")
            return create_error_response("Rating must be a number between 1 and 5", 400)
        
        # Access the reviews container
        try:
            logging.info("Getting reviews container")
            reviews_container = get_container("marketplace_reviews")
            logging.info("Successfully got reviews container")
        except Exception as e:
            logging.error(f"Error getting reviews container: {str(e)}")
            return create_error_response(f"Database error: {str(e)}", 500)
        
        # Determine the seller ID for proper partitioning
        seller_id = None
        if target_type == 'product':
            try:
                # Get the product to find the actual sellerId
                products_container = get_container("marketplace_plants")
                product_query = "SELECT c.sellerId FROM c WHERE c.id = @id"
                product_params = [{"name": "@id", "value": target_id}]
                
                products = list(products_container.query_items(
                    query=product_query,
                    parameters=product_params,
                    enable_cross_partition_query=True
                ))
                
                if products and 'sellerId' in products[0]:
                    seller_id = products[0]['sellerId']  # Use the actual seller ID
                    logging.info(f"Found actual sellerId {seller_id} for product {target_id}")
                else:
                    seller_id = f"product_{target_id}_seller"  # Fallback
            except Exception as e:
                seller_id = f"product_{target_id}_seller"  # Fallback
        else:
            # For seller reviews, the seller ID is the target ID
            seller_id = target_id
        
        logging.info(f"Using sellerId {seller_id} as partition key")
        
        # Get user's name
        user_name = 'User'
        try:
            users_container = get_container("users")
            
            user_query = "SELECT c.name FROM c WHERE c.id = @id OR c.email = @email"
            user_params = [
                {"name": "@id", "value": user_id},
                {"name": "@email", "value": user_id}
            ]
            
            users = list(users_container.query_items(
                query=user_query,
                parameters=user_params,
                enable_cross_partition_query=True
            ))
            
            if users and 'name' in users[0]:
                user_name = users[0]['name']
                logging.info(f"Found user name: {user_name}")
            else:
                logging.warning(f"Could not find name for user {user_id}")
        except Exception as e:
            logging.warning(f"Error getting user name: {str(e)}")
        
        # Create review object
        review_id = str(uuid.uuid4())
        current_time = datetime.utcnow().isoformat()
        
        # Create review object with proper partition key
        review_item = {
            "id": review_id,
            "sellerId": seller_id,  # Include sellerId in the item for partition key
            "productId": target_id if target_type == 'product' else None,
            "targetType": target_type,
            "userId": user_id,
            "userName": user_name,
            "rating": rating,
            "text": review_data['text'],
            "createdAt": current_time
        }
        
        # Create the review in the database with the correct parameter name (body)
        try:
            logging.info(f"Creating review with id {review_id}")
            # Use body parameter as required by the older SDK
            result = reviews_container.create_item(body=review_item)
            logging.info(f"Review created successfully: {result}")
        except Exception as e:
            logging.error(f"Error creating review: {str(e)}")
            return create_error_response(f"Database error: {str(e)}", 500)
        
        # Add isOwnReview flag for the frontend
        review_item['isOwnReview'] = True
        
        # Update the target's average rating
        try:
            update_target_rating(target_type, target_id)
        except Exception as e:
            logging.warning(f"Error updating target rating: {str(e)}")
        
        # Return success response
        return create_success_response({
            "success": True,
            "review": review_item,
            "message": f"Review submitted successfully"
        }, 201)
    
    except Exception as e:
        logging.error(f"Unhandled exception: {str(e)}")
        return create_error_response(str(e), 500)

def update_target_rating(target_type, target_id):
    """Update the average rating of a seller or product"""
    
    # Get all reviews for the target
    reviews_container = get_container("marketplace_reviews")
    
    if target_type == 'seller':
        query = "SELECT VALUE c.rating FROM c WHERE c.sellerId = @sellerId"
        parameters = [{"name": "@sellerId", "value": target_id}]
        enable_cross_partition = False
    else:
        query = "SELECT VALUE c.rating FROM c WHERE c.productId = @productId"
        parameters = [{"name": "@productId", "value": target_id}]
        enable_cross_partition = True
    
    ratings = list(reviews_container.query_items(
        query=query,
        parameters=parameters,
        enable_cross_partition_query=enable_cross_partition
    ))
    
    if not ratings:
        return
    
    average_rating = sum(ratings) / len(ratings)
    
    container_name = "marketplace_plants" if target_type == "product" else "users"
    container = get_container(container_name)
    
    query = "SELECT * FROM c WHERE c.id = @id"
    parameters = [{"name": "@id", "value": target_id}]
    
    targets = list(container.query_items(
        query=query,
        parameters=parameters,
        enable_cross_partition_query=True
    ))
    
    if not targets:
        if target_type == "seller":
            query = "SELECT * FROM c WHERE c.email = @email"
            parameters = [{"name": "@email", "value": target_id}]
            targets = list(container.query_items(
                query=query,
                parameters=parameters,
                enable_cross_partition_query=True
            ))
    
    if not targets:
        logging.warning(f"Could not find {target_type} with ID {target_id}")
        return
    
    target = targets[0]
    
    if 'stats' not in target:
        target['stats'] = {}
    
    target['stats']['rating'] = average_rating
    target['stats']['reviewCount'] = len(ratings)
    
    # Use body parameter for consistency with the SDK version
    container.replace_item(item=target['id'], body=target)