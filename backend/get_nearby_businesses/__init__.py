# get_nearby_businesses/__init__.py
import json
import logging
import azure.functions as func
from azure.cosmos import CosmosClient
import os
import math
from datetime import datetime

# Initialize Cosmos client
COSMOS_CONNECTION_STRING = os.environ.get('COSMOSDB__MARKETPLACE_CONNECTION_STRING')
DATABASE_NAME = os.environ.get('COSMOSDB_MARKETPLACE_DATABASE_NAME', 'greener-marketplace-db')

cosmos_client = CosmosClient.from_connection_string(COSMOS_CONNECTION_STRING)
database = cosmos_client.get_database_client(DATABASE_NAME)

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Getting nearby businesses')
    
    try:
        # Get query parameters
        lat = req.params.get('lat')
        lon = req.params.get('lon')
        radius = req.params.get('radius', '10')  # Default 10km
        business_type = req.params.get('businessType')
        
        # Validate required parameters
        if not lat or not lon:
            return func.HttpResponse(
                json.dumps({"error": "Latitude and longitude are required"}),
                status_code=400,
                headers={"Content-Type": "application/json"}
            )
        
        try:
            latitude = float(lat)
            longitude = float(lon)
            search_radius = float(radius)
        except ValueError:
            return func.HttpResponse(
                json.dumps({"error": "Invalid coordinates or radius"}),
                status_code=400,
                headers={"Content-Type": "application/json"}
            )
        
        # Get business users container
        business_container = database.get_container_client('business_users')
        
        # Build query to get businesses with addresses
        query = """
        SELECT * FROM c 
        WHERE c.address.latitude != null 
        AND c.address.longitude != null 
        AND c.status = 'active'
        """
        
        query_params = []
        
        # Add business type filter if specified
        if business_type and business_type.lower() != 'all':
            query += " AND c.businessType = @businessType"
            query_params.append({"name": "@businessType", "value": business_type})
        
        # Execute query
        businesses = list(business_container.query_items(
            query=query,
            parameters=query_params,
            enable_cross_partition_query=True
        ))
        
        logging.info(f"Found {len(businesses)} businesses in database")
        
        # Calculate distances and filter by radius
        nearby_businesses = []
        
        for business in businesses:
            try:
                business_lat = float(business['address']['latitude'])
                business_lon = float(business['address']['longitude'])
                
                # Calculate distance using Haversine formula
                distance = calculate_distance(latitude, longitude, business_lat, business_lon)
                
                if distance <= search_radius:
                    # Add distance to business object
                    business['distance'] = round(distance, 2)
                    
                    # Format business for response
                    formatted_business = {
                        'id': business.get('id', business.get('email')),
                        'businessName': business.get('businessName', ''),
                        'name': business.get('businessName', business.get('name', '')),
                        'businessType': business.get('businessType', 'Business'),
                        'description': business.get('description', ''),
                        'logo': business.get('logo', ''),
                        'address': business.get('address', {}),
                        'location': {
                            'latitude': business_lat,
                            'longitude': business_lon,
                            'city': business['address'].get('city', ''),
                            'country': business['address'].get('country', '')
                        },
                        'distance': distance,
                        'rating': business.get('rating', 0),
                        'reviewCount': business.get('reviewCount', 0),
                        'isVerified': business.get('isVerified', False),
                        'contactPhone': business.get('contactPhone', ''),
                        'contactEmail': business.get('contactEmail', ''),
                        'businessHours': business.get('businessHours', []),
                        'joinDate': business.get('joinDate', ''),
                        'isBusiness': True
                    }
                    
                    nearby_businesses.append(formatted_business)
                    
            except (KeyError, ValueError, TypeError) as e:
                logging.warning(f"Skipping business {business.get('id')} due to location error: {str(e)}")
                continue
        
        # Sort by distance
        nearby_businesses.sort(key=lambda x: x['distance'])
        
        logging.info(f"Found {len(nearby_businesses)} businesses within {search_radius}km")
        
        response_data = {
            "businesses": nearby_businesses,
            "count": len(nearby_businesses),
            "center": {
                "latitude": latitude,
                "longitude": longitude
            },
            "radius": search_radius,
            "searchCriteria": {
                "businessType": business_type
            }
        }
        
        return func.HttpResponse(
            json.dumps(response_data),
            status_code=200,
            headers={
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type, Authorization, X-User-Email"
            }
        )
        
    except Exception as e:
        logging.error(f"Error getting nearby businesses: {str(e)}")
        return func.HttpResponse(
            json.dumps({"error": f"Internal server error: {str(e)}"}),
            status_code=500,
            headers={"Content-Type": "application/json"}
        )

def calculate_distance(lat1, lon1, lat2, lon2):
    """Calculate distance between two coordinates using Haversine formula"""
    R = 6371  # Earth's radius in kilometers
    
    lat1_rad = math.radians(lat1)
    lon1_rad = math.radians(lon1)
    lat2_rad = math.radians(lat2)
    lon2_rad = math.radians(lon2)
    
    dlat = lat2_rad - lat1_rad
    dlon = lon2_rad - lon1_rad
    
    a = math.sin(dlat/2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(dlon/2)**2
    c = 2 * math.asin(math.sqrt(a))
    
    return R * c