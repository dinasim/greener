# backend/business-orders/__init__.py - FIXED VERSION
import logging
import json
import azure.functions as func
from azure.cosmos import CosmosClient
import os

# Import standardized helpers
import sys
sys.path.append('..')
from http_helpers import add_cors_headers, get_user_id_from_request, create_success_response, create_error_response

# Database connection details for marketplace
MARKETPLACE_CONNECTION_STRING = os.environ.get("COSMOSDB__MARKETPLACE_CONNECTION_STRING")
MARKETPLACE_DATABASE_NAME = os.environ.get("COSMOSDB_MARKETPLACE_DATABASE_NAME", "greener-marketplace-db")

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Business orders function processed a request.')
    
    # Handle OPTIONS method for CORS preflight
    if req.method == 'OPTIONS':
        return add_cors_headers(func.HttpResponse("", status_code=200))
    
    try:
        # FIXED: Get business ID using standardized function
        business_id = get_user_id_from_request(req)
        
        if not business_id:
            return create_error_response("Business authentication required", 401)
        
        logging.info(f"Processing orders request for business: {business_id}")
        
        # Get optional status filter from query parameters
        status_filter = req.params.get('status', 'all').lower()
        limit = int(req.params.get('limit', 50))
        
        # Connect to marketplace database
        try:
            # Parse connection string
            params = dict(param.split('=', 1) for param in MARKETPLACE_CONNECTION_STRING.split(';'))
            account_endpoint = params.get('AccountEndpoint')
            account_key = params.get('AccountKey')
            
            if not account_endpoint or not account_key:
                raise ValueError("Invalid marketplace connection string")
            
            # Create client and get container
            client = CosmosClient(account_endpoint, credential=account_key)
            database = client.get_database_client(MARKETPLACE_DATABASE_NAME)
            orders_container = database.get_container_client("orders")
            
            # Build query based on status filter
            if status_filter == 'all':
                query = "SELECT * FROM c WHERE c.businessId = @businessId ORDER BY c.orderDate DESC"
                parameters = [{"name": "@businessId", "value": business_id}]
            else:
                query = "SELECT * FROM c WHERE c.businessId = @businessId AND c.status = @status ORDER BY c.orderDate DESC"
                parameters = [
                    {"name": "@businessId", "value": business_id},
                    {"name": "@status", "value": status_filter}
                ]
            
            logging.info(f"Executing orders query for businessId: {business_id}, status: {status_filter}")
            
            # Execute query
            orders = list(orders_container.query_items(
                query=query,
                parameters=parameters,
                enable_cross_partition_query=True,
                max_item_count=limit
            ))
            
            logging.info(f"Found {len(orders)} orders for business {business_id}")
            
            # FIXED: Format orders with all required fields
            formatted_orders = []
            for order in orders:
                formatted_order = {
                    "id": order.get("id"),
                    "orderId": order.get("orderId", order.get("id")),
                    "businessId": order.get("businessId"),
                    "customerEmail": order.get("customerEmail"),
                    "customerName": order.get("customerName"),
                    "customerPhone": order.get("customerPhone", ""),
                    "items": order.get("items", []),
                    "totalAmount": order.get("totalAmount", 0),
                    "subtotal": order.get("subtotal", 0),
                    "tax": order.get("tax", 0),
                    "status": order.get("status", "pending"),
                    "orderDate": order.get("orderDate"),
                    "createdAt": order.get("createdAt"),
                    "updatedAt": order.get("updatedAt"),
                    "notes": order.get("notes", ""),
                    "communicationPreference": order.get("communicationPreference", "messages"),
                    "paymentMethod": order.get("paymentMethod", "pickup"),
                    "deliveryMethod": order.get("deliveryMethod", "pickup"),
                    "deliveryAddress": order.get("deliveryAddress", {}),
                    "estimatedPickupDate": order.get("estimatedPickupDate"),
                    "completedDate": order.get("completedDate")
                }
                formatted_orders.append(formatted_order)
            
            # Calculate order statistics
            total_orders = len(formatted_orders)
            pending_orders = len([o for o in formatted_orders if o["status"] == "pending"])
            completed_orders = len([o for o in formatted_orders if o["status"] == "completed"])
            cancelled_orders = len([o for o in formatted_orders if o["status"] == "cancelled"])
            
            # FIXED: Return consistent response structure
            response_data = {
                "success": True,
                "businessId": business_id,
                "orders": formatted_orders,
                "totalOrders": total_orders,
                "pendingOrders": pending_orders,
                "completedOrders": completed_orders,
                "cancelledOrders": cancelled_orders,
                "statusFilter": status_filter,
                "limit": limit
            }
            
            return create_success_response(response_data)
            
        except Exception as db_error:
            logging.error(f"Database error: {str(db_error)}")
            return create_error_response(f"Database error: {str(db_error)}", 500)
    
    except Exception as e:
        logging.error(f"Unexpected error: {str(e)}")
        return create_error_response(f"Internal server error: {str(e)}", 500)