# send-message/__init__.py - Improved version
import logging
import json
import uuid
from datetime import datetime
from typing import Dict, Any, Optional, Tuple
import azure.functions as func

from db_helpers import get_container
from http_helpers import (
    add_cors_headers, 
    handle_options_request, 
    create_error_response, 
    create_success_response, 
    extract_user_id
)
from firebase_helpers import send_fcm_notification_to_user

# Configure logging
logger = logging.getLogger(__name__)


class MessageService:
    """Service class to handle message-related operations"""
    
    def __init__(self):
        self.conversations_container = get_container("marketplace_conversations_new")
        self.messages_container = get_container("marketplace_messages")
        self.users_container = get_container("users")

    def validate_message_request(self, request_body: Dict[str, Any], sender_id: str) -> Tuple[bool, Optional[str]]:
        """
        Validate the message request data
        
        Returns:
            Tuple[bool, Optional[str]]: (is_valid, error_message)
        """
        if not request_body:
            return False, "Request body is required"
        
        chat_id = request_body.get('chatId')
        message_text = request_body.get('message')
        
        if not chat_id:
            return False, "Chat ID is required"
        
        if not message_text:
            return False, "Message text is required"
            
        if not isinstance(message_text, str) or not message_text.strip():
            return False, "Message must be a non-empty string"
        
        if not sender_id:
            return False, "Sender ID is required"
        
        # Optional: Add message length validation
        if len(message_text) > 1000:  # Adjust limit as needed
            return False, "Message text is too long (maximum 1000 characters)"
        
        return True, None

    def get_conversation(self, chat_id: str) -> Optional[Dict[str, Any]]:
        """Get conversation by ID"""
        try:
            return self.conversations_container.read_item(item=chat_id, partition_key=chat_id)
        except Exception as e:
            logger.error(f"Error retrieving conversation {chat_id}: {str(e)}")
            return None

    def get_receiver_id(self, conversation: Dict[str, Any], sender_id: str) -> Optional[str]:
        """Get the receiver ID from conversation participants"""
        participants = conversation.get('participants', [])
        return next((p for p in participants if p != sender_id), None)

    def get_sender_display_name(self, sender_id: str) -> str:
        """Get the display name for the sender"""
        try:
            sender_query = "SELECT c.name, c.businessName, c.isBusiness FROM c WHERE c.id = @id OR c.email = @id"
            sender_params = [{"name": "@id", "value": sender_id}]

            senders = list(self.users_container.query_items(
                query=sender_query,
                parameters=sender_params,
                enable_cross_partition_query=True
            ))

            if senders:
                sender = senders[0]
                if sender.get('isBusiness') and sender.get('businessName'):
                    return sender.get('businessName')
                return sender.get('name', 'Someone')
            
        except Exception as e:
            logger.warning(f"Error getting sender name for {sender_id}: {str(e)}")
        
        return "Someone"

    def update_conversation_metadata(
        self, 
        conversation: Dict[str, Any], 
        message_text: str, 
        sender_id: str, 
        receiver_id: str, 
        timestamp: str
    ) -> bool:
        """Update conversation with last message info and unread counts"""
        try:
            # Update last message info
            conversation['lastMessage'] = {
                'text': message_text,
                'senderId': sender_id,
                'timestamp': timestamp
            }
            conversation['lastMessageAt'] = timestamp

            # Initialize unread counts if not present
            if 'unreadCounts' not in conversation:
                conversation['unreadCounts'] = {}

            # Increment unread count for receiver
            current_unread = conversation['unreadCounts'].get(receiver_id, 0)
            conversation['unreadCounts'][receiver_id] = current_unread + 1

            # Update the conversation in database
            self.conversations_container.replace_item(
                item=conversation['id'], 
                body=conversation
            )
            
            return True
            
        except Exception as e:
            logger.error(f"Error updating conversation metadata: {str(e)}")
            return False

    def create_message(
        self, 
        chat_id: str, 
        sender_id: str, 
        message_text: str, 
        timestamp: str
    ) -> Optional[Dict[str, Any]]:
        """Create and store a new message"""
        try:
            message_id = str(uuid.uuid4())
            
            message = {
                "id": message_id,
                "conversationId": chat_id,
                "senderId": sender_id,
                "text": message_text.strip(),  # Clean the message text
                "timestamp": timestamp,
                "status": {
                    "delivered": True,
                    "read": False,
                    "readAt": None
                }
            }

            self.messages_container.create_item(body=message)
            return message
            
        except Exception as e:
            logger.error(f"Error creating message: {str(e)}")
            return None

    def send_notification(
        self, 
        conversation: Dict[str, Any], 
        message_text: str, 
        sender_name: str, 
        sender_id: str, 
        receiver_id: str, 
        chat_id: str
    ) -> None:
        """Send push notification to receiver"""
        try:
            plant_name = conversation.get('plantName', 'a plant')
            notification_title = f"New message from {sender_name}"
            
            # Truncate message for notification
            truncated_message = message_text[:100] + "..." if len(message_text) > 100 else message_text
            notification_body = f"About {plant_name}: {truncated_message}"

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

            send_fcm_notification_to_user(
                self.users_container, 
                receiver_id, 
                notification_title, 
                notification_body, 
                notification_data
            )
            
        except Exception as e:
            logger.warning(f"Error sending notification: {str(e)}")

    def send_message(
        self, 
        chat_id: str, 
        message_text: str, 
        sender_id: str
    ) -> Tuple[bool, Dict[str, Any]]:
        """
        Main method to send a message
        
        Returns:
            Tuple[bool, Dict]: (success, response_data)
        """
        timestamp = datetime.utcnow().isoformat()
        
        # Get conversation
        conversation = self.get_conversation(chat_id)
        if not conversation:
            return False, {"error": "Conversation not found", "status_code": 404}

        # Get receiver
        receiver_id = self.get_receiver_id(conversation, sender_id)
        if not receiver_id:
            return False, {"error": "Receiver not found in conversation", "status_code": 400}

        # Validate sender is part of the conversation
        if sender_id not in conversation.get('participants', []):
            return False, {"error": "Sender is not a participant in this conversation", "status_code": 403}

        # Create the message first (critical operation)
        message = self.create_message(chat_id, sender_id, message_text, timestamp)
        if not message:
            return False, {"error": "Failed to create message", "status_code": 500}

        # Update conversation metadata (non-critical, can fail)
        conversation_updated = self.update_conversation_metadata(
            conversation, message_text, sender_id, receiver_id, timestamp
        )
        if not conversation_updated:
            logger.warning("Failed to update conversation metadata, but message was created successfully")

        # Send notification (non-critical, can fail)
        sender_name = self.get_sender_display_name(sender_id)
        self.send_notification(
            conversation, message_text, sender_name, sender_id, receiver_id, chat_id
        )

        return True, {
            "success": True,
            "messageId": message["id"],
            "timestamp": timestamp,
            "sender": sender_id,
            "conversationUpdated": conversation_updated
        }


def main(req: func.HttpRequest) -> func.HttpResponse:
    """Main Azure Function entry point"""
    logger.info('Processing send-message request')
    
    # Handle CORS preflight requests
    if req.method == 'OPTIONS':
        return handle_options_request()
    
    try:
        # Parse request
        request_body = req.get_json()
        sender_id = request_body.get('senderId') if request_body else None
        
        # Extract sender ID from auth if not provided
        if not sender_id:
            sender_id = extract_user_id(req)
        
        # Initialize service
        message_service = MessageService()
        
        # Validate request
        is_valid, error_message = message_service.validate_message_request(request_body, sender_id)
        if not is_valid:
            return create_error_response(error_message, 400)
        
        # Extract validated data
        chat_id = request_body['chatId']
        message_text = request_body['message']
        
        # Send message
        success, response_data = message_service.send_message(chat_id, message_text, sender_id)
        
        if success:
            return create_success_response(response_data, 201)
        else:
            status_code = response_data.get('status_code', 500)
            error_message = response_data.get('error', 'Unknown error occurred')
            return create_error_response(error_message, status_code)
    
    except json.JSONDecodeError:
        logger.error("Invalid JSON in request body")
        return create_error_response("Invalid JSON in request body", 400)
    
    except Exception as e:
        logger.error(f"Unexpected error in send-message function: {str(e)}", exc_info=True)
        return create_error_response("Internal server error", 500)