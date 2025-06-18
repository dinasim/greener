import azure.functions as func
import json
import bcrypt
from azure.cosmos import CosmosClient, exceptions
import os
import sys
sys.path.append(os.path.dirname(os.path.abspath(__file__)) + '/../')
from db_helpers import get_container

def add_cors_headers(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS, PUT, PATCH, DELETE'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type,Authorization,X-User-Email'
    return response

# Marketplace DB for business users
greener_marketplace_db = os.environ.get('COSMOSDB_MARKETPLACE_DATABASE_NAME', 'greener-marketplace-db')
marketplace_conn_str = os.environ.get('COSMOSDB__MARKETPLACE_CONNECTION_STRING')
marketplace_client = CosmosClient.from_connection_string(marketplace_conn_str)
marketplace_db = marketplace_client.get_database_client(greener_marketplace_db)
business_container = marketplace_db.get_container_client('business_users')

def main(req: func.HttpRequest) -> func.HttpResponse:
    if req.method == "OPTIONS":
        return add_cors_headers(func.HttpResponse("", status_code=204))
    try:
        data = req.get_json()
        email = (data.get('email') or '').strip().lower()
        password = data.get('password')
        businessName = (data.get('businessName') or '').strip()
        contactName = (data.get('contactName') or '').strip()
        phone = (data.get('phone') or '').strip()
        businessType = (data.get('businessType') or '').strip()
        description = data.get('description', '')
        location = data.get('location', None)
        businessHours = data.get('businessHours', [])
        socialMedia = data.get('socialMedia', {})
        logo = data.get('logo', '')
        notificationSettings = data.get('notificationSettings', {})
        fcmToken = data.get('fcmToken', None)
        webPushSubscription = data.get('webPushSubscription', None)
        expoPushToken = data.get('expoPushToken', None)
        platform = data.get('platform', 'web')
        createdAt = data.get('createdAt', '')
        updatedAt = data.get('updatedAt', '')

        # Validate required fields
        if not (email and password and businessName and contactName and phone and businessType and location):
            return func.HttpResponse(
                json.dumps({'error': 'Missing required business registration fields.'}),
                status_code=400, mimetype='application/json')

        # Check if business email already exists
        query = "SELECT * FROM business_users b WHERE LOWER(b.email) = @email"
        parameters = [{"name": "@email", "value": email}]
        results = list(business_container.query_items(query, parameters=parameters, enable_cross_partition_query=True))
        if results:
            return func.HttpResponse(
                json.dumps({'error': 'Business email already exists.'}),
                status_code=409, mimetype='application/json')

        hashed_pw = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())
        business_doc = {
            "id": email,
            "email": email,
            "businessName": businessName,
            "contactName": contactName,
            "phone": phone,
            "businessType": businessType,
            "description": description,
            "location": location,
            "businessHours": businessHours,
            "socialMedia": socialMedia,
            "logo": logo,
            "notificationSettings": notificationSettings,
            "fcmToken": fcmToken,
            "webPushSubscription": webPushSubscription,
            "expoPushToken": expoPushToken,
            "type": "business",
            "platform": platform,
            "createdAt": createdAt,
            "updatedAt": updatedAt,
            "passwordHash": hashed_pw.decode('utf-8')  # Only for DB, not for API response
        }
        business_container.create_item(business_doc)
        # Do NOT return passwordHash in the API response
        response_data = {
            "message": "Business user registered successfully.",
            "business": {
                "email": email,
                "businessName": businessName,
                "contactName": contactName,
                "phone": phone,
                "businessType": businessType,
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
