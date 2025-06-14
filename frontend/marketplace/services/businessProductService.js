// services/businessProductService.js - NEW: Separate API for Business Products
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = 'https://usersfunctions.azurewebsites.net/api';

/**
 * Get specific business product details
 * Business products use a different API endpoint than individual products
 */
export const getBusinessProduct = async (productId) => {
  try {
    const userEmail = await AsyncStorage.getItem('userEmail');
    const token = await AsyncStorage.getItem('googleAuthToken');
    
    const headers = {
      'Content-Type': 'application/json',
    };
    
    if (userEmail) {
      headers['X-User-Email'] = userEmail;
    }
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    console.log(`Fetching business product: ${productId}`);
    
    // Try business products endpoint first
    const businessResponse = await fetch(`${API_BASE_URL}/marketplace/business/products/${productId}`, {
      method: 'GET',
      headers,
    });
    
    if (businessResponse.ok) {
      const data = await businessResponse.json();
      console.log('Business product data:', data);
      
      // Transform business product data to match expected format
      return {
        ...data,
        isBusinessListing: true,
        sellerType: 'business',
        businessInfo: data.businessInfo || {
          name: data.businessName,
          type: data.businessType,
          verified: data.verified || false
        },
        availability: data.availability || {
          inStock: data.inStock !== false,
          quantity: data.quantity || 1
        },
        seller: {
          ...data.seller,
          isBusiness: true,
          businessName: data.businessName || data.seller?.businessName
        }
      };
    }
    
    // If business endpoint fails, try inventory endpoint
    console.log('Business endpoint failed, trying inventory endpoint');
    const inventoryResponse = await fetch(`${API_BASE_URL}/marketplace/inventory/${productId}`, {
      method: 'GET',
      headers,
    });
    
    if (inventoryResponse.ok) {
      const data = await inventoryResponse.json();
      console.log('Inventory product data:', data);
      
      return {
        ...data,
        isBusinessListing: true,
        sellerType: 'business',
        businessInfo: data.businessInfo || {
          name: data.businessName,
          type: data.businessType || 'Business',
          verified: data.verified || false
        },
        availability: data.availability || {
          inStock: data.inStock !== false,
          quantity: data.quantity || 1
        }
      };
    }
    
    throw new Error('Business product not found in any endpoint');
    
  } catch (error) {
    console.error('Error fetching business product:', error);
    throw error;
  }
};

/**
 * Enhanced getSpecific function that handles both individual and business products
 */
export const getSpecificProduct = async (productId, productType = 'auto') => {
  try {
    // If we know it's a business product, go directly to business API
    if (productType === 'business') {
      return await getBusinessProduct(productId);
    }
    
    // Try individual product first (original API)
    if (productType === 'individual' || productType === 'auto') {
      try {
        const userEmail = await AsyncStorage.getItem('userEmail');
        const token = await AsyncStorage.getItem('googleAuthToken');
        
        const headers = {
          'Content-Type': 'application/json',
        };
        
        if (userEmail) {
          headers['X-User-Email'] = userEmail;
        }
        
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
        
        console.log(`Fetching individual product: ${productId}`);
        const response = await fetch(`${API_BASE_URL}/marketplace/products/specific/${productId}`, {
          method: 'GET',
          headers,
        });
        
        if (response.ok) {
          const data = await response.json();
          console.log('Individual product data:', data);
          
          // Mark as individual product
          return {
            ...data,
            isBusinessListing: false,
            sellerType: 'individual'
          };
        }
        
        // If individual product not found and auto-detect, try business
        if (productType === 'auto') {
          console.log('Individual product not found, trying business endpoints');
          return await getBusinessProduct(productId);
        }
        
        throw new Error('Individual product not found');
        
      } catch (individualError) {
        if (productType === 'auto') {
          console.log('Individual product failed, trying business:', individualError.message);
          return await getBusinessProduct(productId);
        }
        throw individualError;
      }
    }
    
    throw new Error('Invalid product type specified');
    
  } catch (error) {
    console.error('Error in getSpecificProduct:', error);
    throw error;
  }
};

/**
 * Get business profile/seller information
 */
export const getBusinessProfile = async (businessId) => {
  try {
    const userEmail = await AsyncStorage.getItem('userEmail');
    const token = await AsyncStorage.getItem('googleAuthToken');
    
    const headers = {
      'Content-Type': 'application/json',
    };
    
    if (userEmail) {
      headers['X-User-Email'] = userEmail;
    }
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    const response = await fetch(`${API_BASE_URL}/marketplace/business/profile/${businessId}`, {
      method: 'GET',
      headers,
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch business profile: ${response.status}`);
    }
    
    const data = await response.json();
    return data;
    
  } catch (error) {
    console.error('Error fetching business profile:', error);
    throw error;
  }
};

/**
 * Get business inventory/products
 */
export const getBusinessInventory = async (businessId, filters = {}) => {
  try {
    const userEmail = await AsyncStorage.getItem('userEmail');
    const token = await AsyncStorage.getItem('googleAuthToken');
    
    const headers = {
      'Content-Type': 'application/json',
    };
    
    if (userEmail) {
      headers['X-User-Email'] = userEmail;
    }
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    // Build query parameters
    const queryParams = new URLSearchParams();
    Object.keys(filters).forEach(key => {
      if (filters[key] !== undefined && filters[key] !== null) {
        queryParams.append(key, filters[key]);
      }
    });
    
    const queryString = queryParams.toString();
    const url = `${API_BASE_URL}/marketplace/business/${businessId}/inventory${queryString ? `?${queryString}` : ''}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers,
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch business inventory: ${response.status}`);
    }
    
    const data = await response.json();
    return data;
    
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