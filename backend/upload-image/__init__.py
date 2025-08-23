import logging
import azure.functions as func
import base64
import uuid
from datetime import datetime
from http_helpers import (
    handle_options_request,
    create_error_response,
    create_success_response,
    extract_user_id,
)
from storage_helpers import upload_image_with_content_type, ensure_containers_exist

# --- Extra imports ---
import os
import tempfile
import subprocess
import shutil

# Env flags (no redeploy to change behavior)
FORCE_WAV_ON_UPLOAD = os.getenv("FORCE_WAV_ON_UPLOAD", "0") == "1"
STRICT_WAV_ON_UPLOAD = os.getenv("STRICT_WAV_ON_UPLOAD", "0") == "1"

# Recognized WAV-ish strings
_WAV_CT = ("audio/wav", "audio/x-wav", "audio/wave", "vnd.wave")

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

def _transcode_to_wav_16k(raw_bytes: bytes) -> bytes:
    """Transcode arbitrary audio bytes to 16kHz mono 16-bit PCM WAV using ffmpeg."""
    ffmpeg = _resolve_ffmpeg_path()
    if not ffmpeg:
        raise RuntimeError("ffmpeg not found (set FFMPEG_PATH or include ./bin/ffmpeg)")
    try:
        if not ffmpeg.endswith(".exe"):
            os.chmod(ffmpeg, 0o755)
    except Exception:
        pass

    with tempfile.NamedTemporaryFile(delete=False, suffix=".in") as tin:
        tin.write(raw_bytes)
        tin_path = tin.name
    tout_path = tin_path + ".wav"

    try:
        proc = subprocess.run(
            [ffmpeg, "-y", "-i", tin_path, "-ac", "1", "-ar", "16000", "-sample_fmt", "s16", tout_path],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            check=False,
        )
        if proc.returncode != 0 or not os.path.exists(tout_path):
            raise RuntimeError(
                f"ffmpeg failed (code={proc.returncode}) stderr={proc.stderr.decode(errors='ignore')[:400]}"
            )
        with open(tout_path, "rb") as f:
            return f.read()
    finally:
        try: os.unlink(tin_path)
        except Exception: pass
        try:
            if os.path.exists(tout_path):
                os.unlink(tout_path)
        except Exception:
            pass

def _ext_from_content_type(ct: str) -> str:
    ct = (ct or "").lower()
    if "audio/wav" in ct or "audio/x-wav" in ct or "audio/wave" in ct or "vnd.wave" in ct:
        return ".wav"
    if "audio/mp4" in ct or "audio/m4a" in ct:
        return ".m4a"
    if "audio/mpeg" in ct:
        return ".mp3"
    if "audio/webm" in ct:
        return ".webm"
    if "audio/ogg" in ct:
        return ".ogg"
    if "audio/3gpp" in ct or "video/3gpp" in ct:
        return ".3gp"
    if "image/jpeg" in ct or "image/jpg" in ct:
        return ".jpg"
    if "image/png" in ct:
        return ".png"
    if "image/gif" in ct:
        return ".gif"
    return ".bin"

def _sniff_content_type_from_bytes(b: bytes, ct_hint: str) -> str:
    try:
        head = b[:64]
        logging.info(f"Magic sniff: first 16 bytes = {head[:16].hex()}")
        if head.startswith(b"RIFF") and b"WAVE" in head[:12]:
            logging.info("Detected WAV via RIFF header"); return "audio/wav"
        if head.startswith(b"#!AMR") or head.startswith(b"#!AMR-WB"):
            logging.info("Detected AMR via magic header"); return "audio/3gpp"
        if len(head) >= 12 and head[4:8] == b"ftyp":
            brand = head[8:12]
            logging.info(f"Detected ftyp container brand: {brand}")
            if brand in (b"3gp4", b"3gp5", b"3gpp"):
                return "audio/3gpp"
            if brand in (b"isom", b"mp42", b"M4A ", b"M4B "):
                return "audio/mp4"
        if head.startswith(b"ID3") or head.startswith(b"\xff\xfb"):
            return "audio/mpeg"
        if head.startswith(b"\x1a\x45\xdf\xa3"):
            return "audio/webm"
    except Exception as e:
        logging.warning(f"Magic sniff error: {e}")
    logging.info(f"No magic match, using hint: {ct_hint}")
    return ct_hint or ""

def _maybe_decode_body(data, content_type_hint: str):
    if isinstance(data, (bytes, bytearray)):
        return bytes(data), content_type_hint
    if isinstance(data, str):
        s = data.strip()
        if s.startswith("data:"):
            try:
                header, b64 = s.split(",", 1)
                detected_ct = ""
                try: detected_ct = header[5:].split(";")[0]
                except Exception: pass
                return base64.b64decode(b64), (detected_ct or content_type_hint)
            except Exception as e:
                logging.warning(f"Failed to parse data URL: {e}")
        try:
            return base64.b64decode(s), content_type_hint
        except Exception:
            return s.encode("utf-8"), content_type_hint
    return None, content_type_hint

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info("Upload function (image/audio) invoked.")

    if req.method == "OPTIONS":
        return handle_options_request()

    try:
        ensure_containers_exist()
        user_id = extract_user_id(req)

        file_data = None
        file_type = None
        filename = None
        content_type = None
        transcoded = False
        transcode_status = "skipped"
        transcode_error = ""

        # Multipart form
        if getattr(req, "files", None):
            upload_file = (
                req.files.get("file")
                or req.files.get("image")
                or req.files.get("audio")
            )
            if upload_file:
                raw = upload_file.read()
                content_type = upload_file.content_type
                filename = upload_file.filename
                file_type = (req.form.get("type") or file_type)
                if req.form.get("contentType"):
                    content_type = req.form.get("contentType")
                    logging.info(f"Content type (form override): {content_type}")
                file_data, content_type = _maybe_decode_body(raw, content_type)

        # JSON body (base64 / data URL)
        if file_data is None:
            try:
                body = req.get_json()
                for key in ("file", "image", "audio"):
                    if key in body:
                        raw = body[key]
                        file_type = body.get("type") or file_type
                        if "filename" in body: filename = body["filename"]
                        if "contentType" in body:
                            content_type = body["contentType"]
                            logging.info(f"Content type (json hint): {content_type}")
                        file_data, content_type = _maybe_decode_body(raw, content_type)
                        break
            except ValueError:
                pass

        if not file_data:
            return create_error_response("No file data provided", 400)

        # Guess content-type from magic if missing/ambiguous
        sniffed = _sniff_content_type_from_bytes(file_data, content_type or "")
        if sniffed and sniffed != (content_type or ""):
            logging.info(f"Magic sniff changed content-type: {content_type} -> {sniffed}")
            content_type = sniffed

        # Pick container by type
        file_type = (file_type or "misc").lower()
        container_name = "marketplace-misc"
        if file_type in ("plant", "product"):
            container_name = "marketplace-plants"
        elif file_type in ("user", "avatar", "profile"):
            container_name = "marketplace-users"
        elif file_type in ("speech", "audio", "voice"):
            container_name = "marketplace-speech"

        # --- SPEECH: optional normalization on upload ---
        if file_type in ("speech", "audio", "voice"):
            should_force = FORCE_WAV_ON_UPLOAD and (content_type or "").lower() not in _WAV_CT
            logging.info(f"Speech upload: content_type={content_type}, FORCE_WAV_ON_UPLOAD={FORCE_WAV_ON_UPLOAD}, STRICT_WAV_ON_UPLOAD={STRICT_WAV_ON_UPLOAD}")
            if should_force:
                try:
                    file_data = _transcode_to_wav_16k(file_data)
                    content_type = "audio/wav"
                    transcoded = True
                    transcode_status = "success"
                    logging.info("Transcoded to WAV 16k mono on upload")
                except Exception as e:
                    transcode_error = f"{type(e).__name__}: {e}"
                    logging.error(f"Upload transcode failed: {transcode_error}")
                    transcode_status = "failed"
                    if STRICT_WAV_ON_UPLOAD:
                        return create_error_response("Server audio transcode failed", 500)
                    # else: fall through — store original (M4A/MP4/etc.)
            else:
                transcode_status = "skipped"

        logging.info(f"Upload type={file_type}, container={container_name}, content-type={content_type}, transcode_status={transcode_status}")

        # Ensure filename extension matches final content-type
        ext = _ext_from_content_type(content_type or "")
        if not filename:
            current_time = datetime.utcnow().strftime("%Y%m%d%H%M%S")
            short_user = (user_id or "")[:6]
            prefix = f"{short_user}_" if short_user else ""
            filename = f"{prefix}{file_type}_{current_time}_{str(uuid.uuid4())[:8]}{ext}"
        else:
            base, _ = os.path.splitext(filename)
            filename = base + ext

        logging.info(f"Storing as: {filename} (transcoded={transcoded}, status={transcode_status})")

        file_url = upload_image_with_content_type(
            file_data, container_name, filename, content_type
        )

        payload = {
            "url": file_url,
            "filename": filename,
            "type": file_type,
            "contentType": content_type,
            "transcoded": transcoded,
            "transcodeStatus": transcode_status,
        }
        if transcode_error:
            payload["transcodeError"] = transcode_error

        return create_success_response(payload)

    except Exception as e:
        logging.error(f"Error uploading file: {e}")
        return create_error_response(str(e), 500)
