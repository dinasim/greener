# /api/saveUser function (Azure Functions - Python) - FIXED for business users
import logging
import azure.functions as func
import json
from azure.cosmos import CosmosClient, exceptions
import os
from datetime import datetime

def add_cors_headers(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS, PUT, PATCH, DELETE'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type,Authorization,X-User-Email'
    return response

# FIXED: Set up dual database connections based on Azure best practices
def get_database_clients():
    """Get both main and marketplace database clients based on user type"""
    
    # Main database for consumer users
    main_endpoint = os.environ.get('COSMOS_URI')
    main_key = os.environ.get('COSMOS_KEY')
    main_client = CosmosClient(main_endpoint, credential=main_key) if main_endpoint and main_key else None
    
    # Marketplace database for business users - try connection string first, fallback to URI/KEY
    marketplace_connection_string = os.environ.get('COSMOSDB__MARKETPLACE_CONNECTION_STRING')
    marketplace_client = None
    
    if marketplace_connection_string:
        # Parse connection string for marketplace database
        try:
            connection_parts = dict(param.split('=', 1) for param in marketplace_connection_string.split(';') if '=' in param)
            marketplace_endpoint = connection_parts.get('AccountEndpoint')
            marketplace_key = connection_parts.get('AccountKey')
            if marketplace_endpoint and marketplace_key:
                marketplace_client = CosmosClient(marketplace_endpoint, credential=marketplace_key)
        except Exception as e:
            logging.warning(f"Failed to parse marketplace connection string: {e}")
    
    # Fallback to main credentials for marketplace if connection string fails
    if not marketplace_client and main_endpoint and main_key:
        marketplace_client = CosmosClient(main_endpoint, credential=main_key)
    
    return main_client, marketplace_client

# Initialize database clients
main_client, marketplace_client = get_database_clients()

# FIXED: Database and container configuration based on user type
def get_containers_for_user_type(user_type):
    """Get appropriate database and containers based on user type"""
    try:
        if user_type == 'business':
            # Business users go to marketplace database
            database_name = os.environ.get('COSMOSDB_MARKETPLACE_DATABASE_NAME', 'GreenerMarketplace')
            database = marketplace_client.get_database_client(database_name)
            
            # Try business_users container first, fallback to users container
            try:
                user_container = database.get_container_client('business_users')
                logging.info(f"🏢 Using business_users container for business user")
            except Exception:
                logging.warning(f"⚠️ business_users container not available, using users container")
                user_container = database.get_container_client('users')
            
            # Plant container for marketplace
            plant_container = database.get_container_client('userPlantsLocation')
            
            return user_container, plant_container, 'marketplace'
            
        else:
            # Consumer users go to main database
            database_name = os.environ.get('COSMOS_DATABASE_NAME', 'GreenerDB')
            database = main_client.get_database_client(database_name)
            
            user_container = database.get_container_client('Users')
            plant_container = database.get_container_client('userPlantsLocation')
            
            return user_container, plant_container, 'main'
            
    except Exception as e:
        logging.error(f"Failed to initialize containers for user type {user_type}: {e}")
        return None, None, None

# FIXED: Create proper user document based on type
def create_user_document(user_info, is_update=False):
    """Create user document with appropriate fields based on user type"""
    user_type = user_info.get('type', 'consumer')
    current_time = datetime.utcnow().isoformat()
    
    # Base user document
    user_doc = {
        "id": user_info["email"],
        "email": user_info["email"],
        "name": user_info.get("name"),
        "type": user_type,
        "platform": user_info.get("platform"),
        "notificationSettings": user_info.get("notificationSettings", {}),
    }
    
    # Add timestamps
    if is_update:
        user_doc["updatedAt"] = current_time
    else:
        user_doc["createdAt"] = current_time
        user_doc["updatedAt"] = current_time
    
    # FIXED: Handle location data consistently for both user types
    location_data = user_info.get("location") or user_info.get("address")
    if location_data:
        # Ensure location is properly structured with all required fields
        structured_location = {
            "city": location_data.get('city', '') if isinstance(location_data, dict) else '',
            "street": location_data.get('street', '') if isinstance(location_data, dict) else '',
            "houseNumber": location_data.get('houseNumber', '') if isinstance(location_data, dict) else '',
            "latitude": location_data.get('latitude') if isinstance(location_data, dict) else None,
            "longitude": location_data.get('longitude') if isinstance(location_data, dict) else None,
            "formattedAddress": location_data.get('formattedAddress', '') if isinstance(location_data, dict) else '',
            "country": location_data.get('country', 'Israel') if isinstance(location_data, dict) else 'Israel',
            "postalCode": location_data.get('postalCode', '') if isinstance(location_data, dict) else ''
        }
        
        # Only include location if it has coordinates or city
        if structured_location.get('latitude') or structured_location.get('longitude') or structured_location.get('city'):
            user_doc["location"] = structured_location
            if user_type == 'business':
                user_doc["address"] = structured_location  # Business users also get address field
    
    # FIXED: Add fields based on user type
    if user_type == 'business':
        # Business-specific fields only
        business_fields = {
            "businessName": user_info.get("businessName"),
            "businessType": user_info.get("businessType", "business"),
            "description": user_info.get("description", ""),
            "contactPhone": user_info.get("contactPhone") or user_info.get("phone"),
            "phone": user_info.get("phone") or user_info.get("contactPhone"),
            # FIXED: Properly handle business hours from frontend
            "businessHours": user_info.get("businessHours", []),
            # FIXED: Properly handle social media from frontend
            "socialMedia": user_info.get("socialMedia", {}),
            "status": "active",
            "businessId": user_info["email"],
            "rating": 0,
            "reviewCount": 0,
            "isVerified": False,
            # FCM and notification tokens
            "fcmToken": user_info.get("fcmToken"),
            "webPushSubscription": user_info.get("webPushSubscription"),
            "expoPushToken": user_info.get("expoPushToken"),
        }
        user_doc.update(business_fields)
        
        # FIXED: Log business hours and social media data being saved
        logging.info(f"📅 Saving business hours to database: {json.dumps(user_info.get('businessHours', []))}")
        logging.info(f"📱 Saving social media to database: {json.dumps(user_info.get('socialMedia', {}))}")
        
        # FIXED: Set up proper notification settings for business users
        if "notificationSettings" in user_info:
            user_doc["notificationSettings"] = {
                "enabled": user_info["notificationSettings"].get("enabled", True),
                "wateringReminders": user_info["notificationSettings"].get("wateringReminders", True),
                "lowStockAlerts": user_info["notificationSettings"].get("lowStockAlerts", True),
                "orderNotifications": user_info["notificationSettings"].get("orderNotifications", True),
                "platform": user_info.get("platform", "web")
            }
    else:
        # Consumer-specific fields only, always set defaults if missing
        consumer_fields = {
            "animals": user_info.get("animals", ""),
            "kids": user_info.get("kids", ""),
            "intersted": user_info.get("intersted", ""),
            "googleId": user_info.get("googleId", ""),
            "fcmToken": user_info.get("fcmToken", None),
            "webPushSubscription": user_info.get("webPushSubscription", None),
            "expoPushToken": user_info.get("expoPushToken", None),
            "plantLocations": user_info.get("plantLocations", []),
        }
        user_doc.update(consumer_fields)
    
    return user_doc

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('🌱 saveUser function triggered with dual database support.')

    # Handle preflight request for CORS
    if req.method == "OPTIONS":
        return add_cors_headers(func.HttpResponse("", status_code=200))

    try:
        user_info = req.get_json()
        logging.info(f"📥 Received user data: {user_info}")
        
        # Additional logging for debugging
        if user_info:
            user_type = user_info.get('type', 'consumer')
            logging.info(f"🔍 User type: {user_type}")
            logging.info(f"🔍 User email: {user_info.get('email')}")
            
            # FIXED: Log business-specific fields for debugging
            if user_type == 'business':
                logging.info(f"🏢 Business name: {user_info.get('businessName')}")
                logging.info(f"🏢 Business description: {user_info.get('description')}")
                logging.info(f"🏢 Business address: {user_info.get('address')}")
                logging.info(f"🏢 Business location: {user_info.get('location')}")
                logging.info(f"🔔 FCM token: {'Present' if user_info.get('fcmToken') else 'Missing'}")
                
    except ValueError as json_error:
        logging.error(f"❌ JSON parsing error: {str(json_error)}")
        response = func.HttpResponse(
            body=json.dumps({"error": "Invalid JSON body.", "success": False}),
            status_code=400,
            mimetype="application/json"
        )
        return add_cors_headers(response)

    if user_info and 'email' in user_info:
        try:
            user_info['id'] = user_info['email']  # Use email as document ID
            user_type = user_info.get('type', 'consumer')
            
            # FIXED: Get containers based on user type
            user_container, plant_container, database_type = get_containers_for_user_type(user_type)
            
            if not user_container:
                return func.HttpResponse(
                    body=json.dumps({"error": f"Database containers not available for user type: {user_type}"}),
                    status_code=500,
                    mimetype="application/json"
                )

            logging.info(f"✅ Using {database_type} database for {user_type} user: {user_info['email']}")

            # Query existing user
            query = "SELECT * FROM c WHERE c.email = @email"
            parameters = [{"name": "@email", "value": user_info['email']}]

            existing_users = list(user_container.query_items(
                query=query,
                parameters=parameters,
                enable_cross_partition_query=True
            ))

            if existing_users:
                logging.info(f"🔁 Updating existing {user_type} user: {user_info['email']}")
                existing_user = existing_users[0]

                # FIXED: Create proper update document
                updated_user = create_user_document(user_info, is_update=True)
                
                # Preserve creation timestamp
                updated_user['createdAt'] = existing_user.get('createdAt', updated_user.get('createdAt'))
                
                # Preserve document metadata
                updated_user['_rid'] = existing_user.get('_rid')
                updated_user['_self'] = existing_user.get('_self')
                updated_user['_etag'] = existing_user.get('_etag')
                updated_user['_attachments'] = existing_user.get('_attachments')
                updated_user['_ts'] = existing_user.get('_ts')

                user_container.replace_item(item=existing_user['id'], body=updated_user)
                logging.info(f"✅ Successfully updated {user_type} user: {user_info['email']}")
                
                return_user = updated_user
            else:
                logging.info(f"➕ Creating new {user_type} user: {user_info['email']}")
                
                # FIXED: Create proper new user document
                new_user = create_user_document(user_info, is_update=False)
                
                result = user_container.create_item(body=new_user)
                logging.info(f"✅ Successfully created {user_type} user: {user_info['email']}")
                
                return_user = result

            # Handle plant locations (optional) - only if plant container is available
            if "plantLocations" in user_info and plant_container:
                for loc in user_info["plantLocations"]:
                    item = {
                        "id": f"{user_info['email']}::{loc}",
                        "email": user_info["email"],
                        "location": loc,
                        "plants": []
                    }
                    plant_container.upsert_item(body=item)
                    logging.info(f"📍 Upserted plant location '{loc}' for user {user_info['email']}")

            response = func.HttpResponse(
                body=json.dumps({
                    "message": f"{user_type.title()} user data saved successfully.", 
                    "success": True,
                    "user": {
                        "email": user_info['email'], 
                        "type": user_info.get('type', 'consumer'),
                        "database": database_type,
                        "businessName": return_user.get('businessName') if user_type == 'business' else None,
                        "hasLocation": bool(return_user.get('location') or return_user.get('address')),
                        "hasFcmToken": bool(return_user.get('fcmToken')),
                    }
                }),
                status_code=200,
                mimetype="application/json"
            )
            return add_cors_headers(response)

        except exceptions.CosmosHttpResponseError as e:
            logging.error(f"❌ Cosmos DB error: {e}")
            return func.HttpResponse(
                body=json.dumps({"error": f"Cosmos DB error: {str(e)}"}),
                status_code=500,
                mimetype="application/json"
            )
        except Exception as e:
            logging.error(f"🔥 Unhandled error: {e}")
            return func.HttpResponse(
                body=json.dumps({"error": str(e)}),
                status_code=500,
                mimetype="application/json"
            )

    else:
        return func.HttpResponse(
            body=json.dumps({"error": "'email' is required in the user data."}),
            status_code=400,
            mimetype="application/json"
        )