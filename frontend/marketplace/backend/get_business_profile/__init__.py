# backend/get_business_profile/__init__.py - FIXED VERSION
import json
import logging
import azure.functions as func
from azure.cosmos import CosmosClient
import os

# Import standardized helpers
import sys
sys.path.append('..')
from http_helpers import add_cors_headers, get_user_id_from_request, create_success_response, create_error_response

# Initialize Cosmos client
COSMOS_CONNECTION_STRING = os.environ.get('COSMOSDB__MARKETPLACE_CONNECTION_STRING')
DATABASE_NAME = os.environ.get('COSMOSDB_MARKETPLACE_DATABASE_NAME', 'greener-marketplace-db')

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Getting business profile')

    # Handle CORS
    if req.method == 'OPTIONS':
        response = func.HttpResponse("", status_code=200)
        return add_cors_headers(response)

    try:
        # FIXED: Get business ID from route params using standardized function
        business_id = req.route_params.get('businessId') or get_user_id_from_request(req)

        if not business_id:
            return create_error_response("Business ID is required", 400)

        logging.info(f"Fetching profile for business: {business_id}")

        # Parse connection string
        params = dict(param.split('=', 1) for param in COSMOS_CONNECTION_STRING.split(';'))
        account_endpoint = params.get('AccountEndpoint')
        account_key = params.get('AccountKey')

        if not account_endpoint or not account_key:
            raise ValueError("Invalid marketplace connection string")

        # Create client and get containers
        client = CosmosClient(account_endpoint, credential=account_key)
        database = client.get_database_client(DATABASE_NAME)
        business_container = database.get_container_client('business_users')
        inventory_container = database.get_container_client('inventory')

        # Get business profile
        try:
            # Try to get business by ID first
            business = business_container.read_item(item=business_id, partition_key=business_id)
            logging.info(f"Found business by direct read: {business_id}")
        except:
            # If not found by ID, try by email using query
            query = "SELECT * FROM c WHERE c.email = @businessId OR c.id = @businessId"
            results = list(business_container.query_items(
                query=query,
                parameters=[{"name": "@businessId", "value": business_id}],
                enable_cross_partition_query=True
            ))

            if not results:
                return create_error_response("Business not found", 404)

            business = results[0]
            logging.info(f"Found business by query: {business_id}")

        # Get business inventory
        try:
            inventory_query = "SELECT * FROM c WHERE c.businessId = @businessId AND c.status = 'active'"
            inventory_items = list(inventory_container.query_items(
                query=inventory_query,
                parameters=[{"name": "@businessId", "value": business.get('id', business.get('email'))}],
                enable_cross_partition_query=True
            ))

            logging.info(f"Found {len(inventory_items)} inventory items")
        except Exception as e:
            logging.warning(f"Error getting inventory: {str(e)}")
            inventory_items = []

        # FIXED: Format business profile response with CONSISTENT structure
        business_profile = {
            'id': business.get('id', business.get('email')),
            'email': business.get('email'),
            'businessName': business.get('businessName', ''),
            'name': business.get('businessName', business.get('name', '')),
            'businessType': business.get('businessType', 'Business'),
            'description': business.get('description', ''),
            'logo': business.get('logo', ''),
            'contactPhone': business.get('contactPhone', ''),
            'contactEmail': business.get('contactEmail', business.get('email')),
            'address': business.get('address', {}),
            'location': business.get('address', {}),  # Alias for compatibility
            'businessHours': business.get('businessHours', []),
            'socialMedia': business.get('socialMedia', {}),
            'joinDate': business.get('joinDate', ''),
            'status': business.get('status', 'active'),
            'paymentMethods': business.get('paymentMethods', []),
            'rating': business.get('rating', 0),
            'reviewCount': business.get('reviewCount', 0),
            'isVerified': business.get('isVerified', False),
            'settings': business.get('settings', {}),
            'isBusiness': True,
            'inventory': inventory_items  # Always include inventory at root level
        }

        # FIXED: Consistent response structure that matches frontend expectations
        response_data = {
            "success": True,
            "business": business_profile,
            "inventory": inventory_items,  # Also at root for compatibility
            "inventoryCount": len(inventory_items)
        }

        return create_success_response(response_data)

    except Exception as e:
        logging.error(f"Error getting business profile: {str(e)}")
        return create_error_response(f"Internal server error: {str(e)}", 500)
