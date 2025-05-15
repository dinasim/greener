// Frontend: services/marketplaceApi.js
import config from './config';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import { MOCK_USER, MOCK_PLANTS, getMockProducts, getMockProductById, getMockMessageData } from './mockData';
import { Platform } from 'react-native';


// API Base URL points to Azure Functions
const API_BASE_URL = config.api.baseUrl;

// AUTH TOKEN HANDLING
let authToken = null;

export const setAuthToken = async (token) => {
  try {
    authToken = token;
    global.googleAuthToken = token;
    await AsyncStorage.setItem('googleAuthToken', token);
    console.log('Auth token set successfully');
    return true;
  } catch (error) {
    console.error('Error setting auth token:', error);
    return false;
  }
};

export const initializeAuthToken = async () => {
  try {
    const token = await AsyncStorage.getItem('googleAuthToken');
    if (token) {
      authToken = token;
      global.googleAuthToken = token;
      console.log('Auth token initialized from storage');
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error initializing auth token:', error);
    return false;
  }
};

// HELPER FUNCTIONS
const apiRequest = async (endpoint, method = 'GET', body = null) => {
  try {
    // Get the user's email from AsyncStorage for request identification
    const userEmail = await AsyncStorage.getItem('userEmail');
    
    const headers = {
      'Content-Type': 'application/json',
    };

    // Add auth token if available
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    // Add user email for identification if available
    if (userEmail) {
      headers['X-User-Email'] = userEmail;
      
      // Add userId parameter to endpoint if it doesn't already have it
      if (!endpoint.includes('userId=') && !endpoint.includes('email=')) {
        endpoint += endpoint.includes('?') ? `&userId=${encodeURIComponent(userEmail)}` : `?userId=${encodeURIComponent(userEmail)}`;
      }
    }

    const options = {
      method,
      headers,
    };

    if (body) {
      // Add user email to body if not already present and it's a POST/PUT/PATCH
      if (userEmail && body && typeof body === 'object' && !body.userId && !body.email && method !== 'GET') {
        body.userId = userEmail;
      }
      
      options.body = JSON.stringify(body);
    }

    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Request timeout')), config.api.timeout);
    });

    const fetchPromise = fetch(`${API_BASE_URL}/${endpoint}`, options);
    const response = await Promise.race([fetchPromise, timeoutPromise]);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `API error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`API Error (${endpoint}):`, error);

    if (config.features.useMockOnError) {
      console.log('Using mock data due to API error');
      if (endpoint.includes('products') || endpoint.includes('plants')) {
        return getMockProductData(endpoint);
      } else if (endpoint.includes('user')) {
        return { user: MOCK_USER };
      } else if (endpoint.includes('messages')) {
        return getMockMessageData(endpoint);
      } else {
        return { success: true, mockData: true };
      }
    }

    throw error;
  }
};

const getMockProductData = (endpoint) => {
  // Handle different endpoint patterns
  if (endpoint.includes('specific')) {
    const id = endpoint.split('/').pop();
    return getMockProductById(id);
  } else if (endpoint.includes('wish')) {
    // Wishlist toggle endpoint
    return { 
      success: true, 
      isWished: Math.random() > 0.5, // Random toggle
      message: 'Wishlist updated (mock)', 
      status: 'success' 
    };
  } else {
    // Default products endpoint
    const params = new URLSearchParams(endpoint.split('?')[1] || '');
    const category = params.get('category');
    const search = params.get('search');
    return getMockProducts(category, search);
  }
};

// PRODUCT API
export const getAll = async (page = 1, category = null, search = '', filters = {}) => {
  try {
    let endpoint = `marketplace/products?page=${page}`;
    if (search) endpoint += `&search=${encodeURIComponent(search)}`;
    if (category && category !== 'All') endpoint += `&category=${encodeURIComponent(category)}`;
    
    // Add any additional filters
    if (filters) {
      if (filters.minPrice) endpoint += `&minPrice=${filters.minPrice}`;
      if (filters.maxPrice) endpoint += `&maxPrice=${filters.maxPrice}`;
      if (filters.sortBy) endpoint += `&sortBy=${filters.sortBy}`;
      if (filters.sortOrder) endpoint += `&sortOrder=${filters.sortOrder}`;
    }

    return await apiRequest(endpoint);
  } catch (error) {
    console.error('Error fetching products:', error);
    if (config.features.useMockOnError) {
      return getMockProducts(category, search);
    }
    throw error;
  }
};

export const getSpecific = async (id) => {
  try {
    return await apiRequest(`marketplace/products/specific/${id}`);
  } catch (error) {
    console.error(`Error fetching product ${id}:`, error);
    if (config.features.useMockOnError) {
      return getMockProductById(id);
    }
    throw error;
  }
};

export const createPlant = async (plantData) => {
  try {
    // Get user email for seller attribution
    const userEmail = await AsyncStorage.getItem('userEmail');
    if (userEmail) {
      plantData.sellerId = userEmail;
    }

    return await apiRequest('marketplace/products/create', 'POST', plantData);
  } catch (error) {
    console.error('Error creating plant:', error);
    throw error;
  }
};

export const wishProduct = async (id) => {
  try {
    return await apiRequest(`marketplace/products/wish/${id}`, 'POST');
  } catch (error) {
    console.error(`Error toggling wishlist for product ${id}:`, error);
    if (config.features.useMockOnError) {
      return { success: true, message: 'Wishlist toggled (mock)' };
    }
    throw error;
  }
};

// Delete Product API
export const deleteProduct = async (productId) => {
  try {
    return await apiRequest(`marketplace/products/${productId}`, 'DELETE');
  } catch (error) {
    console.error(`Error deleting product ${productId}:`, error);
    if (config.features.useMockOnError) {
      return { success: true, message: 'Product deleted successfully (mock)' };
    }
    throw error;
  }
};

// Update Product API
export const updateProduct = async (productId, updateData) => {
  try {
    return await apiRequest(`marketplace/products/${productId}`, 'PATCH', updateData);
  } catch (error) {
    console.error(`Error updating product ${productId}:`, error);
    if (config.features.useMockOnError) {
      return { 
        success: true, 
        message: 'Product updated successfully (mock)',
        product: { ...getMockProductById(productId), ...updateData }
      };
    }
    throw error;
  }
};

// Mark Product as Sold API
export const markProductAsSold = async (productId, buyerInfo = null) => {
  try {
    return await apiRequest(`marketplace/products/${productId}/sold`, 'POST', buyerInfo);
  } catch (error) {
    console.error(`Error marking product ${productId} as sold:`, error);
    if (config.features.useMockOnError) {
      return { success: true, message: 'Product marked as sold successfully (mock)' };
    }
    throw error;
  }
};

// MESSAGING API
export const fetchConversations = async () => {
  try {
    return await apiRequest(`marketplace/messages/getUserConversations`);
  } catch (error) {
    console.error('Error fetching conversations:', error);
    if (config.features.useMockOnError) {
      return getMockMessageData('getUserConversations');
    }
    throw error;
  }
};

export const fetchMessages = async (conversationId) => {
  try {
    return await apiRequest(`marketplace/messages/getMessages/${conversationId}`);
  } catch (error) {
    console.error('Error fetching messages:', error);
    if (config.features.useMockOnError) {
      return getMockMessageData(`messages/${conversationId}`);
    }
    throw error;
  }
};

export const sendMessage = async (chatId, message) => {
  try {
    return await apiRequest('marketplace/messages/sendMessage', 'POST', { 
      chatId, 
      message
    });
  } catch (error) {
    console.error('Error sending message:', error);
    if (config.features.useMockOnError) {
      return getMockMessageData('sendMessage');
    }
    throw error;
  }
};

export const startConversation = async (receiver, plantId, message) => {
  try {
    // Get user email for sender identification
    const userEmail = await AsyncStorage.getItem('userEmail');
    
    return await apiRequest('marketplace/messages/createChatRoom', 'POST', { 
      receiver, 
      plantId, 
      message,
      sender: userEmail
    });
  } catch (error) {
    console.error('Error starting conversation:', error);
    if (config.features.useMockOnError) {
      return getMockMessageData('createChatRoom');
    }
    throw error;
  }
};

// Typing Indicator API
export const sendTypingIndicator = async (conversationId, isTyping) => {
  try {
    return await apiRequest('marketplace/messages/typing', 'POST', {
      conversationId,
      isTyping
    });
  } catch (error) {
    console.error('Error sending typing indicator:', error);
    // Don't throw for typing indicators as they're not critical
    return { success: false };
  }
};

// Mark Messages as Read API
export const markMessagesAsRead = async (conversationId, messageIds = []) => {
  try {
    return await apiRequest('marketplace/messages/markAsRead', 'POST', {
      conversationId,
      messageIds
    });
  } catch (error) {
    console.error('Error marking messages as read:', error);
    // Don't throw for read receipts as they're not critical
    return { success: false };
  }
};

// USER API
export const fetchUserProfile = async (userId = null) => {
  try {
    // If no userId provided, use current user
    if (!userId) {
      userId = await AsyncStorage.getItem('userEmail');
    }

    return await apiRequest(`marketplace/users/${encodeURIComponent(userId)}`);
  } catch (error) {
    console.error('Error fetching user profile:', error);
    if (config.features.useMockOnError) {
      return { user: MOCK_USER };
    }
    throw error;
  }
};

export const updateUserProfile = async (id, userData) => {
  try {
    return await apiRequest(`marketplace/users/${encodeURIComponent(id)}`, 'PATCH', userData);
  } catch (error) {
    console.error('Error updating user profile:', error);
    if (config.features.useMockOnError) {
      return { 
        success: true, 
        user: { ...MOCK_USER, ...userData },
        message: "Profile updated successfully (mock)"
      };
    }
    throw error;
  }
};

// User Wishlist API
export const getUserWishlist = async () => {
  try {
    // Get the current user's email
    const userEmail = await AsyncStorage.getItem('userEmail');
    if (!userEmail) {
      throw new Error('User is not authenticated');
    }
    
    return await apiRequest(`marketplace/users/${encodeURIComponent(userEmail)}/wishlist`);
  } catch (error) {
    console.error('Error fetching user wishlist:', error);
    if (config.features.useMockOnError) {
      return { wishlist: MOCK_USER.favorites || [] };
    }
    throw error;
  }
};

// User Listings API
export const getUserListings = async (status = null) => {
  try {
    // Get the current user's email
    const userEmail = await AsyncStorage.getItem('userEmail');
    if (!userEmail) {
      throw new Error('User is not authenticated');
    }
    
    let endpoint = `marketplace/users/${encodeURIComponent(userEmail)}/listings`;
    if (status) {
      endpoint += `?status=${status}`;
    }
    
    return await apiRequest(endpoint);
  } catch (error) {
    console.error('Error fetching user listings:', error);
    if (config.features.useMockOnError) {
      const listings = MOCK_USER.listings || [];
      
      if (status === 'active') {
        return { listings: listings.filter(l => l.status === 'active') };
      } else if (status === 'sold') {
        return { listings: listings.filter(l => l.status === 'sold') };
      } else {
        return { 
          active: listings.filter(l => l.status === 'active'),
          sold: listings.filter(l => l.status === 'sold'),
          deleted: [],
          count: {
            active: listings.filter(l => l.status === 'active').length,
            sold: listings.filter(l => l.status === 'sold').length,
            deleted: 0,
            total: listings.length
          }
        };
      }
    }
    throw error;
  }
};

// Image Upload API
export const uploadImage = async (imageUri, type = 'plant') => {
  try {
    const userEmail = await AsyncStorage.getItem('userEmail');

    if (Platform.OS === 'web') {
      // Web uses FormData
      const formData = new FormData();
      formData.append('image', {
        uri: imageUri,
        name: `upload_${Date.now()}.jpg`,
        type: 'image/jpeg',
      });
      formData.append('type', type);

      const response = await fetch(`${API_BASE_URL}/marketplace/uploadImage`, {
        method: 'POST',
        body: formData,
        headers: {
          'Authorization': authToken ? `Bearer ${authToken}` : '',
        },
      });

      if (!response.ok) {
        throw new Error(`Web upload failed: ${response.status}`);
      }

      return await response.json();
    } else {
      // Mobile: convert to base64
      const base64 = await FileSystem.readAsStringAsync(imageUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const res = await apiRequest('marketplace/uploadImage', 'POST', {
        image: `data:image/jpeg;base64,${base64}`,
        type,
      });

      return res;
    }
  } catch (error) {
    console.error('Image upload error:', error);
    throw error;
  }
};

// SignalR API
export const getNegotiateToken = async () => {
  try {
    // Get user email for identification
    const userEmail = await AsyncStorage.getItem('userEmail');
    if (!userEmail) {
      throw new Error('User not authenticated');
    }

    return await apiRequest(`marketplace/signalr-negotiate?userId=${encodeURIComponent(userEmail)}`, 'POST');
  } catch (error) {
    console.error('Error getting SignalR negotiate token:', error);
    throw error;
  }
};

// Location and Maps API
export const geocodeAddress = async (address) => {
  try {
    return await apiRequest(`marketplace/geocode?address=${encodeURIComponent(address)}`);
  } catch (error) {
    console.error('Error geocoding address:', error);
    if (config.features.useMockOnError) {
      // Generate mock coordinates from hash of address
      const hash = address.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      return {
        latitude: 32.0853 + (hash % 20 - 10) / 100,
        longitude: 34.7818 + (hash % 20 - 10) / 100,
        city: address.split(',')[0],
        country: 'Israel'
      };
    }
    throw error;
  }
};

// Nearby Products API
export const getNearbyProducts = async (latitude, longitude, radius = 10, category = null) => {
  try {
    let endpoint = `marketplace/nearbyProducts?lat=${latitude}&lon=${longitude}&radius=${radius}`;
    
    if (category && category !== 'All') {
      endpoint += `&category=${encodeURIComponent(category)}`;
    }
    
    return await apiRequest(endpoint);
  } catch (error) {
    console.error('Error getting nearby products:', error);
    if (config.features.useMockOnError) {
      // Generate mock nearby products
      return {
        products: MOCK_PLANTS.map(plant => ({
          ...plant,
          distance: Math.random() * radius
        })).slice(0, 5),
        count: 5
      };
    }
    throw error;
  }
};

// User Plant API (main app integration)
export const getUserPlantsByLocation = async (location) => {
  try {
    // Get user email
    const userEmail = await AsyncStorage.getItem('userEmail');
    
    return await apiRequest(`getUserPlantsByLocation?email=${encodeURIComponent(userEmail)}&location=${encodeURIComponent(location)}`);
  } catch (error) {
    console.error('Error getting user plants by location:', error);
    throw error;
  }
};

export const getUserLocations = async () => {
  try {
    // Get user email
    const userEmail = await AsyncStorage.getItem('userEmail');
    
    return await apiRequest(`getUserLocations?email=${encodeURIComponent(userEmail)}`);
  } catch (error) {
    console.error('Error getting user locations:', error);
    throw error;
  }
};

export const identifyPlantPhoto = async (photoFormData) => {
  try {
    // This needs a custom request function since it's multipart/form-data
    const response = await fetch(`${API_BASE_URL}/identifyPlantPhoto`, {
      method: 'POST',
      body: photoFormData,
      headers: {
        'Authorization': authToken ? `Bearer ${authToken}` : '',
      }
    });
    
    if (!response.ok) {
      throw new Error(`Plant identification failed: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error identifying plant photo:', error);
    throw error;
  }
};

// Form multipart/form-data for image upload
export const createImageFormData = async (uri, name = 'image', type = 'image/jpeg') => {
  const formData = new FormData();
  formData.append('image', {
    uri,
    name: name,
    type: type,
  });
  return formData;
};

// Export the API
export default {
  // Auth methods
  setAuthToken,
  initializeAuthToken,
  
  // Product methods
  getAll,
  getSpecific,
  createPlant,
  updateProduct,
  deleteProduct,
  wishProduct,
  markProductAsSold,
  
  // User methods
  fetchUserProfile,
  updateUserProfile,
  getUserWishlist,
  getUserListings,
  
  // Messaging methods
  fetchConversations,
  fetchMessages,
  sendMessage,
  startConversation,
  markMessagesAsRead,
  sendTypingIndicator,
  getNegotiateToken,
  
  // Location methods
  geocodeAddress,
  getNearbyProducts,
  
  // Image methods
  uploadImage,
  createImageFormData,
  
  // Main app integration
  getUserPlantsByLocation,
  getUserLocations,
  identifyPlantPhoto
};