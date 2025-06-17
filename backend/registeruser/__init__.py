# /api/registerUser/__init__.py
import azure.functions as func
import json
import bcrypt
from azure.cosmos import CosmosClient, exceptions
import os

def add_cors_headers(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS, PUT, PATCH, DELETE'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type,Authorization,X-User-Email'
    return response

endpoint = os.environ.get('COSMOS_URI')
key = os.environ.get('COSMOS_KEY')
client = CosmosClient(endpoint, credential=key)
database = client.get_database_client('GreenerDB')
user_container = database.get_container_client('Users')

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
        
        # FIXED: Get notification tokens and settings
        fcmToken = data.get('fcmToken', None)
        webPushSubscription = data.get('webPushSubscription', None)
        expoPushToken = data.get('expoPushToken', None)
        notificationSettings = data.get('notificationSettings', {})

        if not (username and password and email):
            return func.HttpResponse(
                json.dumps({'error': 'Email, username, and password are required.'}),
                status_code=400, mimetype='application/json')

        # Check if username or email taken
        query = "SELECT * FROM Users u WHERE LOWER(u.username) = @username OR LOWER(u.email) = @email"
        parameters = [{"name": "@username", "value": username}, {"name": "@email", "value": email}]
        results = list(user_container.query_items(query, parameters=parameters, enable_cross_partition_query=True))
        if results:
            return func.HttpResponse(
                json.dumps({'error': 'Username or email already exists.'}),
                status_code=409, mimetype='application/json')

        hashed_pw = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())
        
        # FIXED: Create comprehensive user document with proper location handling
        user_doc = {
            "id": email,
            "username": username,
            "passwordHash": hashed_pw.decode('utf-8'),
            "email": email,
            "name": name,
            "intersted": intersted,
            "animals": animals,
            "kids": kids,
            "plantLocations": plantLocations,
            # FIXED: Properly structure location data with coordinates and address
            "location": {
                "city": location.get('city', '') if location else '',
                "street": location.get('street', '') if location else '',
                "houseNumber": location.get('houseNumber', '') if location else '',
                "latitude": location.get('latitude') if location else None,
                "longitude": location.get('longitude') if location else None,
                "formattedAddress": location.get('formattedAddress', '') if location else '',
                "country": location.get('country', 'Israel') if location else 'Israel',
                "postalCode": location.get('postalCode', '') if location else ''
            } if location else None,
            # FIXED: Add notification tokens and settings
            "fcmToken": fcmToken,
            "webPushSubscription": webPushSubscription,
            "expoPushToken": expoPushToken,
            "notificationSettings": {
                "enabled": notificationSettings.get('enabled', True),
                "wateringReminders": notificationSettings.get('wateringReminders', True),
                "marketplaceUpdates": notificationSettings.get('marketplaceUpdates', False),
                "platform": notificationSettings.get('platform', 'web')
            },
            # Add timestamps
            "createdAt": data.get('createdAt', ''),
            "updatedAt": data.get('updatedAt', '')
        }
        
        user_container.create_item(user_doc)
        
        # FIXED: Return user data including location info for verification
        response_data = {
            "message": "User registered successfully.",
            "user": {
                "email": email,
                "name": name,
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
