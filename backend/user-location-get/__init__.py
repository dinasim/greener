import logging
import json
import os
from datetime import datetime

import azure.functions as func
from azure.cosmos import CosmosClient, exceptions


def add_cors_headers(response: func.HttpResponse) -> func.HttpResponse:
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type,Authorization,X-User-Email,X-Business-ID'
    response.headers['Cache-Control'] = 'no-store'
    return response


# ---------- Cosmos helpers ----------
def get_database_clients():
    """Return (main_client, marketplace_client) like your other functions."""
    main_endpoint = os.environ.get('COSMOS_URI')
    main_key = os.environ.get('COSMOS_KEY')
    main_client = CosmosClient(main_endpoint, credential=main_key) if main_endpoint and main_key else None

    marketplace_client = None
    mkt_cs = os.environ.get('COSMOSDB__MARKETPLACE_CONNECTION_STRING')
    if mkt_cs:
        try:
            parts = dict(p.split('=', 1) for p in mkt_cs.split(';') if '=' in p)
            mkt_endpoint = parts.get('AccountEndpoint')
            mkt_key = parts.get('AccountKey')
            if mkt_endpoint and mkt_key:
                marketplace_client = CosmosClient(mkt_endpoint, credential=mkt_key)
        except Exception as e:
            logging.warning(f"Failed to parse marketplace connection string: {e}")

    # fallback to main creds if marketplace not set
    if not marketplace_client and main_endpoint and main_key:
        marketplace_client = CosmosClient(main_endpoint, credential=main_key)

    return main_client, marketplace_client


def query_one_by_email(container, email: str):
    q = "SELECT * FROM c WHERE c.email = @email"
    params = [{"name": "@email", "value": email}]
    return list(container.query_items(query=q, parameters=params, enable_cross_partition_query=True))[:1]


def float_or_none(v):
    try:
        f = float(v)
        if f == f and f not in (float("inf"), float("-inf")):
            return f
    except Exception:
        pass
    return None


def normalize_location(doc: dict) -> dict:
    """
    Accepts location under 'location' or 'address' (business).
    Returns a consistent object with numeric latitude/longitude when possible.
    """
    loc = (doc or {}).get('location') or (doc or {}).get('address') or {}

    city = loc.get('city') or doc.get('city') or ''
    street = loc.get('street', '')
    house_number = loc.get('houseNumber', '')
    country = loc.get('country', 'Israel')
    postal = loc.get('postalCode', '')
    formatted = loc.get('formattedAddress', '')

    lat = float_or_none(loc.get('latitude'))
    lon = float_or_none(loc.get('longitude'))

    return {
        "city": city,
        "street": street,
        "houseNumber": house_number,
        "country": country,
        "postalCode": postal,
        "formattedAddress": formatted,
        "latitude": lat,
        "longitude": lon,
    }


# ---------- Function entry ----------
main_client, marketplace_client = get_database_clients()


def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info("📍 user-location-get triggered")

    # CORS preflight
    if req.method == "OPTIONS":
        return add_cors_headers(func.HttpResponse("", status_code=200))

    # Accept email / business id via query, header, or POST body
    try:
        body_email = None
        if req.method == "POST":
            try:
                body_json = req.get_json()
                body_email = body_json.get("email")
            except Exception:
                body_email = None

        email_or_id = (
            req.params.get("email")
            or req.headers.get("X-User-Email")
            or req.headers.get("X-Business-ID")
            or body_email
        )
    except Exception:
        email_or_id = req.params.get("email") or req.headers.get("X-User-Email") or req.headers.get("X-Business-ID")

    if not email_or_id:
        res = func.HttpResponse(
            body=json.dumps({"success": False, "error": "email (or X-User-Email / X-Business-ID) is required"}),
            status_code=400,
            mimetype="application/json",
        )
        return add_cors_headers(res)

    main_db_name = os.environ.get('COSMOS_DATABASE_NAME', 'GreenerDB')
    mkt_db_name = os.environ.get('COSMOSDB_MARKETPLACE_DATABASE_NAME', 'GreenerMarketplace')

    try:
        doc = None
        hit_db = None

        # 1) Try MAIN (consumer) database: Users
        if main_client:
            try:
                users_c = main_client.get_database_client(main_db_name).get_container_client('Users')
                rows = query_one_by_email(users_c, email_or_id)
                if rows:
                    doc = rows[0]
                    hit_db = "main"
            except Exception as e:
                logging.warning(f"Main DB lookup failed: {e}")

        # 2) Try MARKETPLACE (business) database: business_users (exactly like your business code)
        if not doc and marketplace_client:
            try:
                mkt_db = marketplace_client.get_database_client(mkt_db_name)
                business_c = mkt_db.get_container_client('business_users')
                # First try fast path: read by id (container PK is '/id' in your code)
                try:
                    doc = business_c.read_item(item=email_or_id, partition_key=email_or_id)
                    hit_db = "marketplace"
                except exceptions.CosmosResourceNotFoundError:
                    # Fallback query by email field
                    rows = query_one_by_email(business_c, email_or_id)
                    if rows:
                        doc = rows[0]
                        hit_db = "marketplace"
            except Exception as e:
                logging.warning(f"Marketplace DB lookup failed: {e}")

        # 3) Not found
        if not doc:
            res = func.HttpResponse(
                body=json.dumps({"success": False, "error": "user not found"}),
                status_code=404,
                mimetype="application/json",
            )
            return add_cors_headers(res)

        # 4) Normalize and return
        location = normalize_location(doc)
        has_coords = location.get("latitude") is not None and location.get("longitude") is not None

        payload = {
            "success": True,
            "email": email_or_id,
            "database": hit_db,
            "type": doc.get("type", "consumer"),
            "location": location,
            "hasCoordinates": has_coords,
            "timestamp": datetime.utcnow().isoformat() + "Z",
        }

        status = 200 if has_coords else 422  # present but no numeric coords → client may geocode/save
        res = func.HttpResponse(body=json.dumps(payload), status_code=status, mimetype="application/json")
        return add_cors_headers(res)

    except exceptions.CosmosHttpResponseError as e:
        logging.error(f"Cosmos error: {e}")
        res = func.HttpResponse(
            body=json.dumps({"success": False, "error": f"Cosmos DB error: {str(e)}"}),
            status_code=500,
            mimetype="application/json",
        )
        return add_cors_headers(res)
    except Exception as e:
        logging.error(f"Unhandled error: {e}")
        res = func.HttpResponse(
            body=json.dumps({"success": False, "error": str(e)}),
            status_code=500,
            mimetype="application/json",
        )
        return add_cors_headers(res)
