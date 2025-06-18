import logging
import json
import azure.functions as func
import os
from azure.cosmos import CosmosClient, exceptions
import bcrypt

def add_cors_headers(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type,Authorization,X-User-Email,X-Business-ID'
    return response

def create_success_response(data, status_code=200):
    response = func.HttpResponse(
        body=json.dumps(data),
        status_code=status_code,
        mimetype="application/json"
    )
    return add_cors_headers(response)

def create_error_response(message, status_code=400):
    response = func.HttpResponse(
        body=json.dumps({"error": message, "success": False}),
        status_code=status_code,
        mimetype="application/json"
    )
    return add_cors_headers(response)

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Business login function processed a request.')
    if req.method == 'OPTIONS':
        return add_cors_headers(func.HttpResponse("", status_code=200))
    try:
        req_body = req.get_json()
        email = req_body.get('email')
        password = req_body.get('password')
        if not email or not password:
            return create_error_response("Email and password are required", 400)
        # Connect to Cosmos DB
        connection_string = os.environ.get("COSMOSDB__MARKETPLACE_CONNECTION_STRING")
        database_name = os.environ.get("COSMOSDB_MARKETPLACE_DATABASE_NAME", "GreenerMarketplace")
        if not connection_string:
            return create_error_response("Database connection not configured", 500)
        params = dict(param.split('=', 1) for param in connection_string.split(';') if '=' in param)
        account_endpoint = params.get('AccountEndpoint')
        account_key = params.get('AccountKey')
        client = CosmosClient(account_endpoint, credential=account_key)
        database = client.get_database_client(database_name)
        business_container = database.get_container_client('business_users')
        # Query for business by email
        query = "SELECT * FROM business_users b WHERE LOWER(b.email) = @email"
        items = list(business_container.query_items(
            query=query,
            parameters=[{"name": "@email", "value": email.lower()}],
            enable_cross_partition_query=True
        ))
        if not items:
            return create_error_response("Business not found", 404)
        business = items[0]
        # Password check using bcrypt
        password_hash = business.get('passwordHash')
        if not password_hash:
            return create_error_response("No password set for this business account", 400)
        if not bcrypt.checkpw(password.encode('utf-8'), password_hash.encode('utf-8')):
            return create_error_response("Invalid password", 401)
        # Remove passwordHash from response
        business.pop('passwordHash', None)
        return create_success_response({"success": True, "business": business, "email": business["email"]})
    except Exception as e:
        logging.error(f"Business login error: {str(e)}")
        return create_error_response(f"Internal server error: {str(e)}", 500)
