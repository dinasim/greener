/**
 * marketplaceApi.js
 * API service for interacting with Azure Functions for the Marketplace feature
 */

// Base URL for Azure Functions
const API_BASE_URL = 'https://usersfunctions.azurewebsites.net/api';

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
 * @param {Object} filters - Filter options like category, search query, price range
 * @returns {Promise<Array>} Array of plant listings
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
    const endpoint = `plants${queryString ? `?${queryString}` : ''}`;
    
    return await apiRequest(endpoint);
  } catch (error) {
    console.error('Error fetching plants:', error);
    throw error;
  }
};

/**
 * Fetch a single plant by ID
 * @param {string} id - Plant ID
 * @returns {Promise<Object>} Plant details
 */
export const fetchPlantById = async (id) => {
  try {
    return await apiRequest(`plants/${id}`);
  } catch (error) {
    console.error(`Error fetching plant ${id}:`, error);
    throw error;
  }
};

/**
 * Create a new plant listing
 * @param {Object} plantData - Plant data including images
 * @returns {Promise<Object>} Created plant
 */
export const createPlant = async (plantData) => {
  try {
    // For images, we need to convert them to base64 or use a form-data approach
    // This is a simplified example
    // Ensure to handle image uploads (base64 or form-data) properly, depending on your backend setup.
    // You might need to upload the images to a storage service (like Azure Blob Storage) and send the URLs in the `plantData`.
    if (plantData.images && plantData.images.length > 0) {
      // Convert image URIs to base64 or handle as per your server's requirements
      const base64Images = await Promise.all(plantData.images.map(async (image) => {
        const response = await fetch(image);
        const blob = await response.blob();
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      }));

      plantData.images = base64Images;
    }

    return await apiRequest('plants', 'POST', plantData);
  } catch (error) {
    console.error('Error creating plant:', error);
    throw error;
  }
};

/**
 * Update an existing plant listing
 * @param {string} id - Plant ID
 * @param {Object} updates - Updated plant data
 * @returns {Promise<Object>} Updated plant
 */
export const updatePlant = async (id, updates) => {
  try {
    return await apiRequest(`plants/${id}`, 'PUT', updates);
  } catch (error) {
    console.error(`Error updating plant ${id}:`, error);
    throw error;
  }
};

/**
 * Delete a plant listing
 * @param {string} id - Plant ID
 * @returns {Promise<Object>} Deletion confirmation
 */
export const deletePlant = async (id) => {
  try {
    return await apiRequest(`plants/${id}`, 'DELETE');
  } catch (error) {
    console.error(`Error deleting plant ${id}:`, error);
    throw error;
  }
};

// FAVORITES API

/**
 * Fetch user's favorite plants
 * @returns {Promise<Array>} Array of favorite plants
 */
export const fetchFavorites = async () => {
  try {
    return await apiRequest('plants/favorites');
  } catch (error) {
    console.error('Error fetching favorites:', error);
    throw error;
  }
};

/**
 * Toggle favorite status for a plant
 * @param {string} plantId - Plant ID
 * @returns {Promise<Object>} Updated favorite status
 */
export const toggleFavoritePlant = async (plantId) => {
  try {
    return await apiRequest(`plants/${plantId}/favorite`, 'POST');
  } catch (error) {
    console.error(`Error toggling favorite for plant ${plantId}:`, error);
    throw error;
  }
};

// SELLER API

/**
 * Fetch seller profile
 * @param {string} sellerId - Seller ID
 * @returns {Promise<Object>} Seller profile
 */
export const fetchSellerProfile = async (sellerId) => {
  try {
    return await apiRequest(`users/${sellerId}`);
  } catch (error) {
    console.error(`Error fetching seller ${sellerId}:`, error);
    throw error;
  }
};

/**
 * Fetch plants by a specific seller
 * @param {string} sellerId - Seller ID
 * @returns {Promise<Array>} Array of plants from the seller
 */
export const fetchSellerPlants = async (sellerId) => {
  try {
    return await apiRequest(`users/${sellerId}/plants`);
  } catch (error) {
    console.error(`Error fetching plants for seller ${sellerId}:`, error);
    throw error;
  }
};

// USER PROFILE API

/**
 * Fetch current user's profile
 * @returns {Promise<Object>} User profile
 */
export const fetchUserProfile = async () => {
  try {
    return await apiRequest('users/me');
  } catch (error) {
    console.error('Error fetching user profile:', error);
    throw error;
  }
};

/**
 * Update user profile
 * @param {Object} updates - Profile updates
 * @returns {Promise<Object>} Updated profile
 */
export const updateUserProfile = async (updates) => {
  try {
    return await apiRequest('users/me', 'PUT', updates);
  } catch (error) {
    console.error('Error updating user profile:', error);
    throw error;
  }
};

// MESSAGING API

/**
 * Fetch user's conversations
 * @returns {Promise<Array>} Array of conversations
 */
export const fetchConversations = async () => {
  try {
    return await apiRequest('messages/conversations');
  } catch (error) {
    console.error('Error fetching conversations:', error);
    throw error;
  }
};

/**
 * Fetch messages for a specific conversation
 * @param {string} conversationId - Conversation ID
 * @returns {Promise<Object>} Conversation with messages
 */
export const fetchMessages = async (conversationId) => {
  try {
    return await apiRequest(`messages/conversations/${conversationId}`);
  } catch (error) {
    console.error(`Error fetching messages for conversation ${conversationId}:`, error);
    throw error;
  }
};

/**
 * Send a message in an existing conversation
 * @param {string} conversationId - Conversation ID
 * @param {string} message - Message text
 * @returns {Promise<Object>} Sent message
 */
export const sendMessage = async (conversationId, message) => {
  try {
    return await apiRequest(`messages/conversations/${conversationId}`, 'POST', { message });
  } catch (error) {
    console.error(`Error sending message in conversation ${conversationId}:`, error);
    throw error;
  }
};

/**
 * Start a new conversation with a seller about a plant
 * @param {string} sellerId - Seller ID
 * @param {string} plantId - Plant ID
 * @param {string} initialMessage - First message to send
 * @returns {Promise<Object>} New conversation with first message
 */
export const startConversation = async (sellerId, plantId, initialMessage) => {
  try {
    return await apiRequest('messages/conversations', 'POST', {
      sellerId,
      plantId,
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
  updatePlant,
  deletePlant,
  fetchFavorites,
  toggleFavoritePlant,
  fetchSellerProfile,
  fetchSellerPlants,
  fetchUserProfile,
  updateUserProfile,
  fetchConversations,
  sendMessage,
  startConversation
};
