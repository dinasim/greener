# Backend: /backend/typing-indicator/__init__.py

import logging
import json
import azure.functions as func
from db_helpers import get_container
from http_helpers import add_cors_headers, handle_options_request, create_error_response, create_success_response, extract_user_id
from datetime import datetime

def main(req: func.HttpRequest, signalRMessages: func.Out[str]) -> func.HttpResponse:
    logging.info('Python HTTP trigger function for typing indicator processed a request.')
    
    # Handle OPTIONS method for CORS preflight
    if req.method == 'OPTIONS':
        return handle_options_request()
    
    try:
        # Get request body
        request_body = req.get_json()
        
        # Validate required fields
        if not request_body:
            return create_error_response("Request body is required", 400)
        
        conversation_id = request_body.get('conversationId')
        is_typing = request_body.get('isTyping', False)
        
        if not conversation_id:
            return create_error_response("Conversation ID is required", 400)
            
        # Get user ID for the typing indicator
        user_id = extract_user_id(req)
        
        if not user_id:
            return create_error_response("User ID is required", 400)
        
        # Get the conversation to find the other participant
        try:
            conversations_container = get_container("marketplace_conversations_new")
            
            # First try to read the conversation directly
            try:
                conversation = conversations_container.read_item(item=conversation_id, partition_key=conversation_id)
            except Exception as e:
                logging.warning(f"Error reading conversation directly: {str(e)}")
                
                # Fallback to querying
                query = "SELECT * FROM c WHERE c.id = @id"
                parameters = [{"name": "@id", "value": conversation_id}]
                
                conversations = list(conversations_container.query_items(
                    query=query,
                    parameters=parameters,
                    enable_cross_partition_query=True
                ))
                
                if not conversations:
                    return create_error_response("Conversation not found", 404)
                    
                conversation = conversations[0]
            
            # Get the other participant
            participants = conversation.get('participants', [])
            other_user_id = next((p for p in participants if p != user_id), None)
            
            if not other_user_id:
                return create_error_response("Other participant not found", 404)
            
            # Send typing indicator via SignalR
            message = {
                'target': 'UserTyping' if is_typing else 'UserStoppedTyping',
                'arguments': [conversation_id, user_id]
            }
            
            # Send to specific user's group
            message['userId'] = other_user_id
            
            # Send the message
            signalRMessages.set(json.dumps(message))
            
            return create_success_response({
                "success": True,
                "message": f"Typing indicator {'sent' if is_typing else 'stopped'}"
            })
        
        except Exception as e:
            logging.error(f"Error processing typing indicator: {str(e)}")
            return create_error_response(str(e), 500)
    
    except Exception as e:
        logging.error(f"Error with typing indicator: {str(e)}")
        return create_error_response(str(e), 500)