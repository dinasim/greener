# business-watering-checklist/__init__.py - FIXED VERSION (Barcode Removed)
import logging
import json
import azure.functions as func
from azure.cosmos import CosmosClient, exceptions
import os
from datetime import datetime, timedelta

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

def get_watering_checklist(business_id):
    """Get plants that need watering for a business - UPDATED: Removed barcode fields"""
    try:
        params = dict(param.split('=', 1) for param in MARKETPLACE_CONNECTION_STRING.split(';'))
        client = CosmosClient(params['AccountEndpoint'], credential=params['AccountKey'])
        database = client.get_database_client(MARKETPLACE_DATABASE_NAME)
        inventory_container = database.get_container_client("inventory")
        
        # Query plants that need watering
        query = """
        SELECT c.id, c.common_name, c.scientific_name, c.quantity, c.location,
               c.wateringSchedule, c.plantInfo.water_days, c.addedAt, c.mainImage, c.images
        FROM c 
        WHERE c.businessId = @businessId 
        AND c.productType = 'plant'
        AND c.status = 'active'
        AND c.quantity > 0
        ORDER BY c.addedAt DESC
        """
        
        items = list(inventory_container.query_items(
            query=query,
            parameters=[{"name": "@businessId", "value": business_id}],
            enable_cross_partition_query=True
        ))
        
        # Process watering schedule for each plant
        current_date = datetime.utcnow()
        checklist = []
        needs_watering_count = 0
        
        for item in items:
            watering_schedule = item.get('wateringSchedule', {})
            water_days = item.get('plantInfo', {}).get('water_days', 7)
            
            # Initialize watering schedule if not exists
            if not watering_schedule:
                watering_schedule = {
                    'waterDays': water_days,
                    'activeWaterDays': water_days,
                    'lastWatered': None,
                    'needsWatering': True,
                    'lastWateringUpdate': current_date.strftime('%Y-%m-%d')
                }
            
            # Calculate if plant needs watering
            needs_watering = watering_schedule.get('activeWaterDays', water_days) <= 0
            
            # Get plant image
            plant_image = item.get('mainImage')
            if not plant_image and item.get('images'):
                plant_image = item['images'][0] if len(item['images']) > 0 else None
            
            plant_item = {
                'id': item['id'],
                'name': item.get('common_name', 'Unknown Plant'),
                'scientificName': item.get('scientific_name', ''),
                'quantity': item.get('quantity', 0),
                'location': item.get('location', {}),
                'waterDays': water_days,
                'activeWaterDays': watering_schedule.get('activeWaterDays', water_days),
                'lastWatered': watering_schedule.get('lastWatered'),
                'needsWatering': needs_watering,
                'priority': 'high' if watering_schedule.get('activeWaterDays', water_days) < 0 else 'normal',
                'overdueDays': max(0, -watering_schedule.get('activeWaterDays', 0)) if needs_watering else 0,
                'image': plant_image,
                # REMOVED: barcode field - no longer needed
                'plantId': f"PLT-{item['id'][:8]}"  # Simple plant identifier instead of barcode
            }
            
            checklist.append(plant_item)
            
            if needs_watering:
                needs_watering_count += 1
        
        return {
            'checklist': checklist,
            'totalCount': len(checklist),
            'needsWateringCount': needs_watering_count,
            'timestamp': current_date.isoformat()
        }
        
    except Exception as e:
        logging.error(f'Error getting watering checklist: {str(e)}')
        raise

def mark_plant_watered(business_id, plant_id, method='manual', coordinates=None):
    """Mark a plant as watered and reset its watering schedule - UPDATED: Removed barcode method"""
    try:
        params = dict(param.split('=', 1) for param in MARKETPLACE_CONNECTION_STRING.split(';'))
        client = CosmosClient(params['AccountEndpoint'], credential=params['AccountKey'])
        database = client.get_database_client(MARKETPLACE_DATABASE_NAME)
        inventory_container = database.get_container_client("inventory")
        
        # Get the plant item
        plant_item = inventory_container.read_item(item=plant_id, partition_key=business_id)
        
        if not plant_item:
            raise Exception("Plant not found")
        
        # Validate method (removed 'barcode' option)
        valid_methods = ['manual', 'gps']
        if method not in valid_methods:
            logging.warning(f'Invalid watering method: {method}, defaulting to manual')
            method = 'manual'
        
        # Update watering schedule
        current_date = datetime.utcnow()
        water_days = plant_item.get('plantInfo', {}).get('water_days', 7)
        
        watering_schedule = plant_item.get('wateringSchedule', {})
        watering_schedule.update({
            'waterDays': water_days,
            'activeWaterDays': water_days,  # Reset to full cycle
            'lastWatered': current_date.strftime('%Y-%m-%d'),
            'lastWateringUpdate': current_date.strftime('%Y-%m-%d'),
            'needsWatering': False,
            'wateredBy': method,
            'wateredAt': current_date.isoformat(),
            **({'coordinates': coordinates} if coordinates else {})
        })
        
        plant_item['wateringSchedule'] = watering_schedule
        plant_item['lastUpdated'] = current_date.isoformat()
        
        # Update in database
        inventory_container.replace_item(item=plant_id, body=plant_item)
        
        return {
            'success': True,
            'plantId': plant_id,
            'wateredAt': current_date.isoformat(),
            'method': method,
            'nextWateringDue': (current_date + timedelta(days=water_days)).strftime('%Y-%m-%d')
        }
        
    except Exception as e:
        logging.error(f'Error marking plant as watered: {str(e)}')
        raise

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Watering checklist function processed a request')
    
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
        
        if req.method == 'GET':
            # Get watering checklist
            checklist_data = get_watering_checklist(business_id)
            
            response = func.HttpResponse(
                json.dumps(checklist_data),
                status_code=200,
                headers={"Content-Type": "application/json"}
            )
            return add_cors_headers(response)
            
        elif req.method == 'POST':
            # Mark plant as watered
            request_body = req.get_json()
            
            if not request_body or 'plantId' not in request_body:
                return func.HttpResponse(
                    json.dumps({"error": "Plant ID is required"}),
                    status_code=400,
                    headers={"Content-Type": "application/json"}
                )
            
            plant_id = request_body['plantId']
            method = request_body.get('method', 'manual')
            coordinates = request_body.get('coordinates')
            
            # Validate method
            if method not in ['manual', 'gps']:
                return func.HttpResponse(
                    json.dumps({"error": "Invalid method. Use 'manual' or 'gps'"}),
                    status_code=400,
                    headers={"Content-Type": "application/json"}
                )
            
            result = mark_plant_watered(business_id, plant_id, method, coordinates)
            
            response = func.HttpResponse(
                json.dumps(result),
                status_code=200,
                headers={"Content-Type": "application/json"}
            )
            return add_cors_headers(response)
        
    except Exception as e:
        logging.error(f'Watering checklist error: {str(e)}')
        return func.HttpResponse(
            json.dumps({"error": str(e)}),
            status_code=500,
            headers={"Content-Type": "application/json"}
        )