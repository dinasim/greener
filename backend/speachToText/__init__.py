import logging
import azure.functions as func
import azure.cognitiveservices.speech as speechsdk
import os
import json
import tempfile
import urllib.request

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('speechToText function triggered.')

    try:
        body = req.get_json()
        audio_url = body.get('audioUrl')
    except Exception:
        audio_url = req.params.get('audioUrl')

    if not audio_url:
        return func.HttpResponse(
            json.dumps({"error": "Missing 'audioUrl' parameter"}),
            status_code=400,
            mimetype="application/json"
        )

    try:
        # Download the audio file to a temporary location
        tmp_file = tempfile.NamedTemporaryFile(delete=False, suffix=".wav")
        urllib.request.urlretrieve(audio_url, tmp_file.name)

        # Configure Azure Speech SDK
        speech_config = speechsdk.SpeechConfig(
            subscription=os.environ["AZURE_SPEECH_KEY"],
            region=os.environ["AZURE_SPEECH_REGION"]
        )
        audio_config = speechsdk.audio.AudioConfig(filename=tmp_file.name)
        recognizer = speechsdk.SpeechRecognizer(
            speech_config=speech_config,
            audio_config=audio_config
        )

        # Recognize speech
        result = recognizer.recognize_once()

        if result.reason == speechsdk.ResultReason.RecognizedSpeech:
            return func.HttpResponse(
                json.dumps({"text": result.text}),
                status_code=200,
                mimetype="application/json"
            )
        else:
            return func.HttpResponse(
                json.dumps({"error": "Recognition failed", "reason": str(result.reason)}),
                status_code=500,
                mimetype="application/json"
            )

    except Exception as e:
        logging.exception("Exception during speech recognition.")
        return func.HttpResponse(
            json.dumps({"error": str(e)}),
            status_code=500,
            mimetype="application/json"
        )
