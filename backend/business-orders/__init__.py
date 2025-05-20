# backend/business-orders/__init__.py
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
    logging.info('Business orders function processed a request.')
    
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
        
        logging.info(f"Processing orders request for business: {business_id}")
        
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
            orders_container = database.get_container_client("orders")
            business_transactions_container = database.get_container_client("business_transactions")
            
            if req.method == 'GET':
                # Get orders for business
                status_filter = req.params.get('status', 'all')
                
                if status_filter == 'all':
                    query = "SELECT * FROM c WHERE c.businessId = @businessId ORDER BY c.orderDate DESC"
                    params = [{"name": "@businessId", "value": business_id}]
                else:
                    query = "SELECT * FROM c WHERE c.businessId = @businessId AND c.status = @status ORDER BY c.orderDate DESC"
                    params = [
                        {"name": "@businessId", "value": business_id},
                        {"name": "@status", "value": status_filter}
                    ]
                
                orders = list(orders_container.query_items(
                    query=query,
                    parameters=params,
                    enable_cross_partition_query=False,
                    partition_key=business_id
                ))
                
                logging.info(f"Found {len(orders)} orders for business {business_id}")
                
                response = func.HttpResponse(
                    json.dumps(orders, default=str),
                    status_code=200,
                    mimetype="application/json"
                )
                return add_cors_headers(response)
            
            elif req.method == 'POST':
                # Create new order (from marketplace purchase)
                try:
                    request_body = req.get_json()
                except ValueError:
                    response = func.HttpResponse(
                        json.dumps({"error": "Invalid JSON body"}),
                        status_code=400,
                        mimetype="application/json"
                    )
                    return add_cors_headers(response)
                
                if not request_body:
                    response = func.HttpResponse(
                        json.dumps({"error": "Request body is required"}),
                        status_code=400,
                        mimetype="application/json"
                    )
                    return add_cors_headers(response)
                
                # Validate required fields
                required_fields = ['customerEmail', 'customerName', 'items', 'total']
                missing_fields = [field for field in required_fields if field not in request_body]
                
                if missing_fields:
                    response = func.HttpResponse(
                        json.dumps({"error": f"Missing required fields: {', '.join(missing_fields)}"}),
                        status_code=400,
                        mimetype="application/json"
                    )
                    return add_cors_headers(response)
                
                # Create order
                order_id = str(uuid.uuid4())
                current_time = datetime.utcnow().isoformat()
                
                order = {
                    "id": order_id,
                    "businessId": business_id,
                    "customerId": request_body.get('customerId', request_body['customerEmail']),
                    "customerEmail": request_body['customerEmail'],
                    "customerName": request_body['customerName'],
                    "customerPhone": request_body.get('customerPhone'),
                    "orderDate": current_time,
                    "status": "pending",  # pending -> confirmed -> ready -> completed
                    "items": request_body['items'],
                    "payment": {
                        "status": "pending",  # Self pickup, no online payment
                        "method": "pickup_cash",
                        "transactionId": None
                    },
                    "subtotal": request_body.get('subtotal', request_body['total']),
                    "tax": request_body.get('tax', 0),
                    "total": request_body['total'],
                    "notes": request_body.get('notes', ''),
                    "fulfillmentType": "pickup",  # Only self pickup for business orders
                    "confirmationNumber": f"ORD-{order_id[:8].upper()}",
                    "updatedAt": current_time
                }
                
                created_order = orders_container.create_item(order)
                logging.info(f"Created order {order_id} for business {business_id}")
                
                response = func.HttpResponse(
                    json.dumps(created_order, default=str),
                    status_code=201,
                    mimetype="application/json"
                )
                return add_cors_headers(response)
            
            elif req.method == 'PATCH':
                # Update order status
                order_id = req.params.get('orderId')
                if not order_id:
                    response = func.HttpResponse(
                        json.dumps({"error": "Order ID is required"}),
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
                
                new_status = request_body.get('status')
                if not new_status:
                    response = func.HttpResponse(
                        json.dumps({"error": "Status is required"}),
                        status_code=400,
                        mimetype="application/json"
                    )
                    return add_cors_headers(response)
                
                # Get existing order
                try:
                    existing_order = orders_container.read_item(item=order_id, partition_key=business_id)
                except Exception:
                    response = func.HttpResponse(
                        json.dumps({"error": "Order not found"}),
                        status_code=404,
                        mimetype="application/json"
                    )
                    return add_cors_headers(response)
                
                # Update order
                existing_order['status'] = new_status
                existing_order['updatedAt'] = datetime.utcnow().isoformat()
                
                # If status is completed, create transaction record
                if new_status == 'completed':
                    transaction_id = str(uuid.uuid4())
                    transaction = {
                        "id": transaction_id,
                        "businessId": business_id,
                        "type": "sale",
                        "amount": existing_order['total'],
                        "date": datetime.utcnow().isoformat(),
                        "description": f"Order completion - {existing_order['confirmationNumber']}",
                        "orderId": order_id,
                        "customerId": existing_order['customerEmail'],
                        "category": "sales",
                        "items": existing_order['items'],
                        "status": "completed",
                        "notes": f"Order {existing_order['confirmationNumber']} completed",
                        "createdBy": business_id
                    }
                    
                    business_transactions_container.create_item(transaction)
                    existing_order['transactionId'] = transaction_id
                    logging.info(f"Created transaction {transaction_id} for completed order {order_id}")
                
                updated_order = orders_container.replace_item(
                    item=order_id,
                    body=existing_order,
                    partition_key=business_id
                )
                
                logging.info(f"Updated order {order_id} status to {new_status}")
                
                response = func.HttpResponse(
                    json.dumps(updated_order, default=str),
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