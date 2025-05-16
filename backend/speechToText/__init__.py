import logging
import azure.functions as func
import azure.cognitiveservices.speech as speechsdk
import os
import json
import tempfile
import urllib.request
import traceback

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('speechToText function triggered.')

    try:
        # Try to parse JSON body
        body = req.get_json()
        audio_url = body.get('audioUrl')
    except Exception:
        # Fallback to query parameters
        audio_url = req.params.get('audioUrl')

    if not audio_url:
        return func.HttpResponse(
            json.dumps({"error": "Missing 'audioUrl' parameter"}),
            status_code=400,
            mimetype="application/json"
        )

    try:
        # Download the audio file to a temporary file
        with tempfile.NamedTemporaryFile(delete=True, suffix=".wav") as tmp_file:
            urllib.request.urlretrieve(audio_url, tmp_file.name)

            # Configure Azure Speech SDK
            speech_config = speechsdk.SpeechConfig(
                subscription=os.environ.get("AZURE_SPEECH_KEY"),
                region=os.environ.get("AZURE_SPEECH_REGION")
            )

            if not speech_config.subscription or not speech_config.region:
                raise Exception("Azure Speech subscription key or region not set in environment variables.")

            audio_config = speechsdk.audio.AudioConfig(filename=tmp_file.name)
            recognizer = speechsdk.SpeechRecognizer(
                speech_config=speech_config,
                audio_config=audio_config
            )

            # Perform speech recognition
            result = recognizer.recognize_once()

            if result.reason == speechsdk.ResultReason.RecognizedSpeech:
                return func.HttpResponse(
                    json.dumps({"text": result.text}),
                    status_code=200,
                    mimetype="application/json"
                )
            else:
                error_detail = {
                    "error": "Recognition failed",
                    "reason": str(result.reason),
                    "error_details": result.no_match_details.reason if result.no_match_details else "No details"
                }
                logging.error(f"Recognition failed: {error_detail}")
                return func.HttpResponse(
                    json.dumps(error_detail),
                    status_code=500,
                    mimetype="application/json"
                )

    except Exception as e:
        logging.error("Exception during speech recognition: " + str(e))
        logging.error(traceback.format_exc())
        return func.HttpResponse(
            json.dumps({"error": str(e)}),
            status_code=500,
            mimetype="application/json"
        )
