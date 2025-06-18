#!/usr/bin/env python
# Azure Functions API Tester
# A comprehensive testing tool similar to Postman for testing Azure Functions

import requests
import json
import argparse
import sys
import os
import time
from datetime import datetime
import uuid
import base64
from termcolor import colored
from tabulate import tabulate
import colorama
from urllib.parse import urlencode, quote_plus
import threading
import concurrent.futures

# Initialize colorama for Windows systems
colorama.init()

# Configuration
BASE_URL = "https://usersfunctions.azurewebsites.net/api"
RESULTS_DIR = "test_results"
MAX_PARALLEL_TESTS = 5  # For parallel testing

# Test user credentials - modified to match your backend structure
TEST_USER = {
    "username": "testuser123",  # Backend expects username, not email
    "email": "test@example.com",
    "password": "TestPassword123",
    "name": "Test User",
    "id": str(uuid.uuid4())
}

BUSINESS_TEST_USER = {
    "username": "businessuser123",  # Backend expects username, not email
    "email": "business@example.com",
    "password": "BusinessTest123",
    "name": "Business Test",
    "businessName": "Test Business",
    "businessType": "Plant Shop",
    "type": "business",  # Important: user type for business
    "id": str(uuid.uuid4())
}

# Setup results directory
if not os.path.exists(RESULTS_DIR):
    os.makedirs(RESULTS_DIR)

# Global state for authorization tokens and session data
AUTH_TOKENS = {}
SESSION_DATA = {}
TEST_RESULTS = {}

# ANSI color codes for terminal output
class Colors:
    HEADER = '\033[95m'
    BLUE = '\033[94m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'
    UNDERLINE = '\033[4m'

def print_color(text, color):
    """Print colored text to terminal"""
    colors = {
        "header": Colors.HEADER,
        "blue": Colors.BLUE,
        "green": Colors.GREEN,
        "yellow": Colors.YELLOW,
        "red": Colors.RED,
        "bold": Colors.BOLD,
        "underline": Colors.UNDERLINE,
        "end": Colors.ENDC
    }
    print(f"{colors.get(color, '')}{text}{Colors.ENDC}")

def print_header(text):
    """Print a formatted header"""
    print("\n" + "=" * 80)
    print_color(f" {text} ", "header")
    print("=" * 80)

def print_response(response, label=None, save_to_file=False, verbose=False):
    """Pretty print API response with colors and detailed info"""
    if label:
        print_color(f"\n=== {label} ===", "bold")
    
    # Print request info
    print_color("Request:", "bold")
    print(f"URL: {response.request.url}")
    print(f"Method: {response.request.method}")
    
    if verbose:
        print_color("Request Headers:", "blue")
        for key, value in response.request.headers.items():
            if key.lower() == 'authorization':
                print(f"  {key}: Bearer [REDACTED]")
            else:
                print(f"  {key}: {value}")
    
    # Print request body if it exists and verbose is True
    if verbose and hasattr(response.request, 'body') and response.request.body:
        print_color("Request Body:", "blue")
        try:
            body = json.loads(response.request.body)
            print(json.dumps(body, indent=2))
        except:
            if response.request.body:
                print(f"  {response.request.body}")
    
    # Print response details
    print_color("Response:", "bold")
    status_color = "green" if response.ok else "red"
    print_color(f"Status: {response.status_code} {response.reason}", status_color)
    print(f"Time: {response.elapsed.total_seconds():.3f} seconds")
    
    if verbose:
        print_color("Response Headers:", "blue")
        for key, value in response.headers.items():
            print(f"  {key}: {value}")
    
    # Print response body
    print_color("Response Body:", "blue")
    try:
        data = response.json()
        formatted_json = json.dumps(data, indent=2)
        print(formatted_json)
        
        # Save response to file if requested
        if save_to_file:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"{RESULTS_DIR}/{label.replace(' ', '_')}_{timestamp}.json"
            with open(filename, 'w') as f:
                f.write(formatted_json)
            print_color(f"\nResponse saved to {filename}", "green")
            
    except Exception as e:
        print(response.text)
        if save_to_file:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"{RESULTS_DIR}/{label.replace(' ', '_')}_{timestamp}.txt"
            with open(filename, 'w') as f:
                f.write(response.text)
            print_color(f"\nResponse saved to {filename}", "green")
    
    print()
    return response

def get_auth_headers(user_type="standard"):
    """Get authentication headers based on user type - matches your backend structure"""
    headers = {
        'Content-Type': 'application/json',
        'X-API-Version': '1.0',
        'X-Client': 'api-tester'
    }
    
    if user_type == "business":
        user = BUSINESS_TEST_USER
        headers["X-User-Type"] = "business"
        headers["X-Business-ID"] = user["email"]
    else:
        user = TEST_USER
    
    if user["email"]:
        headers["X-User-Email"] = user["email"]
    
    # Add auth token if available
    if user_type in AUTH_TOKENS and AUTH_TOKENS[user_type]:
        headers["Authorization"] = f"Bearer {AUTH_TOKENS[user_type]}"
    
    return headers

def get_test_image_base64():
    """Get a base64 encoded test image or create one"""
    try:
        # Try to find an image in the directory
        for filename in os.listdir("."):
            if filename.lower().endswith(('.png', '.jpg', '.jpeg')):
                with open(filename, "rb") as image_file:
                    return base64.b64encode(image_file.read()).decode('utf-8')
        
        # If no image found, create a simple one
        print_color("No test image found, using placeholder data", "yellow")
        return "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
    except Exception as e:
        print_color(f"Error getting test image: {e}", "red")
        return None

# Test functions for various endpoints
def test_login(username=None, password=None, user_type="standard"):
    """Test login functionality - uses username as your backend expects"""
    print_header(f"Testing Login ({user_type})")
    
    if not username:
        username = BUSINESS_TEST_USER["username"] if user_type == "business" else TEST_USER["username"]
    if not password:
        password = BUSINESS_TEST_USER["password"] if user_type == "business" else TEST_USER["password"]
    
    url = f"{BASE_URL}/loginuser"  # Matches your backend route
    data = {
        "username": username,  # Your backend expects username, not email
        "password": password
    }
    
    print(f"POST {url}")
    print(f"Data: {json.dumps({**data, 'password': '*****'}, indent=2)}")
    
    response = requests.post(url, json=data)
    print_response(response, f"Login ({user_type})")
    
    if response.ok:
        try:
            result = response.json()
            # Your backend returns user data directly
            print_color(f"✓ Login successful for {user_type} user: {result.get('email', username)}", "green")
            
            # Store user data for subsequent requests
            if user_type == "business":
                BUSINESS_TEST_USER["email"] = result.get("email", BUSINESS_TEST_USER["email"])
            else:
                TEST_USER["email"] = result.get("email", TEST_USER["email"])
            
            return True
        except:
            print_color("✗ Invalid JSON response", "red")
    
    return False

def test_register_user(user_data=None, user_type="standard"):
    """Test user registration - matches your backend registeruser structure"""
    print_header(f"Testing User Registration ({user_type})")
    
    if not user_data:
        if user_type == "business":
            user_data = BUSINESS_TEST_USER.copy()
        else:
            user_data = TEST_USER.copy()
    
    # Generate unique credentials to avoid conflicts
    unique_suffix = int(time.time())
    user_data = {**user_data}
    user_data["username"] = f"testuser{unique_suffix}"
    user_data["email"] = f"test{unique_suffix}@example.com"
    
    url = f"{BASE_URL}/registeruser"  # Matches your backend route
    
    # Structure data to match your backend expectations
    registration_data = {
        "username": user_data["username"],
        "email": user_data["email"],
        "password": user_data["password"],
        "name": user_data["name"],
        "intersted": user_data.get("intersted", ""),
        "animals": user_data.get("animals", ""),
        "kids": user_data.get("kids", ""),
        "location": {
            "city": "Test City",
            "country": "Israel",
            "latitude": 32.0853,
            "longitude": 34.7818,
            "formattedAddress": "Test City, Israel"
        },
        "plantLocations": [],
        "fcmToken": None,
        "webPushSubscription": None,
        "notificationSettings": {
            "enabled": True,
            "wateringReminders": True,
            "marketplaceUpdates": False,
            "platform": "test"
        },
        "createdAt": datetime.now().isoformat(),
        "updatedAt": datetime.now().isoformat()
    }
    
    # Remove password from logged data for security
    display_data = {**registration_data}
    display_data['password'] = '*****'
    
    print(f"POST {url}")
    print(f"Data: {json.dumps(display_data, indent=2)}")
    
    response = requests.post(url, json=registration_data)
    print_response(response, f"Register User ({user_type})")
    
    if response.ok:
        print_color(f"✓ User registered successfully: {user_data['email']}", "green")
        # Update test user with the newly created credentials
        if user_type == "business":
            BUSINESS_TEST_USER.update(user_data)
        else:
            TEST_USER.update(user_data)
        return True
    else:
        print_color(f"✗ User registration failed", "red")
        return False

def test_save_user(user_type="standard"):
    """Test saving user profile details - matches your saveUser function structure"""
    print_header(f"Testing Save User ({user_type})")
    
    url = f"{BASE_URL}/saveUser"  # Matches your backend route
    
    if user_type == "business":
        # Business user data structure
        data = {
            "email": BUSINESS_TEST_USER["email"],
            "name": BUSINESS_TEST_USER["name"],
            "type": "business",  # Critical: user type
            "businessName": BUSINESS_TEST_USER["businessName"],
            "businessType": BUSINESS_TEST_USER["businessType"],
            "description": "Test business created through API testing",
            "contactPhone": "123-456-7890",
            "phone": "123-456-7890",
            "businessHours": [
                {"day": "monday", "hours": "9:00-17:00", "isOpen": True},
                {"day": "tuesday", "hours": "9:00-17:00", "isOpen": True},
                {"day": "wednesday", "hours": "9:00-17:00", "isOpen": True},
                {"day": "thursday", "hours": "9:00-17:00", "isOpen": True},
                {"day": "friday", "hours": "9:00-14:00", "isOpen": True},
                {"day": "saturday", "hours": "Closed", "isOpen": False},
                {"day": "sunday", "hours": "10:00-16:00", "isOpen": True}
            ],
            "socialMedia": {
                "website": "https://testbusiness.com",
                "facebook": "testbusiness",
                "instagram": "testbusiness"
            },
            "location": {
                "city": "Test City",
                "street": "Test Street",
                "houseNumber": "123",
                "latitude": 32.0853,
                "longitude": 34.7818,
                "formattedAddress": "123 Test Street, Test City, Israel",
                "country": "Israel"
            },
            "platform": "test",
            "notificationSettings": {
                "enabled": True,
                "wateringReminders": True,
                "lowStockAlerts": True,
                "orderNotifications": True,
                "platform": "test"
            }
        }
    else:
        # Consumer user data structure
        data = {
            "email": TEST_USER["email"],
            "name": TEST_USER["name"],
            "type": "consumer",  # Critical: user type
            "intersted": "Indoor plants",
            "animals": "No",
            "kids": "No",
            "location": {
                "city": "Test City",
                "street": "Test Street",
                "houseNumber": "456",
                "latitude": 32.0853,
                "longitude": 34.7818,
                "formattedAddress": "456 Test Street, Test City, Israel",
                "country": "Israel"
            },
            "plantLocations": ["Living Room", "Bedroom"],
            "platform": "test",
            "notificationSettings": {
                "enabled": True,
                "wateringReminders": True,
                "marketplaceUpdates": False,
                "platform": "test"
            }
        }
    
    headers = get_auth_headers(user_type)
    
    print(f"POST {url}")
    print(f"Data: {json.dumps(data, indent=2)}")
    
    response = requests.post(url, json=data, headers=headers)
    print_response(response, f"Save User ({user_type})")
    
    if response.ok:
        print_color(f"✓ {user_type.title()} user data saved successfully", "green")
        return True
    else:
        print_color(f"✗ Failed to save {user_type} user data", "red")
        return False

def test_user_profile():
    """Test getting user profile - matches your user-profile endpoint"""
    print_header("Testing User Profile")
    
    url = f"{BASE_URL}/user-profile/{TEST_USER['email']}"
    headers = get_auth_headers()
    
    print(f"GET {url}")
    response = requests.get(url, headers=headers)
    print_response(response, "Get User Profile")
    
    if response.ok:
        print_color("✓ User profile retrieved successfully", "green")
        return True
    else:
        print_color("✗ Failed to retrieve user profile", "red")
        return False

def test_business_profile(business_email=None):
    """Test business profile endpoints - matches your business-profile structure"""
    print_header("Testing Business Profile")
    
    if not business_email:
        business_email = BUSINESS_TEST_USER["email"]
    
    url = f"{BASE_URL}/business-profile"
    headers = get_auth_headers("business")
    
    print(f"GET {url}")
    response = requests.get(url, headers=headers)
    print_response(response, "Get Business Profile")
    
    if response.ok:
        print_color("✓ Business profile retrieved successfully", "green")
        return True
    else:
        print_color("✗ Failed to retrieve business profile", "red")
        return False

def test_business_inventory():
    """Test business inventory endpoints"""
    print_header("Testing Business Inventory")
    
    url = f"{BASE_URL}/business-inventory-get"
    headers = get_auth_headers("business")
    
    print(f"GET {url}")
    response = requests.get(url, headers=headers)
    print_response(response, "Get Business Inventory")
    
    # Create inventory item
    create_url = f"{BASE_URL}/business-inventory-create"
    create_data = {
        "businessId": BUSINESS_TEST_USER["email"],
        "productType": "plant",
        "name": f"Test Plant {int(time.time())}",
        "scientificName": "Testus plantus",
        "price": 19.99,
        "quantity": 10,
        "category": "indoor",
        "description": "A beautiful test plant",
        "minThreshold": 3,
        "images": [],
        "status": "active"
    }
    
    print(f"POST {create_url}")
    print(f"Data: {json.dumps(create_data, indent=2)}")
    
    create_response = requests.post(create_url, json=create_data, headers=headers)
    print_response(create_response, "Create Inventory Item")
    
    if create_response.ok:
        print_color("✓ Inventory item created successfully", "green")
        return True
    else:
        print_color("✗ Failed to create inventory item", "red")
        return False

def test_user_plants():
    """Test user plants functionality"""
    print_header("Testing User Plants")
    
    url = f"{BASE_URL}/getalluserplants"
    headers = get_auth_headers()
    
    query_params = {
        "email": TEST_USER["email"]
    }
    
    full_url = f"{url}?{urlencode(query_params)}"
    print(f"GET {full_url}")
    
    response = requests.get(full_url, headers=headers)
    print_response(response, "Get User Plants")
    
    if response.ok:
        print_color("✓ User plants retrieved successfully", "green")
        
        # Test adding a plant
        add_url = f"{BASE_URL}/addUserPlant"
        plant_data = {
            "userEmail": TEST_USER["email"],
            "plantName": f"Test Plant {int(time.time())}",
            "plantType": "Monstera",
            "locationId": "test-location",
            "wateringFrequency": 7,
            "sunlightNeeds": "medium",
            "notes": "Test plant added through API testing"
        }
        
        print(f"POST {add_url}")
        print(f"Data: {json.dumps(plant_data, indent=2)}")
        
        add_response = requests.post(add_url, json=plant_data, headers=headers)
        print_response(add_response, "Add User Plant")
        
        if add_response.ok:
            print_color("✓ Plant added successfully", "green")
            return True
        else:
            print_color("✗ Failed to add plant", "red")
            return False
    else:
        print_color("✗ Failed to retrieve user plants", "red")
        return False

def test_geocode():
    """Test geocoding functionality"""
    print_header("Testing Geocode")
    
    url = f"{BASE_URL}/geocode"
    data = {
        "address": "Tel Aviv, Israel"
    }
    
    print(f"POST {url}")
    print(f"Data: {json.dumps(data, indent=2)}")
    
    response = requests.post(url, json=data)
    print_response(response, "Geocode")
    
    if response.ok:
        print_color("✓ Geocoding request successful", "green")
        return True
    else:
        print_color("✗ Geocoding failed", "red")
        return False

def test_reverse_geocode():
    """Test reverse geocoding functionality"""
    print_header("Testing Reverse Geocode")
    
    url = f"{BASE_URL}/reverse-geocode"
    data = {
        "latitude": 32.0853,
        "longitude": 34.7818
    }
    
    print(f"POST {url}")
    print(f"Data: {json.dumps(data, indent=2)}")
    
    response = requests.post(url, json=data)
    print_response(response, "Reverse Geocode")
    
    if response.ok:
        print_color("✓ Reverse geocoding request successful", "green")
        return True
    else:
        print_color("✗ Reverse geocoding failed", "red")
        return False

def test_plant_search():
    """Test plant search functionality"""
    print_header("Testing Plant Search")
    
    url = f"{BASE_URL}/plantSearch"
    
    params = {
        "name": "monstera",
        "category": "indoor"
    }
    
    full_url = f"{url}?{urlencode(params)}"
    print(f"GET {full_url}")
    
    response = requests.get(full_url)
    print_response(response, "Plant Search")
    
    if response.ok:
        print_color("✓ Plant search successful", "green")
        return True
    else:
        print_color("✗ Plant search failed", "red")
        return False

def test_ai_plant_care_chat():
    """Test AI plant care chat functionality"""
    print_header("Testing AI Plant Care Chat")
    
    url = f"{BASE_URL}/ai-plant-care-chat"
    headers = get_auth_headers()
    
    data = {
        "userEmail": TEST_USER["email"],
        "message": "How often should I water my monstera?",
        "plantType": "Monstera deliciosa",
        "conversationId": f"test-conversation-{int(time.time())}"
    }
    
    print(f"POST {url}")
    print(f"Data: {json.dumps(data, indent=2)}")
    
    response = requests.post(url, json=data, headers=headers)
    print_response(response, "AI Plant Care Chat")
    
    if response.ok:
        print_color("✓ AI chat request successful", "green")
        return True
    else:
        print_color("✗ AI chat failed", "red")
        return False

def test_chat_history():
    """Test chat history retrieval"""
    print_header("Testing Chat History")
    
    url = f"{BASE_URL}/chat-history"
    headers = get_auth_headers()
    
    params = {
        "userEmail": TEST_USER["email"],
        "conversationId": "test-conversation"
    }
    
    full_url = f"{url}?{urlencode(params)}"
    print(f"GET {full_url}")
    
    response = requests.get(full_url, headers=headers)
    print_response(response, "Chat History")
    
    if response.ok:
        print_color("✓ Chat history retrieved successfully", "green")
        return True
    else:
        print_color("✗ Failed to retrieve chat history", "red")
        return False

def test_notification_settings():
    """Test notification settings endpoints"""
    print_header("Testing Notification Settings")
    
    url = f"{BASE_URL}/notification_settings"
    headers = get_auth_headers()
    
    # Get current settings
    params = {
        "userEmail": TEST_USER["email"]
    }
    
    full_url = f"{url}?{urlencode(params)}"
    print(f"GET {full_url}")
    
    response = requests.get(full_url, headers=headers)
    print_response(response, "Get Notification Settings")
    
    # Update settings
    update_data = {
        "userEmail": TEST_USER["email"],
        "settings": {
            "wateringReminders": True,
            "marketplaceUpdates": False,
            "diseaseAlerts": True,
            "weeklyTips": True
        }
    }
    
    print(f"POST {url}")
    print(f"Data: {json.dumps(update_data, indent=2)}")
    
    update_response = requests.post(url, json=update_data, headers=headers)
    print_response(update_response, "Update Notification Settings")
    
    if update_response.ok:
        print_color("✓ Notification settings updated successfully", "green")
        return True
    else:
        print_color("✗ Failed to update notification settings", "red")
        return False

def test_weather_get():
    """Test weather API"""
    print_header("Testing Weather API")
    
    url = f"{BASE_URL}/weather-get"
    
    # Use coordinates for a test location
    params = {
        "lat": 32.0853,
        "lon": 34.7818
    }
    
    full_url = f"{url}?{urlencode(params)}"
    print(f"GET {full_url}")
    
    response = requests.get(full_url)
    print_response(response, "Get Weather")
    
    if response.ok:
        print_color("✓ Weather data retrieved successfully", "green")
        return True
    else:
        print_color("✗ Failed to retrieve weather data", "red")
        return False

def test_identify_plant():
    """Test plant identification from image"""
    print_header("Testing Plant Identification")
    
    url = f"{BASE_URL}/identifyPlantPhoto"
    image_data = get_test_image_base64()
    
    if not image_data:
        print_color("✗ Skipping test - no image data available", "yellow")
        return False
    
    data = {
        "imageBase64": image_data
    }
    
    print(f"POST {url}")
    print("Data: {image data not shown}")
    
    response = requests.post(url, json=data)
    print_response(response, "Identify Plant")
    
    if response.ok:
        print_color("✓ Plant identification request successful", "green")
        return True
    else:
        print_color("✗ Plant identification failed", "red")
        return False

def test_disease_check():
    """Test plant disease checking functionality"""
    print_header("Testing Disease Check")
    
    url = f"{BASE_URL}/diseaseCheck"
    image_data = get_test_image_base64()
    
    if not image_data:
        print_color("✗ Skipping test - no image data available", "yellow")
        return False
    
    data = {
        "imageBase64": image_data
    }
    
    print(f"POST {url}")
    print("Data: {image data not shown}")
    
    response = requests.post(url, json=data)
    print_response(response, "Disease Check")
    
    if response.ok:
        print_color("✓ Disease check request successful", "green")
        return True
    else:
        print_color("✗ Disease check failed", "red")
        return False

def execute_test(test_func, *args, **kwargs):
    """Execute a test function and record results"""
    test_name = test_func.__name__
    start_time = time.time()
    
    try:
        result = test_func(*args, **kwargs)
        end_time = time.time()
        duration = end_time - start_time
        
        if result:
            TEST_RESULTS[test_name] = {
                "status": "PASS",
                "duration": duration,
                "timestamp": datetime.now().isoformat()
            }
            return True
        else:
            TEST_RESULTS[test_name] = {
                "status": "FAIL",
                "duration": duration,
                "timestamp": datetime.now().isoformat()
            }
            return False
    except Exception as e:
        end_time = time.time()
        duration = end_time - start_time
        TEST_RESULTS[test_name] = {
            "status": "ERROR",
            "message": str(e),
            "duration": duration,
            "timestamp": datetime.now().isoformat()
        }
        print_color(f"Error in {test_name}: {str(e)}", "red")
        return False

def run_user_tests():
    """Run all user-related tests"""
    print_header("Running User Tests")
    
    tests = [
        (test_register_user, (), {}),
        (test_login, (), {}),
        (test_save_user, (), {}),
        (test_user_profile, (), {}),
        (test_user_plants, (), {})
    ]
    
    for test_func, args, kwargs in tests:
        execute_test(test_func, *args, **kwargs)

def run_business_tests():
    """Run all business-related tests"""
    print_header("Running Business Tests")
    
    # First register and login as a business user
    execute_test(test_register_user, None, "business")
    execute_test(test_login, None, None, "business")
    execute_test(test_save_user, "business")
    
    tests = [
        (test_business_profile, (), {}),
        (test_business_inventory, (), {})
    ]
    
    for test_func, args, kwargs in tests:
        execute_test(test_func, *args, **kwargs)

def run_api_tests():
    """Run all API functionality tests"""
    print_header("Running API Functionality Tests")
    
    tests = [
        (test_geocode, (), {}),
        (test_reverse_geocode, (), {}),
        (test_plant_search, (), {}),
        (test_identify_plant, (), {}),
        (test_disease_check, (), {}),
        (test_weather_get, (), {}),
        (test_ai_plant_care_chat, (), {}),
        (test_chat_history, (), {}),
        (test_notification_settings, (), {})
    ]
    
    for test_func, args, kwargs in tests:
        execute_test(test_func, *args, **kwargs)

def run_all_tests():
    """Run all tests sequentially"""
    print_header("Running All Tests")
    
    # Clear previous results
    TEST_RESULTS.clear()
    
    # Run all test groups
    run_user_tests()
    run_business_tests()
    run_api_tests()
    
    # Print summary report
    print_test_summary()

def run_test_suite(suite_name):
    """Run a specific test suite"""
    suites = {
        "user": run_user_tests,
        "business": run_business_tests,
        "api": run_api_tests,
        "all": run_all_tests
    }
    
    if suite_name in suites:
        suites[suite_name]()
    else:
        print_color(f"Unknown test suite: {suite_name}", "red")
        print_color("Available suites: user, business, api, all", "yellow")

def run_specific_test(test_name):
    """Run a specific test by name"""
    test_map = {
        "login": test_login,
        "register": test_register_user,
        "save_user": test_save_user,
        "user_profile": test_user_profile,
        "geocode": test_geocode,
        "reverse_geocode": test_reverse_geocode,
        "plant_search": test_plant_search,
        "identify_plant": test_identify_plant,
        "disease_check": test_disease_check,
        "business_profile": test_business_profile,
        "business_inventory": test_business_inventory,
        "user_plants": test_user_plants,
        "ai_chat": test_ai_plant_care_chat,
        "chat_history": test_chat_history,
        "weather": test_weather_get,
        "notification_settings": test_notification_settings
    }
    
    if test_name in test_map:
        execute_test(test_map[test_name])
    else:
        print_color(f"Unknown test: {test_name}", "red")
        print_color(f"Available tests: {', '.join(test_map.keys())}", "yellow")

def run_parallel_tests(test_names):
    """Run multiple tests in parallel"""
    print_header(f"Running {len(test_names)} Tests in Parallel")
    
    test_map = {
        "login": test_login,
        "register": test_register_user,
        "save_user": test_save_user,
        "user_profile": test_user_profile,
        "geocode": test_geocode,
        "reverse_geocode": test_reverse_geocode,
        "plant_search": test_plant_search,
        "identify_plant": test_identify_plant,
        "disease_check": test_disease_check,
        "business_profile": test_business_profile,
        "business_inventory": test_business_inventory,
        "user_plants": test_user_plants,
        "ai_chat": test_ai_plant_care_chat,
        "chat_history": test_chat_history,
        "weather": test_weather_get,
        "notification_settings": test_notification_settings
    }
    
    # Filter valid tests
    valid_tests = []
    for name in test_names:
        if name in test_map:
            valid_tests.append((name, test_map[name]))
        else:
            print_color(f"Unknown test: {name} - skipping", "yellow")
    
    if not valid_tests:
        print_color("No valid tests to run", "red")
        return
    
    # Run tests in parallel
    with concurrent.futures.ThreadPoolExecutor(max_workers=min(MAX_PARALLEL_TESTS, len(valid_tests))) as executor:
        futures = {executor.submit(execute_test, test_func): test_name for test_name, test_func in valid_tests}
        
        for future in concurrent.futures.as_completed(futures):
            test_name = futures[future]
            try:
                result = future.result()
                status = "PASS" if result else "FAIL"
                print_color(f"Test {test_name}: {status}", "green" if result else "red")
            except Exception as e:
                print_color(f"Test {test_name}: ERROR - {str(e)}", "red")
    
    print_test_summary()

def print_test_summary():
    """Print a summary of all test results"""
    print_header("Test Summary")
    
    # Count results
    total = len(TEST_RESULTS)
    passed = sum(1 for result in TEST_RESULTS.values() if result["status"] == "PASS")
    failed = sum(1 for result in TEST_RESULTS.values() if result["status"] == "FAIL")
    errors = sum(1 for result in TEST_RESULTS.values() if result["status"] == "ERROR")
    
    # Create table
    rows = []
    for test_name, result in TEST_RESULTS.items():
        status_color = {
            "PASS": "green",
            "FAIL": "red",
            "ERROR": "red"
        }.get(result["status"], "")
        
        status = colored(result["status"], status_color)
        duration = f"{result['duration']:.3f}s"
        message = result.get("message", "")
        
        rows.append([test_name, status, duration, message])
    
    # Print table
    print(tabulate(rows, headers=["Test", "Status", "Duration", "Message"], tablefmt="grid"))
    
    # Print summary
    print()
    print(f"Total tests: {total}")
    print(colored(f"Passed: {passed}", "green"))
    print(colored(f"Failed: {failed}", "red" if failed > 0 else "green"))
    print(colored(f"Errors: {errors}", "red" if errors > 0 else "green"))
    
    # Save results to file
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"{RESULTS_DIR}/test_summary_{timestamp}.json"
    
    with open(filename, "w") as f:
        json.dump({
            "summary": {
                "total": total,
                "passed": passed,
                "failed": failed,
                "errors": errors,
                "timestamp": datetime.now().isoformat()
            },
            "results": TEST_RESULTS
        }, f, indent=2)
    
    print_color(f"\nTest results saved to {filename}", "blue")

def interactive_mode():
    """Run the tester in interactive mode"""
    print_header("Azure Functions API Tester - Interactive Mode")
    print("Type 'help' for a list of commands or 'exit' to quit")
    
    while True:
        try:
            command = input("\n> ").strip()
            
            if command.lower() in ["exit", "quit", "q"]:
                print("Exiting...")
                break
            elif command.lower() in ["help", "h", "?"]:
                print_color("\nAvailable commands:", "bold")
                print("  help - Show this help message")
                print("  exit, quit, q - Exit the program")
                print("  list tests - List all available tests")
                print("  list suites - List all test suites")
                print("  run <test> - Run a specific test")
                print("  run suite <suite> - Run a test suite")
                print("  run all - Run all tests")
                print("  run parallel <test1> <test2> ... - Run tests in parallel")
                print("  summary - Show test summary")
                print("  clear - Clear the screen")
            elif command.lower() == "list tests":
                print_color("\nAvailable tests:", "bold")
                tests = [
                    "login", "register", "save_user", "user_profile", "geocode", 
                    "reverse_geocode", "plant_search", "identify_plant", "disease_check",
                    "business_profile", "business_inventory", "user_plants", "ai_chat", 
                    "chat_history", "weather", "notification_settings"
                ]
                for test in tests:
                    print(f"  {test}")
            elif command.lower() == "list suites":
                print_color("\nAvailable test suites:", "bold")
                print("  user - User-related tests")
                print("  business - Business-related tests")
                print("  api - API functionality tests")
                print("  all - All tests")
            elif command.lower().startswith("run "):
                parts = command.split(" ")
                if len(parts) < 2:
                    print_color("Please specify what to run", "yellow")
                    continue
                
                if parts[1] == "suite" and len(parts) >= 3:
                    run_test_suite(parts[2].lower())
                elif parts[1] == "all":
                    run_all_tests()
                elif parts[1] == "parallel" and len(parts) >= 3:
                    run_parallel_tests(parts[2:])
                else:
                    run_specific_test(parts[1].lower())
            elif command.lower() == "summary":
                print_test_summary()
            elif command.lower() == "clear":
                os.system("cls" if os.name == "nt" else "clear")
            else:
                print_color(f"Unknown command: {command}", "yellow")
                print("Type 'help' for a list of commands")
        except KeyboardInterrupt:
            print("\nOperation cancelled. Type 'exit' to quit")
        except Exception as e:
            print_color(f"Error: {str(e)}", "red")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Azure Functions API Tester")
    parser.add_argument("--url", help="Base URL for Azure Functions App", default=BASE_URL)
    parser.add_argument("--test", help="Run a specific test")
    parser.add_argument("--suite", help="Run a test suite (user, business, api, all)")
    parser.add_argument("--parallel", nargs="+", help="Run specified tests in parallel")
    parser.add_argument("--interactive", action="store_true", help="Run in interactive mode")
    parser.add_argument("--output", help="Directory for test results", default=RESULTS_DIR)
    args = parser.parse_args()

    # Update configuration
    BASE_URL = args.url
    RESULTS_DIR = args.output
    
    if not os.path.exists(RESULTS_DIR):
        os.makedirs(RESULTS_DIR)
    
    if args.interactive:
        interactive_mode()
    elif args.parallel:
        run_parallel_tests(args.parallel)
    elif args.test:
        run_specific_test(args.test)
    elif args.suite:
        run_test_suite(args.suite)
    else:
        # Default: interactive mode
        interactive_mode()