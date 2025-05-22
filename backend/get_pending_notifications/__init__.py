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
        
        # Get business ID from headers or params
        business_id = req.headers.get('X-Business-ID') or req.params.get('businessId')
        
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
        
        # Initialize Cosmos client with proper connection string handling
        connection_string = os.environ.get("COSMOSDB__MARKETPLACE_CONNECTION_STRING")
        database_id = os.environ.get("COSMOSDB_MARKETPLACE_DATABASE_NAME", "GreenerMarketplace")
        inventory_container_id = "inventory"
        notifications_container_id = "watering_notifications"
        
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
        inventory_container = database.get_container_client(inventory_container_id)
        
        # Try to get notifications container, create if doesn't exist
        try:
            notifications_container = database.get_container_client(notifications_container_id)
            notifications_container.read()
        except Exception:
            logging.info(f"Creating container {notifications_container_id}")
            from azure.cosmos import PartitionKey
            notifications_container = database.create_container(
                id=notifications_container_id,
                partition_key=PartitionKey(path="/businessId"),
                offer_throughput=400
            )
        
        # Get notification settings for this business
        settings_query = """
            SELECT * FROM c 
            WHERE c.businessId = @businessId 
            AND c.status = 'active'
        """
        
        try:
            settings = list(notifications_container.query_items(
                query=settings_query,
                parameters=[{"name": "@businessId", "value": business_id}],
                enable_cross_partition_query=True
            ))
        except Exception:
            settings = []
        
        # Check if it's notification time
        current_time = datetime.datetime.utcnow()
        current_time_str = current_time.strftime("%H:%M")
        
        is_notification_time = True  # Always return notifications for demo
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
        """
        
        try:
            all_plants = list(inventory_container.query_items(
                query=plants_query,
                parameters=[{"name": "@businessId", "value": business_id}],
                enable_cross_partition_query=True
            ))
            
            # Filter plants that need watering
            plants_needing_water = []
            for plant in all_plants:
                watering_schedule = plant.get('wateringSchedule', {})
                if watering_schedule.get('needsWatering', False):
                    plants_needing_water.append(plant)
                elif watering_schedule.get('activeWaterDays', 999) <= 0:
                    plants_needing_water.append(plant)
        except Exception as e:
            logging.warning(f"Error querying plants: {str(e)}")
            plants_needing_water = []
        
        # Get plants watered today
        today = current_time.strftime("%Y-%m-%d")
        plants_watered_today = []
        
        try:
            for plant in all_plants:
                watering_schedule = plant.get('wateringSchedule', {})
                if watering_schedule.get('lastWatered') == today:
                    plants_watered_today.append(plant)
        except Exception:
            plants_watered_today = []
        
        # Get low stock inventory items (mock for now)
        low_stock_items = []
        
        # Create notification data
        notifications = []
        
        # Demo notifications for testing
        if len(plants_needing_water) > 0 or True:  # Always show demo notification
            demo_plant_count = max(len(plants_needing_water), 1)
            notifications.append({
                "id": f"watering_{current_time.strftime('%Y%m%d_%H')}",
                "type": "WATERING_REMINDER",
                "title": "🌱 Plant Watering Reminder",
                "message": f"You have {demo_plant_count} plant{'s' if demo_plant_count != 1 else ''} that need watering today.",
                "plantCount": demo_plant_count,
                "plants": [{"id": "demo-plant", "name": "Demo Plant"}],
                "timestamp": current_time.isoformat(),
                "urgent": demo_plant_count > 3,
                "action": "open_watering_checklist"
            })
        
        # Success notifications for plants watered today
        if len(plants_watered_today) >= 1:
            notifications.append({
                "id": f"watering_success_{current_time.strftime('%Y%m%d')}",
                "type": "WATERING_SUCCESS",
                "title": "✅ Great Job!",
                "message": f"You've watered {len(plants_watered_today)} plant{'s' if len(plants_watered_today) != 1 else ''} today. Keep it up!",
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
            mimetype="application/json",
            headers={
                "Access-Control-Allow-Origin": "*",
                "Content-Type": "application/json"
            }
        )
    
    except Exception as e:
        logging.error(f"Error getting pending notifications: {str(e)}")
        return func.HttpResponse(
            json.dumps({"error": f"Internal server error: {str(e)}"}),
            status_code=500,
            mimetype="application/json",
            headers={
                "Access-Control-Allow-Origin": "*",
                "Content-Type": "application/json"
            }
        )