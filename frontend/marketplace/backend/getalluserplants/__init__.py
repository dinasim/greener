import azure.functions as func
import json
from azure.cosmos import CosmosClient
import os

# Use your environment variables or hardcode for now
COSMOS_URI = "https://greener-database.documents.azure.com:443/"
COSMOS_KEY = "Mqxy0jUQCmwDYNjaxtFOauzxc2CRPeNFaxDKktxNJTmUiGlARA2hIZueLt8D1u8B8ijgvEbzCtM5ACDbUzDRKg=="
DATABASE_NAME = "GreenerDB"
PLANTS_CONTAINER_NAME = "userPlants"

client = CosmosClient(COSMOS_URI, credential=COSMOS_KEY)
plants_container = client.get_database_client(DATABASE_NAME).get_container_client(PLANTS_CONTAINER_NAME)

def main(req: func.HttpRequest) -> func.HttpResponse:
    email = req.params.get('email')
    if not email:
        try:
            req_body = req.get_json()
        except Exception:
            req_body = {}
        email = req_body.get('email')
    if not email:
        return func.HttpResponse("Missing email parameter", status_code=400)
    try:
        # Query all plants with this email
        query = "SELECT * FROM c WHERE c.email=@user_email"
        params = [dict(name="@user_email", value=email)]
        items = list(plants_container.query_items(query=query, parameters=params, enable_cross_partition_query=True))
        return func.HttpResponse(json.dumps(items), status_code=200, mimetype="application/json")
    except Exception as e:
        return func.HttpResponse(f"Error: {str(e)}", status_code=500)
