import logging
import requests
import azure.functions as func
from requests_toolbelt.multipart import decoder

def add_cors_headers(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS, PUT, PATCH, DELETE'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type,Authorization,X-User-Email'
    return response

PLANTNET_API_KEY = "2b10lLFTZi5uAsfZjCILnsIwie"
IMGUR_CLIENT_ID = "0bee6dfee7e166a"

def main(req: func.HttpRequest) -> func.HttpResponse:
    try:
        content_type = req.headers.get('content-type') or req.headers.get('Content-Type')
        body = req.get_body()

        if not content_type or 'multipart/form-data' not in content_type:
            return func.HttpResponse(
                "Expected multipart/form-data",
                status_code=400,
                headers={"Access-Control-Allow-Origin": "*"}
            )

        multipart_data = decoder.MultipartDecoder(body, content_type)
        image_part = None

        for part in multipart_data.parts:
            content_disp = part.headers.get(b'Content-Disposition', b'').decode()
            if 'name="images"' in content_disp:
                image_part = part
                break

        if not image_part:
            return func.HttpResponse(
                "Missing image part",
                status_code=400,
                headers={"Access-Control-Allow-Origin": "*"}
            )

        # Extract filename and content type from headers
        content_disp = image_part.headers[b'Content-Disposition'].decode()
        filename = content_disp.split('filename="')[-1].split('"')[0]
        content_type_header = image_part.headers.get(b'Content-Type', b'image/jpeg').decode()

        # Upload to Imgur
        imgur_response = requests.post(
            "https://api.imgur.com/3/image",
            headers={"Authorization": f"Client-ID {IMGUR_CLIENT_ID}"},
            files={"image": (filename, image_part.content, content_type_header)},
        )

        if imgur_response.status_code != 200:
            logging.error(f"Imgur upload failed: {imgur_response.text}")
            return func.HttpResponse(
                "Failed to upload image to Imgur",
                status_code=500,
                headers={"Access-Control-Allow-Origin": "*"}
            )

        image_url = imgur_response.json()["data"]["link"]
        logging.info(f"Uploaded to Imgur: {image_url}")

        # Call PlantNet
        plantnet_url = (
            f"https://my-api.plantnet.org/v2/identify/all?"
            f"api-key={PLANTNET_API_KEY}&images={image_url}&organs=leaf"
        )

        plantnet_response = requests.get(plantnet_url)

        if plantnet_response.status_code != 200:
            logging.error(f"PlantNet error: {plantnet_response.text}")
            return func.HttpResponse(
                f"Error from PlantNet: {plantnet_response.text}",
                status_code=plantnet_response.status_code,
                headers={"Access-Control-Allow-Origin": "*"}
            )

        return func.HttpResponse(
            plantnet_response.text,
            status_code=200,
            mimetype="application/json",
            headers={"Access-Control-Allow-Origin": "*"}
        )

    except Exception as e:
        logging.exception("Unexpected error during plant identification")
        return func.HttpResponse(
            f"Internal server error: {str(e)}",
            status_code=500,
            headers={"Access-Control-Allow-Origin": "*"}
        )
