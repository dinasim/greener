import json, logging, os, math
import azure.functions as func
from azure.cosmos import CosmosClient, exceptions

COSMOS_CONN = os.environ.get('COSMOSDB__MARKETPLACE_CONNECTION_STRING')
DB_NAME     = os.environ.get('COSMOSDB_MARKETPLACE_DATABASE_NAME', 'greener-marketplace-db')
BUSINESS_CN = os.environ.get('COSMOSDB_BUSINESS_CONTAINER_NAME', 'business_users')
INV_CN      = os.environ.get('COSMOSDB_INVENTORY_CONTAINER_NAME', 'business_inventory')

def cors(resp: func.HttpResponse) -> func.HttpResponse:
    resp.headers.update({
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, X-User-Email, X-User-Type, X-Business-ID"
    })
    return resp

def haversine_km(lat1, lon1, lat2, lon2):
    R=6371.0
    dlat=math.radians(lat2-lat1)
    dlon=math.radians(lon2-lon1)
    a=math.sin(dlat/2)**2 + math.cos(math.radians(lat1))*math.cos(math.radians(lat2))*math.sin(dlon/2)**2
    return 2*R*math.asin(math.sqrt(a))

def get_client_and_db():
    if not COSMOS_CONN:
        raise RuntimeError("COSMOSDB__MARKETPLACE_CONNECTION_STRING missing")
    client = CosmosClient.from_connection_string(COSMOS_CONN)
    try:
        db = client.get_database_client(DB_NAME)
        # force a read so we fail early with a helpful 404 if the db id is wrong
        db.read()
        return client, db
    except exceptions.CosmosResourceNotFoundError:
        # Helpful diagnostics: list database ids
        try:
            dbs = [d['id'] for d in client.list_databases()]
        except Exception:
            dbs = []
        raise RuntimeError(f"Cosmos database '{DB_NAME}' not found. Available DBs: {dbs}")

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info("nearbyProducts called")

    if req.method == "OPTIONS":
        return cors(func.HttpResponse("", status_code=200))

    # parse query
    try:
        lat = float(req.params.get('lat'))
        lon = float(req.params.get('lon'))
        radius = float(req.params.get('radius', '10'))
    except (TypeError, ValueError):
        return cors(func.HttpResponse(json.dumps({"error":"Invalid or missing lat/lon/radius"}), status_code=400, headers={"Content-Type":"application/json"}))

    try:
        client, db = get_client_and_db()
        business_container = db.get_container_client(BUSINESS_CN)
        inventory_container = db.get_container_client(INV_CN)
    except Exception as e:
        logging.error(f"Cosmos init error: {e}")
        return cors(func.HttpResponse(json.dumps({"error": f"Database error: {e}"}), status_code=500, headers={"Content-Type":"application/json"}))

    # load businesses that have coords
    query = """
    SELECT * FROM c
    WHERE IS_DEFINED(c.address.latitude) AND IS_DEFINED(c.address.longitude)
    AND c.address.latitude != null AND c.address.longitude != null
    AND (c.status = 'active' OR NOT IS_DEFINED(c.status))
    """
    businesses = list(business_container.query_items(query=query, enable_cross_partition_query=True))

    # filter by distance
    nearby_businesses = []
    for b in businesses:
        try:
            blat = float(b.get('address',{}).get('latitude'))
            blon = float(b.get('address',{}).get('longitude'))
        except (TypeError, ValueError):
            continue
        dist = haversine_km(lat, lon, blat, blon)
        if dist <= radius:
            b['_distanceKm'] = round(dist, 2)
            nearby_businesses.append(b)

    # pull a few active items from each business and attach coords
    results = []
    for b in sorted(nearby_businesses, key=lambda x: x['_distanceKm']):
        bid = b.get('id') or b.get('email')
        if not bid:
            continue
        inv_query = """
        SELECT TOP 5 * FROM c
        WHERE (c.businessId = @bid OR c.sellerId = @bid OR c.ownerId = @bid)
        AND (NOT IS_DEFINED(c.status) OR c.status = 'active')
        AND (NOT IS_DEFINED(c.quantity) OR c.quantity > 0)
        """
        items = list(inventory_container.query_items(
            query=inv_query,
            parameters=[{"name":"@bid", "value": bid}],
            enable_cross_partition_query=True
        ))
        for it in items:
            results.append({
                "id": it.get('id'),
                "title": it.get('name') or it.get('common_name') or "Product",
                "price": it.get('finalPrice') or it.get('price') or 0,
                "image": it.get('mainImage') or it.get('image'),
                "businessId": bid,
                "sellerType": "business",
                "location": {
                    "latitude": b.get('address',{}).get('latitude'),
                    "longitude": b.get('address',{}).get('longitude'),
                    "city": b.get('address',{}).get('city', ''),
                    "country": b.get('address',{}).get('country', ''),
                    "formattedAddress": b.get('address',{}).get('formattedAddress', '')
                },
                "distanceKm": b["_distanceKm"],
                "source": "nearbyProducts"
            })

    payload = {
        "success": True,
        "count": len(results),
        "center": {"latitude": lat, "longitude": lon},
        "radius": radius,
        "products": results
    }
    return cors(func.HttpResponse(json.dumps(payload), status_code=200, headers={"Content-Type":"application/json"}))
