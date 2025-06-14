// Business/services/businessMarketplaceApi.js - NEW: Marketplace-specific business functions
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = 'https://usersfunctions.azurewebsites.net/api';

// Reuse utility functions from businessApi
const getEnhancedHeaders = async () => {
  try {
    const [userEmail, userType, businessId, authToken] = await Promise.all([
      AsyncStorage.getItem('userEmail'),
      AsyncStorage.getItem('userType'),
      AsyncStorage.getItem('businessId'),
      AsyncStorage.getItem('googleAuthToken')
    ]);

    const headers = {
      'Content-Type': 'application/json',
      'X-API-Version': '1.0',
      'X-Client': 'greener-mobile'
    };

    if (userEmail) headers['X-User-Email'] = userEmail;
    if (userType) headers['X-User-Type'] = userType;
    if (businessId) headers['X-Business-ID'] = businessId;
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

    return headers;
  } catch (error) {
    console.error('❌ Error getting headers:', error);
    return { 'Content-Type': 'application/json' };
  }
};

const apiRequest = async (url, options = {}, retries = 3, context = 'Request') => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`🔄 Attempt ${attempt}/${retries} - ${context}: ${url}`);
      const response = await fetch(url, {
        timeout: 15000,
        ...options
      });
      
      const responseText = await response.text();
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${responseText}`);
      }
      
      try {
        return JSON.parse(responseText);
      } catch {
        return { success: true, data: responseText };
      }
    } catch (error) {
      if (attempt === retries) throw error;
      await new Promise(resolve => setTimeout(resolve, Math.min(1000 * Math.pow(2, attempt - 1), 5000)));
    }
  }
};

/**
 * Get Business Marketplace Profile - FIXED endpoint
 */
export const getBusinessMarketplaceProfile = async (businessId) => {
  try {
    console.log('🏪 Loading business marketplace profile for:', businessId);
    const headers = await getEnhancedHeaders();
    
    const url = `${API_BASE_URL}/business-profile`;
    const response = await apiRequest(url, {
      method: 'GET',
      headers,
    }, 3, 'Business Marketplace Profile');

    return response;
  } catch (error) {
    console.error('❌ Business marketplace profile error:', error);
    throw error;
  }
};

/**
 * Update Business Marketplace Profile
 */
export const updateBusinessMarketplaceProfile = async (businessId, profileData) => {
  try {
    console.log('📝 Updating business marketplace profile');
    const headers = await getEnhancedHeaders();
    
    const url = `${API_BASE_URL}/business-profile`;
    const response = await apiRequest(url, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(profileData),
    }, 3, 'Update Marketplace Profile');

    return response;
  } catch (error) {
    console.error('❌ Update marketplace profile error:', error);
    throw error;
  }
};

/**
 * Get Business Products for Marketplace
 */
export const getBusinessMarketplaceProducts = async (businessId) => {
  try {
    console.log('🛒 Loading marketplace products for business:', businessId);
    const headers = await getEnhancedHeaders();
    
    const url = `${API_BASE_URL}/business-inventory`;
    const response = await apiRequest(url, {
      method: 'GET',
      headers,
    }, 3, 'Business Marketplace Products');

    return response;
  } catch (error) {
    console.error('❌ Business marketplace products error:', error);
    throw error;
  }
};

/**
 * Publish Products to Marketplace
 */
export const publishProductsToMarketplace = async (productIds, publishSettings = {}) => {
  try {
    console.log('📢 Publishing products to marketplace:', productIds.length);
    const headers = await getEnhancedHeaders();
    
    const url = `${API_BASE_URL}/business-inventory-publish`;
    const response = await apiRequest(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ productIds, publishSettings }),
    }, 3, 'Publish Products');

    return response;
  } catch (error) {
    console.error('❌ Publish products error:', error);
    throw error;
  }
};

/**
 * Get Nearby Businesses
 */
export const getNearbyBusinesses = async (location, radius = 10) => {
  try {
    console.log('📍 Getting nearby businesses');
    const headers = await getEnhancedHeaders();
    
    const url = `${API_BASE_URL}/get_nearby_businesses`;
    const response = await apiRequest(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ location, radius }),
    }, 3, 'Nearby Businesses');

    return response;
  } catch (error) {
    console.error('❌ Nearby businesses error:', error);
    throw error;
  }
};

/**
 * Get All Businesses
 */
export const getAllBusinesses = async (filters = {}) => {
  try {
    console.log('🏢 Getting all businesses');
    const headers = await getEnhancedHeaders();
    
    const url = `${API_BASE_URL}/get-all-businesses`;
    const response = await apiRequest(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(filters),
    }, 3, 'All Businesses');

    return response;
  } catch (error) {
    console.error('❌ All businesses error:', error);
    throw error;
  }
};

export default {
  getBusinessMarketplaceProfile,
  updateBusinessMarketplaceProfile,
  getBusinessMarketplaceProducts,
  publishProductsToMarketplace,
  getNearbyBusinesses,
  getAllBusinesses,
};