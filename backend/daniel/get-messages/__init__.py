# backend/get-messages/__init__.py
import logging
import json
import azure.functions as func
from shared.marketplace.db_client import get_container
from datetime import datetime

def add_cors_headers(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS, PUT, PATCH, DELETE'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type,Authorization,X-User-Email'
    return response

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Python HTTP trigger function for getting messages processed a request.')
    
    # Handle OPTIONS method for CORS preflight
    if req.method == 'OPTIONS':
        response = func.HttpResponse()
        return add_cors_headers(response)
    
    try:
        # Get chat ID from route parameters
        chat_id = req.route_params.get('chatId')
        
        if not chat_id:
            error_response = func.HttpResponse(
                body=json.dumps({"error": "Chat ID is required"}),
                mimetype="application/json",
                status_code=400
            )
            return add_cors_headers(error_response)
        
        # Get user ID to mark messages as read
        user_id = req.params.get('userId') 
        
        if not user_id:
            error_response = func.HttpResponse(
                body=json.dumps({"error": "User ID is required"}),
                mimetype="application/json",
                status_code=400
            )
            return add_cors_headers(error_response)
        
        # Access the marketplace-messages container
        messages_container = get_container("marketplace-messages")
        
        # Build the query
        query = "SELECT * FROM c WHERE c.conversationId = @chatId ORDER BY c.timestamp ASC"
        parameters = [{"name": "@chatId", "value": chat_id}]
        
        # Execute query
        messages = list(messages_container.query_items(
            query=query,
            parameters=parameters,
            enable_cross_partition_query=True
        ))
        
        # Format the response
        formatted_messages = []
        for msg in messages:
            formatted_messages.append({
                "id": msg.get('id'),
                "senderId": msg.get('senderId'),
                "text": msg.get('text'),
                "timestamp": msg.get('timestamp'),
                "status": msg.get('status', {})
            })
        
        # Return success response with CORS headers
        response = func.HttpResponse(
            body=json.dumps({
                "messages": formatted_messages,
                "conversation": {
                    "id": chat_id
                }
            }, default=str),
            mimetype="application/json",
            status_code=200
        )
        return add_cors_headers(response)
    
    except Exception as e:
        logging.error(f"Error getting messages: {str(e)}")
        
        # Return error response with CORS headers
        error_response = func.HttpResponse(
            body=json.dumps({"error": str(e)}),
            mimetype="application/json",
            status_code=500
        )
        return add_cors_headers(error_response)