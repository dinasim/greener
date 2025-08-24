import logging
import json
import os
from datetime import datetime

import azure.functions as func
from azure.cosmos import CosmosClient, exceptions

# --- Firebase (same working pattern as your test) ---
import base64
import firebase_admin
from firebase_admin import credentials, messaging

# -------------------- ENV --------------------
# Marketplace DB (where orders & inventory live)
MARKETPLACE_CONNECTION_STRING = os.environ.get("COSMOSDB__MARKETPLACE_CONNECTION_STRING")
MARKETPLACE_DATABASE_NAME = os.environ.get("COSMOSDB_MARKETPLACE_DATABASE_NAME", "greener-marketplace-db")

# Main DB (where push tokens are stored)
COSMOS_URI = os.environ.get("COSMOS_URI") or os.environ.get("COSMOS_URL")
COSMOS_KEY = os.environ.get("COSMOS_KEY")
COSMOS_DATABASE_NAME = os.environ.get("COSMOS_DATABASE_NAME", "GreenerDB")
TOKENS_CONTAINER_NAME = os.environ.get("COSMOS_TOKENS_CONTAINER", "push_tokens")

ALLOWED_STATUSES = {"pending", "confirmed", "ready", "completed", "cancelled"}

logger = logging.getLogger(__name__)

# -------------------- CORS --------------------
def add_cors_headers(response: func.HttpResponse) -> func.HttpResponse:
    response.headers.update({
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Email, X-Business-ID'
    })
    return response

# -------------------- Cosmos (marketplace) --------------------
def get_marketplace_cosmos():
    if not MARKETPLACE_CONNECTION_STRING:
        raise ValueError("COSMOSDB__MARKETPLACE_CONNECTION_STRING not configured")
    try:
        params = dict(p.split('=', 1) for p in MARKETPLACE_CONNECTION_STRING.split(';') if p and '=' in p)
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
    q = "SELECT * FROM c WHERE c.id = @id"
    rows = list(orders_col.query_items(
        query=q,
        parameters=[{"name": "@id", "value": order_id}],
        enable_cross_partition_query=True
    ))
    return rows[0] if rows else None

def restore_inventory_for_cancel(inventory_col, business_id: str, order):
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

# -------------------- Firebase helpers --------------------
def _init_firebase():
    if firebase_admin._apps:
        return
    b64  = os.environ.get("FIREBASE_SA_JSON_B64")
    raw  = os.environ.get("FIREBASE_SA_JSON")
    path = os.environ.get("FIREBASE_SA_JSON_PATH")

    if b64:
        sa = json.loads(base64.b64decode(b64).decode("utf-8"))
        cred = credentials.Certificate(sa)
    elif raw:
        sa = json.loads(raw)
        cred = credentials.Certificate(sa)
    elif path:
        cred = credentials.Certificate(path)
    else:
        raise RuntimeError("Missing Firebase SA env (FIREBASE_SA_JSON_B64 / FIREBASE_SA_JSON / FIREBASE_SA_JSON_PATH)")
    firebase_admin.initialize_app(cred)
    logger.info("✅ Firebase initialized")

def _get_tokens_container():
    if not COSMOS_URI or not COSMOS_KEY:
        raise RuntimeError("Missing COSMOS_URI/COSMOS_URL or COSMOS_KEY env vars for tokens DB")
    client = CosmosClient(COSMOS_URI, credential=COSMOS_KEY)
    db = client.get_database_client(COSMOS_DATABASE_NAME)
    return db.get_container_client(TOKENS_CONTAINER_NAME)

def _load_tokens_for_email(tokens_container, email: str):
    """
    Token docs: { id:<email>, userId:<email>, tokens:[{token, platform, app, lastSeen}] }
    Return only non-Expo FCM tokens.
    """
    tokens = []
    if not email:
        return tokens
    try:
        item = tokens_container.read_item(item=email, partition_key=email)
        tokens = [t.get("token") for t in (item.get("tokens") or []) if t.get("token")]
    except exceptions.CosmosResourceNotFoundError:
        # Fallback query
        rows = list(tokens_container.query_items(
            query="SELECT * FROM c WHERE c.id = @e OR c.userId = @e",
            parameters=[{"name": "@e", "value": email}],
            enable_cross_partition_query=True
        ))
        if rows:
            tokens = [t.get("token") for t in (rows[0].get("tokens") or []) if t.get("token")]

    tokens = [t for t in tokens if t and not t.startswith("ExponentPushToken")]
    return tokens

def _send_multicast(tokens, title, body, data=None):
    if not tokens:
        return 0, 0, []
    msg = messaging.MulticastMessage(
        tokens=tokens,
        notification=messaging.Notification(title=title, body=body),
        data=data or {},
        android=messaging.AndroidConfig(
            priority="high",
            notification=messaging.AndroidNotification(channel_id="default"),
        ),
    )
    resp = messaging.send_each_for_multicast(msg)
    invalid = []
    for idx, r in enumerate(resp.responses):
        if not r.success:
            emsg = getattr(r.exception, "message", str(r.exception))
            logger.warning(f"[FCM] send failed token[{idx}]: {emsg}")
            if "registration-token-not-registered" in emsg or "invalid-argument" in emsg:
                invalid.append(tokens[idx])
    return resp.success_count, resp.failure_count, invalid

# -------------------- Notification content --------------------
def build_status_message(order, new_status: str):
    cn = order.get("confirmationNumber") or order.get("id") or ""
    base = f"Order {cn}"
    if new_status == "confirmed":
        return "✅ " + base + " has been confirmed."
    if new_status == "ready":
        return "📦 " + base + " is ready for pickup."
    if new_status == "completed":
        return "🎉 " + base + " has been completed. Thank you!"
    if new_status == "cancelled":
        return "⚠️ " + base + " has been cancelled."
    return f"ℹ️ {base} status updated to {new_status}."

def _send_push_for_order(order, new_status: str):
    """
    Sends FCM push to the customer (based on customerEmail -> tokens in push_tokens).
    """
    try:
        _init_firebase()
    except Exception as e:
        logger.error(f"⚠️ Firebase init failed, skipping push: {e}")
        return {"pushed": False, "reason": "firebase-init-failed"}

    try:
        tokens_c = _get_tokens_container()
    except Exception as e:
        logger.error(f"⚠️ Tokens container init failed, skipping push: {e}")
        return {"pushed": False, "reason": "tokens-db-failed"}

    customer_email = order.get("customerEmail") or order.get("email")
    if not customer_email:
        return {"pushed": False, "reason": "no-customer-email"}

    tokens = _load_tokens_for_email(tokens_c, customer_email)
    if not tokens:
        logger.info(f"No FCM tokens found for customer {customer_email}")
        return {"pushed": False, "reason": "no-tokens"}

    title = "Order update"
    body = build_status_message(order, new_status)
    data = {
        "type": "ORDER_STATUS_UPDATE",
        "orderId": order.get("id", ""),
        "status": new_status,
        "confirmationNumber": order.get("confirmationNumber", ""),
        "ts": str(datetime.utcnow().timestamp()),
        # Optional deep-link hints for your app:
        "screen": "OrderDetails",
        "params": json.dumps({"orderId": order.get("id", "")}),
    }

    ok, fail, invalid = _send_multicast(tokens, title, body, data)
    logger.info(f"[PUSH] customer={customer_email} ok={ok} fail={fail} invalid={len(invalid)}")

    return {
        "pushed": ok > 0,
        "requested": len(tokens),
        "successCount": ok,
        "failureCount": fail,
        "invalidTokens": invalid,
    }

# -------------------- Your existing best-effort channels (email/sms/in-app log) --------------------
def should_send_email(order) -> bool:
    notif = order.get("notifications", {}) or {}
    return bool(notif.get("emailEnabled", True))

def should_send_sms(order) -> bool:
    notif = order.get("notifications", {}) or {}
    phone = order.get("customerPhone", "")
    return bool(phone and notif.get("smsEnabled", False))

def should_send_message(order) -> bool:
    comms = order.get("communication", {}) or {}
    has_profile = bool(order.get("hasGreenerProfile"))
    return bool(comms.get("messagesEnabled") or has_profile)

def perform_side_effects(order, new_status: str):
    """
    Still logs email/sms/messages history.
    Additionally sends **real FCM push** via _send_push_for_order.
    """
    history = (order.get("notifications") or {}).get("history", [])
    msg = build_status_message(order, new_status)
    now_iso = datetime.utcnow().isoformat()

    sent = {"email": False, "sms": False, "messages": False, "push": False}

    # Email (placeholder)
    if should_send_email(order):
        try:
            # Hook up SendGrid/ACS here if needed.
            sent["email"] = True
        except Exception as ex:
            logging.error(f"Email send failed: {ex}")

    # SMS (placeholder)
    if should_send_sms(order):
        try:
            # Hook up Twilio/ACS here if needed.
            sent["sms"] = True
        except Exception as ex:
            logging.error(f"SMS send failed: {ex}")

    # In-app/messages (placeholder)
    if should_send_message(order):
        try:
            sent["messages"] = True
        except Exception as ex:
            logging.error(f"Message dispatch failed: {ex}")

    # NEW: FCM push (real)
    push_result = _send_push_for_order(order, new_status)
    sent["push"] = bool(push_result.get("pushed"))

    order.setdefault("notifications", {}).setdefault("history", []).append({
        "timestamp": now_iso,
        "status": new_status,
        "message": msg,
        "channels": [k for k, v in sent.items() if v],
        "pushMeta": push_result,  # keep for debugging
    })
    order["notifications"]["lastNotifiedAt"] = now_iso
    order["notifications"]["lastNotificationType"] = new_status

    return sent, msg

# -------------------- Main HTTP trigger --------------------
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

        orders_col, inventory_col = get_marketplace_cosmos()

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

        # Inventory restore on cancel
        if new_status == "cancelled" and prev_status != "cancelled" and business_id:
            try:
                restore_inventory_for_cancel(inventory_col, business_id, order)
            except Exception as ex:
                logging.error(f"Inventory restore error for order {order_id}: {ex}")

        # Side effects (now includes real push)
        notifications_sent, message_body = perform_side_effects(order, new_status)

        # Save order back
        try:
            pk = business_id if business_id else order.get("id")
            orders_col.replace_item(item=order["id"], body=order, partition_key=pk)
        except TypeError:
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
            "notificationPreview": message_body
        }
        return add_cors_headers(func.HttpResponse(
            json.dumps(response, default=str),
            status_code=200,
            mimetype="application/json"
        ))

    except Exception as e:
        logging.error(f"Unexpected error updating order: {e}", exc_info=True)
        return add_cors_headers(func.HttpResponse(
            json.dumps({"error": f"Internal server error: {e}"}),
            status_code=500,
            mimetype="application/json"
        ))
