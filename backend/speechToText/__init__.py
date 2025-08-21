import logging
import azure.functions as func
import os
import tempfile
import urllib.request
import traceback
import requests
from http_helpers import handle_options_request, create_error_response, create_success_response

def _extract_text_from_azure(payload: dict) -> str:
    """
    Supports both detailed and simple responses:
      - simple:   { "RecognitionStatus":"Success", "DisplayText":"..." }
      - detailed: { "RecognitionStatus":"Success", "NBest":[{"Display":"...", "Lexical":"..."}] }
      - some services nest under "AudioFileResults": [{"NBest":[...]}]
    """
    if not isinstance(payload, dict):
        return ""

    # simple format
    dt = payload.get("DisplayText")
    if isinstance(dt, str) and dt.strip():
        return dt.strip()

    # detailed, top-level NBest
    nbest = payload.get("NBest")
    if isinstance(nbest, list) and nbest:
        first = nbest[0] or {}
        for k in ("Display", "Lexical", "ITN", "MaskedITN"):
            v = first.get(k)
            if isinstance(v, str) and v.strip():
                return v.strip()

    # detailed, nested under AudioFileResults
    afr = payload.get("AudioFileResults")
    if isinstance(afr, list) and afr:
        inner = afr[0] or {}
        nbest2 = inner.get("NBest")
        if isinstance(nbest2, list) and nbest2:
            first = nbest2[0] or {}
            for k in ("Display", "Lexical", "ITN", "MaskedITN"):
                v = first.get(k)
                if isinstance(v, str) and v.strip():
                    return v.strip()

    return ""

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('speechToText function triggered.')

    # CORS preflight
    if req.method == 'OPTIONS':
        return handle_options_request()

    # Read inputs
    try:
        body = req.get_json()
        audio_url = body.get('audioUrl')
        language = body.get('language', 'en-US')
    except Exception:
        audio_url = req.params.get('audioUrl')
        language = req.params.get('language', 'en-US')

    if not audio_url:
        return create_error_response("Missing 'audioUrl' parameter", 400)

    speech_key = os.environ.get("AZURE_SPEECH_KEY")
    speech_region = os.environ.get("AZURE_SPEECH_REGION")
    if not speech_key or not speech_region:
        logging.error("AZURE_SPEECH_KEY or AZURE_SPEECH_REGION not set.")
        return create_error_response("Speech service not configured.", 500)

    try:
        logging.info(f"Downloading audio: {audio_url}")
        # guess type by URL; we still set proper header below
        is_webm = 'webm' in audio_url.lower()

        # download to temp file
        with tempfile.NamedTemporaryFile(delete=False) as tmp:
            req_bin = urllib.request.Request(
                audio_url,
                headers={'User-Agent': 'Mozilla/5.0', 'Accept': '*/*'}
            )
            with urllib.request.urlopen(req_bin) as resp:
                data = resp.read()
                tmp.write(data)
            tmp_path = tmp.name

        size = os.path.getsize(tmp_path)
        logging.info(f"Downloaded {size} bytes")
        if size == 0:
            return create_error_response("Downloaded audio file is empty", 400)

        # call Azure STT REST (conversation endpoint)
        endpoint = f"https://{speech_region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1"
        params = {
            "language": language,
            "format": "detailed",
            "profanity": "raw",
        }
        headers = {
            "Ocp-Apim-Subscription-Key": speech_key,
            "Content-Type": "audio/webm" if is_webm else "audio/wav",
            "Accept": "application/json",
        }

        with open(tmp_path, "rb") as f:
            file_bytes = f.read()

        logging.info(f"Sending {len(file_bytes)} bytes to Azure STT (lang={language})")
        resp = requests.post(endpoint, params=params, headers=headers, data=file_bytes)

        try:
            os.unlink(tmp_path)
        except Exception as e:
            logging.warning(f"Temp delete error: {e}")

        logging.info(f"Azure STT status: {resp.status_code}")
        # Log a small chunk only
        logging.info(f"Azure STT body (truncated): {resp.text[:800]}")

        if resp.status_code != 200:
            return create_success_response({
                "text": "",
                "confidence": 0.0,
                "note": f"Azure error {resp.status_code}"
            })

        payload = resp.json() if resp.text else {}
        text = _extract_text_from_azure(payload)
        status = payload.get("RecognitionStatus", "")

        if text:
            logging.info(f"Recognized: {text}")
            return create_success_response({
                "text": text,
                "confidence": 1.0 if status == "Success" else 0.7
            })
        else:
            logging.warning(f"No speech recognized (status={status})")
            # No random fallback here—client should decide what to do.
            return create_success_response({
                "text": "",
                "confidence": 0.0,
                "note": "No speech recognized"
            })

    except Exception as e:
        logging.error(f"STT exception: {e}")
        logging.error(traceback.format_exc())
        return create_error_response(f"Internal server error: {e}", 500)
