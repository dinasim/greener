# /api/saveUser function (Azure Functions - Python) - FIXED for dual database support
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

                # Update these fields if present
                fields = [
                    "name", "type", "animals", "kids", "intersted", "businessName", "businessType",
                    "expoPushToken", "webPushSubscription", "fcmToken", "location", "googleId",
                    "contactPhone", "address", "businessHours", "socialMedia", "description",
                    "platform", "notificationSettings"
                ]
                for field in fields:
                    if field in user_info:
                        existing_user[field] = user_info[field]

                # Add timestamp
                existing_user['updatedAt'] = datetime.utcnow().isoformat()

                user_container.replace_item(item=existing_user['id'], body=existing_user)
                logging.info(f"✅ Successfully updated {user_type} user: {user_info['email']}")
            else:
                logging.info(f"➕ Creating new {user_type} user: {user_info['email']}")
                new_user = {
                    "id": user_info["email"],
                    "email": user_info["email"],
                    "name": user_info.get("name"),
                    "type": user_info.get("type", "consumer"),
                    "animals": user_info.get("animals"),
                    "kids": user_info.get("kids"),
                    "intersted": user_info.get("intersted"),
                    "webPushSubscription": user_info.get("webPushSubscription"),
                    "fcmToken": user_info.get("fcmToken"),
                    "location": user_info.get("location"),
                    "googleId": user_info.get("googleId"),
                    "expoPushToken": user_info.get("expoPushToken"),
                    "platform": user_info.get("platform"),
                    "notificationSettings": user_info.get("notificationSettings", {}),
                    "createdAt": datetime.utcnow().isoformat(),
                    "updatedAt": datetime.utcnow().isoformat()
                }
                
                # Add business-specific fields if user type is business
                if user_info.get('type') == 'business':
                    business_fields = {
                        "businessName": user_info.get("businessName"),
                        "businessType": user_info.get("businessType"),
                        "contactPhone": user_info.get("contactPhone"),
                        "address": user_info.get("address", {}),
                        "businessHours": user_info.get("businessHours", []),
                        "socialMedia": user_info.get("socialMedia", {}),
                        "description": user_info.get("description", ""),
                        "status": "active",
                        "businessId": user_info["email"],
                        "rating": 0,
                        "reviewCount": 0,
                        "isVerified": False
                    }
                    new_user.update(business_fields)
                
                user_container.create_item(body=new_user)
                logging.info(f"✅ Successfully created {user_type} user: {user_info['email']}")

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
                        "database": database_type
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