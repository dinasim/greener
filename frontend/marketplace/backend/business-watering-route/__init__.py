# business-watering-route/__init__.py
import logging
import json
import azure.functions as func
from azure.cosmos import CosmosClient
import os
import math
from datetime import datetime

# Database connection
MARKETPLACE_CONNECTION_STRING = os.environ.get("COSMOSDB__MARKETPLACE_CONNECTION_STRING")
MARKETPLACE_DATABASE_NAME = os.environ.get("COSMOSDB_MARKETPLACE_DATABASE_NAME", "greener-marketplace-db")

def add_cors_headers(response):
    response.headers.update({
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Email'
    })
    return response

def calculate_distance(lat1, lon1, lat2, lon2):
    """Calculate distance between two points using Haversine formula"""
    R = 6371  # Earth's radius in kilometers
    
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    
    a = (math.sin(dlat/2) * math.sin(dlat/2) + 
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * 
         math.sin(dlon/2) * math.sin(dlon/2))
    
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    distance = R * c
    
    return distance

def optimize_watering_route(plants_needing_water):
    """Simple nearest neighbor algorithm for route optimization"""
    if not plants_needing_water:
        return []
    
    # Start with the first plant
    unvisited = plants_needing_water[1:]
    route = [plants_needing_water[0]]
    current_location = plants_needing_water[0]
    
    while unvisited:
        # Find nearest unvisited plant
        nearest = None
        min_distance = float('inf')
        
        current_coords = current_location.get('location', {}).get('gpsCoordinates', {})
        if not current_coords.get('latitude') or not current_coords.get('longitude'):
            # If no GPS coordinates, just add next plant
            nearest = unvisited[0]
        else:
            for plant in unvisited:
                plant_coords = plant.get('location', {}).get('gpsCoordinates', {})
                if plant_coords.get('latitude') and plant_coords.get('longitude'):
                    distance = calculate_distance(
                        current_coords['latitude'], current_coords['longitude'],
                        plant_coords['latitude'], plant_coords['longitude']
                    )
                    if distance < min_distance:
                        min_distance = distance
                        nearest = plant
            
            # If no plant has coordinates, just take the first one
            if nearest is None:
                nearest = unvisited[0]
        
        route.append(nearest)
        unvisited.remove(nearest)
        current_location = nearest
    
    return route

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Watering route optimization function processed a request')
    
    if req.method == 'OPTIONS':
        response = func.HttpResponse("", status_code=200)
        return add_cors_headers(response)
    
    try:
        business_id = req.params.get('businessId') or req.headers.get('X-User-Email')
        
        if not business_id:
            return func.HttpResponse(
                json.dumps({"error": "Business ID is required"}),
                status_code=400,
                headers={"Content-Type": "application/json"}
            )
        
        # Connect to database
        params = dict(param.split('=', 1) for param in MARKETPLACE_CONNECTION_STRING.split(';'))
        client = CosmosClient(params['AccountEndpoint'], credential=params['AccountKey'])
        database = client.get_database_client(MARKETPLACE_DATABASE_NAME)
        inventory_container = database.get_container_client("inventory")
        
        # Get plants that need watering
        query = """
        SELECT c.id, c.common_name, c.scientific_name, c.location, c.wateringSchedule
        FROM c 
        WHERE c.businessId = @businessId 
        AND c.productType = 'plant'
        AND c.status = 'active'
        AND c.quantity > 0
        """
        
        plants = list(inventory_container.query_items(
            query=query,
            parameters=[{"name": "@businessId", "value": business_id}],
            enable_cross_partition_query=True
        ))
        
        # Filter plants that need watering
        plants_needing_water = []
        for plant in plants:
            watering_schedule = plant.get('wateringSchedule', {})
            needs_watering = watering_schedule.get('needsWatering', False) or watering_schedule.get('activeWaterDays', 0) <= 0
            
            if needs_watering:
                plants_needing_water.append({
                    'id': plant['id'],
                    'name': plant.get('common_name', 'Unknown Plant'),
                    'scientificName': plant.get('scientific_name', ''),
                    'location': plant.get('location', {}),
                    'wateringSchedule': watering_schedule,
                    'priority': 'high' if watering_schedule.get('activeWaterDays', 0) < 0 else 'normal',
                    'overdueDays': max(0, -watering_schedule.get('activeWaterDays', 0))
                })
        
        if not plants_needing_water:
            return func.HttpResponse(
                json.dumps({
                    'route': [],
                    'totalPlants': 0,
                    'estimatedTime': 0,
                    'totalDistance': 0,
                    'message': 'No plants need watering at this time'
                }),
                status_code=200,
                headers={"Content-Type": "application/json"}
            )
        
        # Optimize route
        optimized_route = optimize_watering_route(plants_needing_water)
        
        # Calculate total distance and estimated time
        total_distance = 0
        for i in range(len(optimized_route) - 1):
            current_coords = optimized_route[i].get('location', {}).get('gpsCoordinates', {})
            next_coords = optimized_route[i + 1].get('location', {}).get('gpsCoordinates', {})
            
            if (current_coords.get('latitude') and current_coords.get('longitude') and
                next_coords.get('latitude') and next_coords.get('longitude')):
                distance = calculate_distance(
                    current_coords['latitude'], current_coords['longitude'],
                    next_coords['latitude'], next_coords['longitude']
                )
                total_distance += distance
        
        # Estimate time: 2 minutes per plant + 3 minutes per km walking
        estimated_time = len(optimized_route) * 2 + total_distance * 3
        
        route_data = {
            'route': optimized_route,
            'totalPlants': len(optimized_route),
            'estimatedTime': round(estimated_time),  # in minutes
            'totalDistance': round(total_distance * 1000),  # in meters
            'optimizationMethod': 'nearest_neighbor',
            'generatedAt': datetime.utcnow().isoformat()
        }
        
        response = func.HttpResponse(
            json.dumps(route_data),
            status_code=200,
            headers={"Content-Type": "application/json"}
        )
        return add_cors_headers(response)
        
    except Exception as e:
        logging.error(f'Watering route optimization error: {str(e)}')
        return func.HttpResponse(
            json.dumps({"error": str(e)}),
            status_code=500,
            headers={"Content-Type": "application/json"}
        )