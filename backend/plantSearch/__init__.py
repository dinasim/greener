import logging
import azure.functions as func
from azure.cosmos import CosmosClient
import os
import json

COSMOS_URI = "https://greener-database.documents.azure.com:443/"
COSMOS_KEY = "Mqxy0jUQCmwDYNjaxtFOauzxc2CRPeNFaxDKktxNJTmUiGlARA2hIZueLt8D1u8B8ijgvEbzCtM5ACDbUzDRKg=="
DATABASE_NAME = "GreenerDB"
CONTAINER_NAME = "Plants"

client = CosmosClient(COSMOS_URI, credential=COSMOS_KEY)
container = client.get_database_client(DATABASE_NAME).get_container_client(CONTAINER_NAME)

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('plantSearch function triggered.')
    name = req.params.get('name')
    if not name:
        return func.HttpResponse("Missing 'name' parameter", status_code=400)

    query = "SELECT * FROM c WHERE CONTAINS(LOWER(c.common_name), LOWER(@name))"
    parameters = [{"name": "@name", "value": name}]

    try:
        results = list(container.query_items(query=query, parameters=parameters, enable_cross_partition_query=True))
        return func.HttpResponse(json.dumps(results), mimetype="application/json")
    except Exception as e:
        return func.HttpResponse(f"Error: {str(e)}", status_code=500)
