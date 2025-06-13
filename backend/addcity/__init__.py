import azure.functions as func
import json
from azure.cosmos import CosmosClient, exceptions

COSMOS_URI = "https://greener-database.documents.azure.com:443/"
COSMOS_KEY = "Mqxy0jUQCmwDYNjaxtFOauzxc2CRPeNFaxDKktxNJTmUiGlARA2hIZueLt8D1u8B8ijgvEbzCtM5ACDbUzDRKg=="
DATABASE_NAME = "GreenerDB"
CONTAINER_NAME = "israelCities"

def main(req: func.HttpRequest) -> func.HttpResponse:
    try:
        data = req.get_json()
        city = (data.get("city") or "").strip()
        if not city:
            return func.HttpResponse(
                "Missing 'city' field",
                status_code=400,
                headers={"Access-Control-Allow-Origin": "*"}
            )
        
        client = CosmosClient(COSMOS_URI, credential=COSMOS_KEY)
        db = client.get_database_client(DATABASE_NAME)
        container = db.get_container_client(CONTAINER_NAME)
        
        # Check if city already exists (id is city name)
        try:
            item = container.read_item(item=city, partition_key=city)
            return func.HttpResponse(
                json.dumps({"result": "already exists"}),
                status_code=200,
                mimetype="application/json",
                headers={"Access-Control-Allow-Origin": "*"}
            )
        except exceptions.CosmosResourceNotFoundError:
            pass  # Not found, so we can add it

        # Insert the city (id only)
        container.create_item({"id": city})

        return func.HttpResponse(
            json.dumps({"result": "added"}),
            status_code=201,
            mimetype="application/json",
            headers={"Access-Control-Allow-Origin": "*"}
        )
    except Exception as e:
        return func.HttpResponse(
            f"Failed to add city: {str(e)}",
            status_code=500,
            headers={"Access-Control-Allow-Origin": "*"}
        )
