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


// In services/marketplaceApi.js
// Fix for update-product API in marketplaceApi.js

/**
 * Update an existing product with improved error handling and debugging
 * @param {string} productId - The ID of the product to update
 * @param {Object} updateData - The data to update the product with
 * @returns {Promise<Object>} The response from the server
 */
export const updateProduct = async (productId, updateData) => {
  try {
    if (!productId) {
      throw new Error('Product ID is required');
    }
    
    console.log(`Updating product ${productId}:`, updateData);
    
    // Process any image updates before sending to API
    const processedUpdateData = { ...updateData };
    
    // Process main image if it's a local file
    if (processedUpdateData.image && typeof processedUpdateData.image === 'string' && 
        (processedUpdateData.image.startsWith('file:') || processedUpdateData.image.startsWith('data:'))) {
      try {
        console.log('Uploading updated main image...');
        const uploadResult = await uploadImage(processedUpdateData.image, 'plant');
        
        if (uploadResult && uploadResult.url) {
          console.log('Main image uploaded successfully:', uploadResult.url);
          processedUpdateData.image = uploadResult.url;
        } else {
          console.warn('Image upload returned unexpected result:', uploadResult);
        }
      } catch (err) {
        console.error('Failed to upload updated main image:', err);
        // Continue with update but with original image
        delete processedUpdateData.image;
      }
    }
    
    // Process additional images array if present
    if (Array.isArray(processedUpdateData.images)) {
      const processedImages = [];
      let uploadFailed = false;
      
      console.log(`Processing ${processedUpdateData.images.length} additional images...`);
      
      for (const imgUri of processedUpdateData.images) {
        // Only process if it's a local file
        if (typeof imgUri === 'string' && 
            (imgUri.startsWith('file:') || imgUri.startsWith('data:'))) {
          try {
            const uploadResult = await uploadImage(imgUri, 'plant');
            
            if (uploadResult && uploadResult.url) {
              processedImages.push(uploadResult.url);
            } else {
              console.warn('Additional image upload returned unexpected result:', uploadResult);
              uploadFailed = true;
            }
          } catch (err) {
            console.error('Failed to upload additional image:', err);
            uploadFailed = true;
          }
        } else {
          // Keep existing remote URLs
          processedImages.push(imgUri);
        }
      }
      
      if (uploadFailed) {
        console.warn('Some images failed to upload. Proceeding with the images that succeeded.');
      }
      
      processedUpdateData.images = processedImages;
    }
    
    // Make the API request
    // First try with PATCH which is the correct method
    try {
      console.log(`Sending PATCH request to marketplace/products/${productId}`);
      const result = await apiRequest(`marketplace/products/${productId}`, 'PATCH', processedUpdateData);
      console.log('Update successful with PATCH:', result);
      return result;
    } catch (patchError) {
      // If PATCH fails with 404 or 405, try with PUT as fallback
      if (patchError.message && (
          patchError.message.includes('404') || 
          patchError.message.includes('405') ||
          patchError.message.includes('Method Not Allowed'))) {
        console.log('PATCH failed, trying PUT instead...');
        try {
          const result = await apiRequest(`marketplace/products/${productId}`, 'PUT', processedUpdateData);
          console.log('Update successful with PUT:', result);
          return result;
        } catch (putError) {
          console.error('Both PATCH and PUT failed:', putError);
          throw putError;
        }
      } else {
        // Re-throw other errors
        throw patchError;
      }
    }
  } catch (error) {
    console.error(`Error updating product ${productId}:`, error);
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


// User Profile methods
export const fetchUserProfile = async (userId) => {
  try {
    const API_BASE_URL = 'https://usersfunctions.azurewebsites.net/api';
    const userEmail = await AsyncStorage.getItem('userEmail');
    
    const url = `${API_BASE_URL}/marketplace/users/${userId}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Email': userEmail || userId
      }
    });
    
    if (!response.ok) {
      throw new Error(`Error fetching user profile: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error in fetchUserProfile:', error);
    throw error;
  }
};

export const updateUserProfile = async (userId, userData) => {
  try {
    const API_BASE_URL = 'https://usersfunctions.azurewebsites.net/api';
    const userEmail = await AsyncStorage.getItem('userEmail');
    
    const url = `${API_BASE_URL}/marketplace/users/${userId}`;
    
    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Email': userEmail || userId
      },
      body: JSON.stringify(userData)
    });
    
    if (!response.ok) {
      throw new Error(`Error updating user profile: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error in updateUserProfile:', error);
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


// Enhanced version of the uploadImage function for services/marketplaceApi.js

/**
 * Upload an image or audio file to the Azure Function backend
 * With proper content type handling and improved WebM support
 * @param {string} fileUri - URI or base64 data of the file
 * @param {string} type - File category ('plant', 'avatar', 'speech', etc.)
 * @returns {Promise<Object>} - Response from the server with URL
 */
export const uploadImage = async (fileUri, type = 'plant') => {
  try {
    if (!fileUri) {
      throw new Error('File URI is required');
    }
    
    console.log(`Uploading ${type} file from: ${fileUri.substring(0, 50)}...`);
    
    // Get user email for attribution
    const userEmail = await AsyncStorage.getItem('userEmail');
    
    // Define the upload endpoint
    const uploadEndpoint = `${API_BASE_URL}/marketplace/uploadImage`;
    
    // Determine correct content type based on file type
    let contentType = 'image/jpeg'; // Default
    
    if (type === 'speech') {
      // For speech files, explicitly set audio content type
      contentType = Platform.OS === 'web' ? 'audio/webm' : 'audio/wav';
    } else if (fileUri) {
      // Try to determine from URI for other types
      if (fileUri.endsWith('.png')) {
        contentType = 'image/png';
      } else if (fileUri.endsWith('.gif')) {
        contentType = 'image/gif';
      } else if (fileUri.endsWith('.webm')) {
        contentType = 'audio/webm';
      } else if (fileUri.endsWith('.wav')) {
        contentType = 'audio/wav';
      } else if (fileUri.endsWith('.mp3')) {
        contentType = 'audio/mp3';
      } else if (fileUri.startsWith('data:')) {
        // Extract MIME type from data URI if available
        const mimeMatch = fileUri.match(/^data:([^;]+);/);
        if (mimeMatch && mimeMatch[1]) {
          contentType = mimeMatch[1];
        }
      }
    }
    
    // Different upload methods for web vs native
    if (Platform.OS === 'web') {
      console.log('Using web upload method with content type:', contentType);
      
      // Handle data URIs directly for web platform
      if (fileUri.startsWith('data:')) {
        console.log('Direct upload of data URI');
        
        // Send data URI directly in JSON payload
        const body = {
          image: fileUri, // Send full data URI
          type,
          userId: userEmail,
          contentType
        };
        
        const response = await fetch(uploadEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {})
          },
          body: JSON.stringify(body)
        });
        
        if (!response.ok) {
          let errorText;
          try {
            const errorJson = await response.json();
            errorText = errorJson.error || errorJson.message || JSON.stringify(errorJson);
          } catch (e) {
            errorText = await response.text();
          }
          throw new Error(`Upload failed (${response.status}): ${errorText}`);
        }
        
        const result = await response.json();
        console.log('Direct upload successful');
        return result;
      }
      // Handle blob URIs for web platform
      else if (fileUri.startsWith('blob:')) {
        console.log('Processing blob URI');
        
        // Fetch blob from URI
        const response = await fetch(fileUri);
        const blob = await response.blob();
        
        // Create form data
        const formData = new FormData();
        
        // Generate filename with proper extension
        let extension = '.jpg';
        if (contentType === 'audio/webm') {
          extension = '.webm';
        } else if (contentType === 'audio/wav') {
          extension = '.wav';
        } else if (contentType === 'image/png') {
          extension = '.png';
        }
        
        const timestamp = Date.now();
        const filename = `${type}_${timestamp}${extension}`;
        
        // Directly append blob with filename and content type
        formData.append('file', blob, filename);
        formData.append('type', type);
        formData.append('contentType', contentType);
        
        if (userEmail) {
          formData.append('userId', userEmail);
        }
        
        // Make the upload request
        console.log(`Uploading ${filename} with content type ${contentType}`);
        const uploadResponse = await fetch(uploadEndpoint, {
          method: 'POST',
          body: formData,
          headers: authToken ? { 'Authorization': `Bearer ${authToken}` } : {},
        });
        
        if (!uploadResponse.ok) {
          let errorMessage = '';
          try {
            const errorJson = await uploadResponse.json();
            errorMessage = errorJson.error || errorJson.message || '';
          } catch (e) {
            errorMessage = await uploadResponse.text();
          }
          
          throw new Error(`Upload failed (${uploadResponse.status}): ${errorMessage}`);
        }
        
        const result = await uploadResponse.json();
        console.log('Upload successful:', result);
        return result;
      }
    } 
    // Native platform upload
    else {
      console.log('Using native upload method');
      
      // Handle base64 data URIs directly
      if (fileUri.startsWith('data:')) {
        console.log('Uploading data URI directly');
        
        const body = {
          image: fileUri,
          type,
          userId: userEmail,
          contentType
        };
        
        const response = await fetch(uploadEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {})
          },
          body: JSON.stringify(body)
        });
        
        if (!response.ok) {
          throw new Error(`Upload failed with status: ${response.status}`);
        }
        
        const result = await response.json();
        console.log('Direct upload successful');
        return result;
      }
      
      // File URI handling - convert to base64 first
      try {
        console.log('Checking file info...');
        const fileInfo = await FileSystem.getInfoAsync(fileUri);
        
        if (!fileInfo.exists) {
          throw new Error(`File does not exist at path: ${fileUri}`);
        }
        
        console.log(`Reading file as base64. Size: ${fileInfo.size} bytes`);
        
        try {
          // Try reading as base64
          console.log('Reading file as base64...');
          const base64 = await FileSystem.readAsStringAsync(fileUri, {
            encoding: FileSystem.EncodingType.Base64,
          });
          
          console.log(`File read successful, base64 length: ${base64.length}`);
          
          // Create data URI with the appropriate mime type
          const dataUri = `data:${contentType};base64,${base64}`;
          
          // Send as JSON
          console.log(`Sending base64 data to server with content type: ${contentType}`);
          const result = await apiRequest('marketplace/uploadImage', 'POST', {
            image: dataUri,
            type,
            userId: userEmail,
            contentType
          });
          
          console.log('Upload successful:', result);
          return result;
        } catch (readError) {
          // If reading as base64 fails, fall back to FormData
          console.error('Error reading as base64, falling back to FormData:', readError);
          
          const timestamp = Date.now();
          const filename = `${type}_${timestamp}${type === 'speech' ? '.wav' : '.jpg'}`;
          
          const formData = new FormData();
          
          formData.append('image', {
            uri: fileUri,
            name: filename,
            type: contentType,
          });
          
          formData.append('type', type);
          formData.append('contentType', contentType);
          
          if (userEmail) {
            formData.append('userId', userEmail);
          }
          
          console.log(`Sending file using FormData fallback with content type: ${contentType}`);
          const response = await fetch(uploadEndpoint, {
            method: 'POST',
            body: formData,
            headers: authToken ? { 'Authorization': `Bearer ${authToken}` } : {},
          });
          
          if (!response.ok) {
            let errorText;
            try {
              const errorJson = await response.json();
              errorText = errorJson.error || errorJson.message || JSON.stringify(errorJson);
            } catch (e) {
              errorText = await response.text();
            }
            
            throw new Error(`Upload failed (${response.status}): ${errorText}`);
          }
          
          const result = await response.json();
          console.log('FormData upload successful:', result);
          return result;
        }
      } catch (fileError) {
        console.error('File error:', fileError);
        throw new Error(`File processing error: ${fileError.message}`);
      }
    }
  } catch (error) {
    console.error('File upload error:', error);
    throw error;
  }
}

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
/**
 * Geocode an address to get coordinates
 * @param {string} address The address to geocode
 * @returns {Promise<Object>} Location data with coordinates
 */
export const geocodeAddress = async (address) => {
  try {
    if (!address || address === 'Unknown location' || address.length < 3) {
      throw new Error('Invalid address for geocoding');
    }

    // Check for cached geocode results first
    const cacheKey = `geocode_${address.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
    try {
      const cachedData = await AsyncStorage.getItem(cacheKey);
      if (cachedData) {
        return JSON.parse(cachedData);
      }
    } catch (e) {
      // Failed to check cache, continue with API request
      console.warn('Failed to check geocode cache:', e);
    }

    // Development mockup mode
    if (config.isDevelopment && !config.features.useRealApi) {
      // Generate mock coordinates from hash of address
      const hash = address.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      const mockResult = {
        latitude: 32.0853 + (hash % 20 - 10) / 100,
        longitude: 34.7818 + (hash % 20 - 10) / 100,
        city: address.split(',')[0],
        country: 'Israel'
      };
      
      // Cache the mock result
      try {
        await AsyncStorage.setItem(cacheKey, JSON.stringify(mockResult));
      } catch (e) {
        console.warn('Failed to cache geocode result:', e);
      }
      
      return mockResult;
    }

    // Make the API request
    const response = await apiRequest(`marketplace/geocode?address=${encodeURIComponent(address)}`);
    
    // Cache the result
    if (response && response.latitude && response.longitude) {
      try {
        await AsyncStorage.setItem(cacheKey, JSON.stringify(response));
      } catch (e) {
        console.warn('Failed to cache geocode result:', e);
      }
    }
    
    return response;
  } catch (error) {
    console.error('Error geocoding address:', error);
    throw error;
  }
};

// Nearby Products API
/**
 * Get nearby products within a radius from location
 * @param {number} latitude Latitude coordinate
 * @param {number} longitude Longitude coordinate
 * @param {number} radius Radius in kilometers (default: 10)
 * @param {string} category Optional category filter
 * @returns {Promise<Object>} Object containing nearby products
 */
export const getNearbyProducts = async (latitude, longitude, radius = 10, category = null) => {
  try {
    let endpoint = `marketplace/nearbyProducts?lat=${latitude}&lon=${longitude}&radius=${radius}`;
    
    if (category && category !== 'All') {
      endpoint += `&category=${encodeURIComponent(category)}`;
    }
    
    return await apiRequest(endpoint);
  } catch (error) {
    console.error('Error getting nearby products:', error);
    
    if (config.features.useMockOnError || (config.isDevelopment && !config.features.useRealApi)) {
      // Generate mock nearby products
      const mockProducts = [];
      
      // Create 5-10 mock products
      const count = 5 + Math.floor(Math.random() * 6);
      
      for (let i = 0; i < count; i++) {
        // Generate a random position within the radius
        const angle = Math.random() * Math.PI * 2;
        const distance = Math.random() * radius;
        
        // Convert distance to lat/lon offset (approximate)
        const latOffset = distance * Math.cos(angle) / 111; // 1 degree lat is about 111 km
        const lonOffset = distance * Math.sin(angle) / (111 * Math.cos(latitude * Math.PI / 180));
        
        mockProducts.push({
          id: `nearby-${i}`,
          title: `${category || 'Plant'} ${i+1}`,
          price: (Math.random() * 50 + 5).toFixed(2),
          category: category || 'Indoor Plants',
          location: {
            latitude: latitude + latOffset,
            longitude: longitude + lonOffset,
            city: 'Nearby Location'
          },
          image: `https://via.placeholder.com/150?text=Plant${i+1}`,
          description: 'This is a mock plant generated for the map view.',
          distance: distance,
          seller: {
            name: 'Local Seller',
            _id: `seller-${i}`
          }
        });
      }
      
      return { 
        products: mockProducts,
        count: mockProducts.length,
        center: {
          latitude,
          longitude
        },
        radius
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

/**
 * Mark a product as sold
 * @param {string} productId - The ID of the product to mark as sold
 * @param {Object} buyerInfo - Optional information about the buyer
 * @returns {Promise<Object>} The response from the API
 */
export const markProductAsSold = async (productId, transactionInfo = {}) => {
  try {
    return await apiRequest(`marketplace/products/${productId}/sold`, 'POST', transactionInfo);
  } catch (error) {
    console.error(`Error marking product ${productId} as sold:`, error);
    
    if (config.features.useMockOnError || (config.isDevelopment && !config.features.useRealApi)) {
      return { 
        success: true, 
        message: 'Product marked as sold successfully (mock)',
        productId
      };
    }
    
    throw error;
  }
};
/**
 * Get user's current location if available
 * @returns {Promise<Object>} Location object with coordinates
 */
export const getCurrentLocation = async () => {
  try {
    // Check if we have cached location
    const cachedLocation = await AsyncStorage.getItem('@UserLocation');
    if (cachedLocation) {
      return JSON.parse(cachedLocation);
    }
    
    // Request location permission
    if (Platform.OS !== 'web') {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        throw new Error('Location permission denied');
      }
    }
    
    // Get current location
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced
    });
    
    const result = {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      accuracy: location.coords.accuracy,
      timestamp: location.timestamp
    };
    
    // Cache the result
    await AsyncStorage.setItem('@UserLocation', JSON.stringify(result));
    
    return result;
  } catch (error) {
    console.error('Error getting current location:', error);
    throw error;
  }
};


/**
 * Get reviews for a product or seller
 * @param {string} targetType - The type of review target ('seller' or 'product')
 * @param {string} targetId - ID of the review target
 * @returns {Promise<Object>} - The response with reviews array
 */
export const fetchReviews = async (targetType, targetId) => {
  try {
    // Validate inputs
    if (!targetId || !targetType) {
      throw new Error('Target ID and type are required');
    }
    
    // URL encode targetId to handle special characters
    const encodedTargetId = encodeURIComponent(targetId);
    
    // Use the correct endpoint format that matches your backend route
    const endpoint = `marketplace/reviews/${targetType}/${encodedTargetId}`;
    
    console.log(`Fetching reviews for ${targetType} ${targetId}...`);
    console.log(`Using endpoint: ${endpoint}`);
    
    return await apiRequest(endpoint);
  } catch (error) {
    console.error(`Error fetching ${targetType} reviews:`, error);
    
    if (config.features.useMockOnError) {
      // Return mock reviews for development
      return {
        reviews: [
          {
            id: '1',
            rating: 5,
            text: 'Great seller! Plants arrived in perfect condition.',
            userName: 'Plant Lover',
            userId: 'user1@example.com',
            createdAt: new Date().toISOString(),
            isOwnReview: Math.random() > 0.5, // Randomly set as own review for testing
          },
          {
            id: '2',
            rating: 4,
            text: 'Good communication and nice plants.',
            userName: 'Green Thumb',
            userId: 'user2@example.com',
            createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
            isOwnReview: false,
          },
        ],
        averageRating: 4.5,
        count: 2
      };
    }
    
    throw error;
  }
};

/**
 * Submit a review for a product or seller
 * @param {string} targetId - ID of the target (seller or product)
 * @param {string} targetType - Type of target ('seller' or 'product')
 * @param {Object} reviewData - The review data (rating, text)
 * @returns {Promise<Object>} - The response with the created review
 */
export const submitReview = async (targetId, targetType = 'seller', reviewData) => {
  try {
    // Validate inputs
    if (!targetId) {
      throw new Error('Target ID is required');
    }
    
    if (!reviewData || !reviewData.rating || !reviewData.text) {
      throw new Error('Review must include both rating and text');
    }
    
    // URL encode targetId (email or product ID)
    const encodedTargetId = encodeURIComponent(targetId);
    
    // Log the request details for debugging
    console.log(`Submitting ${targetType} review for ${targetId}:`, reviewData);
    
    // Construct the endpoint with the correct route
    const endpoint = `submitreview/${targetType}/${encodedTargetId}`;
    
    // Make the API request
    const response = await apiRequest(endpoint, 'POST', reviewData);
    console.log('Review submission response:', response);
    
    return response;
  } catch (error) {
    console.error(`Error submitting ${targetType} review:`, error);
    
    // Provide more context in the error
    error.message = `Failed to submit review: ${error.message}`;
    throw error;
  }
};


// Function to update in services/marketplaceApi.js

export const deleteReview = async (reviewId, targetType, targetId) => {
  // This function is not used anymore, we make the API call directly from ReviewItem component
  console.log('[API] deleteReview API function is called but not used, using direct fetch instead');
  console.log('[API] Parameters:', { reviewId, targetType, targetId });
  
  try {
    if (!reviewId) {
      throw new Error('Review ID is required');
    }
    
    // Get authentication info
    const userEmail = await AsyncStorage.getItem('userEmail');
    const token = await AsyncStorage.getItem('googleAuthToken');
    
    // Build URL
    const API_BASE_URL = 'https://usersfunctions.azurewebsites.net/api';
    const encodedTargetType = encodeURIComponent(targetType);
    const encodedTargetId = encodeURIComponent(targetId);
    const encodedReviewId = encodeURIComponent(reviewId);
    
    const endpoint = `marketplace/reviews/${encodedTargetType}/${encodedTargetId}/${encodedReviewId}`;
    const fullUrl = `${API_BASE_URL}/${endpoint}`;
    
    console.log(`[API] DELETE request URL: ${fullUrl}`);
    
    // Build headers
    const headers = {
      'Content-Type': 'application/json',
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    headers['X-User-Email'] = userEmail;
    
    // Make the request
    const response = await fetch(fullUrl, {
      method: 'DELETE',
      headers
    });
    
    // Try to parse response
    let responseData;
    try {
      responseData = await response.json();
    } catch (e) {
      const textResponse = await response.text();
      responseData = { 
        success: response.ok, 
        message: response.ok ? 'Review deleted successfully' : textResponse 
      };
    }
    
    // Handle response
    if (!response.ok) {
      throw new Error(`Server returned ${response.status}: ${responseData?.message || 'Unknown error'}`);
    }
    
    return responseData;
  } catch (error) {
    console.error('[API] Error deleting review:', error);
    throw error;
  }
};

/**
 * Convert audio to text using Azure Cognitive Services
 * @param {string} audioUrl - URL to the uploaded audio file
 * @param {string} language - Language code (default: 'en-US')
 * @returns {Promise<string>} Recognized text
 */
export const speechToText = async (audioUrl, language = 'en-US') => {
  try {
    console.log(`Starting speech-to-text for audio: ${audioUrl}`);
    
    if (!audioUrl) {
      throw new Error('Audio URL is required');
    }
    
    const API_URL = `${API_BASE_URL}/marketplace/speechToText`;
    console.log(`Using speech-to-text API URL: ${API_URL}`);
    
    // For debugging - log the request details
    console.log(`Request details:
      URL: ${API_URL}
      Method: POST
      Headers: Content-Type: application/json
      Body: {
        audioUrl: ${audioUrl.substring(0, 50)}...,
        language: ${language}
      }
    `);
    
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Add authorization if available
        ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {})
      },
      body: JSON.stringify({ 
        audioUrl,
        language
      })
    });

    console.log(`Speech-to-text API response status: ${response.status}`);
    
    // Get response body regardless of status code for better error reporting
    let responseData;
    try {
      responseData = await response.json();
      console.log('Speech-to-text response data:', responseData);
    } catch (parseError) {
      const textResponse = await response.text();
      console.error('Failed to parse JSON response:', textResponse);
      responseData = { error: textResponse || 'Invalid response format' };
    }
    
    // Handle non-200 responses
    if (!response.ok) {
      let errorMessage;
      
      if (responseData && responseData.error) {
        errorMessage = typeof responseData.error === 'string' 
          ? responseData.error 
          : JSON.stringify(responseData.error);
      } else if (responseData && responseData.message) {
        errorMessage = responseData.message;
      } else {
        errorMessage = `HTTP error ${response.status}`;
      }
      
      console.error('Speech-to-text error response:', responseData);
      throw new Error(`Speech recognition failed: ${errorMessage}`);
    }

    // Validate successful response
    if (!responseData || typeof responseData.text !== 'string') {
      console.error('Invalid speech-to-text response format:', responseData);
      throw new Error('Received invalid response format from speech service');
    }

    // Clean up the text for search - remove punctuation and extra spaces
    const cleanText = cleanupTranscriptionText(responseData.text);
    
    console.log('Speech-to-text successful, result:', cleanText);
    return cleanText; // Return the cleaned recognized text
  } catch (error) {
    console.error('Speech-to-text error:', error);
    throw error;
  }
}

/**
 * Clean up transcription text for better search queries
 * @param {string} text - The text to clean up
 * @returns {string} Cleaned text without punctuation
 */
const cleanupTranscriptionText = (text) => {
  if (!text) return '';
  
  // Remove punctuation that shouldn't be in search queries
  return text
    .replace(/[.,!?;:'"()\[\]{}]/g, '')  // Remove punctuation
    .replace(/\s+/g, ' ')                // Replace multiple spaces with a single space
    .trim();                            // Remove leading/trailing spaces
};

// Export the API with speech to text function
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
  fetchReviews,
  submitReview,
  deleteReview,
  
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
  
  // Image and Speech methods
  uploadImage,
  createImageFormData,
  speechToText,
  
  // Main app integration
  getUserPlantsByLocation,
  getUserLocations,
  identifyPlantPhoto
};
