# send-watering-notifications/__init__.py - COMPLETE FCM SCHEDULER
import logging
import json
import azure.functions as func
from azure.cosmos import CosmosClient, exceptions
from firebase_helpers import send_fcm_notification
import os
from datetime import datetime, timezone, timedelta

# Database connection
MARKETPLACE_CONNECTION_STRING = os.environ.get("COSMOSDB__MARKETPLACE_CONNECTION_STRING")
MARKETPLACE_DATABASE_NAME = os.environ.get("COSMOSDB_MARKETPLACE_DATABASE_NAME", "greener-marketplace-db")

def send_fcm_notification_batch(fcm_tokens, web_tokens, title, body, data=None):
    """Send FCM notification to multiple devices using Firebase Admin SDK"""
    try:
        all_tokens = []
        if fcm_tokens:
            all_tokens.extend(fcm_tokens)
        if web_tokens:
            all_tokens.extend(web_tokens)
            
        if not all_tokens:
            logging.warning('No device tokens provided')
            return True, "No tokens to send to"
        
        total_success = 0
        total_failure = 0
        
        for token in all_tokens:
            try:
                success = send_fcm_notification(token, title, body, data)
                if success:
                    total_success += 1
                else:
                    total_failure += 1
            except Exception as e:
                logging.error(f"Error sending notification to token {token[:20]}...: {str(e)}")
                total_failure += 1
        
        success = total_success > 0
        message = f"Sent {total_success} notifications, {total_failure} failed"
        
        logging.info(f'FCM notification batch complete: {message}')
        return success, message
        
    except Exception as e:
        logging.error(f'Error sending FCM batch notification: {str(e)}')
        return False, str(e)

def get_businesses_needing_notifications():
    """Get businesses that have plants needing water and notification settings"""
    try:
        params = dict(param.split('=', 1) for param in MARKETPLACE_CONNECTION_STRING.split(';'))
        client = CosmosClient(params['AccountEndpoint'], credential=params['AccountKey'])
        database = client.get_database_client(MARKETPLACE_DATABASE_NAME)
        
        inventory_container = database.get_container_client("inventory")
        notifications_container = database.get_container_client("watering_notifications")
        
        # Get current time
        current_time = datetime.now(timezone.utc)
        current_hour = current_time.hour
        current_minute = current_time.minute
        
        # Get all notification settings for businesses that should receive notifications now
        notification_settings = list(notifications_container.query_items(
            query="SELECT * FROM c WHERE c.enabled = true",
            enable_cross_partition_query=True
        ))
        
        businesses_to_notify = []
        
        for setting in notification_settings:
            # Check if it's time to send notification
            notification_time = setting.get('notificationTime', '07:00')
            try:
                notify_hour, notify_minute = map(int, notification_time.split(':'))
                
                # Only send if current time matches notification time (within 30 minute window)
                if current_hour == notify_hour and abs(current_minute - notify_minute) <= 30:
                    business_id = setting.get('businessId')
                    fcm_tokens = setting.get('fcmTokens', [])
                    web_tokens = setting.get('webPushTokens', [])
                    
                    if business_id and (fcm_tokens or web_tokens):
                        # Check if business has plants needing water
                        plants_query = """
                        SELECT COUNT(1) as count 
                        FROM c 
                        WHERE c.businessId = @businessId 
                        AND c.productType = 'plant' 
                        AND c.status = 'active'
                        AND (c.wateringSchedule.needsWatering = true OR c.wateringSchedule.activeWaterDays <= 0)
                        """
                        
                        plant_count_result = list(inventory_container.query_items(
                            query=plants_query,
                            parameters=[{"name": "@businessId", "value": business_id}],
                            enable_cross_partition_query=True
                        ))
                        
                        plants_needing_water = plant_count_result[0]['count'] if plant_count_result else 0
                        
                        if plants_needing_water > 0:
                            # Get specific plant names for notification
                            plants_query_details = """
                            SELECT c.common_name
                            FROM c 
                            WHERE c.businessId = @businessId 
                            AND c.productType = 'plant' 
                            AND c.status = 'active'
                            AND (c.wateringSchedule.needsWatering = true OR c.wateringSchedule.activeWaterDays <= 0)
                            """
                            
                            plants_details = list(inventory_container.query_items(
                                query=plants_query_details,
                                parameters=[{"name": "@businessId", "value": business_id}],
                                enable_cross_partition_query=True
                            ))
                            
                            plant_names = [p.get('common_name', 'Unknown Plant') for p in plants_details[:3]]  # Max 3 names
                            
                            businesses_to_notify.append({
                                'businessId': business_id,
                                'fcmTokens': fcm_tokens,
                                'webPushTokens': web_tokens,
                                'plantsCount': plants_needing_water,
                                'plantNames': plant_names,
                                'notificationTime': notification_time,
                                'settingId': setting.get('id')
                            })
                            
            except ValueError:
                logging.warning(f'Invalid notification time format: {notification_time}')
                continue
        
        return businesses_to_notify
        
    except Exception as e:
        logging.error(f'Error getting businesses needing notifications: {str(e)}')
        return []

def update_notification_log(settings_id, business_id, success, message):
    """Update notification log in database"""
    try:
        params = dict(param.split('=', 1) for param in MARKETPLACE_CONNECTION_STRING.split(';'))
        client = CosmosClient(params['AccountEndpoint'], credential=params['AccountKey'])
        database = client.get_database_client(MARKETPLACE_DATABASE_NAME)
        notifications_container = database.get_container_client("watering_notifications")
        
        # Update the settings record with last notification info
        try:
            settings_item = notifications_container.read_item(item=settings_id, partition_key=business_id)
            settings_item['lastNotificationSent'] = datetime.utcnow().isoformat()
            settings_item['lastNotificationSuccess'] = success
            settings_item['lastNotificationMessage'] = message
            notifications_container.replace_item(item=settings_id, body=settings_item)
        except:
            logging.warning(f'Could not update notification log for {business_id}')
        
    except Exception as e:
        logging.error(f'Error updating notification log: {str(e)}')

def main(mytimer: func.TimerRequest) -> None:
    """Timer trigger function that runs every hour to send watering notifications"""
    utc_timestamp = datetime.utcnow().replace(tzinfo=timezone.utc).isoformat()
    
    if mytimer.past_due:
        logging.info('The notification timer is past due!')
    
    logging.info('Watering notification scheduler started at %s', utc_timestamp)
    
    try:
        businesses_to_notify = get_businesses_needing_notifications()
        
        if not businesses_to_notify:
            logging.info('No businesses need watering notifications at this time')
            return
        
        logging.info(f'Found {len(businesses_to_notify)} businesses needing notifications')
        
        total_notifications_sent = 0
        
        for business in businesses_to_notify:
            try:
                business_id = business['businessId']
                plants_count = business['plantsCount']
                plant_names = business['plantNames']
                fcm_tokens = business['fcmTokens']
                web_tokens = business['webPushTokens']
                
                # Create notification content
                if plants_count == 1:
                    title = "🌱 Plant Watering Reminder"
                    body = f"{plant_names[0]} needs watering today!"
                elif plants_count <= 3:
                    title = f"🌱 {plants_count} Plants Need Watering"
                    body = f"{', '.join(plant_names)} need watering today!"
                else:
                    title = f"🌱 {plants_count} Plants Need Watering"
                    body = f"{', '.join(plant_names[:2])} and {plants_count - 2} more plants need watering!"
                
                notification_data = {
                    "type": "watering_reminder",
                    "businessId": business_id,
                    "plantsCount": str(plants_count),
                    "timestamp": datetime.utcnow().isoformat(),
                    "action": "open_watering_checklist"
                }
                
                # Send notifications
                success, message = send_fcm_notification_batch(
                    fcm_tokens, web_tokens, title, body, notification_data
                )
                
                if success:
                    total_notifications_sent += len(fcm_tokens) + len(web_tokens)
                    logging.info(f'✅ Sent watering notifications to business {business_id}: {message}')
                else:
                    logging.error(f'❌ Failed to send notifications to business {business_id}: {message}')
                
                # Update notification log
                update_notification_log(business['settingId'], business_id, success, message)
                
            except Exception as e:
                logging.error(f'Error processing notifications for business {business.get("businessId", "unknown")}: {str(e)}')
                continue
        
        logging.info(f'Watering notification scheduler completed. Sent {total_notifications_sent} notifications to {len(businesses_to_notify)} businesses.')
        
    except Exception as e:
        logging.error(f'Watering notification scheduler failed: {str(e)}')