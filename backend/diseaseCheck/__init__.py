import os
import json
import logging
import azure.functions as func
import google.generativeai as genai

GOOGLE_KEY = "AIzaSyAFR55U0tZw7SFb2Z578W2pi6qUqmq74nw"

def _cors_headers():
    return {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type"
    }

# Configure Gemini SDK with your key
genai.configure(api_key=GOOGLE_KEY)
# Pick the best available model. (Try 'gemini-1.5-flash' first)
MODEL_NAME = "gemini-1.5-flash"
model = genai.GenerativeModel(MODEL_NAME)

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info("diseaseCheck triggered")

    if req.method == "OPTIONS":
        return func.HttpResponse(status_code=204, headers=_cors_headers())

    # Parse request
    try:
        body = req.get_json()
        base64_image = body["imageBase64"]
        plant_name = body.get("plantName", "unknown plant")
        language = body.get("language", "English")
    except Exception as e:
        logging.error("Failed to parse request JSON", exc_info=e)
        return func.HttpResponse(
            "Request must include JSON with 'imageBase64' (string), and optional 'plantName', 'language'.",
            status_code=400,
            headers=_cors_headers()
        )

    # Build prompt
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
        "mime_type": "image/jpeg",  # You could also detect PNG if needed
        "data": base64_image
    }

    try:
        # Generate Gemini response
        gemini_response = model.generate_content([prompt, image_part])
        response_text = gemini_response.text

        # Try to extract JSON block
        json_start = response_text.find('{')
        json_end = response_text.rfind('}') + 1
        if json_start >= 0 and json_end > json_start:
            json_str = response_text[json_start:json_end]
            result_json = json.loads(json_str)
        else:
            return func.HttpResponse(
                json.dumps({
                    "error": "Could not find JSON in Gemini response.",
                    "raw_response": response_text
                }),
                status_code=502,
                headers={**_cors_headers(), "Content-Type": "application/json"}
            )

        return func.HttpResponse(
            json.dumps(result_json),
            status_code=200,
            headers={**_cors_headers(), "Content-Type": "application/json"}
        )

    except Exception as e:
        logging.error("Gemini SDK call failed", exc_info=e)
        return func.HttpResponse(
            json.dumps({"error": str(e)}),
            status_code=502,
            headers={**_cors_headers(), "Content-Type": "application/json"}
        )
