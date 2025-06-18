# consumer-notification-settings/__init__.py
import logging
import azure.functions as func
import json
import datetime
import os
import uuid
from azure.cosmos import CosmosClient, exceptions

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Consumer Notification Settings API triggered.')
    
    try:
        # Handle CORS for web requests
        if req.method == 'OPTIONS':
            return func.HttpResponse(
                "",
                status_code=200,
                headers={
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
                    "Access-Control-Allow-Headers": "Content-Type, X-User-Email, X-User-Type"
                }
            )
        
        # Initialize Cosmos client for consumer notifications (separate container)
        connection_string = os.environ.get("COSMOSDB__MARKETPLACE_CONNECTION_STRING")
        database_id = os.environ.get("COSMOSDB_MARKETPLACE_DATABASE_NAME", "GreenerMarketplace")
        container_id = "consumer_notifications"  # Separate container for consumers
        
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
        
        # Connect to Cosmos DB
        client = CosmosClient.from_connection_string(connection_string)
        database = client.get_database_client(database_id)
        
        # Create consumer notifications container if it doesn't exist
        try:
            container = database.get_container_client(container_id)
            container.read()
        except exceptions.CosmosResourceNotFoundError:
            logging.info(f"Creating consumer notifications container: {container_id}")
            from azure.cosmos import PartitionKey
            container = database.create_container(
                id=container_id,
                partition_key=PartitionKey(path="/userEmail"),
                offer_throughput=400
            )
        
        # Route to appropriate handler
        if req.method == 'GET':
            return get_consumer_notification_settings(container, req)
        elif req.method in ['POST', 'PUT']:
            return create_or_update_consumer_notification_settings(container, req)
        elif req.method == 'DELETE':
            return delete_consumer_notification_settings(container, req)
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
        logging.error(f"Consumer notification settings error: {str(e)}")
        return func.HttpResponse(
            json.dumps({"error": "Internal server error", "details": str(e)}),
            status_code=500,
            mimetype="application/json",
            headers={
                "Access-Control-Allow-Origin": "*",
                "Content-Type": "application/json"
            }
        )


def get_consumer_notification_settings(container, req):
    """Get notification settings for a consumer user"""
    try:
        user_email = req.params.get('userEmail')
        if not user_email:
            user_email = req.headers.get('X-User-Email')
        
        if not user_email:
            return func.HttpResponse(
                json.dumps({"error": "User email is required"}),
                status_code=400,
                mimetype="application/json",
                headers={
                    "Access-Control-Allow-Origin": "*",
                    "Content-Type": "application/json"
                }
            )
        
        # Query for consumer notification settings
        query = "SELECT * FROM c WHERE c.userEmail = @userEmail"
        try:
            settings = list(container.query_items(
                query=query,
                parameters=[{"name": "@userEmail", "value": user_email}],
                enable_cross_partition_query=True
            ))
        except Exception as e:
            logging.warning(f"Error querying consumer settings: {str(e)}")
            settings = []
        
        # If no settings exist, return default consumer settings
        if not settings:
            default_setting = {
                "userEmail": user_email,
                "notificationTime": "08:00",  # Default 8 AM for consumers
                "wateringReminders": True,
                "diseaseAlerts": True,
                "marketplaceUpdates": False,
                "forumReplies": True,
                "generalUpdates": False,
                "soundEnabled": True,
                "vibrationEnabled": True,
                "quietHours": {
                    "enabled": False,
                    "start": "22:00",
                    "end": "07:00"
                },
                "status": "active"
            }
            settings = [default_setting]
        
        return func.HttpResponse(
            json.dumps({
                "settings": settings[0] if settings else {},
                "userEmail": user_email
            }),
            status_code=200,
            mimetype="application/json",
            headers={
                "Access-Control-Allow-Origin": "*",
                "Content-Type": "application/json"
            }
        )
    
    except Exception as e:
        logging.error(f"Error getting consumer notification settings: {str(e)}")
        raise


def create_or_update_consumer_notification_settings(container, req):
    """Create or update consumer notification settings"""
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
        
        user_email = req_body.get('userEmail')
        if not user_email:
            user_email = req.headers.get('X-User-Email')
        
        if not user_email:
            return func.HttpResponse(
                json.dumps({"error": "User email is required"}),
                status_code=400,
                mimetype="application/json",
                headers={
                    "Access-Control-Allow-Origin": "*",
                    "Content-Type": "application/json"
                }
            )
        
        # Check if settings already exist
        existing_query = "SELECT * FROM c WHERE c.userEmail = @userEmail"
        try:
            existing_settings = list(container.query_items(
                query=existing_query,
                parameters=[{"name": "@userEmail", "value": user_email}],
                enable_cross_partition_query=True
            ))
        except Exception:
            existing_settings = []
        
        # Create or update consumer notification setting document
        setting = {
            "id": existing_settings[0]["id"] if existing_settings else str(uuid.uuid4()),
            "userEmail": user_email,
            "notificationTime": req_body.get('notificationTime', '08:00'),
            "wateringReminders": req_body.get('wateringReminders', True),
            "diseaseAlerts": req_body.get('diseaseAlerts', True),
            "marketplaceUpdates": req_body.get('marketplaceUpdates', False),
            "forumReplies": req_body.get('forumReplies', True),
            "generalUpdates": req_body.get('generalUpdates', False),
            "soundEnabled": req_body.get('soundEnabled', True),
            "vibrationEnabled": req_body.get('vibrationEnabled', True),
            "quietHours": req_body.get('quietHours', {
                "enabled": False,
                "start": "22:00",
                "end": "07:00"
            }),
            "fcmTokens": req_body.get('fcmTokens', []),
            "webPushTokens": req_body.get('webPushTokens', []),
            "deviceTokens": req_body.get('deviceTokens', []),
            "status": req_body.get('status', 'active'),
            "updatedAt": datetime.datetime.utcnow().isoformat(),
            "lastNotificationCheck": None
        }
        
        if not existing_settings:
            setting["createdAt"] = datetime.datetime.utcnow().isoformat()
        
        # Save to database
        container.upsert_item(setting)
        
        return func.HttpResponse(
            json.dumps({
                "success": True,
                "message": "Consumer notification settings saved successfully",
                "settings": setting
            }),
            status_code=200,
            mimetype="application/json",
            headers={
                "Access-Control-Allow-Origin": "*",
                "Content-Type": "application/json"
            }
        )
    
    except Exception as e:
        logging.error(f"Error creating/updating consumer notification settings: {str(e)}")
        raise


def delete_consumer_notification_settings(container, req):
    """Delete consumer notification settings"""
    try:
        setting_id = req.params.get('settingId')
        user_email = req.headers.get('X-User-Email')
        
        if not setting_id or not user_email:
            return func.HttpResponse(
                json.dumps({"error": "Setting ID and User Email are required"}),
                status_code=400,
                mimetype="application/json",
                headers={
                    "Access-Control-Allow-Origin": "*",
                    "Content-Type": "application/json"
                }
            )
        
        # Delete the setting
        container.delete_item(item=setting_id, partition_key=user_email)
        
        return func.HttpResponse(
            json.dumps({
                "success": True,
                "message": "Consumer notification settings deleted successfully"
            }),
            status_code=200,
            mimetype="application/json",
            headers={
                "Access-Control-Allow-Origin": "*",
                "Content-Type": "application/json"
            }
        )
    
    except Exception as e:
        logging.error(f"Error deleting consumer notification settings: {str(e)}")
        raise