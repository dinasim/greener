# Fixed get-messages/__init__.py
import logging
import json
import azure.functions as func
from db_helpers import get_container 
from http_helpers import add_cors_headers, handle_options_request, create_error_response, create_success_response, extract_user_id
from datetime import datetime

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Python HTTP trigger function for getting messages processed a request.')
    
    # Handle OPTIONS method for CORS preflight
    if req.method == 'OPTIONS':
        return handle_options_request()
    
    try:
        # Get chat ID from route parameters
        chat_id = req.route_params.get('chatId')
        
        if not chat_id:
            return create_error_response("Chat ID is required", 400)
        
        # Get user ID to mark messages as read
        user_id = extract_user_id(req) 
        
        if not user_id:
            return create_error_response("User ID is required", 400)
        
        logging.info(f"Getting messages for conversation {chat_id} for user {user_id}")
        
        # Access the marketplace-messages container
        messages_container = get_container("marketplace-messages")
        
        # Build the query
        query = "SELECT * FROM c WHERE c.conversationId = @chatId ORDER BY c.timestamp ASC"
        parameters = [{"name": "@chatId", "value": chat_id}]
        
        logging.info(f"Executing message query: {query}")
        logging.info(f"With parameters: {parameters}")
        
        # Execute query
        messages = list(messages_container.query_items(
            query=query,
            parameters=parameters,
            enable_cross_partition_query=True
        ))
        
        logging.info(f"Found {len(messages)} messages")
        
        # Try to mark messages as read
        try:
            if len(messages) > 0:
                conversations_container = get_container("marketplace-conversations")
                
                # First try to read the conversation with conversation ID as partition key
                try:
                    conversation = conversations_container.read_item(item=chat_id, partition_key=chat_id)
                    logging.info(f"Successfully read conversation using id as partition key")
                except Exception as direct_read_error:
                    logging.warning(f"Error reading conversation directly: {str(direct_read_error)}")
                    
                    # Fall back to querying by ID
                    conversation_query = "SELECT * FROM c WHERE c.id = @id"
                    conversation_params = [{"name": "@id", "value": chat_id}]
                    
                    conversations = list(conversations_container.query_items(
                        query=conversation_query,
                        parameters=conversation_params,
                        enable_cross_partition_query=True
                    ))
                    
                    if conversations:
                        conversation = conversations[0]
                        logging.info(f"Found conversation by query")
                    else:
                        raise Exception("Conversation not found by query")
                
                # Reset unread count for the current user
                if 'unreadCounts' in conversation and user_id in conversation['unreadCounts']:
                    conversation['unreadCounts'][user_id] = 0
                    
                    # Update the conversation with id as partition key
                    try:
                        conversations_container.replace_item(
                            item=chat_id, 
                            partition_key=chat_id,
                            body=conversation
                        )
                        logging.info(f"Updated unread counts for {user_id}")
                    except Exception as update_error:
                        logging.warning(f"Error updating conversation: {str(update_error)}")
                        # Try again without explicit partition key
                        try:
                            conversations_container.replace_item(
                                item=chat_id,
                                body=conversation
                            )
                            logging.info(f"Updated unread counts without explicit partition key")
                        except Exception as retry_error:
                            logging.warning(f"Could not update unread counts: {str(retry_error)}")

                # Mark messages as read if they are not from the current user
                unread_messages = [msg for msg in messages if msg.get('senderId') != user_id and not msg.get('status', {}).get('read', False)]
                
                for msg in unread_messages:
                    if 'status' not in msg:
                        msg['status'] = {}
                    
                    msg['status']['read'] = True
                    msg['status']['readAt'] = datetime.utcnow().isoformat()
                    
                    try:
                        messages_container.replace_item(item=msg['id'], body=msg)
                        logging.info(f"Marked message {msg['id']} as read")
                    except Exception as msg_error:
                        logging.warning(f"Could not mark message {msg['id']} as read: {str(msg_error)}")
                        # Continue even if marking as read fails
        except Exception as e:
            logging.warning(f"Error processing read status: {str(e)}")
            # Continue even if marking as read fails
        
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
        
        # Return success response
        return create_success_response({
            "messages": formatted_messages,
            "conversation": {
                "id": chat_id
            }
        })
    
    except Exception as e:
        logging.error(f"Error getting messages: {str(e)}")
        return create_error_response(str(e), 500)