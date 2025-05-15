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
// Updated ImageUpload Service for marketplaceApi.js

/**
 * Upload an image to the server with improved error handling and cross-platform support
 * @param {string} imageUri - The URI of the image to upload
 * @param {string} type - The type of image (plant, avatar, etc.)
 * @returns {Promise<Object>} The response from the server
 */
export const uploadImage = async (imageUri, type = 'plant') => {
  try {
    // Get user email for identification
    const userEmail = await AsyncStorage.getItem('userEmail');
    
    // Validate image URI
    if (!imageUri) {
      throw new Error('Image URI is required');
    }
    
    console.log(`Uploading ${type} image: ${imageUri.substring(0, 50)}...`);
    
    // Handle different platforms differently
    if (Platform.OS === 'web') {
      // Web implementation - use FormData
      const formData = new FormData();
      
      // For web, we need to handle the File/Blob differently
      if (imageUri.startsWith('data:')) {
        // Already a Data URI - convert to blob
        const response = await fetch(imageUri);
        const blob = await response.blob();
        formData.append('image', blob, 'image.jpg');
      } else {
        // Assume it's a File object or similar
        formData.append('image', {
          uri: imageUri,
          name: `${type}_${Date.now()}.jpg`,
          type: 'image/jpeg',
        });
      }
      
      // Add additional metadata
      formData.append('type', type);
      if (userEmail) {
        formData.append('userId', userEmail);
      }
      
      // Make the request
      const response = await fetch(`${API_BASE_URL}/marketplace/uploadImage`, {
        method: 'POST',
        body: formData,
        headers: authToken ? { 'Authorization': `Bearer ${authToken}` } : {},
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Upload failed with status ${response.status}: ${errorText}`);
        throw new Error(`Upload failed: ${response.status}`);
      }
      
      return await response.json();
    } else {
      // Mobile implementation - convert to base64
      // Check if already base64
      if (imageUri.startsWith('data:image')) {
        // Already in base64 format
        return await apiRequest('marketplace/uploadImage', 'POST', {
          image: imageUri,
          type,
          userId: userEmail
        });
      }
      
      // Get file info to check size
      const fileInfo = await FileSystem.getInfoAsync(imageUri);
      if (!fileInfo.exists) {
        throw new Error('Image file does not exist');
      }
      
      // Check file size - warn if too large
      if (fileInfo.size > 5 * 1024 * 1024) {
        console.warn('Image is large (>5MB), upload may fail or be slow');
      }
      
      try {
        // Read as base64
        const base64 = await FileSystem.readAsStringAsync(imageUri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        
        // Determine MIME type based on file extension
        let mimeType = 'image/jpeg'; // Default
        if (imageUri.toLowerCase().endsWith('.png')) {
          mimeType = 'image/png';
        } else if (imageUri.toLowerCase().endsWith('.gif')) {
          mimeType = 'image/gif';
        }
        
        // Create data URI
        const dataUri = `data:${mimeType};base64,${base64}`;
        
        // Send the request
        return await apiRequest('marketplace/uploadImage', 'POST', {
          image: dataUri,
          type,
          userId: userEmail
        });
      } catch (readError) {
        console.error('Error reading file as base64:', readError);
        
        // Fallback to FormData approach for mobile
        const formData = new FormData();
        formData.append('image', {
          uri: imageUri,
          name: `${type}_${Date.now()}.jpg`,
          type: 'image/jpeg',
        });
        formData.append('type', type);
        if (userEmail) {
          formData.append('userId', userEmail);
        }
        
        const response = await fetch(`${API_BASE_URL}/marketplace/uploadImage`, {
          method: 'POST',
          body: formData,
          headers: authToken ? { 'Authorization': `Bearer ${authToken}` } : {},
        });
        
        if (!response.ok) {
          throw new Error(`Upload failed with status: ${response.status}`);
        }
        
        return await response.json();
      }
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
 * @param {string} targetId - The ID of the product or seller
 * @param {string} type - The type of review: 'product' or 'seller'
 * @returns {Promise<Object>} - The response with reviews array
 */
export const getReviews = async (targetId, type = 'seller') => {
  try {
    return await apiRequest(`marketplace/${type}s/${targetId}/reviews`);
  } catch (error) {
    console.error(`Error fetching ${type} reviews:`, error);
    
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
          },
          {
            id: '2',
            rating: 4,
            text: 'Good communication and nice plants.',
            userName: 'Green Thumb',
            userId: 'user2@example.com',
            createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          },
        ]
      };
    }
    
    throw error;
  }
};

/**
 * Submit a review for a product or seller
 * @param {string} targetId - The ID of the product or seller
 * @param {string} type - The type of review: 'product' or 'seller' 
 * @param {Object} reviewData - The review data with rating and text
 * @returns {Promise<Object>} - The response with success status
 */
export const submitReview = async (targetId, type = 'seller', reviewData) => {
  try {
    return await apiRequest(`marketplace/${type}s/${targetId}/reviews`, 'POST', reviewData);
  } catch (error) {
    console.error(`Error submitting ${type} review:`, error);
    
    if (config.features.useMockOnError) {
      // Return mock success response for development
      return {
        success: true,
        review: {
          id: 'new-' + Date.now(),
          ...reviewData,
          userName: 'You',
          userId: await AsyncStorage.getItem('userEmail'),
          createdAt: new Date().toISOString()
        }
      };
    }
    
    throw error;
  }
};

/**
 * Delete a review
 * @param {string} reviewId - The ID of the review to delete
 * @returns {Promise<Object>} - The response with success status
 */
export const deleteReview = async (reviewId) => {
  try {
    return await apiRequest(`marketplace/reviews/${reviewId}`, 'DELETE');
  } catch (error) {
    console.error('Error deleting review:', error);
    
    if (config.features.useMockOnError) {
      // Return mock success response for development
      return { success: true };
    }
    
    throw error;
  }
};

export async function speechToText(audioUrl) {
  try {
    const response = await fetch(`${API_BASE_URL}/speechToText`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ audioUrl }),
    });

    const data = await response.json();
    if (response.ok && data.text) {
      return data.text;
    } else {
      throw new Error(data.error || 'Speech recognition failed');
    }
  } catch (error) {
    console.error('speechToText error:', error);
    throw error;
  }
}

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
  identifyPlantPhoto,
  //Speech recognition
  speechToText
};