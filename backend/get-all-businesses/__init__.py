# backend/get-all-businesses/__init__.py
import json
import logging
import azure.functions as func
from azure.cosmos import CosmosClient
import os

COSMOS_CONNECTION_STRING = os.environ.get('COSMOSDB__MARKETPLACE_CONNECTION_STRING')
DATABASE_NAME = os.environ.get('COSMOSDB_MARKETPLACE_DATABASE_NAME', 'greener-marketplace-db')

def add_cors_headers(response):
    response.headers.update({
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Email, X-Business-ID'
    })
    return response

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Getting all businesses for marketplace')

    if req.method == 'OPTIONS':
        return add_cors_headers(func.HttpResponse("", status_code=200))

    try:
        params = dict(param.split('=', 1) for param in COSMOS_CONNECTION_STRING.split(';'))
        account_endpoint = params.get('AccountEndpoint')
        account_key = params.get('AccountKey')
        if not account_endpoint or not account_key:
            raise ValueError("Invalid marketplace connection string")

        client = CosmosClient(account_endpoint, credential=account_key)
        database = client.get_database_client(DATABASE_NAME)
        business_container = database.get_container_client('business_users')

        query = """
        SELECT * FROM c 
        WHERE c.status = 'active' OR NOT IS_DEFINED(c.status)
        """

        businesses = list(business_container.query_items(
            query=query,
            enable_cross_partition_query=True
        ))

        formatted_businesses = []
        for b in businesses:
            addr = b.get('address', {}) or {}
            loc  = b.get('location', {}) or {}
            # merge coords in both objects
            address_out = {
                **addr,
                'latitude': addr.get('latitude') or loc.get('latitude'),
                'longitude': addr.get('longitude') or loc.get('longitude'),
            }
            location_out = {
                'latitude':  loc.get('latitude')  or addr.get('latitude'),
                'longitude': loc.get('longitude') or addr.get('longitude'),
                'city': addr.get('city') or loc.get('city', ''),
                'country': addr.get('country') or loc.get('country', ''),
                'formattedAddress': addr.get('formattedAddress') or addr.get('street') or ''
            }

            formatted_businesses.append({
                'id': b.get('id', b.get('email')),
                'email': b.get('email'),
                'businessName': b.get('businessName', b.get('name', 'Business')),
                'name': b.get('businessName', b.get('name', 'Business')),
                'businessType': b.get('businessType', 'Plant Business'),
                'description': b.get('description', ''),
                'logo': b.get('logo'),
                'address': address_out,
                'location': location_out,
                'rating': b.get('rating', 0),
                'reviewCount': b.get('reviewCount', 0),
                'status': b.get('status', 'active'),
                'joinDate': b.get('joinDate', ''),
                'isBusiness': True,
                'isVerified': b.get('isVerified', False)
            })

        response = func.HttpResponse(
            json.dumps({ "success": True, "businesses": formatted_businesses, "count": len(formatted_businesses) }, default=str),
            status_code=200,
            headers={"Content-Type": "application/json"}
        )
        return add_cors_headers(response)

    except Exception as e:
        logging.error(f"Error getting businesses: {str(e)}")
        return add_cors_headers(func.HttpResponse(
            json.dumps({"error": f"Failed to get businesses: {str(e)}"}),
            status_code=500,
            headers={"Content-Type": "application/json"}
        ))
