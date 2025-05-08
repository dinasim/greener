import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Authentication utilities for working with Google Sign-In
 * and accessing authentication tokens for API requests
 */

/**
 * Get the authentication token for API requests
 * @returns {Promise<string|null>} Authentication token or null if not logged in
 */
export const getAuthToken = async () => {
  try {
    // Try to get token from global variable first (set during active session)
    if (global.authToken) {
      return global.authToken;
    }
    
    // If not in global variable, try to get from AsyncStorage
    const token = await AsyncStorage.getItem('token');
    
    // If found in AsyncStorage, also set to global for future use
    if (token) {
      global.authToken = token;
    }
    
    return token;
  } catch (error) {
    console.error('Error getting auth token:', error);
    return null;
  }
};

/**
 * Get the current logged in user
 * @returns {Promise<Object|null>} User object or null if not logged in
 */
export const getCurrentUser = async () => {
  try {
    const userString = await AsyncStorage.getItem('user');
    if (userString) {
      return JSON.parse(userString);
    }
    return null;
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
};

/**
 * Check if user is authenticated
 * @returns {Promise<boolean>} True if authenticated, false otherwise
 */
export const isAuthenticated = async () => {
  const token = await getAuthToken();
  return Boolean(token);
};

/**
 * Add authorization header to fetch options
 * @param {Object} options - Fetch options object
 * @returns {Promise<Object>} Updated options with auth header
 */
export const addAuthHeader = async (options = {}) => {
  const token = await getAuthToken();
  
  if (!token) {
    return options;
  }

  return {
    ...options,
    headers: {
      ...options.headers,
      'Authorization': `Bearer ${token}`
    }
  };
};

/**
 * Sign out the current user
 * @returns {Promise<void>}
 */
export const signOut = async () => {
  try {
    await AsyncStorage.removeItem('user');
    await AsyncStorage.removeItem('token');
    global.authToken = null;
  } catch (error) {
    console.error('Error signing out:', error);
  }
};

/**
 * Set the auth token (called after successful sign in)
 * @param {string} token - Authentication token
 * @returns {Promise<void>}
 */
export const setAuthToken = async (token) => {
  try {
    await AsyncStorage.setItem('token', token);
    global.authToken = token;
  } catch (error) {
    console.error('Error setting auth token:', error);
  }
};

export default {
  getAuthToken,
  getCurrentUser,
  isAuthenticated,
  addAuthHeader,
  signOut,
  setAuthToken,
};