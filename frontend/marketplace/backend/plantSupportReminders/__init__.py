import datetime
import logging
import os
from azure.cosmos import CosmosClient
import firebase_admin
from firebase_admin import credentials, messaging

# Initialize Firebase only once
firebase_initialized = False
def init_firebase():
    global firebase_initialized
    if not firebase_initialized:
        cred = credentials.Certificate(os.path.join(os.path.dirname(__file__), 'serviceAccountKey.json'))
        firebase_admin.initialize_app(cred)
        firebase_initialized = True

# Azure Cosmos DB setup
COSMOS_URI = os.environ["COSMOS_URI"]
COSMOS_KEY = os.environ["COSMOS_KEY"]
DATABASE_NAME = "GreenerDB"
USER_PLANTS_CONTAINER = "userPlants"
USERS_CONTAINER = "Users"

def update_next_water(user_plants_container, plant):
    try:
        water_days = plant.get("water_days", 7)
        prev_next_water = plant.get("next_water")
        try:
            prev_dt = datetime.datetime.fromisoformat(prev_next_water)
        except Exception:
            prev_dt = datetime.datetime.utcnow()
        new_next_water = prev_dt + datetime.timedelta(days=water_days)
        user_plants_container.patch_item(
            plant["id"], 
            partition_key=plant["email"], 
            patch_operations=[{"op": "replace", "path": "/next_water", "value": new_next_water.isoformat()}]
        )
        logging.info(f"🔁 Updated next_water for {plant['id']} to {new_next_water}")
    except Exception as e:
        logging.error(f"❌ Failed to update next_water for {plant['id']}: {e}")

def update_next_feed(user_plants_container, plant):
    try:
        feed_str = plant.get("feed", "")
        days = 35
        import re
        match = re.search(r"Every (\d+) week", feed_str)
        if match:
            days = int(match.group(1)) * 7
        else:
            match = re.search(r"Every (\d+) day", feed_str)
            if match:
                days = int(match.group(1))
        prev_next_feed = plant.get("next_feed")
        try:
            prev_dt = datetime.datetime.fromisoformat(prev_next_feed)
        except Exception:
            prev_dt = datetime.datetime.utcnow()
        new_next_feed = prev_dt + datetime.timedelta(days=days)
        user_plants_container.patch_item(
            plant["id"], 
            partition_key=plant["email"], 
            patch_operations=[{"op": "replace", "path": "/next_feed", "value": new_next_feed.isoformat()}]
        )
        logging.info(f"🔁 Updated next_feed for {plant['id']} to {new_next_feed}")
    except Exception as e:
        logging.error(f"❌ Failed to update next_feed for {plant['id']}: {e}")

def main(mytimer):
    logging.warning(f"🟢 Function started at {datetime.datetime.utcnow().isoformat()}")
    logging.info("🌿 plantSupportReminders function triggered!")

    init_firebase()

    client = CosmosClient(COSMOS_URI, credential=COSMOS_KEY)
    db = client.get_database_client(DATABASE_NAME)
    user_plants_container = db.get_container_client(USER_PLANTS_CONTAINER)
    users_container = db.get_container_client(USERS_CONTAINER)

    today = datetime.datetime.utcnow().date()
    plants = list(user_plants_container.read_all_items())

    for plant in plants:
        email = plant.get("email")
        plant_id = plant.get("id")
        common_name = plant.get("common_name") or plant.get("nickname", "your plant")
        logging.info(f"🔍 Checking plant {plant_id} for user {email}")

        water_due = False
        feed_due = False

        try:
            next_water = datetime.datetime.fromisoformat(plant.get("next_water"))
            if next_water.date() <= today:
                water_due = True
                logging.info(f"💧 Water is due for {common_name}")
        except Exception:
            water_due = True
            logging.warning(f"⚠️ next_water missing or invalid for {plant_id}, treating as due.")

        try:
            next_feed = datetime.datetime.fromisoformat(plant.get("next_feed"))
            if next_feed.date() <= today:
                feed_due = True
                logging.info(f"🌿 Feed is due for {common_name}")
        except Exception:
            feed_due = False
            logging.warning(f"⚠️ next_feed missing or invalid for {plant_id}, skipping feed notification.")

        if not (water_due or feed_due):
            logging.info(f"✅ No care due today for {common_name}")
            continue

        try:
            user = users_container.read_item(email, partition_key=email)
            web_token = user.get("webPushSubscription")
            fcm_token = user.get("fcmToken")

            # Send to both if both tokens exist (optional: you could choose to send to one)
            if water_due:
                if web_token:
                    send_push(web_token, f"💧 Time to water your {common_name}!", is_web_push=True)
                if fcm_token:
                    send_push(fcm_token, f"💧 Time to water your {common_name}!", is_web_push=False)
                update_next_water(user_plants_container, plant)
            if feed_due:
                if web_token:
                    send_push(web_token, f"🌿 Time to fertilize your {common_name}!", is_web_push=True)
                if fcm_token:
                    send_push(fcm_token, f"🌿 Time to fertilize your {common_name}!", is_web_push=False)
                update_next_feed(user_plants_container, plant)

        except Exception as e:
            logging.warning(f"⚠️ Could not fetch/send notification for user {email}: {e}")
            continue

def send_push(token, message, is_web_push=False):
    try:
        if is_web_push:
            msg = messaging.Message(
                notification=messaging.Notification(
                    title="🌱 Plant Care Reminder",
                    body=message
                ),
                token=token,
                webpush=messaging.WebpushConfig(
                    notification=messaging.WebpushNotification(
                        title="🌱 Plant Care Reminder",
                        body=message
                    )
                )
            )
        else:
            msg = messaging.Message(
                notification=messaging.Notification(
                    title="🌱 Plant Care Reminder",
                    body=message
                ),
                token=token
            )
        response = messaging.send(msg)
        logging.info(f"✅ Sent push: {message}")
    except Exception as e:
        logging.error(f"❌ Failed to send notification: {e}")