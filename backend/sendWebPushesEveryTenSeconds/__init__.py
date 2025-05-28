import logging
import azure.functions as func
from azure.cosmos import CosmosClient
import os
import json
import firebase_admin
from firebase_admin import credentials, messaging

firebase_initialized = False
def init_firebase():
    global firebase_initialized
    if not firebase_initialized:
        cred = credentials.Certificate(os.path.join(os.path.dirname(__file__), 'serviceAccountKey.json'))
        firebase_admin.initialize_app(cred)
        firebase_initialized = True

def main(mytimer: func.TimerRequest) -> None:
    logging.info('⏰ Timer function triggered: Sending push to all users.')
    init_firebase()

    # Cosmos DB setup
    endpoint = os.environ.get('COSMOS_URI')
    key = os.environ.get('COSMOS_KEY')
    database_name = 'GreenerDB'
    container_name = 'Users'

    client = CosmosClient(endpoint, credential=key)
    db = client.get_database_client(database_name)
    user_container = db.get_container_client(container_name)

    # Get all users
    query = "SELECT * FROM Users u"
    users = list(user_container.query_items(query=query, enable_cross_partition_query=True))

    if not users:
        logging.info("No users found.")
        return

    for user in users:
        # Web push (browser)
        if user.get('webPushSubscription'):
            token = user['webPushSubscription']
            try:
                message = messaging.Message(
                    notification=messaging.Notification(
                        title="hello world",
                        body="This is a web push sent from Azure Function! 🌱"
                    ),
                    token=token,
                    webpush=messaging.WebpushConfig(
                        notification=messaging.WebpushNotification(
                            title="hello world",
                            body="This is a web push sent from Azure Function! 🌱"
                        )
                    )
                )
                response = messaging.send(message)
                logging.info(f"✅ Web Push sent to {user['email']}: {response}")
            except Exception as e:
                logging.error(f"❌ Error sending web push to {user['email']}: {e}")

        # Mobile push (Android/iOS)
        if user.get('fcmToken'):
            token = user['fcmToken']
            try:
                message = messaging.Message(
                    notification=messaging.Notification(
                        title="hello world",
                        body="This is a mobile push sent from Azure Function! 🌱"
                    ),
                    token=token
                )
                response = messaging.send(message)
                logging.info(f"✅ Mobile Push sent to {user['email']}: {response}")
            except Exception as e:
                logging.error(f"❌ Error sending mobile push to {user['email']}: {e}")
