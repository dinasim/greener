import logging
import azure.functions as func
import json
from azure.cosmos import CosmosClient, PartitionKey, exceptions

# Set up the Cosmos DB client
endpoint = 'https://greener-database.documents.azure.com:443/'
key = 'Mqxy0jUQCmwDYNjaxtFOauzxc2CRPeNFaxDKktxNJTmUiGlARA2hIZueLt8D1u8B8ijgvEbzCtM5ACDbUzDRKg=='  # Replace with your real key
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
            # Use email as the ID
            user_info['id'] = user_info['email']

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
                user_container.replace_item(item=user_info['id'], body=user_info)
            else:
                logging.info(f"Creating new user: {user_info['email']}")
                user_container.create_item(body=user_info)

            # Save plant locations for the user
            if "plantLocations" in user_info:
                for loc in user_info["plantLocations"]:
                    item = {
                        "id": f"{user_info['email']}::{loc}",
                        "email": user_info["email"],
                        "location": loc,
                        "plants": []  # Placeholder; can be filled later
                    }
                    plant_container.upsert_item(body=item)
                    logging.info(f"Upserted plant location '{loc}' for user {user_info['email']}")

            return func.HttpResponse(
                body=json.dumps({"message": "User data and plant locations saved successfully."}),
                status_code=200,
                mimetype="application/json"
            )

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
