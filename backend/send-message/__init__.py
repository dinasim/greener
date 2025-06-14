# send-message/__init__.py   marketplace file
import logging
import json
import azure.functions as func
from db_helpers import get_container
from http_helpers import add_cors_headers, handle_options_request, create_error_response, create_success_response, extract_user_id
from firebase_helpers import send_fcm_notification_to_user
import uuid
from datetime import datetime

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Python HTTP trigger function for sending a message processed a request.')
    
    # Handle OPTIONS method for CORS preflight
    if req.method == 'OPTIONS':
        return handle_options_request()
    
    try:
        # Get request body
        request_body = req.get_json()
        
        # Validate required fields
        if not request_body:
            return create_error_response("Request body is required", 400)
        
        chat_id = request_body.get('chatId')
        message_text = request_body.get('message')
        sender_id = request_body.get('senderId') or extract_user_id(req)
        
        if not chat_id:
            return create_error_response("Chat ID is required", 400)
        
        if not message_text:
            return create_error_response("Message text is required", 400)
        
        if not sender_id:
            return create_error_response("Sender ID is required", 400)
        
        # Get the conversation to update unread counts
        conversations_container = get_container("marketplace-conversations")
        
        try:
            # Get the conversation
            conversation = conversations_container.read_item(item=chat_id, partition_key=chat_id)
            
            # Get the receiver (the other participant)
            receiver_id = next((p for p in conversation['participants'] if p != sender_id), None)
            
            if not receiver_id:
                return create_error_response("Receiver not found in conversation", 400)
            
            # Update the conversation with the new message info
            conversation['lastMessage'] = {
                'text': message_text,
                'senderId': sender_id,
                'timestamp': datetime.utcnow().isoformat()
            }
            conversation['lastMessageAt'] = datetime.utcnow().isoformat()
            
            # Increment unread count for the receiver
            if 'unreadCounts' not in conversation:
                conversation['unreadCounts'] = {}
            
            conversation['unreadCounts'][receiver_id] = conversation['unreadCounts'].get(receiver_id, 0) + 1
            
            # Update the conversation
            conversations_container.replace_item(item=chat_id, body=conversation)
            
            # Get sender's name for notification
            sender_name = "Someone"
            try:
                users_container = get_container("users")
                sender_query = "SELECT c.name, c.businessName, c.isBusiness FROM c WHERE c.id = @id OR c.email = @id"
                sender_params = [{"name": "@id", "value": sender_id}]
                
                senders = list(users_container.query_items(
                    query=sender_query,
                    parameters=sender_params,
                    enable_cross_partition_query=True
                ))
                
                if senders:
                    sender = senders[0]
                    if sender.get('isBusiness') and sender.get('businessName'):
                        sender_name = sender.get('businessName')
                    else:
                        sender_name = sender.get('name', 'Someone')
            except Exception as e:
                logging.warning(f"Error getting sender name: {str(e)}")
            
            # Send real-time notification to receiver
            plant_name = conversation.get('plantName', 'a plant')
            notification_title = f"New message from {sender_name}"
            notification_body = f"About {plant_name}: {message_text[:100]}..."
            
            notification_data = {
                'type': 'marketplace_message',
                'conversationId': chat_id,
                'senderId': sender_id,
                'senderName': sender_name,
                'plantName': plant_name,
                'screen': 'MessagesScreen',
                'params': json.dumps({
                    'conversationId': chat_id,
                    'sellerId': sender_id if conversation.get('sellerId') == sender_id else receiver_id
                })
            }
            
            # Send notification to receiver using Firebase Admin SDK
            users_container = get_container("users")
            send_fcm_notification_to_user(users_container, receiver_id, notification_title, notification_body, notification_data)
            
        except Exception as e:
            logging.warning(f"Error updating conversation: {str(e)}")
            # Continue with message creation even if conversation update fails
        
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
        
        return create_success_response({
            "success": True,
            "messageId": message_id,
            "timestamp": current_time,
            "sender": sender_id
        }, 201)
    
    except Exception as e:
        logging.error(f"Error in send-message function: {str(e)}")
        return create_error_response(str(e), 500)