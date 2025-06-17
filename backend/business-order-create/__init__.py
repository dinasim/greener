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
MARKETPLACE_DATABASE_NAME = os.environ.get("COSMOSDB_MARKETPLACE_DATABASE_NAME", "greener-marketplace-db")

def add_cors_headers(response: func.HttpResponse) -> func.HttpResponse:
    """Add CORS headers to response"""
    response.headers.update({
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Email, X-Business-ID'
    })
    return response

def generate_confirmation_number() -> str:
    """Generate unique confirmation number for pickup orders"""
    timestamp = datetime.now().strftime("%m%d")
    random_part = ''.join(random.choices(string.ascii_uppercase + string.digits, k=4))
    return f"GRN{timestamp}{random_part}"

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Business order create function processed a request.')
    
    # Handle CORS preflight
    if req.method == 'OPTIONS':
        return add_cors_headers(func.HttpResponse(status_code=200))

    try:
        # Parse and validate JSON body
        try:
            request_body = req.get_json()
        except ValueError:
            return add_cors_headers(func.HttpResponse(
                json.dumps({"error": "Invalid JSON body"}),
                status_code=400,
                mimetype="application/json"
            ))

        if not request_body:
            return add_cors_headers(func.HttpResponse(
                json.dumps({"error": "Request body is required"}),
                status_code=400,
                mimetype="application/json"
            ))

        required_fields = ['businessId', 'customerEmail', 'customerName', 'items']
        missing = [f for f in required_fields if f not in request_body]
        if missing:
            return add_cors_headers(func.HttpResponse(
                json.dumps({"error": f"Missing required fields: {', '.join(missing)}"}),
                status_code=400,
                mimetype="application/json"
            ))

        business_id = request_body['businessId']
        customer_email = request_body['customerEmail']
        customer_name = request_body['customerName']
        items = request_body['items']
        customer_phone = request_body.get('customerPhone', '')
        notes = request_body.get('notes', '')
        communication_pref = request_body.get('communicationPreference', 'messages')
        
        # NEW: Handle customer profile ID for chat integration
        customer_profile_id = request_body.get('customerProfileId')
        has_greener_profile = request_body.get('hasGreenerProfile', False)

        if not items:
            return add_cors_headers(func.HttpResponse(
                json.dumps({"error": "Order must contain at least one item"}),
                status_code=400,
                mimetype="application/json"
            ))

        logging.info(f"Creating order for business {business_id}, customer {customer_email}")

        # Connect to Cosmos DB
        params = dict(p.split('=', 1) for p in MARKETPLACE_CONNECTION_STRING.split(';'))
        endpoint = params.get('AccountEndpoint')
        key = params.get('AccountKey')
        if not endpoint or not key:
            raise ValueError("Invalid marketplace connection string")

        client = CosmosClient(endpoint, credential=key)
        db = client.get_database_client(MARKETPLACE_DATABASE_NAME)
        orders_col = db.get_container_client("orders")
        inventory_col = db.get_container_client("inventory")
        customers_col = db.get_container_client("business_customers")

        # Validate items & compute subtotal
        validated_items = []
        subtotal = 0.0

        for it in items:
            item_id = it.get('id') or it.get('inventoryId')
            qty = it.get('quantity')
            if not item_id or qty is None:
                return add_cors_headers(func.HttpResponse(
                    json.dumps({"error": "Each item must have id and quantity"}),
                    status_code=400,
                    mimetype="application/json"
                ))

            # Lookup inventory item
            try:
                inv = inventory_col.read_item(item=item_id, partition_key=business_id)
            except:
                q = "SELECT * FROM c WHERE c.id=@id AND c.businessId=@b"
                results = list(inventory_col.query_items(
                    query=q,
                    parameters=[
                        {"name":"@id","value":item_id},
                        {"name":"@b","value":business_id}
                    ],
                    enable_cross_partition_query=False
                ))
                if not results:
                    return add_cors_headers(func.HttpResponse(
                        json.dumps({"error": f"Item {item_id} not found"}),
                        status_code=404,
                        mimetype="application/json"
                    ))
                inv = results[0]

            requested = int(qty)
            available = inv.get('quantity', 0)
            if requested <= 0 or requested > available:
                return add_cors_headers(func.HttpResponse(
                    json.dumps({
                        "error": f"Insufficient stock for {inv.get('name','item')}: requested {requested}, available {available}"
                    }),
                    status_code=400,
                    mimetype="application/json"
                ))
            if inv.get('status') != 'active':
                return add_cors_headers(func.HttpResponse(
                    json.dumps({"error": f"Item {inv.get('name','item')} is not available"}),
                    status_code=400,
                    mimetype="application/json"
                ))

            unit_price = inv.get('finalPrice', inv.get('price', 0))
            total_price = round(unit_price * requested, 2)
            validated_items.append({
                "inventoryId": item_id,
                "name": inv.get('name') or inv.get('common_name'),
                "quantity": requested,
                "unitPrice": unit_price,
                "totalPrice": total_price,
                "imageUrl": inv.get('mainImage') or (inv.get('images') or [None])[0]
            })
            subtotal += total_price

        # Build order
        order_id = str(uuid.uuid4())
        confirmation = generate_confirmation_number()
        now_iso = datetime.utcnow().isoformat()
        pickup_from = (datetime.utcnow() + timedelta(hours=2)).isoformat()
        tax = 0.0
        total = round(subtotal + tax, 2)

        new_order = {
            "id": order_id,
            "businessId": business_id,
            "customerEmail": customer_email,
            "customerName": customer_name,
            "customerPhone": customer_phone,
            # NEW: Add customer profile integration for chat
            "customerProfileId": customer_profile_id,
            "hasGreenerProfile": has_greener_profile,
            "confirmationNumber": confirmation,
            "orderDate": now_iso,
            "status": "pending",
            "fulfillmentType": "pickup",
            "items": validated_items,
            "subtotal": round(subtotal, 2),
            "tax": tax,
            "total": total,
            "notes": notes,
            "pickupDetails": {"availableFrom": pickup_from},
            "communication": {
                "preferredMethod": communication_pref,
                "customerResponsive": True,
                # NEW: Enhanced chat capability flags
                "chatEnabled": has_greener_profile,
                "profileLinked": bool(customer_profile_id)
            },
            "statusHistory": [{"status":"pending","timestamp":now_iso,"notes":"Order created"}],
            "notifications": {
                "smsEnabled": bool(customer_phone),
                "emailEnabled": True,
                "messagesEnabled": communication_pref == 'messages' or has_greener_profile
            },
            "createdAt": now_iso,
            "updatedAt": now_iso
        }

        created = orders_col.create_item(body=new_order)
        logging.info(f"Created order {order_id}")

        # Update inventory
        inventory_updates = []
        for vi in validated_items:
            try:
                inv = inventory_col.read_item(item=vi['inventoryId'], partition_key=business_id)
                old_qty = inv['quantity']
                inv['quantity'] -= vi['quantity']
                inv['soldCount'] = inv.get('soldCount', 0) + vi['quantity']
                inv.setdefault('salesHistory', []).append({
                    "orderId": order_id,
                    "quantitySold": vi['quantity'],
                    "saleDate": now_iso
                })
                inv['updatedAt'] = now_iso
                inventory_col.replace_item(item=vi['inventoryId'], body=inv)

                inventory_updates.append({
                    "inventoryId": vi['inventoryId'],
                    "oldQuantity": old_qty,
                    "newQuantity": inv['quantity']
                })
            except Exception as ex:
                logging.error(f"Error updating inventory {vi['inventoryId']}: {ex}")

        # Create or update customer record
        try:
            cust_id = f"{business_id}_{customer_email}".replace('@','_').replace('.','_')
            try:
                cust = customers_col.read_item(item=cust_id, partition_key=cust_id)
                cust['orderCount'] = cust.get('orderCount',0) + 1
                cust['totalSpent'] = cust.get('totalSpent',0) + total
                cust['lastOrderDate'] = now_iso
                cust.setdefault('orders',[]).append({
                    "orderId": order_id,
                    "date": now_iso,
                    "total": total
                })
                cust['updatedAt'] = now_iso
                customers_col.replace_item(item=cust_id, body=cust)
            except:
                new_cust = {
                    "id": cust_id,
                    "businessId": business_id,
                    "email": customer_email,
                    "name": customer_name,
                    "phone": customer_phone,
                    "orders": [{"orderId": order_id,"date": now_iso,"total": total}],
                    "totalSpent": total,
                    "orderCount": 1,
                    "createdAt": now_iso,
                    "updatedAt": now_iso
                }
                customers_col.create_item(body=new_cust)
            logging.info(f"Customer record updated for {customer_email}")
        except Exception as cust_ex:
            logging.error(f"Error updating customer record: {cust_ex}")

        # Return success
        response_body = {
            "success": True,
            "message": "Order created successfully",
            "order": {
                "orderId": order_id,
                "confirmationNumber": confirmation,
                "total": total,
                "itemCount": len(validated_items),
                "pickupAvailableFrom": pickup_from,
                "createdAt": now_iso
            },
            "inventoryUpdates": inventory_updates
        }
        return add_cors_headers(func.HttpResponse(
            json.dumps(response_body, default=str),
            status_code=201,
            mimetype="application/json"
        ))

    except Exception as e:
        logging.error(f"Unexpected error: {e}")
        return add_cors_headers(func.HttpResponse(
            json.dumps({"error": f"Internal server error: {e}"}),
            status_code=500,
            mimetype="application/json"
        ))
