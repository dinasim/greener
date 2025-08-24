# /api/saveDeviceToken/__init__.py
import os, json, logging, datetime
import azure.functions as func
from azure.cosmos import CosmosClient, PartitionKey, exceptions

# ---------- CORS ----------
def add_cors_headers(resp: func.HttpResponse) -> func.HttpResponse:
    resp.headers['Access-Control-Allow-Origin']  = '*'
    resp.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS, PUT, PATCH, DELETE'
    resp.headers['Access-Control-Allow-Headers'] = 'Content-Type,Authorization,X-User-Email'
    return resp

# ---------- Cosmos clients (same pattern as saveUser) ----------
def get_database_clients():
    """
    Returns (main_client, marketplace_client) using the SAME envs your saveUser uses.
    """
    main_endpoint = os.getenv('COSMOS_URI') or os.getenv('COSMOS_URL') or os.getenv('COSMOS_ENDPOINT') or os.getenv('COSMOSDB_URI')
    main_key      = os.getenv('COSMOS_KEY') or os.getenv('COSMOSDB_KEY')
    main_client   = CosmosClient(main_endpoint, credential=main_key) if main_endpoint and main_key else None

    marketplace_client = None
    conn = os.getenv('COSMOSDB__MARKETPLACE_CONNECTION_STRING')
    if conn:
        try:
            parts = dict(p.split('=', 1) for p in conn.split(';') if '=' in p)
            ep, key = parts.get('AccountEndpoint'), parts.get('AccountKey')
            if ep and key:
                marketplace_client = CosmosClient(ep, credential=key)
        except Exception as e:
            logging.warning(f"Failed to parse marketplace conn string: {e}")

    if not marketplace_client and main_client:
        marketplace_client = main_client

    if not main_client and not marketplace_client:
        raise RuntimeError("Cosmos env vars missing: set COSMOS_URI/COSMOS_KEY or COSMOSDB__MARKETPLACE_CONNECTION_STRING")

    return main_client, marketplace_client

MAIN_CLIENT, MARKET_CLIENT = get_database_clients()

def get_tokens_container(user_type: str):
    """
    Choose DB by user type (same as saveUser): 
    - business -> GreenerMarketplace
    - consumer -> GreenerDB
    Creates container if missing.
    """
    if user_type == 'business':
        db_name = os.getenv('COSMOSDB_MARKETPLACE_DATABASE_NAME', 'GreenerMarketplace')
        client  = MARKET_CLIENT
    else:
        db_name = os.getenv('COSMOS_DATABASE_NAME', 'GreenerDB')
        client  = MAIN_CLIENT

    db = client.get_database_client(db_name)
    return db.create_container_if_not_exists(
        id=os.getenv('COSMOS_CONTAINER_TOKENS', 'push_tokens'),
        partition_key=PartitionKey(path='/userId')
        # If you use provisioned throughput, add offer_throughput=400
    )

# ---------- Handler ----------
def main(req: func.HttpRequest) -> func.HttpResponse:
    if req.method == "OPTIONS":
        return add_cors_headers(func.HttpResponse("", status_code=200))

    try:
        body = req.get_json()
    except Exception:
        return add_cors_headers(func.HttpResponse(json.dumps({"ok": False, "error": "Invalid JSON"}), status_code=400, mimetype="application/json"))

    # Accept either userId or email; optional user type
    user_id  = (body.get("userId") or body.get("email") or "").strip()
    token    = (body.get("token") or "").strip()
    platform = (body.get("platform") or "android").strip().lower()
    app      = (body.get("app") or "greener").strip()
    user_type= (body.get("type") or "consumer").strip().lower()   # align with saveUser default

    if not user_id or not token:
        return add_cors_headers(func.HttpResponse(json.dumps({"ok": False, "error": "Missing userId/email or token"}), status_code=400, mimetype="application/json"))

    try:
        container = get_tokens_container(user_type)
        # One doc per user
        try:
            doc = container.read_item(item=user_id, partition_key=user_id)
        except exceptions.CosmosResourceNotFoundError:
            doc = {"id": user_id, "userId": user_id, "tokens": []}

        now_iso = datetime.datetime.utcnow().isoformat() + "Z"

        # de-dup token
        tokens = [t for t in doc.get("tokens", []) if t.get("token") != token]
        tokens.append({"token": token, "platform": platform, "app": app, "lastSeen": now_iso})
        doc["tokens"]   = tokens
        doc["updatedAt"]= now_iso

        container.upsert_item(doc)

        return add_cors_headers(func.HttpResponse(
            json.dumps({"ok": True, "count": len(tokens), "userType": user_type}),
            status_code=200, mimetype="application/json"
        ))
    except Exception as e:
        logging.exception("saveDeviceToken failed")
        return add_cors_headers(func.HttpResponse(
            json.dumps({"ok": False, "error": str(e)}), status_code=500, mimetype="application/json"
        ))
