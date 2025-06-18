// services/businessProductService.js - Updated: Official API Endpoints
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = 'https://usersfunctions.azurewebsites.net/api';

/**
 * Get specific business product details by productId and businessId
 * Uses /business-inventory-get?businessId=... and filters for the product
 */
export const getBusinessProduct = async (productId, businessId) => {
  if (!productId || !businessId) throw new Error('Product ID and Business ID are required');
  try {
    const headers = { 'Content-Type': 'application/json' };
    const userEmail = await AsyncStorage.getItem('userEmail');
    const token = await AsyncStorage.getItem('googleAuthToken');
    if (userEmail) headers['X-User-Email'] = userEmail;
    if (token) headers['Authorization'] = `Bearer ${token}`;
    headers['X-Business-ID'] = businessId;

    const url = `${API_BASE_URL}/business-inventory-get?businessId=${encodeURIComponent(businessId)}`;
    const response = await fetch(url, { method: 'GET', headers });
    if (!response.ok) throw new Error(`Failed to fetch business inventory: ${response.status}`);
    const data = await response.json();
    const inventory = data.inventory || data.items || data.data || [];
    const product = inventory.find(item => item.id === productId || item._id === productId);
    if (!product) throw new Error('Product not found in business inventory');
    return {
      ...product,
      isBusinessListing: true,
      sellerType: 'business',
      businessId,
    };
  } catch (error) {
    console.error('Error fetching business product:', error);
    throw error;
  }
};

/**
 * Enhanced getSpecific function that handles both individual and business products
 * If productType is 'business', requires businessId
 */
export const getSpecificProduct = async (productId, productType = 'auto', businessId = null) => {
  if (!productId) throw new Error('Product ID is required');
  if (productType === 'business') {
    if (!businessId) throw new Error('Business ID is required for business product');
    return await getBusinessProduct(productId, businessId);
  }
  // Individual product
  try {
    const headers = { 'Content-Type': 'application/json' };
    const userEmail = await AsyncStorage.getItem('userEmail');
    const token = await AsyncStorage.getItem('googleAuthToken');
    if (userEmail) headers['X-User-Email'] = userEmail;
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const response = await fetch(`${API_BASE_URL}/marketplace/products/specific/${productId}`, { method: 'GET', headers });
    if (response.ok) {
      const data = await response.json();
      return { ...data, isBusinessListing: false, sellerType: 'individual' };
    }
    if (productType === 'auto' && businessId) {
      // Try business if auto
      return await getBusinessProduct(productId, businessId);
    }
    throw new Error('Individual product not found');
  } catch (error) {
    if (productType === 'auto' && businessId) {
      return await getBusinessProduct(productId, businessId);
    }
    throw error;
  }
};

/**
 * Get business profile/seller information (public)
 */
export const getBusinessProfile = async (businessId) => {
  if (!businessId) throw new Error('Business ID is required');
  try {
    const headers = { 'Content-Type': 'application/json' };
    const userEmail = await AsyncStorage.getItem('userEmail');
    const token = await AsyncStorage.getItem('googleAuthToken');
    if (userEmail) headers['X-User-Email'] = userEmail;
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const url = `${API_BASE_URL}/get_business_profile/${encodeURIComponent(businessId)}`;
    const response = await fetch(url, { method: 'GET', headers });
    if (!response.ok) throw new Error(`Failed to fetch business profile: ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error('Error fetching business profile:', error);
    throw error;
  }
};

/**
 * Get business inventory/products
 */
export const getBusinessInventory = async (businessId, filters = {}) => {
  if (!businessId) throw new Error('Business ID is required');
  try {
    const headers = { 'Content-Type': 'application/json' };
    const userEmail = await AsyncStorage.getItem('userEmail');
    const token = await AsyncStorage.getItem('googleAuthToken');
    if (userEmail) headers['X-User-Email'] = userEmail;
    if (token) headers['Authorization'] = `Bearer ${token}`;
    headers['X-Business-ID'] = businessId;
    const queryParams = new URLSearchParams({ businessId, ...filters });
    const url = `${API_BASE_URL}/business-inventory-get?${queryParams.toString()}`;
    const response = await fetch(url, { method: 'GET', headers });
    if (!response.ok) throw new Error(`Failed to fetch business inventory: ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error('Error fetching business inventory:', error);
    throw error;
  }
};

export default {
  getBusinessProduct,
  getSpecificProduct,
  getBusinessProfile,
  getBusinessInventory
};