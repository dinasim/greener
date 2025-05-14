import logging
import azure.functions as func
from azure.cosmos import CosmosClient
import os
import json


# These should live in your local.settings.json (or in App Settings)
COSMOS_URI = os.getenv("COSMOS_URI")
COSMOS_KEY = os.getenv("COSMOS_KEY")

DATABASE_NAME = "GreenerDB"
CONTAINER_NAME = "Plants"

client = CosmosClient(COSMOS_URI, credential=COSMOS_KEY)
container = client \
    .get_database_client(DATABASE_NAME) \
    .get_container_client(CONTAINER_NAME)

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info("plantSearch function triggered.")

    # Grab the ?name= query parameter
    name = req.params.get("name")
    if not name:
        return func.HttpResponse(
            "Please pass a name on the query string, e.g. ?name=golden",
            status_code=400
        )

    # Build a case‐insensitive CONTAINS over id, common_name, latin_name
    query = """
    SELECT *
    FROM c
    WHERE
      CONTAINS(LOWER(c.id), LOWER(@name))
      OR CONTAINS(LOWER(c.common_name), LOWER(@name))
      OR CONTAINS(LOWER(c.latin_name), LOWER(@name))
    """
    parameters = [
        { "name": "@name", "value": name }
    ]

    try:
        items = list(container.query_items(
            query=query,
            parameters=parameters,
            enable_cross_partition_query=True
        ))
        return func.HttpResponse(
            json.dumps(items, default=str),
            mimetype="application/json",
            status_code=200
        )
    except Exception as e:
        logging.error(f"Cosmos query failed: {e}")
        return func.HttpResponse(
            f"Error querying database: {e}",
            status_code=500
        )
