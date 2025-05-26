# get_business_profile/__init__.py
import json
import logging
import azure.functions as func
from azure.cosmos import CosmosClient
import os

# Initialize Cosmos client
COSMOS_CONNECTION_STRING = os.environ.get('COSMOSDB__MARKETPLACE_CONNECTION_STRING')
DATABASE_NAME = os.environ.get('COSMOSDB_MARKETPLACE_DATABASE_NAME', 'greener-marketplace-db')

cosmos_client = CosmosClient.from_connection_string(COSMOS_CONNECTION_STRING)
database = cosmos_client.get_database_client(DATABASE_NAME)

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Getting business profile')
    
    try:
        # Get business ID from path
        business_id = req.route_params.get('businessId')
        
        if not business_id:
            return func.HttpResponse(
                json.dumps({"error": "Business ID is required"}),
                status_code=400,
                headers={"Content-Type": "application/json"}
            )
        
        # Get business users container
        business_container = database.get_container_client('business_users')
        
        try:
            # Try to get business by ID
            business = business_container.read_item(item=business_id, partition_key=business_id)
        except:
            # If not found by ID, try by email
            query = "SELECT * FROM c WHERE c.email = @businessId"
            results = list(business_container.query_items(
                query=query,
                parameters=[{"name": "@businessId", "value": business_id}],
                enable_cross_partition_query=True
            ))
            
            if not results:
                return func.HttpResponse(
                    json.dumps({"error": "Business not found"}),
                    status_code=404,
                    headers={"Content-Type": "application/json"}
                )
            
            business = results[0]
        
        # Get business inventory
        inventory_container = database.get_container_client('inventory')
        
        try:
            inventory_query = "SELECT * FROM c WHERE c.businessId = @businessId AND c.status = 'active'"
            inventory_items = list(inventory_container.query_items(
                query=inventory_query,
                parameters=[{"name": "@businessId", "value": business.get('id', business.get('email'))}],
                enable_cross_partition_query=True
            ))
        except Exception as e:
            logging.warning(f"Error getting inventory: {str(e)}")
            inventory_items = []
        
        # Format business profile response
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
            'businessHours': business.get('businessHours', []),
            'socialMedia': business.get('socialMedia', {}),
            'joinDate': business.get('joinDate', ''),
            'status': business.get('status', 'active'),
            'paymentMethods': business.get('paymentMethods', []),
            'rating': business.get('rating', 0),
            'reviewCount': business.get('reviewCount', 0),
            'isVerified': business.get('isVerified', False),
            'settings': business.get('settings', {}),
            'inventory': inventory_items,
            'isBusiness': True
        }
        
        response_data = {
            "business": business_profile,
            "inventoryCount": len(inventory_items)
        }
        
        return func.HttpResponse(
            json.dumps(response_data),
            status_code=200,
            headers={
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type, Authorization, X-User-Email"
            }
        )
        
    except Exception as e:
        logging.error(f"Error getting business profile: {str(e)}")
        return func.HttpResponse(
            json.dumps({"error": f"Internal server error: {str(e)}"}),
            status_code=500,
            headers={"Content-Type": "application/json"}
        )