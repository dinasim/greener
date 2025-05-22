# backend/business-orders-get/__init__.py
import logging
import json
import azure.functions as func
from azure.cosmos import CosmosClient
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
    """Extract user ID from request headers or query params"""
    # Try to get from headers first
    user_id = req.headers.get('X-User-Email')
    
    if not user_id:
        # Try to get from query parameters
        user_id = req.params.get('businessId')
    
    return user_id

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Business orders get function processed a request.')
    
    # Handle OPTIONS method for CORS preflight
    if req.method == 'OPTIONS':
        response = func.HttpResponse("", status_code=200)
        return add_cors_headers(response)
    
    try:
        # Get business ID from query params or headers
        business_id = req.params.get('businessId') or get_user_id_from_request(req)
        
        if not business_id:
            response = func.HttpResponse(
                json.dumps({"error": "Business ID is required"}),
                status_code=400,
                mimetype="application/json"
            )
            return add_cors_headers(response)
        
        # Get filter parameters
        status_filter = req.params.get('status', 'all')  # all, pending, confirmed, ready, completed, cancelled
        limit = int(req.params.get('limit', 50))
        offset = int(req.params.get('offset', 0))
        
        logging.info(f"Getting orders for business: {business_id}, status: {status_filter}")
        
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
            
            # Add pagination
            query += f" OFFSET {offset} LIMIT {limit}"
            
            logging.info(f"Executing query for businessId: {business_id}")
            
            # Execute query - using partition key so no cross-partition needed
            items = list(orders_container.query_items(
                query=query,
                parameters=parameters,
                enable_cross_partition_query=False  # Using partition key
            ))
            
            logging.info(f"Found {len(items)} orders for business {business_id}")
            
            # Format orders for frontend
            formatted_orders = []
            for order in items:
                formatted_order = {
                    "id": order.get("id"),
                    "businessId": order.get("businessId"),
                    "confirmationNumber": order.get("confirmationNumber"),
                    "customerEmail": order.get("customerEmail"),
                    "customerName": order.get("customerName"),
                    "customerPhone": order.get("customerPhone", ""),
                    "orderDate": order.get("orderDate"),
                    "status": order.get("status", "pending"),
                    "fulfillmentType": order.get("fulfillmentType", "pickup"),
                    "items": order.get("items", []),
                    "subtotal": order.get("subtotal", 0),
                    "tax": order.get("tax", 0),
                    "total": order.get("total", 0),
                    "notes": order.get("notes", ""),
                    "pickupDetails": order.get("pickupDetails", {}),
                    "communication": order.get("communication", {}),
                    "statusHistory": order.get("statusHistory", []),
                    "notifications": order.get("notifications", {}),
                    "createdAt": order.get("createdAt"),
                    "updatedAt": order.get("updatedAt"),
                    
                    # Computed fields for easy frontend use
                    "itemCount": len(order.get("items", [])),
                    "totalQuantity": sum(item.get("quantity", 0) for item in order.get("items", [])),
                    "isPickupReady": order.get("status") in ["ready", "completed"],
                    "canContact": order.get("communication", {}).get("preferredMethod") == "messages",
                    "daysSinceOrder": None,  # Could calculate this
                    "priority": "normal"  # Could be calculated based on total, customer type, etc.
                }
                formatted_orders.append(formatted_order)
            
            # Get summary statistics
            try:
                # Get status counts
                status_query = """
                SELECT c.status, COUNT(1) as count 
                FROM c 
                WHERE c.businessId = @businessId 
                GROUP BY c.status
                """
                
                status_items = list(orders_container.query_items(
                    query=status_query,
                    parameters=[{"name": "@businessId", "value": business_id}],
                    enable_cross_partition_query=False
                ))
                
                status_counts = {item['status']: item['count'] for item in status_items}
                
            except Exception as stats_error:
                logging.warning(f"Error getting status counts: {str(stats_error)}")
                status_counts = {}
            
            # Return orders data
            response_data = {
                "success": True,
                "businessId": business_id,
                "orders": formatted_orders,
                "pagination": {
                    "limit": limit,
                    "offset": offset,
                    "total": len(formatted_orders),
                    "hasMore": len(formatted_orders) == limit
                },
                "filters": {
                    "status": status_filter,
                    "availableStatuses": ["all", "pending", "confirmed", "ready", "completed", "cancelled"]
                },
                "summary": {
                    "totalOrders": len(formatted_orders),
                    "statusCounts": status_counts,
                    "pendingCount": status_counts.get("pending", 0),
                    "readyCount": status_counts.get("ready", 0),
                    "completedCount": status_counts.get("completed", 0)
                },
                "communicationInfo": {
                    "messagesEnabled": True,
                    "emailEnabled": True,
                    "smsEnabled": True,
                    "orderNotificationsActive": True
                }
            }
            
            response = func.HttpResponse(
                json.dumps(response_data, default=str),
                status_code=200,
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