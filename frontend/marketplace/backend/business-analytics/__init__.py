import azure.functions as func
import json
import logging
import os
from datetime import datetime, timedelta
from azure.cosmos import CosmosClient, exceptions
from typing import Dict, Any, List

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Python HTTP trigger function processed a business analytics request.')
    
    # CORS headers
    headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Email, X-Business-ID',
        'Content-Type': 'application/json'
    }
    
    # Handle preflight OPTIONS request
    if req.method == 'OPTIONS':
        return func.HttpResponse('', status_code=200, headers=headers)
    
    try:
        # Initialize Cosmos DB client
        cosmos_connection = os.environ.get('COSMOSDB__MARKETPLACE_CONNECTION_STRING')
        if not cosmos_connection:
            raise ValueError("COSMOSDB__MARKETPLACE_CONNECTION_STRING not found")
        
        # Parse connection string
        connection_parts = cosmos_connection.split(';')
        endpoint = next(part.replace('AccountEndpoint=', '') for part in connection_parts if 'AccountEndpoint' in part)
        key = next(part.replace('AccountKey=', '') for part in connection_parts if 'AccountKey' in part)
        
        client = CosmosClient(endpoint, key)
        database_name = os.environ.get('COSMOSDB_MARKETPLACE_DATABASE_NAME', 'greener-marketplace-db')
        database = client.get_database_client(database_name)
        
        # Get parameters
        business_id = req.headers.get('x-business-id') or req.headers.get('x-user-email') or req.params.get('businessId')
        timeframe = req.params.get('timeframe', 'month')  # week, month, quarter, year
        metrics = req.params.get('metrics', 'all')  # sales, profit, inventory, customers
        
        if not business_id:
            return func.HttpResponse(
                json.dumps({'error': 'Business ID is required'}),
                status_code=400,
                headers=headers
            )
        
        # Calculate date range
        now = datetime.utcnow()
        if timeframe == 'week':
            start_date = now - timedelta(days=7)
        elif timeframe == 'quarter':
            start_date = datetime(now.year, ((now.month - 1) // 3) * 3 + 1, 1)
        elif timeframe == 'year':
            start_date = datetime(now.year, 1, 1)
        else:  # month
            start_date = datetime(now.year, now.month, 1)
        
        analytics_data = {}
        
        # Get sales analytics
        if metrics in ['all', 'sales']:
            analytics_data['sales'] = get_sales_analytics(database, business_id, start_date, now)
        
        # Get inventory analytics
        if metrics in ['all', 'inventory']:
            analytics_data['inventory'] = get_inventory_analytics(database, business_id)
        
        # Get customer analytics
        if metrics in ['all', 'customers']:
            analytics_data['customers'] = get_customer_analytics(database, business_id, start_date)
        
        # Get profit analytics
        if metrics in ['all', 'profit']:
            analytics_data['profit'] = get_profit_analytics(database, business_id, start_date, now)
        
        response_data = {
            'success': True,
            'data': {
                'businessId': business_id,
                'timeframe': timeframe,
                'generatedAt': now.isoformat(),
                **analytics_data
            }
        }
        
        return func.HttpResponse(
            json.dumps(response_data),
            status_code=200,
            headers=headers
        )
        
    except Exception as e:
        logging.error(f'Business analytics error: {str(e)}')
        return func.HttpResponse(
            json.dumps({'error': f'Analytics error: {str(e)}'}),
            status_code=500,
            headers=headers
        )

def get_sales_analytics(database, business_id: str, start_date: datetime, end_date: datetime) -> Dict[str, Any]:
    """Get sales analytics data"""
    try:
        orders_container = database.get_container_client('orders')
        
        # Query for completed orders in date range
        query = """
        SELECT * FROM c 
        WHERE c.businessId = @business_id 
        AND c.orderDate >= @start_date 
        AND c.orderDate <= @end_date
        AND c.status = 'completed'
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
        
        # Calculate metrics
        total_revenue = sum(order.get('total', 0) for order in orders)
        total_orders = len(orders)
        average_order_value = total_revenue / total_orders if total_orders > 0 else 0
        
        # Create daily breakdown for trend
        sales_by_day = {}
        for order in orders:
            order_date = datetime.fromisoformat(order['orderDate'].replace('Z', '+00:00')).date()
            day_str = order_date.isoformat()
            
            if day_str not in sales_by_day:
                sales_by_day[day_str] = {'revenue': 0, 'orders': 0}
            
            sales_by_day[day_str]['revenue'] += order.get('total', 0)
            sales_by_day[day_str]['orders'] += 1
        
        # Create trend data for charts
        labels = []
        values = []
        current_date = start_date.date()
        end_date_only = end_date.date()
        
        while current_date <= end_date_only:
            day_str = current_date.isoformat()
            day_data = sales_by_day.get(day_str, {'revenue': 0, 'orders': 0})
            
            labels.append(current_date.strftime('%m/%d'))
            values.append(day_data['revenue'])
            
            current_date += timedelta(days=1)
        
        return {
            'totalRevenue': total_revenue,
            'totalOrders': total_orders,
            'averageOrderValue': average_order_value,
            'trendData': {
                'labels': labels,
                'datasets': [{
                    'data': values,
                    'color': 'rgba(76, 175, 80, 1)'
                }]
            },
            'dailyBreakdown': sales_by_day
        }
        
    except Exception as e:
        logging.error(f'Sales analytics error: {str(e)}')
        return {
            'totalRevenue': 0,
            'totalOrders': 0,
            'averageOrderValue': 0,
            'trendData': {'labels': [], 'datasets': [{'data': []}]},
            'dailyBreakdown': {}
        }

def get_inventory_analytics(database, business_id: str) -> Dict[str, Any]:
    """Get inventory analytics data"""
    try:
        inventory_container = database.get_container_client('inventory')
        
        # Query all inventory items for the business
        query = "SELECT * FROM c WHERE c.businessId = @business_id"
        inventory_items = list(inventory_container.query_items(
            query=query,
            parameters=[{'name': '@business_id', 'value': business_id}],
            enable_cross_partition_query=True
        ))
        
        total_items = len(inventory_items)
        active_items = len([item for item in inventory_items if item.get('status') == 'active'])
        low_stock_items = len([
            item for item in inventory_items 
            if item.get('quantity', 0) <= item.get('minThreshold', 5) and item.get('status') == 'active'
        ])
        
        total_value = sum(
            item.get('price', 0) * item.get('quantity', 0) 
            for item in inventory_items
        )
        
        # Category breakdown
        category_breakdown = {}
        for item in inventory_items:
            category = item.get('category') or item.get('productType', 'Other')
            if category not in category_breakdown:
                category_breakdown[category] = {'count': 0, 'value': 0}
            
            category_breakdown[category]['count'] += 1
            category_breakdown[category]['value'] += item.get('price', 0) * item.get('quantity', 0)
        
        # Low stock details
        low_stock_details = [
            {
                'id': item['id'],
                'name': item.get('name') or item.get('common_name', 'Unknown'),
                'quantity': item.get('quantity', 0),
                'minThreshold': item.get('minThreshold', 5),
                'category': item.get('category') or item.get('productType', 'Other')
            }
            for item in inventory_items
            if item.get('quantity', 0) <= item.get('minThreshold', 5) and item.get('status') == 'active'
        ]
        
        return {
            'totalItems': total_items,
            'activeItems': active_items,
            'lowStockItems': low_stock_items,
            'totalValue': total_value,
            'categoryBreakdown': category_breakdown,
            'lowStockDetails': low_stock_details
        }
        
    except Exception as e:
        logging.error(f'Inventory analytics error: {str(e)}')
        return {
            'totalItems': 0,
            'activeItems': 0,
            'lowStockItems': 0,
            'totalValue': 0,
            'categoryBreakdown': {},
            'lowStockDetails': []
        }

def get_customer_analytics(database, business_id: str, start_date: datetime) -> Dict[str, Any]:
    """Get customer analytics data"""
    try:
        customers_container = database.get_container_client('business_customers')
        
        # Query all customers for the business
        query = "SELECT * FROM c WHERE c.businessId = @business_id"
        customers = list(customers_container.query_items(
            query=query,
            parameters=[{'name': '@business_id', 'value': business_id}],
            enable_cross_partition_query=True
        ))
        
        total_customers = len(customers)
        
        # Count new customers in the period
        new_customers = 0
        for customer in customers:
            first_purchase = customer.get('firstPurchaseDate') or customer.get('joinDate')
            if first_purchase:
                customer_date = datetime.fromisoformat(first_purchase.replace('Z', '+00:00'))
                if customer_date >= start_date:
                    new_customers += 1
        
        # Customer tiers
        customer_tiers = {
            'vip': len([c for c in customers if c.get('totalSpent', 0) >= 500 or c.get('orderCount', 0) >= 10]),
            'premium': len([c for c in customers if c.get('totalSpent', 0) >= 200 or c.get('orderCount', 0) >= 5]),
            'regular': len([c for c in customers if c.get('orderCount', 0) >= 2]),
            'new': len([c for c in customers if c.get('orderCount', 0) < 2])
        }
        
        # Calculate averages
        total_spent = sum(c.get('totalSpent', 0) for c in customers)
        average_order_value = total_spent / total_customers if total_customers > 0 else 0
        
        repeat_customers = len([c for c in customers if c.get('orderCount', 0) > 1])
        repeat_customer_rate = (repeat_customers / total_customers * 100) if total_customers > 0 else 0
        
        return {
            'totalCustomers': total_customers,
            'newCustomers': new_customers,
            'customerTiers': customer_tiers,
            'averageOrderValue': average_order_value,
            'repeatCustomerRate': repeat_customer_rate
        }
        
    except Exception as e:
        logging.error(f'Customer analytics error: {str(e)}')
        return {
            'totalCustomers': 0,
            'newCustomers': 0,
            'customerTiers': {'vip': 0, 'premium': 0, 'regular': 0, 'new': 0},
            'averageOrderValue': 0,
            'repeatCustomerRate': 0
        }

def get_profit_analytics(database, business_id: str, start_date: datetime, end_date: datetime) -> Dict[str, Any]:
    """Get profit analytics data"""
    try:
        transactions_container = database.get_container_client('business_transactions')
        
        # Query transactions in date range
        query = """
        SELECT * FROM c 
        WHERE c.businessId = @business_id 
        AND c.date >= @start_date 
        AND c.date <= @end_date
        """
        
        transactions = list(transactions_container.query_items(
            query=query,
            parameters=[
                {'name': '@business_id', 'value': business_id},
                {'name': '@start_date', 'value': start_date.isoformat()},
                {'name': '@end_date', 'value': end_date.isoformat()}
            ],
            enable_cross_partition_query=True
        ))
        
        # Calculate revenue and expenses
        revenue = sum(t.get('amount', 0) for t in transactions if t.get('type') == 'sale')
        expenses = sum(t.get('amount', 0) for t in transactions if t.get('type') in ['expense', 'purchase'])
        
        gross_profit = revenue - expenses
        profit_margin = (gross_profit / revenue * 100) if revenue > 0 else 0
        
        # Expense breakdown by category
        expense_breakdown = {}
        for transaction in transactions:
            if transaction.get('type') == 'expense':
                category = transaction.get('category', 'Other')
                expense_breakdown[category] = expense_breakdown.get(category, 0) + transaction.get('amount', 0)
        
        return {
            'revenue': revenue,
            'expenses': expenses,
            'grossProfit': gross_profit,
            'profitMargin': profit_margin,
            'expenseBreakdown': expense_breakdown
        }
        
    except Exception as e:
        logging.error(f'Profit analytics error: {str(e)}')
        return {
            'revenue': 0,
            'expenses': 0,
            'grossProfit': 0,
            'profitMargin': 0,
            'expenseBreakdown': {}
        }