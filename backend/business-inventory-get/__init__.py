# backend/business-inventory-get/__init__.py - FIXED VERSION
import logging
import json
import azure.functions as func

# Import standardized helpers
import sys
sys.path.append('..')
from http_helpers import add_cors_headers, get_user_id_from_request, create_success_response, create_error_response
from db_helpers import get_container

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Business inventory get function processed a request.')
    
    # Handle OPTIONS method for CORS preflight
    if req.method == 'OPTIONS':
        response = func.HttpResponse("", status_code=200)
        return add_cors_headers(response)
    
    try:
        # Get business ID from route params first, then fallback to headers
        business_id = req.route_params.get('businessId') or get_user_id_from_request(req)
        
        if not business_id:
            return create_error_response("Business ID is required", 400)
        
        logging.info(f"Getting inventory for business: {business_id}")
        
        # FIXED: Use standardized container access
        try:
            inventory_container = get_container("inventory")
            
            # Query inventory by businessId (partition key)
            query = "SELECT * FROM c WHERE c.businessId = @businessId ORDER BY c.addedAt DESC"
            parameters = [{"name": "@businessId", "value": business_id}]
            
            logging.info(f"Executing query for businessId: {business_id}")
            
            # Execute query - using partition key so no cross-partition needed
            items = list(inventory_container.query_items(
                query=query,
                parameters=parameters,
                enable_cross_partition_query=False  # Using partition key
            ))
            
            logging.info(f"Found {len(items)} inventory items for business {business_id}")
            
            # Format items for frontend with all required fields
            formatted_items = []
            for item in items:
                # Process images
                images = []
                if item.get('mainImage'):
                    images.append(item['mainImage'])
                if item.get('images') and isinstance(item['images'], list):
                    for img in item['images']:
                        if img and img not in images:
                            images.append(img)
                if item.get('imageUrls') and isinstance(item['imageUrls'], list):
                    for img in item['imageUrls']:
                        if img and img not in images:
                            images.append(img)
                
                formatted_item = {
                    "id": item.get("id"),
                    "businessId": item.get("businessId"),
                    "productType": item.get("productType"),
                    "name": item.get("name") or item.get("common_name") or item.get("productName"),
                    "common_name": item.get("common_name"),
                    "scientific_name": item.get("scientific_name"),
                    "productName": item.get("productName"),
                    "description": item.get("description") or item.get("notes") or "",
                    "plantInfo": item.get("plantInfo", {}),
                    "quantity": item.get("quantity", 0),
                    "originalQuantity": item.get("originalQuantity", 0),
                    "price": item.get("price", 0),
                    "finalPrice": item.get("finalPrice", item.get("price", 0)),
                    "minThreshold": item.get("minThreshold", 5),
                    "discount": item.get("discount", 0),
                    "status": item.get("status", "active"),
                    "notes": item.get("notes", ""),
                    "location": item.get("location", {}),
                    "addedAt": item.get("addedAt"),
                    "updatedAt": item.get("updatedAt"),
                    "lastUpdated": item.get("lastUpdated"),
                    "soldCount": item.get("soldCount", 0),
                    "viewCount": item.get("viewCount", 0),
                    # Image handling
                    "mainImage": images[0] if images else None,
                    "image": images[0] if images else None,
                    "images": images,
                    "imageUrls": images,
                    "hasImages": len(images) > 0,
                    # Watering schedule if it's a plant
                    "wateringSchedule": item.get("wateringSchedule", {}),
                    # Category
                    "category": item.get("category") or item.get("productType", "Plants")
                }
                formatted_items.append(formatted_item)
            
            # Return inventory data with consistent structure
            response_data = {
                "success": True,
                "businessId": business_id,
                "inventory": formatted_items,
                "totalItems": len(formatted_items),
                "activeItems": len([item for item in formatted_items if item["status"] == "active"]),
                "lowStockItems": len([item for item in formatted_items 
                                   if item["quantity"] <= item["minThreshold"] and item["status"] == "active"])
            }
            
            return create_success_response(response_data)
            
        except Exception as db_error:
            logging.error(f"Database error: {str(db_error)}")
            return create_error_response(f"Database error: {str(db_error)}", 500)
    
    except Exception as e:
        logging.error(f"Unexpected error: {str(e)}")
        return create_error_response(f"Internal server error: {str(e)}", 500)