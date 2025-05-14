            import re
from collections import defaultdict
from azure.storage.blob import BlobServiceClient
from azure.cosmos import CosmosClient

# === CONFIG ===
# Blob
blob_connection_string = "DefaultEndpointsProtocol=https;AccountName=photos12;AccountKey=CMXo64vRFiKhDZNvzUGi2j/kZLSjS8cLmbJQshOeBcJTT5V4wcb2NZKXd4jMPFsVU7RKSwGnnkSq+AStkPz2Iw==;EndpointSuffix=core.windows.net"
blob_container_name = "plants-photos"

# Cosmos DB
cosmos_endpoint = "https://greener-database.documents.azure.com:443/"
cosmos_key = "Mqxy0jUQCmwDYNjaxtFOauzxc2CRPeNFaxDKktxNJTmUiGlARA2hIZueLt8D1u8B8ijgvEbzCtM5ACDbUzDRKg=="
cosmos_db_name = "GreenerDB"
cosmos_container_name = "Plants"

# === INIT ===
# Blob
blob_service = BlobServiceClient.from_connection_string(blob_connection_string)
blob_container = blob_service.get_container_client(blob_container_name)
account = blob_service.account_name

# Cosmos
cosmos_client = CosmosClient(cosmos_endpoint, cosmos_key)
cosmos_db = cosmos_client.get_database_client(cosmos_db_name)
cosmos_container = cosmos_db.get_container_client(cosmos_container_name)

# === 1. GROUP BLOB IMAGES BY NORMALIZED PLANT NAME ===
plant_images = defaultdict(list)

def normalize(name):
    return re.sub(r'[^a-zA-Z]', '', name).lower()

for blob in blob_container.list_blobs():
    name_no_ext = blob.name.rsplit('.', 1)[0]  # Remove extension
    normalized = normalize(name_no_ext)
    image_url = f"https://{account}.blob.core.windows.net/{blob_container_name}/{blob.name}"
    plant_images[normalized].append(image_url)

# === 2. MATCH TO COSMOS PLANTS AND UPDATE ===
success = 0
skipped = []

for normalized_name, urls in plant_images.items():
    query = "SELECT * FROM c"
    results = list(cosmos_container.query_items(
        query=query,
        enable_cross_partition_query=True
    ))

    matched_doc = None
    for doc in results:
        common = normalize(doc.get("common_name", ""))
        latin = normalize(doc.get("latin_name", ""))
        if normalized_name == common or normalized_name == latin:
            matched_doc = doc
            break

    if not matched_doc:
        print(f"⚠️ No match in Cosmos DB for normalized name: '{normalized_name}'")
        skipped.append((normalized_name, "No match"))
        continue

    matched_doc["image_urls"] = urls

    try:
        cosmos_container.upsert_item(matched_doc)
        print(f"✅ Updated '{matched_doc.get('latin_name') or matched_doc.get('common_name')}' with {len(urls)} image(s)")
        success += 1
    except Exception as e:
        print(f"❌ Failed to update '{matched_doc.get('latin_name') or matched_doc.get('common_name', '?')}': {e}")
        skipped.append((normalized_name, str(e)))

# === SUMMARY ===
print(f"\n✅ {success} plants updated with image URLs.")
if skipped:
    print(f"⚠️ {len(skipped)} skipped:")
    for name, reason in skipped:
        print(f" - {name}: {reason}")
