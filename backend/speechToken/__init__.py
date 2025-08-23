import logging
import os
import traceback


def _plain_error_response(message: str, status_code: int = 500):
    """Return a minimal JSON HttpResponse without importing other helpers (safe in error paths)."""
    import json
    try:
        import azure.functions as func
    except Exception:
        # If azure.functions isn't available, return a plain tuple-like structure to avoid crashing.
        return None

    body = json.dumps({"error": message})
    resp = func.HttpResponse(body=body, status_code=status_code, mimetype="application/json")
    resp.headers.update({
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    })
    return resp


def main(req):
    try:
        # Local imports to avoid module-level import errors taking down the function
        import requests
        from http_helpers import (
            handle_options_request,
            create_error_response,
            create_success_response,
        )

        if req.method == "OPTIONS":
            return handle_options_request()

        # Support a few common environment variable names so deployments are more forgiving
        speech_key = (
            os.environ.get("AZURE_SPEECH_KEY")
            or os.environ.get("SPEECH_SERVICE_KEY")
            or os.environ.get("AZURE_SPEECH_SUBSCRIPTION_KEY")
            or os.environ.get("SPEECH_KEY")
        )

        region = (
            (req.params.get("region") if req else None)
            or os.environ.get("AZURE_SPEECH_REGION")
            or os.environ.get("SPEECH_SERVICE_REGION")
            or ""
        ).strip()

        if not speech_key or not region:
            logging.error("AZURE_SPEECH_KEY or AZURE_SPEECH_REGION is missing")
            # Give the caller actionable guidance (do not leak secrets)
            return create_error_response(
                "Speech service not configured. Please set AZURE_SPEECH_KEY and AZURE_SPEECH_REGION in Function App settings.",
                500,
            )

        issue_url = f"https://{region}.api.cognitive.microsoft.com/sts/v1.0/issueToken"
        try:
            r = requests.post(
                issue_url,
                headers={
                    "Ocp-Apim-Subscription-Key": speech_key,
                    "Content-Length": "0",
                },
                timeout=10,
            )
        except requests.RequestException as e:
            logging.error(f"Token request error: {e}")
            return create_error_response("Failed to contact speech token service", 502)

        # Forward meaningful status to the caller while logging details for debugging
        if not r.ok:
            body_preview = (r.text or "")[:1000]
            logging.error(f"Token request failed: {r.status_code} {body_preview}")
            # Distinguish between authentication/configuration issues and service errors
            if r.status_code in (401, 403):
                return create_error_response("Invalid speech service credentials", 401)
            return create_error_response("Failed to issue speech token", 502)

        token = (r.text or "").strip()
        # SDK tokens are ~10 minutes
        return create_success_response({
            "token": token,
            "region": region,
            "expiresInSeconds": 600,
        })

    except Exception as e:
        # Log full traceback to help diagnostics and ensure it appears in streaming logs
        tb = traceback.format_exc()
        print("Unhandled error in speechToken:", str(e))
        print(tb)
        logging.error(f"Unhandled error in speechToken: {e}\n{tb}")
        # Re-raise so the Functions host records the full exception stack trace
        raise
