import os
import json
import logging
import azure.functions as func
from azure.cosmos import CosmosClient
import google.generativeai as genai

# Config (You can use os.environ if you want to hide keys)
COSMOS_URI = "https://greener-database.documents.azure.com:443/"
COSMOS_KEY = "Mqxy0jUQCmwDYNjaxtFOauzxc2CRPeNFaxDKktxNJTmUiGlARA2hIZueLt8D1u8B8ijgvEbzCtM5ACDbUzDRKg=="
DB_NAME = "GreenerDB"
PLANTS_CONTAINER = "Plants"
GOOGLE_KEY = "AIzaSyDaj4uxYtaVndDVu6YTIeZpbL8yZiF8mgk"

def _cors_headers():
    return {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST,GET,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type"
    }

def parse_schedule(val, fallback_unit="days"):
    # Ensures schedule fields are always {amount, unit} or None
    if isinstance(val, dict):
        amt = val.get("amount")
        unit = val.get("unit") or fallback_unit
        if amt is not None and unit:
            return {"amount": amt, "unit": unit}
    if isinstance(val, int):
        return {"amount": val, "unit": fallback_unit}
    if isinstance(val, str):
        for part in val.split():
            if part.isdigit():
                return {"amount": int(part), "unit": fallback_unit}
    return None

def normalize_plant_data(raw):
    """
    Ensures all fields (including nested ones) are present, consistent, and
    in the constant format expected by the frontend.
    """
    care = raw.get("care_info", {})
    sched = raw.get("schedule", {})

    def clean(x, fallback="—"):
        return x if x not in [None, "null", "", [], {}] else fallback

    return {
        "common_name": clean(raw.get("common_name") or raw.get("name")),
        "scientific_name": clean(raw.get("scientific_name") or raw.get("latin_name")),
        "image_url": clean(raw.get("image_url") or (raw.get("image_urls") or [None])[0]),
        "care_info": {
            "light": clean(care.get("light") or raw.get("light")),
            "humidity": clean(care.get("humidity") or raw.get("humidity")),
            "temperature_min_c": care.get("temperature_min_c") if care.get("temperature_min_c") is not None else None,
            "temperature_max_c": care.get("temperature_max_c") if care.get("temperature_max_c") is not None else None,
            "pets": (care.get("pets") or "unknown"),
            "difficulty": care.get("difficulty") if care.get("difficulty") is not None else None,
        },
        "schedule": {
            "water": parse_schedule(sched.get("water") or raw.get("water")),
            "feed": parse_schedule(sched.get("feed") or raw.get("feed")),
            "repot": parse_schedule(sched.get("repot") or raw.get("repot"), "years"),
        },
        "care_tips": clean(raw.get("care_tips")),
        "family": clean(raw.get("family")),
    }

# Setup Cosmos DB client
client = CosmosClient(COSMOS_URI, credential=COSMOS_KEY)
db = client.get_database_client(DB_NAME)
container = db.get_container_client(PLANTS_CONTAINER)

# Gemini setup
genai.configure(api_key=GOOGLE_KEY)
MODEL_NAME = "gemini-1.5-flash"
model = genai.GenerativeModel(MODEL_NAME)

def query_cosmos(plant_name):
    """Get normalized plant data from DB or None if not found."""
    try:
        query = "SELECT * FROM Plants p WHERE LOWER(p.common_name) = @name OR LOWER(p.scientific_name) = @name"
        params = [{"name": "@name", "value": plant_name.lower()}]
        results = list(container.query_items(
            query=query,
            parameters=params,
            enable_cross_partition_query=True
        ))
        if results:
            doc = results[0]
            # If normalized (has 'schedule' as dict with 'water' etc. as object), use as is
            sched = doc.get("schedule", {})
            norm = normalize_plant_data(doc)
            # Update DB if legacy or broken
            if doc != norm:
                norm['id'] = doc.get('id', plant_name)
                container.upsert_item(norm)
            return norm
        return None
    except Exception as e:
        logging.error(f"Cosmos query failed: {e}")
        return None

def save_to_cosmos(plant_name, norm_data):
    """Save/Upsert normalized plant data."""
    norm_data['id'] = plant_name.lower()
    try:
        container.upsert_item(norm_data)
    except Exception as e:
        logging.error(f"Failed to upsert plant: {e}")

def call_gemini(plant_name):
    prompt = (
        f"Give care info and schedule for the plant '{plant_name}'. "
        "Return STRICTLY this JSON object (all keys, all fields, missing values as null or \"Unknown\"; no explanations):\n"
        "{"
        "\"common_name\": str, \"scientific_name\": str, \"image_url\": str, "
        "\"care_info\": {"
            "\"light\": str, \"humidity\": str, \"temperature_min_c\": int, \"temperature_max_c\": int, "
            "\"pets\": \"poisonous|not poisonous|unknown\", \"difficulty\": int"
        "}, "
        "\"schedule\": {"
            "\"water\": {\"amount\": int, \"unit\": str}, "
            "\"feed\": {\"amount\": int, \"unit\": str}, "
            "\"repot\": {\"amount\": int, \"unit\": str}"
        "}, "
        "\"care_tips\": str, \"family\": str"
        "}\n"
        "Do not explain. Only reply with a single JSON object, no markdown, no comments."
    )
    try:
        res = model.generate_content(prompt + f"\nPlant: {plant_name}")
        response_text = res.text.strip()
        json_start = response_text.find('{')
        json_end = response_text.rfind('}') + 1
        if json_start >= 0 and json_end > json_start:
            json_str = response_text[json_start:json_end]
            plant_json = json.loads(json_str)
            return normalize_plant_data(plant_json)
        else:
            logging.error(f"Could not extract JSON from Gemini: {response_text}")
            return None
    except Exception as e:
        logging.error(f"Gemini call failed: {e}")
        return None

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info("🌱 plant_detail function triggered")
    if req.method == "OPTIONS":
        return func.HttpResponse(status_code=204, headers=_cors_headers())

    plant_name = req.params.get("name")
    if not plant_name and req.method in ("POST", "post"):
        try:
            body = req.get_json()
            plant_name = body.get("name")
        except Exception:
            plant_name = None

    if not plant_name:
        return func.HttpResponse(
            json.dumps({"error": "Missing plant name (use ?name=Plant or POST JSON {'name': ...})"}),
            status_code=400,
            headers={**_cors_headers(), "Content-Type": "application/json"}
        )

    # Try DB first
    plant = query_cosmos(plant_name)
    if plant:
        return func.HttpResponse(
            json.dumps(plant),
            status_code=200,
            headers={**_cors_headers(), "Content-Type": "application/json"}
        )

    # Else: ask Gemini, normalize, save, and return
    gemini_data = call_gemini(plant_name)
    if gemini_data:
        save_to_cosmos(plant_name, gemini_data)
        return func.HttpResponse(
            json.dumps(gemini_data),
            status_code=200,
            headers={**_cors_headers(), "Content-Type": "application/json"}
        )

    return func.HttpResponse(
        json.dumps({"error": "Could not find or generate data for this plant"}),
        status_code=500,
        headers={**_cors_headers(), "Content-Type": "application/json"}
    )
