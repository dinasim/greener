import logging
import json
import traceback
import sys
import os
import azure.functions as func
import bcrypt

# FIXED: Simple import of db_helpers module
import db_helpers

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Business login function starting')
    try:
        logging.info('About to handle CORS')
        # CORS headers
        cors_headers = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        }
        logging.info('About to check request method')
        if req.method == 'OPTIONS':
            logging.info('Handling OPTIONS request (CORS preflight)')
            return func.HttpResponse("", status_code=200, headers=cors_headers)
        logging.info('About to parse request body')
        try:
            body = req.get_json()
        except Exception as e:
            logging.error(f"Failed to parse JSON body: {str(e)}")
            return func.HttpResponse(
                json.dumps({"error": "Invalid request body", "success": False}),
                status_code=400,
                mimetype="application/json",
                headers=cors_headers
            )
        email = (body.get('email') or '').strip().lower()
        password = body.get('password')
        if not email or not password:
            logging.warning('Missing email or password in login request')
            return func.HttpResponse(
                json.dumps({"error": "Email and password are required", "success": False}),
                status_code=400,
                mimetype="application/json",
                headers=cors_headers
            )
        
        # FIXED: Always test database connections first to validate configuration
        try:
            db_status = db_helpers.test_database_connections()
            if not db_status["marketplace_db"]["connected"]:
                error_msg = db_status["marketplace_db"]["error"] or "Unknown database connection error"
                logging.error(f"Database connection test failed: {error_msg}")
                return func.HttpResponse(
                    json.dumps({
                        "error": f"Database configuration error: {error_msg}", 
                        "success": False
                    }),
                    status_code=500,
                    mimetype="application/json",
                    headers=cors_headers
                )
            logging.info("Database connections verified successfully")
        except Exception as db_test_error:
            error_details = traceback.format_exc()
            logging.error(f"Database connection test failed: {str(db_test_error)}\n{error_details}")
            return func.HttpResponse(
                json.dumps({
                    "error": f"Database connection test failed: {str(db_test_error)}", 
                    "success": False
                }),
                status_code=500,
                mimetype="application/json",
                headers=cors_headers
            )
        
        # Get business_users container using the db_helpers
        try:
            container = db_helpers.get_container('business_users')
            logging.info("Successfully connected to business_users container")
            
            # Debug: Log detailed information about the database and container
            try:
                container_info = db_helpers.get_container_info('business_users')
                logging.info(f"🔍 Looking for data in:")
                logging.info(f"  Database: {container_info['database_type']} database")
                logging.info(f"  Container: {container_info['actual_name']}")
                logging.info(f"  Partition Key: {container_info['partition_key']}")
            except Exception as debug_error:
                logging.error(f"Debug info failed: {debug_error}")
                
        except Exception as container_error:
            error_details = traceback.format_exc()
            logging.error(f"Failed to get business_users container: {str(container_error)}\n{error_details}")
            return func.HttpResponse(
                json.dumps({
                    "error": f"Database error: {str(container_error)}", 
                    "success": False
                }),
                status_code=500,
                mimetype="application/json",
                headers=cors_headers
            )
        
        # Find business by email
        try:
            query = "SELECT * FROM c WHERE LOWER(c.email) = @email"
            parameters = [{"name": "@email", "value": email}]
            logging.info(f"Executing query: {query} with email: {email}")
            items = list(container.query_items(
                query=query,
                parameters=parameters,
                enable_cross_partition_query=True
            ))
            logging.info(f"Query executed, found {len(items)} items")
        except Exception as query_error:
            error_details = traceback.format_exc()
            logging.error(f"Database query failed: {str(query_error)}\n{error_details}")
            return func.HttpResponse(
                json.dumps({"error": "Database error. Please try again later.", "success": False}),
                status_code=500,
                mimetype="application/json",
                headers=cors_headers
            )
        
        if not items:
            logging.warning(f"No business found for email: {email}")
            return func.HttpResponse(
                json.dumps({"error": "Invalid business credentials", "success": False}),
                status_code=401,
                mimetype="application/json",
                headers=cors_headers
            )
        
        business = items[0]
        logging.info(f"Business found: {business.get('businessName', 'Unknown')}")
        
        # Validate password
        try:
            password_hash = business.get('passwordHash')
            if not password_hash:
                logging.error("No password hash found for business")
                return func.HttpResponse(
                    json.dumps({"error": "Invalid business credentials", "success": False}),
                    status_code=401,
                    mimetype="application/json",
                    headers=cors_headers
                )
            
            logging.info("Validating password with bcrypt")
            password_valid = bcrypt.checkpw(password.encode('utf-8'), password_hash.encode('utf-8'))
            if not password_valid:
                logging.warning(f"Invalid password for business: {email}")
                return func.HttpResponse(
                    json.dumps({"error": "Invalid business credentials", "success": False}),
                    status_code=401,
                    mimetype="application/json",
                    headers=cors_headers
                )
        except Exception as bcrypt_error:
            error_details = traceback.format_exc()
            logging.error(f"Password validation failed: {str(bcrypt_error)}\n{error_details}")
            return func.HttpResponse(
                json.dumps({"error": "Authentication error. Please try again later.", "success": False}),
                status_code=500,
                mimetype="application/json",
                headers=cors_headers
            )
        
        # Remove sensitive data before sending response
        business_data = {k: v for k, v in business.items() 
                        if k not in ['passwordHash', '_rid', '_self', '_etag', '_attachments', '_ts']}
        
        logging.info(f"Login successful for business: {email}")
        
        # Return success response
        return func.HttpResponse(
            json.dumps({
                "success": True,
                "business": business_data,
                "email": business_data["email"]
            }),
            status_code=200,
            mimetype="application/json",
            headers=cors_headers
        )
    except Exception as e:
        logging.error(f'Error in business login: {str(e)}')
        logging.error(f'Error type: {type(e).__name__}')
        import traceback
        logging.error(f'Traceback: {traceback.format_exc()}')
        return func.HttpResponse(
            json.dumps({"error": "Internal server error. Please try again later.", "success": False}),
            status_code=500,
            headers=cors_headers
        )