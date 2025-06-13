import os
import json
import logging
import azure.functions as func
from azure.cosmos import CosmosClient, exceptions
import google.generativeai as genai

# Config
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

def normalize_plant_data(raw):
    """
    Returns data in the constant, normalized format expected by the frontend.
    Handles various field names/values from legacy, web, Gemini, etc.
    """
    # Helper: Coerce water/repot/feed fields to integer days/years, pets to str
    def to_int(val, default):
        try:
            if isinstance(val, int):
                return val
            if isinstance(val, str) and val.strip().isdigit():
                return int(val.strip())
            # try to parse things like '7 days'
            if isinstance(val, str):
                for word in val.split():
                    if word.isdigit():
                        return int(word)
            return default
        except Exception:
            return default

    # Helper: detect poison status
    def parse_pets(val):
        if not val:
            return "unknown"
        s = str(val).lower()
        if "poison" in s or "toxic" in s:
            return "poisonous"
        elif "safe" in s or "non-toxic" in s or "not poisonous" in s:
            return "not poisonous"
        return s

    # Try to use best available values; default to placeholder
    return {
        "common_name": raw.get("common_name") or raw.get("name") or raw.get("title") or "",
        "scientific_name": raw.get("scientific_name") or raw.get("latin_name") or raw.get("botanical_name") or "",
        "image_url": (raw.get("image_url") or raw.get("image") or (raw.get("image_urls") or [None])[0]),
        "care_info": {
            "light": raw.get("light") or raw.get("shade") or raw.get("sunlight") or "—",
            "humidity": raw.get("humidity") or raw.get("moisture") or "—",
            "temperature_min_c": to_int(raw.get("temperature_min_c") or raw.get("temperature", {}).get("min"), None),
            "temperature_max_c": to_int(raw.get("temperature_max_c") or raw.get("temperature", {}).get("max"), None),
            "pets": parse_pets(raw.get("pets") or raw.get("pet_safe") or raw.get("poisonous")),
            "difficulty": to_int(raw.get("difficulty") or raw.get("care_difficulty"), None)
        },
        "schedule": {
            "water_days": to_int(raw.get("water_days") or raw.get("watering_interval") or raw.get("water_every") or raw.get("water") or raw.get("watering"), None),
            "feed_days": to_int(raw.get("feed_days") or raw.get("feed_interval") or raw.get("feed_every") or raw.get("feed"), None),
            "repot_years": to_int(raw.get("repot_years") or raw.get("repot_interval") or raw.get("repot_every") or raw.get("repot"), None)
        },
        "care_tips": raw.get("care_tips") or raw.get("tips") or raw.get("care") or "",
        "family": raw.get("family_common_name") or raw.get("family") or "",
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
            # Check if already normalized (has the 'care_info' and 'schedule' keys)
            doc = results[0]
            if all(x in doc for x in ["care_info", "schedule"]):
                return doc
            else:
                # Need to normalize and update
                norm = normalize_plant_data(doc)
                norm['id'] = doc.get('id', plant_name)  # keep document ID
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
        "Return STRICTLY this JSON (keys, order and all fields, missing values as null):\n"
        "{"
        "\"common_name\": str, \"scientific_name\": str, \"image_url\": str, "
        "\"care_info\": {"
            "\"light\": str, \"humidity\": str, \"temperature_min_c\": int, \"temperature_max_c\": int, "
            "\"pets\": \"poisonous|not poisonous|unknown\", \"difficulty\": int"
        "}, "
        "\"schedule\": {"
            "\"water_days\": int, \"feed_days\": int, \"repot_years\": int"
        "}, "
        "\"care_tips\": str, \"family\": str"
        "}\n"
        "Do not explain. Only reply with a single JSON object, no markdown, no comments."
    )
    try:
        res = model.generate_content(prompt + f"\nPlant: {plant_name}")
        # Try to extract only the JSON from the response
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

    plant_name = req.params.get("name") or (req.get_json().get("name") if req.method == "POST" else None)
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
