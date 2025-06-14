# create-chat/__init__.py
import logging
import json
import azure.functions as func
from db_helpers import get_container
from http_helpers import add_cors_headers, handle_options_request, create_error_response, create_success_response, extract_user_id
from firebase_helpers import send_fcm_notification_to_user
import uuid
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
        
        # Access the marketplace-conversations container
        conversations_container = get_container("marketplace-conversations")
        
        # Create a sorted participants key for querying
        participants_key = "|".join(sorted([sender_id, receiver_id]))
        
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
        
        conversation_id = None
        is_new_conversation = False
        
        if existing_conversations:
            # Use the existing conversation
            conversation = existing_conversations[0]
            conversation_id = conversation['id']
            
            # Update the conversation with the new message
            conversation['lastMessage'] = {
                'text': initial_message,
                'senderId': sender_id,
                'timestamp': datetime.utcnow().isoformat()
            }
            conversation['lastMessageAt'] = datetime.utcnow().isoformat()
            
            # Increment unread count for the receiver
            if 'unreadCounts' not in conversation:
                conversation['unreadCounts'] = {}
            
            conversation['unreadCounts'][receiver_id] = conversation['unreadCounts'].get(receiver_id, 0) + 1
            
            # Update the conversation - use id for both item and partition_key
            try:
                conversations_container.replace_item(
                    item=conversation_id,
                    body=conversation,
                    partition_key=conversation_id
                )
                logging.info(f"Updated existing conversation {conversation_id}")
            except Exception as update_error:
                logging.error(f"Error updating conversation: {str(update_error)}")
                return create_error_response("Failed to update conversation", 500)
        else:
            # Create a new conversation
            conversation_id = str(uuid.uuid4())
            current_time = datetime.utcnow().isoformat()
            is_new_conversation = True
            
            new_conversation = {
                "id": conversation_id,
                "participants": [sender_id, receiver_id],  # Keep original format for app compatibility
                "participantsKey": participants_key,  # Add flattened key for querying
                "createdAt": current_time,
                "lastMessageAt": current_time,
                "lastMessage": {
                    "text": initial_message,
                    "senderId": sender_id,
                    "timestamp": current_time
                },
                "unreadCounts": {
                    receiver_id: 1,
                    sender_id: 0
                }
            }
            
            if plant_id:
                new_conversation["plantId"] = plant_id
            
            logging.info(f"Creating new conversation {conversation_id}")
            
            try:
                # Create the conversation - using id as the partition key
                conversations_container.create_item(
                    body=new_conversation,
                    partition_key=conversation_id
                )
                logging.info(f"Successfully created conversation {conversation_id}")
            except Exception as create_error:
                logging.error(f"Error creating conversation: {str(create_error)}")
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
            messages_container = get_container("marketplace-messages")
            
            message_id = str(uuid.uuid4())
            current_time = datetime.utcnow().isoformat()
            
            message = {
                "id": message_id,
                "conversationId": conversation_id,
                "senderId": sender_id,
                "text": initial_message,
                "timestamp": current_time,
                "status": {
                    "delivered": True,
                    "read": False,
                    "readAt": None
                }
            }
            
            messages_container.create_item(body=message)
            logging.info(f"Created message {message_id} in conversation {conversation_id}")
        except Exception as msg_error:
            logging.error(f"Error creating message: {str(msg_error)}")
            # Continue even if message creation fails
        
        # If this is a plant listing, get plant info and update message count
        plant_name = None
        if plant_id:
            try:
                plants_container = get_container("marketplace-plants")
                
                plant_query = "SELECT c.title, c.stats FROM c WHERE c.id = @id"
                plant_params = [{"name": "@id", "value": plant_id}]
                
                plants = list(plants_container.query_items(
                    query=plant_query,
                    parameters=plant_params,
                    enable_cross_partition_query=True
                ))
                
                if plants:
                    plant = plants[0]
                    plant_name = plant.get('title')
                    
                    # Update message count
                    if 'stats' not in plant:
                        plant['stats'] = {}
                    
                    plant['stats']['messageCount'] = plant['stats'].get('messageCount', 0) + 1
                    
                    plants_container.replace_item(item=plant_id, body=plant)
            except Exception as e:
                logging.warning(f"Error updating plant stats: {str(e)}")
        
        # Send real-time notification to receiver for new conversations
        if is_new_conversation:
            notification_title = f"New message from {sender_name}"
            if plant_name:
                notification_body = f"About {plant_name}: {initial_message[:100]}..."
            else:
                notification_body = f"{initial_message[:100]}..."
            
            notification_data = {
                'type': 'marketplace_message',
                'conversationId': conversation_id,
                'senderId': sender_id,
                'senderName': sender_name,
                'plantName': plant_name or 'a plant',
                'screen': 'MessagesScreen',
                'params': json.dumps({
                    'conversationId': conversation_id,
                    'sellerId': sender_id
                })
            }
            
            # Send notification to receiver using Firebase Admin SDK
            users_container = get_container("users")
            send_fcm_notification_to_user(users_container, receiver_id, notification_title, notification_body, notification_data)
        
        # Get seller name for response
        seller_name = "User"
        try:
            if is_new_conversation:
                users_container = get_container("users")
                user_query = "SELECT c.name FROM c WHERE c.id = @id OR c.email = @email"
                user_params = [
                    {"name": "@id", "value": receiver_id},
                    {"name": "@email", "value": receiver_id}
                ]
                
                users = list(users_container.query_items(
                    query=user_query,
                    parameters=user_params,
                    enable_cross_partition_query=True
                ))
                
                if users:
                    seller_name = users[0].get('name', 'User')
        except Exception as e:
            logging.warning(f"Error getting seller name: {str(e)}")
        
        return create_success_response({
            "success": True,
            "conversationId": conversation_id,
            "messageId": message_id if 'message_id' in locals() else None,
            "sellerName": seller_name,
            "plantName": plant_name,
            "isNewConversation": is_new_conversation
        }, 201)
    
    except Exception as e:
        logging.error(f"Error in create-chat function: {str(e)}")
        return create_error_response(str(e), 500)