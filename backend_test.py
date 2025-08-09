#!/usr/bin/env python3
"""
Backend API Health Check Test
Tests the FastAPI backend /api/ endpoint for basic functionality
"""

import requests
import json
import sys
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv('/app/frontend/.env')

def test_backend_health():
    """Test if the backend /api/ endpoint is reachable and returns valid JSON"""
    
    # Get the backend URL from environment
    backend_base_url = os.environ.get('REACT_APP_BACKEND_URL')
    if not backend_base_url:
        print("❌ REACT_APP_BACKEND_URL not found in environment")
        return False
    
    api_url = f"{backend_base_url}/api/"
    print(f"Testing backend health at: {api_url}")
    
    try:
        # Make GET request to /api/ endpoint
        response = requests.get(api_url, timeout=10)
        
        print(f"Status Code: {response.status_code}")
        print(f"Response Headers: {dict(response.headers)}")
        
        # Check if status code is 200
        if response.status_code != 200:
            print(f"❌ Expected status code 200, got {response.status_code}")
            print(f"Response text: {response.text}")
            return False
        
        # Check if response is valid JSON
        try:
            json_data = response.json()
            print(f"Response JSON: {json_data}")
        except json.JSONDecodeError as e:
            print(f"❌ Response is not valid JSON: {e}")
            print(f"Response text: {response.text}")
            return False
        
        # Check if JSON contains a message field
        if 'message' not in json_data:
            print(f"❌ Response JSON does not contain 'message' field")
            print(f"Available fields: {list(json_data.keys())}")
            return False
        
        print(f"✅ Backend health check passed!")
        print(f"✅ Status: 200")
        print(f"✅ Valid JSON response with message: '{json_data['message']}'")
        return True
        
    except requests.exceptions.RequestException as e:
        print(f"❌ Request failed: {e}")
        return False
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        return False

def main():
    """Main test function"""
    print("=" * 60)
    print("BACKEND HEALTH CHECK TEST")
    print("=" * 60)
    
    success = test_backend_health()
    
    print("=" * 60)
    if success:
        print("✅ ALL TESTS PASSED")
        sys.exit(0)
    else:
        print("❌ TESTS FAILED")
        sys.exit(1)

if __name__ == "__main__":
    main()