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

# Reference your Cosmos DB database and containers
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
    logging.info('Python saveUser function processed a request.')

    if not user_container or not plant_container:
        return func.HttpResponse(
            body=json.dumps({"error": "Cosmos DB containers not initialized."}),
            status_code=500,
            mimetype="application/json"
        )

    try:
        user_info = req.get_json()
        logging.info(f"Received user data: {user_info}")
    except ValueError:
        return func.HttpResponse(
            body=json.dumps({"error": "Invalid JSON body."}),
            status_code=400,
            mimetype="application/json"
        )

    if user_info and 'email' in user_info:
        try:
            user_info['id'] = user_info['email']  # Use email as document ID

            # Check if user already exists
            query = "SELECT * FROM Users u WHERE u.email = @email"
            parameters = [{"name": "@email", "value": user_info['email']}]

            existing_users = list(user_container.query_items(
                query=query,
                parameters=parameters,
                enable_cross_partition_query=True
            ))

            if existing_users:
                logging.info(f"Updating existing user: {user_info['email']}")
                existing_user = existing_users[0]

                # Update fields selectively
                existing_user.update({
                    "name": user_info.get("name", existing_user.get("name")),
                    "type": user_info.get("type", existing_user.get("type")),
                    "animals": user_info.get("animals", existing_user.get("animals")),
                    "kids": user_info.get("kids", existing_user.get("kids")),
                    "intersted": user_info.get("intersted", existing_user.get("intersted")),
                    "expoPushToken": user_info.get("expoPushToken", existing_user.get("expoPushToken")),
                    "location": user_info.get("location", existing_user.get("location"))
                })

                user_container.replace_item(item=existing_user['id'], body=existing_user)
            else:
                logging.info(f"Creating new user: {user_info['email']}")
                # Create only the allowed fields
                new_user = {
                    "id": user_info["email"],
                    "email": user_info["email"],
                    "name": user_info.get("name"),
                    "type": user_info.get("type"),
                    "animals": user_info.get("animals"),
                    "kids": user_info.get("kids"),
                    "intersted": user_info.get("intersted"),
                    "expoPushToken": user_info.get("expoPushToken"),
                    "location": user_info.get("location")
                }
                user_container.create_item(body=new_user)

            # Save plant locations for the user
            if "plantLocations" in user_info:
                for loc in user_info["plantLocations"]:
                    item = {
                        "id": f"{user_info['email']}::{loc}",
                        "email": user_info["email"],
                        "location": loc,
                        "plants": []  # Placeholder for actual plant data
                    }
                    plant_container.upsert_item(body=item)
                    logging.info(f"Upserted plant location '{loc}' for user {user_info['email']}")

            response = func.HttpResponse(
                body=json.dumps({"message": "User data, location, and plant locations saved successfully."}),
                status_code=200,
                mimetype="application/json"
            )
            return add_cors_headers(response)

        except exceptions.CosmosHttpResponseError as e:
            logging.error(f"Cosmos DB error: {e}")
            return func.HttpResponse(
                body=json.dumps({"error": f"Cosmos DB error: {str(e)}"}),
                status_code=500,
                mimetype="application/json"
            )
        except Exception as e:
            logging.error(f"Unhandled error: {e}")
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
