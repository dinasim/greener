# read-message/__init__.py - FIXED VERSION with correct container names
import logging
import json
import azure.functions as func
from db_helpers import get_container
from http_helpers import add_cors_headers, handle_options_request, create_error_response, create_success_response, extract_user_id
from datetime import datetime

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Python HTTP trigger function for marking messages as read processed a request.')
    
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
        message_ids = request_body.get('messageIds', [])
        
        if not conversation_id:
            return create_error_response("Conversation ID is required", 400)
            
        # Get user ID for marking messages as read
        user_id = extract_user_id(req)
        
        if not user_id:
            return create_error_response("User ID is required", 400)
        
        # FIXED: Access the messages container with correct name
        messages_container = get_container("marketplace_messages")  # FIXED: was "marketplace-messages"
        
        # Query for messages that need to be marked as read
        if message_ids and len(message_ids) > 0:
            # Mark specific messages as read
            for message_id in message_ids:
                try:
                    # First try to read the message directly
                    message = messages_container.read_item(item=message_id, partition_key=conversation_id)
                    
                    # Only mark as read if the message is not from the current user
                    if message.get('senderId') != user_id:
                        if 'status' not in message:
                            message['status'] = {}
                        
                        message['status']['read'] = True
                        message['status']['readAt'] = datetime.utcnow().isoformat()
                        
                        messages_container.replace_item(item=message_id, body=message)
                except Exception as e:
                    logging.warning(f"Error marking message {message_id} as read: {str(e)}")
                    # Fallback to querying
                    query = "SELECT * FROM c WHERE c.id = @id AND c.conversationId = @conversationId"
                    parameters = [
                        {"name": "@id", "value": message_id},
                        {"name": "@conversationId", "value": conversation_id}
                    ]
                    
                    messages = list(messages_container.query_items(
                        query=query,
                        parameters=parameters,
                        enable_cross_partition_query=True
                    ))
                    
                    if messages:
                        message = messages[0]
                        
                        # Only mark as read if the message is not from the current user
                        if message.get('senderId') != user_id:
                            if 'status' not in message:
                                message['status'] = {}
                            
                            message['status']['read'] = True
                            message['status']['readAt'] = datetime.utcnow().isoformat()
                            
                            messages_container.replace_item(item=message_id, body=message)
        else:
            # Mark all unread messages in the conversation as read
            query = "SELECT * FROM c WHERE c.conversationId = @conversationId AND c.senderId != @userId AND (NOT IS_DEFINED(c.status.read) OR c.status.read = false)"
            parameters = [
                {"name": "@conversationId", "value": conversation_id},
                {"name": "@userId", "value": user_id}
            ]
            
            unread_messages = list(messages_container.query_items(
                query=query,
                parameters=parameters,
                enable_cross_partition_query=True
            ))
            
            for message in unread_messages:
                if 'status' not in message:
                    message['status'] = {}
                
                message['status']['read'] = True
                message['status']['readAt'] = datetime.utcnow().isoformat()
                
                messages_container.replace_item(item=message['id'], body=message)
        
        # Reset unread count in the conversation
        try:
            # FIXED: Use correct container name
            conversations_container = get_container("marketplace_conversations_new")  # Already correct
            
            # First try to read the conversation directly
            try:
                conversation = conversations_container.read_item(item=conversation_id, partition_key=conversation_id)
                
                # Reset unread count for the current user
                if 'unreadCounts' in conversation and user_id in conversation['unreadCounts']:
                    conversation['unreadCounts'][user_id] = 0
                    
                    conversations_container.replace_item(item=conversation_id, partition_key=conversation_id, body=conversation)
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
                
                if conversations:
                    conversation = conversations[0]
                    
                    # Reset unread count for the current user
                    if 'unreadCounts' in conversation and user_id in conversation['unreadCounts']:
                        conversation['unreadCounts'][user_id] = 0
                        
                        conversations_container.replace_item(item=conversation_id, body=conversation)
        except Exception as e:
            logging.warning(f"Error updating conversation unread count: {str(e)}")
        
        # Return success response
        return create_success_response({
            "success": True,
            "message": "Messages marked as read"
        })
    
    except Exception as e:
        logging.error(f"Error marking messages as read: {str(e)}")
        return create_error_response(str(e), 500)