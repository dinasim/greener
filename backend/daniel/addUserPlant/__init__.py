import azure.functions as func
import json
from azure.cosmos import CosmosClient
import os
from datetime import datetime, timedelta

def add_cors_headers(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS, PUT, PATCH, DELETE'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type,Authorization,X-User-Email'
    return response 

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

        # Generate IDs
        plant_id = f"{data['email']}_{data['nickname']}"
        location_id = f"{data['email']}_{data['location']}"

        now = datetime.utcnow()
        data["id"] = plant_id
        data["next_water"] = now.isoformat()

        # Parse next_feed from "Every 10 weeks"
        feed_text = data.get("feed", "").lower()
        try:
            weeks = int([w for w in feed_text.split() if w.isdigit()][0])
            data["next_feed"] = (now + timedelta(weeks=weeks)).isoformat()
        except:
            data["next_feed"] = None

        # Parse next_repot from "Every 2 years"
        repot_text = data.get("repot", "").lower()
        try:
            years = int([w for w in repot_text.split() if w.isdigit()][0])
            future_year = now.year + years
            data["next_repot"] = now.replace(year=future_year).isoformat()
        except:
            data["next_repot"] = None

        # Save user plant
        plants_container.upsert_item(data)

        # Ensure (email, location) exists in userPlantsLocation
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
