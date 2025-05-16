# backend/upload-image/__init__.py
import logging
import azure.functions as func
import base64
import uuid
import re
from datetime import datetime
from http_helpers import add_cors_headers, handle_options_request, create_error_response, create_success_response, extract_user_id
from storage_helpers import upload_image_with_content_type, ensure_containers_exist

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Python HTTP trigger function for image/audio upload processed a request.')
    
    # Handle OPTIONS method for CORS preflight
    if req.method == 'OPTIONS':
        return handle_options_request()
    
    try:
        # Ensure storage containers exist
        ensure_containers_exist()
        
        # Get user ID for attribution (optional)
        user_id = extract_user_id(req)
        
        # Check if there's a form data file upload
        file_data = None
        file_type = None
        filename = None
        content_type = None
        
        if req.files:
            # Multipart form data with file
            upload_file = req.files.get('file') or req.files.get('image') or req.files.get('audio')
            if upload_file:
                file_data = upload_file.read()
                content_type = upload_file.content_type
                filename = upload_file.filename
                file_type = req.form.get('type')
                
                # Check if content type was explicitly provided in form
                if req.form.get('contentType'):
                    content_type = req.form.get('contentType')
                    logging.info(f"Content type from form: {content_type}")
        else:
            # Check for JSON body with base64 file data
            try:
                request_body = req.get_json()
                
                # Get file data
                for key in ['file', 'image', 'audio']:
                    if key in request_body:
                        file_data = request_body[key]
                        file_type = request_body.get('type')
                        
                        # Handle possible additional metadata
                        if 'filename' in request_body:
                            filename = request_body['filename']
                        
                        # Check for explicitly provided content type
                        if 'contentType' in request_body:
                            content_type = request_body['contentType']
                            logging.info(f"Content type from JSON: {content_type}")
                        break
            except ValueError:
                # Not a JSON body
                pass
        
        if not file_data:
            return create_error_response("No file data provided", 400)
        
        # Determine the appropriate container based on file type
        container_name = 'marketplace-misc'  # Default
        
        if not file_type:
            file_type = 'misc'  # Default if no type specified
            
        if file_type in ['plant', 'product']:
            container_name = 'marketplace-plants'
        elif file_type in ['user', 'avatar', 'profile']:
            container_name = 'marketplace-users'
        elif file_type in ['speech', 'audio', 'voice']:
            container_name = 'marketplace-speech'
            
            # Force audio content type for speech if not set
            if not content_type or 'image/' in content_type:
                content_type = 'audio/wav'
                logging.info(f"Forcing content type for speech: {content_type}")
        
        logging.info(f"Upload type: {file_type}, container: {container_name}, content-type: {content_type}")
        
        # Generate filename if not provided
        if not filename:
            extension = '.jpg'  # Default extension
            
            # Try to determine extension from content type
            if content_type:
                if 'audio/wav' in content_type:
                    extension = '.wav'
                elif 'audio/webm' in content_type:
                    extension = '.webm'
                elif 'audio/mp3' in content_type:
                    extension = '.mp3' 
                elif 'audio/' in content_type:
                    extension = '.wav'  # Default for other audio
                elif 'image/png' in content_type:
                    extension = '.png'
                elif 'image/gif' in content_type:
                    extension = '.gif'
            elif file_type == 'speech':
                extension = '.wav'  # Default for speech
            
            current_time = datetime.utcnow().strftime('%Y%m%d%H%M%S')
            random_suffix = str(uuid.uuid4())[:8]
            user_prefix = f"{user_id[:6]}_" if user_id else ""
            filename = f"{user_prefix}{file_type}_{current_time}_{random_suffix}{extension}"
        
        logging.info(f"Generated filename: {filename}")
        
        # Upload the file with content type
        file_url = upload_image_with_content_type(file_data, container_name, filename, content_type)
        
        # Return success with the image URL
        return create_success_response({
            "url": file_url,
            "filename": filename,
            "type": file_type,
            "contentType": content_type
        })
    
    except Exception as e:
        logging.error(f"Error uploading file: {str(e)}")
        return create_error_response(str(e), 500)