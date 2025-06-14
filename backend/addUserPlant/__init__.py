import os
import json
import logging
from datetime import datetime, timedelta
import azure.functions as func
from azure.cosmos import CosmosClient
import google.generativeai as genai
import requests

# CONFIGURATION (same as your working plant_detail function)
COSMOS_URI = "https://greener-database.documents.azure.com:443/"
COSMOS_KEY = "Mqxy0jUQCmwDYNjaxtFOauzxc2CRPeNFaxDKktxNJTmUiGlARA2hIZueLt8D1u8B8ijgvEbzCtM5ACDbUzDRKg=="
DB_NAME = "GreenerDB"
USER_PLANTS_CONTAINER = "userPlants"
USER_PLANTS_LOCATION_CONTAINER = "userPlantsLocation"
PLANTS_CONTAINER = "Plants"
GOOGLE_KEY = "AIzaSyDaj4uxYtaVndDVu6YTIeZpbL8yZiF8mgk"
PLANT_DETAILS_JSON_URL = "https://usersfunctions.azurewebsites.net/api/plantdetailsjson"

# Set up clients
genai.configure(api_key=GOOGLE_KEY)
model = genai.GenerativeModel("gemini-1.5-flash")
client = CosmosClient(COSMOS_URI, credential=COSMOS_KEY)
db = client.get_database_client(DB_NAME)
user_plants_container = db.get_container_client(USER_PLANTS_CONTAINER)
location_container = db.get_container_client(USER_PLANTS_LOCATION_CONTAINER)
plants_container = db.get_container_client(PLANTS_CONTAINER)

def _cors_headers():
    return {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST,GET,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type"
    }

def parse_schedule(val, fallback_unit="days"):
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
    care = raw.get("care_info", {})
    sched = raw.get("schedule", {})
    def clean(x, fallback="—"):
        return x if x not in [None, "null", "", [], {}] else fallback
    problems = raw.get("common_problems")
    if not isinstance(problems, list):
        problems = []
    normalized_problems = []
    for p in problems:
        if isinstance(p, dict) and "name" in p and "description" in p:
            normalized_problems.append({"name": str(p["name"]), "description": str(p["description"])})
        elif isinstance(p, str):
            normalized_problems.append({"name": p, "description": ""})
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
        "common_problems": normalized_problems
    }

def query_cosmos(plant_name):
    try:
        query = "SELECT * FROM Plants p WHERE LOWER(p.common_name) = @name OR LOWER(p.scientific_name) = @name"
        params = [{"name": "@name", "value": plant_name.lower()}]
        results = list(plants_container.query_items(
            query=query,
            parameters=params,
            enable_cross_partition_query=True
        ))
        if results:
            doc = results[0]
            norm = normalize_plant_data(doc)
            # If *any* care_info or schedule field is missing, '-', or 'unknown', refresh from Gemini
            refresh = False
            for field in ["light", "humidity", "temperature_min_c", "temperature_max_c", "pets", "difficulty"]:
                v = norm["care_info"].get(field)
                if v in [None, "—", "unknown"]:
                    refresh = True
                    break
            for field in ["water", "feed", "repot"]:
                v = norm["schedule"].get(field)
                if not v or v.get("amount") in [None, 0]:
                    refresh = True
                    break
            if not norm.get("common_problems") or len(norm.get("common_problems", [])) == 0:
                refresh = True
            if refresh:
                logging.warning(f"DB entry for '{plant_name}' has missing or placeholder fields. Forcing Gemini enrichment...")
                gemini_data = call_gemini(plant_name)
                if gemini_data:
                    gemini_data['id'] = doc.get('id', plant_name)
                    plants_container.upsert_item(gemini_data)
                    return gemini_data
                else:
                    logging.error(f"Gemini returned no usable data for '{plant_name}'. Returning normalized DB doc anyway.")
            return norm
        return None
    except Exception as e:
        logging.error(f"Cosmos query failed for '{plant_name}': {e}")
        return None

def schedule_to_days(amount, unit):
    unit = (unit or "").lower()
    if unit in ["day", "days"]:
        return amount
    if unit in ["week", "weeks"]:
        return amount * 7
    if unit in ["month", "months"]:
        return amount * 30
    if unit in ["year", "years"]:
        return amount * 365
    return amount  # Default fallback

def call_gemini(plant_name):
    prompt = (
        f"Give ONLY the structured care info, schedule, and common problems for the plant '{plant_name}'.\n"
        "Your reply MUST be a single valid JSON object with these fields only (missing values as null or \"Unknown\").\n"
        "No explanation, no markdown, no comments. Output strictly this structure:\n"
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
        "\"care_tips\": str, \"family\": str, "
        "\"common_problems\": ["
          "{\"name\": str, \"description\": str}, ..."
        "]"
        "}"
    )
    try:
        logging.info(f"Calling Gemini for '{plant_name}'...")
        res = model.generate_content(prompt + f"\nPlant: {plant_name}")
        response_text = res.text.strip()
        json_start = response_text.find('{')
        json_end = response_text.rfind('}') + 1
        if json_start >= 0 and json_end > json_start:
            json_str = response_text[json_start:json_end]
            plant_json = json.loads(json_str)
            logging.info(f"Gemini response for '{plant_name}': {plant_json}")
            return normalize_plant_data(plant_json)
        else:
            logging.error(f"Could not extract JSON from Gemini for '{plant_name}': {response_text}")
            return None
    except Exception as e:
        logging.error(f"Gemini call failed for '{plant_name}': {e}")
        return None

def call_plantdetailsjson(plant_name):
    try:
        resp = requests.get(PLANT_DETAILS_JSON_URL, params={"name": plant_name}, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            return normalize_plant_data(data)
        else:
            logging.error(f"plantdetailsjson failed for '{plant_name}': {resp.status_code} {resp.text}")
    except Exception as e:
        logging.error(f"Error calling plantdetailsjson for '{plant_name}': {e}")
    return None

def enrich_if_needed(payload):
    care_info = payload.get("care_info") or {}
    schedule = payload.get("schedule") or {}
    # If critical plant data is missing, fetch
    missing = (
        not care_info or
        all(v in [None, "", {}, "Unknown"] for v in care_info.values()) or
        not schedule or
        all((schedule.get(k) or {}).get("amount") in [None, 0] for k in ["water", "feed", "repot"])
    )
    if not missing:
        return payload
    name = payload.get("common_name") or payload.get("scientific_name")
    logging.info(f"Enriching '{name}' due to missing data...")
    enriched = query_cosmos(name) or call_gemini(name) or call_plantdetailsjson(name)
    if enriched:
        # Save to Plants DB if enrichment came from Gemini or plantdetailsjson
        if not query_cosmos(name):
            try:
                enriched["id"] = (enriched.get("common_name", name) or name).lower()
                plants_container.upsert_item(enriched)
                logging.info(f"Saved enriched data for '{name}' into Plants DB.")
            except Exception as e:
                logging.error(f"Failed to save to Plants DB: {e}")
        # Fill in missing fields for the user plant payload
        payload["care_info"] = payload.get("care_info") or enriched.get("care_info")
        payload["schedule"] = payload.get("schedule") or enriched.get("schedule")
        payload["family"] = payload.get("family") or enriched.get("family")
        payload["origin"] = payload.get("origin") or enriched.get("origin")
        payload["care_tips"] = payload.get("care_tips") or enriched.get("care_tips")
        payload["common_problems"] = payload.get("common_problems") or enriched.get("common_problems")
        payload["image_url"] = payload.get("image_url") or enriched.get("image_url")
    return payload

def compute_next_dates(payload):
    now = datetime.utcnow()
    schedule = payload.get("schedule") or {}
    water = schedule.get("water") or {}
    feed = schedule.get("feed") or {}
    repot = schedule.get("repot") or {}

    water_days = schedule_to_days(water.get("amount", 0) or 0, water.get("unit", "day"))
    feed_days = schedule_to_days(feed.get("amount", 0) or 0, feed.get("unit", "day"))
    repot_days = schedule_to_days(repot.get("amount", 0) or 0, repot.get("unit", "year"))

    payload["next_water"] = (now + timedelta(days=water_days)).isoformat() if water_days else None
    payload["next_feed"] = (now + timedelta(days=feed_days)).isoformat() if feed_days else None
    payload["next_repot"] = (now + timedelta(days=repot_days)).isoformat() if repot_days else None
    return payload

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info("🌱 addUserPlant function triggered")
    if req.method == "OPTIONS":
        return func.HttpResponse(status_code=204, headers=_cors_headers())

    try:
        payload = req.get_json()
    except Exception:
        return func.HttpResponse("Invalid JSON", status_code=400, headers=_cors_headers())

    if not payload.get("id") or not payload.get("email"):
        return func.HttpResponse("Missing required fields (id, email)", status_code=400, headers=_cors_headers())

    # Enrich and normalize as needed
    payload = enrich_if_needed(payload)
    payload = compute_next_dates(payload)

    # Set last_* dates: use provided, or default to today
    now_iso = datetime.utcnow().isoformat()
    payload["last_watered"] = payload.get("last_watered") or now_iso
    payload["last_fed"] = payload.get("last_fed") or now_iso
    payload["last_repotted"] = payload.get("last_repotted") or now_iso

    # Add wateringSchedule field (safe even if schedule is missing)
    schedule = payload.get("schedule") or {}
    water = schedule.get("water") or {}
    water_days = schedule_to_days(water.get("amount", 7) if water.get("amount") is not None else 7, water.get("unit", "day"))
    payload["wateringSchedule"] = {
        "waterDays": water_days,
        "activeWaterDays": water_days,
        "lastWateringUpdate": datetime.utcnow().strftime("%Y-%m-%d"),
        "needsWatering": False,
        "weatherAffected": False,
        "lastWatered": payload.get("last_watered"),
        "createdAt": datetime.utcnow().isoformat()
    }

    try:
        user_plants_container.upsert_item(payload)
        logging.info(f"Saved plant '{payload['id']}' to userPlants.")
    except Exception as e:
        logging.error(f"Failed to save to userPlants: {e}")
        return func.HttpResponse("Error saving user plant.", status_code=500, headers=_cors_headers())

    # Update userPlantsLocation map (safe for missing location)
    try:
        loc_id = f"{payload['email'].lower()}_{payload.get('location','').lower()}"
        location_doc = location_container.read_item(item=loc_id, partition_key=loc_id)
        location_doc["plants"] = list(set(location_doc.get("plants", []) + [payload["id"]]))
        location_container.upsert_item(location_doc)
    except Exception:
        # New location doc
        location_container.upsert_item({
            "id": loc_id,
            "email": payload["email"].lower(),
            "location": payload.get("location", ""),
            "plants": [payload["id"]]
        })

    return func.HttpResponse(json.dumps({"status": "ok"}), status_code=200, headers={**_cors_headers(), "Content-Type": "application/json"})
