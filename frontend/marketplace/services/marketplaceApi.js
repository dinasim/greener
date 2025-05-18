// services/marketplaceApi.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import config from './config';

// Base URL for API requests
const API_BASE_URL = config.API_BASE_URL || 'https://usersfunctions.azurewebsites.net/api';

/**
 * Helper function to handle API requests with proper error handling
 * @param {string} endpoint - API endpoint to call
 * @param {Object} options - Fetch options
 * @returns {Promise<Object>} - Response data
 */
const apiRequest = async (endpoint, options = {}) => {
  try {
    // Get authentication token and user email
    const token = await AsyncStorage.getItem('googleAuthToken');
    const userEmail = await AsyncStorage.getItem('userEmail');
    
    // Default headers with authentication
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };
    
    // Add authentication headers if available
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    if (userEmail) {
      headers['X-User-Email'] = userEmail;
    }
    
    // Full URL with endpoint
    const url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;
    
    // Make the request
    const response = await fetch(url, {
      ...options,
      headers,
    });
    
    // Parse response
    let data;
    try {
      data = await response.json();
    } catch (e) {
      console.warn('Error parsing JSON response:', e);
      data = { error: 'Invalid response format' };
    }
    
    // Check for errors
    if (!response.ok) {
      throw new Error(data.error || data.message || `Request failed with status ${response.status}`);
    }
    
    return data;
  } catch (error) {
    console.error(`API request failed (${endpoint}):`, error);
    throw error;
  }
};

/**
 * Get all marketplace products with filtering and pagination
 * @param {number} page - Page number
 * @param {string} category - Category filter
 * @param {string} search - Search query
 * @param {Object} options - Additional options (minPrice, maxPrice, sortBy)
 * @returns {Promise<Object>} - Response with products array and pagination info
 */
export const getAll = async (page = 1, category = null, search = null, options = {}) => {
  const queryParams = new URLSearchParams();
  
  // Add pagination
  queryParams.append('page', page);
  
  // Add category filter if provided
  if (category) {
    queryParams.append('category', category);
  }
  
  // Add search query if provided
  if (search) {
    queryParams.append('search', search);
  }
  
  // Add price range filters if provided
  if (options.minPrice !== undefined) {
    queryParams.append('minPrice', options.minPrice);
  }
  if (options.maxPrice !== undefined) {
    queryParams.append('maxPrice', options.maxPrice);
  }
  
  // Add sort option if provided
  if (options.sortBy) {
    queryParams.append('sortBy', options.sortBy);
  }
  
  // Build endpoint with query params
  const endpoint = `marketplace/products?${queryParams.toString()}`;
  
  return apiRequest(endpoint);
};

/**
 * Get specific product details by ID
 * @param {string} id - Product ID
 * @returns {Promise<Object>} - Product details
 */
export const getSpecific = async (id) => {
  if (!id) {
    throw new Error('Product ID is required');
  }
  
  const endpoint = `marketplace/products/specific/${id}`;
  
  return apiRequest(endpoint);
};

/**
 * Add or remove product from wishlist
 * @param {string} productId - Product ID to toggle
 * @returns {Promise<Object>} - Response with updated wishlist status
 */
export const wishProduct = async (productId) => {
  if (!productId) {
    throw new Error('Product ID is required');
  }
  
  const endpoint = `marketplace/products/wish/${productId}`;
  
  return apiRequest(endpoint, {
    method: 'POST',
  });
};

/**
 * Create new product listing
 * @param {Object} productData - Product data to create
 * @returns {Promise<Object>} - Response with created product info
 */
export const createProduct = async (productData) => {
  const endpoint = 'marketplace/products/create';
  
  return apiRequest(endpoint, {
    method: 'POST',
    body: JSON.stringify(productData),
  });
};

/**
 * Update existing product
 * @param {string} productId - Product ID to update
 * @param {Object} productData - Updated product data
 * @returns {Promise<Object>} - Response with updated product
 */
export const updateProduct = async (productId, productData) => {
  const endpoint = `marketplace/products/${productId}`;
  
  return apiRequest(endpoint, {
    method: 'PATCH',
    body: JSON.stringify(productData),
  });
};

/**
 * Delete product
 * @param {string} productId - Product ID to delete
 * @returns {Promise<Object>} - Response with deletion status
 */
export const deleteProduct = async (productId) => {
  const endpoint = `marketplace/products/${productId}`;
  
  return apiRequest(endpoint, {
    method: 'DELETE',
  });
};

/**
 * Mark product as sold
 * @param {string} productId - Product ID to mark as sold
 * @param {Object} data - Optional data with buyer info
 * @returns {Promise<Object>} - Response with updated status
 */
export const markAsSold = async (productId, data = {}) => {
  const endpoint = `marketplace/products/${productId}/sold`;
  
  return apiRequest(endpoint, {
    method: 'POST',
    body: JSON.stringify(data),
  });
};

/**
 * Get user profile by ID
 * @param {string} userId - User ID to fetch
 * @returns {Promise<Object>} - User profile data
 */
export const fetchUserProfile = async (userId) => {
  if (!userId) {
    throw new Error('User ID is required');
  }
  
  const endpoint = `marketplace/users/${userId}`;
  
  return apiRequest(endpoint);
};

/**
 * Update user profile
 * @param {string} userId - User ID to update
 * @param {Object} profileData - Updated profile data
 * @returns {Promise<Object>} - Response with updated profile
 */
export const updateUserProfile = async (userId, profileData) => {
  const endpoint = `marketplace/users/${userId}`;
  
  return apiRequest(endpoint, {
    method: 'PATCH',
    body: JSON.stringify(profileData),
  });
};

/**
 * Get user's listings
 * @param {string} userId - User ID
 * @param {string} status - Filter by status (active, sold, all)
 * @returns {Promise<Object>} - Response with user's listings
 */
export const getUserListings = async (userId, status = 'all') => {
  const endpoint = `marketplace/users/${userId}/listings?status=${status}`;
  
  return apiRequest(endpoint);
};

/**
 * Get user's wishlist
 * @param {string} userId - User ID
 * @returns {Promise<Object>} - Response with user's wishlist
 */
export const getUserWishlist = async (userId) => {
  const endpoint = `marketplace/users/${userId}/wishlist`;
  
  return apiRequest(endpoint);
};

/**
 * Upload an image and get URL
 * @param {string|Blob} imageData - Image data (URI or Blob)
 * @param {string} type - Image type (plant, user, etc.)
 * @returns {Promise<Object>} - Response with image URL
 */
export const uploadImage = async (imageData, type = 'plant') => {
  if (!imageData) {
    throw new Error('Image data is required');
  }
  
  const endpoint = 'marketplace/uploadImage';
  
  // Handle different image formats based on platform
  if (Platform.OS === 'web') {
    if (imageData instanceof Blob) {
      // For web with Blob/File
      const formData = new FormData();
      formData.append('file', imageData);
      formData.append('type', type);
      
      return apiRequest(endpoint, {
        method: 'POST',
        body: formData,
        headers: {}, // Let browser set content-type with boundary
      });
    } else if (imageData.startsWith('data:')) {
      // For web with data URI
      return apiRequest(endpoint, {
        method: 'POST',
        body: JSON.stringify({ image: imageData, type }),
      });
    }
  }
  
  // For React Native with local URI
  // Create form data for file upload
  const formData = new FormData();
  formData.append('file', {
    uri: imageData,
    type: 'image/jpeg',
    name: 'upload.jpg',
  });
  formData.append('type', type);
  
  return apiRequest(endpoint, {
    method: 'POST',
    body: formData,
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
};

export const getNearbyProducts = async (latitude, longitude, radius = 10, category = null) => {
  try {
    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      throw new Error('Valid coordinates required');
    }
    
    let queryParams = `lat=${latitude}&lon=${longitude}&radius=${radius}`;
    if (category && category !== 'All') {
      queryParams += `&category=${encodeURIComponent(category)}`;
    }
    
    const headers = {
      'Content-Type': 'application/json',
    };
    
    const userEmail = await AsyncStorage.getItem('userEmail');
    if (userEmail) {
      headers['X-User-Email'] = userEmail;
    }
    
    const response = await fetch(`${API_BASE_URL}/marketplace/nearbyProducts?${queryParams}`, {
      method: 'GET',
      headers: headers,
    });
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching nearby products:', error);
    throw error;
  }
};

export const geocodeAddress = async (address) => {
  try {
    if (!address) {
      throw new Error('Address is required');
    }
    
    const response = await fetch(`${API_BASE_URL}/marketplace/geocode?address=${encodeURIComponent(address)}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error geocoding address:', error);
    throw error;
  }
};

export const reverseGeocode = async (latitude, longitude) => {
  try {
    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      throw new Error('Valid coordinates required');
    }
    
    const response = await fetch(`${API_BASE_URL}/marketplace/reverseGeocode?lat=${latitude}&lon=${longitude}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error reverse geocoding:', error);
    throw error;
  }
};

export const speechToText = async (audioUrl, language = 'en-US') => {
  if (!audioUrl) {
    throw new Error('Audio URL is required');
  }

  const endpoint = 'marketplace/speechToText';

  try {
    const response = await apiRequest(endpoint, {
      method: 'POST',
      body: JSON.stringify({ audioUrl, language }),
    });

    const text = response.text;

    // Clean up the transcription text
    const cleanupTranscriptionText = (text) => {
      return typeof text === 'string'
        ? text.replace(/[.,!?;:'"()\[\]{}]/g, '').replace(/\s+/g, ' ').trim()
        : '';
    };

    return cleanupTranscriptionText(text);
  } catch (error) {
    console.error('Error in speechToText:', error);
    throw error;
  }
};

export const getAzureMapsKey = async () => {
  try {
    const userEmail = await AsyncStorage.getItem('userEmail');
    
    const headers = {
      'Content-Type': 'application/json',
    };
    
    if (userEmail) {
      headers['X-User-Email'] = userEmail;
    }
    
    const response = await fetch(`${API_BASE_URL}/marketplace/maps-config`, {
      method: 'GET',
      headers: headers,
    });
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.azureMapsKey) {
      throw new Error('No Azure Maps key returned from server');
    }
    
    return data.azureMapsKey;
  } catch (error) {
    console.error('Error getting Azure Maps key:', error);
    throw error;
  }
};

// ==========================================
// MESSAGING FUNCTIONALITY
// ==========================================

/**
 * Get SignalR negotiate token for real-time messaging
 * @returns {Promise<Object>} - SignalR connection info
 */
export const getNegotiateToken = async () => {
  const userEmail = await AsyncStorage.getItem('userEmail');
  
  if (!userEmail) {
    throw new Error('User email is required for messaging');
  }
  
  const endpoint = 'marketplace/signalr-negotiate';
  
  return apiRequest(endpoint, {
    method: 'POST',
    body: JSON.stringify({ userId: userEmail }),
  });
};

/**
 * Get user conversations (chat rooms)
 * @param {string} userId - User ID
 * @returns {Promise<Array>} - List of conversations
 */
export const fetchConversations = async (userId) => {
  if (!userId) {
    throw new Error('User ID is required');
  }
  
  const endpoint = 'marketplace/messages/getUserConversations';
  
  return apiRequest(endpoint);
};

/**
 * Get messages for a specific conversation
 * @param {string} chatId - Conversation ID
 * @param {string} userId - User ID
 * @returns {Promise<Object>} - Response with messages
 */
export const fetchMessages = async (chatId, userId) => {
  if (!chatId) {
    throw new Error('Chat ID is required');
  }
  
  const endpoint = `marketplace/messages/getMessages/${chatId}`;
  
  return apiRequest(endpoint);
};

/**
 * Send a message in an existing conversation
 * @param {string} chatId - Conversation ID
 * @param {string} message - Message text
 * @param {string} senderId - Sender ID
 * @returns {Promise<Object>} - Response with sent message info
 */
export const sendMessage = async (chatId, message, senderId) => {
  if (!chatId || !message) {
    throw new Error('Chat ID and message are required');
  }
  
  const endpoint = 'marketplace/messages/sendMessage';
  
  return apiRequest(endpoint, {
    method: 'POST',
    body: JSON.stringify({
      chatId,
      message,
      senderId,
    }),
  });
};

/**
 * Start a new conversation
 * @param {string} sellerId - Seller ID
 * @param {string} plantId - Plant ID
 * @param {string} message - Initial message
 * @param {string} sender - Sender ID (current user)
 * @returns {Promise<Object>} - Response with new conversation info
 */
export const startConversation = async (sellerId, plantId, message, sender) => {
  if (!sellerId || !message || !sender) {
    throw new Error('Seller ID, message, and sender are required');
  }
  
  const endpoint = 'marketplace/messages/createChatRoom';
  
  return apiRequest(endpoint, {
    method: 'POST',
    body: JSON.stringify({
      receiver: sellerId,
      plantId,
      message,
      sender,
    }),
  });
};

/**
 * Mark messages as read
 * @param {string} conversationId - Conversation ID
 * @param {Array} messageIds - Optional specific message IDs to mark as read
 * @returns {Promise<Object>} - Response with updated read status
 */
export const markMessagesAsRead = async (conversationId, messageIds = []) => {
  if (!conversationId) {
    throw new Error('Conversation ID is required');
  }
  
  const endpoint = 'marketplace/messages/markAsRead';
  
  return apiRequest(endpoint, {
    method: 'POST',
    body: JSON.stringify({
      conversationId,
      messageIds,
    }),
  });
};

/**
 * Send typing indicator to other user
 * @param {string} conversationId - Conversation ID
 * @param {boolean} isTyping - Whether user is typing
 * @returns {Promise<Object>} - Response with status
 */
export const sendTypingIndicator = async (conversationId, isTyping) => {
  if (!conversationId) {
    throw new Error('Conversation ID is required');
  }
  
  const endpoint = 'marketplace/messages/typing';
  
  return apiRequest(endpoint, {
    method: 'POST',
    body: JSON.stringify({
      conversationId,
      isTyping,
    }),
  });
};

// ==========================================
// REVIEWS FUNCTIONALITY
// ==========================================

/**
 * Fetch reviews for a seller or product
 * @param {string} targetType - Target type ('seller' or 'product')
 * @param {string} targetId - Target ID
 * @returns {Promise<Object>} - Response with reviews
 */
export const fetchReviews = async (targetType, targetId) => {
  if (!targetType || !targetId) {
    throw new Error('Target type and ID are required');
  }
  
  const endpoint = `marketplace/reviews/${targetType}/${targetId}`;
  
  return apiRequest(endpoint);
};

/**
 * Submit a review for a seller or product
 * @param {string} targetId - Target ID
 * @param {string} targetType - Target type ('seller' or 'product')
 * @param {Object} reviewData - Review data {rating, text}
 * @returns {Promise<Object>} - Response with submitted review
 */
export const submitReview = async (targetId, targetType, reviewData) => {
  if (!targetId || !targetType || !reviewData) {
    throw new Error('Target ID, type, and review data are required');
  }
  
  if (!reviewData.rating || !reviewData.text) {
    throw new Error('Rating and text are required for review');
  }
  
  const endpoint = `submitreview/${targetType}/${targetId}`;
  
  return apiRequest(endpoint, {
    method: 'POST',
    body: JSON.stringify(reviewData),
  });
};

/**
 * Delete a review
 * @param {string} targetType - Target type ('seller' or 'product')
 * @param {string} targetId - Target ID
 * @param {string} reviewId - Review ID to delete
 * @returns {Promise<Object>} - Response with deletion status
 */
export const deleteReview = async (targetType, targetId, reviewId) => {
  if (!targetType || !targetId || !reviewId) {
    throw new Error('Target type, target ID, and review ID are required');
  }
  
  const endpoint = `marketplace/reviews/${targetType}/${targetId}/${reviewId}`;
  
  return apiRequest(endpoint, {
    method: 'DELETE',
  });
};

// Export all functions
export default {
  getAll,
  getSpecific,
  wishProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  markAsSold,
  fetchUserProfile,
  updateUserProfile,
  getUserListings,
  getUserWishlist,
  uploadImage,
  getNearbyProducts,
  geocodeAddress,
  reverseGeocode,
  speechToText,
  getAzureMapsKey,
  getNegotiateToken,
  fetchConversations,
  fetchMessages,
  sendMessage,
  startConversation,
  markMessagesAsRead,
  sendTypingIndicator,
  fetchReviews,
  submitReview,
  deleteReview,
};