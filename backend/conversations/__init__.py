# backend/marketplace/conversations/__init__.py
import logging
import json
import azure.functions as func
from shared.marketplace.db_client import get_container
from datetime import datetime

def add_cors_headers(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS, PUT, PATCH, DELETE'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type,Authorization,X-User-Email'
    return response

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Python HTTP trigger function for getting user conversations processed a request.')
    
    try:
        # Get user ID from query parameters or request body
        request_json = req.get_json() if req.get_body() else {}
        user_id = request_json.get('userId') or req.params.get('userId')
        
        if not user_id:
            return func.HttpResponse(
                body=json.dumps({"error": "User ID is required"}),
                mimetype="application/json",
                status_code=400
            )
        
        # Access the marketplace-conversations container
        container = get_container("marketplace-conversations")
        
        # Query for conversations where the user is a participant
        query = "SELECT * FROM c WHERE ARRAY_CONTAINS(c.participants, @userId)"
        parameters = [{"name": "@userId", "value": user_id}]
        
        conversations = list(container.query_items(
            query=query,
            parameters=parameters,
            enable_cross_partition_query=True
        ))
        
        # Enhance conversations with additional information
        enhanced_conversations = []
        
        for conv in conversations:
            try:
                # Get the other participant
                other_user_id = next((p for p in conv['participants'] if p != user_id), None)
                
                # Get other user details
                other_user = {
                    "name": "Unknown User",
                    "avatar": None
                }
                
                if other_user_id:
                    users_container = get_container("users")
                    user_query = "SELECT c.name, c.avatar FROM c WHERE c.id = @id OR c.email = @email"
                    user_params = [
                        {"name": "@id", "value": other_user_id},
                        {"name": "@email", "value": other_user_id}
                    ]
                    
                    users = list(users_container.query_items(
                        query=user_query,
                        parameters=user_params,
                        enable_cross_partition_query=True
                    ))
                    
                    if users:
                        other_user = {
                            "name": users[0].get('name', 'User'),
                            "avatar": users[0].get('avatar')
                        }
                
                # Get plant details if available
                plant_info = {
                    "name": "Plant Discussion",
                    "id": None
                }
                
                if 'plantId' in conv:
                    plants_container = get_container("marketplace-plants")
                    plant_query = "SELECT c.id, c.title, c.images FROM c WHERE c.id = @id"
                    plant_params = [{"name": "@id", "value": conv['plantId']}]
                    
                    plants = list(plants_container.query_items(
                        query=plant_query,
                        parameters=plant_params,
                        enable_cross_partition_query=True
                    ))
                    
                    if plants:
                        plant = plants[0]
                        plant_info = {
                            "name": plant.get('title', 'Plant Discussion'),
                            "id": plant.get('id'),
                            "image": plant.get('images', [])[0] if plant.get('images') else None
                        }
                
                # Format the conversation
                enhanced_conv = {
                    "id": conv['id'],
                    "otherUserName": other_user['name'],
                    "otherUserAvatar": other_user['avatar'],
                    "plantName": plant_info['name'],
                    "plantId": plant_info['id'] or conv.get('plantId'),
                    "plantImage": plant_info.get('image'),
                    "sellerId": other_user_id,  # The other participant is usually the seller
                    "lastMessage": conv.get('lastMessage', {}).get('text', ''),
                    "lastMessageTimestamp": conv.get('lastMessageAt'),
                    "unreadCount": conv.get('unreadCounts', {}).get(user_id, 0)
                }
                
                enhanced_conversations.append(enhanced_conv)
            except Exception as e:
                logging.error(f"Error enhancing conversation {conv.get('id')}: {str(e)}")
                # Add basic conversation info even if enhancement fails
                enhanced_conversations.append({
                    "id": conv.get('id'),
                    "otherUserName": "User",
                    "plantName": "Discussion",
                    "lastMessage": conv.get('lastMessage', {}).get('text', ''),
                    "lastMessageTimestamp": conv.get('lastMessageAt'),
                    "unreadCount": 0
                })
        
        # Sort by last message timestamp, most recent first
        enhanced_conversations.sort(
            key=lambda c: c.get('lastMessageTimestamp', ''),
            reverse=True
        )
        
        return func.HttpResponse(
            body=json.dumps(enhanced_conversations, default=str),
            mimetype="application/json",
            status_code=200
        )
    
    except Exception as e:
        logging.error(f"Error getting user conversations: {str(e)}")
        return func.HttpResponse(
            body=json.dumps({"error": str(e)}),
            mimetype="application/json",
            status_code=500
        )