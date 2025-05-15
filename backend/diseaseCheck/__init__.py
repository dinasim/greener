import os
import json
import logging
import azure.functions as func
import requests

GOOGLE_KEY = "AIzaSyDaj4uxYtaVndDVu6YTIeZpbL8yZiF8mgk"

def _cors_headers():
    return {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type"
    }

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info("diseaseCheck triggered")

    if req.method == "OPTIONS":
        return func.HttpResponse(status_code=204, headers=_cors_headers())

    try:
        body = req.get_json()
    except ValueError:
        return func.HttpResponse("Invalid JSON", status_code=400, headers=_cors_headers())

    # build your single text part from whatever field you're sending
    user_text = body.get("question") or body.get("content") or ""
    
    # v1beta payload shape for generateContent
    gemini_payload = {
        "contents": [
            {
                "parts": [
                    {"text": user_text}
                ]
            }
        ],
        # optional: enforce schema if you still want diagnosis/treatment shape
        "responseSchema": {
            "title": "PlantDiseaseDiagnosis",
            "type": "object",
            "properties": {
                "diagnosis": {"type": "string"},
                "treatmentOptions": {
                    "type": "array",
                    "items": {"type": "string"}
                }
            },
            "required": ["diagnosis", "treatmentOptions"]
        }
    }

    # point at v1beta generateContent
    MODEL = "gemini-2.0-flash"
    gemini_url = (
        "https://generativelanguage.googleapis.com/"
        f"v1beta/models/{MODEL}:generateContent?key={GOOGLE_KEY}"
    )

    try:
        resp = requests.post(
            gemini_url,
            headers={"Content-Type": "application/json"},
            json=gemini_payload,
            timeout=10
        )
    except requests.RequestException as e:
        logging.error(f"Upstream request failed: {e}")
        return func.HttpResponse("Upstream request failed", status_code=502, headers=_cors_headers())

    if resp.status_code != 200:
        logging.error(f"Gemini returned {resp.status_code}: {resp.text}")
        return func.HttpResponse(resp.text, status_code=resp.status_code, headers=_cors_headers())

    # return the raw JSON from Gemini
    return func.HttpResponse(
        resp.text,
        status_code=200,
        headers={**_cors_headers(), "Content-Type": "application/json"}
    )
