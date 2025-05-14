# backend/products-create/__init__.py
import logging
import json
import azure.functions as func
from shared.marketplace.db_client import get_container, get_main_container
import uuid
from datetime import datetime

def add_cors_headers(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS, PUT, PATCH, DELETE'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type,Authorization,X-User-Email'
    return response

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Python HTTP trigger function for creating marketplace products processed a request.')
    
    # Handle OPTIONS method for CORS preflight
    if req.method == 'OPTIONS':
        response = func.HttpResponse()
        return add_cors_headers(response)
    
    try:
        # Get request body
        request_body = req.get_json()
        
        # Validate required fields
        required_fields = ['title', 'price', 'category', 'description']
        missing_fields = [field for field in required_fields if field not in request_body]
        
        if missing_fields:
            error_response = func.HttpResponse(
                body=json.dumps({"error": f"Missing required fields: {', '.join(missing_fields)}"}),
                mimetype="application/json",
                status_code=400
            )
            return add_cors_headers(error_response)
        
        # Access the marketplace-plants container
        container = get_container("marketplace-plants")
        
        # Get seller ID (user email) from the request
        seller_id = request_body.get('sellerId') or request_body.get('email')
        
        if not seller_id:
            error_response = func.HttpResponse(
                body=json.dumps({"error": "Seller ID is required"}),
                mimetype="application/json",
                status_code=400
            )
            return add_cors_headers(error_response)
        
        # Verify the seller exists in the Users container
        try:
            main_users_container = get_main_container("Users")
            
            query = "SELECT VALUE COUNT(1) FROM c WHERE c.email = @email"
            parameters = [{"name": "@email", "value": seller_id}]
            
            results = list(main_users_container.query_items(
                query=query,
                parameters=parameters,
                enable_cross_partition_query=True
            ))
            
            if not results or results[0] == 0:
                error_response = func.HttpResponse(
                    body=json.dumps({"error": "Seller not found. Please sign in first."}),
                    mimetype="application/json",
                    status_code=400
                )
                return add_cors_headers(error_response)
        except Exception as e:
            logging.error(f"Error verifying seller: {str(e)}")
            error_response = func.HttpResponse(
                body=json.dumps({"error": f"Error verifying seller: {str(e)}"}),
                mimetype="application/json",
                status_code=500
            )
            return add_cors_headers(error_response)
        
        # Create plant listing
        plant_id = str(uuid.uuid4())
        current_time = datetime.utcnow().isoformat()
        
        # Format price as a float
        try:
            price = float(request_body['price'])
        except (ValueError, TypeError):
            error_response = func.HttpResponse(
                body=json.dumps({"error": "Price must be a valid number"}),
                mimetype="application/json",
                status_code=400
            )
            return add_cors_headers(error_response)
        
        # Create the plant item
        plant_item = {
            "id": plant_id,
            "title": request_body['title'],
            "description": request_body['description'],
            "price": price,
            "category": request_body['category'].lower(),
            "addedAt": current_time,
            "status": "active",
            "sellerId": seller_id,
            "images": request_body.get('images', []),
            "location": request_body.get('location', {}),
            "stats": {
                "views": 0,
                "wishlistCount": 0,
                "messageCount": 0
            }
        }
        
        # Add optional fields if provided
        if 'image' in request_body and request_body['image']:
            plant_item['image'] = request_body['image']
            
        if 'scientificName' in request_body and request_body['scientificName']:
            plant_item['scientificName'] = request_body['scientificName']
            
        if 'city' in request_body and request_body['city']:
            if 'location' not in plant_item:
                plant_item['location'] = {}
            plant_item['location']['city'] = request_body['city']
        
        # Create the item in the database
        container.create_item(body=plant_item)
        
        # Return success response with CORS headers
        response = func.HttpResponse(
            body=json.dumps({
                "success": True,
                "productId": plant_id,
                "message": "Plant listing created successfully"
            }),
            mimetype="application/json",
            status_code=201
        )
        return add_cors_headers(response)
    
    except Exception as e:
        logging.error(f"Error creating plant listing: {str(e)}")
        
        # Return error response with CORS headers
        error_response = func.HttpResponse(
            body=json.dumps({"error": str(e)}),
            mimetype="application/json",
            status_code=500
        )
        return add_cors_headers(error_response)