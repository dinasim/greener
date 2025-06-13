import azure.functions as func
import json
import bcrypt
from azure.cosmos import CosmosClient
import os

def add_cors_headers(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS, PUT, PATCH, DELETE'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type,Authorization,X-User-Email'
    return response

endpoint = os.environ.get('COSMOS_URI')
key = os.environ.get('COSMOS_KEY')
client = CosmosClient(endpoint, credential=key)
database = client.get_database_client('GreenerDB')
user_container = database.get_container_client('Users')

def main(req: func.HttpRequest) -> func.HttpResponse:
    if req.method == "OPTIONS":
        return add_cors_headers(func.HttpResponse("", status_code=204))
    try:
        data = req.get_json()
        username = (data.get('username') or '').strip().lower()
        password = data.get('password')
        if not (username and password):
            return func.HttpResponse(
                json.dumps({'error': 'Username and password are required.'}),
                status_code=400, mimetype='application/json')
        query = "SELECT * FROM Users u WHERE LOWER(u.username) = @username"
        parameters = [{"name": "@username", "value": username}]
        results = list(user_container.query_items(query, parameters=parameters, enable_cross_partition_query=True))
        if not results:
            return func.HttpResponse(
                json.dumps({'error': 'Invalid username or password.'}),
                status_code=401, mimetype='application/json')
        user = results[0]
        if not bcrypt.checkpw(password.encode('utf-8'), user['passwordHash'].encode('utf-8')):
            return func.HttpResponse(
                json.dumps({'error': 'Invalid username or password.'}),
                status_code=401, mimetype='application/json')
        # Remove sensitive field
        user.pop('passwordHash', None)
        resp = func.HttpResponse(json.dumps(user), status_code=200, mimetype='application/json')
        return add_cors_headers(resp)
    except Exception as e:
        return func.HttpResponse(
            json.dumps({'error': str(e)}),
            status_code=500, mimetype='application/json')
