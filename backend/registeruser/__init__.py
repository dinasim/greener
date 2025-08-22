# CONSUMER REGISTRATION ONLY - saves to Users in greener-database
# /api/registerUser/__init__.py
import azure.functions as func
import json
import bcrypt
from azure.cosmos import CosmosClient, exceptions
import os
import sys
import datetime
sys.path.append(os.path.dirname(os.path.abspath(__file__)) + '/../')
from db_helpers import get_container

def add_cors_headers(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS, PUT, PATCH, DELETE'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type,Authorization,X-User-Email'
    return response

endpoint = os.environ.get('COSMOS_URI')
key = os.environ.get('COSMOS_KEY')
client = CosmosClient(endpoint, credential=key)
database = client.get_database_client('GreenerDB')

def main(req: func.HttpRequest) -> func.HttpResponse:
    if req.method == "OPTIONS":
        return add_cors_headers(func.HttpResponse("", status_code=204))
    try:
        data = req.get_json()
        username = (data.get('username') or '').strip().lower()
        password = data.get('password')
        email = (data.get('email') or '').strip().lower()
        name = (data.get('name') or '').strip()
        intersted = data.get('intersted', '')
        animals = data.get('animals', '')
        kids = data.get('kids', '')
        location = data.get('location', None)
        plantLocations = data.get('plantLocations', [])
        fcmToken = data.get('fcmToken', None)
        webPushSubscription = data.get('webPushSubscription', None)
        expoPushToken = data.get('expoPushToken', None)
        notificationSettings = data.get('notificationSettings', {})

        # Set createdAt/updatedAt on backend if not provided
        now_iso = datetime.datetime.utcnow().isoformat()
        createdAt = data.get('createdAt') or now_iso
        updatedAt = data.get('updatedAt') or now_iso

        if not (username and password and email):
            return func.HttpResponse(
                json.dumps({'error': 'Email, username, and password are required.'}),
                status_code=400, mimetype='application/json')

        user_container = get_container('Users')

        # Robust duplicate check: case-insensitive on both username and email
        query = "SELECT * FROM Users u WHERE LOWER(u.username) = @username OR LOWER(u.email) = @email"
        parameters = [
            {"name": "@username", "value": username},
            {"name": "@email", "value": email}
        ]
        results = list(user_container.query_items(query, parameters=parameters, enable_cross_partition_query=True))
        if results:
            return func.HttpResponse(
                json.dumps({'error': 'Username or email already exists.'}),
                status_code=409, mimetype='application/json')

        hashed_pw = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())

        # Save all fields, use defaults for missing/empty
        user_doc = {
            "id": email,
            "username": username,
            "email": email,
            "name": name or username or email,
            "passwordHash": hashed_pw.decode('utf-8'),
            "intersted": intersted,
            "animals": animals,
            "kids": kids,
            "location": location if location else {},
            "plantLocations": plantLocations if plantLocations else [],
            "fcmToken": fcmToken,
            # Initialize multi-token array if token provided
            "fcmTokens": [fcmToken] if fcmToken else [],
            "webPushSubscription": webPushSubscription,
            "expoPushToken": expoPushToken,
            "notificationSettings": {
                "enabled": notificationSettings.get('enabled', True),
                "wateringReminders": notificationSettings.get('wateringReminders', True),
                "marketplaceUpdates": notificationSettings.get('marketplaceUpdates', False),
                "platform": notificationSettings.get('platform', 'web')
            },
            "type": data.get('type', 'consumer'),
            "platform": data.get('platform', 'web'),
            "createdAt": createdAt,
            "updatedAt": updatedAt
        }

        user_container.create_item(user_doc)

        response_data = {
            "message": "User registered successfully.",
            "user": {
                "email": email,
                "name": user_doc["name"],
                "hasLocation": bool(location and location.get('latitude') and location.get('longitude')),
                "locationCity": location.get('city') if location else None,
                "hasNotificationTokens": bool(fcmToken or webPushSubscription)
            }
        }

        resp = func.HttpResponse(json.dumps(response_data), status_code=201, mimetype='application/json')
        return add_cors_headers(resp)
    except Exception as e:
        return func.HttpResponse(
            json.dumps({'error': str(e)}),
            status_code=500, mimetype='application/json')
