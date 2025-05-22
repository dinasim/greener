# daily_watering_update/__init__.py
import logging
import azure.functions as func
import datetime
import requests
import os
import json
import traceback
from azure.cosmos import CosmosClient, PartitionKey

def main(mytimer: func.TimerRequest) -> None:
    utc_timestamp = datetime.datetime.utcnow().replace(
        tzinfo=datetime.timezone.utc).isoformat()
    
    logging.info('Daily watering update function executed at: %s', utc_timestamp)
    
    try:
        # Initialize Cosmos client
        endpoint = os.environ.get("COSMOSDB__MARKETPLACE_CONNECTION_STRING")
        key = os.environ.get("COSMOSDB_KEY")
        database_id = os.environ.get("COSMOSDB_MARKETPLACE_DATABASE_NAME", "GreenerMarketplace")
        container_id = "inventory"
        
        client = CosmosClient(endpoint, key)
        database = client.get_database_client(database_id)
        container = database.get_container_client(container_id)
        
        # Get all businesses with plants in inventory
        business_query = "SELECT DISTINCT c.businessId FROM c WHERE c.productType = 'plant' AND IS_DEFINED(c.location)"
        businesses = list(container.query_items(
            query=business_query,
            enable_cross_partition_query=True
        ))
        
        logging.info(f"Found {len(businesses)} businesses with plants")
        
        for business in businesses:
            business_id = business['businessId']
            
            # Get business location from the first plant with GPS coordinates
            location_query = """
                SELECT TOP 1 c.location.gpsCoordinates FROM c 
                WHERE c.businessId = @businessId 
                AND c.productType = 'plant' 
                AND IS_DEFINED(c.location.gpsCoordinates)
            """
            
            locations = list(container.query_items(
                query=location_query,
                parameters=[{"name": "@businessId", "value": business_id}],
                enable_cross_partition_query=True
            ))
            
            if not locations or 'gpsCoordinates' not in locations[0]:
                logging.warning(f"No GPS coordinates found for business: {business_id}")
                # Try to continue with default coordinates or skip weather check
                weather_data = None
                has_rained = False
            else:
                coordinates = locations[0]['gpsCoordinates']
                
                # Check weather for business location
                weather_data = check_weather(coordinates['latitude'], coordinates['longitude'])
                has_rained = did_it_rain(weather_data)
                
                logging.info(f"Weather check for {business_id}: Rain detected: {has_rained}")
            
            # Update all plants for this business
            update_plants_watering_schedule(container, business_id, has_rained)
        
        logging.info("Successfully completed daily watering update")
        
    except Exception as e:
        logging.error(f"Error in daily watering update: {str(e)}")
        logging.error(traceback.format_exc())
        raise

def check_weather(lat, lon):
    """Check weather at specific coordinates using OpenWeatherMap API (Developer Plan)"""
    try:
        # Use the provided API key from environment variables
        api_key = os.environ.get("OPENWEATHER_API_KEY", "b81c1f9ba90f1703b8856b039df48067")
        
        # Use pro endpoint for Developer plan and units=metric to get temperature in Celsius
        url = f"https://pro.openweathermap.org/data/2.5/weather?lat={lat}&lon={lon}&appid={api_key}&units=metric"
        
        logging.info(f"Fetching weather data for coordinates: {lat}, {lon}")
        response = requests.get(url, timeout=10)  # Add timeout for reliability
        
        if response.status_code == 200:
            data = response.json()
            logging.info(f"Weather data received: {data.get('weather', [{}])[0].get('main', 'Unknown')}")
            return data
        else:
            logging.error(f"Error fetching weather data: HTTP {response.status_code}")
            logging.error(f"Response content: {response.text}")
            return None
    
    except requests.exceptions.Timeout:
        logging.error("Timeout while fetching weather data")
        return None
    except requests.exceptions.RequestException as e:
        logging.error(f"Request error checking weather: {str(e)}")
        return None
    except Exception as e:
        logging.error(f"Unexpected error checking weather: {str(e)}")
        return None

def did_it_rain(weather_data):
    """Determine if it rained based on weather data"""
    if not weather_data or 'weather' not in weather_data or not weather_data['weather']:
        return False
    
    # Weather condition codes: https://openweathermap.org/weather-conditions
    weather_id = weather_data['weather'][0]['id']
    weather_main = weather_data['weather'][0]['main'].lower()
    
    # 2xx: Thunderstorm, 3xx: Drizzle, 5xx: Rain
    is_rain_code = (200 <= weather_id < 600)
    
    # Also check the main weather description
    is_rain_desc = 'rain' in weather_main or 'drizzle' in weather_main or 'thunderstorm' in weather_main
    
    logging.info(f"Weather ID: {weather_id}, Main: {weather_main}, Is rain: {is_rain_code or is_rain_desc}")
    
    return is_rain_code or is_rain_desc

def update_plants_watering_schedule(container, business_id, has_rained):
    """Update watering schedule for all plants of a business"""
    try:
        # Get all plants for this business
        plants_query = """
            SELECT * FROM c 
            WHERE c.businessId = @businessId 
            AND c.productType = 'plant'
        """
        
        plants = list(container.query_items(
            query=plants_query,
            parameters=[{"name": "@businessId", "value": business_id}],
            enable_cross_partition_query=True
        ))
        
        logging.info(f"Updating {len(plants)} plants for business {business_id}")
        
        today = datetime.datetime.now().strftime("%Y-%m-%d")
        updates = []
        
        for plant in plants:
            needs_update = False
            
            # Initialize watering schedule if it doesn't exist
            if 'wateringSchedule' not in plant:
                water_days = plant.get('water_days', 7)  # Default to weekly watering
                plant['wateringSchedule'] = {
                    "waterDays": water_days,
                    "activeWaterDays": water_days,
                    "lastWatered": None,
                    "lastWateringUpdate": today,
                    "needsWatering": False,
                    "weatherAffected": False
                }
                needs_update = True
                logging.info(f"Initialized watering schedule for plant {plant.get('id')}")
            
            # If it rained, reset the countdown
            if has_rained:
                plant['wateringSchedule']['activeWaterDays'] = plant['wateringSchedule'].get('waterDays', 7)
                plant['wateringSchedule']['needsWatering'] = False
                plant['wateringSchedule']['weatherAffected'] = True
                plant['wateringSchedule']['lastWateringUpdate'] = today
                needs_update = True
                logging.info(f"Reset watering schedule due to rain for plant {plant.get('id')}")
            
            # Otherwise, decrease activeWaterDays by 1 if not updated today
            elif plant['wateringSchedule'].get('lastWateringUpdate') != today:
                current_days = plant['wateringSchedule'].get('activeWaterDays', 0)
                plant['wateringSchedule']['activeWaterDays'] = max(0, current_days - 1)
                plant['wateringSchedule']['needsWatering'] = plant['wateringSchedule']['activeWaterDays'] <= 0
                plant['wateringSchedule']['weatherAffected'] = False
                plant['wateringSchedule']['lastWateringUpdate'] = today
                needs_update = True
                logging.info(f"Decreased activeWaterDays for plant {plant.get('id')} to {plant['wateringSchedule']['activeWaterDays']}")
            
            if needs_update:
                updates.append({
                    "id": plant['id'],
                    "businessId": business_id,
                    "wateringSchedule": plant['wateringSchedule']
                })
        
        # Update plants in batches
        BATCH_SIZE = 20
        for i in range(0, len(updates), BATCH_SIZE):
            batch = updates[i:i+BATCH_SIZE]
            for item in batch:
                try:
                    container.upsert_item({
                        "id": item["id"],
                        "businessId": item["businessId"],
                        "wateringSchedule": item["wateringSchedule"]
                    }, partition_key=item["businessId"])
                except Exception as e:
                    logging.error(f"Error updating plant {item['id']}: {str(e)}")
        
        logging.info(f"Updated {len(updates)} plants for business {business_id}")
        
        # If plants need watering, trigger notifications
        needs_watering = [p for p in plants if p.get('wateringSchedule', {}).get('needsWatering', False)]
        if needs_watering:
            logging.info(f"{len(needs_watering)} plants need watering for business {business_id}. Scheduling notifications.")
            # Note: Notifications are handled by the separate send_watering_notifications function
        
        return True
    
    except Exception as e:
        logging.error(f"Error updating plants for business {business_id}: {str(e)}")
        logging.error(traceback.format_exc())
        return False