import logging
import json
import azure.functions as func
from db_helpers import get_container
from http_helpers import add_cors_headers, handle_options_request, create_error_response, create_success_response, extract_user_id
from datetime import datetime

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('HTTP trigger: update product price')

    if req.method == 'OPTIONS':
        return handle_options_request()

    try:
        product_id = req.route_params.get('id')
        if not product_id:
            return create_error_response("Product ID is required", 400)

        # who is asking?
        user_id = extract_user_id(req)
        if not user_id:
            return create_error_response("User ID is required", 400)

        try:
            body = req.get_json()
        except ValueError:
            body = {}

        price = body.get('price', None)
        try:
            price = float(price)
            if price < 0:
                raise ValueError()
        except Exception:
            return create_error_response("Price must be a non-negative number", 400)

        container = get_container("marketplace_plants")

        # fetch the product
        query = "SELECT * FROM c WHERE c.id = @id"
        products = list(container.query_items(
            query=query,
            parameters=[{"name":"@id","value":product_id}],
            enable_cross_partition_query=True
        ))
        if not products:
            return create_error_response("Product not found", 404)

        product = products[0]

        # ownership check
        seller_id = product.get('sellerId')
        if not seller_id or seller_id != user_id:
            return create_error_response("You don't have permission to update this product", 403)

        # update price
        product['price'] = price
        product['updatedAt'] = datetime.utcnow().isoformat()

        # IMPORTANT: pass partition_key if your PK != "/id"
        try:
            container.replace_item(item=product_id, body=product)
        except Exception:
            # fallback w/ explicit PK in case your container uses /sellerId
            container.replace_item(item=product_id, body=product, partition_key=seller_id)

        return create_success_response({
            "success": True,
            "message": "Price updated",
            "price": price
        })
    except Exception as e:
        logging.exception("update price failed")
        return create_error_response(str(e), 500)
