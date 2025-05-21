import azure.functions as func
import logging
import json
import requests
import os

# Your Notification Hub info
NAMESPACE = "<greener-webpush>"   
HUB_NAME = "<greener-hub>"     # Example: 'my-hub'
KEY_NAME = "<DefaultFullSharedAccessSignature>"  # Usually 'DefaultFullSharedAccessSignature'
KEY_VALUE = os.environ.get('AZURE_NH_FULL_ACCESS_KEY')  # Found in Access Policies

API_VERSION = "2015-01"

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
    token = (
        "SharedAccessSignature sr={}&sig={}&se={}&skn={}"
        .format(encoded_uri, urllib.parse.quote_plus(signature), ttl, key_name)
    )
    return token

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('registerWebPush function processed a request.')

    try:
        # 1. Get the JSON payload from the frontend
        payload = req.get_json()
        logging.info(f"Received payload: {json.dumps(payload)}")

        installation_id = payload.get("installationId")
        if not installation_id:
            return func.HttpResponse("Missing installationId", status_code=400)

        # 2. Prepare the installation object for Azure NH
        installation = {
            "installationId": installation_id,
            "platform": "browser",
            "pushChannel": payload.get("pushChannel"),
        }
        # Optionally add tags:
        if "tags" in payload:
            installation["tags"] = payload["tags"]

        # 3. Prepare Azure NH URL
        uri = f"https://{NAMESPACE}.servicebus.windows.net/{HUB_NAME}/installations/{installation_id}?api-version={API_VERSION}"

        # 4. Generate SAS token
        sas_token = generate_sas_token(
            f"https://{NAMESPACE}.servicebus.windows.net/{HUB_NAME}",
            KEY_NAME,
            KEY_VALUE
        )

        # 5. Make PUT request to Azure Notification Hub
        headers = {
            "Authorization": sas_token,
            "Content-Type": "application/json",
        }
        response = requests.put(uri, headers=headers, json=installation)

        if response.status_code in (200, 201):
            logging.info(f"Azure NH registration success: {response.status_code}")
            return func.HttpResponse("Registered with Azure Notification Hub!", status_code=200)
        else:
            logging.error(f"Azure NH error: {response.status_code} {response.text}")
            return func.HttpResponse(f"Azure NH Error: {response.status_code}\n{response.text}", status_code=500)

    except Exception as e:
        logging.error(f"Error in registerWebPush: {str(e)}")
        return func.HttpResponse("Error registering", status_code=400)
