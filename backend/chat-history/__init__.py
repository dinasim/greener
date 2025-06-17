import azure.functions as func
import logging
import json
from azure.cosmos import CosmosClient, exceptions
import os
from datetime import datetime

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Chat History function processed a request.')
    
    try:
        # Get the request method
        method = req.method
        
        if method == 'GET':
            return get_chat_history(req)
        elif method == 'POST':
            return save_chat_messages(req)
        elif method == 'DELETE':
            return delete_chat_history(req)
        else:
            return func.HttpResponse(
                json.dumps({"error": "Method not supported"}),
                status_code=405,
                headers={"Content-Type": "application/json"}
            )
            
    except Exception as e:
        logging.error(f"Unexpected error in chat-history function: {str(e)}")
        return func.HttpResponse(
            json.dumps({"error": "Internal server error", "details": str(e)}),
            status_code=500,
            headers={"Content-Type": "application/json"}
        )

def get_cosmos_client():
    """Get a Cosmos DB client using the marketplace connection string"""
    try:
        connection_string = os.environ.get('COSMOSDB__MARKETPLACE_CONNECTION_STRING')
        if not connection_string:
            logging.error("COSMOSDB__MARKETPLACE_CONNECTION_STRING not found in environment variables")
            return None
        
        return CosmosClient.from_connection_string(connection_string)
    except Exception as e:
        logging.error(f"Error creating Cosmos DB client: {str(e)}")
        return None

def get_chat_history(req: func.HttpRequest) -> func.HttpResponse:
    """Get chat history for a specific session"""
    try:
        # Get session ID from route or query params
        session_id = req.route_params.get('sessionId') or req.params.get('sessionId')
        if not session_id:
            return func.HttpResponse(
                json.dumps({"error": "Session ID is required"}),
                status_code=400,
                headers={"Content-Type": "application/json"}
            )
        
        # Get limit parameter from query string
        limit_str = req.params.get('limit', '50')
        try:
            limit = int(limit_str)
        except ValueError:
            limit = 50  # Default if invalid limit provided
        
        # Connect to Cosmos DB
        client = get_cosmos_client()
        if not client:
            return func.HttpResponse(
                json.dumps({"error": "Failed to connect to database"}),
                status_code=500,
                headers={"Content-Type": "application/json"}
            )
        
        # Get database and container
        database_name = os.environ.get('COSMOSDB_MARKETPLACE_DATABASE_NAME', 'greener-marketplace-db')
        container_name = "plant-care-chat"
        
        database = client.get_database_client(database_name)
        container = database.get_container_client(container_name)
        
        # Query for messages from this session, ordered by timestamp
        query = f"SELECT * FROM c WHERE c.sessionId = '{session_id}' ORDER BY c.timestamp"
        items = list(container.query_items(query=query, max_item_count=limit))
        
        # Format the messages for the frontend
        messages = []
        for item in items:
            # Format depends on message type
            if item.get('messageType') == 'user_message':
                messages.append({
                    'id': item.get('id'),
                    'text': item.get('message', ''),
                    'isUser': True,
                    'timestamp': item.get('timestamp')
                })
            elif item.get('messageType') == 'ai_response':
                messages.append({
                    'id': item.get('id'),
                    'text': item.get('message', ''),
                    'isUser': False,
                    'timestamp': item.get('timestamp'),
                    'confidence': item.get('confidence'),
                    'sources': item.get('sources', [])
                })
        
        return func.HttpResponse(
            json.dumps(messages),
            status_code=200,
            headers={"Content-Type": "application/json"}
        )
        
    except exceptions.CosmosHttpResponseError as e:
        logging.error(f"Cosmos DB error retrieving chat history: {str(e)}")
        return func.HttpResponse(
            json.dumps({"error": "Database error", "details": str(e)}),
            status_code=500,
            headers={"Content-Type": "application/json"}
        )
    except Exception as e:
        logging.error(f"Error retrieving chat history: {str(e)}")
        return func.HttpResponse(
            json.dumps({"error": "Failed to retrieve chat history", "details": str(e)}),
            status_code=500,
            headers={"Content-Type": "application/json"}
        )

def save_chat_messages(req: func.HttpRequest) -> func.HttpResponse:
    """Save chat messages to Cosmos DB"""
    try:
        # Get request body
        req_body = req.get_json()
        if not req_body:
            return func.HttpResponse(
                json.dumps({"error": "Request body is required"}),
                status_code=400,
                headers={"Content-Type": "application/json"}
            )
        
        session_id = req_body.get('sessionId')
        messages = req_body.get('messages', [])
        
        if not session_id:
            return func.HttpResponse(
                json.dumps({"error": "Session ID is required"}),
                status_code=400,
                headers={"Content-Type": "application/json"}
            )
            
        if not messages or not isinstance(messages, list):
            return func.HttpResponse(
                json.dumps({"error": "Messages must be a non-empty array"}),
                status_code=400,
                headers={"Content-Type": "application/json"}
            )
            
        # Connect to Cosmos DB
        client = get_cosmos_client()
        if not client:
            return func.HttpResponse(
                json.dumps({"error": "Failed to connect to database"}),
                status_code=500,
                headers={"Content-Type": "application/json"}
            )
        
        # Get database and container
        database_name = os.environ.get('COSMOSDB_MARKETPLACE_DATABASE_NAME', 'greener-marketplace-db')
        container_name = "plant-care-chat"
        
        database = client.get_database_client(database_name)
        container = database.get_container_client(container_name)
        
        # First check for existing messages from this session 
        # to avoid duplicates
        query = f"SELECT c.id FROM c WHERE c.sessionId = '{session_id}'"
        existing_ids = set(item['id'] for item in container.query_items(query=query, enable_cross_partition_query=True))
        
        # Store each message
        success_count = 0
        for message in messages:
            try:
                # Skip messages that already exist in the database
                if message.get('id') in existing_ids:
                    continue
                    
                timestamp = message.get('timestamp') or datetime.utcnow().isoformat()
                
                # Format for user message
                if message.get('isUser'):
                    doc = {
                        'id': message.get('id'),
                        'sessionId': session_id, 
                        'messageType': 'user_message',
                        'message': message.get('text', ''),
                        'timestamp': timestamp
                    }
                else:
                    # Format for AI response
                    doc = {
                        'id': message.get('id'),
                        'sessionId': session_id,
                        'messageType': 'ai_response',
                        'message': message.get('text', ''),
                        'confidence': message.get('confidence', 0),
                        'sources': message.get('sources', []),
                        'timestamp': timestamp
                    }
                
                # Store in Cosmos DB
                container.create_item(body=doc)
                success_count += 1
                
            except Exception as e:
                logging.error(f"Error storing message {message.get('id')}: {str(e)}")
                continue
        
        return func.HttpResponse(
            json.dumps({
                "success": True,
                "savedCount": success_count,
                "totalMessages": len(messages)
            }),
            status_code=200,
            headers={"Content-Type": "application/json"}
        )
        
    except exceptions.CosmosHttpResponseError as e:
        logging.error(f"Cosmos DB error saving chat messages: {str(e)}")
        return func.HttpResponse(
            json.dumps({"error": "Database error", "details": str(e)}),
            status_code=500,
            headers={"Content-Type": "application/json"}
        )
    except Exception as e:
        logging.error(f"Error saving chat messages: {str(e)}")
        return func.HttpResponse(
            json.dumps({"error": "Failed to save chat messages", "details": str(e)}),
            status_code=500,
            headers={"Content-Type": "application/json"}
        )

def delete_chat_history(req: func.HttpRequest) -> func.HttpResponse:
    """Delete chat history for a specific session"""
    try:
        # Get session ID from route params or query params
        session_id = req.route_params.get('sessionId') or req.params.get('sessionId')
        if not session_id:
            return func.HttpResponse(
                json.dumps({"error": "Session ID is required"}),
                status_code=400,
                headers={"Content-Type": "application/json"}
            )
        
        # Connect to Cosmos DB
        client = get_cosmos_client()
        if not client:
            return func.HttpResponse(
                json.dumps({"error": "Failed to connect to database"}),
                status_code=500,
                headers={"Content-Type": "application/json"}
            )
        
        # Get database and container
        database_name = os.environ.get('COSMOSDB_MARKETPLACE_DATABASE_NAME', 'greener-marketplace-db')
        container_name = "plant-care-chat"
        
        database = client.get_database_client(database_name)
        container = database.get_container_client(container_name)
        
        # Find all messages for this session
        query = f"SELECT c.id FROM c WHERE c.sessionId = '{session_id}'"
        items_to_delete = list(container.query_items(query=query, enable_cross_partition_query=True))
        
        # Delete each message
        deleted_count = 0
        for item in items_to_delete:
            try:
                container.delete_item(item=item['id'], partition_key=session_id)
                deleted_count += 1
            except Exception as e:
                logging.error(f"Error deleting message {item['id']}: {str(e)}")
                continue
        
        return func.HttpResponse(
            json.dumps({
                "success": True,
                "deletedCount": deleted_count,
                "totalMessages": len(items_to_delete)
            }),
            status_code=200,
            headers={"Content-Type": "application/json"}
        )
        
    except exceptions.CosmosHttpResponseError as e:
        logging.error(f"Cosmos DB error deleting chat history: {str(e)}")
        return func.HttpResponse(
            json.dumps({"error": "Database error", "details": str(e)}),
            status_code=500,
            headers={"Content-Type": "application/json"}
        )
    except Exception as e:
        logging.error(f"Error deleting chat history: {str(e)}")
        return func.HttpResponse(
            json.dumps({"error": "Failed to delete chat history", "details": str(e)}),
            status_code=500,
            headers={"Content-Type": "application/json"}
        )