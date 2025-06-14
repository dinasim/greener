# watering_checklist/__init__.py - FIXED VERSION (Barcode Removed)
import logging
import azure.functions as func
import json
import datetime
import os
from azure.cosmos import CosmosClient

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Watering Checklist API triggered.')
    
    # Get business ID
    business_id = req.params.get('businessId')
    if not business_id:
        try:
            req_body = req.get_json()
            business_id = req_body.get('businessId')
        except ValueError:
            pass
    
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
        
        # Handle different operations
        if req.method == "GET":
            return get_watering_checklist(container, business_id)
        elif req.method == "POST":
            return mark_plant_as_watered(container, req, business_id)
        else:
            return func.HttpResponse(
                json.dumps({"error": "Method not allowed"}),
                status_code=405,
                mimetype="application/json"
            )
    
    except Exception as e:
        logging.error(f"Error in watering checklist API: {str(e)}")
        return func.HttpResponse(
            json.dumps({"error": f"Internal server error: {str(e)}"}),
            status_code=500,
            mimetype="application/json"
        )

def get_watering_checklist(container, business_id):
    """Get list of plants that need watering (FIXED: Removed barcode functionality)"""
    try:
        # Get all plants that need watering or are close to needing it
        query = """
            SELECT * FROM c 
            WHERE c.businessId = @businessId 
            AND c.productType = 'plant' 
            AND c.status = 'active'
            AND (c.wateringSchedule.needsWatering = true OR c.wateringSchedule.activeWaterDays <= 1)
        """
        
        plants = list(container.query_items(
            query=query,
            parameters=[{"name": "@businessId", "value": business_id}],
            enable_cross_partition_query=True
        ))
        
        # Sort plants by priority (needsWatering first, then by activeWaterDays)
        plants.sort(key=lambda p: (
            0 if p.get('wateringSchedule', {}).get('needsWatering', False) else 1,
            p.get('wateringSchedule', {}).get('activeWaterDays', 999)
        ))
        
        # Map to a more frontend-friendly format (FIXED: Removed barcode field)
        checklist = [{
            "id": plant['id'],
            "name": plant.get('name') or plant.get('common_name'),
            "scientificName": plant.get('scientificName') or plant.get('scientific_name'),
            "needsWatering": plant.get('wateringSchedule', {}).get('needsWatering', False),
            "daysRemaining": plant.get('wateringSchedule', {}).get('activeWaterDays', 0),
            "location": plant.get('location', {}),
            "waterDays": plant.get('wateringSchedule', {}).get('waterDays', plant.get('water_days', 7)),
            "plantIdentifier": f"PLT-{plant['id'][:8]}",  # FIXED: Simple identifier instead of barcode
            "lastWatered": plant.get('wateringSchedule', {}).get('lastWatered'),
            "quantity": plant.get('quantity', 1),
            "image": plant.get('mainImage') or (plant.get('images', [None])[0] if plant.get('images') else None),
            "priority": "high" if plant.get('wateringSchedule', {}).get('activeWaterDays', 0) <= 0 else "normal"
        } for plant in plants]
        
        return func.HttpResponse(
            json.dumps({
                "checklist": checklist,
                "totalCount": len(checklist),
                "needsWateringCount": sum(1 for p in checklist if p["needsWatering"]),
                "timestamp": datetime.datetime.utcnow().isoformat()
            }),
            status_code=200,
            mimetype="application/json"
        )
    
    except Exception as e:
        logging.error(f"Error getting watering checklist: {str(e)}")
        raise

def mark_plant_as_watered(container, req, business_id):
    """Mark a plant as watered (FIXED: Removed barcode method validation)"""
    try:
        # Get request body
        req_body = req.get_json()
        
        if not req_body:
            return func.HttpResponse(
                json.dumps({"error": "Request body is required"}),
                status_code=400,
                mimetype="application/json"
            )
        
        plant_id = req_body.get('plantId')
        method = req_body.get('method', 'manual')
        coordinates = req_body.get('coordinates')
        
        if not plant_id:
            return func.HttpResponse(
                json.dumps({"error": "Plant ID is required"}),
                status_code=400,
                mimetype="application/json"
            )
        
        # FIXED: Validate method (removed barcode validation)
        if method not in ['manual', 'gps']:
            return func.HttpResponse(
                json.dumps({"error": "Invalid watering method. Use 'manual' or 'gps'."}),
                status_code=400,
                mimetype="application/json"
            )
        
        # Get the plant
        try:
            plant = container.read_item(item=plant_id, partition_key=business_id)
        except Exception as e:
            return func.HttpResponse(
                json.dumps({"error": f"Plant not found: {str(e)}"}),
                status_code=404,
                mimetype="application/json"
            )
        
        # Update watering schedule
        now = datetime.datetime.utcnow().isoformat()
        today = datetime.datetime.utcnow().strftime("%Y-%m-%d")
        
        if 'wateringSchedule' not in plant:
            water_days = plant.get('water_days', 7)
            plant['wateringSchedule'] = {
                "waterDays": water_days,
                "activeWaterDays": water_days,
                "lastWatered": None,
                "lastWateringUpdate": today,
                "needsWatering": False,
                "weatherAffected": False
            }
        
        plant['wateringSchedule']['lastWatered'] = today
        plant['wateringSchedule']['activeWaterDays'] = plant['wateringSchedule'].get('waterDays', 7)
        plant['wateringSchedule']['needsWatering'] = False
        plant['wateringSchedule']['wateredBy'] = method
        plant['wateringSchedule']['wateredAt'] = now
        
        if coordinates:
            plant['wateringSchedule']['coordinates'] = coordinates
        
        # Update the plant
        container.upsert_item(plant)
        
        return func.HttpResponse(
            json.dumps({
                "success": True,
                "plant": {
                    "id": plant['id'],
                    "name": plant.get('name') or plant.get('common_name'),
                    "lastWatered": today,
                    "nextWateringDue": (datetime.datetime.strptime(today, "%Y-%m-%d") + 
                                        datetime.timedelta(days=plant['wateringSchedule']['waterDays'])).strftime("%Y-%m-%d"),
                    "method": method
                }
            }),
            status_code=200,
            mimetype="application/json"
        )
    
    except Exception as e:
        logging.error(f"Error marking plant as watered: {str(e)}")
        raise