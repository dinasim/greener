import azure.functions as func
import json
import logging
import os
from datetime import datetime
from azure.cosmos import CosmosClient, exceptions
from typing import Dict, Any, List

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Python HTTP trigger function processed a bulk inventory request.')
    
    # CORS headers
    headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Email, X-Business-ID',
        'Content-Type': 'application/json'
    }
    
    if req.method == 'OPTIONS':
        return func.HttpResponse('', status_code=200, headers=headers)
    
    try:
        # Initialize Cosmos DB client
        cosmos_connection = os.environ.get('COSMOSDB__MARKETPLACE_CONNECTION_STRING')
        if not cosmos_connection:
            raise ValueError("COSMOSDB__MARKETPLACE_CONNECTION_STRING not found")
        
        connection_parts = cosmos_connection.split(';')
        endpoint = next(part.replace('AccountEndpoint=', '') for part in connection_parts if 'AccountEndpoint' in part)
        key = next(part.replace('AccountKey=', '') for part in connection_parts if 'AccountKey' in part)
        
        client = CosmosClient(endpoint, key)
        database_name = os.environ.get('COSMOSDB_MARKETPLACE_DATABASE_NAME', 'greener-marketplace-db')
        database = client.get_database_client(database_name)
        container = database.get_container_client('inventory')
        
        # Get parameters
        business_id = req.headers.get('x-business-id') or req.headers.get('x-user-email')
        
        if not business_id:
            return func.HttpResponse(
                json.dumps({'error': 'Business ID is required'}),
                status_code=400,
                headers=headers
            )
        
        # Parse request body
        try:
            req_body = req.get_json()
            action = req_body.get('action')
            items = req_body.get('items', [])
        except ValueError:
            return func.HttpResponse(
                json.dumps({'error': 'Invalid JSON in request body'}),
                status_code=400,
                headers=headers
            )
        
        if not action or not isinstance(items, list):
            return func.HttpResponse(
                json.dumps({'error': 'Action and items array are required'}),
                status_code=400,
                headers=headers
            )
        
        results = []
        errors = []
        
        # Process bulk operations
        if action == 'delete':
            results, errors = bulk_delete_items(container, business_id, items)
        elif action == 'update':
            results, errors = bulk_update_items(container, business_id, items)
        elif action in ['activate', 'deactivate']:
            results, errors = bulk_status_change(container, business_id, items, action)
        else:
            return func.HttpResponse(
                json.dumps({'error': 'Invalid action. Supported: delete, update, activate, deactivate'}),
                status_code=400,
                headers=headers
            )
        
        response_data = {
            'success': True,
            'action': action,
            'processed': len(results),
            'errors': len(errors),
            'results': results,
            'errors': errors
        }
        
        return func.HttpResponse(
            json.dumps(response_data),
            status_code=200,
            headers=headers
        )
        
    except Exception as e:
        logging.error(f'Bulk inventory operation error: {str(e)}')
        return func.HttpResponse(
            json.dumps({'error': f'Bulk operation failed: {str(e)}'}),
            status_code=500,
            headers=headers
        )

def bulk_delete_items(container, business_id: str, item_ids: List[str]) -> tuple:
    """Delete multiple items"""
    results = []
    errors = []
    
    for item_id in item_ids:
        try:
            # Verify item exists and belongs to business
            item = container.read_item(item=item_id, partition_key=business_id)
            
            if item and item.get('businessId') == business_id:
                container.delete_item(item=item_id, partition_key=business_id)
                results.append({'id': item_id, 'status': 'deleted'})
            else:
                errors.append({'id': item_id, 'error': 'Item not found or access denied'})
                
        except exceptions.CosmosResourceNotFoundError:
            errors.append({'id': item_id, 'error': 'Item not found'})
        except Exception as e:
            errors.append({'id': item_id, 'error': str(e)})
    
    return results, errors

def bulk_update_items(container, business_id: str, update_items: List[Dict]) -> tuple:
    """Update multiple items"""
    results = []
    errors = []
    
    for update_item in update_items:
        try:
            item_id = update_item.get('id')
            updates = update_item.get('updates', {})
            
            if not item_id:
                errors.append({'id': 'unknown', 'error': 'Item ID is required'})
                continue
            
            # Read existing item
            existing_item = container.read_item(item=item_id, partition_key=business_id)
            
            if existing_item and existing_item.get('businessId') == business_id:
                # Merge updates
                updated_item = {**existing_item, **updates}
                updated_item['lastUpdated'] = datetime.utcnow().isoformat()
                
                # Recalculate final price if needed
                if 'price' in updates or 'discount' in updates:
                    price = updated_item.get('price', 0)
                    discount = updated_item.get('discount', 0)
                    updated_item['finalPrice'] = price - (price * discount / 100)
                
                # Update in database
                container.replace_item(item=item_id, body=updated_item)
                results.append({'id': item_id, 'status': 'updated', 'item': updated_item})
            else:
                errors.append({'id': item_id, 'error': 'Item not found or access denied'})
                
        except exceptions.CosmosResourceNotFoundError:
            errors.append({'id': item_id, 'error': 'Item not found'})
        except Exception as e:
            errors.append({'id': item_id, 'error': str(e)})
    
    return results, errors

def bulk_status_change(container, business_id: str, item_ids: List[str], action: str) -> tuple:
    """Change status of multiple items"""
    results = []
    errors = []
    new_status = 'active' if action == 'activate' else 'inactive'
    
    for item_id in item_ids:
        try:
            # Read existing item
            existing_item = container.read_item(item=item_id, partition_key=business_id)
            
            if existing_item and existing_item.get('businessId') == business_id:
                updated_item = {**existing_item}
                updated_item['status'] = new_status
                updated_item['lastUpdated'] = datetime.utcnow().isoformat()
                
                container.replace_item(item=item_id, body=updated_item)
                results.append({'id': item_id, 'status': f'{action}d', 'newStatus': new_status})
            else:
                errors.append({'id': item_id, 'error': 'Item not found or access denied'})
                
        except exceptions.CosmosResourceNotFoundError:
            errors.append({'id': item_id, 'error': 'Item not found'})
        except Exception as e:
            errors.append({'id': item_id, 'error': str(e)})
    
    return results, errors