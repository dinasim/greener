import azure.functions as func
import logging
import json
import requests
import os
from azure.cosmos import CosmosClient, exceptions

# Your Notification Hub info
NAMESPACE = os.getenv("NH_NAMESPACE")   
HUB_NAME = os.getenv("HUB_NAME")    
KEY_NAME = "DefaultFullSharedAccessSignature"  
KEY_VALUE = os.environ.get('AZURE_NH_FULL_ACCESS_KEY')  
API_VERSION = "2015-01"

# Cosmos DB info
COSMOS_ENDPOINT = os.environ.get("COSMOS_DB_ENDPOINT")
COSMOS_KEY = os.environ.get("COSMOS_DB_KEY")
DATABASE_NAME = "greener-database"
CONTAINER_NAME = "Users"

def add_cors_headers(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    return response

def generate_sas_token(uri, key_name, key_value, expiry=3600):
    import urllib.parse
    import time
    import hmac
    import hashlib
    import base64

    ttl = int(time.time() + expiry)
    encoded_uri = urllib.parse.quote_plus(uri)
    sign_key = "%s\n%d" % (encoded_uri, ttl)
    signature = base64.b64encode(
        hmac.new(
            key_value.encode("utf-8"),
            sign_key.encode("utf-8"),
            hashlib.sha256
        ).digest()
    )
    return (
        f"SharedAccessSignature sr={encoded_uri}&sig={urllib.parse.quote_plus(signature)}&se={ttl}&skn={key_name}"
    )

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('registerWebPush function processed a request.')

    try:
        try:
            payload = req.get_json()
        except ValueError:
            try:
                payload = json.loads(req.get_body())
            except Exception:
                return add_cors_headers(func.HttpResponse("Invalid JSON body", status_code=400))

        logging.info(f"✅ Payload received: {json.dumps(payload)}")

        installation_id = payload.get("installationId")
        if not installation_id:
            return add_cors_headers(func.HttpResponse("Missing installationId", status_code=400))

        installation = {
            "installationId": installation_id,
            "platform": "browser",
            "pushChannel": payload.get("pushChannel"),
        }

        if "tags" in payload:
            installation["tags"] = payload["tags"]

        uri = f"https://{NAMESPACE}.servicebus.windows.net/{HUB_NAME}/installations/{installation_id}?api-version={API_VERSION}"
        sas_token = generate_sas_token(
            f"https://{NAMESPACE}.servicebus.windows.net/{HUB_NAME}",
            KEY_NAME,
            KEY_VALUE
        )

        headers = {
            "Authorization": sas_token,
            "Content-Type": "application/json",
        }

        response = requests.put(uri, headers=headers, json=installation)

        if response.status_code in (200, 201):
            logging.info("✅ Azure NH registration success")

            try:
                logging.info("🔄 Connecting to Cosmos DB...")
                client = CosmosClient(COSMOS_ENDPOINT, COSMOS_KEY)
                db = client.get_database_client(DATABASE_NAME)
                container = db.get_container_client(CONTAINER_NAME)

                logging.info(f"🔍 Looking up user: {installation_id}")
                user_doc = container.read_item(item=installation_id, partition_key=installation_id)
                logging.info("✅ Found user document.")

                push_channel = payload.get("pushChannel")

                if isinstance(push_channel, dict):  # Web Push format
                    user_doc["webPushSubscription"] = push_channel
                elif isinstance(push_channel, str):  # Mobile format
                    user_doc["expoPushToken"] = push_channel

                user_doc["notificationsEnabled"] = True

                container.replace_item(item=installation_id, body=user_doc)
                logging.info("✅ User document updated in Cosmos DB.")

            except exceptions.CosmosResourceNotFoundError:
                logging.error(f"❌ User with id {installation_id} not found in Cosmos DB.")
                return add_cors_headers(func.HttpResponse("User not found in database", status_code=404))

            except Exception as db_error:
                logging.error(f"🔥 Unexpected error updating Cosmos DB: {str(db_error)}")

            return add_cors_headers(func.HttpResponse("Registered and updated Cosmos DB.", status_code=200))

        else:
            logging.error(f"Azure NH error: {response.status_code} {response.text}")
            return add_cors_headers(func.HttpResponse(f"Azure NH Error: {response.status_code}\n{response.text}", status_code=500))

    except Exception as e:
        logging.error(f"Error in registerWebPush: {str(e)}")
        return add_cors_headers(func.HttpResponse("Error registering", status_code=400))
