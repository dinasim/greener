# Backend: /backend/user-listings/__init__.py

import logging
import json
import azure.functions as func
from db_helpers import get_container
from http_helpers import add_cors_headers, handle_options_request, create_error_response, create_success_response, extract_user_id

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Python HTTP trigger function for getting user listings processed a request.')
    
    # Handle OPTIONS method for CORS preflight
    if req.method == 'OPTIONS':
        return handle_options_request()
    
    try:
        # Get user ID from route parameters
        user_id = req.route_params.get('id')
        
        if not user_id:
            return create_error_response("User ID is required", 400)
        
        # Get query parameters
        status = req.params.get('status')  # Options: 'active', 'sold', 'deleted', or 'all'
        
        # Access the marketplace-plants container
        plants_container = get_container("marketplace-plants")
        
        # Build the query
        query = "SELECT * FROM c WHERE c.sellerId = @sellerId"
        parameters = [{"name": "@sellerId", "value": user_id}]
        
        # Add status filter if provided
        if status and status.lower() != 'all':
            query += " AND c.status = @status"
            parameters.append({"name": "@status", "value": status.lower()})
        
        # Sort by most recent first
        query += " ORDER BY c.addedAt DESC"
        
        # Execute the query
        plants = list(plants_container.query_items(
            query=query,
            parameters=parameters,
            enable_cross_partition_query=True
        ))
        
        # Format response based on status
        if status:
            return create_success_response({
                "listings": plants,
                "count": len(plants),
                "status": status
            })
        else:
            # Group by status if no specific status was requested
            active_listings = [p for p in plants if p.get('status') == 'active' or not p.get('status')]
            sold_listings = [p for p in plants if p.get('status') == 'sold']
            deleted_listings = [p for p in plants if p.get('status') == 'deleted']
            
            return create_success_response({
                "active": active_listings,
                "sold": sold_listings,
                "deleted": deleted_listings,
                "count": {
                    "active": len(active_listings),
                    "sold": len(sold_listings),
                    "deleted": len(deleted_listings),
                    "total": len(plants)
                }
            })
    
    except Exception as e:
        logging.error(f"Error getting user listings: {str(e)}")
        return create_error_response(str(e), 500)