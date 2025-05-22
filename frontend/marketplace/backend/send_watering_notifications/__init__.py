# send_watering_notifications/__init__.py
import logging
import azure.functions as func
import os
import datetime
import requests
import json
import hmac
import hashlib
import base64
import urllib.parse
from azure.cosmos import CosmosClient

def main(mytimer: func.TimerRequest) -> None:
    utc_timestamp = datetime.datetime.utcnow().replace(
        tzinfo=datetime.timezone.utc).isoformat()
    
    logging.info('Notification scheduler function triggered at: %s', utc_timestamp)
    
    try:
        # Initialize Cosmos client
        endpoint = os.environ["COSMOSDB__MARKETPLACE_CONNECTION_STRING"]
        key = os.environ["COSMOSDB_KEY"]
        database_id = os.environ["COSMOSDB_MARKETPLACE_DATABASE_NAME"]
        inventory_container_id = "inventory"
        notifications_container_id = "watering_notifications"
        
        client = CosmosClient(endpoint, key)
        database = client.get_database_client(database_id)
        inventory_container = database.get_container_client(inventory_container_id)
        notifications_container = database.get_container_client(notifications_container_id)
        
        # Get current hour for checking notification times
        now = datetime.datetime.utcnow()
        current_hour = now.hour
        current_minute = now.minute
        current_time_string = f"{current_hour:02d}:{current_minute:02d}"
        
        logging.info(f"Checking for notifications scheduled around: {current_time_string}")
        
        # Find all businesses with active notifications around current time
        start_time = get_time_offset(current_hour, current_minute, -30)
        end_time = get_time_offset(current_hour, current_minute, 30)
        
        businesses_query = """
            SELECT DISTINCT c.businessId FROM c 
            WHERE c.status = 'active' 
            AND c.notificationTime BETWEEN @startTime AND @endTime
        """
        
        businesses = list(notifications_container.query_items(
            query=businesses_query,
            parameters=[
                {"name": "@startTime", "value": start_time},
                {"name": "@endTime", "value": end_time}
            ],
            enable_cross_partition_query=True
        ))
        
        for business in businesses:
            business_id = business['businessId']
            process_business_notifications(inventory_container, notifications_container, business_id)
        
        logging.info(f"Completed notification check at {utc_timestamp}")
        
    except Exception as e:
        logging.error(f"Error in notification scheduler: {str(e)}")
        raise

def get_time_offset(hour, minute, offset_minutes):
    """Calculate time with offset minutes"""
    dt = datetime.datetime.utcnow().replace(hour=hour, minute=minute)
    offset_dt = dt + datetime.timedelta(minutes=offset_minutes)
    return f"{offset_dt.hour:02d}:{offset_dt.minute:02d}"

def process_business_notifications(inventory_container, notifications_container, business_id):
    """Process notifications for a specific business"""
    try:
        # Find all plants that need watering for this business
        plants_query = """
            SELECT * FROM c 
            WHERE c.businessId = @businessId 
            AND c.productType = 'plant' 
            AND c.wateringSchedule.needsWatering = true
        """
        
        plants_needing_water = list(inventory_container.query_items(
            query=plants_query,
            parameters=[{"name": "@businessId", "value": business_id}],
            enable_cross_partition_query=True
        ))
        
        if not plants_needing_water:
            logging.info(f"No plants need watering for business: {business_id}")
            return
        
        # Get device tokens for this business
        notifications_query = """
            SELECT * FROM c 
            WHERE c.businessId = @businessId 
            AND c.status = 'active'
        """
        
        notifications = list(notifications_container.query_items(
            query=notifications_query,
            parameters=[{"name": "@businessId", "value": business_id}],
            enable_cross_partition_query=True
        ))
        
        if not notifications:
            logging.info(f"No active notification settings found for business: {business_id}")
            return
        
        # Get unique device tokens
        device_tokens = set()
        for notification in notifications:
            if 'deviceTokens' in notification and notification['deviceTokens']:
                device_tokens.update(notification['deviceTokens'])
        
        if not device_tokens:
            logging.info(f"No device tokens found for business: {business_id}")
            return
        
        # Prepare notification message
        plant_names = [p.get('name') or p.get('common_name') for p in plants_needing_water[:3]]
        
        if len(plants_needing_water) == 1:
            notification_text = f"{plant_names[0]} needs watering today."
        elif len(plants_needing_water) <= 3:
            notification_text = f"{', '.join(plant_names)} need watering today."
        else:
            notification_text = f"{', '.join(plant_names)} and {len(plants_needing_water) - 3} more plants need watering today."
        
        # Send notifications via Azure Notification Hub
        send_notifications(
            business_id=business_id,
            title="🌱 Plant Watering Reminder",
            body=notification_text,
            plant_count=len(plants_needing_water),
            device_tokens=list(device_tokens)
        )
        
        # Update last sent timestamp for notifications
        for notification in notifications:
            notification['lastSent'] = datetime.datetime.utcnow().isoformat()
            notifications_container.upsert_item(notification)
        
        logging.info(f"Sent watering notifications for {len(plants_needing_water)} plants to {len(device_tokens)} devices")
    
    except Exception as e:
        logging.error(f"Error processing notifications for business {business_id}: {str(e)}")
        raise

def generate_sas_token(namespace, hub_name, key_name, key_value, expiry_seconds=3600):
    """Generate SAS token for Azure Notification Hub authentication"""
    try:
        # Create the resource URI
        uri = f"https://{namespace}.servicebus.windows.net/{hub_name}"
        encoded_uri = urllib.parse.quote_plus(uri)
        
        # Calculate expiry time
        expiry = int(datetime.datetime.utcnow().timestamp()) + expiry_seconds
        
        # Create the string to sign
        string_to_sign = f"{encoded_uri}\n{expiry}"
        
        # Create HMAC signature
        signature = hmac.new(
            key_value.encode('utf-8'),
            string_to_sign.encode('utf-8'),
            hashlib.sha256
        ).digest()
        
        # Encode signature
        encoded_signature = base64.b64encode(signature).decode('utf-8')
        encoded_signature = urllib.parse.quote_plus(encoded_signature)
        
        # Create the SAS token
        sas_token = f"SharedAccessSignature sr={encoded_uri}&sig={encoded_signature}&se={expiry}&skn={key_name}"
        
        return sas_token
    
    except Exception as e:
        logging.error(f"Error generating SAS token: {str(e)}")
        raise

def send_notifications(business_id, title, body, plant_count, device_tokens):
    """Send notifications via Azure Notification Hub"""
    try:
        # Get configuration from environment variables
        connection_string = os.environ.get("AZURE_NOTIFICATION_HUB_CONNECTION_STRING")
        hub_name = os.environ.get("AZURE_NOTIFICATION_HUB_NAME")
        namespace = os.environ.get("AZURE_NOTIFICATION_HUB_NAMESPACE")
        
        if not all([connection_string, hub_name, namespace]):
            logging.error("Missing Azure Notification Hub configuration")
            return
        
        # Parse connection string to get key name and key value
        conn_parts = dict(part.split('=', 1) for part in connection_string.split(';') if '=' in part)
        key_name = conn_parts.get('SharedAccessKeyName')
        key_value = conn_parts.get('SharedAccessKey')
        
        if not all([key_name, key_value]):
            logging.error("Invalid connection string format")
            return
        
        # Generate SAS token
        sas_token = generate_sas_token(namespace, hub_name, key_name, key_value)
        
        # Prepare notification payload for Android (FCM format)
        fcm_payload = {
            "data": {
                "title": title,
                "body": body,
                "type": "WATERING_REMINDER",
                "businessId": business_id,
                "plantCount": str(plant_count),
                "timestamp": datetime.datetime.utcnow().isoformat(),
                "action": "open_watering_checklist"
            }
        }
        
        # Prepare notification payload for iOS (APNS format)
        apns_payload = {
            "aps": {
                "alert": {
                    "title": title,
                    "body": body
                },
                "badge": plant_count,
                "sound": "default"
            },
            "customData": {
                "type": "WATERING_REMINDER",
                "businessId": business_id,
                "plantCount": plant_count,
                "timestamp": datetime.datetime.utcnow().isoformat(),
                "action": "open_watering_checklist"
            }
        }
        
        # Send to specific device tokens (if you want to target specific devices)
        success_count = 0
        error_count = 0
        
        for token in device_tokens:
            try:
                # Try sending as Android notification first
                android_success = send_notification_to_platform(
                    namespace, hub_name, sas_token, fcm_payload, "gcm", tag=f"deviceToken:{token}"
                )
                
                if android_success:
                    success_count += 1
                    logging.info(f"Android notification sent to device: {token}")
                else:
                    # Try sending as iOS notification
                    ios_success = send_notification_to_platform(
                        namespace, hub_name, sas_token, apns_payload, "apple", tag=f"deviceToken:{token}"
                    )
                    
                    if ios_success:
                        success_count += 1
                        logging.info(f"iOS notification sent to device: {token}")
                    else:
                        error_count += 1
                        logging.error(f"Failed to send notification to device: {token}")
            
            except Exception as e:
                error_count += 1
                logging.error(f"Error sending notification to device {token}: {str(e)}")
        
        # Also send broadcast notification to all devices for this business
        business_tag = f"businessId:{business_id}"
        
        # Send Android broadcast
        send_notification_to_platform(
            namespace, hub_name, sas_token, fcm_payload, "gcm", tag=business_tag
        )
        
        # Send iOS broadcast
        send_notification_to_platform(
            namespace, hub_name, sas_token, apns_payload, "apple", tag=business_tag
        )
        
        logging.info(f"Notification summary - Success: {success_count}, Errors: {error_count}")
    
    except Exception as e:
        logging.error(f"Error sending notifications: {str(e)}")
        raise

def send_notification_to_platform(namespace, hub_name, sas_token, payload, platform, tag=None):
    """Send notification to specific platform via Azure Notification Hub"""
    try:
        # Construct the API endpoint
        endpoint = f"https://{namespace}.servicebus.windows.net/{hub_name}/messages/"
        
        # Add tag filter if provided
        if tag:
            endpoint += f"?api-version=2015-01"
        else:
            endpoint += "?api-version=2015-01"
        
        # Prepare headers
        headers = {
            "Authorization": sas_token,
            "Content-Type": "application/json",
            "ServiceBusNotification-Format": platform
        }
        
        # Add tag header if provided
        if tag:
            headers["ServiceBusNotification-Tags"] = tag
        
        # Convert payload to JSON string
        payload_json = json.dumps(payload)
        
        # Send the notification
        response = requests.post(
            endpoint,
            headers=headers,
            data=payload_json,
            timeout=30
        )
        
        if response.status_code in [201, 202]:
            logging.info(f"Notification sent successfully to {platform} platform")
            return True
        else:
            logging.error(f"Failed to send {platform} notification: {response.status_code} - {response.text}")
            return False
    
    except Exception as e:
        logging.error(f"Error sending {platform} notification: {str(e)}")
        return False