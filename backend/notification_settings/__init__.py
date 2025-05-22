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
        # Handle CORS for web requests
        if req.method == 'OPTIONS':
            return func.HttpResponse(
                "",
                status_code=200,
                headers={
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
                    "Access-Control-Allow-Headers": "Content-Type, X-Business-ID, X-User-Email"
                }
            )
        
        # Initialize Cosmos client with proper connection string handling
        connection_string = os.environ.get("COSMOSDB__MARKETPLACE_CONNECTION_STRING")
        database_id = os.environ.get("COSMOSDB_MARKETPLACE_DATABASE_NAME", "GreenerMarketplace")
        container_id = "watering_notifications"
        
        if not connection_string:
            return func.HttpResponse(
                json.dumps({"error": "Database connection not configured"}),
                status_code=500,
                mimetype="application/json",
                headers={
                    "Access-Control-Allow-Origin": "*",
                    "Content-Type": "application/json"
                }
            )
        
        # Parse connection string properly
        if connection_string.startswith("AccountEndpoint="):
            # Full connection string format
            client = CosmosClient.from_connection_string(connection_string)
        else:
            # Separate endpoint and key (fallback)
            key = os.environ.get("COSMOSDB_KEY")
            client = CosmosClient(connection_string, key)
        
        database = client.get_database_client(database_id)
        
        # Ensure container exists
        try:
            container = database.get_container_client(container_id)
            container.read()
        except Exception:
            logging.info(f"Creating container {container_id}")
            from azure.cosmos import PartitionKey
            container = database.create_container(
                id=container_id,
                partition_key=PartitionKey(path="/businessId"),
                offer_throughput=400
            )
        
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
                mimetype="application/json",
                headers={
                    "Access-Control-Allow-Origin": "*",
                    "Content-Type": "application/json"
                }
            )
    
    except Exception as e:
        logging.error(f"Error in notification settings API: {str(e)}")
        return func.HttpResponse(
            json.dumps({"error": f"Internal server error: {str(e)}"}),
            status_code=500,
            mimetype="application/json",
            headers={
                "Access-Control-Allow-Origin": "*",
                "Content-Type": "application/json"
            }
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
                mimetype="application/json",
                headers={
                    "Access-Control-Allow-Origin": "*",
                    "Content-Type": "application/json"
                }
            )
        
        # Query for notification settings
        query = "SELECT * FROM c WHERE c.businessId = @businessId"
        try:
            settings = list(container.query_items(
                query=query,
                parameters=[{"name": "@businessId", "value": business_id}],
                enable_cross_partition_query=True
            ))
        except Exception as e:
            logging.warning(f"Error querying settings: {str(e)}")
            settings = []
        
        # If no settings exist, return default
        if not settings:
            default_setting = {
                "businessId": business_id,
                "notificationTime": "07:00",
                "enableWateringReminders": True,
                "enableLowStockAlerts": True,
                "enableSuccessNotifications": True,
                "pollingInterval": 60,
                "status": "active"
            }
            settings = [default_setting]
        
        return func.HttpResponse(
            json.dumps({
                "settings": settings[0] if settings else {},
                "businessId": business_id
            }),
            status_code=200,
            mimetype="application/json",
            headers={
                "Access-Control-Allow-Origin": "*",
                "Content-Type": "application/json"
            }
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
                mimetype="application/json",
                headers={
                    "Access-Control-Allow-Origin": "*",
                    "Content-Type": "application/json"
                }
            )
        
        business_id = req_body.get('businessId')
        if not business_id:
            business_id = req.headers.get('X-Business-ID')
        
        if not business_id:
            return func.HttpResponse(
                json.dumps({"error": "Business ID is required"}),
                status_code=400,
                mimetype="application/json",
                headers={
                    "Access-Control-Allow-Origin": "*",
                    "Content-Type": "application/json"
                }
            )
        
        # Check if settings already exist
        existing_query = "SELECT * FROM c WHERE c.businessId = @businessId"
        try:
            existing_settings = list(container.query_items(
                query=existing_query,
                parameters=[{"name": "@businessId", "value": business_id}],
                enable_cross_partition_query=True
            ))
        except Exception:
            existing_settings = []
        
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
                "settings": setting,
                "message": "Notification settings saved successfully"
            }),
            status_code=200,
            mimetype="application/json",
            headers={
                "Access-Control-Allow-Origin": "*",
                "Content-Type": "application/json"
            }
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
                mimetype="application/json",
                headers={
                    "Access-Control-Allow-Origin": "*",
                    "Content-Type": "application/json"
                }
            )
        
        # Delete the setting
        container.delete_item(item=setting_id, partition_key=business_id)
        
        return func.HttpResponse(
            json.dumps({
                "success": True,
                "message": "Notification settings deleted successfully"
            }),
            status_code=200,
            mimetype="application/json",
            headers={
                "Access-Control-Allow-Origin": "*",
                "Content-Type": "application/json"
            }
        )
    
    except Exception as e:
        logging.error(f"Error deleting notification settings: {str(e)}")
        raise