import datetime
import logging
import os
import requests
from azure.cosmos import CosmosClient

COSMOS_URI = os.environ["COSMOS_URI"]
COSMOS_KEY = os.environ["COSMOS_KEY"]
DATABASE_NAME = "GreenerDB"
USER_PLANTS_CONTAINER = "userPlants"
USERS_CONTAINER = "Users"
EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"

def main(mytimer):
    logging.info('plantSupportReminders function triggered!')

    client = CosmosClient(COSMOS_URI, credential=COSMOS_KEY)
    db = client.get_database_client(DATABASE_NAME)
    user_plants_container = db.get_container_client(USER_PLANTS_CONTAINER)
    users_container = db.get_container_client(USERS_CONTAINER)

    now = datetime.datetime.utcnow()
    today_str = now.date().isoformat()

    # Find plants needing watering or feeding today
    query = """
    SELECT * FROM c
    WHERE STARTSWITH(c.next_water, @today) OR STARTSWITH(c.next_feed, @today)
    """
    params = [{"name": "@today", "value": today_str}]
    plants = list(user_plants_container.query_items(query, parameters=params, enable_cross_partition_query=True))

    for plant in plants:
        email = plant.get('email')
        common_name = plant.get('common_name')
        water_due = plant.get('next_water', '').startswith(today_str)
        feed_due = plant.get('next_feed', '').startswith(today_str)

        if not email or (not water_due and not feed_due):
            continue
        try:
            user = users_container.read_item(email, partition_key=email)
            token = user.get('expoPushToken')
            if not token:
                continue
        except Exception as e:
            logging.warning(f"Could not fetch user {email}: {e}")
            continue

        if water_due:
            send_push(token, f"💧 Time to water your {common_name}!")
        if feed_due:
            send_push(token, f"🌿 Time to fertilize your {common_name}!")

def send_push(token, message):
    notification = {
        "to": token,
        "sound": "default",
        "title": "🌱 Plant Care Reminder",
        "body": message
    }
    try:
        resp = requests.post(EXPO_PUSH_URL, json=notification)
        resp.raise_for_status()
        logging.info(f"Sent notification: {message}")
    except Exception as e:
        logging.error(f"Failed to send notification: {e}")
