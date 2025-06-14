import azure.functions as func
from azure.cosmos import CosmosClient
import os
import json
import logging

COSMOS_URI = os.environ["COSMOS_URI"]
COSMOS_KEY = os.environ["COSMOS_KEY"]
DATABASE_NAME = "GreenerDB"
CONTAINER_NAME = "userPlantsLocation"

client = CosmosClient(COSMOS_URI, credential=COSMOS_KEY)
container = client.get_database_client(DATABASE_NAME).get_container_client(CONTAINER_NAME)

def main(req: func.HttpRequest) -> func.HttpResponse:
    email = req.params.get("email")
    if not email:
        return func.HttpResponse(
            json.dumps({ "error": "Missing email" }),
            status_code=400,
            mimetype="application/json"
        )

    try:
        query = "SELECT c.location FROM c WHERE c.email = @email"
        params = [{"name": "@email", "value": email}]
        items = list(container.query_items(
            query=query,
            parameters=params,
            enable_cross_partition_query=True
        ))

        # Ensure 'location' exists in each item
        locations = list({item.get('location') for item in items if item.get('location')})
        logging.info(f"Fetched {len(locations)} locations for {email}")

        return func.HttpResponse(
            json.dumps(locations),
            mimetype="application/json"
        )
    except Exception as e:
        logging.error(f"Error fetching locations for {email}: {str(e)}")
        return func.HttpResponse(
            json.dumps({ "error": str(e) }),
            status_code=500,
            mimetype="application/json"
        )
