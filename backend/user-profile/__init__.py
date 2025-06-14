# backend/user-profile/__init__.py
import logging
import json
from datetime import datetime
import azure.functions as func
from db_helpers import get_container, get_main_container, get_marketplace_container
from http_helpers import add_cors_headers, handle_options_request, create_error_response, create_success_response, extract_user_id

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('User profile API triggered.')

    if req.method == 'OPTIONS':
        return handle_options_request()

    if req.method == 'GET':
        return handle_get_user(req)

    if req.method == 'PATCH':
        return handle_patch_user(req)

    return create_error_response("Unsupported HTTP method", 405)

# ========== Utility ==========

def find_user(container, user_id):
    query = "SELECT * FROM c WHERE c.email = @email OR c.id = @id"
    params = [
        {"name": "@email", "value": user_id},
        {"name": "@id", "value": user_id}
    ]
    return list(container.query_items(query=query, parameters=params, enable_cross_partition_query=True))

def get_user_listings(user_id, user_info=None):
    try:
        # Get the marketplace_plants container
        plants_container = get_container("marketplace_plants")
        
        # Get active listings (must use cross-partition query since partitioned by category)
        active_query = "SELECT * FROM c WHERE c.sellerId = @sellerId AND (c.status = 'active' OR NOT IS_DEFINED(c.status))"
        sold_query = "SELECT * FROM c WHERE c.sellerId = @sellerId AND c.status = 'sold'"
        parameters = [{"name": "@sellerId", "value": user_id}]
        
        active_listings = list(plants_container.query_items(
            query=active_query,
            parameters=parameters,
            enable_cross_partition_query=True
        ))
        
        sold_listings = list(plants_container.query_items(
            query=sold_query,
            parameters=parameters,
            enable_cross_partition_query=True
        ))

        # If user_info is provided, add it to each listing
        if user_info:
            # Create a seller info object
            seller_info = {
                "id": user_info.get("id"),
                "_id": user_info.get("id"),
                "name": user_info.get("name", "Unknown Seller"),
                "email": user_info.get("email"),
                "avatar": user_info.get("avatar")
            }
            
            # Add seller info to all listings
            for listing in active_listings + sold_listings:
                listing["seller"] = seller_info
                
                # Make sure sellerId is set
                if "sellerId" not in listing:
                    listing["sellerId"] = user_id
        
        return active_listings, sold_listings
    except Exception as e:
        logging.error(f"Error getting user listings: {str(e)}")
        return [], []

def get_user_favorites(user_id):
    try:
        # Get wishlist container
        wishlist_container = get_container("marketplace-wishlists")
        
        # Get wishlist items
        query = "SELECT * FROM c WHERE c.userId = @userId"
        parameters = [{"name": "@userId", "value": user_id}]
        
        wishlist_items = list(wishlist_container.query_items(
            query=query,
            parameters=parameters,
            enable_cross_partition_query=True
        ))
        
        # Get plant details for each wishlist item
        if wishlist_items:
            plants_container = get_container("marketplace_plants")
            favorites = []
            
            for item in wishlist_items:
                plant_id = item.get('plantId')
                if not plant_id:
                    continue
                
                plant_query = "SELECT * FROM c WHERE c.id = @id"
                plant_params = [{"name": "@id", "value": plant_id}]
                
                plants = list(plants_container.query_items(
                    query=plant_query,
                    parameters=plant_params,
                    enable_cross_partition_query=True
                ))
                
                if plants:
                    plant = plants[0]
                    plant['wishlistId'] = item.get('id')
                    plant['isWished'] = True
                    favorites.append(plant)
            
            return favorites
        
        return []
    except Exception as e:
        logging.error(f"Error getting user favorites: {str(e)}")
        return []

def get_user_rating(user_id):
    try:
        # Get reviews container
        reviews_container = get_container("marketplace-reviews")
        
        # Get count and average of reviews
        count_query = "SELECT VALUE COUNT(1) FROM c WHERE c.targetId = @targetId AND c.targetType = 'seller'"
        avg_query = "SELECT VALUE AVG(c.rating) FROM c WHERE c.targetId = @targetId AND c.targetType = 'seller'"
        parameters = [{"name": "@targetId", "value": user_id}]
        
        count_result = list(reviews_container.query_items(
            query=count_query,
            parameters=parameters,
            enable_cross_partition_query=True
        ))
        
        avg_result = list(reviews_container.query_items(
            query=avg_query,
            parameters=parameters,
            enable_cross_partition_query=True
        ))
        
        count = count_result[0] if count_result else 0
        avg = avg_result[0] if avg_result else 0
        
        return count, avg
    except Exception as e:
        logging.error(f"Error getting user rating: {str(e)}")
        return 0, 0

# ========== GET Handler ==========

def handle_get_user(req: func.HttpRequest) -> func.HttpResponse:
    try:
        user_id = req.route_params.get('id') or extract_user_id(req)
        if not user_id:
            return create_error_response("User ID is required", 400)

        logging.info(f"Looking for user: {user_id}")
        
        # Step 1: Try marketplace DB first (correct container: "users")
        marketplace_container = get_marketplace_container("users")
        marketplace_users = find_user(marketplace_container, user_id)
        
        if marketplace_users:
            # User exists in marketplace DB
            user = marketplace_users[0]
            logging.info(f"Found user in marketplace DB: {user_id}")
            
            # FIXED: Check if user profile is incomplete and needs updating from main DB
            main_container = get_main_container("Users")
            main_users = find_user(main_container, user_id)
            
            if main_users:
                main_user = main_users[0]
                user_updated = False
                
                # Copy missing fields from main DB to marketplace profile
                fields_to_copy = [
                    'animals', 'kids', 'location', 'plantLocations', 
                    'interested', 'fullAddress', 'city'
                ]
                
                for field in fields_to_copy:
                    if field in main_user and (field not in user or not user[field]):
                        user[field] = main_user[field]
                        user_updated = True
                        logging.info(f"Copied missing field '{field}' from main DB")
                
                # If location object exists in main DB but not in marketplace, copy it
                if 'location' in main_user and isinstance(main_user['location'], dict):
                    if 'location' not in user or not isinstance(user.get('location'), dict):
                        user['location'] = main_user['location']
                        user_updated = True
                    else:
                        # Merge location fields
                        for loc_field in ['city', 'address', 'latitude', 'longitude']:
                            if loc_field in main_user['location'] and loc_field not in user['location']:
                                user['location'][loc_field] = main_user['location'][loc_field]
                                user_updated = True
                
                # Update the marketplace profile if we made changes
                if user_updated:
                    try:
                        marketplace_container.replace_item(item=user['id'], body=user)
                        logging.info(f"Updated marketplace profile with missing fields from main DB")
                    except Exception as update_error:
                        logging.warning(f"Could not update marketplace profile: {str(update_error)}")
            
            # Get user's listings
            active_listings, sold_listings = get_user_listings(user_id, user)
            
            # Get user's favorites (wishlist)
            favorites = get_user_favorites(user_id)
            
            # Get user's rating
            review_count, rating_avg = get_user_rating(user_id)
            
            # Add listings to user object
            user['listings'] = active_listings + sold_listings
            
            # Add favorites to user object
            user['favorites'] = favorites
            
            # Ensure stats object exists
            if 'stats' not in user:
                user['stats'] = {}
            
            # Update stats with actual counts
            user['stats']['plantsCount'] = len(active_listings)
            user['stats']['salesCount'] = len(sold_listings)
            
            # Update rating if we have reviews
            if review_count > 0:
                user['stats']['rating'] = rating_avg
                user['stats']['reviewCount'] = review_count
            
            return create_success_response({"user": user})
        
        # Step 2: If not found in marketplace DB, try to copy from main DB
        logging.info(f"User not found in marketplace DB, checking main DB: {user_id}")
        main_container = get_main_container("Users")
        main_users = find_user(main_container, user_id)
        
        if main_users:
            # User exists in main DB, copy to marketplace
            user = main_users[0]
            logging.info(f"Found user in main DB, copying to marketplace DB: {user_id}")
            
            # Ensure ID field exists
            if 'id' not in user:
                user['id'] = user_id
            
            # FIXED: Initialize marketplace-specific fields while preserving main DB fields
            marketplace_fields = {
                'bio': user.get('bio', ''),
                'joinDate': user.get('joinDate', datetime.utcnow().isoformat()),
                'stats': {
                    'plantsCount': 0,
                    'salesCount': 0,
                    'rating': 0,
                    'reviewCount': 0
                },
                'socialMedia': user.get('socialMedia', {}),
                'avatar': user.get('avatar'),
                'copiedAt': datetime.utcnow().isoformat()
            }
            
            # Merge marketplace fields with existing user data
            user.update(marketplace_fields)
            
            # Ensure important main DB fields are preserved
            main_db_fields = [
                'animals', 'kids', 'location', 'plantLocations', 
                'interested', 'fullAddress', 'city', 'name', 'username'
            ]
            
            original_user = main_users[0]
            for field in main_db_fields:
                if field in original_user:
                    user[field] = original_user[field]
            
            # Create in marketplace DB
            try:
                marketplace_container.create_item(body=user)
                logging.info(f"User copied from main DB to marketplace DB with all fields preserved: {user_id}")
                
                # Get user's listings
                active_listings, sold_listings = get_user_listings(user_id, user)
                
                # Get user's favorites (wishlist)
                favorites = get_user_favorites(user_id)
                
                # Get user's rating
                review_count, rating_avg = get_user_rating(user_id)
                
                # Add listings to user object
                user['listings'] = active_listings + sold_listings
                
                # Add favorites to user object
                user['favorites'] = favorites
                
                # Update stats with actual counts
                user['stats']['plantsCount'] = len(active_listings)
                user['stats']['salesCount'] = len(sold_listings)
                
                # Update rating if we have reviews
                if review_count > 0:
                    user['stats']['rating'] = rating_avg
                    user['stats']['reviewCount'] = review_count
                
                return create_success_response({"user": user})
            except Exception as copy_error:
                logging.error(f"Error copying user to marketplace DB: {str(copy_error)}")
                # Return the user anyway
                return create_success_response({"user": user})
        
        # Step 3: User not found in either database
        logging.info(f"User not found in any database: {user_id}")
        return create_error_response("User not found", 404)

    except Exception as e:
        logging.error(f"Error in GET handler: {str(e)}")
        return create_error_response(str(e), 500)

# ========== PATCH Handler ==========

def handle_patch_user(req: func.HttpRequest) -> func.HttpResponse:
    try:
        user_id = req.route_params.get('id')
        if not user_id:
            return create_error_response("User ID is required", 400)

        try:
            update_data = req.get_json()
        except ValueError:
            return create_error_response("Invalid JSON body", 400)

        if not isinstance(update_data, dict):
            return create_error_response("Update data must be a JSON object", 400)

        # Get user from marketplace DB
        marketplace_container = get_marketplace_container("users")
        marketplace_users = find_user(marketplace_container, user_id)
        
        if marketplace_users:
            # User exists in marketplace DB, update
            user = marketplace_users[0]
            logging.info(f"Updating existing user in marketplace DB: {user_id}")
            
            # FIXED: Ensure we also sync missing fields from main DB during updates
            main_container = get_main_container("Users")
            main_users = find_user(main_container, user_id)
            
            if main_users:
                main_user = main_users[0]
                
                # Copy missing fields from main DB during update
                fields_to_preserve = [
                    'animals', 'kids', 'location', 'plantLocations', 
                    'interested', 'fullAddress', 'city', 'username'
                ]
                
                for field in fields_to_preserve:
                    if field in main_user and (field not in user or not user[field]):
                        user[field] = main_user[field]
                        logging.info(f"Preserved missing field '{field}' during update")
                
                # Handle location object merging
                if 'location' in main_user and isinstance(main_user['location'], dict):
                    if 'location' not in user or not isinstance(user.get('location'), dict):
                        user['location'] = main_user['location']
                    else:
                        # Merge location fields
                        for loc_field in ['city', 'address', 'latitude', 'longitude']:
                            if loc_field in main_user['location'] and loc_field not in user['location']:
                                user['location'][loc_field] = main_user['location'][loc_field]
            
            # Update user fields from request
            for key, value in update_data.items():
                if key not in ['id', 'email']:
                    user[key] = value
            
            # Update the user
            marketplace_container.replace_item(item=user['id'], body=user)
            
            # Get updated listings
            active_listings, sold_listings = get_user_listings(user_id, user)
            
            # Get user's favorites (wishlist)
            favorites = get_user_favorites(user_id)
            
            # Get user's rating
            review_count, rating_avg = get_user_rating(user_id)
            
            # Add listings to response object but don't store them in DB
            user['listings'] = active_listings + sold_listings
            
            # Add favorites to response object
            user['favorites'] = favorites
            
            # Ensure stats object exists
            if 'stats' not in user:
                user['stats'] = {}
            
            # Update stats with actual counts
            user['stats']['plantsCount'] = len(active_listings)
            user['stats']['salesCount'] = len(sold_listings)
            
            # Update rating if we have reviews
            if review_count > 0:
                user['stats']['rating'] = rating_avg
                user['stats']['reviewCount'] = review_count
            
            return create_success_response({
                "message": "User profile updated successfully",
                "user": user
            })
        else:
            # User doesn't exist in marketplace DB, try to find in main DB first
            main_container = get_main_container("Users")
            main_users = find_user(main_container, user_id)
            
            if main_users:
                # User exists in main DB, copy and update
                user = main_users[0]
                logging.info(f"User found in main DB, copying to marketplace DB with updates: {user_id}")
                
                # Ensure ID field exists
                if 'id' not in user:
                    user['id'] = user_id
                
                # FIXED: Initialize marketplace-specific fields while preserving main DB fields
                marketplace_fields = {
                    'bio': user.get('bio', ''),
                    'joinDate': user.get('joinDate', datetime.utcnow().isoformat()),
                    'stats': {
                        'plantsCount': 0,
                        'salesCount': 0,
                        'rating': 0,
                        'reviewCount': 0
                    },
                    'socialMedia': user.get('socialMedia', {}),
                    'avatar': user.get('avatar'),
                    'copiedAt': datetime.utcnow().isoformat()
                }
                
                # Merge marketplace fields with existing user data
                user.update(marketplace_fields)
                
                # Ensure important main DB fields are preserved
                main_db_fields = [
                    'animals', 'kids', 'location', 'plantLocations', 
                    'interested', 'fullAddress', 'city', 'name', 'username'
                ]
                
                original_user = main_users[0]
                for field in main_db_fields:
                    if field in original_user:
                        user[field] = original_user[field]
                
                # Apply updates from request
                for key, value in update_data.items():
                    if key not in ['id', 'email']:
                        user[key] = value
                
                # Create in marketplace DB
                marketplace_container.create_item(body=user)
                logging.info(f"User copied from main DB to marketplace DB with all fields preserved and updates applied: {user_id}")
                
                # Get user's listings
                active_listings, sold_listings = get_user_listings(user_id, user)
                
                # Get user's favorites (wishlist)
                favorites = get_user_favorites(user_id)
                
                # Get user's rating
                review_count, rating_avg = get_user_rating(user_id)
                
                # Add listings to response object
                user['listings'] = active_listings + sold_listings
                
                # Add favorites to response object
                user['favorites'] = favorites
                
                # Update stats with actual counts
                user['stats']['plantsCount'] = len(active_listings)
                user['stats']['salesCount'] = len(sold_listings)
                
                # Update rating if we have reviews
                if review_count > 0:
                    user['stats']['rating'] = rating_avg
                    user['stats']['reviewCount'] = review_count
                
                return create_success_response({
                    "message": "User profile created and updated successfully",
                    "user": user
                })
            else:
                # User doesn't exist in either DB, create minimal profile
                logging.info(f"Creating new user in marketplace DB: {user_id}")
                
                # Create minimal user
                new_user = {
                    "id": user_id,
                    "email": user_id,
                    "name": update_data.get("name", user_id.split('@')[0] if '@' in user_id else user_id),
                    "joinDate": datetime.utcnow().isoformat(),
                    "stats": {
                        "plantsCount": 0,
                        "salesCount": 0,
                        "rating": 0,
                        "reviewCount": 0
                    }
                }
                
                # Apply updates
                for key, value in update_data.items():
                    if key not in ['id', 'email']:
                        new_user[key] = value
                
                # Create in marketplace DB
                marketplace_container.create_item(body=new_user)
                logging.info(f"New user created in marketplace DB: {user_id}")
                
                return create_success_response({
                    "message": "User profile created successfully",
                    "user": new_user
                })

    except Exception as e:
        logging.error(f"Error in PATCH handler: {str(e)}")
        return create_error_response(str(e), 500)