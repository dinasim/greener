# register_device_token/__init__.py
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
from azure.cosmos import CosmosClient, PartitionKey

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Register Device Token API triggered.')
    
    try:
        # Get request data
        req_body = req.get_json()
        
        business_id = req_body.get('businessId')
        device_token = req_body.get('deviceToken')
        notification_time = req_body.get('notificationTime', '07:00')  # Default to 7:00 AM
        
        if not business_id or not device_token:
            return func.HttpResponse(
                json.dumps({"error": "BusinessId and deviceToken are required"}),
                status_code=400,
                mimetype="application/json"
            )
        
        # Register device token with Azure Notification Hub
        hub_result = register_with_notification_hub(device_token)
        
        # Store notification preferences in Cosmos DB
        cosmos_result = store_notification_preferences(business_id, device_token, notification_time)
        
        return func.HttpResponse(
            json.dumps({
                "success": True,
                "message": "Device registered successfully",
                "businessId": business_id,
                "notificationTime": notification_time,
                "hubRegistration": hub_result,
                "dbRegistration": cosmos_result
            }),
            status_code=200,
            mimetype="application/json"
        )
        
    except Exception as e:
        logging.error(f"Error registering device token: {str(e)}")
        logging.error(traceback.format_exc())
        return func.HttpResponse(
            json.dumps({"error": f"Internal server error: {str(e)}"}),
            status_code=500,
            mimetype="application/json"
        )

def register_with_notification_hub(device_token):
    """Register device token with Azure Notification Hub"""
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
        target_uri = f"{endpoint}/{hub_name}/registrations?api-version=2020-06"
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
        
        # Check if token is an Expo token
        is_expo = device_token.startswith('ExponentPushToken')
        
        # Create a unique registration ID from the token
        # Remove any non-alphanumeric characters to ensure valid registration ID
        import re
        registration_id = re.sub(r'[^a-zA-Z0-9]', '', device_token)
        if len(registration_id) > 50:
            registration_id = registration_id[:50]  # Trim if too long
        
        # Set up the registration request
        headers = {
            "Content-Type": "application/json;charset=utf-8",
            "Authorization": token,
        }
        
        # For Expo tokens, we use template registration
        # For FCM tokens, we use gcm registration
        if is_expo:
            body = {
                "Template": {
                    "BodyTemplate": "{\"to\":\"" + device_token + "\",\"title\":\"$(title)\",\"body\":\"$(body)\",\"data\":{\"type\":\"$(type)\",\"businessId\":\"$(businessId)\",\"plantCount\":\"$(plantCount)\",\"timestamp\":\"$(timestamp)\"}}",
                    "Headers": {}
                },
                "Tags": ["business-" + registration_id[:8]]  # Use first part of ID as tag
            }
        else:
            body = {
                "GcmRegistrationDescription": {
                    "GcmRegistrationId": device_token,
                    "Tags": ["business-" + registration_id[:8]]
                }
            }
        
        # Make the registration request
        registration_url = f"{endpoint}/{hub_name}/registrations/{registration_id}?api-version=2020-06"
        
        # First try to create a new registration
        try:
            response = requests.put(
                registration_url,
                headers=headers,
                json=body  # Using json parameter for proper serialization
            )
            
            if response.status_code in [200, 201]:
                logging.info(f"Successfully registered device token: {device_token[:10]}...")
                return True
            else:
                logging.error(f"Error registering device token: {response.status_code} - {response.text}")
                return False
        except Exception as e:
            logging.error(f"Exception during registration: {str(e)}")
            return False
        
    except Exception as e:
        logging.error(f"Error registering with notification hub: {str(e)}")
        logging.error(traceback.format_exc())
        return False

def store_notification_preferences(business_id, device_token, notification_time):
    """Store notification preferences in Cosmos DB"""
    try:
        # Initialize Cosmos client
        endpoint = os.environ.get("COSMOSDB__MARKETPLACE_CONNECTION_STRING")
        key = os.environ.get("COSMOSDB_KEY")
        database_id = os.environ.get("COSMOSDB_MARKETPLACE_DATABASE_NAME", "GreenerMarketplace")
        container_id = "watering_notifications"
        
        client = CosmosClient(endpoint, key)
        database = client.get_database_client(database_id)
        
        # Ensure container exists
        try:
            container = database.get_container_client(container_id)
            # Test if container exists
            container.read()
        except Exception:
            # Create container if it doesn't exist
            logging.info(f"Creating container: {container_id}")
            container = database.create_container(
                id=container_id,
                partition_key=PartitionKey(path="/businessId"),
                offer_throughput=400
            )
        
        # Generate unique ID for the notification record
        notification_id = f"{business_id}-{device_token[-12:].replace('[', '').replace(']', '')}"
        
        # Define the notification record
        notification_record = {
            "id": notification_id,
            "businessId": business_id,
            "deviceToken": device_token,
            "notificationTime": notification_time,
            "status": "active",
            "lastSent": None,
            "createdAt": datetime.datetime.utcnow().isoformat(),
            "updatedAt": datetime.datetime.utcnow().isoformat()
        }
        
        # First check if record already exists
        try:
            existing_record = container.read_item(
                item=notification_id,
                partition_key=business_id
            )
            
            # Update existing record
            existing_record["notificationTime"] = notification_time
            existing_record["deviceToken"] = device_token
            existing_record["status"] = "active"
            existing_record["updatedAt"] = datetime.datetime.utcnow().isoformat()
            
            container.replace_item(
                item=notification_id,
                body=existing_record
            )
            
            logging.info(f"Updated notification preferences for business {business_id}")
            return True
            
        except Exception:
            # Create new record
            container.create_item(body=notification_record)
            logging.info(f"Created new notification preferences for business {business_id}")
            return True
        
    except Exception as e:
        logging.error(f"Error storing notification preferences: {str(e)}")
        logging.error(traceback.format_exc())
        return False