# create-chat-room/__init__.py - Improved version
import json
import logging
import os
import uuid
import hashlib
from datetime import datetime
from typing import Dict, Any, Optional, List, Tuple
from dataclasses import dataclass

import azure.functions as func
from azure.cosmos import CosmosClient
from azure.cosmos.exceptions import CosmosHttpResponseError

# Configure logging
logger = logging.getLogger(__name__)

# Constants
MAX_MESSAGE_LENGTH = 1000
DEFAULT_DATABASE_NAME = "greener-marketplace-db"
DEFAULT_CONVERSATIONS_CONTAINER = "marketplace_conversations_new"
DEFAULT_MESSAGES_CONTAINER = "marketplace_messages"


@dataclass
class ChatRoomConfig:
    """Configuration for chat room creation"""
    conversations_pk_path: str
    messages_pk_path: str
    conversations_pk_field: str
    messages_pk_field: str
    database_name: str
    conversations_container: str
    messages_container: str

    @classmethod
    def from_environment(cls) -> 'ChatRoomConfig':
        """Create configuration from environment variables"""
        conversations_pk_path = os.environ.get("CONVERSATIONS_PK", "/id")
        messages_pk_path = os.environ.get("MESSAGES_PK", "/conversationId")
        
        return cls(
            conversations_pk_path=conversations_pk_path,
            messages_pk_path=messages_pk_path,
            conversations_pk_field=cls._pk_field_from_path(conversations_pk_path, "id"),
            messages_pk_field=cls._pk_field_from_path(messages_pk_path, "conversationId"),
            database_name=os.environ.get("COSMOSDB_MARKETPLACE_DATABASE_NAME", DEFAULT_DATABASE_NAME),
            conversations_container=os.environ.get("CONVERSATIONS_CONTAINER", DEFAULT_CONVERSATIONS_CONTAINER),
            messages_container=os.environ.get("MESSAGES_CONTAINER", DEFAULT_MESSAGES_CONTAINER)
        )
    
    @staticmethod
    def _pk_field_from_path(pk_path: str, default_field: str) -> str:
        """Extract partition key field from path"""
        return (pk_path or "").lstrip("/") or default_field


@dataclass
class ChatRoomRequest:
    """Validated chat room creation request"""
    sender_id: str
    receiver_id: str
    plant_id: Optional[str] = None
    message_text: Optional[str] = None

    @classmethod
    def from_request_body(cls, body: Dict[str, Any]) -> Tuple[bool, 'ChatRoomRequest', Optional[str]]:
        """
        Create request from HTTP body with validation
        
        Returns:
            Tuple[bool, ChatRoomRequest, Optional[str]]: (is_valid, request, error_message)
        """
        if not body or not isinstance(body, dict):
            return False, None, "Request body must be a valid JSON object"

        # Extract and normalize IDs
        sender = (body.get("sender") or body.get("senderId") or "").strip().lower()
        receiver = (body.get("receiver") or body.get("recipientId") or "").strip().lower()
        plant_id = body.get("plantId")
        message_text = body.get("message") or body.get("text")

        # Validation
        if not sender:
            return False, None, "Sender ID is required"
        
        if not receiver:
            return False, None, "Receiver ID is required"
        
        if sender == receiver:
            return False, None, "Sender and receiver cannot be the same"

        # Validate message length if provided
        if message_text and len(message_text) > MAX_MESSAGE_LENGTH:
            return False, None, f"Message text exceeds maximum length of {MAX_MESSAGE_LENGTH} characters"

        # Clean message text
        if message_text:
            message_text = message_text.strip()
            if not message_text:
                message_text = None

        request = cls(
            sender_id=sender,
            receiver_id=receiver,
            plant_id=plant_id,
            message_text=message_text
        )
        
        return True, request, None


class HttpResponseHelper:
    """Helper class for HTTP responses"""
    
    @staticmethod
    def _cors_headers() -> Dict[str, str]:
        """Get CORS headers"""
        return {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization, X-User-Email, X-User-Type, X-Business-ID",
        }

    @staticmethod
    def success_response(body: Any, status: int = 200) -> func.HttpResponse:
        """Create success response"""
        if isinstance(body, dict):
            body = json.dumps(body, indent=2)
        return func.HttpResponse(
            body, 
            status_code=status, 
            headers=HttpResponseHelper._cors_headers()
        )

    @staticmethod
    def error_response(message: str, status: int = 500, details: Any = None) -> func.HttpResponse:
        """Create error response with logging"""
        payload = {"error": message}
        if details:
            payload["details"] = details
        
        logger.error(f"Error response: {message} (Status: {status}) :: {details or ''}")
        
        return func.HttpResponse(
            json.dumps(payload, indent=2),
            status_code=status,
            headers=HttpResponseHelper._cors_headers()
        )

    @staticmethod
    def options_response() -> func.HttpResponse:
        """Handle CORS preflight"""
        return func.HttpResponse("", status_code=204, headers=HttpResponseHelper._cors_headers())


class CosmosDBService:
    """Service for Cosmos DB operations"""
    
    def __init__(self, config: ChatRoomConfig):
        self.config = config
        self._client = None
        self._database = None
        self._conversations_container = None
        self._messages_container = None

    def initialize(self) -> Tuple[bool, Optional[str]]:
        """Initialize Cosmos DB client and containers"""
        try:
            connection_string = os.environ.get("COSMOSDB__MARKETPLACE_CONNECTION_STRING")
            if not connection_string:
                return False, "Missing COSMOSDB__MARKETPLACE_CONNECTION_STRING environment variable"

            self._client = CosmosClient.from_connection_string(connection_string)
            self._database = self._client.get_database_client(self.config.database_name)
            self._conversations_container = self._database.get_container_client(self.config.conversations_container)
            self._messages_container = self._database.get_container_client(self.config.messages_container)
            
            return True, None
            
        except Exception as e:
            return False, f"Failed to initialize Cosmos DB client: {str(e)}"

    def _generate_conversation_id(self, sender_id: str, receiver_id: str, plant_id: Optional[str]) -> Tuple[str, str]:
        """Generate deterministic conversation ID and participants key"""
        participants_key = "|".join(sorted([sender_id, receiver_id]))
        raw_room_key = participants_key if not plant_id else f"{participants_key}|{plant_id}"
        conversation_id = hashlib.sha1(raw_room_key.encode("utf-8")).hexdigest()
        return conversation_id, participants_key

    def _compute_conversation_pk_value(self, conversation_id: str, participants_key: str) -> str:
        """Compute partition key value for conversation"""
        pk_field = self.config.conversations_pk_field.strip()
        
        if pk_field in ("id", "roomId", "conversationId"):
            return conversation_id
        elif pk_field in ("participantsKey", "participants_key", "pk"):
            return participants_key
        else:
            # Default fallback
            return conversation_id

    def _find_existing_conversation(
        self, 
        conversation_id: str, 
        participants_key: str, 
        plant_id: Optional[str]
    ) -> Optional[Dict[str, Any]]:
        """Find existing conversation using optimized queries"""
        try:
            pk_field = self.config.conversations_pk_field
            
            # Strategy 1: Direct partition query when possible
            if pk_field in ("participantsKey",):
                query = "SELECT * FROM c WHERE c.participantsKey = @pk"
                params = [{"name": "@pk", "value": participants_key}]
                
                if plant_id:
                    query += " AND c.plantId = @pid"
                    params.append({"name": "@pid", "value": plant_id})
                
                items = list(self._conversations_container.query_items(
                    query=query,
                    parameters=params,
                    enable_cross_partition_query=False
                ))
                
            elif pk_field in ("id", "roomId", "conversationId"):
                query = "SELECT * FROM c WHERE c.roomId = @rid OR c.id = @rid"
                items = list(self._conversations_container.query_items(
                    query=query,
                    parameters=[{"name": "@rid", "value": conversation_id}],
                    enable_cross_partition_query=False
                ))
            else:
                # Fallback to cross-partition query
                raise Exception("Using cross-partition fallback")
                
        except Exception as e:
            logger.debug(f"Partitioned query failed, using cross-partition: {str(e)}")
            
            # Fallback: Cross-partition query
            query = "SELECT * FROM c WHERE c.participantsKey = @pk"
            params = [{"name": "@pk", "value": participants_key}]
            
            if plant_id:
                query += " AND c.plantId = @pid"
                params.append({"name": "@pid", "value": plant_id})
            
            items = list(self._conversations_container.query_items(
                query=query,
                parameters=params,
                enable_cross_partition_query=True
            ))

        if items:
            # Return the most recent conversation
            return max(items, key=lambda x: str(x.get("lastMessageAt") or x.get("createdAt") or ""))
        
        return None

    def _create_conversation_document(
        self, 
        request: ChatRoomRequest, 
        conversation_id: str, 
        participants_key: str, 
        timestamp: str
    ) -> Dict[str, Any]:
        """Create conversation document"""
        conversation = {
            "id": conversation_id,
            "roomId": conversation_id,
            "participants": [request.sender_id, request.receiver_id],
            "participantsKey": participants_key,
            "createdAt": timestamp,
            "lastMessageAt": timestamp if request.message_text else None,
            "unreadCounts": {
                request.receiver_id: 1 if request.message_text else 0,
                request.sender_id: 0
            }
        }

        if request.message_text:
            conversation["lastMessage"] = {
                "text": request.message_text,
                "senderId": request.sender_id,
                "timestamp": timestamp
            }

        if request.plant_id:
            conversation["plantId"] = request.plant_id

        # Ensure partition key field is present
        pk_value = self._compute_conversation_pk_value(conversation_id, participants_key)
        conversation[self.config.conversations_pk_field] = pk_value

        return conversation

    def _update_existing_conversation(
        self, 
        conversation: Dict[str, Any], 
        request: ChatRoomRequest, 
        timestamp: str
    ) -> Dict[str, Any]:
        """Update existing conversation with new message info"""
        if request.message_text:
            conversation["lastMessageAt"] = timestamp
            conversation["lastMessage"] = {
                "text": request.message_text,
                "senderId": request.sender_id,
                "timestamp": timestamp
            }
            
            # Update unread counts
            unread_counts = conversation.get("unreadCounts", {})
            unread_counts[request.receiver_id] = unread_counts.get(request.receiver_id, 0) + 1
            conversation["unreadCounts"] = unread_counts

        return conversation

    def _create_message(
        self, 
        request: ChatRoomRequest, 
        conversation_id: str, 
        timestamp: str
    ) -> Optional[str]:
        """Create initial message if provided"""
        if not request.message_text:
            return None

        try:
            message_id = str(uuid.uuid4())
            pk_value = conversation_id  # Most common case
            
            if self.config.messages_pk_field != "conversationId":
                pk_value = conversation_id  # Fallback, might need adjustment

            message = {
                "id": message_id,
                "conversationId": conversation_id,
                "senderId": request.sender_id,
                "text": request.message_text,
                "timestamp": timestamp,
                "status": {
                    "delivered": True,
                    "read": False,
                    "readAt": None
                }
            }
            
            # Ensure partition key field is present
            message[self.config.messages_pk_field] = pk_value

            self._messages_container.create_item(body=message, partition_key=pk_value)
            return message_id
            
        except Exception as e:
            logger.warning(f"Failed to create initial message: {str(e)}")
            return None

    def create_or_get_conversation(self, request: ChatRoomRequest) -> Tuple[bool, Dict[str, Any]]:
        """
        Create or retrieve existing conversation
        
        Returns:
            Tuple[bool, Dict]: (success, response_data)
        """
        try:
            timestamp = datetime.utcnow().replace(microsecond=0).isoformat() + "Z"
            conversation_id, participants_key = self._generate_conversation_id(
                request.sender_id, request.receiver_id, request.plant_id
            )

            # Check for existing conversation
            existing_conversation = self._find_existing_conversation(
                conversation_id, participants_key, request.plant_id
            )

            is_new_conversation = existing_conversation is None
            
            if existing_conversation:
                # Update existing conversation
                conversation = self._update_existing_conversation(
                    existing_conversation, request, timestamp
                )
            else:
                # Create new conversation
                conversation = self._create_conversation_document(
                    request, conversation_id, participants_key, timestamp
                )

            # Upsert conversation
            pk_value = self._compute_conversation_pk_value(conversation_id, participants_key)
            conversation = self._conversations_container.upsert_item(
                body=conversation, 
                partition_key=pk_value
            )

            # Create initial message if provided
            message_id = self._create_message(request, conversation_id, timestamp)

            response_data = {
                "success": True,
                "conversationId": conversation_id,
                "isNewConversation": is_new_conversation,
                "messageId": message_id,
                "participantCount": len(conversation.get("participants", [])),
                "createdAt": conversation.get("createdAt"),
                "lastMessageAt": conversation.get("lastMessageAt")
            }

            return True, response_data

        except CosmosHttpResponseError as ce:
            error_details = self._format_cosmos_error(ce)
            return False, {
                "error": "Database operation failed",
                "status_code": 500,
                "details": error_details
            }
        except Exception as e:
            logger.error(f"Unexpected error in create_or_get_conversation: {str(e)}", exc_info=True)
            return False, {
                "error": "Failed to create conversation",
                "status_code": 500,
                "details": str(e)
            }

    def _format_cosmos_error(self, error: CosmosHttpResponseError) -> Dict[str, Any]:
        """Format Cosmos DB error for response"""
        headers = getattr(error, "headers", {}) or {}
        return {
            "status_code": getattr(error, "status_code", None),
            "sub_status": headers.get("x-ms-substatus") or headers.get("x-ms-sub-status"),
            "activity_id": headers.get("x-ms-activity-id"),
            "request_charge": headers.get("x-ms-request-charge"),
            "message": getattr(error, "message", None) or str(error),
        }


class ChatRoomService:
    """Main service for chat room operations"""
    
    def __init__(self):
        self.config = ChatRoomConfig.from_environment()
        self.db_service = CosmosDBService(self.config)
        self.response_helper = HttpResponseHelper()

    def create_chat_room(self, request_body: Dict[str, Any]) -> func.HttpResponse:
        """
        Create or retrieve chat room
        
        Returns:
            func.HttpResponse: HTTP response
        """
        # Validate request
        is_valid, request, error_message = ChatRoomRequest.from_request_body(request_body)
        if not is_valid:
            return self.response_helper.error_response(error_message, 400)

        # Initialize database service
        db_initialized, init_error = self.db_service.initialize()
        if not db_initialized:
            return self.response_helper.error_response("Database connection failed", 500, init_error)

        logger.info(f"Creating chat room: {request.sender_id} -> {request.receiver_id} "
                   f"(plant: {request.plant_id}, has_message: {bool(request.message_text)})")

        # Create or get conversation
        success, result = self.db_service.create_or_get_conversation(request)
        
        if success:
            status_code = 201 if result.get("isNewConversation") else 200
            return self.response_helper.success_response(result, status_code)
        else:
            status_code = result.get("status_code", 500)
            error_message = result.get("error", "Unknown error occurred")
            details = result.get("details")
            return self.response_helper.error_response(error_message, status_code, details)


def main(req: func.HttpRequest) -> func.HttpResponse:
    """Main Azure Function entry point"""
    logger.info("Processing createChatRoom request")

    # Handle CORS preflight
    if req.method == "OPTIONS":
        return HttpResponseHelper.options_response()

    try:
        # Parse request body
        try:
            request_body = req.get_json()
        except Exception:
            return HttpResponseHelper.error_response("Invalid JSON body", 400, "Request body must be valid JSON")

        # Create and execute service
        service = ChatRoomService()
        return service.create_chat_room(request_body)

    except Exception as e:
        logger.error(f"Unexpected error in createChatRoom function: {str(e)}", exc_info=True)
        return HttpResponseHelper.error_response("Internal server error", 500, str(e))