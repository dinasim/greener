# create-chat/__init__.py
import logging
import json
import azure.functions as func
from db_helpers import get_container
from http_helpers import add_cors_headers, handle_options_request, create_error_response, create_success_response, extract_user_id
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
        logging.info('Successfully got conversations container')
        
        # Create a conversation key by combining participants (sorted for consistency)
        participant_ids = sorted([sender_id, receiver_id])
        participants_key = "|".join(participant_ids)
        
        # Check if a conversation already exists between these users about this plant
        query = "SELECT * FROM c WHERE c.participantsKey = @participantsKey"
        parameters = [{"name": "@participantsKey", "value": participants_key}]
        
        # Add plant filter if provided
        if plant_id:
            query += " AND c.plantId = @plantId"
            parameters.append({"name": "@plantId", "value": plant_id})
        else:
            query += " AND (NOT IS_DEFINED(c.plantId) OR c.plantId = null)"
        
        logging.info(f"Query: {query}")
        logging.info(f"Parameters: {parameters}")
        
        # Execute query with cross-partition support
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
                logging.info(f"Updating conversation {conversation_id}")
                conversations_container.replace_item(
                    item=conversation_id,
                    body=conversation
                )
                logging.info(f"Successfully updated conversation {conversation_id}")
            except Exception as update_error:
                logging.error(f"Error updating conversation: {str(update_error)}")
                # Try with partition key equal to the ID
                try:
                    logging.info(f"Retrying update with id as partition key")
                    conversations_container.replace_item(
                        item=conversation_id,
                        partition_key=conversation_id,
                        body=conversation
                    )
                    logging.info(f"Successfully updated conversation with id as partition key")
                except Exception as retry_error:
                    logging.error(f"Retry also failed: {str(retry_error)}")
                    raise retry_error
        else:
            # Create a new conversation
            conversation_id = str(uuid.uuid4())
            current_time = datetime.utcnow().isoformat()
            
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
                # Fallback: try without explicit partition key
                try:
                    logging.info("Retrying create without explicit partition key")
                    conversations_container.create_item(body=new_conversation)
                    logging.info("Successfully created conversation without explicit partition key")
                except Exception as retry_error:
                    logging.error(f"Retry failed: {str(retry_error)}")
                    raise retry_error
                    
            is_new_conversation = True
        
        # Add the message to the messages container
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
        
        # Create the message
        try:
            messages_container.create_item(body=message)
            logging.info(f"Created message {message_id} in conversation {conversation_id}")
        except Exception as msg_error:
            logging.error(f"Error creating message: {str(msg_error)}")
            # Continue even if message creation fails
        
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
                logging.warning(f"Error updating plant info: {str(e)}")
        
        return create_success_response({
            "success": True,
            "messageId": conversation_id,
            "isNewConversation": is_new_conversation,
            "sellerName": seller_name,
            "plantName": plant_name
        })
    
    except Exception as e:
        logging.error(f"Error creating chat room: {str(e)}")
        return create_error_response(str(e), 500)