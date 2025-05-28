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

            token = None
            if isinstance(web_token, str):
                token = web_token
            elif isinstance(fcm_token, str):
                token = fcm_token

            if not token:
                logging.warning(f"❌ No valid push token for user {email}")
                continue

            logging.info(f"📲 Using token for {email}: {token}")
        except Exception as e:
            logging.warning(f"⚠️ Could not fetch user {email}: {e}")
            continue

        if water_due:
            send_push(token, f"💧 Time to water your {common_name}!")
        if feed_due:
            send_push(token, f"🌿 Time to fertilize your {common_name}!")

def send_push(token, message):
    try:
        message = messaging.Message(
            notification=messaging.Notification(
                title="🌱 Plant Care Reminder",
                body=message
            ),
            token=token
        )
        response = messaging.send(message)
        logging.info(f"✅ Sent push: {message.notification.body}")
    except Exception as e:
        logging.error(f"❌ Failed to send notification: {e}")
