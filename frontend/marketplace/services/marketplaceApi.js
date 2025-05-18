// services/marketplaceApi.js
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = 'https://usersfunctions.azurewebsites.net/api';

/**
 * Get all marketplace products with optional filters
 * @param {number} page Page number
 * @param {string} category Category filter
 * @param {string} search Search term
 * @param {Object} options Additional options (minPrice, maxPrice, sortBy)
 * @returns {Promise<Object>} API response
 */
export const getAll = async (page = 1, category = null, search = null, options = {}) => {
  try {
    // Build query string with filters
    let queryParams = `page=${page}&pageSize=20`;
    
    if (category) {
      queryParams += `&category=${encodeURIComponent(category)}`;
    }
    
    if (search) {
      queryParams += `&search=${encodeURIComponent(search)}`;
    }
    
    if (options.minPrice !== undefined) {
      queryParams += `&minPrice=${options.minPrice}`;
    }
    
    if (options.maxPrice !== undefined) {
      queryParams += `&maxPrice=${options.maxPrice}`;
    }
    
    if (options.sortBy) {
      queryParams += `&sortBy=${options.sortBy}`;
    }
    
    // Set up headers
    const headers = {
      'Content-Type': 'application/json',
    };
    
    // Get user email for authenticated requests
    const userEmail = await AsyncStorage.getItem('userEmail');
    if (userEmail) {
      headers['X-User-Email'] = userEmail;
    }
    
    // Make the API request
    const response = await fetch(`${API_BASE_URL}/marketplace/products?${queryParams}`, {
      method: 'GET',
      headers: headers,
    });
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching products:', error);
    throw error;
  }
};

/**
 * Get a specific marketplace product by ID
 * @param {string} id Product ID
 * @returns {Promise<Object>} API response
 */
export const getSpecific = async (id) => {
  try {
    if (!id) {
      throw new Error('Product ID is required');
    }
    
    // Set up headers
    const headers = {
      'Content-Type': 'application/json',
    };
    
    // Get user email for authenticated requests
    const userEmail = await AsyncStorage.getItem('userEmail');
    if (userEmail) {
      headers['X-User-Email'] = userEmail;
    }
    
    // Make the API request
    const response = await fetch(`${API_BASE_URL}/marketplace/products/specific/${id}`, {
      method: 'GET',
      headers: headers,
    });
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching product:', error);
    throw error;
  }
};

/**
 * Add or remove a product from the wishlist
 * @param {string} id Product ID
 * @returns {Promise<Object>} API response
 */
export const wishProduct = async (id) => {
  try {
    if (!id) {
      throw new Error('Product ID is required');
    }
    
    // Get user email for authenticated requests
    const userEmail = await AsyncStorage.getItem('userEmail');
    if (!userEmail) {
      throw new Error('User not authenticated');
    }
    
    // Make the API request
    const response = await fetch(`${API_BASE_URL}/marketplace/products/wish/${id}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Email': userEmail,
      },
    });
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error updating wishlist:', error);
    throw error;
  }
};

/**
 * Upload an image for a marketplace product
 * @param {string|Blob} imageData Image data (base64 string or blob)
 * @param {string} type Type of image ('plant', 'user', etc.)
 * @returns {Promise<Object>} API response
 */
export const uploadImage = async (imageData, type = 'plant') => {
  try {
    if (!imageData) {
      throw new Error('Image data is required');
    }
    
    // Get user email for authenticated requests
    const userEmail = await AsyncStorage.getItem('userEmail');
    
    let body;
    let headers;
    
    if (typeof imageData === 'string' && imageData.startsWith('data:')) {
      // Base64 data URL
      headers = {
        'Content-Type': 'application/json',
      };
      
      if (userEmail) {
        headers['X-User-Email'] = userEmail;
      }
      
      body = JSON.stringify({
        image: imageData,
        type: type,
      });
    } else {
      // File object or blob
      const formData = new FormData();
      
      if (typeof imageData === 'string') {
        // Assume it's a local URI
        const filename = imageData.split('/').pop();
        const match = /\.(\w+)$/.exec(filename);
        const fileType = match ? `image/${match[1]}` : 'image/jpeg';
        
        formData.append('image', {
          uri: imageData,
          name: filename,
          type: fileType,
        });
      } else {
        // It's already a file object
        formData.append('image', imageData);
      }
      
      formData.append('type', type);
      
      headers = {
        'Content-Type': 'multipart/form-data',
      };
      
      if (userEmail) {
        headers['X-User-Email'] = userEmail;
      }
      
      body = formData;
    }
    
    // Make the API request
    const response = await fetch(`${API_BASE_URL}/marketplace/uploadImage`, {
      method: 'POST',
      headers: headers,
      body: body,
    });
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error uploading image:', error);
    throw error;
  }
};

/**
 * Create a new marketplace product
 * @param {Object} productData Product data
 * @returns {Promise<Object>} API response
 */
export const createPlant = async (productData) => {
  try {
    if (!productData) {
      throw new Error('Product data is required');
    }
    
    // Get user email for authenticated requests
    const userEmail = await AsyncStorage.getItem('userEmail');
    if (!userEmail) {
      throw new Error('User not authenticated');
    }
    
    // Make the API request
    const response = await fetch(`${API_BASE_URL}/marketplace/products/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Email': userEmail,
      },
      body: JSON.stringify({
        ...productData,
        sellerId: userEmail,
      }),
    });
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error creating product:', error);
    throw error;
  }
};

/**
 * Fetch user profile from the API
 * @param {string} userId User ID or email
 * @returns {Promise<Object>} API response
 */
export const fetchUserProfile = async (userId) => {
  try {
    if (!userId) {
      throw new Error('User ID is required');
    }
    
    // Make the API request
    const response = await fetch(`${API_BASE_URL}/marketplace/users/${userId}`, {
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
    console.error('Error fetching user profile:', error);
    throw error;
  }
};

/**
 * Get nearby products based on location
 * @param {number} latitude Latitude
 * @param {number} longitude Longitude
 * @param {number} radius Radius in kilometers
 * @param {string} category Optional category filter
 * @returns {Promise<Object>} API response with nearby products
 */
export const getNearbyProducts = async (latitude, longitude, radius = 10, category = null) => {
  try {
    // Validate inputs
    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      throw new Error('Valid coordinates required');
    }
    
    // Build query string
    let queryParams = `lat=${latitude}&lon=${longitude}&radius=${radius}`;
    if (category && category !== 'All') {
      queryParams += `&category=${encodeURIComponent(category)}`;
    }
    
    // Set up headers
    const headers = {
      'Content-Type': 'application/json',
    };
    
    // Get user email for authenticated requests
    const userEmail = await AsyncStorage.getItem('userEmail');
    if (userEmail) {
      headers['X-User-Email'] = userEmail;
    }
    
    // Make the API request
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

/**
 * Geocode an address to coordinates
 * @param {string} address Address to geocode
 * @returns {Promise<Object>} API response with coordinates
 */
export const geocodeAddress = async (address) => {
  try {
    if (!address) {
      throw new Error('Address is required');
    }
    
    // Make the API request
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

/**
 * Reverse geocode coordinates to an address
 * @param {number} latitude Latitude
 * @param {number} longitude Longitude
 * @returns {Promise<Object>} API response with address details
 */
export const reverseGeocode = async (latitude, longitude) => {
  try {
    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      throw new Error('Valid coordinates required');
    }
    
    // Make the API request
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

/**
 * Get Azure Maps API key from the server
 * @returns {Promise<string>} Azure Maps API key
 */
export const getAzureMapsKey = async () => {
  try {
    // Get user email for authenticated requests
    const userEmail = await AsyncStorage.getItem('userEmail');
    
    // Set up headers
    const headers = {
      'Content-Type': 'application/json',
    };
    
    if (userEmail) {
      headers['X-User-Email'] = userEmail;
    }
    
    // Make the API request
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

/**
 * Update an existing product
 * @param {string} id Product ID
 * @param {Object} data Update data
 * @returns {Promise<Object>} API response
 */
export const updateProduct = async (id, data) => {
  try {
    if (!id) {
      throw new Error('Product ID is required');
    }
    
    // Get user email for authenticated requests
    const userEmail = await AsyncStorage.getItem('userEmail');
    if (!userEmail) {
      throw new Error('User not authenticated');
    }
    
    // Make the API request
    const response = await fetch(`${API_BASE_URL}/marketplace/products/${id}`, {
      method: 'PATCH',  // Use PATCH for partial updates
      headers: {
        'Content-Type': 'application/json',
        'X-User-Email': userEmail,
      },
      body: JSON.stringify(data),
    });
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error updating product:', error);
    throw error;
  }
};

/**
 * Get user listings
 * @param {string} userId User ID
 * @param {string} status Filter by status ('active', 'sold', 'all')
 * @returns {Promise<Object>} API response
 */
export const getUserListings = async (userId, status = null) => {
  try {
    if (!userId) {
      throw new Error('User ID is required');
    }
    
    // Build query parameters
    let queryParams = '';
    if (status) {
      queryParams = `?status=${status}`;
    }
    
    // Make the API request
    const response = await fetch(`${API_BASE_URL}/marketplace/users/${userId}/listings${queryParams}`, {
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
    console.error('Error fetching user listings:', error);
    throw error;
  }
};

/**
 * Get user wishlist
 * @param {string} userId User ID
 * @returns {Promise<Object>} API response
 */
export const getUserWishlist = async (userId) => {
  try {
    if (!userId) {
      throw new Error('User ID is required');
    }
    
    // Get user email for authenticated requests
    const userEmail = await AsyncStorage.getItem('userEmail');
    
    // Make the API request
    const response = await fetch(`${API_BASE_URL}/marketplace/users/${userId}/wishlist`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Email': userEmail || userId,  // Use either the current user's email or the requested userId
      },
    });
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching user wishlist:', error);
    throw error;
  }
};

/**
 * Update user profile
 * @param {string} userId User ID
 * @param {Object} profileData Profile update data
 * @returns {Promise<Object>} API response
 */
export const updateUserProfile = async (userId, profileData) => {
  try {
    if (!userId) {
      throw new Error('User ID is required');
    }
    
    // Get user email for authenticated requests
    const userEmail = await AsyncStorage.getItem('userEmail');
    if (!userEmail) {
      throw new Error('User not authenticated');
    }
    
    // Make the API request
    const response = await fetch(`${API_BASE_URL}/marketplace/users/${userId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Email': userEmail,
      },
      body: JSON.stringify(profileData),
    });
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error updating user profile:', error);
    throw error;
  }
};

/**
 * Get negotiate token for SignalR connection
 * @returns {Promise<Object>} API response
 */
export const getNegotiateToken = async () => {
  try {
    // Get user email for authenticated requests
    const userEmail = await AsyncStorage.getItem('userEmail');
    if (!userEmail) {
      throw new Error('User not authenticated');
    }
    
    // Make the API request
    const response = await fetch(`${API_BASE_URL}/marketplace/signalr-negotiate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Email': userEmail,
      },
    });
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error getting SignalR negotiate token:', error);
    throw error;
  }
};