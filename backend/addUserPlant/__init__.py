import azure.functions as func
import json
from azure.cosmos import CosmosClient
from datetime import datetime, timedelta
import logging

COSMOS_URI = "https://greener-database.documents.azure.com:443/"
COSMOS_KEY = "Mqxy0jUQCmwDYNjaxtFOauzxc2CRPeNFaxDKktxNJTmUiGlARA2hIZueLt8D1u8B8ijgvEbzCtM5ACDbUzDRKg=="
DATABASE_NAME = "GreenerDB"
PLANTS_CONTAINER_NAME = "userPlants"
LOCATIONS_CONTAINER_NAME = "userPlantsLocation"

client = CosmosClient(COSMOS_URI, credential=COSMOS_KEY)
plants_container = client.get_database_client(DATABASE_NAME).get_container_client(PLANTS_CONTAINER_NAME)
locations_container = client.get_database_client(DATABASE_NAME).get_container_client(LOCATIONS_CONTAINER_NAME)

def parse_delta(schedule_entry, fallback_days=7, fallback_unit="days"):
    """
    Given a schedule dict: {"amount": 7, "unit": "days"}, returns a timedelta.
    fallback_days: default if not provided.
    fallback_unit: used if 'unit' missing.
    """
    if not schedule_entry or not isinstance(schedule_entry, dict):
        return timedelta(days=fallback_days)
    amt = schedule_entry.get("amount")
    unit = (schedule_entry.get("unit") or fallback_unit).lower()
    if not amt or not isinstance(amt, int):
        return timedelta(days=fallback_days)
    if "day" in unit:
        return timedelta(days=amt)
    if "week" in unit:
        return timedelta(weeks=amt)
    if "month" in unit:
        return timedelta(days=amt * 30)
    if "year" in unit:
        return timedelta(days=amt * 365)
    return timedelta(days=fallback_days)

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info("🌱 userplants/add triggered")
    try:
        data = req.get_json()
        required = ["email", "nickname", "location", "common_name", "scientific_name"]
        if not all(k in data for k in required):
            logging.error("Missing required fields.")
            return func.HttpResponse("Missing required fields", status_code=400)

        # IDs
        plant_id = f"{data['email']}_{data['nickname']}"
        location_id = f"{data['email']}_{data['location']}"

        now = datetime.utcnow()
        def parse_date(s, fallback):
            try:
                return datetime.fromisoformat(s)
            except Exception:
                try:
                    return datetime.strptime(s, "%Y-%m-%d")
                except Exception:
                    return fallback

        # --- Get all schedule info ---
        care_info = data.get("care_info", {})
        schedule = data.get("schedule", {})  # schedule is expected: {"water": {...}, "feed": {...}, "repot": {...}}

        # Accept these optional keys from frontend:
        # last_watered, last_fed, last_repotted  (as ISO strings or 'YYYY-MM-DD')
        last_watered = parse_date(data.get("last_watered"), now)
        last_fed = parse_date(data.get("last_fed"), now)
        last_repotted = parse_date(data.get("last_repotted"), now)

        # Calculate next due dates
        next_water = (last_watered + parse_delta(schedule.get("water"))).isoformat()
        next_feed = (last_fed + parse_delta(schedule.get("feed"), fallback_days=30, fallback_unit="days")).isoformat()
        next_repot = (last_repotted + parse_delta(schedule.get("repot"), fallback_days=365, fallback_unit="years")).isoformat()

        # Compose the user plant item
        user_plant = {
            "id": plant_id,
            "email": data["email"],
            "nickname": data["nickname"],
            "location": data["location"],
            "common_name": data.get("common_name"),
            "scientific_name": data.get("scientific_name"),
            "image_url": data.get("image_url", ""),
            "care_info": care_info,
            "schedule": schedule,
            "family": data.get("family", ""),
            "care_tips": data.get("care_tips", ""),
            "common_problems": data.get("common_problems", []),
            # --- Next maintenance fields ---
            "last_watered": last_watered.isoformat(),
            "last_fed": last_fed.isoformat(),
            "last_repotted": last_repotted.isoformat(),
            "next_water": next_water,
            "next_feed": next_feed,
            "next_repot": next_repot,
            # Optional: Save any additional legacy fields
            "avg_watering": data.get("avg_watering"),
            "origin": data.get("origin"),
        }

        # Save user plant
        plants_container.upsert_item(user_plant)
        logging.info(f"Saved user plant: {user_plant['id']} for user {data['email']}")

        # Ensure (email, location) exists in userPlantsLocation
        try:
            locations_container.read_item(item=location_id, partition_key=data['email'])
            logging.info(f"userPlantsLocation exists: {location_id}")
        except Exception:
            locations_container.create_item({
                "id": location_id,
                "email": data["email"],
                "location": data["location"]
            })
            logging.info(f"userPlantsLocation created: {location_id}")

        return func.HttpResponse("Success", status_code=200)

    except Exception as e:
        logging.error(f"Error: {str(e)}", exc_info=True)
        return func.HttpResponse(f"Error: {str(e)}", status_code=500)
