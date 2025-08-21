# conversations/__init__.py
import logging
import json
import azure.functions as func
from db_helpers import get_container
from http_helpers import add_cors_headers, handle_options_request, create_error_response, create_success_response, extract_user_id
from datetime import datetime

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Python HTTP trigger function for getting user conversations processed a request.')
    
    # Handle OPTIONS method for CORS preflight
    if req.method == 'OPTIONS':
        return handle_options_request()
    
    try:
        # Get user ID from query parameters or request body
        user_id = extract_user_id(req)
        
        if not user_id:
            return create_error_response("User ID is required", 400)
        
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
                
                # Initialize default values
                other_user = {
                    "name": "Unknown User",
                    "avatar": None,
                    "business": False
                }
                
                plant_info = {
                    "name": "Plant Discussion",
                    "id": None,
                    "image": None
                }
                
                if other_user_id:
                    # Try to get user from regular users container first
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
                            "avatar": users[0].get('avatar'),
                            "business": False
                        }
                    else:
                        # If not found, try business_users container
                        business_container = get_container("business_users")
                        business_query = "SELECT c.businessName, c.logo FROM c WHERE c.id = @id OR c.email = @email"
                        business_params = [
                            {"name": "@id", "value": other_user_id},
                            {"name": "@email", "value": other_user_id}
                        ]
                        businesses = list(business_container.query_items(
                            query=business_query,
                            parameters=business_params,
                            enable_cross_partition_query=True
                        ))
                        if businesses:
                            other_user = {
                                "name": businesses[0].get('businessName', 'Business'),
                                "avatar": businesses[0].get('logo'),
                                "business": True
                            }
                
                # Get plant information if plantId exists
                if 'plantId' in conv:
                    plants_container = get_container("marketplace-plants")
                    plant_query = "SELECT c.id, c.title, c.image, c.images FROM c WHERE c.id = @id"
                    plant_params = [{"name": "@id", "value": conv['plantId']}]
                    
                    plants = list(plants_container.query_items(
                        query=plant_query,
                        parameters=plant_params,
                        enable_cross_partition_query=True
                    ))
                    
                    if plants:
                        plant = plants[0]
                        plant_image = plant.get('image')
                        
                        # If image is not directly available, try to get from images array
                        if not plant_image and 'images' in plant and plant['images'] and len(plant['images']) > 0:
                            plant_image = plant['images'][0]
                            
                        plant_info = {
                            "name": plant.get('title', 'Plant Discussion'),
                            "id": plant.get('id'),
                            "image": plant_image
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
        
        return create_success_response(enhanced_conversations)
    
    except Exception as e:
        logging.error(f"Error getting user conversations: {str(e)}")
        return create_error_response(str(e), 500)