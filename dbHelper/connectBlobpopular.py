import re
from collections import defaultdict
from azure.storage.blob import BlobServiceClient
from azure.cosmos import CosmosClient

# === CONFIG ===
blob_connection_string = "DefaultEndpointsProtocol=https;AccountName=photos12;AccountKey=CMXo64vRFiKhDZNvzUGi2j/kZLSjS8cLmbJQshOeBcJTT5V4wcb2NZKXd4jMPFsVU7RKSwGnnkSq+AStkPz2Iw==;EndpointSuffix=core.windows.net"
blob_container_name = "plants-photos"

cosmos_endpoint = "https://greener-database.documents.azure.com:443/"
cosmos_key = "Mqxy0jUQCmwDYNjaxtFOauzxc2CRPeNFaxDKktxNJTmUiGlARA2hIZueLt8D1u8B8ijgvEbzCtM5ACDbUzDRKg=="
cosmos_db_name = "GreenerDB"
cosmos_container_name = "Plants"

trending_ids = {
    "Epipremnum aureum",
    "Sansevieria trifasciata",
    "Monstera deliciosa",
    "Ocimum basilicum",
    "Zamioculcas zamiifolia"
}

# === INIT ===
blob_service = BlobServiceClient.from_connection_string(blob_connection_string)
blob_container = blob_service.get_container_client(blob_container_name)
account = blob_service.account_name

cosmos_client = CosmosClient(cosmos_endpoint, cosmos_key)
cosmos_db = cosmos_client.get_database_client(cosmos_db_name)
cosmos_container = cosmos_db.get_container_client(cosmos_container_name)

# === 1. GROUP BLOB IMAGES BY NORMALIZED PLANT NAME ===
plant_images = defaultdict(list)

def normalize(name):
    return re.sub(r'[^a-zA-Z]', '', name).lower()

for blob in blob_container.list_blobs():
    name_no_ext = blob.name.rsplit('.', 1)[0]
    normalized = normalize(name_no_ext)
    image_url = f"https://{account}.blob.core.windows.net/{blob_container_name}/{blob.name}"
    plant_images[normalized].append(image_url)

# === 2. FILTER ONLY 5 TRENDING PLANTS AND UPDATE ===
success = 0
skipped = []

for normalized_name, urls in plant_images.items():
    # Skip blobs that don’t match any trending plant
    matched_id = next((pid for pid in trending_ids if normalize(pid) == normalized_name), None)
    if not matched_id:
        continue

    query = f"SELECT * FROM c WHERE c.id = @id"
    results = list(cosmos_container.query_items(
        query=query,
        parameters=[{"name": "@id", "value": matched_id}],
        enable_cross_partition_query=True
    ))

    if not results:
        print(f"⚠️ No match in Cosmos DB for '{matched_id}'")
        skipped.append((matched_id, "No match"))
        continue

    doc = results[0]
    doc["image_urls"] = urls

    try:
        cosmos_container.upsert_item(doc)
        print(f"✅ Updated '{doc.get('latin_name') or doc.get('common_name')}' with {len(urls)} image(s)")
        success += 1
    except Exception as e:
        print(f"❌ Failed to update '{doc.get('latin_name') or doc.get('common_name', '?')}': {e}")
        skipped.append((matched_id, str(e)))

# === SUMMARY ===
print(f"\n✅ {success} trending plants updated with image URLs.")
if skipped:
    print(f"⚠️ {len(skipped)} skipped:")
    for name, reason in skipped:
        print(f" - {name}: {reason}")
