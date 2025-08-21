# backend/speechToText/__init__.py
import logging
import azure.functions as func
import os
import tempfile
import urllib.request
import urllib.parse
import traceback
import requests
from http_helpers import (
    add_cors_headers,
    handle_options_request,
    create_error_response,
    create_success_response,
)

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('speechToText function triggered.')

    # CORS preflight
    if req.method == 'OPTIONS':
        return handle_options_request()

    # ---- Parse input ----
    try:
        body = req.get_json()
        audio_url = body.get('audioUrl')
        language = body.get('language', 'en-US')
    except Exception as e:
        logging.warning(f"Failed to parse JSON body: {e}")
        audio_url = req.params.get('audioUrl')
        language = req.params.get('language', 'en-US')

    if not audio_url:
        return create_error_response("Missing 'audioUrl' parameter", 400)

    # ---- Config ----
    speech_key = os.environ.get("AZURE_SPEECH_KEY")
    speech_region = os.environ.get("AZURE_SPEECH_REGION")
    if not speech_key or not speech_region:
        logging.error("Azure Speech key or region not configured")
        return create_error_response("Speech service not properly configured.", 500)

    tmp_file_path = None

    try:
        logging.info(f"Processing audio from {audio_url}")

        # ---- Download the audio to a temp file ----
        try:
            with tempfile.NamedTemporaryFile(delete=False) as tmp_file:
                req_obj = urllib.request.Request(
                    audio_url,
                    headers={'User-Agent': 'Mozilla/5.0', 'Accept': '*/*'}
                )
                with urllib.request.urlopen(req_obj) as resp:
                    data = resp.read()
                    tmp_file.write(data)
                tmp_file_path = tmp_file.name

            size = os.path.getsize(tmp_file_path)
            logging.info(f"Downloaded audio file size: {size} bytes")
            if size == 0:
                return create_error_response("Downloaded audio file is empty", 400)

        except Exception as dl_err:
            logging.error(f"Failed to download audio file: {dl_err}")
            logging.error(traceback.format_exc())
            return create_error_response(f"Failed to download audio file: {dl_err}", 500)

        # ---- Determine content type by URL extension (fallbacks included) ----
        path = urllib.parse.urlparse(audio_url).path.lower()
        _, ext = os.path.splitext(path)

        if ext.endswith('.webm'):
            content_type = "audio/webm; codecs=opus"
        elif ext.endswith('.ogg') or ext.endswith('.oga'):
            content_type = "audio/ogg; codecs=opus"
        elif ext.endswith('.mp3'):
            content_type = "audio/mpeg"
        elif ext.endswith('.m4a') or ext.endswith('.mp4'):
            # Expo/React Native AAC typically arrives as .m4a (MP4 container)
            content_type = "audio/mp4"
        elif ext.endswith('.wav'):
            content_type = "audio/wav"
        else:
            # Last resort: assume wav; client should send explicit contentType to avoid this
            content_type = "audio/wav"

        logging.info(f"Using Content-Type for STT: {content_type}")

        # ---- Azure Speech REST API call ----
        endpoint = (
            f"https://{speech_region}.stt.speech.microsoft.com/"
            "speech/recognition/conversation/cognitiveservices/v1"
        )

        # Use SIMPLE to expose DisplayText at top-level.
        # (We still parse detailed NBest below if someone changes format.)
        params = {
            "language": language,
            "format": "simple",
            "profanity": "raw",
        }

        headers = {
            "Ocp-Apim-Subscription-Key": speech_key,
            "Content-Type": content_type,
            "Accept": "application/json"
        }

        with open(tmp_file_path, "rb") as f:
            payload = f.read()

        logging.info("Sending audio to Azure Speech API…")
        resp = requests.post(endpoint, params=params, headers=headers, data=payload)
        logging.info(f"Speech API Response Status: {resp.status_code}")
        # Log only the first 1k to avoid huge logs
        try:
            logging.info(f"Speech API Response (truncated): {resp.text[:1000]}")
        except Exception:
            pass

        # ---- Handle response ----
        if resp.status_code == 200:
            # Response can be SIMPLE or DETAILED. We parse both.
            try:
                result = resp.json()
            except Exception:
                result = {}

            text = None
            # SIMPLE path
            if result.get("RecognitionStatus") == "Success":
                text = (result.get("DisplayText") or "").strip()

            # DETAILED path (if format ever changes)
            if not text and "NBest" in result and isinstance(result["NBest"], list) and result["NBest"]:
                best = result["NBest"][0]
                text = (best.get("Display") or best.get("Lexical") or "").strip()

            if text:
                logging.info(f"Recognition successful: '{text}'")
                return create_success_response({"text": text, "confidence": 1.0})

            # No speech recognized -> graceful fallback
            logging.warning(f"No text recognized. RecognitionStatus: {result.get('RecognitionStatus', 'Unknown')}")
            return create_success_response({
                "text": get_plant_search_fallback(),
                "confidence": 0.5,
                "note": "Using fallback due to no speech recognized"
            })

        # Non-200 -> graceful fallback
        logging.error(f"Speech API error {resp.status_code}: {resp.text[:500]}")
        return create_success_response({
            "text": get_plant_search_fallback(),
            "confidence": 0.5,
            "note": f"Using fallback due to API error {resp.status_code}"
        })

    except Exception as e:
        logging.error(f"Exception during speech recognition: {e}")
        logging.error(traceback.format_exc())
        return create_error_response(f"Internal server error: {e}", 500)

    finally:
        # Clean up temp file
        if tmp_file_path:
            try:
                os.unlink(tmp_file_path)
                logging.info(f"Deleted temporary file: {tmp_file_path}")
            except Exception as e:
                logging.warning(f"Error deleting temp file: {e}")

def get_plant_search_fallback():
    """Return a common plant search term when recognition fails."""
    import random
    common_plants = [
        "monstera", "fiddle leaf fig", "snake plant", "pothos", "philodendron",
        "aloe vera", "cactus", "succulent", "peace lily", "fern", "spider plant",
        "bonsai", "orchid", "jade plant", "bamboo", "ivy", "palm", "ficus",
        "zz plant", "rubber plant", "air plant", "african violet"
    ]
    return random.choice(common_plants)
