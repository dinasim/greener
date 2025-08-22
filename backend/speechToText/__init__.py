import logging
import azure.functions as func
import tempfile
import urllib.request
import traceback
from http_helpers import handle_options_request, create_error_response, create_success_response

# --- Optional inline transcode safety net (mirrors upload-image) ---
import shutil
import subprocess
# add to backend/speechtotext/__init__.py
import time, requests, os

def _cloudconvert_3gp_to_wav(url: str, timeout_s: int = 120) -> bytes:
    """
    Convert a 3GP/AMR file (at a public/SAS URL) to 16 kHz mono WAV via CloudConvert.
    Requires env CLOUDCONVERT_API_KEY.
    """
    api_key = os.environ.get("CLOUDCONVERT_API_KEY")
    if not api_key:
        raise RuntimeError("CLOUDCONVERT_API_KEY not set")

    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}

    # Create a job: import URL -> convert -> export URL
    job_payload = {
        "tasks": {
            "import-file": {"operation": "import/url", "url": url},
            "convert-file": {
                "operation": "convert",
                "input": "import-file",
                "input_format": "3gp",
                "output_format": "wav",
                # force 16 kHz mono PCM
                "audio_codec": "pcm_s16le",
                "audio_frequency": 16000,
                "audio_channels": 1
            },
            "export-file": {"operation": "export/url", "input": "convert-file"}
        }
    }
    job = requests.post("https://api.cloudconvert.com/v2/jobs",
                        json=job_payload, headers=headers, timeout=30).json()["data"]
    job_id = job["id"]

    # Poll until finished
    t0 = time.time()
    export_url = None
    while time.time() - t0 < timeout_s:
        j = requests.get(f"https://api.cloudconvert.com/v2/jobs/{job_id}?include=tasks",
                         headers=headers, timeout=30).json()["data"]
        tasks = {t["name"]: t for t in j.get("tasks", [])}
        exp = tasks.get("export-file")
        if exp and exp["status"] == "finished" and exp.get("result", {}).get("files"):
            export_url = exp["result"]["files"][0]["url"]
            break
        if any(t.get("status") == "error" for t in tasks.values()):
            raise RuntimeError("CloudConvert job failed")
        time.sleep(2)

    if not export_url:
        raise TimeoutError("CloudConvert export timed out")

    # Download the WAV bytes
    wav_bytes = requests.get(export_url, timeout=60).content
    return wav_bytes


def _resolve_ffmpeg_path() -> str:
    p = os.environ.get("FFMPEG_PATH")
    if p and os.path.exists(p):
        return p
    p = shutil.which("ffmpeg")
    if p:
        return p
    for cand in (
        os.path.join(os.getcwd(), "bin", "ffmpeg"),
        os.path.join(os.getcwd(), "bin", "ffmpeg.exe"),
        "/usr/local/bin/ffmpeg",
        "/usr/bin/ffmpeg",
    ):
        if os.path.exists(cand):
            return cand
    return ""


def _transcode_file_to_wav_16k(src_path: str) -> bytes:
    ffmpeg = _resolve_ffmpeg_path()
    if not ffmpeg:
        raise RuntimeError("ffmpeg not found for STT (set FFMPEG_PATH or include ./bin/ffmpeg)")
    try:
        if not ffmpeg.endswith(".exe"):
            os.chmod(ffmpeg, 0o755)
    except Exception:
        pass

    tout_path = src_path + ".wav"
    try:
        subprocess.run(
            [ffmpeg, "-y", "-i", src_path, "-ac", "1", "-ar", "16000", "-sample_fmt", "s16", tout_path],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            check=True,
        )
        with open(tout_path, "rb") as f:
            return f.read()
    finally:
        try:
            if os.path.exists(tout_path):
                os.unlink(tout_path)
        except Exception:
            pass
# ------------------------------------------------------------------


def _extract_text_from_azure(payload: dict) -> str:
    """Supports both detailed and simple responses from Azure Speech Service."""
    if not isinstance(payload, dict):
        return ""

    # Simple format
    display_text = payload.get("DisplayText")
    if isinstance(display_text, str) and display_text.strip():
        return display_text.strip()

    # Detailed (top-level)
    nbest = payload.get("NBest")
    if isinstance(nbest, list) and nbest:
        first = nbest[0] or {}
        for field in ("Display", "Lexical", "ITN", "MaskedITN"):
            v = first.get(field)
            if isinstance(v, str) and v.strip():
                return v.strip()

    # Detailed (nested)
    audio_results = payload.get("AudioFileResults")
    if isinstance(audio_results, list) and audio_results:
        inner = audio_results[0] or {}
        inner_nbest = inner.get("NBest")
        if isinstance(inner_nbest, list) and inner_nbest:
            first_inner = inner_nbest[0] or {}
            for field in ("Display", "Lexical", "ITN", "MaskedITN"):
                v = first_inner.get(field)
                if isinstance(v, str) and v.strip():
                    return v.strip()

    return ""


def _determine_content_type(audio_url: str, temp_file_path: str) -> str:
    """Enhanced content type detection with better 3GP handling."""
    url = (audio_url or "").lower()
    try:
        with open(temp_file_path, "rb") as f:
            header = f.read(64)
    except Exception:
        header = b""

    # Enhanced 3GP/AMR detection
    if header.startswith(b"#!AMR") or header.startswith(b"#!AMR-WB"):
        logging.info("Detected AMR magic header")
        return "audio/3gpp"

    # Check for 3GP container with ftyp box
    if len(header) >= 16 and header[4:8] == b"ftyp":
        brand = header[8:12]
        if brand in (b"3gp4", b"3gp5", b"3gpp", b"3ge6", b"3ge7"):
            logging.info(f"Detected 3GP container with brand: {brand}")
            return "audio/3gpp"
        # Standard MP4/M4A brands
        elif brand in (b"isom", b"mp42", b"M4A ", b"M4B ", b"iso2"):
            logging.info(f"Detected MP4/M4A container with brand: {brand}")
            return "audio/mp4"

    # WAV
    if header.startswith(b"RIFF") and b"WAVE" in header[:12]:
        return "audio/wav"

    # WebM
    if header.startswith(b"\x1a\x45\xdf\xa3"):
        return "audio/webm"

    # MP3
    if header.startswith(b"ID3") or header.startswith(b"\xff\xfb"):
        return "audio/mpeg"

    # OGG
    if header.startswith(b"OggS"):
        return "audio/ogg"

    # Fallback: check URL extension
    if ".3gp" in url or ".amr" in url:
        logging.info("Detected 3GP from URL extension")
        return "audio/3gpp"
    elif ".m4a" in url or ".mp4" in url:
        return "audio/mp4"
    elif ".wav" in url:
        return "audio/wav"
    elif ".webm" in url:
        return "audio/webm"
    elif ".mp3" in url:
        return "audio/mpeg"

    logging.warning("Unknown audio format, defaulting to audio/wav")
    return "audio/wav"


def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info("speechToText function triggered.")

    if req.method == "OPTIONS":
        return handle_options_request()

    # Extract params
    try:
        body = req.get_json()
        audio_url = body.get("audioUrl") if body else None
        language = body.get("language", "en-US") if body else "en-US"
    except Exception:
        audio_url = req.params.get("audioUrl")
        language = req.params.get("language", "en-US")

    if not audio_url:
        return create_error_response("Missing 'audioUrl' parameter", 400)

    # Language whitelist
    language = {"en-US": "en-US", "he-IL": "he-IL", "en": "en-US", "he": "he-IL"}.get(language, "en-US")

    # Azure credentials
    speech_key = os.environ.get("AZURE_SPEECH_KEY")
    speech_region = os.environ.get("AZURE_SPEECH_REGION")
    if not speech_key or not speech_region:
        logging.error("AZURE_SPEECH_KEY or AZURE_SPEECH_REGION not configured")
        return create_error_response("Speech service not configured", 500)

    temp_file_path = None

    try:
        logging.info(f"Processing audio URL: {audio_url[:100]}...")

        # Download to temp
        with tempfile.NamedTemporaryFile(delete=False, suffix=".audio") as tmp:
            temp_file_path = tmp.name
            request = urllib.request.Request(
                audio_url,
                headers={
                    "User-Agent": "Mozilla/5.0 (compatible; SpeechToText/1.0)",
                    "Accept": "*/*",
                    "Accept-Encoding": "identity",
                },
            )
            with urllib.request.urlopen(request, timeout=30) as resp:
                tmp.write(resp.read())

        file_size = os.path.getsize(temp_file_path)
        logging.info(f"Downloaded audio file: {file_size} bytes")
        if file_size == 0:
            return create_error_response("Downloaded audio file is empty", 400)
        if file_size > 25 * 1024 * 1024:
            return create_error_response("Audio file too large (max 25MB)", 400)

        # Content-type detection
        content_type = _determine_content_type(audio_url, temp_file_path)
        logging.info(f"Detected content type: {content_type}")

        # If 3GP/AMR slipped through, try inline transcode; otherwise bail with a friendly message.
        if content_type == "audio/3gpp":
            logging.warning("3GP/AMR received; converting via CloudConvert.")
            try:
                audio_bytes = _cloudconvert_3gp_to_wav(audio_url)
                content_type = "audio/wav"
                logging.info("CloudConvert OK; proceeding with Azure STT.")
            except Exception as e:
                logging.error(f"CloudConvert failed: {e}")
                return create_success_response({
                    "text": "",
                    "confidence": 0.0,
                    "language": language,
                    "status": "UnsupportedAudioFormat",
                    "message": "3GP/AMR not supported by Azure Speech and conversion failed.",
                    "suggestedAction": "rerecord",
                    "supportedFormats": ["audio/mp4", "audio/wav", "audio/mpeg", "audio/webm", "audio/ogg"]
                })
        else:
            with open(temp_file_path, "rb") as f:
                audio_bytes = f.read()


        # Azure endpoint + params
        endpoint = (
            f"https://{speech_region}.stt.speech.microsoft.com/"
            "speech/recognition/conversation/cognitiveservices/v1"
        )
        params = {
            "language": language,
            "format": "detailed",
            "profanity": "raw",
            "wordLevelTimestamps": "false",
            "diarization": "false",
        }
        headers = {
            "Ocp-Apim-Subscription-Key": speech_key,
            "Content-Type": content_type,
            "Accept": "application/json",
            "User-Agent": "SpeechToText/1.0",
        }

        logging.info(
            f"Sending {len(audio_bytes)} bytes to Azure Speech Service (lang={language}, content-type={content_type})"
        )

        response = requests.post(endpoint, params=params, headers=headers, data=audio_bytes, timeout=30)

        logging.info(f"Azure Speech API response: {response.status_code}")
        preview = response.text[:500] + "..." if len(response.text) > 500 else response.text
        logging.info(f"Response body (truncated): {preview}")

        if response.status_code != 200:
            msg = f"Azure Speech API error: {response.status_code}"
            try:
                err = response.json()
                msg += f" - {err.get('error', {}).get('message', 'Unknown error')}"
            except Exception:
                msg += f" - {response.text[:200]}"
            logging.error(msg)
            return create_success_response(
                {
                    "text": "",
                    "confidence": 0.0,
                    "language": language,
                    "status": "ApiError",
                    "error": f"Speech recognition failed: {response.status_code}",
                    "message": "Azure Speech Service returned an error",
                }
            )

        try:
            data = response.json()
        except ValueError:
            logging.error("Failed to parse JSON response from Azure Speech API")
            return create_success_response(
                {
                    "text": "",
                    "confidence": 0.0,
                    "language": language,
                    "status": "ParseError",
                    "error": "Invalid response from speech service",
                    "message": "Could not parse Azure Speech Service response",
                }
            )

        text = _extract_text_from_azure(data)
        status = data.get("RecognitionStatus", "")

        # Confidence calculation
        conf = 0.0
        if text and status == "Success":
            conf = 0.8
            nbest = data.get("NBest", [])
            if nbest and isinstance(nbest[0], dict):
                azure_conf = nbest[0].get("Confidence", 0.8)
                conf = max(0.1, float(azure_conf))
        elif status in ("InitialSilenceTimeout", "BabbleTimeout", "Error"):
            conf = 0.0
        else:
            conf = 0.3

        if text:
            logging.info(f"Transcribed: '{text}' (confidence={conf:.2f}, status={status})")
            return create_success_response(
                {"text": text, "confidence": conf, "language": language, "status": status, "message": "Transcription successful"}
            )

        # No text recognized
        status_messages = {
            "InitialSilenceTimeout": "No speech detected - please try speaking louder or closer to the microphone",
            "BabbleTimeout": "Audio too noisy or unclear - please try recording in a quieter environment",
            "Error": "Speech recognition error - please try again",
            "NoMatch": "Could not understand the speech - please try speaking more clearly",
        }
        message = status_messages.get(status, "No speech detected")
        logging.warning(f"No speech recognized (status: {status})")

        return create_success_response(
            {
                "text": "",
                "confidence": 0.0,
                "language": language,
                "status": status or "NoMatch",
                "message": message,
                "suggestedAction": "retry",
            }
        )

    except requests.exceptions.Timeout:
        logging.error("Timeout calling Azure Speech API")
        return create_error_response("Speech recognition timeout", 408)

    except requests.exceptions.RequestException as e:
        logging.error(f"Network error calling Azure Speech API: {e}")
        return create_error_response(f"Network error: {str(e)}", 503)

    except Exception as e:
        logging.error(f"Unexpected error in speech-to-text: {e}")
        logging.error(traceback.format_exc())
        return create_error_response(f"Internal server error: {str(e)}", 500)

    finally:
        if temp_file_path and os.path.exists(temp_file_path):
            try:
                os.unlink(temp_file_path)
                logging.info("Temporary audio file cleaned up")
            except Exception as e:
                logging.warning(f"Failed to delete temporary file: {e}")
