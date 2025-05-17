import logging
import json
import azure.functions as func
import math
import traceback
from db_helpers import get_container
from http_helpers import add_cors_headers, handle_options_request, create_error_response, create_success_response, extract_user_id

def calculate_distance(lat1, lon1, lat2, lon2):
    """
    Calculate the great circle distance between two points 
    on the earth (specified in decimal degrees)
    """
    # Convert decimal degrees to radians
    lat1, lon1, lat2, lon2 = map(math.radians, [lat1, lon1, lat2, lon2])
    
    # Haversine formula
    dlon = lon2 - lon1
    dlat = lat2 - lat1
    a = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon/2)**2
    c = 2 * math.asin(math.sqrt(a))
    r = 6371  # Radius of earth in kilometers
    
    return c * r

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Python HTTP trigger function for nearby products processed a request.')
    
    # Handle OPTIONS method for CORS preflight
    if req.method == 'OPTIONS':
        return handle_options_request()
    
    try:
        # Get query parameters
        lat = req.params.get('lat')
        lon = req.params.get('lon')
        radius = req.params.get('radius', '10')  # Default radius is 10 km
        category = req.params.get('category')
        sort_by = req.params.get('sortBy', 'distance')  # Default sort by distance
        
        # Validate coordinates
        if not lat or not lon:
            return create_error_response("Latitude and longitude are required", 400)
        
        try:
            lat = float(lat)
            lon = float(lon)
            radius = float(radius)
        except ValueError:
            return create_error_response("Invalid coordinate or radius format", 400)
        
        # Add some debug info
        logging.info(f"Search parameters: lat={lat}, lon={lon}, radius={radius}, category={category}, sortBy={sort_by}")
        
        # Access the marketplace_plants container
        container_name = "marketplace_plants"
        try:
            container = get_container(container_name)
            logging.info(f"Successfully connected to container: {container_name}")
        except Exception as e:
            logging.error(f"Error connecting to container {container_name}: {str(e)}")
            return create_error_response(f"Database error: {str(e)}", 500)
        
        # Get all products with active status
        query = "SELECT * FROM c WHERE c.status = 'active' OR NOT IS_DEFINED(c.status)"
        
        # Add category filter if provided
        if category and category.lower() != 'all':
            query += " AND c.category = @category"
            parameters = [{"name": "@category", "value": category.lower()}]
        else:
            parameters = []
        
        # Execute the query with debugging
        try:
            products = list(container.query_items(
                query=query,
                parameters=parameters,
                enable_cross_partition_query=True
            ))
            logging.info(f"Found {len(products)} products in total")
        except Exception as e:
            logging.error(f"Query error: {str(e)}")
            logging.error(f"Query: {query}")
            logging.error(f"Parameters: {parameters}")
            return create_error_response(f"Query error: {str(e)}", 500)
        
        # Filter products by distance if they have location data
        nearby_products = []
        products_without_location = 0
        
        for product in products:
            # Skip products with status=deleted
            if product.get('status') == 'deleted':
                continue
                
            # Skip products without location data
            if 'location' not in product or not product['location']:
                products_without_location += 1
                continue
                
            # Get coordinates from standardized location object
            location = product['location']
            
            # Expected standard format: location.latitude and location.longitude 
            try:
                product_lat = float(location.get('latitude'))
                product_lon = float(location.get('longitude'))
            except (ValueError, TypeError, AttributeError):
                products_without_location += 1
                continue
                
            # Calculate distance using Haversine formula
            distance = calculate_distance(lat, lon, product_lat, product_lon)
            
            # Include product if within radius
            if distance <= radius:
                # Add distance to product
                product['distance'] = round(distance, 2)
                nearby_products.append(product)
        
        logging.info(f"Found {len(nearby_products)} nearby products within {radius}km")
        logging.info(f"{products_without_location} products had no location data")
        
        # Sort by distance if requested
        if sort_by == 'distance':
            nearby_products.sort(key=lambda p: p.get('distance', float('inf')))
        elif sort_by == 'distance_desc':
            nearby_products.sort(key=lambda p: p.get('distance', 0), reverse=True)
        
        # Return the nearby products
        return create_success_response({
            "products": nearby_products,
            "count": len(nearby_products),
            "center": {
                "latitude": lat,
                "longitude": lon
            },
            "radius": radius
        })
    
    except Exception as e:
        logging.error(f"Error finding nearby products: {str(e)}")
        logging.error(traceback.format_exc())
        return create_error_response(str(e), 500)