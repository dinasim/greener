# Test your Speech Service credentials
import requests

def test_speech_token(key, region):
    """Test if your Speech Service credentials work"""
    endpoints = [
        f"https://{region}.api.cognitive.microsoft.com/sts/v1.0/issueToken",
        f"https://{region}.sts.speech.microsoft.com/sts/v1.0/issueToken"
    ]
    
    for url in endpoints:
        print(f"Testing: {url}")
        try:
            response = requests.post(
                url,
                headers={
                    "Ocp-Apim-Subscription-Key": key,
                    "Content-Length": "0"
                },
                timeout=10
            )
            print(f"Status: {response.status_code}")
            if response.status_code == 200:
                token = response.text.strip()
                print(f"SUCCESS! Token length: {len(token)}")
                print(f"Token preview: {token[:20]}...")
                return True
            else:
                print(f"Error: {response.text}")
        except Exception as e:
            print(f"Exception: {e}")
    
    return False

# Replace with your actual credentials
KEY = "1sZO6rUCeJ1J2t7Cg0nMVMYxdbL9Gnuc1J59QFe52GE7gD0ICvViJQQJ99BHACYeBjFXJ3w3AAAYACOGhnGF"
REGION = "eastus"  # or your region

if test_speech_token(KEY, REGION):
    print("✅ Credentials are working!")
else:
    print("❌ Credentials failed!")