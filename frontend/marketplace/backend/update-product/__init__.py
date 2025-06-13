import logging
import json
import azure.functions as func
from db_helpers import get_container
from http_helpers import (
    add_cors_headers,
    handle_options_request,
    create_error_response,
    create_success_response,
    extract_user_id,
)
from datetime import datetime

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('PATCH /marketplace/products/{id} triggered')

    if req.method == 'OPTIONS':
        return handle_options_request()

    try:
        product_id = req.route_params.get('id')
        if not product_id:
            return create_error_response("Product ID is required", 400)

        user_id = extract_user_id(req)
        if not user_id:
            return create_error_response("User ID is required", 400)

        try:
            update_data = req.get_json()
        except ValueError:
            return create_error_response("Invalid JSON body", 400)

        if not update_data:
            return create_error_response("Update data is required", 400)

        container = get_container("marketplace-plants")

        # Fetch product by id and partition key
        query = "SELECT * FROM c WHERE c.id = @id"
        parameters = [{"name": "@id", "value": product_id}]

        products = list(container.query_items(
            query=query,
            parameters=parameters,
            enable_cross_partition_query=True
        ))

        if not products:
            return create_error_response("Product not found", 404)

        product = products[0]

        # Check ownership
        if product.get("sellerId") != user_id:
            return create_error_response("You don't have permission to update this product", 403)

        # Apply updates (skip protected fields)
        protected_fields = ['id', 'sellerId', 'addedAt', 'stats']
        for key, value in update_data.items():
            if key not in protected_fields:
                product[key] = value

        product['updatedAt'] = datetime.utcnow().isoformat()

        # Cosmos DB requires partition key in replace_item
        container.replace_item(item=product['id'], body=product, partition_key=product['category'])


        return create_success_response({
            "success": True,
            "message": "Product successfully updated",
            "product": product
        })

    except Exception as e:
        logging.error(f"[Update Error] {str(e)}")
        return create_error_response("Internal server error", 500)
