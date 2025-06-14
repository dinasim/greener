import os
import json
import logging
from datetime import datetime, timedelta
import azure.functions as func
from azure.cosmos import CosmosClient

# CONFIG
COSMOS_URI = os.getenv("COSMOS_URI") or "https://greener-database.documents.azure.com:443/"
COSMOS_KEY = os.getenv("COSMOS_KEY") or "Mqxy0jUQCmwDYNjaxtFOauzxc2CRPeNFaxDKktxNJTmUiGlARA2hIZueLt8D1u8B8ijgvEbzCtM5ACDbUzDRKg=="
DB_NAME = "GreenerDB"
USER_PLANTS_CONTAINER = "userPlants"

client = CosmosClient(COSMOS_URI, credential=COSMOS_KEY)
db = client.get_database_client(DB_NAME)
container = db.get_container_client(USER_PLANTS_CONTAINER)

def _cors_headers():
    return {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST,GET,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type"
    }

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

def main(req: func.HttpRequest) -> func.HttpResponse:
    if req.method == "OPTIONS":
        return func.HttpResponse(status_code=204, headers=_cors_headers())
    try:
        data = req.get_json()
        plant_id = data.get("id")
        task = data.get("task")
        date_str = data.get("date")  # optional; if missing, use now
        if not plant_id or task not in ["water", "feed", "repot"]:
            return func.HttpResponse(
                "Missing plant id or invalid task.",
                status_code=400,
                headers=_cors_headers(),
            )
    except Exception as e:
        return func.HttpResponse(f"Invalid request: {e}", status_code=400, headers=_cors_headers())

    # Fetch plant (partition key is plant_id)
    try:
        plant = container.read_item(item=plant_id, partition_key=plant_id)
    except Exception as e:
        return func.HttpResponse(
            f"Plant not found: {e}",
            status_code=404,
            headers=_cors_headers()
        )

    # Use provided date or now
    now = datetime.utcnow()
    if date_str:
        try:
            last_dt = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
        except Exception:
            last_dt = now
    else:
        last_dt = now

    # Update last_* and next_*
    task_map = {
        "water": ("last_watered", "next_water", "schedule", "water"),
        "feed": ("last_fed", "next_feed", "schedule", "feed"),
        "repot": ("last_repotted", "next_repot", "schedule", "repot")
    }
    last_field, next_field, sched_field, sched_key = task_map[task]

    # Update the last_* field
    plant[last_field] = last_dt.isoformat()

    # Calculate interval for next_*
    schedule = (plant.get(sched_field, {}) or {})
    entry = schedule.get(sched_key, {}) or {}
    amount = entry.get("amount", 1)
    unit = entry.get("unit", "day")
    interval_days = schedule_to_days(amount, unit)
    # Default to 7 for water, 30 for feed, 365 for repot if missing
    if task == "water" and not interval_days:
        interval_days = 7
    if task == "feed" and not interval_days:
        interval_days = 30
    if task == "repot" and not interval_days:
        interval_days = 365
    plant[next_field] = (last_dt + timedelta(days=interval_days)).isoformat()

    # Optional: update wateringSchedule.lastWatered
    if task == "water" and "wateringSchedule" in plant:
        plant["wateringSchedule"]["lastWatered"] = last_dt.isoformat()
        plant["wateringSchedule"]["lastWateringUpdate"] = last_dt.strftime("%Y-%m-%d")

    # Save to Cosmos
    try:
        container.upsert_item(plant)
    except Exception as e:
        return func.HttpResponse(f"DB error: {e}", status_code=500, headers=_cors_headers())

    return func.HttpResponse(
        json.dumps(plant),
        status_code=200,
        headers={**_cors_headers(), "Content-Type": "application/json"}
    )
