# backend/business-dashboard/__init__.py
import logging
import json
import azure.functions as func
from azure.cosmos import CosmosClient
import os
from datetime import datetime, timedelta

# Import standardized helpers
import sys
sys.path.append('..')
from http_helpers import add_cors_headers, get_user_id_from_request, create_success_response, create_error_response

# Database connection details for marketplace
MARKETPLACE_CONNECTION_STRING = os.environ.get("COSMOSDB__MARKETPLACE_CONNECTION_STRING")
MARKETPLACE_DATABASE_NAME = os.environ.get("COSMOSDB_MARKETPLACE_DATABASE_NAME", "greener-marketplace-db")

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Business dashboard function processed a request.')
    
    # Handle OPTIONS method for CORS preflight
    if req.method == 'OPTIONS':
        return add_cors_headers(func.HttpResponse("", status_code=200))
    
    try:
        # FIXED: Get business ID using standardized function
        business_id = get_user_id_from_request(req)
        
        if not business_id:
            return create_error_response("Business authentication required", 401)
        
        logging.info(f"Processing dashboard request for business: {business_id}")
        
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
            
            business_users_container = database.get_container_client("business_users")
            inventory_container = database.get_container_client("inventory")
            orders_container = database.get_container_client("orders")
            
            # 1. Get or create business profile
            try:
                business_profile = business_users_container.read_item(item=business_id, partition_key=business_id)
                logging.info(f"Found existing business profile for {business_id}")
            except Exception:
                # Create default business profile if doesn't exist
                logging.info(f"Creating default business profile for {business_id}")
                current_time = datetime.utcnow().isoformat()
                business_profile = {
                    "id": business_id,
                    "email": business_id,
                    "businessName": f"{business_id.split('@')[0].title()} Business",
                    "businessType": "Plant Business",
                    "status": "active",
                    "joinDate": current_time,
                    "createdAt": current_time,
                    "rating": 0,
                    "reviewCount": 0,
                    "settings": {
                        "notifications": True,
                        "messages": True,
                        "lowStockThreshold": 5
                    }
                }
                business_profile = business_users_container.create_item(business_profile)
                logging.info(f"Created default business profile for {business_id}")
            
            # 2. Get inventory data
            try:
                inventory_query = "SELECT * FROM c WHERE c.businessId = @businessId"
                inventory_items = list(inventory_container.query_items(
                    query=inventory_query,
                    parameters=[{"name": "@businessId", "value": business_id}],
                    enable_cross_partition_query=False
                ))
                logging.info(f"Found {len(inventory_items)} inventory items")
            except Exception as e:
                logging.warning(f"Error getting inventory: {str(e)}")
                inventory_items = []
            
            # 3. Get orders data
            try:
                orders_query = "SELECT * FROM c WHERE c.businessId = @businessId"
                orders = list(orders_container.query_items(
                    query=orders_query,
                    parameters=[{"name": "@businessId", "value": business_id}],
                    enable_cross_partition_query=True
                ))
                logging.info(f"Found {len(orders)} orders")
            except Exception as e:
                logging.warning(f"Error getting orders: {str(e)}")
                orders = []
            
            # 4. Calculate dashboard metrics
            current_time = datetime.utcnow()
            thirty_days_ago = current_time - timedelta(days=30)
            
            # Inventory metrics
            active_inventory = [item for item in inventory_items if item.get("status") == "active"]
            low_stock_threshold = business_profile.get("settings", {}).get("lowStockThreshold", 5)
            low_stock_items = [
                item for item in active_inventory 
                if (item.get("quantity", 0) <= low_stock_threshold)
            ]
            total_inventory_value = sum(
                item.get("quantity", 0) * item.get("price", 0) 
                for item in active_inventory
            )
            
            # Order metrics
            completed_orders = [order for order in orders if order.get("status") == "completed"]
            pending_orders = [order for order in orders if order.get("status") == "pending"]
            total_revenue = sum(order.get("totalAmount", 0) for order in completed_orders)
            
            # Recent orders (last 30 days)
            recent_orders = []
            for order in orders:
                order_date_str = order.get("orderDate")
                if order_date_str:
                    try:
                        order_date = datetime.fromisoformat(order_date_str.replace('Z', '+00:00'))
                        if order_date >= thirty_days_ago:
                            recent_orders.append(order)
                    except:
                        continue
            
            recent_revenue = sum(order.get("totalAmount", 0) for order in recent_orders if order.get("status") == "completed")
            
            # Customer metrics
            customers_map = {}
            for order in orders:
                customer_email = order.get("customerEmail")
                if customer_email:
                    if customer_email not in customers_map:
                        customers_map[customer_email] = {
                            "id": customer_email,
                            "email": customer_email,
                            "name": order.get("customerName", "Unknown Customer"),
                            "phone": order.get("customerPhone", ""),
                            "totalSpent": 0,
                            "orderCount": 0,
                            "orders": []
                        }
                    
                    customer = customers_map[customer_email]
                    customer["totalSpent"] += order.get("totalAmount", 0)
                    customer["orderCount"] += 1
                    customer["orders"].append({
                        "orderId": order.get("id"),
                        "date": order.get("orderDate"),
                        "total": order.get("totalAmount", 0),
                        "status": order.get("status", "pending")
                    })
            
            customers_list = list(customers_map.values())
            customers_list.sort(key=lambda x: x["totalSpent"], reverse=True)
            
            # FIXED: Return comprehensive dashboard data with consistent structure
            dashboard_data = {
                "success": True,
                "businessId": business_id,
                "businessProfile": business_profile,
                
                # Inventory metrics
                "inventory": {
                    "totalItems": len(inventory_items),
                    "activeItems": len(active_inventory),
                    "lowStockItems": len(low_stock_items),
                    "lowStockThreshold": low_stock_threshold,
                    "totalValue": round(total_inventory_value, 2),
                    "items": active_inventory[:10]  # Return first 10 items for quick view
                },
                
                # Order metrics
                "orders": {
                    "totalOrders": len(orders),
                    "pendingOrders": len(pending_orders),
                    "completedOrders": len(completed_orders),
                    "recentOrders": len(recent_orders),
                    "totalRevenue": round(total_revenue, 2),
                    "recentRevenue": round(recent_revenue, 2),
                    "recent": orders[:10]  # Return first 10 orders for quick view
                },
                
                # Customer metrics
                "customers": {
                    "totalCustomers": len(customers_list),
                    "topCustomers": customers_list[:5],
                    "averageOrderValue": round(total_revenue / len(completed_orders), 2) if completed_orders else 0,
                    "list": customers_list  # Full customer list for frontend compatibility
                },
                
                # Quick stats for dashboard widgets
                "stats": {
                    "revenue": round(total_revenue, 2),
                    "orders": len(orders),
                    "customers": len(customers_list),
                    "inventory": len(active_inventory),
                    "lowStock": len(low_stock_items),
                    "pending": len(pending_orders)
                },
                
                "lastUpdated": current_time.isoformat()
            }
            
            return create_success_response(dashboard_data)
            
        except Exception as db_error:
            logging.error(f"Database error: {str(db_error)}")
            return create_error_response(f"Database error: {str(db_error)}", 500)
    
    except Exception as e:
        logging.error(f"Unexpected error: {str(e)}")
        return create_error_response(f"Internal server error: {str(e)}", 500)