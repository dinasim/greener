# backend/business-order-create/__init__.py
import logging
import json
import uuid
import azure.functions as func
from azure.cosmos import CosmosClient
from datetime import datetime, timedelta
import os
import random
import string

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

def generate_confirmation_number():
    """Generate unique confirmation number for pickup orders"""
    timestamp = datetime.now().strftime("%m%d")
    random_part = ''.join(random.choices(string.ascii_uppercase + string.digits, k=4))
    return f"GRN{timestamp}{random_part}"

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Business order create function processed a request.')
    
    # Handle OPTIONS method for CORS preflight
    if req.method == 'OPTIONS':
        response = func.HttpResponse("", status_code=200)
        return add_cors_headers(response)
    
    try:
        # Parse request body
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
        required_fields = ['businessId', 'customerEmail', 'customerName', 'items']
        missing_fields = [field for field in required_fields if field not in request_body]
        
        if missing_fields:
            response = func.HttpResponse(
                json.dumps({"error": f"Missing required fields: {', '.join(missing_fields)}"}),
                status_code=400,
                mimetype="application/json"
            )
            return add_cors_headers(response)
        
        business_id = request_body['businessId']
        customer_email = request_body['customerEmail']
        customer_name = request_body['customerName']
        items = request_body['items']
        customer_phone = request_body.get('customerPhone', '')
        notes = request_body.get('notes', '')
        communication_preference = request_body.get('communicationPreference', 'messages')
        
        if not items or len(items) == 0:
            response = func.HttpResponse(
                json.dumps({"error": "Order must contain at least one item"}),
                status_code=400,
                mimetype="application/json"
            )
            return add_cors_headers(response)
        
        logging.info(f"Creating order for business {business_id}, customer {customer_email}")
        logging.info(f"Items requested: {[item.get('id') or item.get('inventoryId') for item in items]}")
        
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
            inventory_container = database.get_container_client("inventory")
            customers_container = database.get_container_client("business_customers")
            
            # Validate inventory and calculate totals
            validated_items = []
            subtotal = 0
            
            for item in items:
                # Handle both 'id' and 'inventoryId' fields
                item_id = item.get('id') or item.get('inventoryId')
                quantity = item.get('quantity')
                
                if not item_id or not quantity:
                    response = func.HttpResponse(
                        json.dumps({"error": "Each item must have id (or inventoryId) and quantity"}),
                        status_code=400,
                        mimetype="application/json"
                    )
                    return add_cors_headers(response)
                
                try:
                    logging.info(f"Looking for inventory item {item_id} for business {business_id}")
                    
                    # FIXED: First try direct read with partition key
                    try:
                        inventory_item = inventory_container.read_item(
                            item=item_id, 
                            partition_key=business_id
                        )
                        logging.info(f"Found inventory item {item_id} via direct read")
                    except Exception as direct_read_error:
                        logging.warning(f"Direct read failed for {item_id}: {str(direct_read_error)}")
                        
                        # Fallback: Query for the item
                        query = "SELECT * FROM c WHERE c.id = @itemId AND c.businessId = @businessId"
                        parameters = [
                            {"name": "@itemId", "value": item_id},
                            {"name": "@businessId", "value": business_id}
                        ]
                        
                        logging.info(f"Querying for item with query: {query}")
                        logging.info(f"Parameters: {parameters}")
                        
                        items_found = list(inventory_container.query_items(
                            query=query,
                            parameters=parameters,
                            enable_cross_partition_query=False  # Using partition key
                        ))
                        
                        if not items_found:
                            # Try cross-partition query as last resort
                            logging.warning(f"Item {item_id} not found with partition key, trying cross-partition query")
                            items_found = list(inventory_container.query_items(
                                query="SELECT * FROM c WHERE c.id = @itemId",
                                parameters=[{"name": "@itemId", "value": item_id}],
                                enable_cross_partition_query=True
                            ))
                            
                            if items_found:
                                found_item = items_found[0]
                                logging.error(f"Item {item_id} exists but belongs to business {found_item.get('businessId')} not {business_id}")
                                response = func.HttpResponse(
                                    json.dumps({"error": f"Item {item_id} does not belong to your business"}),
                                    status_code=403,
                                    mimetype="application/json"
                                )
                                return add_cors_headers(response)
                        
                        if not items_found:
                            logging.error(f"Inventory item {item_id} not found for business {business_id}")
                            response = func.HttpResponse(
                                json.dumps({"error": f"Inventory item not found: {item_id}"}),
                                status_code=404,
                                mimetype="application/json"
                            )
                            return add_cors_headers(response)
                        
                        inventory_item = items_found[0]
                        logging.info(f"Found inventory item {item_id} via query")
                    
                    # Validate quantity and stock
                    requested_qty = int(quantity)
                    available_qty = inventory_item.get('quantity', 0)
                    
                    if requested_qty <= 0:
                        raise ValueError(f"Invalid quantity for {inventory_item.get('name', 'item')}")
                    
                    if requested_qty > available_qty:
                        response = func.HttpResponse(
                            json.dumps({
                                "error": f"Insufficient stock for {inventory_item.get('name', 'item')}. "
                                        f"Requested: {requested_qty}, Available: {available_qty}"
                            }),
                            status_code=400,
                            mimetype="application/json"
                        )
                        return add_cors_headers(response)
                    
                    # Check if item is active
                    if inventory_item.get('status') != 'active':
                        response = func.HttpResponse(
                            json.dumps({
                                "error": f"Item {inventory_item.get('name', 'item')} is not available for sale"
                            }),
                            status_code=400,
                            mimetype="application/json"
                        )
                        return add_cors_headers(response)
                    
                    unit_price = inventory_item.get('finalPrice', inventory_item.get('price', 0))
                    item_total = unit_price * requested_qty
                    
                    validated_item = {
                        "inventoryId": item_id,
                        "productId": inventory_item.get('productId', ''),
                        "name": inventory_item.get('name') or inventory_item.get('common_name') or inventory_item.get('productName'),
                        "productType": inventory_item.get('productType', 'unknown'),
                        "quantity": requested_qty,
                        "unitPrice": unit_price,
                        "totalPrice": round(item_total, 2),
                        "discount": inventory_item.get('discount', 0),
                        "imageUrl": inventory_item.get('images', [None])[0] if inventory_item.get('images') else None
                    }
                    
                    validated_items.append(validated_item)
                    subtotal += item_total
                    
                    logging.info(f"Validated item {item_id}: {validated_item['name']} x{requested_qty} = ${item_total}")
                    
                except Exception as inv_error:
                    logging.error(f"Error validating inventory item {item_id}: {str(inv_error)}")
                    response = func.HttpResponse(
                        json.dumps({"error": f"Invalid inventory item: {item_id} - {str(inv_error)}"}),
                        status_code=400,
                        mimetype="application/json"
                    )
                    return add_cors_headers(response)
            
            # Generate order
            order_id = str(uuid.uuid4())
            confirmation_number = generate_confirmation_number()
            current_time = datetime.utcnow().isoformat()
            pickup_available_date = (datetime.utcnow() + timedelta(hours=2)).isoformat()
            
            # Calculate totals (no tax for pickup orders in this version)
            tax = 0
            total = round(subtotal + tax, 2)
            
            new_order = {
                "id": order_id,
                "businessId": business_id,
                "customerId": customer_email,
                "customerEmail": customer_email,
                "customerName": customer_name,
                "customerPhone": customer_phone,
                "confirmationNumber": confirmation_number,
                "orderDate": current_time,
                "status": "pending",
                "fulfillmentType": "pickup",
                "items": validated_items,
                "subtotal": round(subtotal, 2),
                "tax": tax,
                "total": total,
                "notes": notes,
                "pickupDetails": {
                    "availableFrom": pickup_available_date,
                    "businessAddress": "",
                    "specialInstructions": ""
                },
                "communication": {
                    "preferredMethod": communication_preference,
                    "conversationId": None,
                    "lastContactDate": None,
                    "customerResponsive": True
                },
                "statusHistory": [
                    {
                        "status": "pending",
                        "timestamp": current_time,
                        "notes": "Order created",
                        "updatedBy": "system"
                    }
                ],
                "notifications": {
                    "customerNotified": False,
                    "businessNotified": False,
                    "smsEnabled": bool(customer_phone),
                    "emailEnabled": True,
                    "messagesEnabled": communication_preference == 'messages'
                },
                "createdAt": current_time,
                "updatedAt": current_time
            }
            
            # Create the order
            created_order = orders_container.create_item(body=new_order)
            logging.info(f"Created order {order_id} with confirmation {confirmation_number}")
            
            # Update inventory quantities (reserve stock)
            inventory_updates = []
            for item in validated_items:
                try:
                    # Re-read the inventory item to update it
                    inventory_item = inventory_container.read_item(
                        item=item['inventoryId'], 
                        partition_key=business_id
                    )
                    
                    # Reduce available quantity
                    old_quantity = inventory_item['quantity']
                    inventory_item['quantity'] -= item['quantity']
                    inventory_item['soldCount'] = inventory_item.get('soldCount', 0) + item['quantity']
                    inventory_item['updatedAt'] = current_time
                    
                    # Add to sales history
                    if 'salesHistory' not in inventory_item:
                        inventory_item['salesHistory'] = []
                    
                    inventory_item['salesHistory'].append({
                        "orderId": order_id,
                        "confirmationNumber": confirmation_number,
                        "quantitySold": item['quantity'],
                        "salePrice": item['unitPrice'],
                        "saleDate": current_time,
                        "customerEmail": customer_email
                    })
                    
                    # Update in database
                    inventory_container.replace_item(
                        item=item['inventoryId'],
                        body=inventory_item
                    )
                    
                    inventory_updates.append({
                        "inventoryId": item['inventoryId'],
                        "name": item['name'],
                        "quantityReduced": item['quantity'],
                        "oldQuantity": old_quantity,
                        "newQuantity": inventory_item['quantity']
                    })
                    
                    logging.info(f"Updated inventory {item['inventoryId']}: {old_quantity} -> {inventory_item['quantity']}")
                    
                except Exception as update_error:
                    logging.error(f"Error updating inventory {item['inventoryId']}: {str(update_error)}")
                    # Continue with other items, but log the error
            
            # Update or create customer record
            try:
                customer_id = f"{business_id}_{customer_email}".replace('@', '_').replace('.', '_')
                
                try:
                    # Try to get existing customer
                    customer_record = customers_container.read_item(
                        item=customer_id,
                        partition_key=customer_id
                    )
                    
                    # Update existing customer
                    customer_record['orderCount'] = customer_record.get('orderCount', 0) + 1
                    customer_record['totalSpent'] = customer_record.get('totalSpent', 0) + total
                    customer_record['lastOrderDate'] = current_time
                    customer_record['lastConfirmationNumber'] = confirmation_number
                    
                    if 'orders' not in customer_record:
                        customer_record['orders'] = []
                    
                    customer_record['orders'].append({
                        "orderId": order_id,
                        "date": current_time,
                        "total": total,
                        "status": "pending",
                        "confirmationNumber": confirmation_number
                    })
                    
                    if 'preferences' not in customer_record:
                        customer_record['preferences'] = {}
                    customer_record['preferences']['communicationPreference'] = communication_preference
                    customer_record['updatedAt'] = current_time
                    
                    customers_container.replace_item(item=customer_id, body=customer_record)
                    
                except:
                    # Create new customer record
                    customer_record = {
                        "id": customer_id,
                        "businessId": business_id,
                        "email": customer_email,
                        "name": customer_name,
                        "phone": customer_phone,
                        "firstPurchaseDate": current_time,
                        "orders": [{
                            "orderId": order_id,
                            "date": current_time,
                            "total": total,
                            "status": "pending",
                            "confirmationNumber": confirmation_number
                        }],
                        "totalSpent": total,
                        "orderCount": 1,
                        "lastOrderDate": current_time,
                        "lastConfirmationNumber": confirmation_number,
                        "notes": "",
                        "tags": ["new-customer"],
                        "preferences": {
                            "plantTypes": [],
                            "communicationPreference": communication_preference,
                            "newsletterSubscribed": False,
                            "marketingOptIn": True,
                            "orderReminders": True
                        },
                        "communication": {
                            "lastContactDate": None,
                            "conversationIds": [],
                            "preferredLanguage": "en",
                            "responseRate": "new",
                            "lastResponseTime": None
                        },
                        "isSubscribedToNewsletter": False,
                        "createdAt": current_time,
                        "updatedAt": current_time
                    }
                    
                    customers_container.create_item(body=customer_record)
                
                logging.info(f"Updated customer record for {customer_email}")
                
            except Exception as customer_error:
                logging.error(f"Error updating customer record: {str(customer_error)}")
            
            # Return success response
            response_data = {
                "success": True,
                "message": "Order created successfully",
                "order": {
                    "orderId": order_id,
                    "confirmationNumber": confirmation_number,
                    "businessId": business_id,
                    "customerEmail": customer_email,
                    "customerName": customer_name,
                    "status": "pending",
                    "fulfillmentType": "pickup",
                    "total": total,
                    "itemCount": len(validated_items),
                    "items": validated_items,
                    "pickupAvailableFrom": pickup_available_date,
                    "communicationPreference": communication_preference,
                    "createdAt": current_time
                },
                "inventoryUpdates": inventory_updates,
                "nextSteps": [
                    "✅ Business will receive notification of new order",
                    "🔄 Business will confirm order and prepare items", 
                    "📱 Customer will receive pickup notification via " + communication_preference,
                    "📦 Customer picks up order with confirmation number: " + confirmation_number
                ]
            }
            
            response = func.HttpResponse(
                json.dumps(response_data, default=str),
                status_code=201,
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