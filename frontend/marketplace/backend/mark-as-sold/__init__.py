# Backend: /backend/mark-as-sold/__init__.py

import logging
import json
import azure.functions as func
from db_helpers import get_container
from http_helpers import add_cors_headers, handle_options_request, create_error_response, create_success_response, extract_user_id
from datetime import datetime

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Python HTTP trigger function for marking a product as sold processed a request.')
    
    # Handle OPTIONS method for CORS preflight
    if req.method == 'OPTIONS':
        return handle_options_request()
    
    try:
        # Get product ID from route parameters
        product_id = req.route_params.get('id')
        
        if not product_id:
            return create_error_response("Product ID is required", 400)
        
        # Get user ID to verify ownership
        user_id = extract_user_id(req)
        
        if not user_id:
            return create_error_response("User ID is required", 400)
        
        # Try to get buyer information from request body
        buyer_id = None
        transaction_notes = None
        
        try:
            request_body = req.get_json()
            buyer_id = request_body.get('buyerId')
            transaction_notes = request_body.get('notes')
        except ValueError:
            pass
        
        # Access the marketplace-plants container
        container = get_container("marketplace-plants")
        
        # Check if the product exists and is owned by the user
        query = "SELECT * FROM c WHERE c.id = @id"
        parameters = [{"name": "@id", "value": product_id}]
        
        products = list(container.query_items(
            query=query,
            parameters=parameters,
            enable_cross_partition_query=True
        ))
        
        if not products:
            return create_error_response("Product not found", 404)
        
        product = products[0]
        
        # Verify ownership
        seller_id = product.get('sellerId')
        
        if not seller_id or seller_id != user_id:
            return create_error_response("You don't have permission to mark this product as sold", 403)
        
        # Check if already sold
        if product.get('status') == 'sold':
            return create_error_response("This product is already marked as sold", 400)
        
        # Update product status
        product['status'] = 'sold'
        product['soldAt'] = datetime.utcnow().isoformat()
        
        # Add transaction info if available
        if buyer_id or transaction_notes:
            if 'transaction' not in product:
                product['transaction'] = {}
            
            if buyer_id:
                product['transaction']['buyerId'] = buyer_id
            
            if transaction_notes:
                product['transaction']['notes'] = transaction_notes
        
        # Update the product
        container.replace_item(item=product_id, body=product)
        
        # Update user stats (increment sales count)
        try:
            users_container = get_container("users")
            
            user_query = "SELECT * FROM c WHERE c.id = @id OR c.email = @email"
            user_params = [
                {"name": "@id", "value": user_id},
                {"name": "@email", "value": user_id}
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
                
                # Increment sales count
                current_count = user['stats'].get('salesCount', 0)
                user['stats']['salesCount'] = current_count + 1
                
                users_container.replace_item(item=user['id'], body=user)
        except Exception as e:
            logging.warning(f"Error updating user stats: {str(e)}")
        
        return create_success_response({
            "success": True,
            "message": "Product successfully marked as sold"
        })
    
    except Exception as e:
        logging.error(f"Error marking product as sold: {str(e)}")
        return create_error_response(str(e), 500)