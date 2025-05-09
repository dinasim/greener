# Implementing the Azure Backend for Greener App Marketplace

Follow these step-by-step instructions to set up the complete backend for the Marketplace feature.

## Prerequisites

Before starting the implementation, ensure you have:

1. An Azure account with active subscription
2. Node.js installed on your development machine
3. Azure Functions Core Tools installed
4. VS Code with Azure Functions extension (recommended)
5. Google API Console project for authentication

## Step 1: Create Azure Resources

### Create a Resource Group

1. Log into the Azure Portal (https://portal.azure.com)
2. Click on "Resource groups" in the left menu
3. Click "Create" to create a new resource group
4. Name it "greener-app-resources" and select your region
5. Click "Review + create" and then "Create"

### Create Cosmos DB Account

1. Go to your resource group
2. Click "Add" and search for "Azure Cosmos DB"
3. Select "Azure Cosmos DB" and click "Create"
4. Choose "Core (SQL) API"
5. Name your account "greener-cosmosdb-[unique-suffix]"
6. Choose "Serverless" capacity mode (for cost efficiency)
7. Select your region and click "Review + create"
8. Click "Create"

### Create Function App

1. Go back to your resource group
2. Click "Add" and search for "Function App"
3. Click "Create"
4. Fill in the details:
   - Name: "greener-functions-[unique-suffix]"
   - Runtime stack: Node.js
   - Version: 16 LTS
   - Region: Same as your Cosmos DB
   - Operating System: Windows
   - Plan type: Consumption (Serverless)
5. Click "Next: Hosting"
6. Create a new Storage account or use an existing one
7. Click "Review + create" and then "Create"

### Create Storage Account for Images

1. Go back to your resource group
2. Click "Add" and search for "Storage account"
3. Click "Create"
4. Fill in the details:
   - Name: "greenerstorage[unique-suffix]"
   - Performance: Standard
   - Redundancy: Locally redundant storage (LRS)
5. Click "Review" and then "Create"
6. Once created, go to the Storage account
7. Click "Containers" in the left menu
8. Create two containers:
   - "plant-images" with public access level set to "Blob"
   - "user-avatars" with public access level set to "Blob"

## Step 2: Set Up Cosmos DB

1. Go to your Cosmos DB account
2. Click "Data Explorer" in the left menu
3. Click "New Container"
4. Create a database named "greenerdb"
5. Create the following containers:
   - Container ID: "products", Partition key: "/id"
   - Container ID: "users", Partition key: "/id"
   - Container ID: "chatrooms", Partition key: "/id"

## Step 3: Set Up Google Authentication

1. Go to Google API Console (https://console.developers.google.com/)
2. Create a new project or select an existing one
3. Go to "Credentials" and click "Create credentials" > "OAuth client ID"
4. Configure the OAuth consent screen:
   - User Type: External
   - App name: "Greener App"
   - Add your email address
5. Create OAuth client ID:
   - Application type: Web application
   - Name: "Greener App Web Client"
   - Authorized JavaScript origins: Add your app URLs (include localhost for testing)
   - Authorized redirect URIs: Add your app redirect URLs
6. Take note of your Client ID and Client Secret

## Step 4: Configure Azure Function App

1. Go to your Function App in Azure Portal
2. Click "Configuration" in the left menu
3. Add the following application settings:
   - COSMOS_ENDPOINT: Your Cosmos DB endpoint URL
   - COSMOS_KEY: Your Cosmos DB primary key
   - GOOGLE_CLIENT_ID: Your Google OAuth client ID
   - AZURE_STORAGE_CONNECTION_STRING: Your Storage Account connection string
4. Click "Save"

5. Click "CORS" in the left menu
6. Add allowed origins including your app domains and localhost for development
7. Check "Enable Access-Control-Allow-Credentials"
8. Click "Save"

## Step 5: Create Azure Functions

### Option 1: Using VS Code

1. Open VS Code
2. Install Azure Functions extension if not already installed
3. Click on the Azure icon in the activity bar
4. Sign in to your Azure account
5. Create a new project or open existing one
6. For each function in the guide, create a new function:
   - Right-click on your Function App and select "Create Function..."
   - Choose HTTP trigger template
   - Name your function (e.g., "getProducts", "createChatRoom", etc.)
   - Set Authorization level to "Anonymous" (we'll handle auth in our code)
7. Copy the function code provided in the implementation guide
8. Deploy to Azure by right-clicking on your Function App and selecting "Deploy to Function App..."

### Option 2: Azure Portal

1. Go to your Function App in Azure Portal
2. Click "Functions" in the left menu
3. Click "Add" to create a new function
4. Choose "HTTP trigger" template
5. Name your function (e.g., "getProducts")
6. Set Authorization level to "Anonymous"
7. Click "Add"
8. Go to the function and click "Code + Test"
9. Replace the default code with the function code from the implementation guide
10. Click "Save"
11. Repeat for each function

## Step 6: Test Your Azure Functions

1. Use tools like Postman or Insomnia to test each API endpoint
2. For authenticated endpoints:
   - Obtain a valid Google ID token
   - Include it in the Authorization header: `Bearer [your-token]`
3. Test each CRUD operation:
   - Get all products
   - Get product by ID
   - Create product
   - Toggle wishlist
   - Get user profile
   - Update user profile
   - Create chat room
   - Get user conversations
   - Send message

## Step 7: Connect Your React Native App

1. Update the `marketplaceApi.js` file to use your Azure Function URLs:

```javascript
// Update this in services/marketplaceApi.js
const API_BASE_URL = 'https://your-function-app-name.azurewebsites.net/api';
```

2. Ensure your Google Sign-In implementation stores the ID token globally:

```javascript
// After successful Google Sign-In
global.googleAuthToken = authentication.idToken;
```

3. Update your API calls to include the authorization header:

```javascript
const headers = {
  'Content-Type': 'application/json',
};

if (global.googleAuthToken) {
  headers['Authorization'] = `Bearer ${global.googleAuthToken}`;
}

// Use these headers in your fetch calls
```

## Step 8: Implement Azure Maps (Optional)

To enable the map view functionality:

1. Create an Azure Maps account in your Azure Portal
2. Go to your Maps account and get the primary key
3. Add the key to your Function App settings:
   - AZURE_MAPS_SUBSCRIPTION_KEY: Your Azure Maps primary key
4. Create a new Azure Function to handle geolocation:

```javascript
// geocode.js
const axios = require('axios');

module.exports = async function (context, req) {
  const { address } = req.query;
  
  if (!address) {
    context.res = {
      status: 400,
      body: { message: 'Address is required' }
    };
    return;
  }
  
  try {
    const response = await axios.get(`https://atlas.microsoft.com/search/address/json`, {
      params: {
        'subscription-key': process.env.AZURE_MAPS_SUBSCRIPTION_KEY,
        'api-version': '1.0',
        'query': address
      }
    });
    
    const results = response.data.results;
    if (results && results.length > 0) {
      context.res = {
        status: 200,
        body: {
          latitude: results[0].position.lat,
          longitude: results[0].position.lon,
          address: results[0].address
        }
      };
    } else {
      context.res = {
        status: 404,
        body: { message: 'No results found for the address' }
      };
    }
  } catch (error) {
    context.log.error('Error geocoding address:', error);
    context.res = {
      status: 500,
      body: { message: 'Error geocoding address' }
    };
  }
};
```

5. Update your React Native code to call this function when saving plant locations

## Troubleshooting

### Common Issues and Solutions

1. **CORS errors**:
   - Double-check your CORS settings in the Function App
   - Ensure all your app domains are added to allowed origins
   - Make sure you have "Access-Control-Allow-Credentials" enabled

2. **Authentication errors**:
   - Verify your Google client ID is correct in application settings
   - Check that the token being sent is valid and not expired
   - Ensure your app is requesting the correct OAuth scopes

3. **Database connection errors**:
   - Verify your Cosmos DB endpoint and key are correct
   - Check that your Cosmos DB containers have the correct partition keys
   - Make sure your Function App has network access to Cosmos DB

4. **Image upload issues**:
   - Verify your Storage account connection string
   - Check that the containers exist and have public access
   - Make sure you're properly handling base64 encoding/decoding

5. **Function timeouts**:
   - Consider optimizing database queries for better performance
   - Add indexes to frequently queried fields in Cosmos DB
   - For large operations, consider using Durable Functions

If you encounter persistent issues, check your Function App logs in the Azure Portal for detailed error messages.