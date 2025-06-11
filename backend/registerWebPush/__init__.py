import azure.functions as func
import logging
import json
import requests
import os
from azure.cosmos import CosmosClient, exceptions

# 🔧 Notification Hub config
NAMESPACE = os.getenv("NH_NAMESPACE")
HUB_NAME = os.getenv("HUB_NAME")
KEY_NAME = "DefaultFullSharedAccessSignature"
KEY_VALUE = os.getenv("AZURE_NH_FULL_ACCESS_KEY")
API_VERSION = "2015-01"

# 🔧 Cosmos DB config
COSMOS_ENDPOINT = os.getenv("COSMOS_DB_ENDPOINT")
COSMOS_KEY = os.getenv("COSMOS_DB_KEY")
DATABASE_NAME = "greener-database"
CONTAINER_NAME = "Users"

def add_cors_headers(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    return response

def generate_sas_token(uri, key_name, key_value, expiry=3600):
    import urllib.parse, time, hmac, hashlib, base64

    ttl = int(time.time()) + expiry
    encoded_uri = urllib.parse.quote_plus(uri)
    to_sign = f"{encoded_uri}\n{ttl}"
    signature = base64.b64encode(
        hmac.new(key_value.encode(), to_sign.encode(), hashlib.sha256).digest()
    ).decode()

    return (
        f"SharedAccessSignature sr={encoded_uri}&sig={urllib.parse.quote_plus(signature)}"
        f"&se={ttl}&skn={key_name}"
    )

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info("✅ registerWebPush function started.")

    try:
        try:
            payload = req.get_json()
        except Exception:
            try:
                payload = json.loads(req.get_body())
            except Exception:
                return add_cors_headers(func.HttpResponse("Invalid JSON body", status_code=400))

        logging.info(f"📥 Payload received: {json.dumps(payload)}")

        installation_id = payload.get("installationId")
        if not installation_id:
            return add_cors_headers(func.HttpResponse("Missing installationId", status_code=400))

        # Prepare installation
        installation = {
            "installationId": installation_id,
            "platform": "browser",
            "pushChannel": payload.get("pushChannel"),
        }
        if "tags" in payload:
            installation["tags"] = payload["tags"]

        # Prepare Notification Hub request
        sb_uri = f"sb://{NAMESPACE}.servicebus.windows.net/{HUB_NAME}"
        uri = f"https://{NAMESPACE}.servicebus.windows.net/{HUB_NAME}/installations/{installation_id}?api-version={API_VERSION}"
        sas_token = generate_sas_token(sb_uri, KEY_NAME, KEY_VALUE)

        headers = {
            "Authorization": sas_token,
            "Content-Type": "application/json",
        }

        response = requests.put(uri, headers=headers, json=installation)
        if response.status_code not in (200, 201):
            logging.error(f"❌ Azure NH error: {response.status_code} {response.text}")
            return add_cors_headers(func.HttpResponse("Notification Hub registration failed.", status_code=500))

        logging.info("✅ Azure NH registration successful.")

        # Update Cosmos DB
        try:
            client = CosmosClient(COSMOS_ENDPOINT, COSMOS_KEY)
            container = client.get_database_client(DATABASE_NAME).get_container_client(CONTAINER_NAME)

            user_doc = container.read_item(item=installation_id, partition_key=installation_id)
            push_channel = payload.get("pushChannel")

            if isinstance(push_channel, dict):
                user_doc["webPushSubscription"] = push_channel
            elif isinstance(push_channel, str):
                user_doc["expoPushToken"] = push_channel

            user_doc["notificationsEnabled"] = True
            container.replace_item(item=installation_id, body=user_doc)
            logging.info("✅ User document updated in Cosmos DB.")

        except exceptions.CosmosResourceNotFoundError:
            logging.error(f"❌ User with id {installation_id} not found in Cosmos DB.")
            return add_cors_headers(func.HttpResponse("User not found", status_code=404))

        except Exception as db_error:
            logging.error(f"🔥 Error updating Cosmos DB: {str(db_error)}")

        return add_cors_headers(func.HttpResponse("✅ Registered and updated.", status_code=200))

    except Exception as e:
        logging.error(f"🔥 Unexpected error: {str(e)}")
        return add_cors_headers(func.HttpResponse("Internal server error", status_code=500))
