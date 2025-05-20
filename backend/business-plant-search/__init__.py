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
        
        # Simplified search query - prioritize common name, fallback to scientific name
        # First: Search common names (exact matches will naturally appear first)
        primary_search_query = """
        SELECT * FROM c 
        WHERE CONTAINS(LOWER(c.common_name), LOWER(@query))
        """
        
        parameters = [
            {"name": "@query", "value": query}
        ]
        
        # Execute primary query (common name search)
        logging.info(f"Searching for plants with common name containing: '{query}'")
        try:
            primary_items = list(container.query_items(
                query=primary_search_query,
                parameters=parameters,
                enable_cross_partition_query=True
            ))
            logging.info(f"Found {len(primary_items)} items in common name search")
        except Exception as e:
            logging.error(f"Primary search failed: {str(e)}")
            primary_items = []
        
        # If we have less than 10 results, also search scientific names
        secondary_items = []
        if len(primary_items) < 10:
            try:
                secondary_search_query = """
                SELECT * FROM c 
                WHERE CONTAINS(LOWER(c.scientific_name), LOWER(@query))
                """
                
                secondary_items = list(container.query_items(
                    query=secondary_search_query,
                    parameters=parameters,
                    enable_cross_partition_query=True
                ))
                
                # Remove duplicates (items that were already found in primary search)
                primary_ids = {item.get('id') for item in primary_items}
                secondary_items = [item for item in secondary_items if item.get('id') not in primary_ids]
                
                logging.info(f"Found {len(secondary_items)} additional items in scientific name search")
            except Exception as e:
                logging.error(f"Secondary search failed: {str(e)}")
                secondary_items = []
        
        # Combine results - primary first, then secondary
        items = primary_items + secondary_items
        
        # Sort results in Python (more reliable than SQL sorting)
        def sort_key(item):
            common_name = (item.get('common_name') or '').lower()
            query_lower = query.lower()
            
            # Exact match gets priority 1
            if common_name == query_lower:
                return (1, common_name)
            # Starts with gets priority 2  
            elif common_name.startswith(query_lower):
                return (2, common_name)
            # Contains gets priority 3
            else:
                return (3, common_name)
        
        try:
            items.sort(key=sort_key)
        except Exception as e:
            logging.warning(f"Sorting failed, using unsorted results: {str(e)}")
            # Continue with unsorted results
        
        # Limit results to 20 for performance
        limited_items = items[:20]
        
        # Format the response to match frontend expectations
        formatted_items = []
        for item in limited_items:
            try:
                formatted_item = {
                    "id": item.get("id", ""),
                    "common_name": item.get("common_name", "Unknown Plant"),
                    "scientific_name": item.get("scientific_name", "Scientific name not available"),
                    "origin": item.get("origin", "Origin unknown"),
                    "water_days": item.get("water_days", 7),
                    "light": item.get("light", "Bright indirect light"),
                    "humidity": item.get("humidity", "Average humidity"),
                    "temperature": item.get("temperature", {"min": 18, "max": 24}),
                    "pets": item.get("pets", "Unknown"),
                    "difficulty": item.get("difficulty", 5),
                    "repot": item.get("repot", "Every 2 years"),
                    "feed": item.get("feed", "Monthly during growing season"),
                    "common_problems": item.get("common_problems", [])
                }
                formatted_items.append(formatted_item)
            except Exception as e:
                logging.warning(f"Error formatting item {item.get('id', 'unknown')}: {str(e)}")
                continue
        
        logging.info(f"Successfully formatted {len(formatted_items)} plants matching '{query}' (prioritizing common names)")
        
        return create_success_response({
            "plants": formatted_items,
            "count": len(formatted_items),
            "total": len(items),
            "search_info": {
                "query": query,
                "search_type": "common_name_priority",
                "primary_results": len(primary_items),
                "secondary_results": len(secondary_items)
            }
        })
    
    except Exception as e:
        logging.error(f"Error searching plants: {str(e)}")
        return create_error_response(f"Plant search failed: {str(e)}", 500)