# backend/business-customers/__init__.py - FIXED VERSION
import logging
import json
import azure.functions as func

# Import standardized helpers
import sys
sys.path.append('..')
from http_helpers import add_cors_headers, get_user_id_from_request, create_success_response, create_error_response
from db_helpers import get_container

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Business customers function processed a request.')
    
    # Handle OPTIONS method for CORS preflight
    if req.method == 'OPTIONS':
        return add_cors_headers(func.HttpResponse("", status_code=200))
    
    try:
        # Get business ID using standardized function
        business_id = get_user_id_from_request(req)
        
        if not business_id:
            return create_error_response("Business authentication required", 401)
        
        logging.info(f"Processing customers request for business: {business_id}")
        
        # FIXED: Use standardized container access
        try:
            orders_container = get_container("orders")
            
            # Get all orders for this business to extract customer data
            orders_query = "SELECT * FROM c WHERE c.businessId = @businessId"
            orders = list(orders_container.query_items(
                query=orders_query,
                parameters=[{"name": "@businessId", "value": business_id}],
                enable_cross_partition_query=False  # Using partition key
            ))
            
            logging.info(f"Found {len(orders)} orders for business {business_id}")
            
            # Aggregate customer data from orders
            customers_map = {}
            
            for order in orders:
                customer_email = order.get("customerEmail")
                if not customer_email:
                    continue
                
                if customer_email not in customers_map:
                    customers_map[customer_email] = {
                        "id": customer_email,
                        "email": customer_email,
                        "name": order.get("customerName", "Unknown Customer"),
                        "phone": order.get("customerPhone", ""),
                        "businessId": business_id,
                        "totalSpent": 0,
                        "orderCount": 0,
                        "orders": [],
                        "firstOrderDate": order.get("orderDate"),
                        "lastOrderDate": order.get("orderDate"),
                        "status": "active",
                        "communicationPreference": order.get("communicationPreference", "messages")
                    }
                
                customer = customers_map[customer_email]
                
                # Update customer statistics
                customer["totalSpent"] += order.get("totalAmount", 0)
                customer["orderCount"] += 1
                
                # Update contact info if more recent
                if order.get("customerName"):
                    customer["name"] = order.get("customerName")
                if order.get("customerPhone"):
                    customer["phone"] = order.get("customerPhone")
                
                # Track order dates
                order_date = order.get("orderDate")
                if order_date:
                    if not customer["firstOrderDate"] or order_date < customer["firstOrderDate"]:
                        customer["firstOrderDate"] = order_date
                    if not customer["lastOrderDate"] or order_date > customer["lastOrderDate"]:
                        customer["lastOrderDate"] = order_date
                
                # Add order summary to customer
                customer["orders"].append({
                    "orderId": order.get("id"),
                    "date": order.get("orderDate"),
                    "total": order.get("totalAmount", 0),
                    "status": order.get("status", "pending"),
                    "itemCount": len(order.get("items", []))
                })
            
            # Convert to list and sort by total spent (best customers first)
            customers_list = list(customers_map.values())
            customers_list.sort(key=lambda x: x["totalSpent"], reverse=True)
            
            # Calculate customer statistics
            total_customers = len(customers_list)
            total_revenue = sum(c["totalSpent"] for c in customers_list)
            avg_order_value = total_revenue / sum(c["orderCount"] for c in customers_list) if customers_list else 0
            
            # Return consistent response structure
            response_data = {
                "success": True,
                "businessId": business_id,
                "customers": customers_list,
                "totalCustomers": total_customers,
                "totalRevenue": total_revenue,
                "averageOrderValue": round(avg_order_value, 2),
                "topCustomers": customers_list[:10]  # Top 10 customers by spending
            }
            
            return create_success_response(response_data)
            
        except Exception as db_error:
            logging.error(f"Database error: {str(db_error)}")
            return create_error_response(f"Database error: {str(db_error)}", 500)
    
    except Exception as e:
        logging.error(f"Unexpected error: {str(e)}")
        return create_error_response(f"Internal server error: {str(e)}", 500)