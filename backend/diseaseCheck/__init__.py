import os
import json
import logging
import azure.functions as func
import requests

GOOGLE_KEY = os.getenv("AIzaSyDaj4uxYtaVndDVu6YTIeZpbL8yZiF8mgk")  # set this in Configuration

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info("diseaseCheck triggered")

    # CORS preflight
    if req.method == "OPTIONS":
        return func.HttpResponse(
            status_code=204,
            headers={
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "POST,OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type"
            }
        )

    try:
        payload = req.get_json()
    except ValueError:
        return func.HttpResponse("Invalid JSON", status_code=400)

    # forward to Gemini
    gemini_url = (
      "https://generativelanguage.googleapis.com/"
      f"v1/models/gemini-1.5-image-alpha-1.0:generateMessage?key={GOOGLE_KEY}"
    )
    resp = requests.post(
        gemini_url,
        headers={"Content-Type": "application/json"},
        json=payload,
        timeout=10
    )

    # bubble up errors
    if resp.status_code != 200:
        return func.HttpResponse(
            resp.text,
            status_code=resp.status_code,
            headers={ "Access-Control-Allow-Origin": "*" }
        )

    return func.HttpResponse(
        resp.text,
        status_code=200,
        headers={ "Content-Type": "application/json",
                  "Access-Control-Allow-Origin": "*" }
    )
