import os
import json
import logging
import azure.functions as func
from azure.cosmos import CosmosClient

# ---- Shared config (same as your add endpoint) -------------------------------
COSMOS_URI = "https://greener-database.documents.azure.com:443/"
COSMOS_KEY = "Mqxy0jUQCmwDYNjaxtFOauzxc2CRPeNFaxDKktxNJTmUiGlARA2hIZueLt8D1u8B8ijgvEbzCtM5ACDbUzDRKg=="
DB_NAME = "GreenerDB"
USER_PLANTS_CONTAINER = "userPlants"
USER_PLANTS_LOCATION_CONTAINER = "userPlantsLocation"

client = CosmosClient(COSMOS_URI, credential=COSMOS_KEY)
db = client.get_database_client(DB_NAME)
user_plants_container = db.get_container_client(USER_PLANTS_CONTAINER)
location_container = db.get_container_client(USER_PLANTS_LOCATION_CONTAINER)

def _cors_headers():
    return {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST,GET,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type"
    }

def _json(body: dict, code: int = 200):
    return func.HttpResponse(
        json.dumps(body), status_code=code,
        headers={**_cors_headers(), "Content-Type": "application/json"}
    )

def _try_delete_user_plant(item_id: str, email_lower: str) -> dict:
    """
    Tries to delete a userPlants doc.
    Returns {"deleted": True, "doc": <prev_doc or None>} if removed,
            {"deleted": False} otherwise.
    We attempt multiple strategies in case partition key differs.
    """
    # 1) Fast path: email as partition key (most common)
    try:
        # Read to capture location for later cleanup
        prev_doc = user_plants_container.read_item(item=item_id, partition_key=email_lower)
        user_plants_container.delete_item(item=item_id, partition_key=email_lower)
        return {"deleted": True, "doc": prev_doc}
    except Exception as e:
        logging.info(f"[delete] email-partition delete failed, will try fallbacks: {e}")

    # 2) Try id as partition key (some schemas)
    try:
        prev_doc = user_plants_container.read_item(item=item_id, partition_key=item_id)
        user_plants_container.delete_item(item=item_id, partition_key=item_id)
        return {"deleted": True, "doc": prev_doc}
    except Exception as e:
        logging.info(f"[delete] id-partition delete failed, will try query: {e}")

    # 3) Fallback: query and then delete with discovered partition key
    try:
        results = list(user_plants_container.query_items(
            query="SELECT TOP 1 c.id, c.email, c.location FROM c WHERE c.id = @id",
            parameters=[{"name": "@id", "value": item_id}],
            enable_cross_partition_query=True
        ))
        if results:
            doc = results[0]
            pk = doc.get("email") or doc.get("id")
            user_plants_container.delete_item(item=doc["id"], partition_key=pk)
            return {"deleted": True, "doc": doc}
    except Exception as e:
        logging.error(f"[delete] query+delete failed: {e}")

    return {"deleted": False}

def _remove_from_locations(email_lower: str, plant_id: str, location_hint: str = None):
    """
    Removes plant_id from userPlantsLocation docs.
    If location_hint provided, update that one doc.
    Otherwise, update all location docs for the email.
    """
    try:
        if location_hint:
            loc_id = f"{email_lower}_{(location_hint or '').lower()}"
            try:
                loc_doc = location_container.read_item(item=loc_id, partition_key=loc_id)
                plants = [p for p in (loc_doc.get("plants") or []) if p != plant_id]
                loc_doc["plants"] = plants
                location_container.upsert_item(loc_doc)
                return
            except Exception as e:
                logging.info(f"[locations] hinted doc not found or update failed ({loc_id}): {e}")

        # No/failed hint → scan all docs for this email
        results = list(location_container.query_items(
            query="SELECT c.id, c.plants FROM c WHERE c.email = @em",
            parameters=[{"name": "@em", "value": email_lower}],
            enable_cross_partition_query=True
        ))
        for doc in results:
            if plant_id in (doc.get("plants") or []):
                doc["plants"] = [p for p in doc.get("plants", []) if p != plant_id]
                try:
                    location_container.upsert_item(doc)
                except Exception as e:
                    logging.error(f"[locations] upsert failed for {doc.get('id')}: {e}")
    except Exception as e:
        logging.error(f"[locations] cleanup error: {e}")

def main(req: func.HttpRequest) -> func.HttpResponse:
    if req.method == "OPTIONS":
        return func.HttpResponse(status_code=204, headers=_cors_headers())

    # Accept JSON body or query params
    try:
        body = req.get_json()
    except Exception:
        body = {}

    item_id = body.get("id") or req.params.get("id")
    email = body.get("email") or req.params.get("email")
    location_hint = body.get("location") or req.params.get("location")

    if not item_id or not email:
        return _json({"error": "Missing required fields (id, email)."}, 400)

    email_lower = email.strip().lower()
    item_id = str(item_id).strip()

    logging.info(f"🗑️ deleteUserPlant requested id='{item_id}', email='{email_lower}', loc='{location_hint or ''}'")

    # Delete main user plant doc
    res = _try_delete_user_plant(item_id, email_lower)
    if not res.get("deleted"):
        return _json({"status": "not_found", "id": item_id}, 404)

    # Cleanup location map
    inferred_location = location_hint
    if not inferred_location:
        # Try to infer from prev doc
        prev = res.get("doc") or {}
        inferred_location = prev.get("location")
    _remove_from_locations(email_lower, item_id, inferred_location)

    return _json({"status": "deleted", "id": item_id})
