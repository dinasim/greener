# backend/business-plant-search/__init__.py - Fixed Version
import logging
import azure.functions as func
from azure.cosmos import CosmosClient
import os
import json

# Get connection details for MAIN database (where Plants are stored)
COSMOS_URI = os.environ.get("COSMOS_URI")
COSMOS_KEY = os.environ.get("COSMOS_KEY")
DATABASE_NAME = "GreenerDB"  # Main database with Plants
CONTAINER_NAME = "Plants"    # Plants container

def add_cors_headers(response):
    """Add CORS headers to response"""
    response.headers.update({
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Email'
    })
    return response

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('🔍 Business plant search function processed a request.')
    
    # Handle OPTIONS method for CORS preflight
    if req.method == 'OPTIONS':
        response = func.HttpResponse("", status_code=200)
        return add_cors_headers(response)
    
    try:
        # Get search query from parameters
        query = req.params.get('q') or req.params.get('name')
        logging.info(f'🔍 Search query: {query}')
        
        if not query or len(query) < 2:
            logging.warning('❌ Query too short or missing')
            response = func.HttpResponse(
                json.dumps({"error": "Search query must be at least 2 characters"}),
                status_code=400,
                mimetype="application/json"
            )
            return add_cors_headers(response)
        
        # Connect to main database (GreenerDB) and Plants container
        logging.info(f'🔌 Connecting to Cosmos DB: {COSMOS_URI}')
        client = CosmosClient(COSMOS_URI, credential=COSMOS_KEY)
        database = client.get_database_client(DATABASE_NAME)
        container = database.get_container_client(CONTAINER_NAME)
        logging.info('✅ Connected to Plants container')
        
        # Search plants by common name and scientific name (case insensitive)
        search_query = """
        SELECT * FROM c 
        WHERE CONTAINS(LOWER(c.common_name), LOWER(@query)) 
        OR CONTAINS(LOWER(c.scientific_name), LOWER(@query))
        OR CONTAINS(LOWER(c.id), LOWER(@query))
        ORDER BY c.common_name
        """
        
        parameters = [
            {"name": "@query", "value": query}
        ]
        
        logging.info(f'📊 Executing query with parameters: {parameters}')
        
        # Execute query
        items = list(container.query_items(
            query=search_query,
            parameters=parameters,
            enable_cross_partition_query=True
        ))
        
        logging.info(f'📊 Found {len(items)} total items')
        
        # Limit results to 20 for performance
        limited_items = items[:20]
        logging.info(f'📊 Returning {len(limited_items)} limited items')
        
        # Format the response to match frontend expectations
        formatted_items = []
        for item in limited_items:
            try:
                # Ensure all required fields are present
                formatted_item = {
                    "id": item.get("id", ""),
                    "common_name": item.get("common_name", "Unknown Plant"),
                    "scientific_name": item.get("scientific_name", ""),
                    "origin": item.get("origin", "Unknown"),
                    "water_days": item.get("water_days", 7),
                    "light": item.get("light", "Bright indirect light"),
                    "humidity": item.get("humidity", "Average"),
                    "temperature": item.get("temperature", "Room temperature"),
                    "pets": item.get("pets", "Unknown"),
                    "difficulty": item.get("difficulty", 5),
                    "repot": item.get("repot", "Every 2 years"),
                    "feed": item.get("feed", "Monthly in growing season"),
                    "common_problems": item.get("common_problems", [])
                }
                formatted_items.append(formatted_item)
                logging.info(f'✅ Formatted item: {formatted_item["common_name"]}')
            except Exception as format_error:
                logging.error(f'❌ Error formatting item {item.get("id", "unknown")}: {str(format_error)}')
                continue
        
        logging.info(f'✅ Successfully formatted {len(formatted_items)} plants')
        
        # Return the array directly (this is what frontend expects)
        response = func.HttpResponse(
            json.dumps(formatted_items, default=str, ensure_ascii=False),
            status_code=200,
            mimetype="application/json; charset=utf-8"
        )
        return add_cors_headers(response)
    
    except Exception as e:
        logging.error(f'❌ Error searching plants: {str(e)}')
        logging.error(f'❌ Error type: {type(e).__name__}')
        
        # Return detailed error for debugging
        error_response = {
            "error": str(e),
            "error_type": type(e).__name__,
            "query_received": req.params.get('q') or req.params.get('name'),
        }
        
        response = func.HttpResponse(
            json.dumps(error_response),
            status_code=500,
            mimetype="application/json"
        )
        return add_cors_headers(response)