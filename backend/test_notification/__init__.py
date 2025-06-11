# test_notification/__init__.py
import logging
import azure.functions as func
import json
import os
import base64
import hmac
import hashlib
import urllib.parse
import time
import datetime
import requests
import traceback
from azure.cosmos import CosmosClient

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Test Notification API triggered.')
    
    try:
        # Get request data
        req_body = req.get_json()
        
        business_id = req_body.get('businessId')
        device_token = req_body.get('deviceToken')
        
        if not business_id:
            return func.HttpResponse(
                json.dumps({"error": "BusinessId is required"}),
                status_code=400,
                mimetype="application/json"
            )
        
        # If no specific device token provided, get all tokens for the business
        if not device_token:
            device_tokens = get_device_tokens_for_business(business_id)
            
            if not device_tokens:
                return func.HttpResponse(
                    json.dumps({
                        "error": "No registered device tokens found for this business",
                        "businessId": business_id
                    }),
                    status_code=404,
                    mimetype="application/json"
                )
        else:
            device_tokens = [device_token]
        
        # Send test notification
        success = send_test_notification(business_id, device_tokens)
        
        if success:
            return func.HttpResponse(
                json.dumps({
                    "success": True,
                    "message": "Test notification sent successfully",
                    "businessId": business_id,
                    "tokenCount": len(device_tokens)
                }),
                status_code=200,
                mimetype="application/json"
            )
        else:
            return func.HttpResponse(
                json.dumps({
                    "error": "Failed to send test notification",
                    "businessId": business_id
                }),
                status_code=500,
                mimetype="application/json"
            )
            
    except Exception as e:
        logging.error(f"Error sending test notification: {str(e)}")
        logging.error(traceback.format_exc())
        return func.HttpResponse(
            json.dumps({"error": f"Internal server error: {str(e)}"}),
            status_code=500,
            mimetype="application/json"
        )

def get_device_tokens_for_business(business_id):
    """Get all device tokens registered for a business"""
    try:
        # Initialize Cosmos client
        endpoint = os.environ.get("COSMOSDB__MARKETPLACE_CONNECTION_STRING")
        key = os.environ.get("COSMOSDB_KEY")
        database_id = os.environ.get("COSMOSDB_MARKETPLACE_DATABASE_NAME", "GreenerMarketplace")
        container_id = "watering_notifications"
        
        client = CosmosClient(endpoint, key)
        database = client.get_database_client(database_id)
        
        try:
            container = database.get_container_client(container_id)
            
            # Query for active notification preferences
            query = """
                SELECT c.deviceToken
                FROM c
                WHERE c.businessId = @businessId
                AND c.status = 'active'
            """
            
            items = list(container.query_items(
                query=query,
                parameters=[{"name": "@businessId", "value": business_id}],
                enable_cross_partition_query=True
            ))
            
            tokens = [item['deviceToken'] for item in items]
            
            logging.info(f"Found {len(tokens)} device tokens for business {business_id}")
            return tokens
            
        except Exception as e:
            logging.error(f"Error querying notification preferences: {str(e)}")
            return []
        
    except Exception as e:
        logging.error(f"Error getting device tokens: {str(e)}")
        return []

def send_test_notification(business_id, device_tokens):
    """Send a test notification to the specified device tokens"""
    try:
        # Get notification hub connection details
        connection_string = os.environ.get("AZURE_NOTIFICATION_HUB_CONNECTION_STRING")
        hub_name = os.environ.get("AZURE_NOTIFICATION_HUB_NAME", "watering_business")
        
        if not connection_string:
            logging.error("Missing Azure Notification Hub connection string")
            return False
        
        # Parse connection string to get the required components
        connection_parts = dict(item.split('=', 1) for item in connection_string.split(';') if '=' in item)
        endpoint = connection_parts.get('Endpoint', '').rstrip('/')
        shared_access_key_name = connection_parts.get('SharedAccessKeyName')
        shared_access_key = connection_parts.get('SharedAccessKey')
        
        if not (endpoint and shared_access_key_name and shared_access_key):
            logging.error("Invalid connection string format")
            return False
        
        # Create authorization header using SAS token
        target_uri = f"{endpoint}/{hub_name}/messages/?api-version=2015-04"
        expiry = int(time.time()) + 3600  # Token valid for 1 hour
        
        string_to_sign = urllib.parse.quote_plus(target_uri) + '\n' + str(expiry)
        signature = base64.b64encode(
            hmac.HMAC(
                base64.b64decode(shared_access_key), 
                string_to_sign.encode('utf-8'), 
                hashlib.sha256
            ).digest()
        ).decode('utf-8')
        
        token = f"SharedAccessSignature sr={urllib.parse.quote_plus(target_uri)}&sig={urllib.parse.quote(signature)}&se={expiry}&skn={shared_access_key_name}"
        
        successes = 0
        
        for device_token in device_tokens:
            try:
                # Check if token is an Expo token
                is_expo = device_token.startswith('ExponentPushToken')
                
                if is_expo:
                    # Expo format
                    notification_payload = {
                        "to": device_token,
                        "title": "🌱 Test Notification",
                        "body": "This is a test watering reminder notification",
                        "data": {
                            "type": "TEST_NOTIFICATION",
                            "businessId": business_id,
                            "timestamp": datetime.datetime.utcnow().isoformat()
                        }
                    }
                    
                    headers = {
                        "Content-Type": "application/json",
                        "Authorization": token,
                        "ServiceBusNotification-Format": "template"
                    }
                    
                else:
                    # FCM format
                    notification_payload = {
                        "data": {
                            "title": "🌱 Test Notification",
                            "body": "This is a test watering reminder notification",
                            "type": "TEST_NOTIFICATION",
                            "businessId": business_id,
                            "timestamp": datetime.datetime.utcnow().isoformat()
                        }
                    }
                    
                    headers = {
                        "Content-Type": "application/json",
                        "Authorization": token,
                        "ServiceBusNotification-Format": "gcm"
                    }
                
                # Send the notification
                response = requests.post(
                    f"{endpoint}/{hub_name}/messages",
                    headers=headers,
                    json=notification_payload
                )
                
                if response.status_code == 201:
                    logging.info(f"Successfully sent test notification to {device_token[:10]}...")
                    successes += 1
                else:
                    logging.error(f"Error sending test notification: {response.status_code} - {response.text}")
                
            except Exception as e:
                logging.error(f"Error sending to token {device_token[:10]}...: {str(e)}")
        
        # Return True if at least one notification was sent successfully
        return successes > 0
        
    except Exception as e:
        logging.error(f"Error sending test notification: {str(e)}")
        logging.error(traceback.format_exc())
        return False