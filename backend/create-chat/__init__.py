# create-chat/__init__.py - FIXED VERSION - Removes all partition_key usage
import logging
import json
import azure.functions as func
from db_helpers import get_container
from http_helpers import add_cors_headers, handle_options_request, create_error_response, create_success_response, extract_user_id
from firebase_helpers import send_fcm_notification_to_user
import uuid
import hashlib
from datetime import datetime

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Python HTTP trigger function for creating chat room processed a request.')
    
    # Handle OPTIONS method for CORS preflight
    if req.method == 'OPTIONS':
        return handle_options_request()
    
    try:
        # Get request body
        request_body = req.get_json()
        
        # Validate required fields
        if not request_body:
            return create_error_response("Request body is required", 400)
        
        sender_id = request_body.get('sender')
        receiver_id = request_body.get('receiver')
        plant_id = request_body.get('plantId')
        initial_message = request_body.get('message')
        
        if not sender_id:
            return create_error_response("Sender ID is required", 400)
        
        if not receiver_id:
            return create_error_response("Receiver ID is required", 400)
        
        if not initial_message:
            return create_error_response("Initial message is required", 400)
        
        # Normalize IDs
        sender_id = sender_id.strip().lower()
        receiver_id = receiver_id.strip().lower()
        
        if sender_id == receiver_id:
            return create_error_response("Sender and receiver cannot be the same", 400)
        
        # Access containers using db_helpers
        conversations_container = get_container("marketplace_conversations_new")
        messages_container = get_container("marketplace_messages")
        
        # Create a sorted participants key for querying
        participants_key = "|".join(sorted([sender_id, receiver_id]))
        
        # Generate deterministic conversation ID
        raw_room_key = participants_key if not plant_id else f"{participants_key}|{plant_id}"
        conversation_id = hashlib.sha1(raw_room_key.encode("utf-8")).hexdigest()
        
        # Check if conversation already exists between these users
        query = "SELECT * FROM c WHERE c.participantsKey = @participantsKey"
        parameters = [{"name": "@participantsKey", "value": participants_key}]
        
        # If plant_id is provided, check for conversation about this specific plant
        if plant_id:
            query += " AND c.plantId = @plantId"
            parameters.append({"name": "@plantId", "value": plant_id})
        
        existing_conversations = list(conversations_container.query_items(
            query=query,
            parameters=parameters,
            enable_cross_partition_query=True
        ))
        
        logging.info(f"Found {len(existing_conversations)} existing conversations")
        
        is_new_conversation = False
        timestamp = datetime.utcnow().isoformat()
        
        if existing_conversations:
            # Use the existing conversation
            conversation = existing_conversations[0]
            conversation_id = conversation['id']
            logging.info(f"Using existing conversation: {conversation_id}")
            
            # Update last message info
            conversation['lastMessage'] = {
                'text': initial_message,
                'senderId': sender_id,
                'timestamp': timestamp
            }
            conversation['lastMessageAt'] = timestamp
            
            # Update unread counts
            if 'unreadCounts' not in conversation:
                conversation['unreadCounts'] = {}
            
            current_unread = conversation['unreadCounts'].get(receiver_id, 0)
            conversation['unreadCounts'][receiver_id] = current_unread + 1
            conversation['unreadCounts'][sender_id] = 0
        else:
            # Create new conversation
            is_new_conversation = True
            logging.info(f"Creating new conversation: {conversation_id}")
            
            conversation = {
                "id": conversation_id,
                "roomId": conversation_id,
                "participants": [sender_id, receiver_id],
                "participantsKey": participants_key,
                "createdAt": timestamp,
                "lastMessage": {
                    "text": initial_message,
                    "senderId": sender_id,
                    "timestamp": timestamp
                },
                "lastMessageAt": timestamp,
                "unreadCounts": {
                    receiver_id: 1,
                    sender_id: 0
                }
            }
            
            if plant_id:
                conversation["plantId"] = plant_id
        
        # FIXED: Use upsert instead of create/replace with partition_key
        try:
            conversations_container.upsert_item(body=conversation)
            logging.info(f"Successfully upserted conversation {conversation_id}")
        except Exception as upsert_error:
            logging.error(f"Error upserting conversation: {str(upsert_error)}")
            return create_error_response("Failed to create conversation", 500)
        
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
        
        # Create the initial message
        try:
            message_id = str(uuid.uuid4())
            
            message = {
                "id": message_id,
                "conversationId": conversation_id,
                "senderId": sender_id,
                "text": initial_message,
                "timestamp": timestamp,
                "status": {
                    "delivered": True,
                    "read": False,
                    "readAt": None
                }
            }
            
            # FIXED: Use create_item without partition_key parameter
            messages_container.create_item(body=message)
            logging.info(f"Successfully created message {message_id}")
            
        except Exception as message_error:
            logging.error(f"Error creating message: {str(message_error)}")
            return create_error_response("Failed to create message", 500)
        
        # Send notification to receiver (non-critical)
        # Send notification to receiver (non-critical)
        try:
            # Friendly title/body
            plant_name = conversation.get('plantName', 'a plant')
            notification_title = f"New message from {sender_name}"
            notification_body = (
                f"About {plant_name}: {initial_message[:100]}{'...' if len(initial_message) > 100 else ''}"
            )

            # Keep payload shape aligned with send-message so the app deep-links consistently
            notification_data = {
                'type': 'marketplace_message',
                'conversationId': conversation_id,
                'senderId': sender_id,
                'senderName': sender_name,
                'screen': 'MessagesScreen',
                'params': json.dumps({
                    'conversationId': conversation_id,
                    # If your conversation has a sellerId field, keep the same rule used in send-message:
                    # it should resolve to the seller's user id, not just "who to notify".
                    'sellerId': sender_id if conversation.get('sellerId') == sender_id else receiver_id
                })
            }

            # Safety: don't notify yourself (shouldn't happen because we validated earlier)
            if sender_id.lower() != receiver_id.lower():
                send_fcm_notification_to_user(
                    users_container,
                    receiver_id,
                    notification_title,
                    notification_body,
                    notification_data
                )
        except Exception as notification_error:
            logging.warning(f"Error sending notification: {str(notification_error)}")

            
        except Exception as notification_error:
            logging.warning(f"Error sending notification: {str(notification_error)}")
        
        # Return success response
        return create_success_response({
            "success": True,
            "conversationId": conversation_id,
            "messageId": message_id,
            "isNewConversation": is_new_conversation,
            "participantCount": len(conversation.get("participants", [])),
            "createdAt": conversation.get("createdAt"),
            "lastMessageAt": conversation.get("lastMessageAt")
        }, 201 if is_new_conversation else 200)
        
    except Exception as e:
        logging.error(f"Error creating chat room: {str(e)}")
        return create_error_response("Failed to create conversation", 500)