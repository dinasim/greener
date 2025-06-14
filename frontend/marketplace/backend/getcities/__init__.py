import azure.functions as func
import json
from azure.cosmos import CosmosClient
import os

COSMOS_URI = "https://greener-database.documents.azure.com:443/"
COSMOS_KEY = "Mqxy0jUQCmwDYNjaxtFOauzxc2CRPeNFaxDKktxNJTmUiGlARA2hIZueLt8D1u8B8ijgvEbzCtM5ACDbUzDRKg=="
DATABASE_NAME = "GreenerDB"
CONTAINER_NAME = "israelCities"

def main(req: func.HttpRequest) -> func.HttpResponse:
    try:
        client = CosmosClient(COSMOS_URI, credential=COSMOS_KEY)
        db = client.get_database_client(DATABASE_NAME)
        container = db.get_container_client(CONTAINER_NAME)
        
        # Query for all items, return their "id" field as the city name
        cities = [item["id"] for item in container.read_all_items()]
        
        return func.HttpResponse(
            json.dumps(cities),
            status_code=200,
            mimetype="application/json",
            headers={"Access-Control-Allow-Origin": "*"}
        )
    except Exception as e:
        return func.HttpResponse(
            f"Failed to fetch cities: {str(e)}",
            status_code=500,
            headers={"Access-Control-Allow-Origin": "*"}
        )
