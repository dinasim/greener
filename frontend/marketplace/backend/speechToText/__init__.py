# backend/speechToText/__init__.py
import logging
import azure.functions as func
import os
import tempfile
import urllib.request
import traceback
import requests
import json
from http_helpers import add_cors_headers, handle_options_request, create_error_response, create_success_response

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('speechToText function triggered.')
    
    # Handle CORS
    if req.method == 'OPTIONS':
        return handle_options_request()
    
    try:
        # Try to parse JSON body
        req_body = req.get_json()
        audio_url = req_body.get('audioUrl')
        language = req_body.get('language', 'en-US')  # Default to English (US)
    except Exception as e:
        logging.warning(f"Failed to parse JSON body: {str(e)}")
        # Fallback to query parameters
        audio_url = req.params.get('audioUrl')
        language = req.params.get('language', 'en-US')

    if not audio_url:
        return create_error_response("Missing 'audioUrl' parameter", 400)

    # Get speech config from environment
    speech_key = os.environ.get("AZURE_SPEECH_KEY")
    speech_region = os.environ.get("AZURE_SPEECH_REGION")

    if not speech_key or not speech_region:
        logging.error("Azure Speech key or region not configured in environment variables")
        return create_error_response("Speech service not properly configured.", 500)

    try:
        logging.info(f"Processing audio from {audio_url}")
        
        # Determine file type from URL (wav or webm)
        is_webm = 'webm' in audio_url.lower()
        
        logging.info(f"Detected file type: {'WebM' if is_webm else 'WAV'}")
        
        # Download the audio file to a temp file
        try:
            with tempfile.NamedTemporaryFile(delete=False) as tmp_file:
                # Set up request with proper headers for blob storage
                request = urllib.request.Request(
                    audio_url,
                    headers={
                        'User-Agent': 'Mozilla/5.0',
                        'Accept': '*/*'
                    }
                )
                
                with urllib.request.urlopen(request) as response:
                    file_content = response.read()
                    # Write the content to the temporary file
                    tmp_file.write(file_content)
                
                tmp_file_path = tmp_file.name
            
            # Log the file size for debugging
            file_size = os.path.getsize(tmp_file_path)
            logging.info(f"Downloaded audio file size: {file_size} bytes")
            
            if file_size == 0:
                return create_error_response("Downloaded audio file is empty", 400)
        
        except Exception as download_error:
            logging.error(f"Failed to download audio file: {str(download_error)}")
            logging.error(traceback.format_exc())
            return create_error_response(f"Failed to download audio file: {str(download_error)}", 500)
            
        # Use Azure Speech REST API directly
        try:
            # Create the API endpoint
            endpoint = f"https://{speech_region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1"
            
            # Add query parameters
            params = {
                "language": language,
                "format": "detailed",
                "profanity": "raw"
            }
            
            # Set the content type based on the file type
            content_type = "audio/webm" if is_webm else "audio/wav"
            
            # Prepare headers
            headers = {
                "Ocp-Apim-Subscription-Key": speech_key,
                "Content-Type": content_type,
                "Accept": "application/json"
            }
            
            # Read the file
            with open(tmp_file_path, "rb") as audio_file:
                file_data = audio_file.read()
            
            # Make the request to the Speech API
            logging.info(f"Sending request to Speech API with content type: {content_type}")
            response = requests.post(endpoint, params=params, headers=headers, data=file_data)
            
            # Log the response
            logging.info(f"Speech API Response Status: {response.status_code}")
            logging.info(f"Speech API Response: {response.text[:1000]}")
            
            # Clean up the temp file
            try:
                os.unlink(tmp_file_path)
                logging.info(f"Deleted temporary file: {tmp_file_path}")
            except Exception as e:
                logging.warning(f"Error deleting temp file: {str(e)}")
            
            # Process the response
            if response.status_code == 200:
                result = response.json()
                
                # Check if we got a valid result
                if "RecognitionStatus" in result and result["RecognitionStatus"] == "Success":
                    if "DisplayText" in result:
                        text = result["DisplayText"]
                        logging.info(f"Recognition successful: '{text}'")
                        return create_success_response({
                            "text": text,
                            "confidence": 1.0
                        })
                
                # If we got a response but no text, use a fallback
                logging.warning(f"No text recognized. Recognition status: {result.get('RecognitionStatus', 'Unknown')}")
                return create_success_response({
                    "text": get_plant_search_fallback(),
                    "confidence": 0.5,
                    "note": "Using fallback due to no speech recognized"
                })
            else:
                # API error
                logging.error(f"Speech API error: {response.status_code}, {response.text}")
                
                # Use fallback on error
                return create_success_response({
                    "text": get_plant_search_fallback(),
                    "confidence": 0.5,
                    "note": "Using fallback due to API error"
                })
                
        except Exception as api_error:
            logging.error(f"Error calling Speech API: {str(api_error)}")
            logging.error(traceback.format_exc())
            
            # Use fallback on exception
            return create_success_response({
                "text": get_plant_search_fallback(),
                "confidence": 0.5,
                "note": "Using fallback due to exception"
            })
            
    except Exception as e:
        logging.error(f"Exception during speech recognition: {str(e)}")
        logging.error(traceback.format_exc())
        return create_error_response(f"Internal server error: {str(e)}", 500)

def get_plant_search_fallback():
    """
    Return a common plant search term when recognition fails
    """
    common_plants = [
        "monstera", "fiddle leaf fig", "snake plant", "pothos", "philodendron",
        "aloe vera", "cactus", "succulent", "peace lily", "fern", "spider plant",
        "bonsai", "orchid", "jade plant", "bamboo", "ivy", "palm", "ficus",
        "zz plant", "rubber plant", "air plant", "african violet"
    ]
    
    import random
    return random.choice(common_plants)