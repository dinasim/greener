# optimize_watering_route/__init__.py
import logging
import azure.functions as func
import json
import os
import math
import itertools
from azure.cosmos import CosmosClient

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Optimize Watering Route API triggered.')
    
    # Get business ID
    business_id = req.params.get('businessId')
    
    if not business_id:
        return func.HttpResponse(
            json.dumps({"error": "Business ID is required"}),
            status_code=400,
            mimetype="application/json"
        )
    
    # Initialize Cosmos client
    try:
        endpoint = os.environ["COSMOSDB__MARKETPLACE_CONNECTION_STRING"]
        key = os.environ["COSMOSDB_KEY"]
        database_id = os.environ["COSMOSDB_MARKETPLACE_DATABASE_NAME"]
        container_id = "inventory"
        
        client = CosmosClient(endpoint, key)
        database = client.get_database_client(database_id)
        container = database.get_container_client(container_id)
        
        # Get all plants that need watering with location info
        query = """
            SELECT c.id, c.name, c.common_name, c.location, c.wateringSchedule.needsWatering
            FROM c 
            WHERE c.businessId = @businessId 
            AND c.productType = 'plant' 
            AND c.wateringSchedule.needsWatering = true
            AND IS_DEFINED(c.location)
        """
        
        plants = list(container.query_items(
            query=query,
            parameters=[{"name": "@businessId", "value": business_id}],
            enable_cross_partition_query=True
        ))
        
        if not plants:
            return func.HttpResponse(
                json.dumps({
                    "route": [],
                    "message": "No plants with location data need watering"
                }),
                status_code=200,
                mimetype="application/json"
            )
        
        # Check if we have GPS coordinates or section/aisle info
        route_type = None
        for plant in plants:
            if 'location' in plant:
                if 'gpsCoordinates' in plant['location'] and plant['location']['gpsCoordinates']:
                    route_type = "gps"
                    break
                elif 'section' in plant['location'] or 'aisle' in plant['location']:
                    route_type = "location"
                    break
        
        # Calculate optimal route
        if route_type == "gps":
            optimized_route = optimize_gps_route(plants)
        else:
            optimized_route = optimize_location_route(plants)
        
        return func.HttpResponse(
            json.dumps({
                "route": optimized_route,
                "routeType": route_type,
                "totalPlants": len(optimized_route),
                "estimatedTime": estimate_watering_time(len(optimized_route))
            }),
            status_code=200,
            mimetype="application/json"
        )
    
    except Exception as e:
        logging.error(f"Error optimizing watering route: {str(e)}")
        return func.HttpResponse(
            json.dumps({"error": f"Internal server error: {str(e)}"}),
            status_code=500,
            mimetype="application/json"
        )

def optimize_gps_route(plants):
    """Optimize route using GPS coordinates with nearest neighbor algorithm"""
    # Extract plants with valid GPS coordinates
    valid_plants = []
    for plant in plants:
        if ('location' in plant and 
            'gpsCoordinates' in plant['location'] and 
            plant['location']['gpsCoordinates'] and
            'latitude' in plant['location']['gpsCoordinates'] and
            'longitude' in plant['location']['gpsCoordinates']):
            valid_plants.append(plant)
    
    if not valid_plants:
        return []
    
    # Start with the first plant
    current_plant = valid_plants[0]
    route = [format_plant_for_route(current_plant)]
    remaining_plants = valid_plants[1:]
    
    # Nearest neighbor algorithm
    while remaining_plants:
        current_coords = current_plant['location']['gpsCoordinates']
        
        # Find the nearest plant
        nearest_idx = 0
        nearest_distance = float('inf')
        
        for i, plant in enumerate(remaining_plants):
            plant_coords = plant['location']['gpsCoordinates']
            distance = calculate_distance(
                current_coords['latitude'], 
                current_coords['longitude'],
                plant_coords['latitude'], 
                plant_coords['longitude']
            )
            
            if distance < nearest_distance:
                nearest_distance = distance
                nearest_idx = i
        
        # Add the nearest plant to route
        current_plant = remaining_plants.pop(nearest_idx)
        route.append(format_plant_for_route(current_plant))
    
    return route

def optimize_location_route(plants):
    """Optimize route by section and aisle"""
    # Sort plants by section, then aisle, then shelf
    sorted_plants = sorted(
        plants,
        key=lambda p: (
            p.get('location', {}).get('section', '999'),
            p.get('location', {}).get('aisle', '999'),
            p.get('location', {}).get('shelfNumber', '999')
        )
    )
    
    return [format_plant_for_route(plant) for plant in sorted_plants]

def format_plant_for_route(plant):
    """Format plant data for route response"""
    return {
        "id": plant['id'],
        "name": plant.get('name') or plant.get('common_name') or f"Plant {plant['id']}",
        "location": plant.get('location', {}),
        "needsWatering": plant.get('wateringSchedule', {}).get('needsWatering', True)
    }

def calculate_distance(lat1, lon1, lat2, lon2):
    """Calculate distance between two GPS coordinates using Haversine formula"""
    # Convert latitude and longitude from degrees to radians
    lat1_rad = math.radians(lat1)
    lon1_rad = math.radians(lon1)
    lat2_rad = math.radians(lat2)
    lon2_rad = math.radians(lon2)
    
    # Haversine formula
    dlon = lon2_rad - lon1_rad
    dlat = lat2_rad - lat1_rad
    a = math.sin(dlat/2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(dlon/2)**2
    c = 2 * math.asin(math.sqrt(a))
    r = 6371  # Radius of earth in kilometers
    
    return c * r

def estimate_watering_time(num_plants):
    """Estimate watering time for number of plants"""
    # Assume 2 minutes per plant plus 30 seconds travel time between plants
    minutes = num_plants * 2 + (num_plants - 1) * 0.5
    return {
        "minutes": round(minutes),
        "formatted": f"{int(minutes // 60)}h {int(minutes % 60)}min"
    }