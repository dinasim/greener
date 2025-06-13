# daily-watering-update/__init__.py
import logging
import json
import azure.functions as func
from azure.cosmos import CosmosClient
import os
import requests
from datetime import datetime, timedelta

# Database connection
MARKETPLACE_CONNECTION_STRING = os.environ.get("COSMOSDB__MARKETPLACE_CONNECTION_STRING")
MARKETPLACE_DATABASE_NAME = os.environ.get("COSMOSDB_MARKETPLACE_DATABASE_NAME", "greener-marketplace-db")

# OpenWeatherMap API key
OPENWEATHER_API_KEY = os.environ.get("OPENWEATHER_API_KEY")

def check_weather_for_rain(lat, lon):
    """Check if it rained today using OpenWeatherMap API"""
    try:
        if not OPENWEATHER_API_KEY:
            logging.warning("OpenWeatherMap API key not configured")
            return False
        
        url = f"http://api.openweathermap.org/data/2.5/weather"
        params = {
            'lat': lat,
            'lon': lon,
            'appid': OPENWEATHER_API_KEY,
            'units': 'metric'
        }
        
        response = requests.get(url, params=params, timeout=10)
        response.raise_for_status()
        
        weather_data = response.json()
        
        # Check if it rained in the last hour or if there's significant precipitation
        rain_1h = weather_data.get('rain', {}).get('1h', 0)
        rain_3h = weather_data.get('rain', {}).get('3h', 0)
        
        # Consider it rained if more than 1mm in last hour or 3mm in last 3 hours
        return rain_1h > 1.0 or rain_3h > 3.0
        
    except Exception as e:
        logging.error(f'Error checking weather: {str(e)}')
        return False

def update_daily_watering_schedule():
    """Update watering schedule for all business plants"""
    try:
        # Connect to database
        params = dict(param.split('=', 1) for param in MARKETPLACE_CONNECTION_STRING.split(';'))
        client = CosmosClient(params['AccountEndpoint'], credential=params['AccountKey'])
        database = client.get_database_client(MARKETPLACE_DATABASE_NAME)
        inventory_container = database.get_container_client("inventory")
        business_container = database.get_container_client("business_users")
        
        # Get all business users to check their locations
        businesses = list(business_container.query_items(
            query="SELECT c.id, c.location FROM c WHERE c.userType = 'business'",
            enable_cross_partition_query=True
        ))
        
        # Check weather for each business location
        weather_cache = {}
        for business in businesses:
            location = business.get('location', {})
            lat = location.get('latitude', 32.0853)  # Default: Hadera
            lon = location.get('longitude', 34.7818)
            
            location_key = f"{lat},{lon}"
            if location_key not in weather_cache:
                weather_cache[location_key] = check_weather_for_rain(lat, lon)
        
        # Get all plant inventory items
        inventory_items = list(inventory_container.query_items(
            query="SELECT * FROM c WHERE c.productType = 'plant' AND c.status = 'active'",
            enable_cross_partition_query=True
        ))
        
        updated_count = 0
        current_date = datetime.utcnow()
        
        for item in inventory_items:
            try:
                business_id = item.get('businessId')
                if not business_id:
                    continue
                
                # Get business location for weather check
                business_location = next(
                    (b.get('location', {}) for b in businesses if b['id'] == business_id),
                    {'latitude': 32.0853, 'longitude': 34.7818}
                )
                
                location_key = f"{business_location.get('latitude', 32.0853)},{business_location.get('longitude', 34.7818)}"
                it_rained = weather_cache.get(location_key, False)
                
                # Get current watering schedule
                watering_schedule = item.get('wateringSchedule', {})
                water_days = item.get('plantInfo', {}).get('water_days', 7)
                
                # Initialize if doesn't exist
                if not watering_schedule:
                    watering_schedule = {
                        'waterDays': water_days,
                        'activeWaterDays': water_days,
                        'lastWateringUpdate': current_date.strftime('%Y-%m-%d'),
                        'needsWatering': False
                    }
                
                # Check if we already updated today
                last_update = watering_schedule.get('lastWateringUpdate', '')
                today_str = current_date.strftime('%Y-%m-%d')
                
                if last_update == today_str:
                    continue  # Already updated today
                
                # Update watering schedule
                if it_rained:
                    # Reset to full watering cycle if it rained
                    watering_schedule['activeWaterDays'] = water_days
                    watering_schedule['weatherAffected'] = True
                    watering_schedule['needsWatering'] = False
                else:
                    # Decrease active water days by 1
                    current_active_days = watering_schedule.get('activeWaterDays', water_days)
                    watering_schedule['activeWaterDays'] = current_active_days - 1
                    watering_schedule['weatherAffected'] = False
                    watering_schedule['needsWatering'] = watering_schedule['activeWaterDays'] <= 0
                
                watering_schedule['lastWateringUpdate'] = today_str
                
                # Update the item
                item['wateringSchedule'] = watering_schedule
                item['lastUpdated'] = current_date.isoformat()
                
                # Save to database
                inventory_container.replace_item(item=item['id'], body=item)
                updated_count += 1
                
            except Exception as e:
                logging.error(f'Error updating item {item.get("id", "unknown")}: {str(e)}')
                continue
        
        logging.info(f'Daily watering update completed. Updated {updated_count} plants.')
        
        return {
            'success': True,
            'updatedPlants': updated_count,
            'processedBusinesses': len(businesses),
            'weatherChecks': len(weather_cache),
            'timestamp': current_date.isoformat()
        }
        
    except Exception as e:
        logging.error(f'Daily watering update error: {str(e)}')
        raise

def main(mytimer: func.TimerRequest) -> None:
    """Timer trigger function that runs daily at 6:00 AM"""
    utc_timestamp = datetime.utcnow().replace(tzinfo=timezone.utc).isoformat()
    
    if mytimer.past_due:
        logging.info('The timer is past due!')
    
    logging.info('Daily watering update timer trigger function started at %s', utc_timestamp)
    
    try:
        result = update_daily_watering_schedule()
        logging.info(f'Daily watering update completed successfully: {result}')
    except Exception as e:
        logging.error(f'Daily watering update failed: {str(e)}')