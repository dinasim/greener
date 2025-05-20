import logging
import azure.functions as func
from azure.cosmos import CosmosClient
import os
import json
from http_helpers import add_cors_headers, handle_options_request, create_error_response, create_success_response

# Get connection details from environment variables
COSMOS_URI = os.environ.get("COSMOS_URI")
COSMOS_KEY = os.environ.get("COSMOS_KEY")
DATABASE_NAME = "GreenerDB"  # Main database
CONTAINER_NAME = "Plants"    # Plants container in main DB

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Business plant search function processed a request.')
    
    # Handle OPTIONS method for CORS preflight
    if req.method == 'OPTIONS':
        return handle_options_request()
    
    try:
        # Get search query from parameters
        query = req.params.get('q')
        
        if not query or len(query) < 2:
            return create_error_response("Search query must be at least 2 characters", 400)
        
        # Connect to main database (GreenerDB) and Plants container
        client = CosmosClient(COSMOS_URI, credential=COSMOS_KEY)
        database = client.get_database_client(DATABASE_NAME)
        container = database.get_container_client(CONTAINER_NAME)
        
        # Search plants by common name and scientific name (case insensitive)
        search_query = """
        SELECT * FROM c 
        WHERE CONTAINS(LOWER(c.common_name), LOWER(@query)) 
        OR CONTAINS(LOWER(c.scientific_name), LOWER(@query))
        ORDER BY c.common_name
        """
        
        parameters = [
            {"name": "@query", "value": query}
        ]
        
        # Execute query
        items = list(container.query_items(
            query=search_query,
            parameters=parameters,
            enable_cross_partition_query=True
        ))
        
        # Limit results to 20 for performance
        limited_items = items[:20]
        
        # Format the response to match frontend expectations
        formatted_items = []
        for item in limited_items:
            formatted_item = {
                "id": item.get("id"),
                "common_name": item.get("common_name"),
                "scientific_name": item.get("scientific_name"),
                "origin": item.get("origin"),
                "water_days": item.get("water_days"),
                "light": item.get("light"),
                "humidity": item.get("humidity"),
                "temperature": item.get("temperature", {}),
                "pets": item.get("pets"),
                "difficulty": item.get("difficulty"),
                "repot": item.get("repot"),
                "feed": item.get("feed"),
                "common_problems": item.get("common_problems", [])
            }
            formatted_items.append(formatted_item)
        
        logging.info(f"Found {len(formatted_items)} plants matching '{query}'")
        
        return create_success_response({
            "plants": formatted_items,
            "count": len(formatted_items),
            "total": len(items)
        })
    
    except Exception as e:
        logging.error(f"Error searching plants: {str(e)}")
        return create_error_response(str(e), 500)