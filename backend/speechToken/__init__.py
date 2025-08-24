import os, json, requests
from datetime import datetime, timedelta, timezone
import azure.functions as func

def main(req: func.HttpRequest) -> func.HttpResponse:
    if req.method == "OPTIONS":
        # basic CORS (adjust to your helpers if you have them)
        return func.HttpResponse("", headers=_cors(), status_code=204)

    region = os.getenv("AZURE_SPEECH_REGION")
    key = os.getenv("AZURE_SPEECH_KEY")
    if not region or not key:
        return func.HttpResponse("SPEECH_REGION or SPEECH_KEY missing", status_code=500, headers=_cors())

    url = f"https://{region}.api.cognitive.microsoft.com/sts/v1.0/issueToken"
    r = requests.post(url, headers={"Ocp-Apim-Subscription-Key": key})
    if r.status_code != 200:
        return func.HttpResponse(f"issueToken failed: {r.status_code} {r.text}", status_code=500, headers=_cors())

    payload = {
        "token": r.text,
        "region": region,
        "expiresAt": (datetime.now(timezone.utc) + timedelta(minutes=9)).isoformat()
    }
    return func.HttpResponse(json.dumps(payload), mimetype="application/json", headers=_cors())

def _cors():
    return {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    }
