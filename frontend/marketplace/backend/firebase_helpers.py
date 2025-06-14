import logging
import os
import firebase_admin
from firebase_admin import credentials, messaging

# Global Firebase app instance
_firebase_app = None

def get_firebase_app():
    """Get or initialize Firebase app instance"""
    global _firebase_app
    
    if _firebase_app is None:
        try:
            # Build the service account dictionary from environment variables
            service_account = {
                "type": "service_account",
                "project_id": os.environ.get("FIREBASE_PROJECT_ID"),
                "private_key_id": os.environ.get("FIREBASE_SECRET_KEY_ID"),
                "private_key": os.environ.get("FIREBASE_SECRET_KEY", "").replace('\\n', '\n'),
                "client_email": os.environ.get("FIREBASE_CLIENT_EMAIL"),
                "client_id": os.environ.get("FIREBASE_CLIENT_ID"),
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
                "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
                "client_x509_cert_url": f"https://www.googleapis.com/robot/v1/metadata/x509/{os.environ.get('FIREBASE_CLIENT_EMAIL')}",
                "universe_domain": "googleapis.com"
            }
            
            # Validate required fields
            required_fields = ["project_id", "private_key", "client_email"]
            missing_fields = [field for field in required_fields if not service_account.get(field)]
            
            if missing_fields:
                logging.error(f"Missing Firebase environment variables: {missing_fields}")
                return None
            
            # Initialize Firebase
            cred = credentials.Certificate(service_account)
            _firebase_app = firebase_admin.initialize_app(cred)
            logging.info("Firebase Admin SDK initialized successfully")
            
        except Exception as e:
            logging.error(f"Failed to initialize Firebase Admin SDK: {str(e)}")
            return None
    
    return _firebase_app

def send_fcm_notification(fcm_token, title, body, data=None):
    """
    Send FCM notification using Firebase Admin SDK
    
    Args:
        fcm_token (str): The FCM token of the target device
        title (str): Notification title
        body (str): Notification body
        data (dict, optional): Additional data payload
    
    Returns:
        bool: True if notification was sent successfully, False otherwise
    """
    try:
        app = get_firebase_app()
        if not app:
            logging.error("Firebase app not initialized")
            return False
        
        if not fcm_token:
            logging.warning("FCM token is empty")
            return False
        
        # Create the message
        message = messaging.Message(
            notification=messaging.Notification(
                title=title,
                body=body
            ),
            data=data or {},
            token=fcm_token,
            android=messaging.AndroidConfig(
                priority='high',
                notification=messaging.AndroidNotification(
                    icon='/icon-192x192.png',
                    sound='default',
                    click_action='FLUTTER_NOTIFICATION_CLICK'
                )
            ),
            apns=messaging.APNSConfig(
                payload=messaging.APNSPayload(
                    aps=messaging.Aps(
                        sound='default',
                        badge=1
                    )
                )
            ),
            webpush=messaging.WebpushConfig(
                notification=messaging.WebpushNotification(
                    icon='/icon-192x192.png'
                )
            )
        )
        
        # Send the message
        response = messaging.send(message, app=app)
        logging.info(f"FCM notification sent successfully: {response}")
        return True
        
    except messaging.UnregisteredError:
        logging.warning(f"FCM token is unregistered: {fcm_token[:20]}...")
        return False
    except messaging.InvalidArgumentError as e:
        logging.error(f"Invalid FCM token or message: {str(e)}")
        return False
    except Exception as e:
        logging.error(f"Error sending FCM notification: {str(e)}")
        return False

def send_fcm_notification_to_user(user_container, user_id, title, body, data=None):
    """
    Send FCM notification to a specific user by looking up their tokens
    
    Args:
        user_container: Cosmos DB container for users
        user_id (str): User ID or email
        title (str): Notification title
        body (str): Notification body
        data (dict, optional): Additional data payload
    
    Returns:
        bool: True if at least one notification was sent successfully
    """
    try:
        # Query for user by email or id
        user_query = "SELECT c.fcmToken, c.webPushSubscription FROM c WHERE c.id = @userId OR c.email = @userId"
        user_params = [{"name": "@userId", "value": user_id}]
        
        users = list(user_container.query_items(
            query=user_query,
            parameters=user_params,
            enable_cross_partition_query=True
        ))
        
        if not users:
            logging.warning(f"User {user_id} not found for notification")
            return False
        
        user = users[0]
        fcm_token = user.get('fcmToken')
        
        if not fcm_token:
            logging.warning(f"No FCM token found for user {user_id}")
            return False
        
        # Send notification using Firebase Admin SDK
        return send_fcm_notification(fcm_token, title, body, data)
        
    except Exception as e:
        logging.error(f"Error sending FCM notification to user {user_id}: {str(e)}")
        return False