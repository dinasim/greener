import logging
import json
import azure.functions as func
from azure.cosmos import CosmosClient
from datetime import datetime
import os

# Same env vars / DB names as your create function
MARKETPLACE_CONNECTION_STRING = os.environ.get("COSMOSDB__MARKETPLACE_CONNECTION_STRING")
MARKETPLACE_DATABASE_NAME = os.environ.get("COSMOSDB_MARKETPLACE_DATABASE_NAME", "greener-marketplace-db")

ALLOWED_STATUSES = {"pending", "confirmed", "ready", "completed", "cancelled"}

def add_cors_headers(response: func.HttpResponse) -> func.HttpResponse:
    response.headers.update({
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Email, X-Business-ID'
    })
    return response

def get_cosmos():
    if not MARKETPLACE_CONNECTION_STRING:
        raise ValueError("COSMOSDB__MARKETPLACE_CONNECTION_STRING not configured")
    try:
        params = dict(p.split('=', 1) for p in MARKETPLACE_CONNECTION_STRING.split(';') if p)
        endpoint = params.get('AccountEndpoint')
        key = params.get('AccountKey')
    except Exception:
        raise ValueError("Invalid marketplace connection string format")
    if not endpoint or not key:
        raise ValueError("Invalid marketplace connection string: missing AccountEndpoint or AccountKey")
    client = CosmosClient(endpoint, credential=key)
    db = client.get_database_client(MARKETPLACE_DATABASE_NAME)
    return (
        db.get_container_client("orders"),
        db.get_container_client("inventory"),
    )

def find_order_by_id(orders_col, order_id: str):
    # Cross-partition query by id
    q = "SELECT * FROM c WHERE c.id = @id"
    rows = list(orders_col.query_items(
        query=q,
        parameters=[{"name": "@id", "value": order_id}],
        enable_cross_partition_query=True
    ))
    return rows[0] if rows else None

def restore_inventory_for_cancel(inventory_col, business_id: str, order):
    """
    When cancelling an order that wasn't previously cancelled, add item qty back.
    """
    now_iso = datetime.utcnow().isoformat()
    for it in order.get("items", []):
        inv_id = it.get("inventoryId")
        qty = int(it.get("quantity", 0))
        if not inv_id or qty <= 0:
            continue
        try:
            inv = inventory_col.read_item(item=inv_id, partition_key=business_id)
            inv['quantity'] = int(inv.get('quantity', 0)) + qty
            inv['updatedAt'] = now_iso
            inventory_col.replace_item(item=inv_id, body=inv)
        except Exception as ex:
            logging.error(f"Failed to restore inventory for {inv_id} (+{qty}): {ex}")

# -----------------------
# Notification side-effects (best-effort; no external deps required)
# -----------------------

def build_status_message(order, new_status: str):
    cn = order.get("confirmationNumber", "")
    total = order.get("total", 0)
    customer = order.get("customerName", "") or order.get("customerEmail", "")
    base = f"Order {cn}"
    if new_status == "confirmed":
        return f"✅ {base} has been confirmed."
    if new_status == "ready":
        return f"📦 {base} is ready for pickup."
    if new_status == "completed":
        return f"🎉 {base} has been completed. Thank you!"
    if new_status == "cancelled":
        return f"⚠️ {base} has been cancelled."
    return f"ℹ️ {base} status updated to {new_status}."

def should_send_email(order) -> bool:
    notif = order.get("notifications", {}) or {}
    return bool(notif.get("emailEnabled", True))  # you enabled email by default in create

def should_send_sms(order) -> bool:
    notif = order.get("notifications", {}) or {}
    phone = order.get("customerPhone", "")
    return bool(phone and notif.get("smsEnabled", False))

def should_send_message(order) -> bool:
    # In-app/message channel if user prefers messages or has profile
    comms = order.get("communication", {}) or {}
    has_profile = bool(order.get("hasGreenerProfile"))
    return bool(comms.get("messagesEnabled") or has_profile)

def perform_side_effects(order, new_status: str):
    """
    Best-effort, no external services: we append to order['notifications']['history']
    so the FE can reflect what was (attempted to be) sent. If you later add real
    SMTP/SMS/providers, plug them here and keep the log.
    """
    history = (order.get("notifications") or {}).get("history", [])
    msg = build_status_message(order, new_status)
    now_iso = datetime.utcnow().isoformat()

    sent = {"email": False, "sms": False, "messages": False}

    # Email (placeholder)
    if should_send_email(order):
        try:
            # TODO: Integrate your email provider here (SendGrid/ACS/etc.)
            sent["email"] = True
        except Exception as ex:
            logging.error(f"Email send failed: {ex}")

    # SMS (placeholder)
    if should_send_sms(order):
        try:
            # TODO: Integrate your SMS provider here (Twilio/ACS/etc.)
            sent["sms"] = True
        except Exception as ex:
            logging.error(f"SMS send failed: {ex}")

    # In-app/messages (placeholder)
    if should_send_message(order):
        try:
            # TODO: enqueue to a messages service / signal an event.
            # Here we just mark as sent.
            sent["messages"] = True
        except Exception as ex:
            logging.error(f"Message dispatch failed: {ex}")

    # Persist a notifications log on the order
    order.setdefault("notifications", {}).setdefault("history", []).append({
        "timestamp": now_iso,
        "status": new_status,
        "message": msg,
        "channels": [k for k, v in sent.items() if v]
    })
    order["notifications"]["lastNotifiedAt"] = now_iso
    order["notifications"]["lastNotificationType"] = new_status

    return sent, msg

# -----------------------

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Business order update function received a request.')

    # CORS preflight
    if req.method == 'OPTIONS':
        return add_cors_headers(func.HttpResponse(status_code=200))

    if req.method != 'PATCH':
        return add_cors_headers(func.HttpResponse(
            json.dumps({"error": "Method not allowed"}),
            status_code=405,
            mimetype="application/json"
        ))

    try:
        try:
            body = req.get_json()
        except ValueError:
            return add_cors_headers(func.HttpResponse(
                json.dumps({"error": "Invalid JSON body"}),
                status_code=400,
                mimetype="application/json"
            ))

        order_id = (body or {}).get("orderId")
        new_status = (body or {}).get("status")
        status_note = (body or {}).get("note")  # optional

        if not order_id or not new_status:
            return add_cors_headers(func.HttpResponse(
                json.dumps({"error": "orderId and status are required"}),
                status_code=400,
                mimetype="application/json"
            ))

        new_status = str(new_status).lower().strip()
        if new_status not in ALLOWED_STATUSES:
            return add_cors_headers(func.HttpResponse(
                json.dumps({"error": f"Invalid status '{new_status}'. Allowed: {', '.join(sorted(ALLOWED_STATUSES))}"}),
                status_code=400,
                mimetype="application/json"
            ))

        orders_col, inventory_col = get_cosmos()

        # Load order (cross-partition)
        order = find_order_by_id(orders_col, order_id)
        if not order:
            return add_cors_headers(func.HttpResponse(
                json.dumps({"error": f"Order {order_id} not found"}),
                status_code=404,
                mimetype="application/json"
            ))

        prev_status = order.get("status", "pending")
        if prev_status == new_status:
            return add_cors_headers(func.HttpResponse(
                json.dumps({"success": True, "message": "Status unchanged", "order": {
                    "id": order.get("id"),
                    "status": prev_status,
                    "updatedAt": order.get("updatedAt"),
                    "confirmationNumber": order.get("confirmationNumber"),
                } }),
                status_code=200,
                mimetype="application/json"
            ))

        now_iso = datetime.utcnow().isoformat()

        # Update order fields
        order["status"] = new_status
        order["updatedAt"] = now_iso
        order.setdefault("statusHistory", []).append({
            "status": new_status,
            "timestamp": now_iso,
            "notes": status_note or ""
        })

        business_id = order.get("businessId")

        # If cancelling (from a non-cancelled state), restore inventory
        if new_status == "cancelled" and prev_status != "cancelled" and business_id:
            try:
                restore_inventory_for_cancel(inventory_col, business_id, order)
            except Exception as ex:
                logging.error(f"Inventory restore error for order {order_id}: {ex}")

        # Side effects (notifications)
        notifications_sent, message_body = perform_side_effects(order, new_status)

        # Save order back. Partition key is businessId in your usage.
        try:
            pk = business_id if business_id else order.get("id")
            orders_col.replace_item(item=order["id"], body=order, partition_key=pk)
        except TypeError:
            # Some SDK versions don't accept partition_key on replace_item
            orders_col.replace_item(item=order["id"], body=order)
        except Exception as ex:
            logging.error(f"Cosmos replace_item failed: {ex}")
            raise

        response = {
            "success": True,
            "message": f"Order {order_id} status updated from {prev_status} to {new_status}",
            "order": {
                "id": order.get("id"),
                "businessId": business_id,
                "status": order.get("status"),
                "confirmationNumber": order.get("confirmationNumber"),
                "updatedAt": order.get("updatedAt"),
                "statusHistory": order.get("statusHistory", []),
                "total": order.get("total"),
                "customerEmail": order.get("customerEmail"),
                "customerName": order.get("customerName"),
                "notifications": order.get("notifications", {})
            },
            "notificationsSent": notifications_sent,
            "notificationPreview": message_body  # useful for debugging/FE toast
        }
        return add_cors_headers(func.HttpResponse(
            json.dumps(response, default=str),
            status_code=200,
            mimetype="application/json"
        ))

    except Exception as e:
        logging.error(f"Unexpected error updating order: {e}")
        return add_cors_headers(func.HttpResponse(
            json.dumps({"error": f"Internal server error: {e}"}), 
            status_code=500, 
            mimetype="application/json"
        ))
