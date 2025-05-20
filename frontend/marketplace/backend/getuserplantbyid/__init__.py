import os
import logging
import azure.functions as func
from azure.cosmos import CosmosClient
import json

COSMOS_URI = os.environ["COSMOS_URI"]
COSMOS_KEY = os.environ["COSMOS_KEY"]
DATABASE_NAME = os.environ.get("COSMOS_DATABASE_NAME", "GreenerDB")
CONTAINER_NAME = os.environ.get("COSMOS_CONTAINER_USER_PLANTS", "userPlants")

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('getuserplantbyid triggered')
    plant_id = req.params.get('id')
    if not plant_id:
        return func.HttpResponse("Missing id", status_code=400)
    try:
        client = CosmosClient(COSMOS_URI, credential=COSMOS_KEY)
        container = client.get_database_client(DATABASE_NAME).get_container_client(CONTAINER_NAME)
        query = "SELECT * FROM c WHERE c.id=@id"
        params = [{"name":"@id", "value":plant_id}]
        items = list(container.query_items(query=query, parameters=params, enable_cross_partition_query=True))
        if not items:
            return func.HttpResponse("Not found", status_code=404)
        return func.HttpResponse(json.dumps(items[0]), status_code=200, mimetype="application/json")
    except Exception as e:
        logging.exception("Error fetching plant")
        return func.HttpResponse("Server error: " + str(e), status_code=500)
