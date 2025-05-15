# backend/reviews/__init__.py
import logging
import json
import azure.functions as func
import uuid
from datetime import datetime

from db_helpers import get_container
from http_helpers import (
    add_cors_headers,
    handle_options_request,
    create_error_response,
    create_success_response,
    extract_user_id
)

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Python HTTP trigger function for reviews processed a request.')
    
    # Handle OPTIONS method for CORS preflight
    if req.method == 'OPTIONS':
        return handle_options_request()
    
    # Get parameters from route
    review_type = req.route_params.get('type')  # 'user' or 'plant'
    target_id = req.route_params.get('id')      # User ID or plant ID
    
    # Validate parameters
    if not review_type or not target_id:
        return create_error_response("Missing review type or target ID", 400)
    
    if review_type not in ['user', 'plant']:
        return create_error_response("Invalid review type. Must be 'user' or 'plant'", 400)
    
    # Handle GET (list reviews)
    if req.method == 'GET':
        return handle_get_reviews(review_type, target_id)
    
    # Handle POST (create review)
    elif req.method == 'POST':
        return handle_post_review(req, review_type, target_id)
    
    # Unsupported method
    return create_error_response("Method not allowed", 405)

def handle_get_reviews(review_type, target_id):
    """Handle GET request to fetch reviews"""
    try:
        # Access the reviews container
        container = get_container("marketplace-reviews")
        
        # Build query
        query = f"SELECT * FROM c WHERE c.targetType = @targetType AND c.targetId = @targetId ORDER BY c.createdAt DESC"
        parameters = [
            {"name": "@targetType", "value": review_type},
            {"name": "@targetId", "value": target_id}
        ]
        
        # Execute query
        reviews = list(container.query_items(
            query=query,
            parameters=parameters,
            enable_cross_partition_query=True
        ))
        
        # Calculate average rating
        total_rating = sum(review.get('rating', 0) for review in reviews)
        avg_rating = total_rating / len(reviews) if reviews else 0
        
        # Return results
        return create_success_response({
            "reviews": reviews,
            "count": len(reviews),
            "averageRating": round(avg_rating, 1)
        })
    
    except Exception as e:
        logging.error(f"Error fetching reviews: {str(e)}")
        return create_error_response(str(e), 500)

def handle_post_review(req, review_type, target_id):
    """Handle POST request to create a review"""
    try:
        # Get request body
        request_body = req.get_json()
        
        # Validate required fields
        required_fields = ['rating', 'content']
        missing_fields = [field for field in required_fields if field not in request_body]
        
        if missing_fields:
            return create_error_response(f"Missing required fields: {', '.join(missing_fields)}", 400)
        
        # Validate rating is between 1 and 5
        rating = request_body.get('rating')
        if not isinstance(rating, (int, float)) or rating < 1 or rating > 5:
            return create_error_response("Rating must be a number between 1 and 5", 400)
        
        # Get user ID (reviewer)
        user_id = extract_user_id(req)
        if not user_id:
            return create_error_response("User ID is required", 400)
        
        # Access the reviews container
        reviews_container = get_container("marketplace-reviews")
        
        # Check if user already reviewed this target
        query = "SELECT * FROM c WHERE c.targetType = @targetType AND c.targetId = @targetId AND c.userId = @userId"
        parameters = [
            {"name": "@targetType", "value": review_type},
            {"name": "@targetId", "value": target_id},
            {"name": "@userId", "value": user_id}
        ]
        
        existing_reviews = list(reviews_container.query_items(
            query=query,
            parameters=parameters,
            enable_cross_partition_query=True
        ))
        
        if existing_reviews:
            # Update existing review
            existing_review = existing_reviews[0]
            existing_review['rating'] = rating
            existing_review['content'] = request_body.get('content')
            existing_review['updatedAt'] = datetime.utcnow().isoformat()
            
            # Replace the item
            reviews_container.replace_item(item=existing_review['id'], body=existing_review)
            review_id = existing_review['id']
            is_new = False
        else:
            # Create new review
            review_id = str(uuid.uuid4())
            current_time = datetime.utcnow().isoformat()
            
            # Create review object
            review = {
                "id": review_id,
                "targetType": review_type,
                "targetId": target_id,
                "userId": user_id,
                "rating": rating,
                "content": request_body.get('content'),
                "createdAt": current_time,
                "updatedAt": current_time
            }
            
            # Add optional fields if provided
            if 'title' in request_body:
                review['title'] = request_body['title']
                
            # Add the review
            reviews_container.create_item(body=review)
            is_new = True
        
        # Update target's average rating
        update_target_rating(review_type, target_id)
        
        # Return success response
        return create_success_response({
            "success": True,
            "reviewId": review_id,
            "isNew": is_new,
            "message": "Review submitted successfully"
        }, status_code=201 if is_new else 200)
    
    except Exception as e:
        logging.error(f"Error creating review: {str(e)}")
        return create_error_response(str(e), 500)

def update_target_rating(review_type, target_id):
    """Update target's average rating based on reviews"""
    try:
        # Access the reviews container
        reviews_container = get_container("marketplace-reviews")
        
        # Get all reviews for this target
        query = "SELECT VALUE c.rating FROM c WHERE c.targetType = @targetType AND c.targetId = @targetId"
        parameters = [
            {"name": "@targetType", "value": review_type},
            {"name": "@targetId", "value": target_id},
        ]
        
        ratings = list(reviews_container.query_items(
            query=query,
            parameters=parameters,
            enable_cross_partition_query=True
        ))
        
        # Calculate average rating
        avg_rating = sum(ratings) / len(ratings) if ratings else 0
        rounded_rating = round(avg_rating, 1)
        
        # Update the target based on type
        if review_type == 'user':
            # Update user's rating
            users_container = get_container("users")
            
            try:
                # Try to find the user
                user_query = "SELECT * FROM c WHERE c.id = @id OR c.email = @email"
                user_params = [
                    {"name": "@id", "value": target_id},
                    {"name": "@email", "value": target_id}
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
                        
                    user['stats']['rating'] = rounded_rating
                    user['stats']['reviewCount'] = len(ratings)
                    
                    # Update the user
                    users_container.replace_item(item=user['id'], body=user)
            
            except Exception as user_error:
                logging.warning(f"Error updating user rating: {str(user_error)}")
        
        elif review_type == 'plant':
            # Update plant's rating
            plants_container = get_container("marketplace-plants")
            
            try:
                # Try to find the plant
                plant_query = "SELECT * FROM c WHERE c.id = @id"
                plant_params = [{"name": "@id", "value": target_id}]
                
                plants = list(plants_container.query_items(
                    query=plant_query,
                    parameters=plant_params,
                    enable_cross_partition_query=True
                ))
                
                if plants:
                    plant = plants[0]
                    if 'stats' not in plant:
                        plant['stats'] = {}
                        
                    plant['stats']['rating'] = rounded_rating
                    plant['stats']['reviewCount'] = len(ratings)
                    
                    # Update the plant
                    plants_container.replace_item(item=plant['id'], body=plant)
            
            except Exception as plant_error:
                logging.warning(f"Error updating plant rating: {str(plant_error)}")
    
    except Exception as e:
        logging.error(f"Error updating target rating: {str(e)}")
        # Continue even if rating update fails