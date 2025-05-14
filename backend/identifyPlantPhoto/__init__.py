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

        # Extract metadata
        content_disp = image_part.headers[b'Content-Disposition'].decode()
        filename = content_disp.split('filename="')[-1].split('"')[0]
        content_type_header = image_part.headers.get(b'Content-Type', b'image/jpeg').decode()

        logging.info(f"Received image content-type: {content_type_header}, size: {len(image_part.content)} bytes")

        # Send directly to PlantNet with include-related-images
        plantnet_url = (
            f"https://my-api.plantnet.org/v2/identify/all?"
            f"api-key={PLANTNET_API_KEY}&include-related-images=true&no-reject=true"
        )

        plantnet_response = requests.post(
            plantnet_url,
            files={"images": (filename, image_part.content, content_type_header)},
            data={"organs": "leaf"}
        )

        # Log full JSON response for debugging
        logging.info(f"PlantNet full response: {plantnet_response.text}")

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
