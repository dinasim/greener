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
        # Get authentication info (matching existing pattern)
        user_email = req.headers.get('X-User-Email')
        user_type = req.headers.get('X-User-Type')
        business_id = req.headers.get('X-Business-ID')
        
        # Use user email as business ID if business ID not provided
        if not business_id and user_email:
            business_id = user_email
        
        if not business_id:
            return func.HttpResponse(
                json.dumps({"error": "Business ID or User Email is required"}),
                status_code=400,
                mimetype="application/json"
            )
        
        logging.info(f"Notification settings request from business: {business_id}, user: {user_email}")
        
        # Initialize Cosmos client (matching existing pattern)
        try:
            connection_string = os.environ["COSMOSDB__MARKETPLACE_CONNECTION_STRING"]
            
            # Extract endpoint and key from connection string
            parts = dict(part.split('=', 1) for part in connection_string.split(';') if '=' in part)
            endpoint = parts.get('AccountEndpoint')
            key = parts.get('AccountKey')
            
            if not endpoint or not key:
                # Fallback to separate environment variables
                endpoint = os.environ.get("COSMOS_URI")
                key = os.environ.get("COSMOS_KEY")
            
            database_id = os.environ.get("COSMOSDB_MARKETPLACE_DATABASE_NAME", "GreenerMarketplace")
            container_id = "watering_notifications"
            
            client = CosmosClient(endpoint, credential=key)
            database = client.get_database_client(database_id)
            container = database.get_container_client(container_id)
            
        except Exception as cosmos_error:
            logging.error(f"Error initializing Cosmos client: {str(cosmos_error)}")
            return func.HttpResponse(
                json.dumps({"error": "Database connection failed"}),
                status_code=500,
                mimetype="application/json"
            )
        
        # Handle different HTTP methods
        if req.method == "GET":
            return get_notification_settings(container, business_id)
        elif req.method == "POST":
            return create_or_update_notification_settings(container, req, business_id)
        elif req.method == "DELETE":
            return delete_notification_settings(container, req, business_id)
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

def get_notification_settings(container, business_id):
    """Get notification settings for a business"""
    try:
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
                "success": True,
                "settings": settings[0] if settings else {},
                "businessId": business_id
            }),
            status_code=200,
            mimetype="application/json"
        )
    
    except Exception as e:
        logging.error(f"Error getting notification settings: {str(e)}")
        return func.HttpResponse(
            json.dumps({"error": f"Error getting settings: {str(e)}"}),
            status_code=500,
            mimetype="application/json"
        )

def create_or_update_notification_settings(container, req, business_id):
    """Create or update notification settings"""
    try:
        req_body = req.get_json()
        
        if not req_body:
            return func.HttpResponse(
                json.dumps({"error": "Request body is required"}),
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
        return func.HttpResponse(
            json.dumps({"error": f"Error saving settings: {str(e)}"}),
            status_code=500,
            mimetype="application/json"
        )

def delete_notification_settings(container, req, business_id):
    """Delete notification settings"""
    try:
        setting_id = req.params.get('settingId')
        
        if not setting_id:
            return func.HttpResponse(
                json.dumps({"error": "Setting ID is required"}),
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
        return func.HttpResponse(
            json.dumps({"error": f"Error deleting settings: {str(e)}"}),
            status_code=500,
            mimetype="application/json"
        )