import azure.functions as func
from azure.cosmos import CosmosClient, exceptions
import os
import json
import logging

COSMOS_URI = os.environ["COSMOS_URI"]
COSMOS_KEY = os.environ["COSMOS_KEY"]
DATABASE_NAME = "GreenerDB"
CONTAINER_NAME = "Users"

client = CosmosClient(COSMOS_URI, credential=COSMOS_KEY)
container = client.get_database_client(DATABASE_NAME).get_container_client(CONTAINER_NAME)

def main(req: func.HttpRequest) -> func.HttpResponse:
    try:
        data = req.get_json()
        email = data.get("email")
        location = data.get("location")
        expoPushToken = data.get("expoPushToken")

        if not email or not location or not expoPushToken:
            return func.HttpResponse(
                json.dumps({ "error": "Missing required fields" }),
                status_code=400,
                mimetype="application/json"
            )

        # Try to get the user document by email
        query = "SELECT * FROM c WHERE c.email = @email"
        items = list(container.query_items(
            query=query,
            parameters=[{"name": "@email", "value": email}],
            enable_cross_partition_query=True
        ))

        if items:
            user = items[0]
            user["location"] = location
            user["expoPushToken"] = expoPushToken
            container.upsert_item(user)
            action = "updated"
        else:
            # New user if not found
            new_user = {
                "id": email,
                "email": email,
                "location": location,
                "expoPushToken": expoPushToken
            }
            container.create_item(new_user)
            action = "created"

        return func.HttpResponse(
            json.dumps({ "status": f"User settings {action} successfully." }),
            status_code=200,
            mimetype="application/json"
        )

    except Exception as e:
        logging.error(f"Error saving user settings: {str(e)}")
        return func.HttpResponse(
            json.dumps({ "error": str(e) }),
            status_code=500,
            mimetype="application/json"
        )
