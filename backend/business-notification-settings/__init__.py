# business-notification-settings/__init__.py
import logging
import json
import azure.functions as func
from azure.cosmos import CosmosClient, exceptions
import os
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

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Notification settings function processed a request')
    
    if req.method == 'OPTIONS':
        response = func.HttpResponse("", status_code=200)
        return add_cors_headers(response)
    
    try:
        business_id = req.headers.get('X-User-Email')
        
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
        
        # Create watering_notifications container if it doesn't exist
        try:
            notifications_container = database.get_container_client("watering_notifications")
        except:
            notifications_container = database.create_container(
                id="watering_notifications",
                partition_key="/businessId"
            )
        
        if req.method == 'GET':
            # Get notification settings
            try:
                settings_item = notifications_container.read_item(
                    item=f"settings_{business_id}", 
                    partition_key=business_id
                )
            except exceptions.CosmosResourceNotFoundError:
                # Return default settings
                settings_item = {
                    'id': f"settings_{business_id}",
                    'businessId': business_id,
                    'notificationTime': '07:00',
                    'enabled': True,
                    'deviceTokens': [],
                    'createdAt': datetime.utcnow().isoformat()
                }
            
            response = func.HttpResponse(
                json.dumps(settings_item),
                status_code=200,
                headers={"Content-Type": "application/json"}
            )
            return add_cors_headers(response)
            
        elif req.method == 'PUT':
            # Update notification settings
            request_body = req.get_json()
            
            if not request_body:
                return func.HttpResponse(
                    json.dumps({"error": "Request body is required"}),
                    status_code=400,
                    headers={"Content-Type": "application/json"}
                )
            
            settings_id = f"settings_{business_id}"
            
            try:
                # Get existing settings
                settings_item = notifications_container.read_item(
                    item=settings_id, 
                    partition_key=business_id
                )
            except exceptions.CosmosResourceNotFoundError:
                # Create new settings
                settings_item = {
                    'id': settings_id,
                    'businessId': business_id,
                    'deviceTokens': [],
                    'createdAt': datetime.utcnow().isoformat()
                }
            
            # Update settings
            if 'notificationTime' in request_body:
                settings_item['notificationTime'] = request_body['notificationTime']
            
            if 'enabled' in request_body:
                settings_item['enabled'] = request_body['enabled']
            
            if 'deviceToken' in request_body:
                device_token = request_body['deviceToken']
                if device_token and device_token not in settings_item.get('deviceTokens', []):
                    if 'deviceTokens' not in settings_item:
                        settings_item['deviceTokens'] = []
                    settings_item['deviceTokens'].append(device_token)
            
            settings_item['updatedAt'] = datetime.utcnow().isoformat()
            
            # Save to database
            notifications_container.upsert_item(settings_item)
            
            response = func.HttpResponse(
                json.dumps({
                    'success': True,
                    'settings': settings_item
                }),
                status_code=200,
                headers={"Content-Type": "application/json"}
            )
            return add_cors_headers(response)
        
    except Exception as e:
        logging.error(f'Notification settings error: {str(e)}')
        return func.HttpResponse(
            json.dumps({"error": str(e)}),
            status_code=500,
            headers={"Content-Type": "application/json"}
        )