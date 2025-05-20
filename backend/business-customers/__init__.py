# backend/business-customers/__init__.py
import logging
import json
import azure.functions as func
from azure.cosmos import CosmosClient
from datetime import datetime
import uuid
import os

# Database connection details for marketplace
MARKETPLACE_CONNECTION_STRING = os.environ.get("COSMOSDB__MARKETPLACE_CONNECTION_STRING")
MARKETPLACE_DATABASE_NAME = os.environ.get("COSMOSDB_MARKETPLACE_DATABASE_NAME", "GreenerMarketplace")

def add_cors_headers(response):
    """Add CORS headers to response"""
    response.headers.update({
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Email'
    })
    return response

def get_user_id_from_request(req):
    """Extract user ID from request headers"""
    user_id = req.headers.get('X-User-Email')
    return user_id

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Business customers function processed a request.')
    
    # Handle OPTIONS method for CORS preflight
    if req.method == 'OPTIONS':
        response = func.HttpResponse("", status_code=200)
        return add_cors_headers(response)
    
    try:
        # Get business ID from headers
        business_id = get_user_id_from_request(req)
        
        if not business_id:
            response = func.HttpResponse(
                json.dumps({"error": "Business authentication required"}),
                status_code=401,
                mimetype="application/json"
            )
            return add_cors_headers(response)
        
        logging.info(f"Processing customers request for business: {business_id}")
        
        # Connect to marketplace database
        try:
            # Parse connection string
            params = dict(param.split('=', 1) for param in MARKETPLACE_CONNECTION_STRING.split(';'))
            account_endpoint = params.get('AccountEndpoint')
            account_key = params.get('AccountKey')
            
            if not account_endpoint or not account_key:
                raise ValueError("Invalid marketplace connection string")
            
            # Create client and get containers
            client = CosmosClient(account_endpoint, credential=account_key)
            database = client.get_database_client(MARKETPLACE_DATABASE_NAME)
            customers_container = database.get_container_client("business_customers")
            orders_container = database.get_container_client("orders")
            
            if req.method == 'GET':
                # Get customers for business - need to query by businessId since partition key is /id
                query = "SELECT * FROM c WHERE c.businessId = @businessId ORDER BY c.lastOrderDate DESC"
                params = [{"name": "@businessId", "value": business_id}]
                
                customers = list(customers_container.query_items(
                    query=query,
                    parameters=params,
                    enable_cross_partition_query=True  # Since partition key is /id not /businessId
                ))
                
                logging.info(f"Found {len(customers)} customers for business {business_id}")
                
                response = func.HttpResponse(
                    json.dumps(customers, default=str),
                    status_code=200,
                    mimetype="application/json"
                )
                return add_cors_headers(response)
            
            elif req.method == 'POST':
                # Create/update customer from order
                try:
                    request_body = req.get_json()
                except ValueError:
                    response = func.HttpResponse(
                        json.dumps({"error": "Invalid JSON body"}),
                        status_code=400,
                        mimetype="application/json"
                    )
                    return add_cors_headers(response)
                
                # Required fields
                customer_email = request_body.get('email')
                customer_name = request_body.get('name')
                
                if not customer_email or not customer_name:
                    response = func.HttpResponse(
                        json.dumps({"error": "Customer email and name are required"}),
                        status_code=400,
                        mimetype="application/json"
                    )
                    return add_cors_headers(response)
                
                # Create unique customer ID based on business + email
                customer_id = f"{business_id}_{customer_email}".replace('@', '_').replace('.', '_')
                
                # Check if customer already exists
                try:
                    existing_customer = customers_container.read_item(item=customer_id, partition_key=customer_id)
                    
                    # Update existing customer
                    existing_customer['name'] = customer_name
                    existing_customer['phone'] = request_body.get('phone', existing_customer.get('phone'))
                    existing_customer['address'] = request_body.get('address', existing_customer.get('address', {}))
                    existing_customer['orderCount'] = existing_customer.get('orderCount', 0) + 1
                    existing_customer['totalSpent'] = existing_customer.get('totalSpent', 0) + request_body.get('orderTotal', 0)
                    existing_customer['lastOrderDate'] = datetime.utcnow().isoformat()
                    existing_customer['updatedAt'] = datetime.utcnow().isoformat()
                    
                    # Add order to history
                    if 'orders' not in existing_customer:
                        existing_customer['orders'] = []
                    
                    if request_body.get('orderId'):
                        existing_customer['orders'].append({
                            "orderId": request_body['orderId'],
                            "date": datetime.utcnow().isoformat(),
                            "total": request_body.get('orderTotal', 0),
                            "status": request_body.get('orderStatus', 'pending')
                        })
                    
                    updated_customer = customers_container.replace_item(
                        item=customer_id,
                        body=existing_customer,
                        partition_key=customer_id
                    )
                    
                    logging.info(f"Updated existing customer {customer_id}")
                    
                    response = func.HttpResponse(
                        json.dumps(updated_customer, default=str),
                        status_code=200,
                        mimetype="application/json"
                    )
                    return add_cors_headers(response)
                    
                except Exception:
                    # Create new customer
                    current_time = datetime.utcnow().isoformat()
                    
                    new_customer = {
                        "id": customer_id,
                        "businessId": business_id,
                        "email": customer_email,
                        "name": customer_name,
                        "phone": request_body.get('phone', ''),
                        "address": request_body.get('address', {}),
                        "firstPurchaseDate": current_time,
                        "orders": [],
                        "totalSpent": request_body.get('orderTotal', 0),
                        "orderCount": 1,
                        "lastOrderDate": current_time,
                        "notes": request_body.get('notes', ''),
                        "tags": request_body.get('tags', []),
                        "preferences": request_body.get('preferences', {}),
                        "isSubscribedToNewsletter": request_body.get('isSubscribedToNewsletter', False),
                        "createdAt": current_time,
                        "updatedAt": current_time
                    }
                    
                    # Add order to history if provided
                    if request_body.get('orderId'):
                        new_customer['orders'].append({
                            "orderId": request_body['orderId'],
                            "date": current_time,
                            "total": request_body.get('orderTotal', 0),
                            "status": request_body.get('orderStatus', 'pending')
                        })
                    
                    created_customer = customers_container.create_item(new_customer)
                    logging.info(f"Created new customer {customer_id}")
                    
                    response = func.HttpResponse(
                        json.dumps(created_customer, default=str),
                        status_code=201,
                        mimetype="application/json"
                    )
                    return add_cors_headers(response)
            
            elif req.method == 'PATCH':
                # Update customer notes or preferences
                customer_id = req.params.get('customerId')
                if not customer_id:
                    response = func.HttpResponse(
                        json.dumps({"error": "Customer ID is required"}),
                        status_code=400,
                        mimetype="application/json"
                    )
                    return add_cors_headers(response)
                
                try:
                    request_body = req.get_json()
                except ValueError:
                    response = func.HttpResponse(
                        json.dumps({"error": "Invalid JSON body"}),
                        status_code=400,
                        mimetype="application/json"
                    )
                    return add_cors_headers(response)
                
                # Get existing customer
                try:
                    existing_customer = customers_container.read_item(item=customer_id, partition_key=customer_id)
                except Exception:
                    response = func.HttpResponse(
                        json.dumps({"error": "Customer not found"}),
                        status_code=404,
                        mimetype="application/json"
                    )
                    return add_cors_headers(response)
                
                # Update allowed fields
                updatable_fields = ['notes', 'tags', 'preferences', 'phone', 'address', 'isSubscribedToNewsletter']
                for field in updatable_fields:
                    if field in request_body:
                        existing_customer[field] = request_body[field]
                
                existing_customer['updatedAt'] = datetime.utcnow().isoformat()
                
                updated_customer = customers_container.replace_item(
                    item=customer_id,
                    body=existing_customer,
                    partition_key=customer_id
                )
                
                logging.info(f"Updated customer {customer_id}")
                
                response = func.HttpResponse(
                    json.dumps(updated_customer, default=str),
                    status_code=200,
                    mimetype="application/json"
                )
                return add_cors_headers(response)
            
            else:
                response = func.HttpResponse(
                    json.dumps({"error": "Method not allowed"}),
                    status_code=405,
                    mimetype="application/json"
                )
                return add_cors_headers(response)
            
        except Exception as db_error:
            logging.error(f"Database error: {str(db_error)}")
            response = func.HttpResponse(
                json.dumps({"error": f"Database error: {str(db_error)}"}),
                status_code=500,
                mimetype="application/json"
            )
            return add_cors_headers(response)
    
    except Exception as e:
        logging.error(f"Unexpected error: {str(e)}")
        response = func.HttpResponse(
            json.dumps({"error": f"Internal server error: {str(e)}"}),
            status_code=500,
            mimetype="application/json"
        )
        return add_cors_headers(response)