# backend/business-dashboard/__init__.py
import logging
import json
from datetime import datetime, timedelta
import azure.functions as func
from db_helpers import get_marketplace_container
from http_helpers import add_cors_headers, handle_options_request, create_error_response, create_success_response, extract_user_id

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Business dashboard function processed a request.')
    
    # Handle OPTIONS method for CORS preflight
    if req.method == 'OPTIONS':
        return handle_options_request()
    
    try:
        # Get user ID from request headers for authentication
        user_id = extract_user_id(req)
        if not user_id:
            return create_error_response("User authentication required", 401)
        
        # Use user_id as business_id
        business_id = user_id
        logging.info(f"Loading dashboard data for business: {business_id}")
        
        # Get all required containers
        business_users_container = get_marketplace_container("business_users")
        inventory_container = get_marketplace_container("inventory")
        orders_container = get_marketplace_container("orders")
        
        # 1. Get business profile info
        try:
            business_profile = business_users_container.read_item(
                item=business_id,
                partition_key=business_id
            )
        except Exception as e:
            logging.error(f"Business profile not found: {str(e)}")
            return create_error_response("Business profile not found", 404)
        
        # 2. Get inventory data
        try:
            inventory_query = "SELECT * FROM c WHERE c.businessId = @businessId"
            inventory_items = list(inventory_container.query_items(
                query=inventory_query,
                parameters=[{"name": "@businessId", "value": business_id}],
                enable_cross_partition_query=True
            ))
        except Exception as e:
            logging.error(f"Error fetching inventory: {str(e)}")
            inventory_items = []
        
        # 3. Get orders data (last 30 days)
        try:
            thirty_days_ago = (datetime.utcnow() - timedelta(days=30)).isoformat()
            orders_query = """
                SELECT * FROM c 
                WHERE c.businessId = @businessId 
                AND c.orderDate >= @startDate
                ORDER BY c.orderDate DESC
            """
            recent_orders = list(orders_container.query_items(
                query=orders_query,
                parameters=[
                    {"name": "@businessId", "value": business_id},
                    {"name": "@startDate", "value": thirty_days_ago}
                ],
                enable_cross_partition_query=True
            ))
        except Exception as e:
            logging.error(f"Error fetching orders: {str(e)}")
            recent_orders = []
        
        # Calculate dashboard metrics
        dashboard_data = calculate_dashboard_metrics(
            business_profile, 
            inventory_items, 
            recent_orders
        )
        
        logging.info(f"Dashboard data calculated for {business_id}: {len(inventory_items)} inventory items, {len(recent_orders)} recent orders")
        
        return create_success_response(dashboard_data)
    
    except Exception as e:
        logging.error(f"Error loading dashboard: {str(e)}")
        return create_error_response(f"Internal server error: {str(e)}", 500)

def calculate_dashboard_metrics(business_profile, inventory_items, recent_orders):
    """Calculate business dashboard metrics from real data"""
    
    # Business info
    business_name = business_profile.get('businessName', 'Your Business')
    business_logo = business_profile.get('logo')
    
    # Inventory metrics
    total_inventory = len(inventory_items)
    active_inventory = len([item for item in inventory_items if item.get('status') == 'active'])
    low_stock_items = [
        item for item in inventory_items 
        if item.get('quantity', 0) <= item.get('minThreshold', 5)
    ]
    low_stock_count = len(low_stock_items)
    
    # Calculate total inventory value
    total_inventory_value = sum(
        (item.get('quantity', 0) * item.get('price', 0)) 
        for item in inventory_items
    )
    
    # Orders metrics
    total_orders = len(recent_orders)
    completed_orders = [order for order in recent_orders if order.get('status') == 'completed']
    pending_orders = [order for order in recent_orders if order.get('status') in ['pending', 'processing']]
    
    # Revenue calculations
    total_revenue = sum(order.get('total', 0) for order in completed_orders)
    
    # Today's metrics
    today = datetime.utcnow().date().isoformat()
    today_orders = [
        order for order in recent_orders 
        if order.get('orderDate', '').startswith(today)
    ]
    today_revenue = sum(order.get('total', 0) for order in today_orders if order.get('status') == 'completed')
    
    # Top selling products (based on recent orders)
    product_sales = {}
    for order in completed_orders:
        for item in order.get('items', []):
            product_name = item.get('name', 'Unknown Product')
            if product_name not in product_sales:
                product_sales[product_name] = {
                    'name': product_name,
                    'sold': 0,
                    'revenue': 0
                }
            product_sales[product_name]['sold'] += item.get('quantity', 0)
            product_sales[product_name]['revenue'] += item.get('totalPrice', 0)
    
    # Sort and get top 3
    top_products = sorted(
        product_sales.values(), 
        key=lambda x: x['revenue'], 
        reverse=True
    )[:3]
    
    # Recent orders for display (last 5)
    recent_orders_display = []
    for order in recent_orders[:5]:
        recent_orders_display.append({
            'id': order.get('id'),
            'customer': order.get('customerName', 'Unknown Customer'),
            'date': order.get('orderDate'),
            'total': order.get('total', 0),
            'status': order.get('status', 'pending')
        })
    
    # Low stock details
    low_stock_details = []
    for item in low_stock_items[:5]:  # Top 5 low stock items
        low_stock_details.append({
            'id': item.get('id'),
            'title': item.get('common_name') or item.get('productName', 'Unknown Item'),
            'quantity': item.get('quantity', 0),
            'minThreshold': item.get('minThreshold', 5)
        })
    
    return {
        'businessInfo': {
            'businessId': business_profile.get('id'),
            'businessName': business_name,
            'businessType': business_profile.get('businessType', 'Plant Business'),
            'businessLogo': business_logo,
            'joinDate': business_profile.get('joinDate'),
            'email': business_profile.get('email'),
            'rating': business_profile.get('rating', 0),
            'reviewCount': business_profile.get('reviewCount', 0)
        },
        'metrics': {
            'totalSales': total_revenue,
            'salesToday': today_revenue,
            'newOrders': len(pending_orders),
            'lowStockItems': low_stock_count,
            'totalInventory': total_inventory,
            'activeInventory': active_inventory,
            'totalOrders': total_orders,
            'inventoryValue': total_inventory_value
        },
        'topProducts': top_products,
        'recentOrders': recent_orders_display,
        'lowStockDetails': low_stock_details,
        'summary': {
            'last30Days': {
                'orders': total_orders,
                'revenue': total_revenue,
                'completedOrders': len(completed_orders)
            }
        }
    }