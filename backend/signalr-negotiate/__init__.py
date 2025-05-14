# Function: signalr-negotiate/__init__.py
import logging
import json
import azure.functions as func
import os
from azure.functions import SignalRConnectionInfo

def add_cors_headers(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS, PUT, PATCH, DELETE'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type,Authorization,X-User-Email'
    return response

def main(req: func.HttpRequest, connectionInfo: SignalRConnectionInfo) -> func.HttpResponse:
    logging.info('SignalR negotiate function processed a request.')
    
    try:
        # Get user ID from query parameter
        user_id = req.params.get('userId')
        
        if not user_id:
            return func.HttpResponse(
                body=json.dumps({"error": "User ID is required"}),
                mimetype="application/json",
                status_code=400
            )
        
        # Return the connection info with user ID as the client ID
        connection_info = json.loads(connectionInfo)
        
        # Add user ID to connection info
        if 'accessToken' in connection_info:
            # The connection info already has the access token
            return func.HttpResponse(
                body=json.dumps(connection_info),
                mimetype="application/json"
            )
        else:
            # Something is wrong with the connection info
            logging.error("Invalid connection info received")
            return func.HttpResponse(
                body=json.dumps({"error": "Failed to generate connection info"}),
                mimetype="application/json",
                status_code=500
            )
    
    except Exception as e:
        logging.error(f"Error in SignalR negotiate: {str(e)}")
        return func.HttpResponse(
            body=json.dumps({"error": str(e)}),
            mimetype="application/json",
            status_code=500
        )