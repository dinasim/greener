# storage_helpers.py

import os
import logging
import base64
import uuid
import mimetypes
import traceback
from azure.storage.blob import BlobServiceClient, ContentSettings

def get_storage_client():
    """Get the Azure Blob Storage client for marketplace images."""
    try:
        connection_string = os.environ.get("STORAGE_ACCOUNT_MARKETPLACE_STRING")
        
        if not connection_string:
            account_name = os.environ.get("STORAGE_ACCOUNT_NAME")
            account_key = os.environ.get("STORAGE_ACCOUNT_KEY")
            
            if not account_name or not account_key:
                raise ValueError("Missing required storage account configuration")
                
            connection_string = f"DefaultEndpointsProtocol=https;AccountName={account_name};AccountKey={account_key};EndpointSuffix=core.windows.net"
            
        client = BlobServiceClient.from_connection_string(connection_string)
        return client
    except Exception as e:
        logging.error(f"Failed to create storage client: {str(e)}")
        raise

def ensure_containers_exist():
    """Ensure all required blob containers exist."""
    required_containers = [
        'marketplace-plants',
        'marketplace-users',
        'marketplace-misc',
        'marketplace-speech'      # Added this container
    ]
    
    try:
        client = get_storage_client()
        
        for container_name in required_containers:
            try:
                container_client = client.get_container_client(container_name)
                
                if not container_exists(container_client):
                    container_client.create_container(public_access="blob")
                    logging.info(f"Created storage container: {container_name}")
            except Exception as e:
                logging.error(f"Error with container {container_name}: {str(e)}")
    except Exception as e:
        logging.error(f"Failed to ensure storage containers: {str(e)}")

def container_exists(container_client):
    """Check if a container exists without throwing an exception."""
    try:
        container_client.get_container_properties()
        return True
    except Exception:
        return False

def upload_image(image_data, container_name=None, filename=None):
    """
    Upload an image or audio blob to Azure Blob Storage and return the URL.
    """
    try:
        if not container_name:
            container_name = os.environ.get("STORAGE_CONTAINER_PLANTS", "marketplace-plants")
        
        client = get_storage_client()
        container_client = client.get_container_client(container_name)
        
        image_bytes, content_type = process_image_data(image_data)
        
        if not filename:
            extension = get_file_extension(content_type)
            filename = f"{uuid.uuid4()}{extension}"
        
        blob_client = container_client.get_blob_client(filename)
        content_settings = ContentSettings(content_type=content_type)
        
        blob_client.upload_blob(image_bytes, content_settings=content_settings, overwrite=True)
        
        return blob_client.url
    
    except Exception as e:
        logging.error(f"Error uploading image: {str(e)}")
        raise

def process_image_data(image_data):
    """
    Convert base64 or binary image/audio data to bytes and detect content type.
    """
    content_type = "image/jpeg"  # default
    
    if isinstance(image_data, str):
        if image_data.startswith('data:'):
            header, encoded = image_data.split(",", 1)
            content_type = header.split(":")[1].split(";")[0]
            image_bytes = base64.b64decode(encoded)
        elif image_data.startswith('http'):
            raise ValueError("Expected image data, received URL")
        else:
            try:
                image_bytes = base64.b64decode(image_data)
            except Exception:
                raise ValueError("Invalid base64 encoded image")
    elif isinstance(image_data, bytes):
        image_bytes = image_data
    else:
        raise ValueError(f"Unsupported image data type: {type(image_data)}")
    
    return image_bytes, content_type

def get_file_extension(content_type):
    extension = mimetypes.guess_extension(content_type)
    if not extension:
        extension = '.jpg'
    return extension


def upload_image_with_content_type(image_data, container_name=None, filename=None, content_type=None):
    """
    Upload an image or audio blob to Azure Blob Storage with a specific content type and return the URL.
    Enhanced to better handle WebM audio files.
    """
    try:
        if not container_name:
            container_name = os.environ.get("STORAGE_CONTAINER_PLANTS", "marketplace-plants")
        
        # Set the correct container for speech files
        if content_type and ('audio/' in content_type or filename and filename.endswith(('.wav', '.webm', '.mp3'))):
            # Override container for audio files
            container_name = 'marketplace-speech'
            logging.info(f"Using marketplace-speech container for audio file: {content_type}")
        
        client = get_storage_client()
        container_client = client.get_container_client(container_name)
        
        # Process image/audio data
        image_bytes, detected_content_type = process_image_data(image_data)
        
        # Use provided content_type if available, otherwise use detected one
        if not content_type:
            content_type = detected_content_type
        
        # Handle WebM audio files specially
        if content_type and 'audio/webm' in content_type:
            logging.info("Processing WebM audio file")
            # WebM files should keep their extension
            if not filename or not filename.endswith('.webm'):
                filename = f"{uuid.uuid4()}.webm"
        # Generate filename if not provided
        elif not filename:
            extension = get_file_extension(content_type)
            filename = f"{uuid.uuid4()}{extension}"
        
        # Log upload details
        logging.info(f"Uploading file: {filename} with content type: {content_type} to container: {container_name}")
        logging.info(f"File size: {len(image_bytes)} bytes")
        
        # Create blob client
        blob_client = container_client.get_blob_client(filename)
        
        # Set the content type in content settings
        content_settings = ContentSettings(
            content_type=content_type,
            cache_control="public, max-age=31536000",  # Cache for 1 year
            content_disposition=None,
            content_encoding=None,
            content_language=None,
            content_md5=None
        )
        
        # Upload the blob
        blob_client.upload_blob(image_bytes, content_settings=content_settings, overwrite=True)
        
        # Get the URL
        blob_url = blob_client.url
        
        # Log success
        logging.info(f"Upload successful: {blob_url}")
        
        return blob_url
    
    except Exception as e:
        logging.error(f"Error uploading file with content type: {str(e)}")
        logging.error(f"Stack trace: {traceback.format_exc()}")
        raise