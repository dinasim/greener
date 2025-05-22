# get_pending_notifications/__init__.py
import logging
import azure.functions as func
import json
import datetime
import os
from azure.cosmos import CosmosClient

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Get Pending Notifications API triggered.')
    
    try:
        # Get business ID from headers or params
        business_id = req.headers.get('X-Business-ID') or req.params.get('businessId')
        
        if not business_id:
            return func.HttpResponse(
                json.dumps({"error": "Business ID is required"}),
                status_code=400,
                mimetype="application/json"
            )
        
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
        
        # Get notification settings for this business
        settings_query = """
            SELECT * FROM c 
            WHERE c.businessId = @businessId 
            AND c.status = 'active'
        """
        
        settings = list(notifications_container.query_items(
            query=settings_query,
            parameters=[{"name": "@businessId", "value": business_id}],
            enable_cross_partition_query=True
        ))
        
        # Check if it's notification time
        current_time = datetime.datetime.utcnow()
        current_time_str = current_time.strftime("%H:%M")
        
        is_notification_time = False
        notification_time_setting = "07:00"
        
        for setting in settings:
            setting_time = setting.get('notificationTime', '07:00')
            notification_time_setting = setting_time
            
            # Check if current time is within 30 minutes of notification time
            notification_dt = datetime.datetime.strptime(setting_time, "%H:%M").time()
            current_dt = current_time.time()
            
            # Convert to minutes for comparison
            notification_minutes = notification_dt.hour * 60 + notification_dt.minute
            current_minutes = current_dt.hour * 60 + current_dt.minute
            
            # Check if within 30 minutes
            time_diff = abs(current_minutes - notification_minutes)
            if time_diff <= 30 or time_diff >= (24 * 60 - 30):  # Handle midnight crossover
                is_notification_time = True
                break
        
        # Get plants that need watering
        plants_query = """
            SELECT c.id, c.name, c.common_name, c.wateringSchedule, c.location
            FROM c 
            WHERE c.businessId = @businessId 
            AND c.productType = 'plant' 
            AND c.wateringSchedule.needsWatering = true
        """
        
        plants_needing_water = list(inventory_container.query_items(
            query=plants_query,
            parameters=[{"name": "@businessId", "value": business_id}],
            enable_cross_partition_query=True
        ))
        
        # Get plants watered today
        today = current_time.strftime("%Y-%m-%d")
        plants_watered_today_query = """
            SELECT c.id, c.name, c.common_name, c.wateringSchedule.lastWatered
            FROM c 
            WHERE c.businessId = @businessId 
            AND c.productType = 'plant' 
            AND c.wateringSchedule.lastWatered = @today
        """
        
        plants_watered_today = list(inventory_container.query_items(
            query=plants_watered_today_query,
            parameters=[
                {"name": "@businessId", "value": business_id},
                {"name": "@today", "value": today}
            ],
            enable_cross_partition_query=True
        ))
        
        # Get low stock inventory items
        low_stock_query = """
            SELECT c.id, c.name, c.common_name, c.quantity, c.minThreshold
            FROM c 
            WHERE c.businessId = @businessId 
            AND c.productType = 'plant' 
            AND c.quantity <= c.minThreshold
        """
        
        low_stock_items = list(inventory_container.query_items(
            query=low_stock_query,
            parameters=[{"name": "@businessId", "value": business_id}],
            enable_cross_partition_query=True
        ))
        
        # Create notification data
        notifications = []
        
        # Watering notifications
        if plants_needing_water and is_notification_time:
            plant_names = [p.get('name') or p.get('common_name') for p in plants_needing_water[:3]]
            
            if len(plants_needing_water) == 1:
                message = f"{plant_names[0]} needs watering today."
            elif len(plants_needing_water) <= 3:
                message = f"{', '.join(plant_names)} need watering today."
            else:
                message = f"{', '.join(plant_names)} and {len(plants_needing_water) - 3} more plants need watering today."
            
            notifications.append({
                "id": f"watering_{current_time.strftime('%Y%m%d')}",
                "type": "WATERING_REMINDER",
                "title": "🌱 Plant Watering Reminder",
                "message": message,
                "plantCount": len(plants_needing_water),
                "plants": [{"id": p["id"], "name": p.get('name') or p.get('common_name')} for p in plants_needing_water],
                "timestamp": current_time.isoformat(),
                "urgent": len(plants_needing_water) > 5,
                "action": "open_watering_checklist"
            })
        
        # Low stock notifications (daily at 9 AM)
        if low_stock_items and current_time.hour == 9 and current_time.minute <= 30:
            if len(low_stock_items) == 1:
                stock_message = f"{low_stock_items[0].get('name') or low_stock_items[0].get('common_name')} is running low."
            else:
                stock_message = f"You have {len(low_stock_items)} items running low in stock."
            
            notifications.append({
                "id": f"low_stock_{current_time.strftime('%Y%m%d')}",
                "type": "LOW_STOCK_ALERT",
                "title": "📦 Low Stock Alert",
                "message": stock_message,
                "itemCount": len(low_stock_items),
                "items": [{"id": item["id"], "name": item.get('name') or item.get('common_name'), "quantity": item.get('quantity', 0)} for item in low_stock_items],
                "timestamp": current_time.isoformat(),
                "urgent": any(item.get('quantity', 0) == 0 for item in low_stock_items),
                "action": "open_inventory"
            })
        
        # Success notifications for plants watered today
        if plants_watered_today and len(plants_watered_today) >= 3:
            notifications.append({
                "id": f"watering_success_{current_time.strftime('%Y%m%d')}",
                "type": "WATERING_SUCCESS",
                "title": "✅ Great Job!",
                "message": f"You've watered {len(plants_watered_today)} plants today. Keep it up!",
                "plantCount": len(plants_watered_today),
                "timestamp": current_time.isoformat(),
                "urgent": False,
                "action": "none"
            })
        
        return func.HttpResponse(
            json.dumps({
                "notifications": notifications,
                "hasNotifications": len(notifications) > 0,
                "businessId": business_id,
                "notificationTime": notification_time_setting,
                "isNotificationTime": is_notification_time,
                "currentTime": current_time_str,
                "summary": {
                    "plantsNeedingWater": len(plants_needing_water),
                    "plantsWateredToday": len(plants_watered_today),
                    "lowStockItems": len(low_stock_items)
                },
                "timestamp": current_time.isoformat()
            }),
            status_code=200,
            mimetype="application/json"
        )
    
    except Exception as e:
        logging.error(f"Error getting pending notifications: {str(e)}")
        return func.HttpResponse(
            json.dumps({"error": f"Internal server error: {str(e)}"}),
            status_code=500,
            mimetype="application/json"
        )