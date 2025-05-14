# This file should be placed at /shared/marketplace/db_client.py
# Centralized database client for all marketplace functions

import os
import logging
from azure.cosmos import CosmosClient, PartitionKey

# Dictionary to cache database connections to avoid creating multiple clients
_db_clients = {}

def get_marketplace_db_client():
    """Get a connection to the marketplace database."""
    global _db_clients
    
    try:
        # Check if we already have a connection
        if 'marketplace' in _db_clients:
            return _db_clients['marketplace']
            
        # Get connection details from environment variables
        connection_string = os.environ.get("COSMOSDB__MARKETPLACE_CONNECTION_STRING")
        database_name = os.environ.get("COSMOSDB_MARKETPLACE_DATABASE_NAME", "GreenerMarketplace")
        
        if not connection_string:
            # Fall back to separate URI and KEY if connection string is not provided
            cosmos_uri = os.environ.get("COSMOS_URI")
            cosmos_key = os.environ.get("COSMOS_KEY")
            
            if not cosmos_uri or not cosmos_key:
                raise ValueError("Missing required environment variables for database connection")
            
            # Create the client using URI and KEY
            client = CosmosClient(cosmos_uri, credential=cosmos_key)
            database = client.get_database_client(database_name)
        else:
            # Parse the connection string
            params = dict(param.split('=', 1) for param in connection_string.split(';'))
            account_endpoint = params.get('AccountEndpoint')
            account_key = params.get('AccountKey')
            
            if not account_endpoint or not account_key:
                raise ValueError("Invalid connection string format for marketplace database")
            
            # Create the client
            client = CosmosClient(account_endpoint, credential=account_key)
            database = client.get_database_client(database_name)
        
        # Cache the database client
        _db_clients['marketplace'] = database
        
        return database
    except Exception as e:
        logging.error(f"Failed to initialize marketplace database: {str(e)}")
        raise

def get_main_db_client():
    """Get a connection to the main Greener database."""
    global _db_clients
    
    try:
        # Check if we already have a connection
        if 'main' in _db_clients:
            return _db_clients['main']
            
        # Get connection details from environment variables
        cosmos_uri = os.environ.get("COSMOS_URI")
        cosmos_key = os.environ.get("COSMOS_KEY")
        database_name = os.environ.get("COSMOS_DATABASE_NAME", "GreenerDB")
        
        if not cosmos_uri or not cosmos_key:
            raise ValueError("Missing required environment variables for main database: COSMOS_URI and COSMOS_KEY")
        
        # Create the client
        client = CosmosClient(cosmos_uri, credential=cosmos_key)
        database = client.get_database_client(database_name)
        
        # Cache the database client
        _db_clients['main'] = database
        
        return database
    except Exception as e:
        logging.error(f"Failed to initialize main database: {str(e)}")
        raise

# shared/marketplace/db_client.py
def get_container(container_name):
    """
    Get container with proper environment variable mapping.
    Keys from any database (marketplace or main)
    """
    try:
        # Convert container names with dashes to env var format
        env_var_name = f"COSMOS_CONTAINER_{container_name.upper().replace('-', '_')}"
        actual_container_name = os.environ.get(env_var_name, container_name)
        
        # Select right database based on container prefix
        if container_name.startswith('marketplace-') or container_name in [
            'marketplace-plants', 'marketplace-conversations', 
            'marketplace-messages', 'marketplace-wishlists', 'users'
        ]:
            database = get_marketplace_db_client()
        else:
            database = get_main_db_client()
            
        return database.get_container_client(actual_container_name)
    except Exception as e:
        logging.error(f"Failed to get container {container_name}: {str(e)}")
        raise

def get_main_container(container_name):
    """Get a specific container from the main Greener database."""
    try:
        # Get container name from environment variables or use default
        env_var_name = f"COSMOS_CONTAINER_{container_name.upper()}"
        actual_container_name = os.environ.get(env_var_name, container_name)
        
        database = get_main_db_client()
        return database.get_container_client(actual_container_name)
    except Exception as e:
        logging.error(f"Failed to get main container {container_name}: {str(e)}")
        raise

def get_marketplace_container(container_name):
    """Get a specific container from the marketplace database."""
    try:
        # Get container name from environment variables or use default
        env_var_name = f"COSMOS_CONTAINER_{container_name.upper()}"
        actual_container_name = os.environ.get(env_var_name, container_name)
        
        database = get_marketplace_db_client()
        return database.get_container_client(actual_container_name)
    except Exception as e:
        logging.error(f"Failed to get marketplace container {container_name}: {str(e)}")
        raise