# addUserPlant/__init__.py - SAFE VERSION - ONLY ADDED WATERING SCHEDULE
import azure.functions as func
import json
from azure.cosmos import CosmosClient
import os
from datetime import datetime, timedelta, timezone

COSMOS_URI = "https://greener-database.documents.azure.com:443/"
COSMOS_KEY = "Mqxy0jUQCmwDYNjaxtFOauzxc2CRPeNFaxDKktxNJTmUiGlARA2hIZueLt8D1u8B8ijgvEbzCtM5ACDbUzDRKg=="
DATABASE_NAME = "GreenerDB"
PLANTS_CONTAINER_NAME = "userPlants"
LOCATIONS_CONTAINER_NAME = "userPlantsLocation"

client = CosmosClient(COSMOS_URI, credential=COSMOS_KEY)
plants_container = client.get_database_client(DATABASE_NAME).get_container_client(PLANTS_CONTAINER_NAME)
locations_container = client.get_database_client(DATABASE_NAME).get_container_client(LOCATIONS_CONTAINER_NAME)

def main(req: func.HttpRequest) -> func.HttpResponse:
    try:
        data = req.get_json()
        required = ["email", "nickname", "location"]
        if not all(k in data for k in required):
            return func.HttpResponse("Missing required fields", status_code=400)

        # Generate IDs (UNCHANGED)
        plant_id = f"{data['email']}_{data['nickname']}"
        location_id = f"{data['email']}_{data['location']}"

        # UNCHANGED - Keep your original logic
        now = datetime.utcnow()
        data["id"] = plant_id
        data["next_water"] = now.isoformat()  # ✅ KEPT YOUR ORIGINAL LOGIC

        # Parse next_feed from "Every 10 weeks" (UNCHANGED)
        feed_text = data.get("feed", "").lower()
        try:
            weeks = int([w for w in feed_text.split() if w.isdigit()][0])
            data["next_feed"] = (now + timedelta(weeks=weeks)).isoformat()
        except:
            data["next_feed"] = None

        # Parse next_repot from "Every 2 years" (UNCHANGED)
        repot_text = data.get("repot", "").lower()
        try:
            years = int([w for w in repot_text.split() if w.isdigit()][0])
            future_year = now.year + years  
            data["next_repot"] = now.replace(year=future_year).isoformat()
        except:
            data["next_repot"] = None

        # ✅ ONLY NEW ADDITION - Add watering schedule for business watering features
        water_days = data.get("water_days", 7)  # Get from plant data or default to 7
        if isinstance(water_days, str):
            try:
                water_days = int(water_days)
            except:
                water_days = 7
        
        # Add watering schedule (ONLY NEW PART)
        data["wateringSchedule"] = {
            'waterDays': water_days,
            'activeWaterDays': water_days,
            'lastWateringUpdate': now.strftime('%Y-%m-%d'),
            'needsWatering': False,  # New plants don't need immediate watering
            'weatherAffected': False,
            'lastWatered': None,
            'createdAt': now.isoformat()
        }

        # Save user plant (UNCHANGED)
        plants_container.upsert_item(data)

        # Ensure (email, location) exists in userPlantsLocation (UNCHANGED)
        try:
            locations_container.read_item(item=location_id, partition_key=data['email'])
        except:
            locations_container.create_item({
                "id": location_id,
                "email": data["email"],
                "location": data["location"]
            })

        return func.HttpResponse("Success", status_code=200)

    except Exception as e:
        return func.HttpResponse(f"Error: {str(e)}", status_code=500)