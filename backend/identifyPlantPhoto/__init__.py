import os
import json
import logging
import base64
import requests
import azure.functions as func
import google.generativeai as genai

# Set your keys here (or better: use Azure app settings)
GOOGLE_KEY = "AIzaSyDaj4uxYtaVndDVu6YTIeZpbL8yZiF8mgk"
PLANTNET_API_KEY = "2b10lLFTZi5uAsfZjCILnsIwie"
GEMINI_MODEL = "gemini-1.5-flash"  # Use your best available Gemini model

def _cors_headers():
    return {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type"
    }

genai.configure(api_key=GOOGLE_KEY)
model = genai.GenerativeModel(GEMINI_MODEL)

def identify_plant_base64(base64_image, plantnet_api_key):
    url = f"https://my-api.plantnet.org/v2/identify/all?api-key={plantnet_api_key}&include-related-images=true&no-reject=true"
    image_bytes = base64.b64decode(base64_image)
    files = {"images": ("plant.jpg", image_bytes, "image/jpeg")}
    data = {"organs": "leaf"}
    resp = requests.post(url, files=files, data=data)
    if resp.status_code != 200:
        logging.error(f"PlantNet error: {resp.text}")
        return None, resp.text
    try:
        results = resp.json().get("results", [])
        if not results:
            return None, resp.text
        # Return best name (scientific or common)
        best = results[0].get("species", {})
        plant_name = (
            best.get("scientificNameWithoutAuthor")
            or best.get("scientificName")
            or (best.get("commonNames", ["Unknown"])[0])
            or "Unknown"
        )
        return plant_name, None
    except Exception as e:
        logging.error(f"PlantNet parsing error: {str(e)}")
        return None, str(e)

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info("diseaseCheck+identify triggered")

    if req.method == "OPTIONS":
        return func.HttpResponse(status_code=204, headers=_cors_headers())

    try:
        body = req.get_json()
        base64_image = body["imageBase64"]
        language = body.get("language", "English")
    except Exception as e:
        logging.error("Failed to parse request JSON", exc_info=e)
        return func.HttpResponse(
            "Request must include JSON with 'imageBase64' (string) and optional 'language'.",
            status_code=400,
            headers=_cors_headers()
        )

    # Step 1: Identify plant
    plant_name, plantnet_error = identify_plant_base64(base64_image, PLANTNET_API_KEY)
    if not plant_name:
        return func.HttpResponse(
            json.dumps({"error": f"PlantNet identification failed: {plantnet_error}"}),
            status_code=502,
            headers={**_cors_headers(), "Content-Type": "application/json"}
        )
    logging.info(f"PlantNet identified plant: {plant_name}")

    # Step 2: Diagnose with Gemini
    prompt = (
        f"Analyze this image of a {plant_name} plant and prioritize determining if it's healthy or has a disease or pest infestation. "
        "If a disease or pest is detected, provide the following information in JSON format: "
        '{'
        '"results": ['
        '{"type": "disease/pest", "name": "Name", "probability": "Percent", "symptoms": "Describe", "causes": "Main causes", "severity": "Low/Medium/High", "spreading": "How it spreads", "treatment": "Treatment options", "prevention": "Preventive measures"}'
        '], '
        '"is_healthy": boolean, "confidence": "Overall confidence in percent"'
        '}. '
        "Only return the JSON. If the plant is healthy, set is_healthy to true and leave results empty. "
        f"Reply in {language}."
    )

    image_part = {
        "mime_type": "image/jpeg",
        "data": base64_image
    }

    try:
        gemini_response = model.generate_content([prompt, image_part])
        response_text = gemini_response.text

        json_start = response_text.find('{')
        json_end = response_text.rfind('}') + 1
        if json_start >= 0 and json_end > json_start:
            json_str = response_text[json_start:json_end]
            result_json = json.loads(json_str)
        else:
            return func.HttpResponse(
                json.dumps({
                    "error": "Could not find JSON in Gemini response.",
                    "plant_name": plant_name,
                    "raw_response": response_text
                }),
                status_code=502,
                headers={**_cors_headers(), "Content-Type": "application/json"}
            )

        # Add the plant name as context in the response
        result_json["plant_name"] = plant_name

        return func.HttpResponse(
            json.dumps(result_json),
            status_code=200,
            headers={**_cors_headers(), "Content-Type": "application/json"}
        )

    except Exception as e:
        logging.error("Gemini SDK call failed", exc_info=e)
        return func.HttpResponse(
            json.dumps({"error": str(e), "plant_name": plant_name}),
            status_code=502,
            headers={**_cors_headers(), "Content-Type": "application/json"}
        )
