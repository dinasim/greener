# marketplace-products/__init__.py
import logging
import json
import azure.functions as func
from db_helpers import get_container
from http_helpers import add_cors_headers, handle_options_request, create_error_response, create_success_response, extract_user_id
from datetime import datetime

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Python HTTP trigger function for marketplace products processed a request.')
    
    # Handle OPTIONS method for CORS preflight
    if req.method == 'OPTIONS':
        return handle_options_request()
    
    try:
        # Get query parameters
        category = req.params.get('category')
        search = req.params.get('search')
        min_price = req.params.get('minPrice')
        max_price = req.params.get('maxPrice')
        sort_by = req.params.get('sortBy', 'addedAt')
        sort_order = req.params.get('sortOrder', 'desc')
        page = int(req.params.get('page', 1))
        page_size = int(req.params.get('pageSize', 20))
        user_id = req.params.get('userId')  # For wishlist status
        
        # Access the marketplace-plants container
        container = get_container("marketplace-plants")
        
        # Build the query
        query_parts = ["SELECT * FROM c WHERE 1=1"]
        parameters = []
        param_index = 0
        
        # Function to get the next parameter name
        def get_param_name():
            nonlocal param_index
            param_name = f"@p{param_index}"
            param_index += 1
            return param_name
        
        # Add filters
        if category and category.lower() != 'all':
            # Only show active listings by default
            param_name = get_param_name()
            query_parts.append(f"AND (c.status = {param_name} OR (NOT IS_DEFINED(c.status)))")  # Fixed syntax
            parameters.append({"name": param_name, "value": "active"})
        if search:
            param_name = get_param_name()
            query_parts.append(f"AND (CONTAINS(LOWER(c.title), {param_name}) OR CONTAINS(LOWER(c.description), {param_name}))")
            parameters.append({"name": param_name, "value": search.lower()})
        
        if min_price:
            param_name = get_param_name()
            query_parts.append(f"AND c.price >= {param_name}")
            parameters.append({"name": param_name, "value": float(min_price)})
        
        if max_price:
            param_name = get_param_name()
            query_parts.append(f"AND c.price <= {param_name}")
            parameters.append({"name": param_name, "value": float(max_price)})
        
        # Only show active listings by default
        param_name = get_param_name()
        # Fixed query: Properly check for status (using either IS_DEFINED or simple equality)
        query_parts.append(f"AND (c.status = {param_name} OR (NOT IS_DEFINED(c.status)))")
        parameters.append({"name": param_name, "value": "active"})
        
        # Determine sort field
        sort_field_map = {
            'recent': 'c.addedAt',
            'price': 'c.price',
            'rating': 'c.seller.rating',
            'title': 'c.title',
            'addedAt': 'c.addedAt'
        }
        sort_field = sort_field_map.get(sort_by, 'c.addedAt')
        
        # Add sorting
        sort_direction = "DESC" if sort_order.lower() == 'desc' else "ASC"
        query_parts.append(f"ORDER BY {sort_field} {sort_direction}")
        
        # Combine query
        query = " ".join(query_parts)
        
        logging.info(f"Query: {query}")
        logging.info(f"Parameters: {parameters}")
        
        # Execute query
        items = list(container.query_items(
            query=query,
            parameters=parameters,
            enable_cross_partition_query=True
        ))
        
        # Calculate pagination
        total_count = len(items)
        total_pages = (total_count + page_size - 1) // page_size
        
        # Slice the results for the requested page
        start_idx = (page - 1) * page_size
        end_idx = min(start_idx + page_size, total_count)
        page_items = items[start_idx:end_idx]
        
        # Format response
        response_data = {
            "products": page_items,
            "page": page,
            "pages": total_pages,
            "count": total_count,
            "currentPage": page
        }
        
        # Return success response
        return create_success_response(response_data)
    
    except Exception as e:
        logging.error(f"Error retrieving marketplace products: {str(e)}")
        return create_error_response(str(e), 500)