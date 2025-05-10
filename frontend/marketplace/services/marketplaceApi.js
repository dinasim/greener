/**
 * Consolidated API service for Greener app
 * Handles all API requests and provides mock data in development
 */

import config from './config';
import { MOCK_USER, MOCK_PLANTS, getMockProducts, getMockProductById } from './mockData';

// AUTH TOKEN HANDLING
let authToken = null;

export const setAuthToken = (token) => {
  authToken = token;
  global.googleAuthToken = token; // Store it globally too
};

// HELPER FUNCTIONS
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
      throw new Error(errorData.message || `API error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`API Error (${endpoint}):`, error);
    
    // Check if we're in development mode
    if (config.isDevelopment && !config.features.useRealApi) {
      console.log('Development mode: Using mock data');
      // Return appropriate mock data based on the endpoint
      if (endpoint.includes('products')) {
        return getMockProductData(endpoint);
      } else if (endpoint.includes('user')) {
        return { user: MOCK_USER };
      } else {
        return { success: true, mockData: true };
      }
    }
    
    throw error;
  }
};

// Get mock data based on endpoint
const getMockProductData = (endpoint) => {
  if (endpoint.includes('specific')) {
    const id = endpoint.split('/').pop();
    return getMockProductById(id);
  } else {
    return getMockProducts();
  }
};

// PRODUCT API
export const getAll = async (page = 1, category = null, search = '') => {
  try {
    if (config.isDevelopment && !config.features.useRealApi) {
      return getMockProducts(category, search);
    }
    
    let endpoint = `products?page=${page}`;
    if (search) endpoint += `&search=${encodeURIComponent(search)}`;
    if (category) endpoint = `products/${encodeURIComponent(category)}?page=${page}`;
    
    return await apiRequest(endpoint);
  } catch (error) {
    console.error('Error fetching products:', error);
    return getMockProducts(category, search);
  }
};

export const getSpecific = async (id) => {
  try {
    if (config.isDevelopment && !config.features.useRealApi) {
      return getMockProductById(id);
    }
    
    return await apiRequest(`products/specific/${id}`);
  } catch (error) {
    console.error(`Error fetching product ${id}:`, error);
    return getMockProductById(id);
  }
};

export const createPlant = async (plantData) => {
  try {
    return await apiRequest('products/create', 'POST', plantData);
  } catch (error) {
    console.error('Error creating plant:', error);
    throw error;
  }
};

export const wishProduct = async (id) => {
  try {
    return await apiRequest(`products/wish/${id}`);
  } catch (error) {
    console.error(`Error toggling wishlist for product ${id}:`, error);
    // In development, simulate success
    if (config.isDevelopment) {
      return { success: true, message: 'Wishlist toggled (mock)' };
    }
    throw error;
  }
};

// USER API
export const fetchUserProfile = async () => {
  try {
    return await apiRequest('auth/getUser');
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return { user: MOCK_USER };
  }
};

export const updateUserProfile = async (id, userData) => {
  try {
    return await apiRequest(`user/edit-profile/${id}`, 'PATCH', userData);
  } catch (error) {
    console.error('Error updating user profile:', error);
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

export const startConversation = async (receiver, message) => {
  try {
    return await apiRequest('messages/createChatRoom', 'POST', { receiver, message });
  } catch (error) {
    console.error('Error starting conversation:', error);
    // In development, simulate success
    if (config.isDevelopment) {
      return { messageId: 'mock-conversation-id' };
    }
    throw error;
  }
};

export default {
  setAuthToken,
  getAll,
  getSpecific,
  createPlant,
  wishProduct,
  fetchUserProfile,
  updateUserProfile,
  fetchConversations,
  sendMessage,
  startConversation
};