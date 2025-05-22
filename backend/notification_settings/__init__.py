# notification_settings/__init__.py
import logging
import azure.functions as func
import json
import datetime
import os
import uuid
from azure.cosmos import CosmosClient

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Notification Settings API triggered.')
    
    try:
        # Initialize Cosmos client
        endpoint = os.environ["COSMOSDB__MARKETPLACE_CONNECTION_STRING"]
        key = os.environ["COSMOSDB_KEY"]
        database_id = os.environ["COSMOSDB_MARKETPLACE_DATABASE_NAME"]
        container_id = "watering_notifications"
        
        client = CosmosClient(endpoint, key)
        database = client.get_database_client(database_id)
        container = database.get_container_client(container_id)
        
        # Handle different HTTP methods
        if req.method == "GET":
            return get_notification_settings(container, req)
        elif req.method == "POST":
            return create_or_update_notification_settings(container, req)
        elif req.method == "DELETE":
            return delete_notification_settings(container, req)
        else:
            return func.HttpResponse(
                json.dumps({"error": "Method not allowed"}),
                status_code=405,
                mimetype="application/json"
            )
    
    except Exception as e:
        logging.error(f"Error in notification settings API: {str(e)}")
        return func.HttpResponse(
            json.dumps({"error": f"Internal server error: {str(e)}"}),
            status_code=500,
            mimetype="application/json"
        )

def get_notification_settings(container, req):
    """Get notification settings for a business"""
    try:
        business_id = req.params.get('businessId')
        if not business_id:
            business_id = req.headers.get('X-Business-ID')
        
        if not business_id:
            return func.HttpResponse(
                json.dumps({"error": "Business ID is required"}),
                status_code=400,
                mimetype="application/json"
            )
        
        # Query for notification settings
        query = "SELECT * FROM c WHERE c.businessId = @businessId"
        settings = list(container.query_items(
            query=query,
            parameters=[{"name": "@businessId", "value": business_id}],
            enable_cross_partition_query=True
        ))
        
        # If no settings exist, return default
        if not settings:
            default_setting = {
                "businessId": business_id,
                "notificationTime": "07:00",
                "enableWateringReminders": True,
                "enableLowStockAlerts": True,
                "enableSuccessNotifications": True,
                "status": "active"
            }
            settings = [default_setting]
        
        return func.HttpResponse(
            json.dumps({
                "settings": settings[0] if settings else {},
                "businessId": business_id
            }),
            status_code=200,
            mimetype="application/json"
        )
    
    except Exception as e:
        logging.error(f"Error getting notification settings: {str(e)}")
        raise

def create_or_update_notification_settings(container, req):
    """Create or update notification settings"""
    try:
        req_body = req.get_json()
        
        if not req_body:
            return func.HttpResponse(
                json.dumps({"error": "Request body is required"}),
                status_code=400,
                mimetype="application/json"
            )
        
        business_id = req_body.get('businessId')
        if not business_id:
            business_id = req.headers.get('X-Business-ID')
        
        if not business_id:
            return func.HttpResponse(
                json.dumps({"error": "Business ID is required"}),
                status_code=400,
                mimetype="application/json"
            )
        
        # Check if settings already exist
        existing_query = "SELECT * FROM c WHERE c.businessId = @businessId"
        existing_settings = list(container.query_items(
            query=existing_query,
            parameters=[{"name": "@businessId", "value": business_id}],
            enable_cross_partition_query=True
        ))
        
        # Create or update notification setting document
        setting = {
            "id": existing_settings[0]["id"] if existing_settings else str(uuid.uuid4()),
            "businessId": business_id,
            "notificationTime": req_body.get('notificationTime', '07:00'),
            "enableWateringReminders": req_body.get('enableWateringReminders', True),
            "enableLowStockAlerts": req_body.get('enableLowStockAlerts', True),
            "enableSuccessNotifications": req_body.get('enableSuccessNotifications', True),
            "pollingInterval": req_body.get('pollingInterval', 60),  # seconds
            "status": req_body.get('status', 'active'),
            "updatedAt": datetime.datetime.utcnow().isoformat(),
            "lastNotificationCheck": None
        }
        
        if not existing_settings:
            setting["createdAt"] = datetime.datetime.utcnow().isoformat()
        else:
            setting["createdAt"] = existing_settings[0].get("createdAt", datetime.datetime.utcnow().isoformat())
        
        # Upsert the setting
        container.upsert_item(setting)
        
        return func.HttpResponse(
            json.dumps({
                "success": True,
                "setting": setting,
                "message": "Notification settings saved successfully"
            }),
            status_code=200,
            mimetype="application/json"
        )
    
    except Exception as e:
        logging.error(f"Error creating notification settings: {str(e)}")
        raise

def delete_notification_settings(container, req):
    """Delete notification settings"""
    try:
        setting_id = req.params.get('settingId')
        business_id = req.headers.get('X-Business-ID')
        
        if not setting_id or not business_id:
            return func.HttpResponse(
                json.dumps({"error": "Setting ID and Business ID are required"}),
                status_code=400,
                mimetype="application/json"
            )
        
        # Delete the setting
        container.delete_item(item=setting_id, partition_key=business_id)
        
        return func.HttpResponse(
            json.dumps({
                "success": True,
                "message": "Notification settings deleted successfully"
            }),
            status_code=200,
            mimetype="application/json"
        )
    
    except Exception as e:
        logging.error(f"Error deleting notification settings: {str(e)}")
        raise