# send_consumer_notifications/__init__.py
import logging
import azure.functions as func
import json
import datetime
import os
from azure.cosmos import CosmosClient
from datetime import datetime, timezone
import requests

# Environment variables
MARKETPLACE_CONNECTION_STRING = os.environ.get("COSMOSDB__MARKETPLACE_CONNECTION_STRING")
MARKETPLACE_DATABASE_NAME = os.environ.get("COSMOSDB_MARKETPLACE_DATABASE_NAME", "GreenerMarketplace")
FCM_SERVER_KEY = os.environ.get("FCM_SERVER_KEY")

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Consumer notification service triggered.')
    
    try:
        # Get consumers needing notifications
        consumers_to_notify = get_consumers_needing_notifications()
        
        if not consumers_to_notify:
            logging.info('No consumers need notifications at this time')
            return func.HttpResponse(
                json.dumps({"message": "No consumers need notifications"}),
                status_code=200,
                mimetype="application/json"
            )
        
        # Send notifications to each consumer
        success_count = 0
        error_count = 0
        
        for consumer in consumers_to_notify:
            try:
                success = send_consumer_notification(consumer)
                if success:
                    success_count += 1
                    update_consumer_notification_log(
                        consumer.get('settingId'), 
                        consumer.get('userEmail'), 
                        True, 
                        "Notification sent successfully"
                    )
                else:
                    error_count += 1
                    update_consumer_notification_log(
                        consumer.get('settingId'), 
                        consumer.get('userEmail'), 
                        False, 
                        "Failed to send notification"
                    )
            except Exception as e:
                logging.error(f'Error sending notification to {consumer.get("userEmail")}: {str(e)}')
                error_count += 1
                update_consumer_notification_log(
                    consumer.get('settingId'), 
                    consumer.get('userEmail'), 
                    False, 
                    f"Error: {str(e)}"
                )
        
        return func.HttpResponse(
            json.dumps({
                "message": f"Consumer notifications processed: {success_count} sent, {error_count} failed",
                "success_count": success_count,
                "error_count": error_count
            }),
            status_code=200,
            mimetype="application/json"
        )
        
    except Exception as e:
        logging.error(f'Consumer notification service error: {str(e)}')
        return func.HttpResponse(
            json.dumps({"error": str(e)}),
            status_code=500,
            mimetype="application/json"
        )

def get_consumers_needing_notifications():
    """Get consumer users that have plants needing water and notification settings"""
    try:
        params = dict(param.split('=', 1) for param in MARKETPLACE_CONNECTION_STRING.split(';'))
        client = CosmosClient(params['AccountEndpoint'], credential=params['AccountKey'])
        database = client.get_database_client(MARKETPLACE_DATABASE_NAME)
        
        # Use separate containers for consumer data
        user_plants_container = database.get_container_client("userplants")
        consumer_notifications_container = database.get_container_client("consumer_notifications")
        
        # Get current time
        current_time = datetime.now(timezone.utc)
        current_hour = current_time.hour
        current_minute = current_time.minute
        
        # Get all consumer notification settings for users that should receive notifications now
        notification_settings = list(consumer_notifications_container.query_items(
            query="SELECT * FROM c WHERE c.status = 'active' AND c.wateringReminders = true",
            enable_cross_partition_query=True
        ))
        
        consumers_to_notify = []
        
        for setting in notification_settings:
            # Check if it's time to send notification
            notification_time = setting.get('notificationTime', '08:00')
            try:
                notify_hour, notify_minute = map(int, notification_time.split(':'))
                
                # Only send if current time matches notification time (within 30 minute window)
                if current_hour == notify_hour and abs(current_minute - notify_minute) <= 30:
                    user_email = setting.get('userEmail')
                    fcm_tokens = setting.get('fcmTokens', [])
                    web_tokens = setting.get('webPushTokens', [])
                    device_tokens = setting.get('deviceTokens', [])
                    
                    if user_email and (fcm_tokens or web_tokens or device_tokens):
                        # Check if user has plants needing water
                        plants_query = """
                        SELECT COUNT(1) as count 
                        FROM c 
                        WHERE c.userEmail = @userEmail 
                        AND c.wateringSchedule.needsWatering = true
                        """
                        
                        plant_count_result = list(user_plants_container.query_items(
                            query=plants_query,
                            parameters=[{"name": "@userEmail", "value": user_email}],
                            enable_cross_partition_query=True
                        ))
                        
                        plants_needing_water = plant_count_result[0]['count'] if plant_count_result else 0
                        
                        if plants_needing_water > 0:
                            # Get specific plant names for notification
                            plants_query_details = """
                            SELECT c.plantName, c.nickname
                            FROM c 
                            WHERE c.userEmail = @userEmail 
                            AND c.wateringSchedule.needsWatering = true
                            """
                            
                            plants_details = list(user_plants_container.query_items(
                                query=plants_query_details,
                                parameters=[{"name": "@userEmail", "value": user_email}],
                                enable_cross_partition_query=True
                            ))
                            
                            plant_names = [p.get('nickname') or p.get('plantName', 'Your plant') for p in plants_details[:3]]  # Max 3 names
                            
                            consumers_to_notify.append({
                                'userEmail': user_email,
                                'fcmTokens': fcm_tokens,
                                'webPushTokens': web_tokens,
                                'deviceTokens': device_tokens,
                                'plantsCount': plants_needing_water,
                                'plantNames': plant_names,
                                'notificationTime': notification_time,
                                'settingId': setting.get('id')
                            })
                            
            except ValueError:
                logging.warning(f'Invalid notification time format: {notification_time}')
                continue
        
        return consumers_to_notify
        
    except Exception as e:
        logging.error(f'Error getting consumers needing notifications: {str(e)}')
        return []

def send_consumer_notification(consumer):
    """Send notification to a consumer user"""
    try:
        user_email = consumer['userEmail']
        plants_count = consumer['plantsCount']
        plant_names = consumer['plantNames']
        
        # Create notification message
        if plants_count == 1:
            title = "🌱 Plant Care Reminder"
            if plant_names:
                body = f"Time to water {plant_names[0]}!"
            else:
                body = "Time to water your plant!"
        else:
            title = f"🌱 {plants_count} Plants Need Water"
            if plant_names:
                if len(plant_names) == plants_count:
                    body = f"Time to water: {', '.join(plant_names)}"
                else:
                    body = f"Time to water: {', '.join(plant_names)} and {plants_count - len(plant_names)} more"
            else:
                body = f"You have {plants_count} plants that need watering"
        
        notification_data = {
            'title': title,
            'body': body,
            'icon': '/static/images/plant-icon.png',
            'badge': '/static/images/badge-icon.png',
            'data': {
                'type': 'consumer_watering_reminder',
                'userEmail': user_email,
                'plantsCount': plants_count,
                'timestamp': datetime.utcnow().isoformat(),
                'action': 'open_my_plants'
            }
        }
        
        success = False
        
        # Send FCM notifications
        if consumer.get('fcmTokens'):
            for token in consumer['fcmTokens']:
                if send_fcm_notification(token, notification_data):
                    success = True
        
        # Send web push notifications
        if consumer.get('webPushTokens'):
            for token in consumer['webPushTokens']:
                if send_web_push_notification(token, notification_data):
                    success = True
        
        # Send device notifications
        if consumer.get('deviceTokens'):
            for token in consumer['deviceTokens']:
                if send_device_notification(token, notification_data):
                    success = True
        
        logging.info(f'Consumer notification sent to {user_email}: {success}')
        return success
        
    except Exception as e:
        logging.error(f'Error sending consumer notification: {str(e)}')
        return False

def send_fcm_notification(token, notification_data):
    """Send FCM notification"""
    try:
        if not FCM_SERVER_KEY:
            logging.warning('FCM_SERVER_KEY not configured')
            return False
        
        headers = {
            'Authorization': f'key={FCM_SERVER_KEY}',
            'Content-Type': 'application/json'
        }
        
        payload = {
            'to': token,
            'notification': {
                'title': notification_data['title'],
                'body': notification_data['body'],
                'icon': notification_data['icon'],
                'badge': notification_data['badge']
            },
            'data': notification_data['data']
        }
        
        response = requests.post('https://fcm.googleapis.com/fcm/send', 
                               headers=headers, 
                               json=payload)
        
        if response.status_code == 200:
            result = response.json()
            return result.get('success', 0) > 0
        else:
            logging.error(f'FCM request failed: {response.status_code} - {response.text}')
            return False
            
    except Exception as e:
        logging.error(f'Error sending FCM notification: {str(e)}')
        return False

def send_web_push_notification(token, notification_data):
    """Send web push notification (placeholder for now)"""
    try:
        # This would integrate with a web push service
        logging.info(f'Web push notification would be sent: {notification_data["title"]}')
        return True
    except Exception as e:
        logging.error(f'Error sending web push notification: {str(e)}')
        return False

def send_device_notification(token, notification_data):
    """Send device-specific notification (placeholder for now)"""
    try:
        # This would integrate with device-specific notification services
        logging.info(f'Device notification would be sent: {notification_data["title"]}')
        return True
    except Exception as e:
        logging.error(f'Error sending device notification: {str(e)}')
        return False

def update_consumer_notification_log(settings_id, user_email, success, message):
    """Update consumer notification log in database"""
    try:
        params = dict(param.split('=', 1) for param in MARKETPLACE_CONNECTION_STRING.split(';'))
        client = CosmosClient(params['AccountEndpoint'], credential=params['AccountKey'])
        database = client.get_database_client(MARKETPLACE_DATABASE_NAME)
        consumer_notifications_container = database.get_container_client("consumer_notifications")
        
        # Update the settings record with last notification info
        try:
            settings_item = consumer_notifications_container.read_item(item=settings_id, partition_key=user_email)
            settings_item['lastNotificationSent'] = datetime.utcnow().isoformat()
            settings_item['lastNotificationSuccess'] = success
            settings_item['lastNotificationMessage'] = message
            consumer_notifications_container.replace_item(item=settings_id, body=settings_item)
        except:
            logging.warning(f'Could not update consumer notification log for {user_email}')
        
    except Exception as e:
        logging.error(f'Error updating consumer notification log: {str(e)}')