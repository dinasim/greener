import os
import logging
import azure.functions as func
from azure.cosmos import CosmosClient
import json

COSMOS_URI = os.environ["COSMOS_URI"]
COSMOS_KEY = os.environ["COSMOS_KEY"]
DATABASE_NAME = os.environ.get("COSMOS_DATABASE_NAME", "GreenerDB")
CONTAINER_NAME = os.environ.get("COSMOS_CONTAINER_USER_PLANTS", "userPlants")

def normalize_user_plant(doc):
    """
    Normalizes user plant to the new schema (fields: care_info, schedule, next_xxx, etc.).
    Returns a dict with all expected keys (so frontend doesn't crash).
    """
    def safe(x, fallback=None):
        return x if x not in [None, '', [], {}, 'null'] else fallback

    # Try to unpack the newer nested schema, fallback for old
    care = doc.get('care_info', {})
    schedule = doc.get('schedule', {})

    # Old/legacy compatibility (for DBs missing care_info or schedule)
    # Try to infer from flat fields if missing
    care_info = {
        "light": care.get("light") or doc.get("light") or "",
        "humidity": care.get("humidity") or doc.get("humidity") or "",
        "temperature_min_c": care.get("temperature_min_c"),
        "temperature_max_c": care.get("temperature_max_c"),
        "pets": care.get("pets") or doc.get("pets") or "",
        "difficulty": care.get("difficulty") if care.get("difficulty") is not None else doc.get("difficulty"),
    }
    schedule_info = {
        "water": schedule.get("water") or doc.get("water"),
        "feed": schedule.get("feed") or doc.get("feed"),
        "repot": schedule.get("repot") or doc.get("repot"),
    }

    # Next care times (should be in ISO format)
    return {
        "id": doc.get("id"),
        "email": doc.get("email"),
        "nickname": doc.get("nickname"),
        "location": doc.get("location"),
        "common_name": doc.get("common_name"),
        "scientific_name": doc.get("scientific_name"),
        "origin": doc.get("origin"),
        "image_url": doc.get("image_url"),
        "family": doc.get("family"),
        "care_tips": doc.get("care_tips"),
        "common_problems": doc.get("common_problems") or [],
        "care_info": care_info,
        "schedule": schedule_info,
        "last_watered": doc.get("last_watered"),
        "last_fed": doc.get("last_fed"),
        "last_repotted": doc.get("last_repotted"),
        "next_water": doc.get("next_water"),
        "next_feed": doc.get("next_feed"),
        "next_repot": doc.get("next_repot"),
        "avg_watering": doc.get("avg_watering"),
    }

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
            logging.warning(f"No plant found for id={plant_id}")
            return func.HttpResponse("Not found", status_code=404)
        normalized = normalize_user_plant(items[0])
        logging.info(f"Returning normalized user plant for id={plant_id}")
        return func.HttpResponse(json.dumps(normalized), status_code=200, mimetype="application/json")
    except Exception as e:
        logging.exception("Error fetching plant")
        return func.HttpResponse("Server error: " + str(e), status_code=500)
