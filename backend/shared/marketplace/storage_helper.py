# This file should be placed at /shared/marketplace/storage_helper.py
# Centralized storage helper for all marketplace functions

import os
import logging
import base64
import uuid
import mimetypes
from azure.storage.blob import BlobServiceClient, ContentSettings
from azure.core.exceptions import ResourceExistsError

def get_storage_client():
    """Get the Azure Blob Storage client for marketplace images."""
    try:
        # Try to get connection string from environment variables
        connection_string = os.environ.get("STORAGE_ACCOUNT_MARKETPLACE_STRING")
        
        if not connection_string:
            # Try fallback to account name and key
            account_name = os.environ.get("STORAGE_ACCOUNT_NAME")
            account_key = os.environ.get("STORAGE_ACCOUNT_KEY")
            
            if not account_name or not account_key:
                raise ValueError("Missing required storage account configuration")
                
            # Create connection string from name and key
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
        'marketplace-misc'
    ]
    
    try:
        client = get_storage_client()
        
        for container_name in required_containers:
            try:
                container_client = client.get_container_client(container_name)
                
                # Check if container exists
                if not container_exists(container_client):
                    # Create container with public access
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
    Upload an image to blob storage and return the URL.
    
    Args:
        image_data: The image data, can be base64 encoded string or binary
        container_name: Optional container name, defaults to marketplace-plants
        filename: Optional custom filename, otherwise a UUID is generated
        
    Returns:
        URL of the uploaded blob
    """
    try:
        # Determine the container to use
        if not container_name:
            container_name = os.environ.get("STORAGE_CONTAINER_PLANTS", "marketplace-plants")
        
        # Get storage client
        client = get_storage_client()
        container_client = client.get_container_client(container_name)
        
        # Process the image data (detect if it's base64 or binary)
        image_bytes, content_type = process_image_data(image_data)
        
        # Generate a unique name for the blob if not provided
        if not filename:
            extension = get_file_extension(content_type)
            filename = f"{uuid.uuid4()}{extension}"
        
        # Upload the image with content settings
        blob_client = container_client.get_blob_client(filename)
        content_settings = ContentSettings(content_type=content_type)
        
        blob_client.upload_blob(
            image_bytes, 
            content_settings=content_settings, 
            overwrite=True
        )
        
        # Return the URL
        return blob_client.url
    
    except Exception as e:
        logging.error(f"Error uploading image: {str(e)}")
        raise

def process_image_data(image_data):
    """
    Process the image data to determine its format and convert to bytes.
    
    Args:
        image_data: Image data as base64 string or binary
        
    Returns:
        tuple: (image_bytes, content_type)
    """
    # Default content type
    content_type = "image/jpeg"
    
    # Handle different input formats
    if isinstance(image_data, str):
        if image_data.startswith('data:'):
            # Handle base64 encoded images with MIME type (data URI scheme)
            header, encoded = image_data.split(",", 1)
            content_type = header.split(":")[1].split(";")[0]
            image_bytes = base64.b64decode(encoded)
        elif image_data.startswith('http'):
            # It's a URL, not actual image data
            raise ValueError("Expected image data, received URL")
        else:
            # Assume it's plain base64
            try:
                image_bytes = base64.b64decode(image_data)
            except Exception:
                raise ValueError("Invalid base64 encoded image")
    elif isinstance(image_data, bytes):
        # Already in binary format
        image_bytes = image_data
    else:
        raise ValueError(f"Unsupported image data type: {type(image_data)}")
    
    return image_bytes, content_type

def get_file_extension(content_type):
    """Get file extension from content type."""
    extension = mimetypes.guess_extension(content_type)
    if not extension:
        # Default to .jpg if we can't determine the extension
        extension = '.jpg'
    return extension