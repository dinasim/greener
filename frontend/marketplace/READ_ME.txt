## 4. Deployment and Testing

### 4.1 Deploy Azure Functions

After creating all your functions locally, deploy them to Azure:

```bash
# Make sure you're in the function app project directory
cd greener-marketplace-api

# Login to Azure if you haven't already
az login

# Set the subscription to use (if you have multiple)
az account set --subscription "Your-Subscription-Name"

# Deploy to your Azure Function App
func azure functionapp publish greener-marketplace-api
```

### 4.2 Testing Strategy

After deployment, follow these steps to test your backend:

#### 4.2.1 Testing Messaging Functionality

1. **Test Creating a Chat Room**:
   - Login to the app with User A
   - Navigate to a plant listing created by User B
   - Click "Contact Seller" and send a message
   - Verify the message is sent successfully
   - Check in Cosmos DB that a chat room was created

2. **Test Message Listing**:
   - Login as either User A or User B
   - Navigate to the Messages tab
   - Verify the conversation appears in the list
   - Verify the latest message and user details are displayed correctly

3. **Test Sending Messages in Existing Chat**:
   - Open an existing conversation
   - Send a new message
   - Verify the message appears in the chat
   - Verify the message is saved in Cosmos DB

4. **Test Read/Unread Status**:
   - Login as User A and send a message to User B
   - Logout and login as User B
   - Verify the conversation shows an unread count
   - Open the conversation and verify messages are marked as read
   - Verify in Cosmos DB that message read status has updated

#### 4.2.2 Testing Azure Maps Integration

1. **Test Geocoding**:
   - When creating a plant listing, enter an address in Israel
   - Submit the form and verify coordinates are generated
   - Verify in the database that latitude and longitude are saved

2. **Test Map View**:
   - On the marketplace screen, switch to map view
   - Verify the map loads correctly with Azure Maps
   - Verify plant markers appear at their correct locations
   - Click on a marker and verify the popup shows plant details
   - Verify clicking on a plant in the popup navigates to its detail page

3. **Test Map Filtering**:
   - Apply category filters while in map view
   - Verify only plants in the selected category appear on the map
   - Apply price filters and verify map updates accordingly
   - Search for a plant and verify only matching plants appear on the map

#### 4.2.3 Testing Edge Cases

1. **Test No Location Data**:
   - Create a plant listing without location data
   - Verify it appears in list/grid view
   - Switch to map view and verify it doesn't create errors

2. **Test Invalid Addresses**:
   - Try geocoding an invalid or non-existent address
   - Verify the system handles the error gracefully

3. **Test High Message Volume**:
   - Send many messages in a single conversation
   - Verify the messaging UI remains responsive
   - Verify scrolling and loading of old messages works correctly

4. **Test Offline Behavior**:
   - Put the device in airplane mode
   - Try to send a message
   - Verify appropriate error messages are shown
   - Test reconnecting and verify functionality returns

### 4.3 Monitoring and Operations

After deployment, set up monitoring for your Azure resources:

1. **Set up Azure Application Insights** (optional):
   ```bash
   # Create Application Insights resource
   az monitor app-insights component create --app greener-monitoring --resource-group greener-app-rg --location westeurope
   
   # Get the instrumentation key
   INSTRUMENTATION_KEY=$(az monitor app-insights component show --app greener-monitoring --resource-group greener-app-rg --query instrumentationKey -o tsv)
   
   # Add instrumentation key to Function App settings
   az functionapp config appsettings set --name greener-marketplace-api --resource-group greener-app-rg --settings "APPINSIGHTS_INSTRUMENTATIONKEY=$INSTRUMENTATION_KEY"
   ```

2. **Set up Azure Monitor Alerts** for critical issues:
   - Configure alerts for high function error rates
   - Set up alerts for storage capacity issues
   - Configure notifications for Cosmos DB throughput limits

3. **Implement Logging** in your Azure Functions:
   ```javascript
   // Example of enhanced logging in a function
   module.exports = async function (context, req) {
     const startTime = new Date();
     const correlationId = req.headers['x-correlation-id'] || uuidv4();
     
     context.log.info({
       message: 'Function started',
       functionName: context.executionContext.functionName,
       invocationId: context.invocationId,
       correlationId: correlationId,
       endpoint: req.url,
       method: req.method
     });
     
     try {
       // Function logic here...
       
       const endTime = new Date();
       const duration = endTime - startTime;
       
       context.log.info({
         message: 'Function completed successfully',
         functionName: context.executionContext.functionName,
         invocationId: context.invocationId,
         correlationId: correlationId,
         duration: duration
       });
     } catch (error) {
       context.log.error({
         message: 'Function error',
         functionName: context.executionContext.functionName,
         invocationId: context.invocationId,
         correlationId: correlationId,
         error: error.message,
         stack: error.stack
       });
       
       throw error;
     }
   };
   ```

## 5. Security Considerations

### 5.1 Azure Key Vault for Secrets (optional)

While not strictly required, you can enhance security by using Azure Key Vault:

```bash
# Create a Key Vault
az keyvault create --name greener-keyvault --resource-group greener-app-rg --location westeurope

# Add secrets
az keyvault secret set --vault-name greener-keyvault --name "CosmosDbKey" --value "your-cosmos-db-key"
az keyvault secret set --vault-name greener-keyvault --name "JwtSecret" --value "your-jwt-secret"
az keyvault secret set --vault-name greener-keyvault --name "AzureMapsKey" --value "your-azure-maps-key"

# Configure Function App to access Key Vault
az functionapp identity assign --name greener-marketplace-api --resource-group greener-app-rg

# Get the managed identity ID
IDENTITY_ID=$(az functionapp identity show --name greener-marketplace-api --resource-group greener-app-rg --query principalId -o tsv)

# Grant access to Key Vault
az keyvault set-policy --name greener-keyvault --object-id $IDENTITY_ID --secret-permissions get list
```

### 5.2 Authentication and Authorization

Ensure your Azure resources have appropriate access controls:

1. **IP Restrictions for Function App**:
   ```bash
   # Allow only your app's IP addresses if you have a fixed set
   az functionapp config access-restriction add --name greener-marketplace-api \
     --resource-group greener-app-rg \
     --rule-name "AllowMyApp" \
     --action Allow \
     --ip-address "your-app-ip-range" \
     --priority 100
   ```

2. **Implement IP-based access restrictions for Cosmos DB** for increased security.

3. **Configure CORS restrictions** to allow only your app domains.

## 6. Performance Optimization

### 6.1 Cosmos DB Optimization

1. **Optimize Partition Keys**:
   - Ensure your partition keys distribute load evenly
   - Use composite partition keys for better distribution if needed

2. **Create Secondary Indexes** for frequent queries:
   ```javascript
   // When creating a Cosmos DB container, add indexing policy:
   const { resource: usersContainer } = await database.containers.createIfNotExists({
     id: 'users',
     partitionKey: { paths: ['/email'] },
     indexingPolicy: {
       includedPaths: [
         { path: '/name/*' },
         { path: '/createdSells/*' },
         { path: '/chatRooms/*' }
       ],
       excludedPaths: [
         { path: '/avatar/*' }, // Exclude large fields from indexing
         { path: '/"_etag"/?' }
       ]
     }
   });
   ```

3. **Use Serverless Capacity Mode** during development, and switch to provisioned throughput for production.

### 6.2 Azure Function Performance

1. **Optimize Cold Start Times**:
   - Keep dependencies minimal
   - Use dependency bundling
   - Consider premium plan for critical functions

2. **Implement Proper Caching**:
   - Cache frequently accessed data
   - Use output bindings for better performance

3. **Use Durable Functions** for complex workflows that span multiple function invocations.

## 7. Future Enhancements

### 7.1 Real-time Messaging with SignalR

For real-time chat functionality, integrate Azure SignalR Service:

```bash
# Create SignalR Service
az signalr create --name greener-signalr --resource-group greener-app-rg --sku Free_F1 --service-mode Serverless
```

### 7.2 Image Processing Automation

Use Azure Functions and Azure Event Grid to automatically process plant images:

1. Set up Azure Logic App to identify plant species using Azure Cognitive Services
2. Automatically tag plants based on# Azure Implementation Guide for Greener App Marketplace

## Overview
This guide details how to implement the Azure backend for the Greener plant marketplace app, with a focus on the messaging functionality and Azure Maps integration for Israel. The implementation uses serverless Azure Functions, Cosmos DB for data storage, and Azure Storage for image management.

## 1. Azure Resources Setup

### 1.1 Create Resource Group

```bash
# Login to Azure if not already logged in
az login

# Create a resource group for all Greener app resources
az group create --name greener-app-rg --location westeurope
```

### 1.2 Create Cosmos DB Account

```bash
# Create Cosmos DB account
az cosmosdb create --name greener-marketplace-db --resource-group greener-app-rg --kind GlobalDocumentDB --locations regionName=westeurope

# Create the database
az cosmosdb sql database create --account-name greener-marketplace-db --resource-group greener-app-rg --name greenerdb

# Create containers with appropriate partition keys
az cosmosdb sql container create --account-name greener-marketplace-db --database-name greenerdb --name products --partition-key-path "/category" --throughput 400
az cosmosdb sql container create --account-name greener-marketplace-db --database-name greenerdb --name users --partition-key-path "/email" --throughput 400
az cosmosdb sql container create --account-name greener-marketplace-db --database-name greenerdb --name chatrooms --partition-key-path "/id" --throughput 400
```

### 1.3 Create Storage Account for Images

```bash
# Create storage account 
az storage account create --name greenerstorage --resource-group greener-app-rg --location westeurope --sku Standard_LRS --kind StorageV2

# Create containers for images
az storage container create --name plant-images --account-name greenerstorage --public-access blob
az storage container create --name user-avatars --account-name greenerstorage --public-access blob
```

### 1.4 Create Azure Maps Account (Israel Focus)

```bash
# Create Azure Maps account
az maps account create --name greener-maps --resource-group greener-app-rg --sku S0 --accept-tos

# Get the primary key (for later configuration)
MAPS_KEY=$(az maps account keys list --name greener-maps --resource-group greener-app-rg --query primaryKey -o tsv)
echo $MAPS_KEY
```

### 1.5 Create Function App

```bash
# Create storage account for Function App (separate from the one for images)
az storage account create --name greenerfuncstorage --resource-group greener-app-rg --location westeurope --sku Standard_LRS

# Create Function App with Node.js runtime
az functionapp create --name greener-marketplace-api --resource-group greener-app-rg --storage-account greenerfuncstorage --consumption-plan-location westeurope --runtime node --runtime-version 16 --functions-version 4
```

### 1.6 Configure Function App Settings

```bash
# Set application settings for the Function App
az functionapp config appsettings set --name greener-marketplace-api --resource-group greener-app-rg --settings \
  "COSMOS_ENDPOINT=https://greener-marketplace-db.documents.azure.com:443/" \
  "COSMOS_KEY=YOUR_COSMOS_DB_PRIMARY_KEY" \
  "STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=https;AccountName=greenerstorage;AccountKey=YOUR_STORAGE_ACCOUNT_KEY;EndpointSuffix=core.windows.net" \
  "JWT_SECRET=YOUR_SECURE_JWT_SECRET" \
  "AZURE_MAPS_SUBSCRIPTION_KEY=$MAPS_KEY"

# Configure CORS for React Native app
az functionapp cors add --name greener-marketplace-api --resource-group greener-app-rg --allowed-origins \
  "http://localhost:3000" \
  "http://localhost:19006" \
  "exp://localhost:19000" \
  "https://your-production-domain.com"
```

## 2. Backend Implementation

### 2.1 Create Azure Functions Project Structure

Set up your local development environment:

```bash
# Install Azure Functions Core Tools if not already installed
npm install -g azure-functions-core-tools@4

# Create a folder for your Azure Functions project
mkdir greener-marketplace-api
cd greener-marketplace-api

# Initialize Azure Functions project
func init --worker-runtime node

# Install dependencies
npm init -y
npm install @azure/cosmos @azure/storage-blob bcrypt jsonwebtoken axios moment uuid
```

### 2.2 Create Shared Utility Files

These files will be used across your different Azure Functions.

#### shared/cosmosClient.js

```javascript
const { CosmosClient }

### 3.3 Update MessagesScreen to Use the Azure Backend

Let's update the `MessagesScreen.js` file to use our Azure messaging API:

```javascript
// screens/MessagesScreen.js
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Image,
  ActivityIndicator,
  Alert,
  SafeAreaView,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';

// Import MarketplaceHeader
import MarketplaceHeader from '../components/MarketplaceHeader';

// Import services - note we're now using the Azure backend functions
import {
  fetchConversations,
  fetchMessages,
  sendMessage,
  startConversation
} from '../services/marketplaceApi';

const MessagesScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  
  // Get parameters if passed for starting a new conversation
  const sellerId = route.params?.sellerId;
  const plantId = route.params?.plantId;
  const plantName = route.params?.plantName;
  
  // State for conversations and messaging
  const [activeTab, setActiveTab] = useState(sellerId ? 'chat' : 'conversations');
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState(null);
  
  // Ref for scrolling to bottom of messages
  const flatListRef = useRef(null);
  
  // Load conversations on mount
  useEffect(() => {
    loadConversations();
  }, []);
  
  // Load messages if conversation is selected
  useEffect(() => {
    if (selectedConversation) {
      loadMessages(selectedConversation.id);
    }
  }, [selectedConversation]);
  
  // Helper functions to load data
  const loadConversations = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Fetch conversations from API
      const data = await fetchConversations();
      setConversations(data);
      
      setIsLoading(false);
    } catch (err) {
      setError('Failed to load conversations. Please try again later.');
      setIsLoading(false);
      console.error('Error fetching conversations:', err);
    }
  };
  
  const loadMessages = async (conversationId) => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Fetch messages for this conversation
      const data = await fetchMessages(conversationId);
      
      setMessages(data.messages || []);
      setIsLoading(false);
      
      // Scroll to bottom of messages
      setTimeout(() => {
        if (flatListRef.current) {
          flatListRef.current.scrollToEnd({ animated: false });
        }
      }, 100);
    } catch (err) {
      setError('Failed to load messages. Please try again later.');
      setIsLoading(false);
      console.error('Error fetching messages:', err);
    }
  };
  
  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;
    
    // Create a unique ID for this message attempt
    const tempId = 'temp-' + Date.now();
    
    try {
      setIsSending(true);
      
      // Add message to state optimistically
      const tempMessage = {
        id: tempId,
        text: newMessage,
        senderId: 'currentUser',
        timestamp: new Date().toISOString(),
        pending: true // Mark as pending for UI indication
      };
      
      // Save the message text before clearing input
      const messageText = newMessage;
      
      // Update UI immediately
      setMessages(prevMessages => [...prevMessages, tempMessage]);
      setNewMessage('');
      
      // Scroll to bottom of messages
      setTimeout(() => {
        if (flatListRef.current) {
          flatListRef.current.scrollToEnd({ animated: true });
        }
      }, 100);
      
      // Send the message to the backend
      if (selectedConversation) {
        // Existing conversation
        await sendMessage(selectedConversation.id, messageText);
      } else if (sellerId && plantId) {
        // New conversation
        const result = await startConversation(sellerId, messageText, plantId);
        
        // Set selected conversation with the result
        setSelectedConversation({
          id: result.messageId,
          otherUserName: 'Seller', // Will be updated when messages are loaded
          plantName: plantName
        });
        
        // Refresh the conversations list
        await loadConversations();
      }
      
      setIsSending(false);
      
      // Update the message to remove pending status or refresh messages
      if (selectedConversation) {
        await loadMessages(selectedConversation.id);
      } else {
        // Update the message to remove pending status
        setMessages(prevMessages => 
          prevMessages.map(msg => 
            msg.id === tempId 
              ? { ...msg, pending: false } 
              : msg
          )
        );
      }
    } catch (err) {
      console.error('Error sending message:', err);
      setIsSending(false);
      
      // Remove optimistic message on error
      setMessages(prevMessages => 
        prevMessages.filter(m => m.id !== tempId)
      );
      
      // Show error to user
      Alert.alert(
        'Error',
        'Failed to send message. Please try again.',
        [{ text: 'OK' }]
      );
    }
  };
  
  const handleSelectConversation = (conversation) => {
    setSelectedConversation(conversation);
    setActiveTab('chat');
  };
  
  // Format timestamps
  const formatTimestamp = (timestamp) => {
    if (!timestamp) return '';
    
    const date = new Date(timestamp);
    const now = new Date();
    
    // If it's today, just show the time
    if (date.toDateString() === now.toDateString()) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    
    // If it's this year, show month and day
    if (date.getFullYear() === now.getFullYear()) {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
    
    // Otherwise show the full date
    return date.toLocaleDateString([], { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };
  
  // Rest of the component implementation remains the same
  // ...

  return (
    <SafeAreaView style={styles.container}>
      {/* Custom Header */}
      <MarketplaceHeader
        title="Messages"
        showBackButton={true}
        showNotifications={false}
      />
      
      {/* Tab buttons and content */}
      {/* ... */}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  // Styles remain the same
});

export default MessagesScreen;
```

### 3.4 Implement Map Integration for Plant Locations

Update or create the `AzureMapView.js` component to integrate with Azure Maps:

```javascript
// components/AzureMapView.js
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, Text, ActivityIndicator, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import { MaterialIcons } from '@expo/vector-icons';
import config from '../services/config';

const AzureMapView = ({ products, onSelectProduct, centerCoordinates, zoom = 8 }) => {
  const webViewRef = useRef(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  
  // Default center coordinates if not provided
  const center = centerCoordinates || config.azureMaps.centerCoordinates;
  
  // Create HTML for the map
  const mapHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Azure Maps</title>
      
      <!-- Azure Maps CSS -->
      <link rel="stylesheet" href="https://atlas.microsoft.com/sdk/javascript/mapcontrol/2/atlas.min.css" />
      
      <!-- Azure Maps Script -->
      <script src="https://atlas.microsoft.com/sdk/javascript/mapcontrol/2/atlas.min.js"></script>
      
      <style>
        body { margin: 0; padding: 0; overflow: hidden; }
        #map { width: 100%; height: 100%; }
        .map-pin { cursor: pointer; }
        .pin-title { font-weight: bold; font-size: 12px; }
        .pin-price { color: #4CAF50; font-weight: bold; font-size: 12px; }
        .popup-content { padding: 5px; }
        .popup-image { width: 100px; height: 100px; object-fit: cover; margin-right: 10px; }
        .popup-container { display: flex; }
        .popup-details { flex: 1; }
      </style>
    </head>
    <body>
      <div id="map"></div>
      
      <script>
        // Initialize map
        let map, datasource, popup;
        
        function initMap() {
          // Initialize map
          map = new atlas.Map('map', {
            center: [${center.longitude}, ${center.latitude}],
            zoom: ${zoom},
            language: 'he-IL',
            view: 'Auto',
            authOptions: {
              authType: 'subscriptionKey',
              subscriptionKey: '${config.azureMaps.subscriptionKey}'
            }
          });
          
          // Wait until the map resources are ready
          map.events.add('ready', function() {
            // Create a popup but leave it closed
            popup = new atlas.Popup();
            
            // Create a data source and add it to the map
            datasource = new atlas.source.DataSource();
            map.sources.add(datasource);
            
            // Create a symbol layer to render points
            const plantLayer = new atlas.layer.SymbolLayer(datasource, null, {
              iconOptions: {
                image: 'marker-green',
                anchor: 'bottom',
                size: 0.8,
                allowOverlap: true
              }
            });
            
            map.layers.add(plantLayer);
            
            // Add a click event to the layer to show popups
            map.events.add('click', plantLayer, onPlantClick);
            
            // Notify React Native that the map is ready
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'MAP_READY'
            }));
          });
        }
        
        // Handle plant marker clicks
        function onPlantClick(e) {
          if (e.shapes && e.shapes.length > 0) {
            const properties = e.shapes[0].getProperties();
            
            // Show popup with plant info
            popup.setOptions({
              position: e.shapes[0].getCoordinates(),
              content: createPopupContent(properties),
              pixelOffset: [0, -30]
            });
            
            popup.open(map);
            
            // Notify React Native
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'PIN_CLICKED',
              productId: properties.id
            }));
          }
        }
        
        // Create popup HTML content
        function createPopupContent(properties) {
          const container = document.createElement('div');
          container.className = 'popup-content';
          
          const flexContainer = document.createElement('div');
          flexContainer.className = 'popup-container';
          
          // Image
          if (properties.image) {
            const img = document.createElement('img');
            img.className = 'popup-image';
            img.src = properties.image;
            img.onerror = () => { img.src = 'https://via.placeholder.com/100?text=Plant'; };
            flexContainer.appendChild(img);
          }
          
          // Details container
          const details = document.createElement('div');
          details.className = 'popup-details';
          
          // Title
          const title = document.createElement('div');
          title.className = 'pin-title';
          title.textContent = properties.title || 'Plant';
          details.appendChild(title);
          
          // Price
          const price = document.createElement('div');
          price.className = 'pin-price';
          price.textContent = ' = require('@azure/cosmos');

// Get connection details from environment variables
const endpoint = process.env.COSMOS_ENDPOINT;
const key = process.env.COSMOS_KEY;
const client = new CosmosClient({ endpoint, key });

// Initialize database and containers
const database = client.database('greenerdb');
const productsContainer = database.container('products');
const usersContainer = database.container('users');
const chatRoomsContainer = database.container('chatrooms');

module.exports = {
  client,
  database,
  productsContainer,
  usersContainer,
  chatRoomsContainer
};
```

#### shared/jwtAuth.js

```javascript
const jwt = require('jsonwebtoken');
const { usersContainer } = require('./cosmosClient');

// Generate JWT token for authenticated users
const generateToken = (user) => {
  const payload = {
    _id: user.id,
    email: user.email,
    phoneNumber: user.phoneNumber,
    createdSells: user.createdSells?.length || 0,
    avatar: user.avatar
  };
  
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '15d' });
};

// Validate JWT token from request
const validateToken = async (req) => {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }
    
    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Verify user exists in database
    const { resource: user } = await usersContainer.item(decoded._id).read();
    if (!user) {
      return null;
    }
    
    return decoded;
  } catch (error) {
    console.error('JWT Validation Error:', error);
    return null;
  }
};

module.exports = {
  generateToken,
  validateToken
};
```

#### shared/storageHelper.js

```javascript
const { BlobServiceClient } = require('@azure/storage-blob');
const { v4: uuidv4 } = require('uuid');

// Create the BlobServiceClient object
const blobServiceClient = BlobServiceClient.fromConnectionString(
  process.env.STORAGE_CONNECTION_STRING
);

// Helper function to upload Base64 image
const uploadBase64Image = async (base64Image, containerName) => {
  try {
    // Get reference to container
    const containerClient = blobServiceClient.getContainerClient(containerName);
    
    // Extract image data from base64 string
    const matches = base64Image.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    
    if (!matches || matches.length !== 3) {
      throw new Error('Invalid base64 string');
    }
    
    const imageBuffer = Buffer.from(matches[2], 'base64');
    const contentType = matches[1];
    const fileExtension = contentType.split('/')[1] || 'jpg';
    const blobName = `${uuidv4()}.${fileExtension}`;
    
    // Get reference to block blob
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);
    
    // Upload data to blob
    await blockBlobClient.upload(imageBuffer, imageBuffer.length, {
      blobHTTPHeaders: { blobContentType: contentType }
    });
    
    // Return the URL of the uploaded blob
    return blockBlobClient.url;
  } catch (error) {
    console.error('Error uploading image:', error);
    throw error;
  }
};

module.exports = {
  uploadBase64Image
};
```

### 2.3 Implement Azure Functions for Messaging

#### Create Message Function

```bash
func new --name messages --template "HTTP trigger" --authlevel "anonymous"
```

#### messages/function.json

```json
{
  "bindings": [
    {
      "authLevel": "anonymous",
      "type": "httpTrigger",
      "direction": "in",
      "name": "req",
      "methods": [
        "get",
        "post"
      ],
      "route": "messages/{*route}"
    },
    {
      "type": "http",
      "direction": "out",
      "name": "res"
    }
  ]
}
```

#### messages/index.js

```javascript
const { chatRoomsContainer, usersContainer, productsContainer } = require('../shared/cosmosClient');
const { validateToken } = require('../shared/jwtAuth');
const { v4: uuidv4 } = require('uuid');

module.exports = async function (context, req) {
  context.log('Processing messages request');
  
  try {
    // Check authentication for all messages endpoints
    const user = await validateToken(req);
    if (!user) {
      return respondWithError(context, 'Unauthorized', 401);
    }
    
    const method = req.method.toLowerCase();
    const route = req.params.route?.toLowerCase() || '';
    
    // Route to appropriate handler based on the endpoint
    if (method === 'post' && route === 'createchatroom') {
      await handleCreateChatRoom(context, req, user);
    }
    else if (method === 'get' && route === 'getuserconversations') {
      await handleGetUserConversations(context, req, user);
    }
    else if (method === 'post' && route === 'sendmessage') {
      await handleSendMessage(context, req, user);
    }
    else if (method === 'get' && route.startsWith('getmessages/')) {
      const chatId = route.split('/')[1];
      await handleGetMessages(context, chatId, user);
    }
    else {
      return respondWithError(context, 'Method not supported', 405);
    }
  } catch (error) {
    context.log.error('Messages Error:', error);
    return respondWithError(context, error.message, error.status || 500);
  }
};

/**
 * Creates a new chat room or uses existing one, and adds the first message
 */
async function handleCreateChatRoom(context, req, user) {
  const { message, receiver, plantId } = req.body;
  
  if (!message || !receiver) {
    return respondWithError(context, 'Message and receiver are required', 400);
  }
  
  try {
    // Check if chat room already exists for this plant between these users
    const { resources: existingChatRooms } = await chatRoomsContainer.items
      .query({
        query: "SELECT * FROM c WHERE ((c.buyer = @userId AND c.seller = @receiverId) OR (c.buyer = @receiverId AND c.seller = @userId)) AND (c.plantId = @plantId OR (c.plantId = null AND @plantId = null))",
        parameters: [
          { name: "@userId", value: user._id },
          { name: "@receiverId", value: receiver },
          { name: "@plantId", value: plantId || null }
        ]
      })
      .fetchAll();
    
    let chatRoom;
    let plantInfo = null;
    
    // If plantId is provided, get plant information to include in chat
    if (plantId) {
      try {
        const { resource: plant } = await productsContainer.item(plantId).read();
        if (plant) {
          plantInfo = {
            id: plant.id,
            title: plant.title || plant.name,
            image: plant.image
          };
        }
      } catch (err) {
        context.log.warn(`Plant with ID ${plantId} not found`);
      }
    }
    
    if (existingChatRooms.length > 0) {
      // Use existing chat room
      chatRoom = existingChatRooms[0];
      
      // Update plant info if not already set
      if (plantId && !chatRoom.plantId && plantInfo) {
        await chatRoomsContainer.item(chatRoom.id).patch([
          { op: "add", path: "/plantId", value: plantId },
          { op: "add", path: "/plantName", value: plantInfo.title }
        ]);
      }
    } else {
      // Create new chat room
      const newChatRoom = {
        id: uuidv4(),
        buyer: user._id,
        seller: receiver,
        conversation: [],
        createdAt: new Date().toISOString()
      };
      
      // Add plant info if available
      if (plantId && plantInfo) {
        newChatRoom.plantId = plantId;
        newChatRoom.plantName = plantInfo.title;
        newChatRoom.plantImage = plantInfo.image;
      }
      
      const { resource: createdChatRoom } = await chatRoomsContainer.items.create(newChatRoom);
      chatRoom = createdChatRoom;
      
      // Add chat room to both users' chatRooms array
      await usersContainer.item(user._id).patch([
        { op: "add", path: "/chatRooms/-", value: chatRoom.id }
      ]);
      
      await usersContainer.item(receiver).patch([
        { op: "add", path: "/chatRooms/-", value: chatRoom.id }
      ]);
    }
    
    // Add the message to the conversation
    await chatRoomsContainer.item(chatRoom.id).patch([
      { 
        op: "add", 
        path: "/conversation/-", 
        value: { 
          id: uuidv4(),
          senderId: user._id, 
          message,
          timestamp: new Date().toISOString(),
          read: false
        } 
      }
    ]);
    
    context.res = {
      status: 200,
      body: { messageId: chatRoom.id }
    };
  } catch (error) {
    context.log.error('Error creating chat room:', error);
    return respondWithError(context, 'Error creating chat room', 500);
  }
}

/**
 * Gets all conversations for the current user
 */
async function handleGetUserConversations(context, req, user) {
  try {
    // Get all chatrooms where user is involved
    const { resources: allChats } = await chatRoomsContainer.items
      .query({
        query: "SELECT * FROM c WHERE c.buyer = @userId OR c.seller = @userId ORDER BY c._ts DESC",
        parameters: [{ name: "@userId", value: user._id }]
      })
      .fetchAll();
    
    // Format and populate conversations with other user details
    const conversations = await Promise.all(allChats.map(async (chat) => {
      // Determine if current user is buyer or seller
      const isBuyer = chat.buyer === user._id;
      const otherUserId = isBuyer ? chat.seller : chat.buyer;
      
      // Get other user's info
      const { resource: otherUser } = await usersContainer.item(otherUserId).read();
      
      if (!otherUser) {
        // Skip if other user not found
        return null;
      }
      
      // Get latest message
      const lastMessage = chat.conversation && chat.conversation.length > 0 
        ? chat.conversation[chat.conversation.length - 1]
        : null;
      
      // Count unread messages
      const unreadCount = chat.conversation ? 
        chat.conversation.filter(msg => 
          msg.senderId !== user._id && 
          (msg.read === false || msg.read === undefined)
        ).length : 0;
      
      return {
        id: chat.id,
        otherUserName: otherUser.name,
        otherUserAvatar: otherUser.avatar || 'https://res.cloudinary.com/your-cloud-name/image/upload/v1617358367/defaultAvatar_wnoogh.png',
        lastMessage: lastMessage ? lastMessage.message : "",
        lastMessageTimestamp: lastMessage ? lastMessage.timestamp : chat.createdAt,
        plantName: chat.plantName || "Plant discussion",
        plantId: chat.plantId || null,
        plantImage: chat.plantImage || null,
        sellerId: isBuyer ? chat.seller : null,
        unreadCount: unreadCount
      };
    }));
    
    // Filter out null entries (if any users were not found)
    const validConversations = conversations.filter(conv => conv !== null);
    
    context.res = {
      status: 200,
      body: validConversations
    };
  } catch (error) {
    context.log.error('Error getting conversations:', error);
    return respondWithError(context, 'Error getting conversations', 500);
  }
}

/**
 * Adds a message to an existing chat room
 */
async function handleSendMessage(context, req, user) {
  const { chatId, message } = req.body;
  
  if (!chatId || !message) {
    return respondWithError(context, 'Chat ID and message are required', 400);
  }
  
  try {
    // First check if the user is part of this chat
    const { resource: chatRoom } = await chatRoomsContainer.item(chatId).read();
    
    if (!chatRoom) {
      return respondWithError(context, 'Chat not found', 404);
    }
    
    if (chatRoom.buyer !== user._id && chatRoom.seller !== user._id) {
      return respondWithError(context, 'Not authorized to send messages in this chat', 403);
    }
    
    // Add message to chat room
    await chatRoomsContainer.item(chatId).patch([
      { 
        op: "add", 
        path: "/conversation/-", 
        value: { 
          id: uuidv4(),
          senderId: user._id, 
          message,
          timestamp: new Date().toISOString(),
          read: false
        } 
      }
    ]);
    
    context.res = {
      status: 200,
      body: { sender: user._id }
    };
  } catch (error) {
    context.log.error('Error sending message:', error);
    return respondWithError(context, 'Error sending message', 500);
  }
}

/**
 * Gets messages for a specific chat room
 */
async function handleGetMessages(context, chatId, user) {
  try {
    if (!chatId) {
      return respondWithError(context, 'Chat ID is required', 400);
    }
    
    // Get chat room with all messages
    const { resource: chatRoom } = await chatRoomsContainer.item(chatId).read();
    
    if (!chatRoom) {
      return respondWithError(context, 'Chat not found', 404);
    }
    
    // Check if user is part of this chat
    if (chatRoom.buyer !== user._id && chatRoom.seller !== user._id) {
      return respondWithError(context, 'Not authorized to view this chat', 403);
    }
    
    // Mark messages from other user as read
    const otherUserId = chatRoom.buyer === user._id ? chatRoom.seller : chatRoom.buyer;
    
    // Update read status of messages
    const messagesToUpdate = [];
    
    if (chatRoom.conversation) {
      chatRoom.conversation.forEach((msg, index) => {
        if (msg.senderId === otherUserId && (msg.read === false || msg.read === undefined)) {
          messagesToUpdate.push({
            op: "replace",
            path: `/conversation/${index}/read`,
            value: true
          });
        }
      });
    }
    
    // If there are unread messages, update them
    if (messagesToUpdate.length > 0) {
      await chatRoomsContainer.item(chatId).patch(messagesToUpdate);
    }
    
    // Get information about the other user
    const { resource: otherUser } = await usersContainer.item(otherUserId).read();
    
    // Get plant information if it exists
    let plantInfo = null;
    if (chatRoom.plantId) {
      try {
        const { resource: plant } = await productsContainer.item(chatRoom.plantId).read();
        if (plant) {
          plantInfo = {
            id: plant.id,
            title: plant.title || plant.name,
            image: plant.image,
            price: plant.price,
            category: plant.category
          };
        }
      } catch (err) {
        context.log.warn(`Plant with ID ${chatRoom.plantId} not found`);
      }
    }
    
    // Format response
    const response = {
      id: chatRoom.id,
      messages: chatRoom.conversation || [],
      otherUser: {
        id: otherUser.id,
        name: otherUser.name,
        avatar: otherUser.avatar
      },
      plant: plantInfo,
      isBuyer: chatRoom.buyer === user._id
    };
    
    context.res = {
      status: 200,
      body: response
    };
  } catch (error) {
    context.log.error('Error getting messages:', error);
    return respondWithError(context, 'Error getting messages', 500);
  }
}

function respondWithError(context, message, status = 500) {
  context.res = {
    status: status,
    body: { message: message },
    headers: {
      'Content-Type': 'application/json'
    }
  };
}
```

### 2.4 Implement Azure Maps Integration

Create a new function for Azure Maps geocoding:

```bash
func new --name geocode --template "HTTP trigger" --authlevel "anonymous"
```

#### geocode/function.json

```json
{
  "bindings": [
    {
      "authLevel": "anonymous",
      "type": "httpTrigger",
      "direction": "in",
      "name": "req",
      "methods": [
        "get"
      ]
    },
    {
      "type": "http",
      "direction": "out",
      "name": "res"
    }
  ]
}
```

#### geocode/index.js

```javascript
const axios = require('axios');
const { validateToken } = require('../shared/jwtAuth');

module.exports = async function (context, req) {
  try {
    // Check authentication
    const user = await validateToken(req);
    if (!user) {
      return respondWithError(context, 'Unauthorized', 401);
    }
    
    const { address } = req.query;
    
    if (!address) {
      return respondWithError(context, 'Address is required', 400);
    }
    
    // Make request to Azure Maps with Israel-specific configuration
    const response = await axios.get("https://atlas.microsoft.com/search/address/json", {
      params: {
        'subscription-key': process.env.AZURE_MAPS_SUBSCRIPTION_KEY,
        'api-version': '1.0',
        'query': address,
        'countrySet': 'IL', // ISO code for Israel
        'language': 'he,en' // Support for Hebrew and English
      }
    });
    
    const results = response.data.results;
    if (results && results.length > 0) {
      // Successfully geocoded address
      context.res = {
        status: 200,
        body: {
          latitude: results[0].position.lat,
          longitude: results[0].position.lon,
          address: results[0].address,
          formattedAddress: results[0].address.freeformAddress,
          confidence: results[0].score
        }
      };
    } else {
      // No results found
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

function respondWithError(context, message, status = 500) {
  context.res = {
    status: status,
    body: { message: message },
    headers: {
      'Content-Type': 'application/json'
    }
  };
}
```

### 2.5 Implement a Function to Get Nearby Plants (for Map View)

```bash
func new --name nearbyPlants --template "HTTP trigger" --authlevel "anonymous"
```

#### nearbyPlants/function.json

```json
{
  "bindings": [
    {
      "authLevel": "anonymous",
      "type": "httpTrigger",
      "direction": "in",
      "name": "req",
      "methods": [
        "get"
      ]
    },
    {
      "type": "http",
      "direction": "out",
      "name": "res"
    }
  ]
}
```

#### nearbyPlants/index.js

```javascript
const { productsContainer } = require('../shared/cosmosClient');
const { validateToken } = require('../shared/jwtAuth');

module.exports = async function (context, req) {
  try {
    // Validate token
    const user = await validateToken(req);
    if (!user) {
      return respondWithError(context, 'Unauthorized', 401);
    }
    
    // Parse query parameters
    const lat = parseFloat(req.query.lat);
    const lon = parseFloat(req.query.lon);
    const radius = parseFloat(req.query.radius) || 10; // Default 10km radius
    
    if (isNaN(lat) || isNaN(lon)) {
      return respondWithError(context, 'Valid latitude and longitude are required', 400);
    }
    
    // Get all active products
    const { resources: allProducts } = await productsContainer.items
      .query({
        query: "SELECT * FROM c WHERE c.active = true"
      })
      .fetchAll();
    
    // Filter products with location data
    const productsWithLocation = allProducts.filter(product => 
      product.location && product.location.latitude && product.location.longitude
    );
    
    // Calculate distance and filter by radius
    const nearbyProducts = productsWithLocation
      .map(product => {
        const distance = calculateDistance(
          lat, lon, 
          product.location.latitude, 
          product.location.longitude
        );
        return { ...product, distance };
      })
      .filter(product => product.distance <= radius)
      .sort((a, b) => a.distance - b.distance);
    
    context.res = {
      status: 200,
      body: {
        products: nearbyProducts,
        count: nearbyProducts.length
      }
    };
  } catch (error) {
    context.log.error('Error finding nearby plants:', error);
    return respondWithError(context, 'Error finding nearby plants', 500);
  }
};

// Haversine formula to calculate distance between two points on Earth
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of the Earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2); 
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  const distance = R * c; // Distance in km
  
  return distance;
}

function deg2rad(deg) {
  return deg * (Math.PI/180);
}

function respondWithError(context, message, status = 500) {
  context.res = {
    status: status,
    body: { message: message },
    headers: {
      'Content-Type': 'application/json'
    }
  };
}
```

## 3. React Native Integration

Update your React Native app to integrate with the Azure backend:

### 3.1 Update the API Service (marketplaceApi.js)

```javascript
// services/marketplaceApi.js
import config from './config';
import { MOCK_USER, MOCK_PLANTS, getMockProducts, getMockProductById } from './mockData';
import AsyncStorage from '@react-native-async-storage/async-storage';

// AUTH TOKEN HANDLING
let authToken = null;

export const setAuthToken = (token) => {
  authToken = token;
  global.googleAuthToken = token; // Store it globally too
};

// HELPER FUNCTIONS
const apiRequest = async (endpoint, method = 'GET', body = null) => {
  try {
    // Try to get token from storage if not set yet
    if (!authToken) {
      authToken = await AsyncStorage.getItem('authToken');
    }

    const headers = {
      'Content-Type': 'application/json',
    };

    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    const options = {
      method,
      headers,
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    // Set a timeout for the request
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Request timeout')), config.api.timeout);
    });

    // Create the fetch promise
    const fetchPromise = fetch(`${config.api.baseUrl}/${endpoint}`, options);
    
    // Race between fetch and timeout
    const response = await Promise.race([fetchPromise, timeoutPromise]);

    // Check if the request was successful
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error(`API Error (${endpoint}):`, errorData);
      throw new Error(errorData.message || `API error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`API Error (${endpoint}):`, error);
    
    // Check if we're in development mode and not using real API
    if (config.isDevelopment && !config.features.useRealApi) {
      console.log('Development mode: Using mock data');
      // Return appropriate mock data based on the endpoint
      if (endpoint.includes('products')) {
        return getMockProductData(endpoint);
      } else if (endpoint.includes('messages/getUserConversations')) {
        return getMockConversations();
      } else if (endpoint.includes('messages/getMessages')) {
        return getMockMessagesForConversation(endpoint.split('/').pop());
      } else if (endpoint.includes('auth/getUser')) {
        return { user: MOCK_USER };
      } else {
        return { success: true, mockData: true };
      }
    }
    
    throw error;
  }
};

// MESSAGING API
export const fetchConversations = async () => {
  try {
    return await apiRequest('messages/getUserConversations');
  } catch (error) {
    console.error('Error fetching conversations:', error);
    // Return mock conversations in development
    if (config.isDevelopment) {
      return getMockConversations();
    }
    throw error;
  }
};

export const fetchMessages = async (chatId) => {
  try {
    return await apiRequest(`messages/getMessages/${chatId}`);
  } catch (error) {
    console.error(`Error fetching messages for conversation ${chatId}:`, error);
    // Return mock messages in development
    if (config.isDevelopment) {
      return getMockMessagesForConversation(chatId);
    }
    throw error;
  }
};

export const sendMessage = async (chatId, message) => {
  try {
    return await apiRequest('messages/sendMessage', 'POST', { chatId, message });
  } catch (error) {
    console.error('Error sending message:', error);
    // In development, simulate success
    if (config.isDevelopment) {
      return { sender: 'currentUser' };
    }
    throw error;
  }
};

export const startConversation = async (receiver, message, plantId) => {
  try {
    return await apiRequest('messages/createChatRoom', 'POST', { 
      receiver, 
      message,
      plantId
    });
  } catch (error) {
    console.error('Error starting conversation:', error);
    // In development, simulate success
    if (config.isDevelopment) {
      return { messageId: 'mock-conversation-id' };
    }
    throw error;
  }
};

// LOCATION/MAPS API
export const geocodeAddress = async (address) => {
  try {
    return await apiRequest(`geocode?address=${encodeURIComponent(address)}`);
  } catch (error) {
    console.error('Error geocoding address:', error);
    // In development, return mock data
    if (config.isDevelopment) {
      return getMockGeocode(address);
    }
    throw error;
  }
};

export const getNearbyPlants = async (latitude, longitude, radius = 10) => {
  try {
    return await apiRequest(`nearbyPlants?lat=${latitude}&lon=${longitude}&radius=${radius}`);
  } catch (error) {
    console.error('Error fetching nearby plants:', error);
    // In development, return mock data
    if (config.isDevelopment) {
      return getMockNearbyPlants(latitude, longitude, radius);
    }
    throw error;
  }
};

export default {
  setAuthToken,
  fetchConversations,
  fetchMessages,
  sendMessage,
  startConversation,
  geocodeAddress,
  getNearbyPlants
  // Include other exported functions here
};

// Mock data helper functions (for development)
function getMockConversations() {
  return [
    {
      id: 'conv1',
      otherUserName: 'PlantLover123',
      otherUserAvatar: 'https://via.placeholder.com/50?text=User1',
      lastMessage: "Hi, is the Monstera still available?",
      lastMessageTimestamp: new Date().toISOString(),
      plantName: "Monstera Deliciosa",
      plantId: "1",
      sellerId: "seller1",
      unreadCount: 2
    },
    {
      id: 'conv2',
      otherUserName: 'GreenThumb',
      otherUserAvatar: 'https://via.placeholder.com/50?text=User2',
      lastMessage: "Thanks for the quick response!",
      lastMessageTimestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      plantName: "Snake Plant",
      plantId: "2",
      sellerId: "seller2",
      unreadCount: 0
    }
  ];
}

function getMockMessagesForConversation(chatId) {
  const mockMessages = {
    'conv1': {
      id: 'conv1',
      messages: [
        {
          id: 'msg1',
          senderId: 'otherUser',
          message: "Hi, is the Monstera still available?",
          timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
          read: true
        },
        {
          id: 'msg2',
          senderId: 'currentUser',
          message: "Yes, it's still available!",
          timestamp: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
          read: true
        },
        {
          id: 'msg3',
          senderId: 'otherUser',
          message: "Great! What's the best time to come see it?",
          timestamp: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
          read: false
        },
        {
          id: 'msg4',
          senderId: 'otherUser',
          message: "I'm available this weekend, would that work for you?",
          timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
          read: false
        }
      ],
      otherUser: {
        id: 'otherUser',
        name: 'PlantLover123',
        avatar: 'https://via.placeholder.com/50?text=User1'
      },
      plant: {
        id: '1',
        title: 'Monstera Deliciosa',
        image: 'https://via.placeholder.com/150?text=Monstera',
        price: 29.99,
        category: 'Indoor Plants'
      },
      isBuyer: false
    },
    'conv2': {
      id: 'conv2',
      messages: [
        {
          id: 'msg1',
          senderId: 'otherUser',
          message: "Hello, I'm interested in your Snake Plant. Is it still for sale?",
          timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
          read: true
        },
        {
          id: 'msg2',
          senderId: 'currentUser',
          message: "Yes it is! It's about 2 feet tall and very healthy.",
          timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000 + 30 * 60 * 1000).toISOString(),
          read: true
        },
        {
          id: 'msg3',
          senderId: 'otherUser',
          message: "Perfect. Would you be willing to deliver it?",
          timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
          read: true
        },
        {
          id: 'msg4',
          senderId: 'currentUser',
          message: "I could deliver it if you're within 5 miles of downtown.",
          timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000 + 15 * 60 * 1000).toISOString(),
          read: true
        },
        {
          id: 'msg5',
          senderId: 'otherUser',
          message: "Thanks for the quick response!",
          timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          read: true
        }
      ],
      otherUser: {
        id: 'otherUser',
        name: 'GreenThumb',
        avatar: 'https://via.placeholder.com/50?text=User2'
      },
      plant: {
        id: '2',
        title: 'Snake Plant',
        image: 'https://via.placeholder.com/150?text=Snake+Plant',
        price: 19.99,
        category: 'Indoor Plants'
      },
      isBuyer: true
    }
  };
  
  return mockMessages[chatId] || { id: chatId, messages: [], otherUser: null, plant: null };
}

function getMockGeocode(address) {
  // Generate deterministic coordinates based on address string
  const addressHash = address.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  
  // Center around Israel (approximately)
  const baseLatitude = 31.5;  // Approximate center latitude of Israel
  const baseLongitude = 34.8; // Approximate center longitude of Israel
  
  // Add variation based on address hash (keep within Israel's rough boundaries)
  const latVariation = (addressHash % 100) / 100 * 2 - 1; // -1 to +1
  const lonVariation = (addressHash % 100) / 100 * 2 - 1; // -1 to +1
  
  return {
    latitude: baseLatitude + latVariation,
    longitude: baseLongitude + lonVariation,
    formattedAddress: address,
    address: {
      freeformAddress: address,
      country: 'Israel',
      countryCode: 'IL'
    },
    confidence: 0.9
  };
}

function getMockNearbyPlants(latitude, longitude, radius) {
  // Generate plants nearby the given coordinates
  const plants = [];
  
  // Create 5 plants with slightly different locations
  for (let i = 0; i < 5; i++) {
    // Create variation within the radius
    const latVariation = (Math.random() * 2 - 1) * (radius / 111); // Rough conversion of km to degrees
    const lonVariation = (Math.random() * 2 - 1) * (radius / (111 * Math.cos(latitude * Math.PI / 180)));
    
    const distance = Math.sqrt(latVariation * latVariation + lonVariation * lonVariation) * 111; // Rough distance in km
    
    plants.push({
      id: `nearby-${i}`,
      title: `Nearby Plant ${i + 1}`,
      description: `This is a sample plant located ${distance.toFixed(1)} km from your location.`,
      price: 10 + Math.random() * 40,
      image: 'https://via.placeholder.com/150?text=Plant',
      category: i % 2 === 0 ? 'indoor' : 'outdoor',
      location: {
        latitude: latitude + latVariation,
        longitude: longitude + lonVariation,
        city: 'Nearby City'
      },
      distance: distance // Distance in km
    });
  }
  
  return {
    products: plants,
    count: plants.length
  };
} + (properties.price ? properties.price.toFixed(2) : '0.00');
          details.appendChild(price);
          
          // Category
          const category = document.createElement('div');
          category.textContent = properties.category || '';
          details.appendChild(category);
          
          // Add details to container
          flexContainer. = require('@azure/cosmos');

// Get connection details from environment variables
const endpoint = process.env.COSMOS_ENDPOINT;
const key = process.env.COSMOS_KEY;
const client = new CosmosClient({ endpoint, key });

// Initialize database and containers
const database = client.database('greenerdb');
const productsContainer = database.container('products');
const usersContainer = database.container('users');
const chatRoomsContainer = database.container('chatrooms');

module.exports = {
  client,
  database,
  productsContainer,
  usersContainer,
  chatRoomsContainer
};
```

#### shared/jwtAuth.js

```javascript
const jwt = require('jsonwebtoken');
const { usersContainer } = require('./cosmosClient');

// Generate JWT token for authenticated users
const generateToken = (user) => {
  const payload = {
    _id: user.id,
    email: user.email,
    phoneNumber: user.phoneNumber,
    createdSells: user.createdSells?.length || 0,
    avatar: user.avatar
  };
  
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '15d' });
};

// Validate JWT token from request
const validateToken = async (req) => {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }
    
    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Verify user exists in database
    const { resource: user } = await usersContainer.item(decoded._id).read();
    if (!user) {
      return null;
    }
    
    return decoded;
  } catch (error) {
    console.error('JWT Validation Error:', error);
    return null;
  }
};

module.exports = {
  generateToken,
  validateToken
};
```

#### shared/storageHelper.js

```javascript
const { BlobServiceClient } = require('@azure/storage-blob');
const { v4: uuidv4 } = require('uuid');

// Create the BlobServiceClient object
const blobServiceClient = BlobServiceClient.fromConnectionString(
  process.env.STORAGE_CONNECTION_STRING
);

// Helper function to upload Base64 image
const uploadBase64Image = async (base64Image, containerName) => {
  try {
    // Get reference to container
    const containerClient = blobServiceClient.getContainerClient(containerName);
    
    // Extract image data from base64 string
    const matches = base64Image.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    
    if (!matches || matches.length !== 3) {
      throw new Error('Invalid base64 string');
    }
    
    const imageBuffer = Buffer.from(matches[2], 'base64');
    const contentType = matches[1];
    const fileExtension = contentType.split('/')[1] || 'jpg';
    const blobName = `${uuidv4()}.${fileExtension}`;
    
    // Get reference to block blob
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);
    
    // Upload data to blob
    await blockBlobClient.upload(imageBuffer, imageBuffer.length, {
      blobHTTPHeaders: { blobContentType: contentType }
    });
    
    // Return the URL of the uploaded blob
    return blockBlobClient.url;
  } catch (error) {
    console.error('Error uploading image:', error);
    throw error;
  }
};

module.exports = {
  uploadBase64Image
};
```

### 2.3 Implement Azure Functions for Messaging

#### Create Message Function

```bash
func new --name messages --template "HTTP trigger" --authlevel "anonymous"
```

#### messages/function.json

```json
{
  "bindings": [
    {
      "authLevel": "anonymous",
      "type": "httpTrigger",
      "direction": "in",
      "name": "req",
      "methods": [
        "get",
        "post"
      ],
      "route": "messages/{*route}"
    },
    {
      "type": "http",
      "direction": "out",
      "name": "res"
    }
  ]
}
```

#### messages/index.js

```javascript
const { chatRoomsContainer, usersContainer, productsContainer } = require('../shared/cosmosClient');
const { validateToken } = require('../shared/jwtAuth');
const { v4: uuidv4 } = require('uuid');

module.exports = async function (context, req) {
  context.log('Processing messages request');
  
  try {
    // Check authentication for all messages endpoints
    const user = await validateToken(req);
    if (!user) {
      return respondWithError(context, 'Unauthorized', 401);
    }
    
    const method = req.method.toLowerCase();
    const route = req.params.route?.toLowerCase() || '';
    
    // Route to appropriate handler based on the endpoint
    if (method === 'post' && route === 'createchatroom') {
      await handleCreateChatRoom(context, req, user);
    }
    else if (method === 'get' && route === 'getuserconversations') {
      await handleGetUserConversations(context, req, user);
    }
    else if (method === 'post' && route === 'sendmessage') {
      await handleSendMessage(context, req, user);
    }
    else if (method === 'get' && route.startsWith('getmessages/')) {
      const chatId = route.split('/')[1];
      await handleGetMessages(context, chatId, user);
    }
    else {
      return respondWithError(context, 'Method not supported', 405);
    }
  } catch (error) {
    context.log.error('Messages Error:', error);
    return respondWithError(context, error.message, error.status || 500);
  }
};

/**
 * Creates a new chat room or uses existing one, and adds the first message
 */
async function handleCreateChatRoom(context, req, user) {
  const { message, receiver, plantId } = req.body;
  
  if (!message || !receiver) {
    return respondWithError(context, 'Message and receiver are required', 400);
  }
  
  try {
    // Check if chat room already exists for this plant between these users
    const { resources: existingChatRooms } = await chatRoomsContainer.items
      .query({
        query: "SELECT * FROM c WHERE ((c.buyer = @userId AND c.seller = @receiverId) OR (c.buyer = @receiverId AND c.seller = @userId)) AND (c.plantId = @plantId OR (c.plantId = null AND @plantId = null))",
        parameters: [
          { name: "@userId", value: user._id },
          { name: "@receiverId", value: receiver },
          { name: "@plantId", value: plantId || null }
        ]
      })
      .fetchAll();
    
    let chatRoom;
    let plantInfo = null;
    
    // If plantId is provided, get plant information to include in chat
    if (plantId) {
      try {
        const { resource: plant } = await productsContainer.item(plantId).read();
        if (plant) {
          plantInfo = {
            id: plant.id,
            title: plant.title || plant.name,
            image: plant.image
          };
        }
      } catch (err) {
        context.log.warn(`Plant with ID ${plantId} not found`);
      }
    }
    
    if (existingChatRooms.length > 0) {
      // Use existing chat room
      chatRoom = existingChatRooms[0];
      
      // Update plant info if not already set
      if (plantId && !chatRoom.plantId && plantInfo) {
        await chatRoomsContainer.item(chatRoom.id).patch([
          { op: "add", path: "/plantId", value: plantId },
          { op: "add", path: "/plantName", value: plantInfo.title }
        ]);
      }
    } else {
      // Create new chat room
      const newChatRoom = {
        id: uuidv4(),
        buyer: user._id,
        seller: receiver,
        conversation: [],
        createdAt: new Date().toISOString()
      };
      
      // Add plant info if available
      if (plantId && plantInfo) {
        newChatRoom.plantId = plantId;
        newChatRoom.plantName = plantInfo.title;
        newChatRoom.plantImage = plantInfo.image;
      }
      
      const { resource: createdChatRoom } = await chatRoomsContainer.items.create(newChatRoom);
      chatRoom = createdChatRoom;
      
      // Add chat room to both users' chatRooms array
      await usersContainer.item(user._id).patch([
        { op: "add", path: "/chatRooms/-", value: chatRoom.id }
      ]);
      
      await usersContainer.item(receiver).patch([
        { op: "add", path: "/chatRooms/-", value: chatRoom.id }
      ]);
    }
    
    // Add the message to the conversation
    await chatRoomsContainer.item(chatRoom.id).patch([
      { 
        op: "add", 
        path: "/conversation/-", 
        value: { 
          id: uuidv4(),
          senderId: user._id, 
          message,
          timestamp: new Date().toISOString(),
          read: false
        } 
      }
    ]);
    
    context.res = {
      status: 200,
      body: { messageId: chatRoom.id }
    };
  } catch (error) {
    context.log.error('Error creating chat room:', error);
    return respondWithError(context, 'Error creating chat room', 500);
  }
}

/**
 * Gets all conversations for the current user
 */
async function handleGetUserConversations(context, req, user) {
  try {
    // Get all chatrooms where user is involved
    const { resources: allChats } = await chatRoomsContainer.items
      .query({
        query: "SELECT * FROM c WHERE c.buyer = @userId OR c.seller = @userId ORDER BY c._ts DESC",
        parameters: [{ name: "@userId", value: user._id }]
      })
      .fetchAll();
    
    // Format and populate conversations with other user details
    const conversations = await Promise.all(allChats.map(async (chat) => {
      // Determine if current user is buyer or seller
      const isBuyer = chat.buyer === user._id;
      const otherUserId = isBuyer ? chat.seller : chat.buyer;
      
      // Get other user's info
      const { resource: otherUser } = await usersContainer.item(otherUserId).read();
      
      if (!otherUser) {
        // Skip if other user not found
        return null;
      }
      
      // Get latest message
      const lastMessage = chat.conversation && chat.conversation.length > 0 
        ? chat.conversation[chat.conversation.length - 1]
        : null;
      
      // Count unread messages
      const unreadCount = chat.conversation ? 
        chat.conversation.filter(msg => 
          msg.senderId !== user._id && 
          (msg.read === false || msg.read === undefined)
        ).length : 0;
      
      return {
        id: chat.id,
        otherUserName: otherUser.name,
        otherUserAvatar: otherUser.avatar || 'https://res.cloudinary.com/your-cloud-name/image/upload/v1617358367/defaultAvatar_wnoogh.png',
        lastMessage: lastMessage ? lastMessage.message : "",
        lastMessageTimestamp: lastMessage ? lastMessage.timestamp : chat.createdAt,
        plantName: chat.plantName || "Plant discussion",
        plantId: chat.plantId || null,
        plantImage: chat.plantImage || null,
        sellerId: isBuyer ? chat.seller : null,
        unreadCount: unreadCount
      };
    }));
    
    // Filter out null entries (if any users were not found)
    const validConversations = conversations.filter(conv => conv !== null);
    
    context.res = {
      status: 200,
      body: validConversations
    };
  } catch (error) {
    context.log.error('Error getting conversations:', error);
    return respondWithError(context, 'Error getting conversations', 500);
  }
}

/**
 * Adds a message to an existing chat room
 */
async function handleSendMessage(context, req, user) {
  const { chatId, message } = req.body;
  
  if (!chatId || !message) {
    return respondWithError(context, 'Chat ID and message are required', 400);
  }
  
  try {
    // First check if the user is part of this chat
    const { resource: chatRoom } = await chatRoomsContainer.item(chatId).read();
    
    if (!chatRoom) {
      return respondWithError(context, 'Chat not found', 404);
    }
    
    if (chatRoom.buyer !== user._id && chatRoom.seller !== user._id) {
      return respondWithError(context, 'Not authorized to send messages in this chat', 403);
    }
    
    // Add message to chat room
    await chatRoomsContainer.item(chatId).patch([
      { 
        op: "add", 
        path: "/conversation/-", 
        value: { 
          id: uuidv4(),
          senderId: user._id, 
          message,
          timestamp: new Date().toISOString(),
          read: false
        } 
      }
    ]);
    
    context.res = {
      status: 200,
      body: { sender: user._id }
    };
  } catch (error) {
    context.log.error('Error sending message:', error);
    return respondWithError(context, 'Error sending message', 500);
  }
}

/**
 * Gets messages for a specific chat room
 */
async function handleGetMessages(context, chatId, user) {
  try {
    if (!chatId) {
      return respondWithError(context, 'Chat ID is required', 400);
    }
    
    // Get chat room with all messages
    const { resource: chatRoom } = await chatRoomsContainer.item(chatId).read();
    
    if (!chatRoom) {
      return respondWithError(context, 'Chat not found', 404);
    }
    
    // Check if user is part of this chat
    if (chatRoom.buyer !== user._id && chatRoom.seller !== user._id) {
      return respondWithError(context, 'Not authorized to view this chat', 403);
    }
    
    // Mark messages from other user as read
    const otherUserId = chatRoom.buyer === user._id ? chatRoom.seller : chatRoom.buyer;
    
    // Update read status of messages
    const messagesToUpdate = [];
    
    if (chatRoom.conversation) {
      chatRoom.conversation.forEach((msg, index) => {
        if (msg.senderId === otherUserId && (msg.read === false || msg.read === undefined)) {
          messagesToUpdate.push({
            op: "replace",
            path: `/conversation/${index}/read`,
            value: true
          });
        }
      });
    }
    
    // If there are unread messages, update them
    if (messagesToUpdate.length > 0) {
      await chatRoomsContainer.item(chatId).patch(messagesToUpdate);
    }
    
    // Get information about the other user
    const { resource: otherUser } = await usersContainer.item(otherUserId).read();
    
    // Get plant information if it exists
    let plantInfo = null;
    if (chatRoom.plantId) {
      try {
        const { resource: plant } = await productsContainer.item(chatRoom.plantId).read();
        if (plant) {
          plantInfo = {
            id: plant.id,
            title: plant.title || plant.name,
            image: plant.image,
            price: plant.price,
            category: plant.category
          };
        }
      } catch (err) {
        context.log.warn(`Plant with ID ${chatRoom.plantId} not found`);
      }
    }
    
    // Format response
    const response = {
      id: chatRoom.id,
      messages: chatRoom.conversation || [],
      otherUser: {
        id: otherUser.id,
        name: otherUser.name,
        avatar: otherUser.avatar
      },
      plant: plantInfo,
      isBuyer: chatRoom.buyer === user._id
    };
    
    context.res = {
      status: 200,
      body: response
    };
  } catch (error) {
    context.log.error('Error getting messages:', error);
    return respondWithError(context, 'Error getting messages', 500);
  }
}

function respondWithError(context, message, status = 500) {
  context.res = {
    status: status,
    body: { message: message },
    headers: {
      'Content-Type': 'application/json'
    }
  };
}
```

### 2.4 Implement Azure Maps Integration

Create a new function for Azure Maps geocoding:

```bash
func new --name geocode --template "HTTP trigger" --authlevel "anonymous"
```

#### geocode/function.json

```json
{
  "bindings": [
    {
      "authLevel": "anonymous",
      "type": "httpTrigger",
      "direction": "in",
      "name": "req",
      "methods": [
        "get"
      ]
    },
    {
      "type": "http",
      "direction": "out",
      "name": "res"
    }
  ]
}
```

#### geocode/index.js

```javascript
const axios = require('axios');
const { validateToken } = require('../shared/jwtAuth');

module.exports = async function (context, req) {
  try {
    // Check authentication
    const user = await validateToken(req);
    if (!user) {
      return respondWithError(context, 'Unauthorized', 401);
    }
    
    const { address } = req.query;
    
    if (!address) {
      return respondWithError(context, 'Address is required', 400);
    }
    
    // Make request to Azure Maps with Israel-specific configuration
    const response = await axios.get("https://atlas.microsoft.com/search/address/json", {
      params: {
        'subscription-key': process.env.AZURE_MAPS_SUBSCRIPTION_KEY,
        'api-version': '1.0',
        'query': address,
        'countrySet': 'IL', // ISO code for Israel
        'language': 'he,en' // Support for Hebrew and English
      }
    });
    
    const results = response.data.results;
    if (results && results.length > 0) {
      // Successfully geocoded address
      context.res = {
        status: 200,
        body: {
          latitude: results[0].position.lat,
          longitude: results[0].position.lon,
          address: results[0].address,
          formattedAddress: results[0].address.freeformAddress,
          confidence: results[0].score
        }
      };
    } else {
      // No results found
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

function respondWithError(context, message, status = 500) {
  context.res = {
    status: status,
    body: { message: message },
    headers: {
      'Content-Type': 'application/json'
    }
  };
}
```

### 2.5 Implement a Function to Get Nearby Plants (for Map View)

```bash
func new --name nearbyPlants --template "HTTP trigger" --authlevel "anonymous"
```

#### nearbyPlants/function.json

```json
{
  "bindings": [
    {
      "authLevel": "anonymous",
      "type": "httpTrigger",
      "direction": "in",
      "name": "req",
      "methods": [
        "get"
      ]
    },
    {
      "type": "http",
      "direction": "out",
      "name": "res"
    }
  ]
}
```

#### nearbyPlants/index.js

```javascript
const { productsContainer } = require('../shared/cosmosClient');
const { validateToken } = require('../shared/jwtAuth');

module.exports = async function (context, req) {
  try {
    // Validate token
    const user = await validateToken(req);
    if (!user) {
      return respondWithError(context, 'Unauthorized', 401);
    }
    
    // Parse query parameters
    const lat = parseFloat(req.query.lat);
    const lon = parseFloat(req.query.lon);
    const radius = parseFloat(req.query.radius) || 10; // Default 10km radius
    
    if (isNaN(lat) || isNaN(lon)) {
      return respondWithError(context, 'Valid latitude and longitude are required', 400);
    }
    
    // Get all active products
    const { resources: allProducts } = await productsContainer.items
      .query({
        query: "SELECT * FROM c WHERE c.active = true"
      })
      .fetchAll();
    
    // Filter products with location data
    const productsWithLocation = allProducts.filter(product => 
      product.location && product.location.latitude && product.location.longitude
    );
    
    // Calculate distance and filter by radius
    const nearbyProducts = productsWithLocation
      .map(product => {
        const distance = calculateDistance(
          lat, lon, 
          product.location.latitude, 
          product.location.longitude
        );
        return { ...product, distance };
      })
      .filter(product => product.distance <= radius)
      .sort((a, b) => a.distance - b.distance);
    
    context.res = {
      status: 200,
      body: {
        products: nearbyProducts,
        count: nearbyProducts.length
      }
    };
  } catch (error) {
    context.log.error('Error finding nearby plants:', error);
    return respondWithError(context, 'Error finding nearby plants', 500);
  }
};

// Haversine formula to calculate distance between two points on Earth
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of the Earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2); 
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  const distance = R * c; // Distance in km
  
  return distance;
}

function deg2rad(deg) {
  return deg * (Math.PI/180);
}

function respondWithError(context, message, status = 500) {
  context.res = {
    status: status,
    body: { message: message },
    headers: {
      'Content-Type': 'application/json'
    }
  };
}
```

## 3. React Native Integration

Update your React Native app to integrate with the Azure backend:

### 3.1 Update the API Service (marketplaceApi.js)

```javascript
// services/marketplaceApi.js
import config from './config';
import { MOCK_USER, MOCK_PLANTS, getMockProducts, getMockProductById } from './mockData';
import AsyncStorage from '@react-native-async-storage/async-storage';

// AUTH TOKEN HANDLING
let authToken = null;

export const setAuthToken = (token) => {
  authToken = token;
  global.googleAuthToken = token; // Store it globally too
};

// HELPER FUNCTIONS
const apiRequest = async (endpoint, method = 'GET', body = null) => {
  try {
    // Try to get token from storage if not set yet
    if (!authToken) {
      authToken = await AsyncStorage.getItem('authToken');
    }

    const headers = {
      'Content-Type': 'application/json',
    };

    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    const options = {
      method,
      headers,
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    // Set a timeout for the request
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Request timeout')), config.api.timeout);
    });

    // Create the fetch promise
    const fetchPromise = fetch(`${config.api.baseUrl}/${endpoint}`, options);
    
    // Race between fetch and timeout
    const response = await Promise.race([fetchPromise, timeoutPromise]);

    // Check if the request was successful
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error(`API Error (${endpoint}):`, errorData);
      throw new Error(errorData.message || `API error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`API Error (${endpoint}):`, error);
    
    // Check if we're in development mode and not using real API
    if (config.isDevelopment && !config.features.useRealApi) {
      console.log('Development mode: Using mock data');
      // Return appropriate mock data based on the endpoint
      if (endpoint.includes('products')) {
        return getMockProductData(endpoint);
      } else if (endpoint.includes('messages/getUserConversations')) {
        return getMockConversations();
      } else if (endpoint.includes('messages/getMessages')) {
        return getMockMessagesForConversation(endpoint.split('/').pop());
      } else if (endpoint.includes('auth/getUser')) {
        return { user: MOCK_USER };
      } else {
        return { success: true, mockData: true };
      }
    }
    
    throw error;
  }
};

// MESSAGING API
export const fetchConversations = async () => {
  try {
    return await apiRequest('messages/getUserConversations');
  } catch (error) {
    console.error('Error fetching conversations:', error);
    // Return mock conversations in development
    if (config.isDevelopment) {
      return getMockConversations();
    }
    throw error;
  }
};

export const fetchMessages = async (chatId) => {
  try {
    return await apiRequest(`messages/getMessages/${chatId}`);
  } catch (error) {
    console.error(`Error fetching messages for conversation ${chatId}:`, error);
    // Return mock messages in development
    if (config.isDevelopment) {
      return getMockMessagesForConversation(chatId);
    }
    throw error;
  }
};

export const sendMessage = async (chatId, message) => {
  try {
    return await apiRequest('messages/sendMessage', 'POST', { chatId, message });
  } catch (error) {
    console.error('Error sending message:', error);
    // In development, simulate success
    if (config.isDevelopment) {
      return { sender: 'currentUser' };
    }
    throw error;
  }
};

export const startConversation = async (receiver, message, plantId) => {
  try {
    return await apiRequest('messages/createChatRoom', 'POST', { 
      receiver, 
      message,
      plantId
    });
  } catch (error) {
    console.error('Error starting conversation:', error);
    // In development, simulate success
    if (config.isDevelopment) {
      return { messageId: 'mock-conversation-id' };
    }
    throw error;
  }
};

// LOCATION/MAPS API
export const geocodeAddress = async (address) => {
  try {
    return await apiRequest(`geocode?address=${encodeURIComponent(address)}`);
  } catch (error) {
    console.error('Error geocoding address:', error);
    // In development, return mock data
    if (config.isDevelopment) {
      return getMockGeocode(address);
    }
    throw error;
  }
};

export const getNearbyPlants = async (latitude, longitude, radius = 10) => {
  try {
    return await apiRequest(`nearbyPlants?lat=${latitude}&lon=${longitude}&radius=${radius}`);
  } catch (error) {
    console.error('Error fetching nearby plants:', error);
    // In development, return mock data
    if (config.isDevelopment) {
      return getMockNearbyPlants(latitude, longitude, radius);
    }
    throw error;
  }
};

export default {
  setAuthToken,
  fetchConversations,
  fetchMessages,
  sendMessage,
  startConversation,
  geocodeAddress,
  getNearbyPlants
  // Include other exported functions here
};

// Mock data helper functions (for development)
function getMockConversations() {
  return [
    {
      id: 'conv1',
      otherUserName: 'PlantLover123',
      otherUserAvatar: 'https://via.placeholder.com/50?text=User1',
      lastMessage: "Hi, is the Monstera still available?",
      lastMessageTimestamp: new Date().toISOString(),
      plantName: "Monstera Deliciosa",
      plantId: "1",
      sellerId: "seller1",
      unreadCount: 2
    },
    {
      id: 'conv2',
      otherUserName: 'GreenThumb',
      otherUserAvatar: 'https://via.placeholder.com/50?text=User2',
      lastMessage: "Thanks for the quick response!",
      lastMessageTimestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      plantName: "Snake Plant",
      plantId: "2",
      sellerId: "seller2",
      unreadCount: 0
    }
  ];
}

function getMockMessagesForConversation(chatId) {
  const mockMessages = {
    'conv1': {
      id: 'conv1',
      messages: [
        {
          id: 'msg1',
          senderId: 'otherUser',
          message: "Hi, is the Monstera still available?",
          timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
          read: true
        },
        {
          id: 'msg2',
          senderId: 'currentUser',
          message: "Yes, it's still available!",
          timestamp: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
          read: true
        },
        {
          id: 'msg3',
          senderId: 'otherUser',
          message: "Great! What's the best time to come see it?",
          timestamp: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
          read: false
        },
        {
          id: 'msg4',
          senderId: 'otherUser',
          message: "I'm available this weekend, would that work for you?",
          timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
          read: false
        }
      ],
      otherUser: {
        id: 'otherUser',
        name: 'PlantLover123',
        avatar: 'https://via.placeholder.com/50?text=User1'
      },
      plant: {
        id: '1',
        title: 'Monstera Deliciosa',
        image: 'https://via.placeholder.com/150?text=Monstera',
        price: 29.99,
        category: 'Indoor Plants'
      },
      isBuyer: false
    },
    'conv2': {
      id: 'conv2',
      messages: [
        {
          id: 'msg1',
          senderId: 'otherUser',
          message: "Hello, I'm interested in your Snake Plant. Is it still for sale?",
          timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
          read: true
        },
        {
          id: 'msg2',
          senderId: 'currentUser',
          message: "Yes it is! It's about 2 feet tall and very healthy.",
          timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000 + 30 * 60 * 1000).toISOString(),
          read: true
        },
        {
          id: 'msg3',
          senderId: 'otherUser',
          message: "Perfect. Would you be willing to deliver it?",
          timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
          read: true
        },
        {
          id: 'msg4',
          senderId: 'currentUser',
          message: "I could deliver it if you're within 5 miles of downtown.",
          timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000 + 15 * 60 * 1000).toISOString(),
          read: true
        },
        {
          id: 'msg5',
          senderId: 'otherUser',
          message: "Thanks for the quick response!",
          timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          read: true
        }
      ],
      otherUser: {
        id: 'otherUser',
        name: 'GreenThumb',
        avatar: 'https://via.placeholder.com/50?text=User2'
      },
      plant: {
        id: '2',
        title: 'Snake Plant',
        image: 'https://via.placeholder.com/150?text=Snake+Plant',
        price: 19.99,
        category: 'Indoor Plants'
      },
      isBuyer: true
    }
  };
  
  return mockMessages[chatId] || { id: chatId, messages: [], otherUser: null, plant: null };
}

function getMockGeocode(address) {
  // Generate deterministic coordinates based on address string
  const addressHash = address.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  
  // Center around Israel (approximately)
  const baseLatitude = 31.5;  // Approximate center latitude of Israel
  const baseLongitude = 34.8; // Approximate center longitude of Israel
  
  // Add variation based on address hash (keep within Israel's rough boundaries)
  const latVariation = (addressHash % 100) / 100 * 2 - 1; // -1 to +1
  const lonVariation = (addressHash % 100) / 100 * 2 - 1; // -1 to +1
  
  return {
    latitude: baseLatitude + latVariation,
    longitude: baseLongitude + lonVariation,
    formattedAddress: address,
    address: {
      freeformAddress: address,
      country: 'Israel',
      countryCode: 'IL'
    },
    confidence: 0.9
  };
}

function getMockNearbyPlants(latitude, longitude, radius) {
  // Generate plants nearby the given coordinates
  const plants = [];
  
  // Create 5 plants with slightly different locations
  for (let i = 0; i < 5; i++) {
    // Create variation within the radius
    const latVariation = (Math.random() * 2 - 1) * (radius / 111); // Rough conversion of km to degrees
    const lonVariation = (Math.random() * 2 - 1) * (radius / (111 * Math.cos(latitude * Math.PI / 180)));
    
    const distance = Math.sqrt(latVariation * latVariation + lonVariation * lonVariation) * 111; // Rough distance in km
    
    plants.push({
      id: `nearby-${i}`,
      title: `Nearby Plant ${i + 1}`,
      description: `This is a sample plant located ${distance.toFixed(1)} km from your location.`,
      price: 10 + Math.random() * 40,
      image: 'https://via.placeholder.com/150?text=Plant',
      category: i % 2 === 0 ? 'indoor' : 'outdoor',
      location: {
        latitude: latitude + latVariation,
        longitude: longitude + lonVariation,
        city: 'Nearby City'
      },
      distance: distance // Distance in km
    });
  }
  
  return {
    products: plants,
    count: plants.length
  };
}