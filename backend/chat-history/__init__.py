import azure.functions as func
import logging
import json
from azure.cosmos import CosmosClient, exceptions
import os
from datetime import datetime

DB_ENV = 'COSMOSDB_MARKETPLACE_DATABASE_NAME'
DEFAULT_DB = 'greener-marketplace-db'
CONTAINER_NAME = 'plant-care-chat'

CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Content-Type": "application/json"
}

def _resp(payload, status=200, extra_headers=None):
    headers = dict(CORS_HEADERS)
    if extra_headers:
        headers.update(extra_headers)
    body = payload if isinstance(payload, str) else json.dumps(payload)
    return func.HttpResponse(body, status_code=status, headers=headers)

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Chat History function processed a request.')
    try:
        method = req.method.upper()

        # CORS preflight
        if method == 'OPTIONS':
            return func.HttpResponse(status_code=204, headers=CORS_HEADERS)

        if method == 'GET':
            return get_chat_history(req)
        elif method == 'POST':
            return save_chat_messages(req)
        elif method == 'DELETE':
            return delete_chat_history(req)
        else:
            return _resp({"error": "Method not supported"}, status=405)

    except Exception as e:
        logging.error(f"Unexpected error in chat-history function: {str(e)}")
        return _resp({"error": "Internal server error", "details": str(e)}, status=500)

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

def _get_container(client: CosmosClient):
    db_name = os.environ.get(DB_ENV, DEFAULT_DB)
    database = client.get_database_client(db_name)
    return database.get_container_client(CONTAINER_NAME)

def get_chat_history(req: func.HttpRequest) -> func.HttpResponse:
    """Get chat history for a specific session"""
    try:
        # Get session ID from route or query params
        session_id = (req.route_params.get('sessionId') or req.params.get('sessionId') or '').strip()
        if not session_id:
            return _resp({"error": "Session ID is required"}, status=400)

        # limit
        limit_str = req.params.get('limit', '50')
        try:
            limit = max(1, int(limit_str))
        except ValueError:
            limit = 50

        # Connect to Cosmos DB
        client = get_cosmos_client()
        if not client:
            return _resp({"error": "Failed to connect to database"}, status=500)

        container = _get_container(client)

        # Parameterized, partition-scoped query (ORDER BY supported within a single partition)
        query = "SELECT * FROM c WHERE c.sessionId = @sid ORDER BY c.timestamp"
        params = [{"name": "@sid", "value": session_id}]

        items_iter = container.query_items(
            query=query,
            parameters=params,
            partition_key=session_id,       # ← key fix
            max_item_count=min(limit, 100)  # page size hint
        )

        # Respect `limit` without fetching entire iterator
        messages = []
        for item in items_iter:
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
            if len(messages) >= limit:
                break

        return _resp(messages, status=200)

    except exceptions.CosmosHttpResponseError as e:
        logging.error(f"Cosmos DB error retrieving chat history: {str(e)}")
        return _resp({"error": "Database error", "details": str(e)}, status=500)
    except Exception as e:
        logging.error(f"Error retrieving chat history: {str(e)}")
        return _resp({"error": "Failed to retrieve chat history", "details": str(e)}, status=500)

def save_chat_messages(req: func.HttpRequest) -> func.HttpResponse:
    """Save chat messages to Cosmos DB"""
    try:
        # Parse JSON safely
        try:
            req_body = req.get_json()
        except Exception as je:
            return _resp({"error": "Invalid JSON body", "details": str(je)}, status=400)

        session_id = (req_body or {}).get('sessionId', '').strip()
        messages = (req_body or {}).get('messages', [])

        if not session_id:
            return _resp({"error": "Session ID is required"}, status=400)
        if not messages or not isinstance(messages, list):
            return _resp({"error": "Messages must be a non-empty array"}, status=400)

        client = get_cosmos_client()
        if not client:
            return _resp({"error": "Failed to connect to database"}, status=500)

        container = _get_container(client)

        # Get existing IDs (partition-scoped)
        existing_ids = {
            item['id'] for item in container.query_items(
                query="SELECT c.id FROM c WHERE c.sessionId = @sid",
                parameters=[{"name": "@sid", "value": session_id}],
                partition_key=session_id
            )
        }

        success_count = 0
        for message in messages:
            try:
                if message.get('id') in existing_ids:
                    continue

                timestamp = message.get('timestamp') or datetime.utcnow().isoformat()

                if message.get('isUser'):
                    doc = {
                        'id': message.get('id'),
                        'sessionId': session_id,
                        'messageType': 'user_message',
                        'message': message.get('text', ''),
                        'timestamp': timestamp
                    }
                else:
                    doc = {
                        'id': message.get('id'),
                        'sessionId': session_id,
                        'messageType': 'ai_response',
                        'message': message.get('text', ''),
                        'confidence': message.get('confidence', 0),
                        'sources': message.get('sources', []),
                        'timestamp': timestamp
                    }

                container.create_item(body=doc, partition_key=session_id)  # explicit PK
                success_count += 1

            except Exception as e:
                logging.error(f"Error storing message {message.get('id')}: {str(e)}")
                continue

        return _resp({
            "success": True,
            "savedCount": success_count,
            "totalMessages": len(messages)
        }, status=200)

    except exceptions.CosmosHttpResponseError as e:
        logging.error(f"Cosmos DB error saving chat messages: {str(e)}")
        return _resp({"error": "Database error", "details": str(e)}, status=500)
    except Exception as e:
        logging.error(f"Error saving chat messages: {str(e)}")
        return _resp({"error": "Failed to save chat messages", "details": str(e)}, status=500)

def delete_chat_history(req: func.HttpRequest) -> func.HttpResponse:
    """Delete chat history for a specific session"""
    try:
        session_id = (req.route_params.get('sessionId') or req.params.get('sessionId') or '').strip()
        if not session_id:
            return _resp({"error": "Session ID is required"}, status=400)

        client = get_cosmos_client()
        if not client:
            return _resp({"error": "Failed to connect to database"}, status=500)

        container = _get_container(client)

        # Fetch ids within the partition
        items_to_delete = list(container.query_items(
            query="SELECT c.id FROM c WHERE c.sessionId = @sid",
            parameters=[{"name": "@sid", "value": session_id}],
            partition_key=session_id
        ))

        deleted_count = 0
        for item in items_to_delete:
            try:
                container.delete_item(item=item['id'], partition_key=session_id)
                deleted_count += 1
            except Exception as e:
                logging.error(f"Error deleting message {item['id']}: {str(e)}")
                continue

        return _resp({
            "success": True,
            "deletedCount": deleted_count,
            "totalMessages": len(items_to_delete)
        }, status=200)

    except exceptions.CosmosHttpResponseError as e:
        logging.error(f"Cosmos DB error deleting chat history: {str(e)}")
        return _resp({"error": "Database error", "details": str(e)}, status=500)
    except Exception as e:
        logging.error(f"Error deleting chat history: {str(e)}")
        return _resp({"error": "Failed to delete chat history", "details": str(e)}, status=500)
