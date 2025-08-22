# db_helpers.py - YOUR VERSION WITH CRITICAL FIXES APPLIED

import os
import logging
from azure.cosmos import CosmosClient, PartitionKey, exceptions

# Dictionary to cache database connections to avoid creating multiple clients
_db_clients = {}
_container_cache = {}

# FIXED: Comprehensive container name mapping including all new containers
CONTAINER_NAME_MAPPING = {
    # Marketplace containers (handle both dash and underscore variants)
    "marketplace-plants": "marketplace_plants",
    "marketplace-conversations": "marketplace_conversations_new",  # CRITICAL FIX: was "marketplace_conversations"
    "marketplace-messages": "marketplace_messages",
    "marketplace-reviews": "marketplace_reviews",
    "marketplace-wishlists": "marketplace_wishlists",
    "marketplace_plants": "marketplace_plants",
    "marketplace_conversations": "marketplace_conversations_new",  # CRITICAL FIX: was "marketplace_conversations"
    "marketplace_messages": "marketplace_messages", 
    "marketplace_reviews": "marketplace_reviews",
    "marketplace_wishlists": "marketplace_wishlists",
    "marketplace_rating": "marketplace_rating",
    
    # Business containers
    "business_users": "business_users",
    "business_customers": "business_customers",
    "business_transactions": "business_transactions",
    "business_staff": "business_staff",
    "inventory": "inventory",
    "orders": "orders",
    "watering_notifications": "watering_notifications",
    
    # User containers  
    "users": "users",
    "Users": "Users",
    
    # Authentication and preferences
    "authentication": "authentication",
    "Preferences": "Preferences",
    
    # Notification containers
    "notifications": "notifications",
    "notification_history": "notification_history",
    
    # Product and rating containers
    "product_rating": "product_rating",
    
    # AI and chat containers
    "plant-care-chat": "plant-care-chat",
    
    # Weather data
    "Weather_data": "Weather_data",
    
    # Forum container
    "forum": "forum"
}

# FIXED: Complete partition key mapping for all containers
PARTITION_KEY_MAPPING = {
    # Marketplace containers
    "marketplace_plants": "/category",
    "marketplace_conversations_new": "/id",  # CRITICAL FIX: use actual container name
    "marketplace_messages": "/conversationId",
    "marketplace_reviews": "/sellerId",
    "marketplace_wishlists": "/userId",
    "marketplace_rating": "/productId",
    
    # Business containers
    "business_users": "/id",
    "business_customers": "/businessId", 
    "business_transactions": "/businessId",
    "business_staff": "/businessId",
    "inventory": "/businessId",
    "orders": "/businessId",
    "watering_notifications": "/businessId",
    
    # User containers  
    "users": "/id",
    "Users": "/id",
    
    # Authentication and preferences
    "authentication": "/userId",
    "Preferences": "/userId",
    
    # Notification containers
    "notifications": "/userId",
    "notification_history": "/userId",
    
    # Product and rating containers
    "product_rating": "/productId",
    
    # AI and chat containers
    "plant-care-chat": "/userId",
    
    # Weather data
    "Weather_data": "/location",
    
    # Forum container
    "forum": "/category"
}

def get_database_client():
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
        
        # Test connection
        database.read()
        
        # Cache the database client
        _db_clients['main'] = database
        
        logging.info(f"✅ Connected to main database: {database_name}")
        return database
    except Exception as e:
        logging.error(f"❌ Failed to initialize main database: {str(e)}")
        raise

def get_marketplace_db_client():
    """Get a connection to the marketplace database."""
    global _db_clients
    
    try:
        # Check if we already have a connection
        if 'marketplace' in _db_clients:
            return _db_clients['marketplace']
            
        # Get connection details from environment variables
        connection_string = os.environ.get("COSMOSDB__MARKETPLACE_CONNECTION_STRING")
        database_name = os.environ.get("COSMOSDB_MARKETPLACE_DATABASE_NAME", "greener-marketplace-db")
        
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
            connection_parts = dict(param.split('=', 1) for param in connection_string.split(';') if '=' in param)
            account_endpoint = connection_parts.get('AccountEndpoint')
            account_key = connection_parts.get('AccountKey')
            
            if not account_endpoint or not account_key:
                raise ValueError("Invalid connection string format for marketplace database")
            
            # Create the client
            client = CosmosClient(account_endpoint, credential=account_key)
            database = client.get_database_client(database_name)
        
        # Test connection
        database.read()
        
        # Cache the database client
        _db_clients['marketplace'] = database
        
        logging.info(f"✅ Connected to marketplace database: {database_name}")
        return database
    except Exception as e:
        logging.error(f"❌ Failed to initialize marketplace database: {str(e)}")
        raise

def get_container(container_name):
    """
    COMPLETELY FIXED: Get container with comprehensive error handling and auto-creation.
    """
    try:
        # Normalize container name using mapping
        actual_container_name = CONTAINER_NAME_MAPPING.get(container_name, container_name)
        
        # Check cache first
        cache_key = f"{container_name}_{actual_container_name}"
        if cache_key in _container_cache:
            return _container_cache[cache_key]
        
        # Determine which database to use based on container type
        if (container_name.startswith('marketplace') or 
            actual_container_name.startswith('marketplace') or
            container_name in ['users', 'inventory', 'business_users', 'business_customers', 
                              'business_transactions', 'orders', 'watering_notifications', 'forum']):
            database = get_marketplace_db_client()
            logging.info(f"🔗 Using marketplace database for container: {actual_container_name}")
        else:
            database = get_database_client()
            logging.info(f"🔗 Using main database for container: {actual_container_name}")
        
        # Get container client with comprehensive error handling
        try:
            container_client = database.get_container_client(actual_container_name)
            
            # Test container accessibility
            container_client.read()
            
            # Cache the container client
            _container_cache[cache_key] = container_client
            
            logging.info(f"✅ Successfully connected to existing container: {actual_container_name}")
            return container_client
            
        except exceptions.CosmosResourceNotFoundError:
            # Container doesn't exist, try to create it
            logging.warning(f"⚠️ Container {actual_container_name} not found, attempting to create...")
            
            # Get partition key for this container
            partition_key_path = PARTITION_KEY_MAPPING.get(actual_container_name, "/id")
            partition_key = PartitionKey(path=partition_key_path)
            
            try:
                container_client = database.create_container(
                    id=actual_container_name,
                    partition_key=partition_key,
                    offer_throughput=400  # Minimum throughput
                )
                
                # Cache the new container client
                _container_cache[cache_key] = container_client
                
                logging.info(f"✅ Created and connected to new container: {actual_container_name} with partition key: {partition_key_path}")
                return container_client
                
            except exceptions.CosmosHttpResponseError as create_error:
                if create_error.status_code == 409:  # Container already exists (race condition)
                    logging.info(f"ℹ️ Container {actual_container_name} was created by another process, retrying connection...")
                    # Try to get the container again
                    container_client = database.get_container_client(actual_container_name)
                    container_client.read()  # Test accessibility
                    _container_cache[cache_key] = container_client
                    return container_client
                else:
                    logging.error(f"❌ Failed to create container {actual_container_name}: {str(create_error)}")
                    raise
            except Exception as create_error:
                logging.error(f"❌ Unexpected error creating container {actual_container_name}: {str(create_error)}")
                raise
                
        except exceptions.CosmosHttpResponseError as http_error:
            logging.error(f"❌ HTTP error accessing container {actual_container_name}: {http_error.status_code} - {str(http_error)}")
            raise
        except Exception as unexpected_error:
            logging.error(f"❌ Unexpected error accessing container {actual_container_name}: {str(unexpected_error)}")
            raise
        
    except Exception as e:
        logging.error(f"❌ Failed to get container {container_name} -> {actual_container_name}: {str(e)}")
        
        # Clear cache for this container to allow retry
        cache_key = f"{container_name}_{actual_container_name}"
        if cache_key in _container_cache:
            del _container_cache[cache_key]
        
        raise

def get_main_container(container_name):
    """Get a specific container from the main Greener database."""
    try:
        # Get container name from environment variables or use default
        env_var_name = f"COSMOS_CONTAINER_{container_name.upper()}"
        actual_container_name = os.environ.get(env_var_name, container_name)
        
        database = get_database_client()
        
        try:
            container_client = database.get_container_client(actual_container_name)
            # Test accessibility
            container_client.read()
            return container_client
        except exceptions.CosmosResourceNotFoundError:
            logging.error(f"❌ Main container {actual_container_name} not found")
            raise
        except Exception as e:
            logging.error(f"❌ Error accessing main container {actual_container_name}: {str(e)}")
            raise
            
    except Exception as e:
        logging.error(f"❌ Failed to get main container {container_name}: {str(e)}")
        raise

def get_marketplace_container(container_name):
    """Get a specific container from the marketplace database with auto-creation."""
    try:
        # Normalize container name
        actual_container_name = CONTAINER_NAME_MAPPING.get(container_name, container_name)
        
        database = get_marketplace_db_client()
        
        try:
            container_client = database.get_container_client(actual_container_name)
            # Test accessibility
            container_client.read()
            return container_client
        except exceptions.CosmosResourceNotFoundError:
            logging.warning(f"⚠️ Marketplace container {actual_container_name} not found, creating...")
            
            # Try to create container with proper partition key
            partition_key_path = PARTITION_KEY_MAPPING.get(actual_container_name, "/id")
            partition_key = PartitionKey(path=partition_key_path)
            
            container_client = database.create_container(
                id=actual_container_name,
                partition_key=partition_key,
                offer_throughput=400
            )
            
            logging.info(f"✅ Created marketplace container: {actual_container_name}")
            return container_client
        except Exception as e:
            logging.error(f"❌ Error accessing marketplace container {actual_container_name}: {str(e)}")
            raise
            
    except Exception as e:
        logging.error(f"❌ Failed to get marketplace container {container_name}: {str(e)}")
        raise

def clear_container_cache():
    """Clear the container cache - useful for testing or error recovery."""
    global _container_cache
    _container_cache.clear()
    logging.info("🧹 Container cache cleared")

def get_container_info(container_name):
    """Get information about a container without connecting to it."""
    actual_container_name = CONTAINER_NAME_MAPPING.get(container_name, container_name)
    partition_key_path = PARTITION_KEY_MAPPING.get(actual_container_name, "/id")
    
    database_type = "marketplace" if (
        container_name.startswith('marketplace') or 
        actual_container_name.startswith('marketplace') or
        container_name in ['users', 'inventory', 'business_users', 'business_customers', 
                          'business_transactions', 'orders', 'watering_notifications', 'forum']
    ) else "main"
    
    return {
        "requested_name": container_name,
        "actual_name": actual_container_name,
        "partition_key": partition_key_path,
        "database_type": database_type,
        "is_cached": f"{container_name}_{actual_container_name}" in _container_cache
    }

def test_database_connections():
    """Test both database connections and return detailed status."""
    status = {
        "main_db": {"connected": False, "error": None, "database_name": None},
        "marketplace_db": {"connected": False, "error": None, "database_name": None}
    }
    
    # Test main database
    try:
        main_db = get_database_client()
        main_db.read()
        status["main_db"]["connected"] = True
        status["main_db"]["database_name"] = os.environ.get("COSMOS_DATABASE_NAME", "GreenerDB")
        logging.info("✅ Main database connection: OK")
    except Exception as e:
        status["main_db"]["error"] = str(e)
        logging.error(f"❌ Main database connection failed: {str(e)}")
    
    # Test marketplace database
    try:
        marketplace_db = get_marketplace_db_client()
        marketplace_db.read()
        status["marketplace_db"]["connected"] = True
        status["marketplace_db"]["database_name"] = os.environ.get("COSMOSDB_MARKETPLACE_DATABASE_NAME", "greener-marketplace-db")
        logging.info("✅ Marketplace database connection: OK")
    except Exception as e:
        status["marketplace_db"]["error"] = str(e)
        logging.error(f"❌ Marketplace database connection failed: {str(e)}")
    
    return status

def reset_connections():
    """Reset all database connections and clear caches - useful for error recovery."""
    global _db_clients, _container_cache
    _db_clients.clear()
    _container_cache.clear()
    logging.info("🔄 All database connections and caches reset")