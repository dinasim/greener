# backend/send-message/__init__.py
import logging
import json
import azure.functions as func
from shared.marketplace.db_client import get_container
import uuid
from datetime import datetime

def add_cors_headers(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS, PUT, PATCH, DELETE'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type,Authorization,X-User-Email'
    return response

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Python HTTP trigger function for sending a message processed a request.')
    
    # Handle OPTIONS method for CORS preflight
    if req.method == 'OPTIONS':
        response = func.HttpResponse()
        return add_cors_headers(response)
    
    try:
        # Get request body
        request_body = req.get_json()
        
        # Validate required fields
        if not request_body:
            error_response = func.HttpResponse(
                body=json.dumps({"error": "Request body is required"}),
                mimetype="application/json",
                status_code=400
            )
            return add_cors_headers(error_response)
        
        chat_id = request_body.get('chatId')
        message_text = request_body.get('message')
        sender_id = request_body.get('senderId')
        
        if not chat_id:
            error_response = func.HttpResponse(
                body=json.dumps({"error": "Chat ID is required"}),
                mimetype="application/json",
                status_code=400
            )
            return add_cors_headers(error_response)
        
        if not message_text:
            error_response = func.HttpResponse(
                body=json.dumps({"error": "Message text is required"}),
                mimetype="application/json",
                status_code=400
            )
            return add_cors_headers(error_response)
        
        if not sender_id:
            error_response = func.HttpResponse(
                body=json.dumps({"error": "Sender ID is required"}),
                mimetype="application/json",
                status_code=400
            )
            return add_cors_headers(error_response)
        
        # Add the message to the messages container
        messages_container = get_container("marketplace-messages")
        
        message_id = str(uuid.uuid4())
        current_time = datetime.utcnow().isoformat()
        
        message = {
            "id": message_id,
            "conversationId": chat_id,
            "senderId": sender_id,
            "text": message_text,
            "timestamp": current_time,
            "status": {
                "delivered": True,
                "read": False,
                "readAt": None
            }
        }
        
        messages_container.create_item(body=message)
        
        # Return success response with CORS headers
        response = func.HttpResponse(
            body=json.dumps({
                "success": True,
                "messageId": message_id,
                "timestamp": current_time,
                "sender": sender_id
            }, default=str),
            mimetype="application/json",
            status_code=201
        )
        return add_cors_headers(response)
    
    except Exception as e:
        logging.error(f"Error sending message: {str(e)}")
        
        # Return error response with CORS headers
        error_response = func.HttpResponse(
            body=json.dumps({"error": str(e)}),
            mimetype="application/json",
            status_code=500
        )
        return add_cors_headers(error_response)