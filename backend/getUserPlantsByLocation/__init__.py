import azure.functions as func
from azure.cosmos import CosmosClient
import os
import json

COSMOS_URI = os.environ["COSMOS_URI"]
COSMOS_KEY = os.environ["COSMOS_KEY"]
DATABASE_NAME = "GreenerDB"
CONTAINER_NAME = "userPlants"

client = CosmosClient(COSMOS_URI, credential=COSMOS_KEY)
container = client.get_database_client(DATABASE_NAME).get_container_client(CONTAINER_NAME)

def main(req: func.HttpRequest) -> func.HttpResponse:
    email = req.params.get("email")
    location = req.params.get("location")

    if not email or not location:
        return func.HttpResponse("Missing email or location", status_code=400)

    try:
        query = "SELECT * FROM c WHERE c.email = @email AND c.location = @location"
        parameters = [
            {"name": "@email", "value": email},
            {"name": "@location", "value": location}
        ]

        items = list(container.query_items(
            query=query,
            parameters=parameters,
            enable_cross_partition_query=True
        ))

        return func.HttpResponse(json.dumps(items), mimetype="application/json")
    except Exception as e:
        return func.HttpResponse(f"Error: {str(e)}", status_code=500)
