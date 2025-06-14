# backend/get-all-businesses/__init__.py - FIXED VERSION
import json
import logging
import azure.functions as func
from azure.cosmos import CosmosClient
import os

# Initialize Cosmos client
COSMOS_CONNECTION_STRING = os.environ.get('COSMOSDB__MARKETPLACE_CONNECTION_STRING')
DATABASE_NAME = os.environ.get('COSMOSDB_MARKETPLACE_DATABASE_NAME', 'greener-marketplace-db')

def add_cors_headers(response):
    """Add CORS headers to response"""
    response.headers.update({
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Email, X-Business-ID'
    })
    return response

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Getting all businesses for marketplace')
    
    # Handle CORS
    if req.method == 'OPTIONS':
        response = func.HttpResponse("", status_code=200)
        return add_cors_headers(response)
    
    try:
        # Parse connection string
        params = dict(param.split('=', 1) for param in COSMOS_CONNECTION_STRING.split(';'))
        account_endpoint = params.get('AccountEndpoint')
        account_key = params.get('AccountKey')
        
        if not account_endpoint or not account_key:
            raise ValueError("Invalid marketplace connection string")
        
        # Create client and get container
        client = CosmosClient(account_endpoint, credential=account_key)
        database = client.get_database_client(DATABASE_NAME)
        business_container = database.get_container_client('business_users')
        
        # FIXED: Get all active businesses with better error handling
        query = """
        SELECT c.id, c.email, c.businessName, c.name, c.businessType, 
               c.logo, c.address, c.rating, c.reviewCount, c.status, c.joinDate
        FROM c 
        WHERE c.status = 'active' OR NOT IS_DEFINED(c.status)
        """
        
        businesses = list(business_container.query_items(
            query=query,
            enable_cross_partition_query=True
        ))
        
        logging.info(f"Found {len(businesses)} businesses")
        
        # FIXED: Format businesses for marketplace with consistent structure
        formatted_businesses = []
        for business in businesses:
            formatted_business = {
                'id': business.get('id', business.get('email')),
                'email': business.get('email'),
                'businessName': business.get('businessName', business.get('name', 'Business')),
                'name': business.get('businessName', business.get('name', 'Business')),
                'businessType': business.get('businessType', 'Plant Business'),
                'description': business.get('description', ''),
                'logo': business.get('logo'),
                'address': business.get('address', {}),
                'location': business.get('address', {}),  # Alias for compatibility
                'rating': business.get('rating', 0),
                'reviewCount': business.get('reviewCount', 0),
                'status': business.get('status', 'active'),
                'joinDate': business.get('joinDate', ''),
                'isBusiness': True,
                'isVerified': business.get('isVerified', False)
            }
            formatted_businesses.append(formatted_business)
        
        # FIXED: Consistent response structure
        response_data = {
            "success": True,
            "businesses": formatted_businesses,
            "count": len(formatted_businesses)
        }
        
        response = func.HttpResponse(
            json.dumps(response_data, default=str),
            status_code=200,
            headers={"Content-Type": "application/json"}
        )
        return add_cors_headers(response)
        
    except Exception as e:
        logging.error(f"Error getting businesses: {str(e)}")
        response = func.HttpResponse(
            json.dumps({"error": f"Failed to get businesses: {str(e)}"}),
            status_code=500,
            headers={"Content-Type": "application/json"}
        )
        return add_cors_headers(response)