# /api/saveUser function (Azure Functions - Python)
import logging
import azure.functions as func
import json
from azure.cosmos import CosmosClient, exceptions
import os

def add_cors_headers(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS, PUT, PATCH, DELETE'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type,Authorization,X-User-Email'
    return response

# Set up the Cosmos DB client
endpoint = os.environ.get('COSMOS_URI')
key = os.environ.get('COSMOS_KEY')
client = CosmosClient(endpoint, credential=key)

# Reference Cosmos DB database and containers
database_name = 'GreenerDB'

try:
    database = client.get_database_client(database_name)
    user_container = database.get_container_client('Users')
    plant_container = database.get_container_client('userPlantsLocation')
except Exception as e:
    logging.error(f"Failed to initialize Cosmos DB containers: {e}")
    user_container = None
    plant_container = None

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('🌱 saveUser function triggered.')

    if not user_container or not plant_container:
        return func.HttpResponse(
            body=json.dumps({"error": "Cosmos DB containers not initialized."}),
            status_code=500,
            mimetype="application/json"
        )

    # Handle preflight request for CORS
    if req.method == "OPTIONS":
        return add_cors_headers(func.HttpResponse("", status_code=204))

    try:
        user_info = req.get_json()
        logging.info(f"🔍 webPushSubscription: {user_info.get('webPushSubscription')}")
        logging.info(f"📥 Received user data: {user_info}")
    except ValueError:
        return func.HttpResponse(
            body=json.dumps({"error": "Invalid JSON body."}),
            status_code=400,
            mimetype="application/json"
        )

    if user_info and 'email' in user_info:
        try:
            user_info['id'] = user_info['email']  # Use email as document ID

            # Query existing user
            query = "SELECT * FROM Users u WHERE u.email = @email"
            parameters = [{"name": "@email", "value": user_info['email']}]

            existing_users = list(user_container.query_items(
                query=query,
                parameters=parameters,
                enable_cross_partition_query=True
            ))

            if existing_users:
                logging.info(f"🔁 Updating existing user: {user_info['email']}")
                existing_user = existing_users[0]

                # Update these fields if present
                fields = [
                    "name", "type", "animals", "kids", "intersted",
                    "expoPushToken", "webPushSubscription", "fcmToken", "location", "googleId"
                ]
                for field in fields:
                    if field in user_info:
                        existing_user[field] = user_info[field]

                user_container.replace_item(item=existing_user['id'], body=existing_user)
            else:
                logging.info(f"➕ Creating new user: {user_info['email']}")
                new_user = {
                    "id": user_info["email"],
                    "email": user_info["email"],
                    "name": user_info.get("name"),
                    "type": user_info.get("type"),
                    "animals": user_info.get("animals"),
                    "kids": user_info.get("kids"),
                    "intersted": user_info.get("intersted"),
                    "webPushSubscription": user_info.get("webPushSubscription"),
                    "fcmToken": user_info.get("fcmToken"),
                    "location": user_info.get("location"),
                    "googleId": user_info.get("googleId"),  # ✅ ADD THIS
                    "expoPushToken": user_info.get("expoPushToken")  # ✅ ADD THIS TOO FOR CONSISTENCY
                }
                user_container.create_item(body=new_user)

            # Handle plant locations (optional)
            if "plantLocations" in user_info:
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
                body=json.dumps({"message": "User data, location, and plant locations saved successfully."}),
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