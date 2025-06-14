# Backend: /test/test_marketplace_api.py

import requests
import json
import sys
import os
from datetime import datetime

# Base URL of your deployed Function App
BASE_URL = "https://usersfunctions.azurewebsites.net/api"

# Test user credentials - replace with valid test user
TEST_USER = {
    "email": "dina2@mail.tau.ac.il",
    "id": "dina2"
}

# Test data
TEST_PRODUCT = {
    "title": "Test Plant",
    "description": "A beautiful test plant",
    "price": 19.99,
    "category": "indoor",
    "city": "Test City"
}

def print_response(response, label=None):
    """Pretty print API response"""
    if label:
        print(f"\n=== {label} ===")
    
    print(f"Status: {response.status_code}")
    
    try:
        data = response.json()
        print(json.dumps(data, indent=2))
    except:
        print(response.text)
    
    print()

def test_get_products():
    """Test getting all products"""
    url = f"{BASE_URL}/marketplace/products"
    print(f"GET {url}")
    
    response = requests.get(url)
    print_response(response, "Get All Products")
    
    return response.json() if response.ok else None

def test_create_product():
    """Test creating a product"""
    url = f"{BASE_URL}/marketplace/products/create"
    
    # Add test user as seller
    data = {**TEST_PRODUCT, "sellerId": TEST_USER["email"]}
    
    print(f"POST {url}")
    print(f"Data: {json.dumps(data, indent=2)}")
    
    response = requests.post(
        url, 
        json=data,
        headers={"X-User-Email": TEST_USER["email"]}
    )
    
    print_response(response, "Create Product")
    
    if response.ok:
        return response.json().get("productId")
    
    return None

def test_get_product(product_id):
    """Test getting a specific product"""
    url = f"{BASE_URL}/marketplace/products/specific/{product_id}"
    print(f"GET {url}")
    
    response = requests.get(url)
    print_response(response, "Get Specific Product")

def test_update_product(product_id):
    """Test updating a product"""
    url = f"{BASE_URL}/marketplace/products/{product_id}"
    
    data = {
        "title": "Updated Test Plant",
        "description": "This product has been updated",
        "price": 24.99
    }
    
    print(f"PATCH {url}")
    print(f"Data: {json.dumps(data, indent=2)}")
    
    response = requests.patch(
        url, 
        json=data,
        headers={"X-User-Email": TEST_USER["email"]}
    )
    
    print_response(response, "Update Product")

def test_toggle_wishlist(product_id):
    """Test toggling product in wishlist"""
    url = f"{BASE_URL}/marketplace/products/wish/{product_id}"
    
    print(f"POST {url}")
    
    response = requests.post(
        url,
        headers={"X-User-Email": TEST_USER["email"]}
    )
    
    print_response(response, "Toggle Wishlist")

def test_get_user_wishlist():
    """Test getting user wishlist"""
    url = f"{BASE_URL}/marketplace/users/{TEST_USER['email']}/wishlist"
    
    print(f"GET {url}")
    
    response = requests.get(
        url,
        headers={"X-User-Email": TEST_USER["email"]}
    )
    
    print_response(response, "Get User Wishlist")

def test_get_user_listings():
    """Test getting user listings"""
    url = f"{BASE_URL}/marketplace/users/{TEST_USER['email']}/listings"
    
    print(f"GET {url}")
    
    response = requests.get(
        url,
        headers={"X-User-Email": TEST_USER["email"]}
    )
    
    print_response(response, "Get User Listings")

def test_mark_as_sold(product_id):
    """Test marking a product as sold"""
    url = f"{BASE_URL}/marketplace/products/{product_id}/sold"
    
    data = {
        "notes": "Sold through API test"
    }
    
    print(f"POST {url}")
    print(f"Data: {json.dumps(data, indent=2)}")
    
    response = requests.post(
        url,
        json=data,
        headers={"X-User-Email": TEST_USER["email"]}
    )
    
    print_response(response, "Mark Product as Sold")

def test_delete_product(product_id):
    """Test deleting a product"""
    url = f"{BASE_URL}/marketplace/products/{product_id}"
    
    print(f"DELETE {url}")
    
    response = requests.delete(
        url,
        headers={"X-User-Email": TEST_USER["email"]}
    )
    
    print_response(response, "Delete Product")

def test_geocode():
    """Test geocoding API"""
    address = "Tel Aviv, Israel"
    url = f"{BASE_URL}/marketplace/geocode?address={address}"
    
    print(f"GET {url}")
    
    response = requests.get(url)
    print_response(response, "Geocode Address")

def test_nearby_products():
    """Test nearby products API"""
    # Use coordinates for Tel Aviv
    url = f"{BASE_URL}/marketplace/nearbyProducts?lat=32.0853&lon=34.7818&radius=10"
    
    print(f"GET {url}")
    
    response = requests.get(url)
    print_response(response, "Nearby Products")

def test_user_profile():
    """Test getting and updating user profile"""
    # Get profile
    url = f"{BASE_URL}/marketplace/users/{TEST_USER['email']}"
    
    print(f"GET {url}")
    
    response = requests.get(
        url,
        headers={"X-User-Email": TEST_USER["email"]}
    )
    
    print_response(response, "Get User Profile")
    
    # Update profile
    data = {
        "name": "Test User",
        "bio": "Updated bio via API test",
        "location": "Test City, Test Country"
    }
    
    print(f"PATCH {url}")
    print(f"Data: {json.dumps(data, indent=2)}")
    
    response = requests.patch(
        url,
        json=data,
        headers={"X-User-Email": TEST_USER["email"]}
    )
    
    print_response(response, "Update User Profile")

def run_all_tests():
    """Run all API tests in sequence"""
    # Test getting products
    test_get_products()
    
    # Test user profile
    test_user_profile()
    
    # Test geocoding
    test_geocode()
    
    # Test nearby products
    test_nearby_products()
    
    # Test product creation flow
    product_id = test_create_product()
    
    if product_id:
        # Test getting the specific product
        test_get_product(product_id)
        
        # Test updating the product
        test_update_product(product_id)
        
        # Test toggling wishlist
        test_toggle_wishlist(product_id)
        
        # Test getting user wishlist
        test_get_user_wishlist()
        
        # Test getting user listings
        test_get_user_listings()
        
        # Test marking as sold
        test_mark_as_sold(product_id)
        
        # Test deleting the product
        test_delete_product(product_id)

if __name__ == "__main__":
    if len(sys.argv) > 1:
        # Run a specific test
        test_name = sys.argv[1]
        
        if test_name == "products":
            test_get_products()
        elif test_name == "create":
            test_create_product()
        elif test_name == "profile":
            test_user_profile()
        elif test_name == "geocode":
            test_geocode()
        elif test_name == "nearby":
            test_nearby_products()
        elif test_name == "wishlist":
            if len(sys.argv) > 2:
                test_toggle_wishlist(sys.argv[2])
            test_get_user_wishlist()
        elif test_name == "listings":
            test_get_user_listings()
        else:
            print(f"Unknown test: {test_name}")
    else:
        # Run all tests
        run_all_tests()