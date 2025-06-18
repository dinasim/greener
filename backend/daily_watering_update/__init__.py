# daily-watering-update/__init__.py - COMPLETE & FIXED VERSION
import logging
import json
import azure.functions as func
from azure.cosmos import CosmosClient, exceptions
import os
import requests
from datetime import datetime, timedelta, timezone

# Database connection
MARKETPLACE_CONNECTION_STRING = os.environ.get("COSMOSDB__MARKETPLACE_CONNECTION_STRING")
MARKETPLACE_DATABASE_NAME = os.environ.get("COSMOSDB_MARKETPLACE_DATABASE_NAME", "greener-marketplace-db")

# OpenWeatherMap API key
OPENWEATHER_API_KEY = os.environ.get("OPENWEATHER_API_KEY")

def check_weather_for_rain(lat, lon):
    """Check if it rained today using OpenWeatherMap API"""
    try:
        if not OPENWEATHER_API_KEY:
            logging.warning("OpenWeatherMap API key not configured - assuming no rain")
            return False
        
        # Current weather API
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
        
        # Also check if it's currently raining
        weather_condition = weather_data.get('weather', [{}])[0].get('main', '').lower()
        is_currently_raining = weather_condition in ['rain', 'drizzle', 'thunderstorm']
        
        # Consider it rained if:
        # - More than 1mm in last hour OR
        # - More than 3mm in last 3 hours OR  
        # - Currently raining
        rained = rain_1h > 1.0 or rain_3h > 3.0 or is_currently_raining
        
        logging.info(f'Weather check for ({lat}, {lon}): rain_1h={rain_1h}mm, rain_3h={rain_3h}mm, condition={weather_condition}, rained={rained}')
        
        return rained
        
    except requests.RequestException as e:
        logging.error(f'Weather API request failed: {str(e)}')
        return False  # Assume no rain if API fails
    except Exception as e:
        logging.error(f'Error checking weather: {str(e)}')
        return False

def get_business_locations():
    """Get all business locations for weather checking"""
    try:
        params = dict(param.split('=', 1) for param in MARKETPLACE_CONNECTION_STRING.split(';'))
        client = CosmosClient(params['AccountEndpoint'], credential=params['AccountKey'])
        database = client.get_database_client(MARKETPLACE_DATABASE_NAME)
        
        # Try business_users container first
        try:
            business_container = database.get_container_client("business_users")
            businesses = list(business_container.query_items(
                query="SELECT c.id, c.location FROM c WHERE c.userType = 'business' OR c.type = 'business'",
                enable_cross_partition_query=True
            ))
        except:
            # Fallback: get all users and filter
            users_container = database.get_container_client("Users")
            businesses = list(users_container.query_items(
                query="SELECT c.id, c.email, c.location FROM c WHERE c.type = 'business'",
                enable_cross_partition_query=True
            ))
            # Convert to expected format
            businesses = [{'id': b.get('email', b.get('id')), 'location': b.get('location', {})} for b in businesses]
        
        logging.info(f'Found {len(businesses)} businesses for weather checking')
        return businesses
        
    except Exception as e:
        logging.error(f'Error getting business locations: {str(e)}')
        return []

def update_daily_watering_schedule():
    """Update watering schedule for all business plants - FIXED VERSION"""
    try:
        # Connect to database
        params = dict(param.split('=', 1) for param in MARKETPLACE_CONNECTION_STRING.split(';'))
        client = CosmosClient(params['AccountEndpoint'], credential=params['AccountKey'])
        database = client.get_database_client(MARKETPLACE_DATABASE_NAME)
        inventory_container = database.get_container_client("inventory")
        
        # Get business locations for weather checking
        businesses = get_business_locations()
        
        # Check weather for each unique location
        weather_cache = {}
        for business in businesses:
            location = business.get('location', {})
            lat = location.get('latitude', 32.0853)  # Default: Hadera, Israel
            lon = location.get('longitude', 34.7818)
            
            location_key = f"{lat},{lon}"
            if location_key not in weather_cache:
                weather_cache[location_key] = check_weather_for_rain(lat, lon)
        
        logging.info(f'Weather cache built for {len(weather_cache)} locations')
        
        # Get all plant inventory items
        inventory_items = list(inventory_container.query_items(
            query="SELECT * FROM c WHERE c.productType = 'plant' AND c.status = 'active'",
            enable_cross_partition_query=True
        ))

        # Load all business profiles for smartWeatherWatering setting
        business_profiles = {}
        try:
            business_container = database.get_container_client("business_users")
            for b in businesses:
                try:
                    profile = business_container.read_item(item=b['id'], partition_key=b['id'])
                    business_profiles[b['id']] = profile
                except Exception:
                    continue
        except Exception as e:
            logging.warning(f'Could not load business profiles for smartWeatherWatering: {str(e)}')

        updated_count = 0
        initialized_count = 0
        current_date = datetime.now(timezone.utc)
        today_str = current_date.strftime('%Y-%m-%d')
        
        logging.info(f'Processing {len(inventory_items)} plant inventory items')
        
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
                
                # Initialize watering schedule if doesn't exist
                if not watering_schedule or 'waterDays' not in watering_schedule:
                    watering_schedule = {
                        'waterDays': water_days,
                        'activeWaterDays': water_days,
                        'lastWateringUpdate': today_str,
                        'needsWatering': False,
                        'weatherAffected': False,
                        'lastWatered': None,
                        'createdAt': current_date.isoformat()
                    }
                    initialized_count += 1
                    logging.info(f'Initialized watering schedule for plant {item.get("id", "unknown")}')
                else:
                    # Check if we already updated today
                    last_update = watering_schedule.get('lastWateringUpdate', '')
                    if last_update == today_str:
                        continue  # Already updated today
                
                # Get business smartWeatherWatering setting
                smart_weather = False
                profile = business_profiles.get(business_id)
                if profile:
                    smart_weather = profile.get('settings', {}).get('smartWeatherWatering', False)
                
                # Get plant site (indoor/outdoor)
                site = item.get('site', '').lower() if 'site' in item else item.get('plantInfo', {}).get('site', '').lower()
                
                # Update watering schedule
                if smart_weather and site == 'outdoor' and it_rained:
                    # Auto-watered by rain for outdoor plants
                    watering_schedule['activeWaterDays'] = water_days
                    watering_schedule['weatherAffected'] = True
                    watering_schedule['needsWatering'] = False
                    watering_schedule['autoWateredByRain'] = True
                    logging.debug(f'Auto-watered by rain (smartWeather) for outdoor plant {item.get("id", "unknown")}')
                else:
                    # Normal logic
                    current_active_days = watering_schedule.get('activeWaterDays', water_days)
                    watering_schedule['activeWaterDays'] = max(0, current_active_days - 1)
                    watering_schedule['weatherAffected'] = False
                    watering_schedule['needsWatering'] = watering_schedule['activeWaterDays'] <= 0
                    watering_schedule['autoWateredByRain'] = False
                
                watering_schedule['lastWateringUpdate'] = today_str
                watering_schedule['updatedAt'] = current_date.isoformat()
                
                # Update the item
                item['wateringSchedule'] = watering_schedule
                item['lastUpdated'] = current_date.isoformat()
                
                # Save to database
                inventory_container.replace_item(item=item['id'], body=item)
                updated_count += 1
                
                if updated_count % 50 == 0:  # Log progress every 50 items
                    logging.info(f'Progress: {updated_count} plants updated')
                
            except Exception as e:
                logging.error(f'Error updating item {item.get("id", "unknown")}: {str(e)}')
                continue
        
        result = {
            'success': True,
            'updatedPlants': updated_count,
            'initializedPlants': initialized_count,
            'processedBusinesses': len(businesses),
            'weatherChecks': len(weather_cache),
            'timestamp': current_date.isoformat(),
            'weatherResults': {location: rained for location, rained in weather_cache.items()}
        }
        
        logging.info(f'Daily watering update completed successfully: {result}')
        return result
        
    except Exception as e:
        logging.error(f'Daily watering update error: {str(e)}')
        raise

def main(mytimer: func.TimerRequest) -> None:
    """Timer trigger function that runs daily at 6:00 AM UTC"""
    utc_timestamp = datetime.now(timezone.utc).isoformat()
    
    if mytimer.past_due:
        logging.info('The watering update timer is past due!')
    
    logging.info('Daily watering update timer trigger function started at %s', utc_timestamp)
    
    try:
        result = update_daily_watering_schedule()
        logging.info(f'✅ Daily watering update completed successfully: Updated {result["updatedPlants"]} plants, initialized {result["initializedPlants"]} new schedules')
    except Exception as e:
        logging.error(f'❌ Daily watering update failed: {str(e)}')
        # Don't re-raise - we don't want the function to fail completely