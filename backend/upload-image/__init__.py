# Backend: /backend/upload-image/__init__.py 
# marketplace file

import logging
import json
import azure.functions as func
import base64
import uuid
import re
from datetime import datetime
from http_helpers import add_cors_headers, handle_options_request, create_error_response, create_success_response, extract_user_id
from storage_helpers import upload_image, ensure_containers_exist

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Python HTTP trigger function for image upload processed a request.')
    
    # Handle OPTIONS method for CORS preflight
    if req.method == 'OPTIONS':
        return handle_options_request()
    
    try:
        # Ensure storage containers exist
        ensure_containers_exist()
        
        # Get user ID for attribution (optional)
        user_id = extract_user_id(req)
        
        # Check if there's a form data file upload
        image_data = None
        image_type = None
        filename = None
        
        if req.files:
            # Multipart form data with file
            image_file = req.files.get('image')
            if image_file:
                image_data = image_file.read()
                content_type = image_file.content_type
                filename = image_file.filename
                image_type = req.form.get('type', 'plant')
        else:
            # Check for JSON body with base64 image
            try:
                request_body = req.get_json()
                
                # Get image data
                if 'image' in request_body:
                    image_data = request_body['image']
                    image_type = request_body.get('type', 'plant')
                    
                    # Handle possible additional metadata
                    if 'filename' in request_body:
                        filename = request_body['filename']
            except ValueError:
                # Not a JSON body
                pass
        
        if not image_data:
            return create_error_response("No image data provided", 400)
        
        # Determine the appropriate container based on image type
        container_name = 'marketplace-misc'  # Default
                    
        if image_type == 'plant' or image_type == 'product':
            container_name = 'marketplace-plants'
        elif image_type == 'user' or image_type == 'avatar' or image_type == 'profile':
            container_name = 'marketplace-users'
        elif image_type == 'speech':
            container_name = 'marketplace-speech'
        else:
            container_name = 'marketplace-misc'

        
        # Generate filename if not provided
        if not filename:
            current_time = datetime.utcnow().strftime('%Y%m%d%H%M%S')
            random_suffix = str(uuid.uuid4())[:8]
            user_prefix = f"{user_id[:6]}_" if user_id else ""
            filename = f"{user_prefix}{image_type}_{current_time}_{random_suffix}.jpg"
        
        # Upload the image
        image_url = upload_image(image_data, container_name, filename)
        
        # Return success with the image URL
        return create_success_response({
            "url": image_url,
            "filename": filename,
            "type": image_type
        })
    
    except Exception as e:
        logging.error(f"Error uploading image: {str(e)}")
        return create_error_response(str(e), 500)