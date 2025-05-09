# Integrating Azure Backend with the Greener Mobile App

This guide explains how to connect the React Native frontend with the Azure Functions backend.

## 1. Update API Services

### Update MarketplaceApi.js

```javascript
// services/MarketplaceApi.js

/**
 * marketplaceApi.js
 * API service for interacting with Azure Functions for the Marketplace feature
 */

// Base URL for Azure Functions
const API_BASE_URL = 'https://your-function-app-name.azurewebsites.net/api';

// AUTH TOKEN HANDLING
// Will be used to authenticate requests to Azure Functions
let authToken = null;

const setAuthToken = (token) => {
  authToken = token;
};

// Helper function to handle API requests
const apiRequest = async (endpoint, method = 'GET', body = null) => {
  try {
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

    const response = await fetch(`${API_BASE_URL}/${endpoint}`, options);

    // Check if the request was successful
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'An error occurred');
    }

    return await response.json();
  } catch (error) {
    console.error(`API Error (${endpoint}):`, error);
    throw error;
  }
};

// PLANT LISTINGS API

/**
 * Fetch plants with optional filters
 */
export const fetchPlants = async (filters = {}) => {
  try {
    let queryParams = new URLSearchParams();
    
    // Add filters to query params
    if (filters.category && filters.category !== 'All') {
      queryParams.append('category', filters.category);
    }
    
    if (filters.search) {
      queryParams.append('search', filters.search);
    }
    
    if (filters.minPrice) {
      queryParams.append('minPrice', filters.minPrice);
    }
    
    if (filters.maxPrice) {
      queryParams.append('maxPrice', filters.maxPrice);
    }
    
    const queryString = queryParams.toString();
    const endpoint = `products${queryString ? `?${queryString}` : ''}`;
    
    return await apiRequest(endpoint);
  } catch (error) {
    console.error('Error fetching plants:', error);
    // During development, return mock data on error
    if (__DEV__) {
      return getMockProducts(filters.category, filters.search);
    }
    throw error;
  }
};

/**
 * Fetch a single plant by ID
 */
export const fetchPlantById = async (id) => {
  try {
    return await apiRequest(`products/specific/${id}`);
  } catch (error) {
    console.error(`Error fetching plant ${id}:`, error);
    // During development, return mock data on error
    if (__DEV__) {
      return getMockProductById(id);
    }
    throw error;
  }
};

/**
 * Create a new plant listing
 */
export const createPlant = async (plantData) => {
  try {
    return await apiRequest('products/create', 'POST', plantData);
  } catch (error) {
    console.error('Error creating plant:', error);
    throw error;
  }
};

/**
 * Toggle favorite status for a plant
 */
export const toggleFavoritePlant = async (plantId) => {
  try {
    return await apiRequest(`products/${plantId}/wish`, 'GET');
  } catch (error) {
    console.error(`Error toggling favorite for plant ${plantId}:`, error);
    throw error;
  }
};

// USER PROFILE API

/**
 * Fetch current user's profile
 */
export const fetchUserProfile = async () => {
  try {
    return await apiRequest('users/getProfile');
  } catch (error) {
    console.error('Error fetching user profile:', error);
    // During development, return mock data on error
    if (__DEV__) {
      return getMockUser();
    }
    throw error;
  }
};

/**
 * Update user profile
 */
export const updateUserProfile = async (id, updates) => {
  try {
    return await apiRequest(`users/updateProfile/${id}`, 'PATCH', updates);
  } catch (error) {
    console.error('Error updating user profile:', error);
    throw error;
  }
};

// MESSAGING API

/**
 * Fetch user's conversations
 */
export const fetchConversations = async () => {
  try {
    return await apiRequest('messages/getUserConversations');
  } catch (error) {
    console.error('Error fetching conversations:', error);
    // During development, return mock data on error
    if (__DEV__) {
      return getMockConversations();
    }
    throw error;
  }
};

/**
 * Send a message in an existing conversation
 */
export const sendMessage = async (chatId, message) => {
  try {
    return await apiRequest('messages/sendMessage', 'POST', { chatId, message });
  } catch (error) {
    console.error(`Error sending message in conversation ${chatId}:`, error);
    throw error;
  }
};

/**
 * Start a new conversation with a seller about a plant
 */
export const startConversation = async (sellerId, initialMessage) => {
  try {
    return await apiRequest('messages/createChatRoom', 'POST', {
      receiver: sellerId,
      message: initialMessage
    });
  } catch (error) {
    console.error('Error starting conversation:', error);
    throw error;
  }
};

export default {
  setAuthToken,
  fetchPlants,
  fetchPlantById,
  createPlant,
  toggleFavoritePlant,
  fetchUserProfile,
  updateUserProfile,
  fetchConversations,
  sendMessage,
  startConversation
};

// Mock data implementations should remain for development fallback
```

## 2. Implement Google Sign-In Integration

### Update SignInGoogleScreen.js

```javascript
// screens/SignInGoogleScreen.js
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ImageBackground,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import AsyncStorage from '@react-native-async-storage/async-storage';
import marketplaceApi from '../services/marketplaceApi';

// Ensure WebBrowser can complete auth session
WebBrowser.maybeCompleteAuthSession();

// Update with your actual Google client IDs
const GOOGLE_CLIENT_ID = {
  expoClientId: 'YOUR_EXPO_CLIENT_ID',
  iosClientId: 'YOUR_IOS_CLIENT_ID',
  androidClientId: 'YOUR_ANDROID_CLIENT_ID',
  webClientId: 'YOUR_WEB_CLIENT_ID',
};

export default function SignInGoogleScreen({ navigation }) {
  const [isLoading, setIsLoading] = useState(false);
  const [authError, setAuthError] = useState(null);

  // Set up Google Auth Request
  const [request, response, promptAsync] = Google.useAuthRequest(GOOGLE_CLIENT_ID);

  // Check if user is already logged in
  useEffect(() => {
    const checkLoginStatus = async () => {
      try {
        const storedToken = await AsyncStorage.getItem('googleToken');
        
        if (storedToken) {
          // Set auth token globally for API requests
          marketplaceApi.setAuthToken(storedToken);
          global.googleAuthToken = storedToken;
          
          // Navigate to Home screen
          navigation.replace('Home');
        }
      } catch (error) {
        console.error('Error checking login status:', error);
      }
    };
    
    checkLoginStatus();
  }, []);

  // Handle Google Auth Response
  useEffect(() => {
    if (response?.type === 'success') {
      setIsLoading(true);
      handleSignInWithGoogle(response.authentication);
    } else if (response?.type === 'error') {
      setAuthError('Google Sign In failed. Please try again.');
      console.error('Google Sign In Error:', response.error);
    }
  }, [response]);

  // Handle successful Google Sign-In
  const handleSignInWithGoogle = async (authentication) => {
    try {
      // Save token for API calls
      const idToken = authentication.idToken;
      marketplaceApi.setAuthToken(idToken);
      global.googleAuthToken = idToken;
      
      // Store token for auto-login
      await AsyncStorage.setItem('googleToken', idToken);
      
      // Navigate to Home screen
      navigation.replace('Home');
    } catch (error) {
      console.error('Error handling Google Sign In:', error);
      setAuthError('Authentication failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ImageBackground
      source={require("../../assets/images/plant-banner.jpg")}
      style={styles.background}
      resizeMode="cover"
    >
      <View style={styles.overlay}>
        <View style={styles.contentContainer}>
          <Text style={styles.title}>Sign In</Text>
          <Text style={styles.subtitle}>
            Sign in with Google to continue to Greener
          </Text>

          {authError && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{authError}</Text>
            </View>
          )}

          <TouchableOpacity
            style={styles.googleButton}
            onPress={() => promptAsync()}
            disabled={isLoading}
            activeOpacity={0.8}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.googleButtonText}>
                Sign in with Google
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  // Styles remain unchanged
});
```

## 3. Add Mock Data Fallbacks

For development purposes, it's useful to have mock data when the backend is not available:

```javascript
// mockData.js

// Sample plants for development
export const MOCK_PLANTS = [
  {
    id: '1',
    title: 'Monstera Deliciosa',
    name: 'Monstera Deliciosa',
    description: 'Beautiful Swiss Cheese Plant with large fenestrated leaves.',
    price: 29.99,
    image: 'https://via.placeholder.com/150?text=Monstera',
    sellerName: 'PlantLover123',
    location: 'Seattle, WA',
    category: 'indoor',
    rating: 4.7,
    isFavorite: false,
  },
  {
    id: '2',
    title: 'Snake Plant',
    description: 'Low maintenance indoor plant, perfect for beginners.',
    price: 19.99,
    image: 'https://via.placeholder.com/150?text=Snake+Plant',
    sellerName: 'GreenThumb',
    location: 'Portland, OR',
    category: 'indoor',
    rating: 4.5,
    isFavorite: false,
  },
  // Add more mock plants...
];

// Mock function to simulate fetching products
export function getMockProducts(category, query) {
  let filtered = [...MOCK_PLANTS];

  if (category && category !== 'all') {
    filtered = filtered.filter((p) => p.category.toLowerCase() === category.toLowerCase());
  }

  if (query) {
    const lowercaseQuery = query.toLowerCase();
    filtered = filtered.filter((p) => p.title.toLowerCase().includes(lowercaseQuery));
  }

  return {
    products: filtered,
    pages: 1,
    currentPage: 1,
    count: filtered.length,
  };
}

// Mock function to simulate fetching a product by ID
export function getMockProductById(id) {
  const product = MOCK_PLANTS.find((p) => p.id === id);
  if (!product) {
    throw new Error('Product not found');
  }
  return product;
}

// Other mock data functions...
```

## 4. Testing Your Integration

1. **Test Authentication Flow**:
   - Ensure Google Sign-In works properly
   - Verify token is stored and used for API requests
   - Test automatic login on app restart

2. **Test API Fallbacks**:
   - Disable your internet connection
   - Verify app falls back to mock data in development
   - Check error handling displays user-friendly messages

3. **Test Performance**:
   - Monitor API response times
   - Add loading indicators for slow operations
   - Implement pagination for large data sets

## 5. Common Integration Issues and Solutions

### CORS Issues

**Problem**: Cross-Origin Resource Sharing (CORS) errors when making API requests.

**Solution**:
- Ensure your Azure Function has CORS properly configured
- Add your app's domains to the allowed origins
- For local development, add http://localhost and your Expo development URL

### Authentication Errors

**Problem**: API calls fail with 401 Unauthorized errors.

**Solution**:
- Check if token is being set properly
- Ensure token is included in the Authorization header
- Verify token format: `Bearer [your-token]`
- Check token expiration and implement refresh logic

### Data Format Mismatches

**Problem**: App crashes when processing API responses.

**Solution**:
- Add data validation before processing responses
- Use optional chaining (`?.`) to handle missing properties
- Implement proper type checking for all API data
- Add fallback values for missing or null data

### Image Handling

**Problem**: Images fail to upload or display properly.

**Solution**:
- Verify base64 encoding/decoding is correct
- Check image sizes and implement compression
- Add error handling for image loading failures
- Use placeholder images when uploads or downloads fail

### Offline Support

**Problem**: App doesn't work without internet connection.

**Solution**:
- Implement local storage with AsyncStorage
- Cache API responses for offline access
- Implement offline-first architecture
- Add synchronization when connection is restored

By following this guide, you should be able to successfully integrate your React Native app with the Azure Functions backend.