# backend/business-customers/__init__.py
import logging
import json
import azure.functions as func
import sys

# allow imports from shared helpers folder one level up
sys.path.append('..')
from http_helpers import (
    add_cors_headers,
    get_user_id_from_request,
    create_success_response,
    create_error_response,
)
from db_helpers import get_container


def _norm_email(e):
    return (e or "").strip().lower()


def _norm_phone(p):
    p = (p or "").strip()
    return "".join(ch for ch in p if ch.isdigit() or ch == "+")


def _first(*vals, default=None):
    """Return the first non-empty / non-None value from vals."""
    for v in vals:
        if v is not None and v != "":
            return v
    return default


def _to_float(val, default=0.0):
    try:
        return float(val)
    except (TypeError, ValueError):
        return float(default)


# If you want to exclude certain order statuses from revenue tallies, list them here.
EXCLUDED_STATUSES = {"cancelled", "canceled", "void", "refunded"}


def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info("business/customers: request received")

    # CORS preflight
    if req.method == "OPTIONS":
        return add_cors_headers(func.HttpResponse("", status_code=200))

    try:
        # ---- Identify business ----
        business_id = get_user_id_from_request(req)
        if not business_id:
            business_id = (
                req.headers.get("x-business-id")
                or req.params.get("businessId")
                or None
            )
        if not business_id:
            return create_error_response("Business authentication required", 401)

        # Optional filters
        q_email = _norm_email(req.params.get("email"))
        q_phone = _norm_phone(req.params.get("phone"))

        logging.info(
            f"[business/customers] biz={business_id} email={q_email or '-'} phone={q_phone or '-'}"
        )

        # ---- Query orders for this business ----
        orders_container = get_container("orders")
        orders_query = "SELECT * FROM c WHERE c.businessId = @businessId"

        try:
            # Preferred: pin the partition (works if container PK is /businessId)
            orders = list(
                orders_container.query_items(
                    query=orders_query,
                    parameters=[{"name": "@businessId", "value": business_id}],
                    partition_key=business_id,  # << keep fast path
                    enable_cross_partition_query=False,
                )
            )
        except Exception as e:
            # Fallback: cross-partition if PK differs
            logging.warning(
                f"Partitioned query failed ({e}); retrying cross-partition."
            )
            orders = list(
                orders_container.query_items(
                    query=orders_query,
                    parameters=[{"name": "@businessId", "value": business_id}],
                    enable_cross_partition_query=True,
                )
            )

        logging.info(
            f"[business/customers] found {len(orders)} orders for biz={business_id}"
        )

        # ---- Aggregate per-customer ----
        customers_map = {}

        for order in orders:
            status = (order.get("status") or "").strip().lower()
            if status in EXCLUDED_STATUSES:
                continue  # skip non-revenue orders if configured

            customer_email = _norm_email(order.get("customerEmail"))
            if not customer_email:
                continue

            if customer_email not in customers_map:
                customers_map[customer_email] = {
                    "id": customer_email,
                    "email": customer_email,
                    "name": order.get("customerName", "Unknown Customer"),
                    "phone": order.get("customerPhone", ""),
                    "businessId": business_id,
                    "totalSpent": 0.0,
                    "orderCount": 0,
                    "orders": [],
                    "firstOrderDate": order.get("orderDate")
                    or order.get("createdAt")
                    or order.get("timestamp"),
                    "lastOrderDate": order.get("orderDate")
                    or order.get("createdAt")
                    or order.get("timestamp"),
                    "status": "active",
                    "communicationPreference": order.get(
                        "communicationPreference", "messages"
                    ),
                }

            c = customers_map[customer_email]

            # Keep latest contact info if present
            if order.get("customerName"):
                c["name"] = order.get("customerName")
            if order.get("customerPhone"):
                c["phone"] = order.get("customerPhone")

            # Amount field has changed in your app code; try new & legacy names
            amount = _first(
                order.get("total"),
                order.get("totalAmount"),
                order.get("grandTotal"),
                # compatibility: sometimes nested shapes exist
                (order.get("summary") or {}).get("total") if isinstance(order.get("summary"), dict) else None,
                (order.get("payment") or {}).get("total") if isinstance(order.get("payment"), dict) else None,
                default=0,
            )
            amount = _to_float(amount, 0.0)

            c["totalSpent"] += amount
            c["orderCount"] += 1

            # Dates (ISO-8601 strings compare lexicographically)
            od = _first(order.get("orderDate"), order.get("createdAt"), order.get("timestamp"))
            if od:
                if not c["firstOrderDate"] or od < c["firstOrderDate"]:
                    c["firstOrderDate"] = od
                if not c["lastOrderDate"] or od > c["lastOrderDate"]:
                    c["lastOrderDate"] = od

            # Per-order summary list
            c["orders"].append(
                {
                    "orderId": order.get("id") or order.get("orderId"),
                    "date": od,
                    "total": amount,
                    "status": status or "pending",
                    "itemCount": len(order.get("items", [])),
                }
            )

        customers_list = list(customers_map.values())
        customers_list.sort(key=lambda x: x["totalSpent"], reverse=True)

        # ---- Server-side filter by email/phone if provided ----
        if q_email:
            customers_list = [
                c for c in customers_list if _norm_email(c["email"]) == q_email
            ]
        if q_phone:
            def norm(p): return _norm_phone(p or "")
            customers_list = [c for c in customers_list if norm(c.get("phone")) == q_phone]

        total_customers = len(customers_list)
        total_revenue = round(sum(_to_float(c["totalSpent"]) for c in customers_list), 2)
        total_orders = sum(int(c["orderCount"] or 0) for c in customers_list)
        avg_order_value = round((total_revenue / total_orders), 2) if total_orders else 0.0

        payload = {
            "success": True,
            "businessId": business_id,
            "filters": {"email": q_email or None, "phone": q_phone or None},
            "customers": customers_list,
            "totalCustomers": total_customers,
            "totalRevenue": total_revenue,
            "averageOrderValue": avg_order_value,
            "topCustomers": customers_list[:10],
        }

        return create_success_response(payload)

    except Exception as e:
        logging.exception("Unexpected error in business/customers")
        return create_error_response(f"Internal server error: {str(e)}", 500)
