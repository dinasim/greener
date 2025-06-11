# backend/business-dashboard/__init__.py
import logging
import json
import azure.functions as func
from azure.cosmos import CosmosClient
from datetime import datetime, timedelta
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
    logging.info('Business dashboard function processed a request.')
    
    # Handle OPTIONS method for CORS preflight
    if req.method == 'OPTIONS':
        response = func.HttpResponse("", status_code=200)
        return add_cors_headers(response)
    
    try:
        # Get business ID from headers
        business_id = get_user_id_from_request(req)
        
        if not business_id:
            response = func.HttpResponse(
                json.dumps({"error": "Business authentication required. Please provide X-User-Email header."}),
                status_code=401,
                mimetype="application/json"
            )
            return add_cors_headers(response)
        
        logging.info(f"Getting dashboard data for business: {business_id}")
        
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
            
            # Get all containers we need
            business_users_container = database.get_container_client("business_users")
            inventory_container = database.get_container_client("inventory")
            orders_container = database.get_container_client("orders")
            transactions_container = database.get_container_client("business_transactions")
            
            # 1. Get or create business profile
            try:
                business_profile = business_users_container.read_item(item=business_id, partition_key=business_id)
                logging.info(f"Found existing business profile for {business_id}")
            except Exception:
                # Create default business profile if doesn't exist
                logging.info(f"Creating default business profile for {business_id}")
                business_profile = {
                    "id": business_id,
                    "email": business_id,
                    "businessName": business_id.split('@')[0].replace('.', ' ').title() + " Business",
                    "businessType": "Plant Business",
                    "contactEmail": business_id,
                    "joinDate": datetime.utcnow().isoformat(),
                    "status": "active",
                    "rating": 0,
                    "reviewCount": 0,
                    "settings": {
                        "notifications": True,
                        "messages": True,
                        "lowStockThreshold": 5
                    }
                }
                business_users_container.upsert_item(business_profile)
            
            # 2. Get inventory metrics
            inventory_query = "SELECT * FROM c WHERE c.businessId = @businessId"
            inventory_params = [{"name": "@businessId", "value": business_id}]
            inventory_items = list(inventory_container.query_items(
                query=inventory_query,
                parameters=inventory_params,
                enable_cross_partition_query=False
            ))
            
            # Calculate inventory metrics
            total_inventory = len(inventory_items)
            active_inventory = len([item for item in inventory_items if item.get('status') == 'active'])
            low_stock_items = [item for item in inventory_items 
                             if item.get('quantity', 0) <= item.get('minThreshold', 5) and item.get('status') == 'active']
            inventory_value = sum([item.get('price', 0) * item.get('quantity', 0) for item in inventory_items])
            
            # 3. Get order metrics
            orders_query = "SELECT * FROM c WHERE c.businessId = @businessId"
            orders_params = [{"name": "@businessId", "value": business_id}]
            orders = list(orders_container.query_items(
                query=orders_query,
                parameters=orders_params,
                enable_cross_partition_query=False,
                partition_key=business_id
            ))
            
            # Calculate order metrics
            today = datetime.utcnow().date()
            total_orders = len(orders)
            pending_orders = len([order for order in orders if order.get('status') == 'pending'])
            
            # 4. Get transaction metrics
            transactions_query = "SELECT * FROM c WHERE c.businessId = @businessId AND c.type = 'sale'"
            transactions_params = [{"name": "@businessId", "value": business_id}]
            transactions = list(transactions_container.query_items(
                query=transactions_query,
                parameters=transactions_params,
                enable_cross_partition_query=False,
                partition_key=business_id
            ))
            
            # Calculate sales metrics
            total_sales = sum([t.get('amount', 0) for t in transactions])
            
            # Today's sales
            today_sales = sum([
                t.get('amount', 0) for t in transactions 
                if t.get('date', '').startswith(today.isoformat())
            ])
            
            # 5. Top products (from sales data)
            product_sales = {}
            for transaction in transactions:
                for item in transaction.get('items', []):
                    product_id = item.get('productId', 'Unknown')
                    product_name = item.get('name', 'Unknown Product')
                    quantity = item.get('quantity', 0)
                    revenue = item.get('price', 0) * quantity
                    
                    if product_id not in product_sales:
                        product_sales[product_id] = {
                            'name': product_name,
                            'sold': 0,
                            'revenue': 0
                        }
                    
                    product_sales[product_id]['sold'] += quantity
                    product_sales[product_id]['revenue'] += revenue
            
            # Sort top products by revenue
            top_products = sorted(product_sales.values(), key=lambda x: x['revenue'], reverse=True)[:5]
            
            # 6. Recent orders
            recent_orders = sorted(orders, key=lambda x: x.get('orderDate', ''), reverse=True)[:5]
            formatted_recent_orders = []
            for order in recent_orders:
                formatted_recent_orders.append({
                    'id': order.get('id'),
                    'customer': order.get('customerName', 'Unknown Customer'),
                    'total': order.get('total', 0),
                    'status': order.get('status', 'pending'),
                    'date': order.get('orderDate')
                })
            
            # 7. Low stock details
            low_stock_details = []
            for item in low_stock_items[:5]:  # Top 5 low stock items
                low_stock_details.append({
                    'id': item.get('id'),
                    'title': item.get('name', item.get('common_name', 'Unknown Item')),
                    'quantity': item.get('quantity', 0),
                    'minThreshold': item.get('minThreshold', 5)
                })
            
            # Build dashboard response
            dashboard_data = {
                "businessInfo": {
                    "businessName": business_profile.get('businessName', 'Your Business'),
                    "businessType": business_profile.get('businessType', 'Plant Business'),
                    "businessLogo": business_profile.get('logo'),
                    "email": business_profile.get('email', business_id),
                    "rating": business_profile.get('rating', 0),
                    "reviewCount": business_profile.get('reviewCount', 0),
                    "joinDate": business_profile.get('joinDate')
                },
                "metrics": {
                    "totalSales": round(total_sales, 2),
                    "salesToday": round(today_sales, 2),
                    "newOrders": pending_orders,
                    "lowStockItems": len(low_stock_items),
                    "totalInventory": total_inventory,
                    "activeInventory": active_inventory,
                    "totalOrders": total_orders,
                    "inventoryValue": round(inventory_value, 2)
                },
                "topProducts": top_products,
                "recentOrders": formatted_recent_orders,
                "lowStockDetails": low_stock_details
            }
            
            response = func.HttpResponse(
                json.dumps(dashboard_data, default=str),
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