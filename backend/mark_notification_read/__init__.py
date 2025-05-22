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
        # Get request body
        req_body = req.get_json()
        
        if not req_body:
            return func.HttpResponse(
                json.dumps({"error": "Request body is required"}),
                status_code=400,
                mimetype="application/json"
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
                mimetype="application/json"
            )
        
        # Initialize Cosmos client
        endpoint = os.environ["COSMOSDB__MARKETPLACE_CONNECTION_STRING"]
        key = os.environ["COSMOSDB_KEY"]
        database_id = os.environ["COSMOSDB_MARKETPLACE_DATABASE_NAME"]
        container_id = "notification_history"
        
        client = CosmosClient(endpoint, key)
        database = client.get_database_client(database_id)
        container = database.get_container_client(container_id)
        
        # Create notification read record
        read_record = {
            "id": str(uuid.uuid4()),
            "businessId": business_id,
            "notificationId": notification_id,
            "notificationType": notification_type,
            "readAt": datetime.datetime.utcnow().isoformat(),
            "status": "read"
        }
        
        # Store the read record
        container.upsert_item(read_record)
        
        return func.HttpResponse(
            json.dumps({
                "success": True,
                "message": "Notification marked as read",
                "readRecord": read_record
            }),
            status_code=200,
            mimetype="application/json"
        )
    
    except Exception as e:
        logging.error(f"Error marking notification as read: {str(e)}")
        return func.HttpResponse(
            json.dumps({"error": f"Internal server error: {str(e)}"}),
            status_code=500,
            mimetype="application/json"
        )