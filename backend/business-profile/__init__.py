# backend/business-profile/__init__.py - FIXED for proper business data handling
import logging
import json
import azure.functions as func
from azure.cosmos import CosmosClient, exceptions
import os
from datetime import datetime

def add_cors_headers(response):
    """Add CORS headers to response"""
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS, PUT, PATCH, DELETE'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type,Authorization,X-User-Email,X-Business-ID'
    return response

def create_success_response(data, status_code=200):
    """Create a successful response"""
    response = func.HttpResponse(
        body=json.dumps(data),
        status_code=status_code,
        mimetype="application/json"
    )
    return add_cors_headers(response)

def create_error_response(message, status_code=400):
    """Create an error response"""
    response = func.HttpResponse(
        body=json.dumps({"error": message, "success": False}),
        status_code=status_code,
        mimetype="application/json"
    )
    return add_cors_headers(response)

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Business profile function processed a request.')
    
    # Handle OPTIONS method for CORS preflight
    if req.method == 'OPTIONS':
        return add_cors_headers(func.HttpResponse("", status_code=200))
    
    try:
        # Get business ID from headers
        business_id = req.headers.get('X-User-Email') or req.headers.get('X-Business-ID')
        
        if not business_id:
            return create_error_response("Business ID is required in X-User-Email or X-Business-ID header", 400)
        
        logging.info(f"Processing business profile request for: {business_id}")
        
        # Database connection using marketplace database
        connection_string = os.environ.get("COSMOSDB__MARKETPLACE_CONNECTION_STRING")
        database_name = os.environ.get("COSMOSDB_MARKETPLACE_DATABASE_NAME", "GreenerMarketplace")
        
        if not connection_string:
            logging.error("Missing COSMOSDB__MARKETPLACE_CONNECTION_STRING environment variable")
            return create_error_response("Database connection not configured", 500)
        
        # Parse connection string and create client
        try:
            params = dict(param.split('=', 1) for param in connection_string.split(';') if '=' in param)
            account_endpoint = params.get('AccountEndpoint')
            account_key = params.get('AccountKey')
            
            if not account_endpoint or not account_key:
                raise ValueError("Invalid connection string format")
            
            # Create client and get containers
            client = CosmosClient(account_endpoint, credential=account_key)
            database = client.get_database_client(database_name)
            
            # Ensure business_users container exists
            try:
                business_container = database.get_container_client('business_users')
                business_container.read()
                logging.info("Successfully connected to business_users container")
            except exceptions.CosmosResourceNotFoundError:
                logging.info("Creating business_users container")
                from azure.cosmos import PartitionKey
                business_container = database.create_container(
                    id='business_users',
                    partition_key=PartitionKey(path='/id'),
                    offer_throughput=400
                )
                logging.info("business_users container created successfully")
            
        except Exception as db_error:
            logging.error(f"Database connection failed: {str(db_error)}")
            return create_error_response(f"Database connection failed: {str(db_error)}", 500)
        
        # Handle different HTTP methods
        if req.method == 'POST':
            # Create business profile
            try:
                req_body = req.get_json()
                if not req_body:
                    return create_error_response("Request body is required", 400)
                
                logging.info(f"🏢 Creating business profile with data: {req_body}")
                
                # FIXED: Extract all business fields from signup data
                business_name = req_body.get('businessName', '').strip()
                description = req_body.get('description', '').strip()
                
                # FIXED: Handle address/location properly
                address_data = req_body.get('address', {})
                location_data = req_body.get('location', {})
                
                # Create comprehensive address object
                if isinstance(address_data, dict) and address_data:
                    address = address_data
                elif isinstance(location_data, dict) and location_data:
                    # Convert location to address format
                    address = {
                        "street": location_data.get('street', ''),
                        "city": location_data.get('city', ''),
                        "postalCode": location_data.get('postalCode', ''),
                        "country": location_data.get('country', 'Israel'),
                        "latitude": location_data.get('latitude'),
                        "longitude": location_data.get('longitude'),
                        "formattedAddress": location_data.get('formattedAddress', '')
                    }
                else:
                    address = {}
                
                # FIXED: Validate required fields properly
                if not business_name:
                    return create_error_response("Business name is required", 400)
                if not description:
                    return create_error_response("Business description is required", 400)
                
                # FIXED: Prepare comprehensive business profile document
                business_profile = {
                    "id": business_id,
                    "email": business_id,
                    "name": req_body.get('name', business_name),  # Contact person name
                    "businessName": business_name,
                    "businessType": req_body.get('businessType', 'Plant Store'),
                    "description": description,
                    "contactPhone": req_body.get('contactPhone') or req_body.get('phone', ''),
                    "phone": req_body.get('phone') or req_body.get('contactPhone', ''),
                    "contactEmail": business_id,
                    "address": address,
                    "location": location_data if location_data else address,
                    "logo": req_body.get('logo', ''),
                    "website": req_body.get('website', ''),
                    "category": req_body.get('category', req_body.get('businessType', 'Plant Store')),
                    
                    # FIXED: Business hours from signup data or defaults
                    "businessHours": req_body.get('businessHours', []),
                    "openingHours": req_body.get('openingHours', {
                        "monday": "9:00-18:00",
                        "tuesday": "9:00-18:00", 
                        "wednesday": "9:00-18:00",
                        "thursday": "9:00-18:00",
                        "friday": "9:00-18:00",
                        "saturday": "10:00-16:00",
                        "sunday": "Closed"
                    }),
                    
                    # FIXED: Social media and settings
                    "socialMedia": req_body.get('socialMedia', {}),
                    "settings": req_body.get('settings', {
                        "notifications": True,
                        "messages": True,
                        "lowStockThreshold": 5,
                    }),
                    
                    # FIXED: Payment and verification
                    "paymentMethods": req_body.get('paymentMethods', ['cash', 'pickup']),
                    "verificationStatus": req_body.get('verificationStatus', 'pending'),
                    
                    # FIXED: Stats and ratings
                    "stats": req_body.get('stats', {
                        "productsCount": 0,
                        "salesCount": 0,
                        "rating": 0,
                        "reviewCount": 0
                    }),
                    "rating": req_body.get('rating', 0.0),
                    "reviewCount": req_body.get('reviewCount', 0),
                    
                    # Status and metadata
                    "status": req_body.get('status', 'active'),
                    "type": "business",
                    "businessId": business_id,
                    "isVerified": req_body.get('isVerified', False),
                    "verified": req_body.get('verified', False),
                    
                    # FIXED: Notification tokens
                    "fcmToken": req_body.get('fcmToken'),
                    "webPushSubscription": req_body.get('webPushSubscription'),
                    "expoPushToken": req_body.get('expoPushToken'),
                    "platform": req_body.get('platform', 'web'),
                    "notificationSettings": req_body.get('notificationSettings', {
                        "enabled": True,
                        "wateringReminders": True,
                        "lowStockAlerts": True,
                        "orderNotifications": True,
                        "platform": req_body.get('platform', 'web')
                    }),
                    
                    # Timestamps
                    "registrationDate": req_body.get('registrationDate', datetime.now().isoformat()),
                    "createdAt": datetime.now().isoformat(),
                    "updatedAt": datetime.now().isoformat(),
                    "lastUpdated": datetime.now().isoformat()
                }
                
                # Save to database
                result = business_container.create_item(business_profile)
                logging.info(f"✅ Created business profile: {business_id}")
                
                return create_success_response({
                    "message": "Business profile created successfully",
                    "businessId": business_id,
                    "business": result,
                    "profile": result,  # For backward compatibility
                    "success": True
                }, 201)
                
            except exceptions.CosmosResourceExistsError:
                # Check if this is actually a duplicate or a race condition
                logging.warning(f"CosmosResourceExistsError for business {business_id} - checking if profile actually exists")
                
                try:
                    # Try to read the existing profile
                    existing_profile = business_container.read_item(item=business_id, partition_key=business_id)
                    logging.info(f"Business profile actually exists: {business_id}")
                    
                    # Return the existing profile instead of an error
                    return create_success_response({
                        "message": "Business profile already exists - returning existing profile",
                        "businessId": business_id,
                        "business": existing_profile,
                        "profile": existing_profile,
                        "success": True,
                        "existed": True
                    }, 200)  # Return 200 instead of 409 for signup flow
                    
                except exceptions.CosmosResourceNotFoundError:
                    # Profile doesn't actually exist, retry creation
                    logging.warning(f"Race condition detected - profile doesn't exist, retrying creation for {business_id}")
                    try:
                        result = business_container.create_item(business_profile)
                        logging.info(f"✅ Created business profile on retry: {business_id}")
                        
                        return create_success_response({
                            "message": "Business profile created successfully",
                            "businessId": business_id,
                            "business": result,
                            "profile": result,
                            "success": True
                        }, 201)
                    except Exception as retry_error:
                        logging.error(f"Failed to create business profile on retry: {str(retry_error)}")
                        return create_error_response(f"Failed to create business profile: {str(retry_error)}", 500)
                
                except Exception as check_error:
                    logging.error(f"Error checking existing profile: {str(check_error)}")
                    return create_error_response(f"Error checking existing profile: {str(check_error)}", 500)
            except Exception as e:
                logging.error(f"Error creating business profile: {str(e)}")
                return create_error_response(f"Failed to create business profile: {str(e)}", 500)
        
        elif req.method == 'GET':
            # Get business profile
            try:
                business_profile = business_container.read_item(item=business_id, partition_key=business_id)
                logging.info(f"Retrieved business profile for {business_id}")
                
                return create_success_response({
                    "business": business_profile,
                    "profile": business_profile,  # For backward compatibility
                    "success": True
                })
                
            except exceptions.CosmosResourceNotFoundError:
                return create_error_response("Business profile not found", 404)
            except Exception as e:
                logging.error(f"Error retrieving business profile: {str(e)}")
                return create_error_response(f"Failed to retrieve business profile: {str(e)}", 500)
        
        elif req.method == 'PUT' or req.method == 'PATCH':
            # Update business profile
            try:
                req_body = req.get_json()
                if not req_body:
                    return create_error_response("Request body is required", 400)
                
                # Get existing profile
                existing_profile = business_container.read_item(item=business_id, partition_key=business_id)
                
                # FIXED: Update fields (only update fields that are provided)
                updatable_fields = [
                    'businessName', 'description', 'address', 'location', 'phone', 'contactPhone', 
                    'website', 'category', 'businessType', 'logo', 'openingHours', 'businessHours',
                    'socialMedia', 'settings', 'paymentMethods', 'fcmToken', 'webPushSubscription',
                    'expoPushToken', 'notificationSettings'
                ]
                
                for field in updatable_fields:
                    if field in req_body:
                        existing_profile[field] = req_body[field]
                        logging.info(f"Updated field {field} for business {business_id}")
                
                existing_profile['updatedAt'] = datetime.now().isoformat()
                existing_profile['lastUpdated'] = datetime.now().isoformat()
                
                # Save updated profile
                result = business_container.replace_item(item=business_id, body=existing_profile)
                logging.info(f"✅ Updated business profile: {business_id}")
                
                return create_success_response({
                    "message": "Business profile updated successfully",
                    "business": result,
                    "profile": result,  # For backward compatibility
                    "success": True
                })
                
            except exceptions.CosmosResourceNotFoundError:
                return create_error_response("Business profile not found", 404)
            except Exception as e:
                logging.error(f"Error updating business profile: {str(e)}")
                return create_error_response(f"Failed to update business profile: {str(e)}", 500)
        
        elif req.method == 'DELETE':
            # Delete business profile (soft delete by updating status)
            try:
                existing_profile = business_container.read_item(item=business_id, partition_key=business_id)
                existing_profile['status'] = 'deleted'
                existing_profile['deletedAt'] = datetime.now().isoformat()
                
                result = business_container.replace_item(item=business_id, body=existing_profile)
                logging.info(f"Deleted business profile: {business_id}")
                
                return create_success_response({
                    "message": "Business profile deleted successfully",
                    "success": True
                })
                
            except exceptions.CosmosResourceNotFoundError:
                return create_error_response("Business profile not found", 404)
            except Exception as e:
                logging.error(f"Error deleting business profile: {str(e)}")
                return create_error_response(f"Failed to delete business profile: {str(e)}", 500)
        
        else:
            return create_error_response("Method not allowed", 405)
    
    except Exception as e:
        logging.error(f"Unexpected error: {str(e)}")
        return create_error_response(f"Internal server error: {str(e)}", 500)