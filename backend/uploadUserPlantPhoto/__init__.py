import azure.functions as func
import os
import base64
from azure.storage.blob import BlobServiceClient, ContentSettings
import json
from datetime import datetime

# Set these via environment variables or hardcode for testing
BLOB_CONN_STR = "DefaultEndpointsProtocol=https;AccountName=photos12;AccountKey=CMXo64vRFiKhDZNvzUGi2j/kZLSjS8cLmbJQshOeBcJTT5V4wcb2NZKXd4jMPFsVU7RKSwGnnkSq+AStkPz2Iw==;EndpointSuffix=core.windows.net"
CONTAINER_NAME = "user-plants-photos"

blob_service = BlobServiceClient.from_connection_string(BLOB_CONN_STR)
container_client = blob_service.get_container_client(CONTAINER_NAME)

def main(req: func.HttpRequest) -> func.HttpResponse:
    try:
        data = req.get_json()
        image_b64 = data.get("imageBase64")
        filename = data.get("filename") or f"userplant_{datetime.utcnow().timestamp()}.jpg"
        if not image_b64:
            return func.HttpResponse("No imageBase64 provided", status_code=400)
        img_bytes = base64.b64decode(image_b64)
        blob = container_client.upload_blob(
            name=filename,
            data=img_bytes,
            content_settings=ContentSettings(content_type="image/jpeg"),
            overwrite=True
        )
        # Blob URL: depends if public/read-access is enabled for the container
        blob_url = f"{container_client.url}/{filename}"
        return func.HttpResponse(json.dumps({"url": blob_url}), status_code=200, mimetype="application/json")
    except Exception as e:
        return func.HttpResponse(f"Error: {str(e)}", status_code=500)
