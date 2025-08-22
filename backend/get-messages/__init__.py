# get-messages/__init__.py - FIXED VERSION - Removes all partition_key usage
import logging
import json
import azure.functions as func
from datetime import datetime
from typing import Dict, Any, List, Optional, Tuple

from db_helpers import get_container
from http_helpers import (
    add_cors_headers, 
    handle_options_request, 
    create_error_response, 
    create_success_response, 
    extract_user_id
)

# Configure logging
logger = logging.getLogger(__name__)

# Constants
MAX_MESSAGES_PER_REQUEST = 1000  # Prevent excessive data loading
DEFAULT_MESSAGE_LIMIT = 100


class MessageRetrievalService:
    """Service class to handle message retrieval and read status updates"""
    
    def __init__(self):
        self.messages_container = get_container("marketplace_messages")
        self.conversations_container = get_container("marketplace_conversations_new")

    def validate_request(self, chat_id: str, user_id: str) -> Tuple[bool, Optional[str]]:
        """
        Validate the get messages request
        
        Returns:
            Tuple[bool, Optional[str]]: (is_valid, error_message)
        """
        if not chat_id or not isinstance(chat_id, str):
            return False, "Valid Chat ID is required"
        
        if not user_id or not isinstance(user_id, str):
            return False, "Valid User ID is required"
        
        return True, None

    def get_conversation(self, chat_id: str) -> Optional[Dict[str, Any]]:
        """
        Retrieve conversation using query to avoid partition_key issues
        
        Returns:
            Optional[Dict]: Conversation data or None if not found
        """
        try:
            # FIXED: Use query instead of read_item to avoid partition_key parameter
            query = "SELECT * FROM c WHERE c.id = @id"
            parameters = [{"name": "@id", "value": chat_id}]
            
            conversations = list(self.conversations_container.query_items(
                query=query,
                parameters=parameters,
                enable_cross_partition_query=True
            ))
            
            if conversations:
                logger.debug(f"Retrieved conversation {chat_id} using query")
                return conversations[0]
            else:
                logger.warning(f"Conversation {chat_id} not found")
                return None
                
        except Exception as e:
            logger.error(f"Failed to retrieve conversation {chat_id}: {str(e)}")
            return None

    def validate_user_access(self, conversation: Dict[str, Any], user_id: str) -> bool:
        """
        Validate that the user has access to this conversation
        
        Returns:
            bool: True if user has access, False otherwise
        """
        participants = conversation.get('participants', [])
        return user_id in participants

    def get_messages(
        self, 
        chat_id: str, 
        limit: Optional[int] = None, 
        offset: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """
        Retrieve messages for a conversation with optional pagination
        
        Args:
            chat_id: The conversation ID
            limit: Maximum number of messages to return
            offset: Number of messages to skip (for pagination)
            
        Returns:
            List[Dict]: List of message objects
        """
        try:
            # Apply default and maximum limits
            if limit is None:
                limit = DEFAULT_MESSAGE_LIMIT
            else:
                limit = min(limit, MAX_MESSAGES_PER_REQUEST)

            # Build query with optional pagination
            if offset and offset > 0:
                query = f"""
                    SELECT * FROM c 
                    WHERE c.conversationId = @chatId 
                    ORDER BY c.timestamp ASC 
                    OFFSET {offset} LIMIT {limit}
                """
            else:
                query = f"""
                    SELECT * FROM c 
                    WHERE c.conversationId = @chatId 
                    ORDER BY c.timestamp ASC
                """
                # Apply limit in query if no offset
                if limit < MAX_MESSAGES_PER_REQUEST:
                    query += f" OFFSET 0 LIMIT {limit}"

            parameters = [{"name": "@chatId", "value": chat_id}]
            
            logger.debug(f"Executing query: {query}")
            logger.debug(f"Parameters: {parameters}")
            
            messages = list(self.messages_container.query_items(
                query=query,
                parameters=parameters,
                enable_cross_partition_query=True
            ))
            
            logger.info(f"Retrieved {len(messages)} messages for conversation {chat_id}")
            return messages
            
        except Exception as e:
            logger.error(f"Error retrieving messages for conversation {chat_id}: {str(e)}")
            raise

    def update_conversation_unread_count(self, conversation: Dict[str, Any], user_id: str, chat_id: str) -> bool:
        """
        Reset unread count for the user in the conversation
        
        Returns:
            bool: True if successfully updated, False otherwise
        """
        try:
            # Check if user has unread messages
            unread_counts = conversation.get('unreadCounts', {})
            if user_id not in unread_counts or unread_counts[user_id] == 0:
                logger.debug(f"No unread messages for user {user_id} in conversation {chat_id}")
                return True

            # Reset unread count
            conversation['unreadCounts'][user_id] = 0

            # FIXED: Use upsert to avoid partition_key issues
            try:
                self.conversations_container.upsert_item(body=conversation)
                logger.debug(f"Updated unread count for user {user_id}")
                return True
                
            except Exception as update_error:
                logger.warning(f"Failed to update unread count for user {user_id}: {str(update_error)}")
                return False
                
        except Exception as e:
            logger.warning(f"Failed to update unread count for user {user_id}: {str(e)}")
            return False

    def mark_messages_as_read(self, messages: List[Dict[str, Any]], user_id: str) -> int:
        """
        Mark messages as read for the current user
        
        Returns:
            int: Number of messages successfully marked as read
        """
        marked_count = 0
        read_timestamp = datetime.utcnow().isoformat()
        
        # Filter messages that need to be marked as read
        unread_messages = [
            msg for msg in messages 
            if (msg.get('senderId') != user_id and 
                not msg.get('status', {}).get('read', False))
        ]
        
        logger.debug(f"Found {len(unread_messages)} unread messages to mark as read")
        
        for msg in unread_messages:
            try:
                # Ensure status object exists
                if 'status' not in msg:
                    msg['status'] = {}
                
                # Update read status
                msg['status']['read'] = True
                msg['status']['readAt'] = read_timestamp
                
                # FIXED: Use upsert instead of replace_item to avoid partition_key issues
                self.messages_container.upsert_item(body=msg)
                
                marked_count += 1
                logger.debug(f"Marked message {msg['id']} as read")
                
            except Exception as e:
                logger.warning(f"Failed to mark message {msg['id']} as read: {str(e)}")
                continue
        
        if marked_count > 0:
            logger.info(f"Successfully marked {marked_count} messages as read for user {user_id}")
        
        return marked_count

    def format_messages(self, messages: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Format messages for API response
        
        Returns:
            List[Dict]: Formatted message objects
        """
        formatted_messages = []
        
        for msg in messages:
            formatted_message = {
                "id": msg.get('id'),
                "senderId": msg.get('senderId'),
                "text": msg.get('text', ''),
                "timestamp": msg.get('timestamp'),
                "status": msg.get('status', {
                    "delivered": True,
                    "read": False,
                    "readAt": None
                })
            }
            
            # Add optional fields if they exist
            if 'attachments' in msg:
                formatted_message['attachments'] = msg['attachments']
            
            if 'editedAt' in msg:
                formatted_message['editedAt'] = msg['editedAt']
                formatted_message['isEdited'] = True
            
            formatted_messages.append(formatted_message)
        
        return formatted_messages

    def get_conversation_messages(
        self, 
        chat_id: str, 
        user_id: str, 
        limit: Optional[int] = None,
        offset: Optional[int] = None
    ) -> Tuple[bool, Dict[str, Any]]:
        """
        Main method to retrieve messages for a conversation
        
        Returns:
            Tuple[bool, Dict]: (success, response_data)
        """
        try:
            # Get and validate conversation
            conversation = self.get_conversation(chat_id)
            if not conversation:
                return False, {
                    "error": "Conversation not found",
                    "status_code": 404
                }

            # Validate user access
            if not self.validate_user_access(conversation, user_id):
                return False, {
                    "error": "Access denied: User is not a participant in this conversation",
                    "status_code": 403
                }

            # Get messages
            messages = self.get_messages(chat_id, limit, offset)

            # Update read status (non-critical operations)
            messages_marked = 0
            conversation_updated = False
            
            if messages:
                # Mark messages as read
                messages_marked = self.mark_messages_as_read(messages, user_id)
                
                # Update conversation unread count
                conversation_updated = self.update_conversation_unread_count(
                    conversation, user_id, chat_id
                )

            # Format response
            formatted_messages = self.format_messages(messages)

            response_data = {
                "messages": formatted_messages,
                "conversation": {
                    "id": chat_id,
                    "participantCount": len(conversation.get('participants', [])),
                    "lastMessageAt": conversation.get('lastMessageAt'),
                    "plantName": conversation.get('plantName')
                },
                "pagination": {
                    "count": len(formatted_messages),
                    "hasMore": len(messages) == (limit or DEFAULT_MESSAGE_LIMIT)
                },
                "readStatus": {
                    "messagesMarkedAsRead": messages_marked,
                    "conversationUpdated": conversation_updated
                }
            }

            return True, response_data

        except Exception as e:
            logger.error(f"Error in get_conversation_messages: {str(e)}", exc_info=True)
            return False, {
                "error": "Failed to retrieve messages",
                "status_code": 500
            }


def main(req: func.HttpRequest) -> func.HttpResponse:
    """Main Azure Function entry point"""
    logger.info('Processing get-messages request')
    
    # Handle CORS preflight requests
    if req.method == 'OPTIONS':
        return handle_options_request()
    
    try:
        # Extract parameters
        chat_id = req.route_params.get('chatId')
        user_id = extract_user_id(req)
        
        # Optional query parameters for pagination
        limit = None
        offset = None
        
        try:
            if req.params.get('limit'):
                limit = int(req.params.get('limit'))
                if limit <= 0:
                    return create_error_response("Limit must be a positive integer", 400)
                    
            if req.params.get('offset'):
                offset = int(req.params.get('offset'))
                if offset < 0:
                    return create_error_response("Offset must be a non-negative integer", 400)
                    
        except ValueError:
            return create_error_response("Invalid pagination parameters", 400)

        # Initialize service
        message_service = MessageRetrievalService()
        
        # Validate request
        is_valid, error_message = message_service.validate_request(chat_id, user_id)
        if not is_valid:
            return create_error_response(error_message, 400)

        logger.info(f"Getting messages for conversation {chat_id} for user {user_id}")

        # Get messages
        success, response_data = message_service.get_conversation_messages(
            chat_id, user_id, limit, offset
        )
        
        if success:
            return create_success_response(response_data)
        else:
            status_code = response_data.get('status_code', 500)
            error_message = response_data.get('error', 'Unknown error occurred')
            return create_error_response(error_message, status_code)
    
    except Exception as e:
        logger.error(f"Unexpected error in get-messages function: {str(e)}", exc_info=True)
        return create_error_response("Internal server error", 500)