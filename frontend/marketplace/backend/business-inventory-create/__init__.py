# backend/business-inventory-create/__init__.py - FIXED TO CREATE CORRECT DATA
import logging
import json
import uuid
from datetime import datetime, timezone
import azure.functions as func
from azure.cosmos import CosmosClient
import os

# Database connection details for marketplace
MARKETPLACE_CONNECTION_STRING = os.environ.get("COSMOSDB__MARKETPLACE_CONNECTION_STRING")
MARKETPLACE_DATABASE_NAME = os.environ.get("COSMOSDB_MARKETPLACE_DATABASE_NAME", "greener-marketplace-db")

def add_cors_headers(response):
    """Add CORS headers to response"""
    response.headers.update({
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Email'
    })
    return response

def create_proper_watering_schedule(water_days):
    """Create complete watering schedule from the start - NO FIXING NEEDED"""
    current_time = datetime.now(timezone.utc)
    
    return {
        'waterDays': water_days,
        'activeWaterDays': water_days,  # Start with full cycle
        'lastWateringUpdate': current_time.strftime('%Y-%m-%d'),
        'needsWatering': False,  # New plants don't need immediate watering
        'weatherAffected': False,
        'lastWatered': None,
        'wateredBy': None,
        'wateredAt': None,
        'createdAt': current_time.isoformat(),
        'updatedAt': current_time.isoformat()
    }

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Business inventory create function processed a request.')
    
    # Handle OPTIONS method for CORS preflight
    if req.method == 'OPTIONS':
        response = func.HttpResponse("", status_code=200)
        return add_cors_headers(response)
    
    try:
        # Get user ID from request
        business_id = req.headers.get('X-User-Email')
        if not business_id:
            try:
                body = req.get_json()
                business_id = body.get('businessId') or body.get('userId')
            except:
                pass
        
        if not business_id:
            response = func.HttpResponse(
                json.dumps({"error": "Business ID is required. Please provide X-User-Email header."}),
                status_code=400,
                headers={"Content-Type": "application/json"}
            )
            return add_cors_headers(response)
        
        # Parse request body
        try:
            request_body = req.get_json()
        except ValueError:
            response = func.HttpResponse(
                json.dumps({"error": "Invalid JSON body"}),
                status_code=400,
                headers={"Content-Type": "application/json"}
            )
            return add_cors_headers(response)
        
        if not request_body:
            response = func.HttpResponse(
                json.dumps({"error": "Request body is required"}),
                status_code=400,
                headers={"Content-Type": "application/json"}
            )
            return add_cors_headers(response)
        
        # Connect to marketplace database
        try:
            params = dict(param.split('=', 1) for param in MARKETPLACE_CONNECTION_STRING.split(';'))
            account_endpoint = params.get('AccountEndpoint')
            account_key = params.get('AccountKey')
            
            if not account_endpoint or not account_key:
                raise ValueError("Invalid marketplace connection string")
            
            client = CosmosClient(account_endpoint, credential=account_key)
            database = client.get_database_client(MARKETPLACE_DATABASE_NAME)
            inventory_container = database.get_container_client("inventory")
            
        except Exception as e:
            logging.error(f"Database connection error: {str(e)}")
            response = func.HttpResponse(
                json.dumps({"error": "Database connection failed"}),
                status_code=500,
                headers={"Content-Type": "application/json"}
            )
            return add_cors_headers(response)
        
        # Extract data from request
        product_type = request_body.get('productType', 'plant')
        quantity = request_body.get('quantity', 1)
        price = request_body.get('price', 0)
        min_threshold = request_body.get('minThreshold', 1)
        discount = request_body.get('discount', 0)
        
        # Generate unique inventory ID
        inventory_id = str(uuid.uuid4())
        current_time = datetime.now(timezone.utc)
        
        if product_type == 'plant':
            # Handle plant creation with PROPER watering schedule
            plant_data = request_body.get('plantData', {})
            
            if not plant_data:
                response = func.HttpResponse(
                    json.dumps({"error": "Plant data is required for plant products"}),
                    status_code=400,
                    headers={"Content-Type": "application/json"}
                )
                return add_cors_headers(response)
            
            # Get watering days for schedule creation
            water_days = plant_data.get('water_days', 7)
            
            # Create inventory item with COMPLETE watering schedule
            inventory_item = {
                "id": inventory_id,
                "businessId": business_id,
                "productType": "plant",
                "productId": plant_data.get('id', f"plant_{inventory_id}"),
                "name": plant_data.get('common_name', 'Unknown Plant'),
                "common_name": plant_data['common_name'],
                "scientific_name": plant_data.get('scientific_name', ''),
                "plantInfo": {
                    "origin": plant_data.get('origin', ''),
                    "water_days": water_days,
                    "light": plant_data.get('light', 'Bright indirect light'),
                    "humidity": plant_data.get('humidity', 'Average'),
                    "temperature": plant_data.get('temperature', 'Room temperature'),
                    "pets": plant_data.get('pets', 'Unknown'),
                    "difficulty": plant_data.get('difficulty', 5),
                    "repot": plant_data.get('repot', 'Every 2 years'),
                    "feed": plant_data.get('feed', 'Monthly in growing season'),
                    "common_problems": plant_data.get('common_problems', [])
                },
                "quantity": quantity,
                "originalQuantity": quantity,
                "price": price,
                "minThreshold": min_threshold,
                "discount": discount,
                "finalPrice": round(price * (1 - discount / 100), 2),
                "status": "active",
                "notes": request_body.get('notes', ''),
                "location": request_body.get('location', {}),
                "addedAt": current_time.isoformat(),
                "lastUpdated": current_time.isoformat(),
                "soldCount": 0,
                "viewCount": 0,
                # ✅ CREATE PROPER WATERING SCHEDULE FROM START - NO FIXING NEEDED
                "wateringSchedule": create_proper_watering_schedule(water_days)
            }
            
        elif product_type in ['tool', 'accessory', 'supply']:
            # Create tool/accessory/supply item (no watering schedule needed)
            inventory_item = {
                "id": inventory_id,
                "businessId": business_id,
                "productType": product_type,
                "productId": request_body.get('productId', f"{product_type}_{inventory_id}"),
                "name": request_body.get('name', f'Unknown {product_type.title()}'),
                "description": request_body.get('description', ''),
                "brand": request_body.get('brand', ''),
                "model": request_body.get('model', ''),
                "quantity": quantity,
                "originalQuantity": quantity,
                "price": price,
                "minThreshold": min_threshold,
                "discount": discount,
                "finalPrice": round(price * (1 - discount / 100), 2),
                "status": "active",
                "notes": request_body.get('notes', ''),
                "location": request_body.get('location', {}),
                "addedAt": current_time.isoformat(),
                "lastUpdated": current_time.isoformat(),
                "soldCount": 0,
                "viewCount": 0
            }
        else:
            response = func.HttpResponse(
                json.dumps({"error": f"Unsupported product type: {product_type}"}),
                status_code=400,
                headers={"Content-Type": "application/json"}
            )
            return add_cors_headers(response)
        
        # Save to database
        try:
            inventory_container.create_item(inventory_item)
            logging.info(f"✅ Created inventory item {inventory_id} with proper watering schedule")
            
            response_data = {
                "success": True,
                "inventoryId": inventory_id,
                "message": f"{product_type.title()} added to inventory successfully",
                "item": inventory_item
            }
            
            response = func.HttpResponse(
                json.dumps(response_data),
                status_code=201,
                headers={"Content-Type": "application/json"}
            )
            return add_cors_headers(response)
            
        except Exception as e:
            logging.error(f"Error creating inventory item: {str(e)}")
            response = func.HttpResponse(
                json.dumps({"error": "Failed to create inventory item"}),
                status_code=500,
                headers={"Content-Type": "application/json"}
            )
            return add_cors_headers(response)
        
    except Exception as e:
        logging.error(f'Inventory creation error: {str(e)}')
        response = func.HttpResponse(
            json.dumps({"error": str(e)}),
            status_code=500,
            headers={"Content-Type": "application/json"}
        )
        return add_cors_headers(response)