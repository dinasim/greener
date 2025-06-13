# /api/registerUser/__init__.py
import azure.functions as func
import json
import bcrypt
from azure.cosmos import CosmosClient, exceptions
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
        email = (data.get('email') or '').strip().lower()
        name = (data.get('name') or '').strip()
        intersted = data.get('intersted', '')
        animals = data.get('animals', '')
        kids = data.get('kids', '')
        location = data.get('location', None)
        plantLocations = data.get('plantLocations', [])

        if not (username and password and email):
            return func.HttpResponse(
                json.dumps({'error': 'Email, username, and password are required.'}),
                status_code=400, mimetype='application/json')

        # Check if username or email taken
        query = "SELECT * FROM Users u WHERE LOWER(u.username) = @username OR LOWER(u.email) = @email"
        parameters = [{"name": "@username", "value": username}, {"name": "@email", "value": email}]
        results = list(user_container.query_items(query, parameters=parameters, enable_cross_partition_query=True))
        if results:
            return func.HttpResponse(
                json.dumps({'error': 'Username or email already exists.'}),
                status_code=409, mimetype='application/json')

        hashed_pw = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())
        user_doc = {
            "id": email,
            "username": username,
            "passwordHash": hashed_pw.decode('utf-8'),
            "email": email,
            "name": name,
            "intersted": intersted,
            "animals": animals,
            "kids": kids,
            "location": location,
            "plantLocations": plantLocations,
        }
        user_container.create_item(user_doc)
        resp = func.HttpResponse(json.dumps({"message": "User registered successfully."}), status_code=201, mimetype='application/json')
        return add_cors_headers(resp)
    except Exception as e:
        return func.HttpResponse(
            json.dumps({'error': str(e)}),
            status_code=500, mimetype='application/json')
