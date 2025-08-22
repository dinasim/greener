# conversations/__init__.py - FIXED VERSION with Business and Individual Plant Integration
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

        logging.info(f"Getting conversations for user: {user_id}")

        # Access the marketplace_conversations_new container
        container = get_container("marketplace_conversations_new")

        # Query for conversations where the user is a participant
        query = "SELECT * FROM c WHERE ARRAY_CONTAINS(c.participants, @userId)"
        parameters = [{"name": "@userId", "value": user_id}]

        conversations = list(container.query_items(
            query=query,
            parameters=parameters,
            enable_cross_partition_query=True
        ))

        logging.info(f"Found {len(conversations)} conversations for user {user_id}")

        # Enhance conversations with additional information
        enhanced_conversations = []
        for conv in conversations:
            try:
                # Get the other participant
                participants = conv.get('participants', [])
                other_user_id = next((p for p in participants if p != user_id), None)

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
                    try:
                        users_container = get_container("users")
                        user_query = "SELECT c.name, c.avatar, c.isBusiness FROM c WHERE c.id = @id OR c.email = @email"
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
                            user_data = users[0]
                            other_user = {
                                "name": user_data.get('name', 'User'),
                                "avatar": user_data.get('avatar'),
                                "business": user_data.get('isBusiness', False)
                            }
                            logging.debug(f"Found user: {other_user['name']}")
                        else:
                            # If not found in users, try business_users container
                            try:
                                business_container = get_container("business_users")
                                business_query = "SELECT c.businessName, c.logo, c.name FROM c WHERE c.id = @id OR c.email = @email"
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
                                    business_data = businesses[0]
                                    other_user = {
                                        "name": business_data.get('businessName') or business_data.get('name', 'Business'),
                                        "avatar": business_data.get('logo'),
                                        "business": True
                                    }
                                    logging.debug(f"Found business: {other_user['name']}")
                                    
                            except Exception as business_error:
                                logging.warning(f"Error querying business_users: {str(business_error)}")
                                
                    except Exception as users_error:
                        logging.warning(f"Error querying users: {str(users_error)}")

                # Get plant information if plantId exists
                if conv.get('plantId'):
                    try:
                        # First, determine if we need to look in inventory (business) or marketplace_plants (individual)
                        if other_user['business']:
                            # Look in inventory container for business plants
                            inventory_container = get_container("inventory")
                            plant_query = "SELECT c.id, c.name, c.common_name, c.productName, c.mainImage, c.images FROM c WHERE c.id = @id AND c.businessId = @businessId"
                            plant_params = [
                                {"name": "@id", "value": conv['plantId']},
                                {"name": "@businessId", "value": other_user_id}
                            ]

                            plants = list(inventory_container.query_items(
                                query=plant_query,
                                parameters=plant_params,
                                enable_cross_partition_query=True
                            ))

                            if plants:
                                plant = plants[0]
                                plant_image = plant.get('mainImage')

                                # If mainImage is not available, try to get from images array
                                if not plant_image and plant.get('images') and len(plant['images']) > 0:
                                    plant_image = plant['images'][0]

                                plant_info = {
                                    "name": plant.get('productName') or plant.get('name') or plant.get('common_name', 'Business Plant'),
                                    "id": plant.get('id'),
                                    "image": plant_image
                                }
                                logging.debug(f"Found business plant: {plant_info['name']}")
                        else:
                            # Look in marketplace_plants container for individual plants
                            plants_container = get_container("marketplace_plants")
                            plant_query = "SELECT c.id, c.title, c.name, c.image, c.images FROM c WHERE c.id = @id"
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
                                if not plant_image and plant.get('images') and len(plant['images']) > 0:
                                    plant_image = plant['images'][0]

                                plant_info = {
                                    "name": plant.get('title') or plant.get('name', 'Individual Plant'),
                                    "id": plant.get('id'),
                                    "image": plant_image
                                }
                                logging.debug(f"Found individual plant: {plant_info['name']}")
                            
                    except Exception as plant_error:
                        logging.warning(f"Error querying plants: {str(plant_error)}")

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
                    "unreadCount": conv.get('unreadCounts', {}).get(user_id, 0),
                    "isBusiness": other_user['business']
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
                    "unreadCount": 0,
                    "isBusiness": False
                })

        # Sort by last message timestamp, most recent first
        enhanced_conversations.sort(
            key=lambda c: c.get('lastMessageTimestamp', ''),
            reverse=True
        )

        logging.info(f"Returning {len(enhanced_conversations)} enhanced conversations")
        
        return create_success_response(enhanced_conversations)
        
    except Exception as e:
        logging.error(f"Error getting user conversations: {str(e)}")
        return create_error_response(f"Failed to get conversations: {str(e)}", 500)