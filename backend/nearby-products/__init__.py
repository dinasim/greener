# backend/nearby-products/__init__.py
import os
import math
import json
import logging
import datetime
import traceback
import requests
import azure.functions as func
from azure.cosmos import CosmosClient, exceptions

# ---------- Config (env-overridable) ----------
COSMOS_CONN_ENV = "COSMOSDB__MARKETPLACE_CONNECTION_STRING"
COSMOS_DB_ENV   = "COSMOSDB_MARKETPLACE_DATABASE_NAME"
DEFAULT_DB_NAME = "greener-marketplace-db"

# Prefer explicit container via env; otherwise try these in order
PRODUCTS_CONTAINER_ENV = "COSMOSDB_PRODUCTS_CONTAINER_NAME"
FALLBACK_PRODUCT_CONTAINERS = [
    "marketplace_products",
    "marketplace-plants",
    "plants",
]

CACHE_CONTAINER_ENV = "COSMOSDB_CACHE_CONTAINER_NAME"
DEFAULT_CACHE_CONTAINER = "marketplace-cache"

# ---------- Minimal CORS helpers ----------
CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers":
        "Content-Type, Authorization, X-User-Email, X-User-Type, X-Business-ID",
}

def _cors(resp: func.HttpResponse) -> func.HttpResponse:
    resp.headers.update(CORS_HEADERS)
    return resp

def _ok(data: dict, status: int = 200) -> func.HttpResponse:
    return _cors(func.HttpResponse(
        json.dumps(data, default=str),
        status_code=status,
        headers={"Content-Type": "application/json"},
    ))

def _err(msg: str, status: int = 500) -> func.HttpResponse:
    logging.error(msg)
    return _cors(func.HttpResponse(
        json.dumps({"error": msg}),
        status_code=status,
        headers={"Content-Type": "application/json"},
    ))

# ---------- Utilities ----------
def _haversine_km(lat1, lon1, lat2, lon2) -> float:
    R = 6371.0
    dlat = math.radians(float(lat2) - float(lat1))
    dlon = math.radians(float(lon2) - float(lon1))
    a = math.sin(dlat/2)**2 + math.cos(math.radians(float(lat1))) \
        * math.cos(math.radians(float(lat2))) * math.sin(dlon/2)**2
    return 2 * R * math.asin(math.sqrt(a))

def _extract_lat_lon(obj) -> tuple | None:
    """Be tolerant about shapes: location/address with latitude/longitude or lat/lng/lon."""
    if not isinstance(obj, dict):
        return None
    L = obj.get("location") or obj.get("address") or {}
    if not isinstance(L, dict):
        return None

    def _num(v):
        try:
            if v is None or v == "":
                return None
            n = float(v)
            if math.isfinite(n):
                return n
        except Exception:
            pass
        return None

    lat = _num(L.get("latitude") or L.get("lat"))
    lon = _num(L.get("longitude") or L.get("lng") or L.get("lon"))
    if lat is None or lon is None:
        return None
    return (lat, lon)

def _geocode_city(city: str) -> tuple | None:
    """Try to geocode via your own endpoints (two possible routes)."""
    if not city:
        return None
    for path in ["/api/geocode", "/api/marketplace/geocode"]:
        try:
            url = f"https://usersfunctions.azurewebsites.net{path}?address={city}"
            r = requests.get(url, timeout=5)
            if r.status_code == 200:
                j = r.json()
                lat, lon = j.get("latitude"), j.get("longitude")
                if lat is not None and lon is not None:
                    return (float(lat), float(lon))
        except Exception as e:
            logging.warning(f"geocode call failed ({path} '{city}'): {e}")
    return None

def _open_cosmos():
    conn = os.environ.get(COSMOS_CONN_ENV)
    if not conn:
        raise RuntimeError(f"{COSMOS_CONN_ENV} app setting is missing")
    db_name = os.environ.get(COSMOS_DB_ENV, DEFAULT_DB_NAME)

    client = CosmosClient.from_connection_string(conn)
    db = client.get_database_client(db_name)
    try:
        # Fail fast / surface DB-not-found clearly
        db.read()
    except exceptions.CosmosResourceNotFoundError:
        existing = []
        try:
            existing = [d["id"] for d in client.list_databases()]
        except Exception:
            pass
        raise RuntimeError(
            f"Cosmos database '{db_name}' not found. "
            f"Available: {existing}"
        )

    # Pick products container
    env_cn = os.environ.get(PRODUCTS_CONTAINER_ENV)
    candidates = [env_cn] if env_cn else []
    candidates += [c for c in FALLBACK_PRODUCT_CONTAINERS if c and c != env_cn]

    prod_container = None
    chosen_name = None
    last_err = None
    for name in candidates:
        try:
            cc = db.get_container_client(name)
            cc.read()  # verify
            prod_container = cc
            chosen_name = name
            break
        except Exception as e:
            last_err = e

    if not prod_container:
        raise RuntimeError(
            f"Could not open a products container. Tried: {candidates}. "
            f"Last error: {last_err}"
        )

    # Optional cache container
    cache_name = os.environ.get(CACHE_CONTAINER_ENV, DEFAULT_CACHE_CONTAINER)
    cache_container = None
    try:
        cache_cc = db.get_container_client(cache_name)
        cache_cc.read()
        cache_container = cache_cc
    except Exception:
        cache_container = None

    logging.info(f"Cosmos connected. DB='{db_name}', products='{chosen_name}', cache='{cache_name if cache_container else 'none'}'")
    return prod_container, cache_container

# ---------- Azure Function ----------
def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info("nearby-products invoked")

    if req.method.upper() == "OPTIONS":
        return _cors(func.HttpResponse("", status_code=200))

    # Parse inputs
    lat = req.params.get("lat")
    lon = req.params.get("lon")
    radius = req.params.get("radius", "10")
    category = req.params.get("category")
    sort_by = req.params.get("sortBy", "distance")

    if not lat or not lon:
        return _err("Latitude and longitude are required", 400)

    try:
        lat = float(lat); lon = float(lon); radius = float(radius)
    except ValueError:
        return _err("Invalid coordinate or radius format", 400)

    try:
        products_container, cache_container = _open_cosmos()
    except Exception as e:
        return _err(f"Database error: {e}", 500)

    # Build query (status active; optional category/productType match)
    query = "SELECT * FROM c WHERE (c.status = 'active' OR NOT IS_DEFINED(c.status))"
    params = []
    if category and category.lower() != "all":
        query += " AND (LOWER(c.category) = @cat OR LOWER(c.productType) = @cat)"
        params.append({"name": "@cat", "value": category.lower()})

    try:
        products = list(products_container.query_items(
            query=query,
            parameters=params,
            enable_cross_partition_query=True,
        ))
        logging.info(f"Fetched {len(products)} products (pre-filter).")
    except Exception as e:
        logging.error(f"Query error: {e}")
        return _err(f"Query error: {e}", 500)

    nearby = []
    no_loc = 0
    incomplete = 0

    for p in products:
        # Skip hard-deleted if present
        if p.get("status") == "deleted":
            continue

        coords = _extract_lat_lon(p)
        # Geocode by city if missing coords
        if coords is None and p.get("city"):
            # cache lookup
            if cache_container:
                try:
                    rows = list(cache_container.query_items(
                        query="SELECT TOP 1 * FROM c WHERE c.type='geocache' AND c.address=@a",
                        parameters=[{"name": "@a", "value": p["city"]}],
                        enable_cross_partition_query=True,
                    ))
                    if rows:
                        coords = (float(rows[0]["latitude"]), float(rows[0]["longitude"]))
                except Exception:
                    pass
            if coords is None:
                g = _geocode_city(p["city"])
                if g:
                    coords = g
                    # write to cache
                    if cache_container:
                        try:
                            import uuid
                            cache_container.create_item({
                                "id": str(uuid.uuid4()),
                                "type": "geocache",
                                "address": p["city"],
                                "latitude": coords[0],
                                "longitude": coords[1],
                                "timestamp": datetime.datetime.utcnow().isoformat(),
                            })
                        except Exception:
                            pass

        if coords is None:
            no_loc += 1
            continue

        plat, plon = coords
        try:
            dist = _haversine_km(lat, lon, plat, plon)
        except Exception:
            incomplete += 1
            continue

        if dist <= radius:
            p["distance"] = round(dist, 2)
            # Ensure the location object exists for the client map
            loc = p.get("location") or {}
            if "latitude" not in loc or "longitude" not in loc:
                loc = {**loc, "latitude": plat, "longitude": plon}
            p["location"] = loc
            nearby.append(p)

    logging.info(f"Nearby: {len(nearby)}; no_loc={no_loc}; incomplete={incomplete}; radius={radius}km")

    # Sort
    if sort_by == "distance":
        nearby.sort(key=lambda x: x.get("distance", float("inf")))
    elif sort_by == "distance_desc":
        nearby.sort(key=lambda x: x.get("distance", 0), reverse=True)

    return _ok({
        "products": nearby,
        "count": len(nearby),
        "center": {"latitude": lat, "longitude": lon},
        "radius": radius,
    })
