# Backend: Fix for nearby-products/__init__.py

import logging
import json
import azure.functions as func
import math
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
        
        # Validate coordinates
        if not lat or not lon:
            return create_error_response("Latitude and longitude are required", 400)
        
        try:
            lat = float(lat)
            lon = float(lon)
            radius = float(radius)
        except ValueError:
            return create_error_response("Invalid coordinate or radius format", 400)
        
        # Access the marketplace-plants container
        container = get_container("marketplace-plants")
        
        # Get all products with active status
        query = "SELECT * FROM c WHERE c.status = 'active' OR NOT IS_DEFINED(c.status)"
        
        # Add category filter if provided
        if category and category.lower() != 'all':
            query += " AND c.category = @category"
            parameters = [{"name": "@category", "value": category.lower()}]
        else:
            parameters = []
        
        products = list(container.query_items(
            query=query,
            parameters=parameters,
            enable_cross_partition_query=True
        ))
        
        # Filter products by distance if they have location data
        nearby_products = []
        
        for product in products:
            # Skip products without proper location data
            if 'location' not in product or not product['location']:
                continue
                
            location = product['location']
            
            # Extract coordinates, handling different possible formats
            product_lat = None
            product_lon = None
            
            if isinstance(location, dict):
                product_lat = location.get('latitude')
                product_lon = location.get('longitude')
                
                # Alternative property names
                if product_lat is None:
                    product_lat = location.get('lat')
                if product_lon is None:
                    product_lon = location.get('lon')
                if product_lon is None:
                    product_lon = location.get('lng')
            
            # Skip if coordinates are missing
            if product_lat is None or product_lon is None:
                continue
                
            try:
                product_lat = float(product_lat)
                product_lon = float(product_lon)
            except (ValueError, TypeError):
                continue
            
            # Calculate distance using Haversine formula
            distance = calculate_distance(lat, lon, product_lat, product_lon)
            
            # Include product if within radius
            if distance <= radius:
                # Add distance to product
                product['distance'] = round(distance, 2)
                nearby_products.append(product)
        
        # Sort by distance
        nearby_products.sort(key=lambda p: p.get('distance', float('inf')))
        
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
        return create_error_response(str(e), 500)