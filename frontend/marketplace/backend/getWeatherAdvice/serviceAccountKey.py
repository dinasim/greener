
import os
import firebase_admin
from firebase_admin import credentials

# Build the service account dictionary from environment variables
service_account = {
    "type": "service_account",
    "project_id": os.environ.get("FIREBASE_PROJECT_ID"),
    "private_key_id": os.environ.get("FIREBASE_SECRET_KEY_ID"),
    "private_key": os.environ.get("FIREBASE_SECRET_KEY").replace('\\n', '\n'),
    "client_email": os.environ.get("FIREBASE_CLIENT_EMAIL"),
    "client_id": os.environ.get("FIREBASE_CLIENT_ID"),
    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
    "token_uri": "https://oauth2.googleapis.com/token",
    "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
    "client_x509_cert_url": f"https://www.googleapis.com/robot/v1/metadata/x509/{os.environ.get('FIREBASE_CLIENT_EMAIL')}",
    "universe_domain": "googleapis.com"
}

# Initialize Firebase
cred = credentials.Certificate(service_account)
firebase_admin.initialize_app(cred)
