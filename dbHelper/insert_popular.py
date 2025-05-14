from azure.cosmos import CosmosClient

# ✏️ Replace with your Azure Cosmos DB values:
COSMOS_ENDPOINT = "https://greener-database.documents.azure.com:443/"
COSMOS_KEY = "Mqxy0jUQCmwDYNjaxtFOauzxc2CRPeNFaxDKktxNJTmUiGlARA2hIZueLt8D1u8B8ijgvEbzCtM5ACDbUzDRKg=="
DATABASE_NAME = "GreenerDB"
CONTAINER_NAME = "Plants"

trending_plants = [
    {
        "id": "Epipremnum aureum",
        "common_name": "Golden Pothos",
        "latin_name": "Epipremnum aureum",
        "growth": "Fast",
        "soil": "Well-drained, rich",
        "shade": "Partial shade",
        "moisture": "Medium",
        "edibility_rating": "0",
        "medicinal": None,
        "uses": None,
        "habitat": None,
        "propagation": None,
        "care_difficulty": "Easy",
        "temperature": {"min": 59, "max": 86},  # °F
        "care_tips": "Keep soil slightly moist, tolerates low light.",
        "image_urls": ["https://upload.wikimedia.org/wikipedia/commons/9/98/Epipremnum_aureum2.jpg"]
    },
    {
        "id": "Sansevieria trifasciata",
        "common_name": "Snake Plant 'Laurentii'",
        "latin_name": "Sansevieria trifasciata",
        "growth": "Slow",
        "soil": "Free-draining",
        "shade": "Low light",
        "moisture": "Low",
        "edibility_rating": "0",
        "medicinal": None,
        "uses": None,
        "habitat": None,
        "propagation": None,
        "care_difficulty": "Easy",
        "temperature": {"min": 50, "max": 95},
        "care_tips": "Allow soil to dry completely between waterings.",
        "image_urls": ["https://upload.wikimedia.org/wikipedia/commons/3/35/Snake_Plant_%28Sansevieria_trifasciata_%27Laurentii%27%29.jpg"]
    },
    {
        "id": "Monstera deliciosa",
        "common_name": "Monstera",
        "latin_name": "Monstera deliciosa",
        "growth": "Moderate",
        "soil": "Well-drained peat-based mix",
        "shade": "Bright indirect light",
        "moisture": "Medium",
        "edibility_rating": "1",
        "medicinal": None,
        "uses": None,
        "habitat": None,
        "propagation": None,
        "care_difficulty": "Easy",
        "temperature": {"min": 65, "max": 86},
        "care_tips": "Prefers humidity and indirect light. Mist regularly.",
        "image_urls": ["https://upload.wikimedia.org/wikipedia/commons/4/4c/Monstera_deliciosa2.jpg"]
    },
    {
        "id": "Ocimum basilicum",
        "common_name": "Basil",
        "latin_name": "Ocimum basilicum",
        "growth": "Fast",
        "soil": "Moist, well-drained",
        "shade": "Full sun",
        "moisture": "High",
        "edibility_rating": "5",
        "medicinal": None,
        "uses": "Culinary herb",
        "habitat": None,
        "propagation": "Seed or cuttings",
        "care_difficulty": "Moderate",
        "temperature": {"min": 60, "max": 95},
        "care_tips": "Harvest leaves regularly. Avoid flowering for best flavor.",
        "image_urls": ["https://upload.wikimedia.org/wikipedia/commons/3/3d/Ocimum_basilicum_Basilico_Genovese.jpg"]
    },
    {
        "id": "Zamioculcas zamiifolia",
        "common_name": "Zz Plant",
        "latin_name": "Zamioculcas zamiifolia",
        "growth": "Slow",
        "soil": "Well-draining",
        "shade": "Low to bright indirect light",
        "moisture": "Low",
        "edibility_rating": "0",
        "medicinal": None,
        "uses": None,
        "habitat": None,
        "propagation": "Division or leaf cuttings",
        "care_difficulty": "Easy",
        "temperature": {"min": 60, "max": 86},
        "care_tips": "Drought-tolerant. Avoid overwatering.",
        "image_urls": ["https://upload.wikimedia.org/wikipedia/commons/b/b2/Zamioculcas_zamiifolia01.jpg"]
    }
]

def insert_trending():
    client = CosmosClient(COSMOS_ENDPOINT, COSMOS_KEY)
    db = client.get_database_client(DATABASE_NAME)
    container = db.get_container_client(CONTAINER_NAME)

    for plant in trending_plants:
        container.upsert_item(plant)

    print("✅ Trending plants inserted successfully!")

if __name__ == "__main__":
    insert_trending()
