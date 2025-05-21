import azure.functions as func
import json
import logging
import os
from datetime import datetime, timedelta
from azure.cosmos import CosmosClient, exceptions
from typing import Dict, Any, List

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Python HTTP trigger function processed a business reports request.')
    
    # CORS headers
    headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Email, X-Business-ID',
        'Content-Type': 'application/json'
    }
    
    if req.method == 'OPTIONS':
        return func.HttpResponse('', status_code=200, headers=headers)
    
    try:
        # Initialize Cosmos DB client
        cosmos_connection = os.environ.get('COSMOSDB__MARKETPLACE_CONNECTION_STRING')
        connection_parts = cosmos_connection.split(';')
        endpoint = next(part.replace('AccountEndpoint=', '') for part in connection_parts if 'AccountEndpoint' in part)
        key = next(part.replace('AccountKey=', '') for part in connection_parts if 'AccountKey' in part)
        
        client = CosmosClient(endpoint, key)
        database_name = os.environ.get('COSMOSDB_MARKETPLACE_DATABASE_NAME', 'greener-marketplace-db')
        database = client.get_database_client(database_name)
        
        # Get parameters
        business_id = req.headers.get('x-business-id') or req.headers.get('x-user-email')
        report_type = req.params.get('type', 'summary')
        
        # Date range parameters
        start_date_param = req.params.get('startDate')
        end_date_param = req.params.get('endDate')
        
        if start_date_param:
            start_date = datetime.fromisoformat(start_date_param.replace('Z', '+00:00'))
        else:
            now = datetime.utcnow()
            start_date = datetime(now.year, now.month, 1)
        
        if end_date_param:
            end_date = datetime.fromisoformat(end_date_param.replace('Z', '+00:00'))
        else:
            end_date = datetime.utcnow()
        
        if not business_id:
            return func.HttpResponse(
                json.dumps({'error': 'Business ID is required'}),
                status_code=400,
                headers=headers
            )
        
        # Generate report based on type
        report_data = generate_report(database, business_id, report_type, start_date, end_date)
        
        response_data = {
            'success': True,
            'report': report_data
        }
        
        return func.HttpResponse(
            json.dumps(response_data),
            status_code=200,
            headers=headers
        )
        
    except Exception as e:
        logging.error(f'Business reports error: {str(e)}')
        return func.HttpResponse(
            json.dumps({'error': f'Report generation failed: {str(e)}'}),
            status_code=500,
            headers=headers
        )

def generate_report(database, business_id: str, report_type: str, start_date: datetime, end_date: datetime) -> Dict[str, Any]:
    """Generate business report based on type"""
    
    report_data = {
        'businessId': business_id,
        'reportType': report_type,
        'period': {
            'startDate': start_date.isoformat(),
            'endDate': end_date.isoformat()
        },
        'generatedAt': datetime.utcnow().isoformat()
    }
    
    try:
        if report_type == 'sales':
            report_data['salesReport'] = generate_sales_report(database, business_id, start_date, end_date)
        elif report_type == 'inventory':
            report_data['inventoryReport'] = generate_inventory_report(database, business_id)
        elif report_type == 'customers':
            report_data['customerReport'] = generate_customer_report(database, business_id, start_date)
        else:  # summary
            report_data['summaryReport'] = generate_summary_report(database, business_id, start_date, end_date)
    
    except Exception as e:
        logging.error(f'Report generation error for {report_type}: {str(e)}')
        report_data['error'] = str(e)
    
    return report_data

def generate_sales_report(database, business_id: str, start_date: datetime, end_date: datetime) -> Dict[str, Any]:
    """Generate detailed sales report"""
    orders_container = database.get_container_client('orders')
    
    # Query orders in date range
    query = """
    SELECT * FROM c 
    WHERE c.businessId = @business_id 
    AND c.orderDate >= @start_date 
    AND c.orderDate <= @end_date
    ORDER BY c.orderDate DESC
    """
    
    orders = list(orders_container.query_items(
        query=query,
        parameters=[
            {'name': '@business_id', 'value': business_id},
            {'name': '@start_date', 'value': start_date.isoformat()},
            {'name': '@end_date', 'value': end_date.isoformat()}
        ],
        enable_cross_partition_query=True
    ))
    
    # Calculate summary metrics
    completed_orders = [o for o in orders if o.get('status') == 'completed']
    total_revenue = sum(o.get('total', 0) for o in completed_orders)
    
    sales_summary = {
        'totalOrders': len(orders),
        'completedOrders': len(completed_orders),
        'totalRevenue': total_revenue,
        'averageOrderValue': total_revenue / len(completed_orders) if completed_orders else 0,
        'topProducts': {},
        'dailySales': {}
    }
    
    # Analyze products and daily sales
    for order in orders:
        order_date = datetime.fromisoformat(order['orderDate'].replace('Z', '+00:00')).date().isoformat()
        
        if order_date not in sales_summary['dailySales']:
            sales_summary['dailySales'][order_date] = {'orders': 0, 'revenue': 0}
        
        sales_summary['dailySales'][order_date]['orders'] += 1
        if order.get('status') == 'completed':
            sales_summary['dailySales'][order_date]['revenue'] += order.get('total', 0)
        
        # Count product sales
        if order.get('items') and order.get('status') == 'completed':
            for item in order['items']:
                product_name = item.get('name', 'Unknown')
                if product_name not in sales_summary['topProducts']:
                    sales_summary['topProducts'][product_name] = {'quantity': 0, 'revenue': 0}
                
                sales_summary['topProducts'][product_name]['quantity'] += item.get('quantity', 0)
                sales_summary['topProducts'][product_name]['revenue'] += item.get('totalPrice', 0)
    
    # Format orders for report
    order_list = [
        {
            'id': order['id'],
            'confirmationNumber': order.get('confirmationNumber'),
            'customerName': order.get('customerName'),
            'orderDate': order.get('orderDate'),
            'status': order.get('status'),
            'total': order.get('total', 0),
            'itemCount': len(order.get('items', []))
        }
        for order in orders
    ]
    
    return {
        'summary': sales_summary,
        'orders': order_list
    }

def generate_inventory_report(database, business_id: str) -> Dict[str, Any]:
    """Generate inventory report"""
    inventory_container = database.get_container_client('inventory')
    
    query = "SELECT * FROM c WHERE c.businessId = @business_id"
    inventory_items = list(inventory_container.query_items(
        query=query,
        parameters=[{'name': '@business_id', 'value': business_id}],
        enable_cross_partition_query=True
    ))
    
    # Calculate summary
    total_value = sum(item.get('price', 0) * item.get('quantity', 0) for item in inventory_items)
    active_items = [item for item in inventory_items if item.get('status') == 'active']
    low_stock_items = [
        item for item in inventory_items 
        if item.get('quantity', 0) <= item.get('minThreshold', 5)
    ]
    
    inventory_summary = {
        'totalItems': len(inventory_items),
        'activeItems': len(active_items),
        'lowStockItems': len(low_stock_items),
        'totalValue': total_value,
        'categories': {}
    }
    
    # Category breakdown
    for item in inventory_items:
        category = item.get('category') or item.get('productType', 'Other')
        if category not in inventory_summary['categories']:
            inventory_summary['categories'][category] = {'count': 0, 'value': 0}
        
        inventory_summary['categories'][category]['count'] += 1
        inventory_summary['categories'][category]['value'] += item.get('price', 0) * item.get('quantity', 0)
    
    # Format items for report
    items_list = [
        {
            'id': item['id'],
            'name': item.get('name') or item.get('common_name', 'Unknown'),
            'category': item.get('category') or item.get('productType', 'Other'),
            'quantity': item.get('quantity', 0),
            'price': item.get('price', 0),
            'value': item.get('price', 0) * item.get('quantity', 0),
            'status': item.get('status', 'active'),
            'isLowStock': item.get('quantity', 0) <= item.get('minThreshold', 5)
        }
        for item in inventory_items
    ]
    
    return {
        'summary': inventory_summary,
        'items': items_list
    }

def generate_customer_report(database, business_id: str, start_date: datetime) -> Dict[str, Any]:
    """Generate customer report"""
    customers_container = database.get_container_client('business_customers')
    
    query = "SELECT * FROM c WHERE c.businessId = @business_id"
    customers = list(customers_container.query_items(
        query=query,
        parameters=[{'name': '@business_id', 'value': business_id}],
        enable_cross_partition_query=True
    ))
    
    # Calculate metrics
    total_spent = sum(c.get('totalSpent', 0) for c in customers)
    new_customers = 0
    
    for customer in customers:
        first_purchase = customer.get('firstPurchaseDate') or customer.get('joinDate')
        if first_purchase:
            customer_date = datetime.fromisoformat(first_purchase.replace('Z', '+00:00'))
            if customer_date >= start_date:
                new_customers += 1
    
    repeat_customers = len([c for c in customers if c.get('orderCount', 0) > 1])
    
    customer_summary = {
        'totalCustomers': len(customers),
        'newCustomers': new_customers,
        'repeatCustomers': repeat_customers,
        'totalSpent': total_spent,
        'averageSpent': total_spent / len(customers) if customers else 0
    }
    
    # Format customers for report
    customer_list = [
        {
            'id': customer['id'],
            'name': customer.get('name', 'Unknown'),
            'email': customer.get('email', ''),
            'orderCount': customer.get('orderCount', 0),
            'totalSpent': customer.get('totalSpent', 0),
            'lastOrderDate': customer.get('lastOrderDate'),
            'joinDate': customer.get('firstPurchaseDate') or customer.get('joinDate')
        }
        for customer in customers
    ]
    
    return {
        'summary': customer_summary,
        'customers': customer_list
    }

def generate_summary_report(database, business_id: str, start_date: datetime, end_date: datetime) -> Dict[str, Any]:
    """Generate summary report combining all metrics"""
    try:
        # Get basic counts and totals from each container
        orders_container = database.get_container_client('orders')
        inventory_container = database.get_container_client('inventory')
        customers_container = database.get_container_client('business_customers')
        
        # Orders summary
        orders_query = """
        SELECT 
            COUNT(1) as orderCount,
            SUM(CASE WHEN c.status = 'completed' THEN c.total ELSE 0 END) as revenue
        FROM c 
        WHERE c.businessId = @business_id 
        AND c.orderDate >= @start_date 
        AND c.orderDate <= @end_date
        """
        
        order_results = list(orders_container.query_items(
            query=orders_query,
            parameters=[
                {'name': '@business_id', 'value': business_id},
                {'name': '@start_date', 'value': start_date.isoformat()},
                {'name': '@end_date', 'value': end_date.isoformat()}
            ],
            enable_cross_partition_query=True
        ))
        
        # Inventory summary
        inventory_query = """
        SELECT 
            COUNT(1) as totalItems,
            SUM(CASE WHEN c.status = 'active' THEN 1 ELSE 0 END) as activeItems,
            SUM(c.price * c.quantity) as totalValue
        FROM c WHERE c.businessId = @business_id
        """
        
        inventory_results = list(inventory_container.query_items(
            query=inventory_query,
            parameters=[{'name': '@business_id', 'value': business_id}],
            enable_cross_partition_query=True
        ))
        
        # Customer summary  
        customer_query = """
        SELECT 
            COUNT(1) as totalCustomers,
            SUM(c.totalSpent) as totalCustomerSpent
        FROM c WHERE c.businessId = @business_id
        """
        
        customer_results = list(customers_container.query_items(
            query=customer_query,
            parameters=[{'name': '@business_id', 'value': business_id}],
            enable_cross_partition_query=True
        ))
        
        return {
            'orders': order_results[0] if order_results else {'orderCount': 0, 'revenue': 0},
            'inventory': inventory_results[0] if inventory_results else {'totalItems': 0, 'activeItems': 0, 'totalValue': 0},
            'customers': customer_results[0] if customer_results else {'totalCustomers': 0, 'totalCustomerSpent': 0}
        }
        
    except Exception as e:
        logging.error(f'Summary report error: {str(e)}')
        return {
            'orders': {'orderCount': 0, 'revenue': 0},
            'inventory': {'totalItems': 0, 'activeItems': 0, 'totalValue': 0},
            'customers': {'totalCustomers': 0, 'totalCustomerSpent': 0}
        }