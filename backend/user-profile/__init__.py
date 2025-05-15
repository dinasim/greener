import logging
import json
from datetime import datetime
import azure.functions as func
from db_helpers import get_container, get_main_container, get_marketplace_container
from http_helpers import (
    add_cors_headers,
    handle_options_request,
    create_error_response,
    create_success_response,
    extract_user_id,
)

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

# ========== GET Handler ==========

def handle_get_user(req: func.HttpRequest) -> func.HttpResponse:
    try:
        user_id = req.route_params.get('id') or extract_user_id(req)
        if not user_id:
            return create_error_response("User ID is required", 400)

        # Step 1: Try marketplace DB
        try:
            marketplace_container = get_marketplace_container("users")
            marketplace_users = find_user(marketplace_container, user_id)
            if marketplace_users:
                logging.info(f"[MarketplaceDB] Found user: {user_id}")
                return create_success_response({"user": marketplace_users[0]})
        except Exception as e:
            logging.warning(f"[MarketplaceDB] Failed to fetch user: {e}")

        # Step 2: Try to copy from main DB
        try:
            main_container = get_main_container("Users")
            main_users = find_user(main_container, user_id)
            if main_users:
                user = main_users[0]
                user["copiedAt"] = datetime.utcnow().isoformat()

                # Create in marketplace DB
                marketplace_container = get_marketplace_container("users")
                marketplace_container.create_item(body=user)

                logging.info(f"[Sync] User copied from Main to Marketplace DB: {user_id}")
                return create_success_response({"user": user})
            else:
                logging.info(f"[MainDB] No user found with id/email: {user_id}")
        except Exception as e:
            logging.error(f"[Main→Marketplace Sync] Failed: {e}")

        return create_error_response("User not found", 404)

    except Exception as e:
        logging.error(f"[GET] Fatal error: {e}")
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

        try:
            container = get_marketplace_container("users")
            users = find_user(container, user_id)

            if users:
                user = users[0]
                for key, value in update_data.items():
                    if key not in ['id', 'email']:
                        user[key] = value

                container.replace_item(item=user['id'], body=user)
                logging.info(f"[PATCH] User updated: {user_id}")
                return create_success_response({
                    "message": "User profile updated successfully",
                    "user": user
                })

            return create_error_response("User not found in marketplace DB", 404)

        except Exception as e:
            logging.error(f"[PATCH] Error updating user: {e}")
            return create_error_response("Failed to update user profile", 500)

    except Exception as e:
        logging.error(f"[PATCH] Fatal error: {e}")
        return create_error_response(str(e), 500)
