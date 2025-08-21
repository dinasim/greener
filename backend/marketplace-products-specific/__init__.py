# marketplace-products-specific/__init__.py
import logging
import azure.functions as func
from db_helpers import get_container
from http_helpers import handle_options_request, create_error_response, create_success_response, extract_user_id

ID_FIELDS = ["id", "_id", "plantId", "productId", "docId"]

def _build_multi_id_query():
    # WHERE (c.id = @id OR c._id = @id OR c.plantId = @id ...)
    or_parts = " OR ".join([f"c.{f} = @id" for f in ID_FIELDS])
    # ignore soft-deleted
    return f"SELECT * FROM c WHERE ({or_parts}) AND (NOT IS_DEFINED(c.status) OR c.status != 'deleted')"

def _normalize_id(doc):
    # ensure 'id' exists for clients
    for f in ID_FIELDS:
        if f in doc and doc[f]:
            doc["id"] = str(doc[f])
            break
    return doc

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info("GET /marketplace/products/specific/{id}")

    if req.method == "OPTIONS":
        return handle_options_request()

    try:
        plant_id = req.route_params.get("id")
        if not plant_id:
            return create_error_response("Plant ID is required", 400)

        user_id = extract_user_id(req)

        container = get_container("marketplace-plants")

        # 1) try multi-field match
        query = _build_multi_id_query()
        params = [{"name": "@id", "value": plant_id}]
        items = list(container.query_items(query=query, parameters=params, enable_cross_partition_query=True))
        logging.info(f"Query matched {len(items)} item(s) for id={plant_id}")

        if not items:
            # 2) sometimes ids are stored as strings with braces/uppercase—try normalized string
            plant_id_str = str(plant_id)
            params = [{"name": "@id", "value": plant_id_str}]
            items = list(container.query_items(query=query, parameters=params, enable_cross_partition_query=True))
            logging.info(f"Second pass matched {len(items)} item(s)")

        if not items:
            return create_error_response("Product not found", 404)

        plant = _normalize_id(items[0])

        # Optional: wishlist flag (best-effort)
        try:
            if user_id:
                wl = get_container("marketplace-wishlists")
                wq = "SELECT VALUE COUNT(1) FROM c WHERE c.userId = @u AND c.plantId = @p"
                wparams = [{"name": "@u", "value": user_id}, {"name": "@p", "value": plant["id"]}]
                wished = list(wl.query_items(query=wq, parameters=wparams, enable_cross_partition_query=True))[0] > 0
                plant["isWished"] = wished
            else:
                plant["isWished"] = False
        except Exception as e:
            logging.warning(f"Wishlist check failed: {e}")
            plant["isWished"] = False

        return create_success_response(plant)

    except Exception as e:
        logging.error(f"Error retrieving specific product: {e}")
        return create_error_response("Internal server error", 500)
