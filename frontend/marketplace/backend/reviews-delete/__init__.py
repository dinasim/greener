# reviews-delete/__init__.py - fixed version
import logging
import json
import azure.functions as func
from db_helpers import get_container
from http_helpers import add_cors_headers, handle_options_request, create_error_response, create_success_response, extract_user_id

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Python HTTP trigger function for deleting reviews processed a request.')
    logging.info(f'Request URL: {req.url}')
    logging.info(f'Request method: {req.method}')
    
    # Handle OPTIONS method for CORS preflight
    if req.method == 'OPTIONS':
        return handle_options_request()
    
    try:
        # Get review ID from route parameters
        review_id = req.route_params.get('reviewId')
        logging.info(f'Review ID from route: {review_id}')
        
        if not review_id:
            return create_error_response("Review ID is required", 400)
        
        # Get user ID from request for authorization
        user_id = extract_user_id(req)
        logging.info(f'User ID: {user_id}')
        
        if not user_id:
            return create_error_response("User ID is required", 400)
        
        # Access the marketplace_reviews container - IMPORTANT: note the underscore
        reviews_container = get_container("marketplace_reviews")
        logging.info('Reviews container retrieved')
        
        # First, we need to get the review to check permissions and find the partition key (sellerId)
        # Since we don't know the sellerId in advance, we need a cross-partition query
        query = "SELECT * FROM c WHERE c.id = @id"
        parameters = [{"name": "@id", "value": review_id}]
        
        logging.info(f'Executing query: {query} with parameters: {parameters}')
        reviews = list(reviews_container.query_items(
            query=query,
            parameters=parameters,
            enable_cross_partition_query=True  # Need cross-partition to find by id
        ))
        
        if not reviews:
            logging.error(f'Review {review_id} not found')
            return create_error_response("Review not found", 404)
        
        review = reviews[0]
        logging.info(f'Found review: {json.dumps(review)}')
        
        # Check if the user is authorized to delete this review
        if review.get('userId') != user_id:
            logging.error(f'User {user_id} not authorized to delete review {review_id} owned by {review.get("userId")}')
            return create_error_response("You are not authorized to delete this review", 403)
        
        # Get the sellerId for the partition key
        seller_id = review.get('sellerId')
        
        if not seller_id:
            logging.error('Review has no sellerId (partition key)')
            return create_error_response("Review has no sellerId (partition key)", 500)
        
        logging.info(f'Using seller_id {seller_id} as partition key')
        
        # Store target information for rating update
        target_type = 'product' if 'productId' in review else 'seller'
        target_id = review.get('productId' if target_type == 'product' else 'sellerId')
        logging.info(f'Target type: {target_type}, Target ID: {target_id}')
        
        # Delete the review (now we know the partition key)
        logging.info(f'Deleting review {review_id} with partition key {seller_id}')
        reviews_container.delete_item(item=review_id, partition_key=seller_id)
        logging.info('Review deleted successfully')
        
        # Update the target's average rating
        if target_id:
            try:
                logging.info(f'Updating target rating for {target_type} {target_id}')
                update_target_rating(target_type, target_id)
            except Exception as e:
                logging.warning(f"Error updating target rating: {str(e)}")
        
        # Return success response
        return create_success_response({
            "success": True,
            "message": "Review deleted successfully"
        })
    
    except Exception as e:
        logging.error(f"Error deleting review: {str(e)}")
        return create_error_response(str(e), 500)

def update_target_rating(target_type, target_id):
    """Update the average rating of a seller or product after review deletion"""
    logging.info(f'Updating rating for {target_type} {target_id}')
    
    # Get all reviews for the target
    reviews_container = get_container("marketplace_reviews")
    
    if target_type == 'seller':
        # For seller reviews, we can use the partition key
        query = "SELECT VALUE c.rating FROM c WHERE c.sellerId = @sellerId"
        parameters = [{"name": "@sellerId", "value": target_id}]
        enable_cross_partition = False
    else:
        # For product reviews, we need cross-partition query
        query = "SELECT VALUE c.rating FROM c WHERE c.productId = @productId"
        parameters = [{"name": "@productId", "value": target_id}]
        enable_cross_partition = True
    
    logging.info(f'Executing query: {query} with parameters: {parameters}')
    ratings = list(reviews_container.query_items(
        query=query,
        parameters=parameters,
        enable_cross_partition_query=enable_cross_partition
    ))
    
    # Calculate average rating
    average_rating = sum(ratings) / len(ratings) if ratings else 0
    logging.info(f'New average rating: {average_rating} from {len(ratings)} reviews')
    
    # Determine which container to update
    container_name = "marketplace-plants" if target_type == "product" else "users"
    container = get_container(container_name)
    
    # Get the target
    query = "SELECT * FROM c WHERE c.id = @id"
    parameters = [{"name": "@id", "value": target_id}]
    
    targets = list(container.query_items(
        query=query,
        parameters=parameters,
        enable_cross_partition_query=True
    ))
    
    if not targets:
        # Try with email as ID for users
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
    logging.info(f'Found target: {json.dumps(target)}')
    
    # Update rating
    if 'stats' not in target:
        target['stats'] = {}
    
    target['stats']['rating'] = average_rating
    target['stats']['reviewCount'] = len(ratings)
    
    # Update the target
    logging.info(f'Updating {target_type} {target["id"]} with new rating')
    container.replace_item(item=target['id'], body=target)
    logging.info('Target rating updated successfully')