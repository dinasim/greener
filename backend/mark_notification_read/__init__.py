# mark_notification_read/__init__.py
import logging
import azure.functions as func
import json
import datetime
import os
import uuid
from azure.cosmos import CosmosClient

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Mark Notification Read API triggered.')
    
    try:
        # Handle CORS for web requests
        if req.method == 'OPTIONS':
            return func.HttpResponse(
                "",
                status_code=200,
                headers={
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
                    "Access-Control-Allow-Headers": "Content-Type, X-Business-ID, X-User-Email"
                }
            )
        
        # Get request body
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
        notification_id = req_body.get('notificationId')
        notification_type = req_body.get('notificationType')
        
        if not business_id:
            business_id = req.headers.get('X-Business-ID')
        
        if not all([business_id, notification_id]):
            return func.HttpResponse(
                json.dumps({"error": "Business ID and Notification ID are required"}),
                status_code=400,
                mimetype="application/json",
                headers={
                    "Access-Control-Allow-Origin": "*",
                    "Content-Type": "application/json"
                }
            )
        
        # Initialize Cosmos client with proper connection string handling
        connection_string = os.environ.get("COSMOSDB__MARKETPLACE_CONNECTION_STRING")
        database_id = os.environ.get("COSMOSDB_MARKETPLACE_DATABASE_NAME", "GreenerMarketplace")
        container_id = "notification_history"
        
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
            # Test container access
            container.read()
        except Exception as container_error:
            logging.info(f"Creating container {container_id}")
            # Create container if it doesn't exist
            from azure.cosmos import PartitionKey
            container = database.create_container(
                id=container_id,
                partition_key=PartitionKey(path="/businessId"),
                offer_throughput=400
            )
        
        # Create notification read record
        read_record = {
            "id": str(uuid.uuid4()),
            "businessId": business_id,
            "notificationId": notification_id,
            "notificationType": notification_type or "UNKNOWN",
            "readAt": datetime.datetime.utcnow().isoformat(),
            "status": "read"
        }
        
        # Store the read record
        container.upsert_item(read_record)
        
        logging.info(f"Notification {notification_id} marked as read for business {business_id}")
        
        return func.HttpResponse(
            json.dumps({
                "success": True,
                "message": "Notification marked as read",
                "readRecord": {
                    "id": read_record["id"],
                    "notificationId": notification_id,
                    "readAt": read_record["readAt"]
                }
            }),
            status_code=200,
            mimetype="application/json",
            headers={
                "Access-Control-Allow-Origin": "*",
                "Content-Type": "application/json"
            }
        )
    
    except Exception as e:
        logging.error(f"Error marking notification as read: {str(e)}")
        return func.HttpResponse(
            json.dumps({"error": f"Internal server error: {str(e)}"}),
            status_code=500,
            mimetype="application/json",
            headers={
                "Access-Control-Allow-Origin": "*",
                "Content-Type": "application/json"
            }
        )