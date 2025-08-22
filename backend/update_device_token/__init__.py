import azure.functions as func
import json
import os
import datetime
from azure.cosmos import CosmosClient
from ..db_helpers import get_container  # relative import may differ; adjust if needed

def add_cors_headers(response: func.HttpResponse):
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS, PUT, PATCH, DELETE'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type,Authorization,X-User-Email'
    return response

def main(req: func.HttpRequest) -> func.HttpResponse:
    if req.method == 'OPTIONS':
        return add_cors_headers(func.HttpResponse('', status_code=204))
    try:
        body = req.get_json()
    except Exception:
        return add_cors_headers(func.HttpResponse(json.dumps({'error': 'Invalid JSON'}), status_code=400, mimetype='application/json'))

    email = (body.get('email') or '').strip().lower()
    token = (body.get('token') or body.get('fcmToken') or '').strip()
    platform = body.get('platform') or 'unknown'
    if not email or not token:
        return add_cors_headers(func.HttpResponse(json.dumps({'error': 'email and token required'}), status_code=400, mimetype='application/json'))

    try:
        users = get_container('Users')
        query = "SELECT * FROM c WHERE c.id = @id OR c.email = @id"
        items = list(users.query_items(query=query, parameters=[{"name": "@id", "value": email}], enable_cross_partition_query=True))
        if not items:
            return add_cors_headers(func.HttpResponse(json.dumps({'error': 'User not found'}), status_code=404, mimetype='application/json'))
        doc = items[0]
        existing_list = doc.get('fcmTokens') or []
        if token not in existing_list:
            existing_list.insert(0, token)
        # Keep primary fcmToken consistent
        doc['fcmTokens'] = existing_list
        doc['fcmToken'] = existing_list[0] if existing_list else token
        doc['updatedAt'] = datetime.datetime.utcnow().isoformat()
        # Track platform usage
        platforms = set(doc.get('notificationPlatforms') or [])
        platforms.add(platform)
        doc['notificationPlatforms'] = list(platforms)
        users.upsert_item(doc)
        return add_cors_headers(func.HttpResponse(json.dumps({'ok': True, 'tokens': len(existing_list)}), status_code=200, mimetype='application/json'))
    except Exception as e:
        return add_cors_headers(func.HttpResponse(json.dumps({'error': str(e)}), status_code=500, mimetype='application/json'))
