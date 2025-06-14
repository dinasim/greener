// services/azureMapsService.js - FIXED VERSION (No hardcoded keys)
const API_BASE_URL = 'https://usersfunctions.azurewebsites.net/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Get Azure Maps API key from the server with authentication
 * @returns {Promise<string>} Azure Maps API key
 */
export const getAzureMapsKey = async () => {
  try {
    console.log('🗺️ Fetching Azure Maps key from server...');
    
    // Get user email for authenticated requests
    const userEmail = await AsyncStorage.getItem('userEmail');
    const token = await AsyncStorage.getItem('googleAuthToken');
    
    // Setup request headers
    const headers = {
      'Content-Type': 'application/json',
    };
    
    // Add authentication headers if available
    if (userEmail) {
      headers['X-User-Email'] = userEmail;
    }
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    // Get Azure Maps key from backend
    const requestUrl = `${API_BASE_URL}/marketplace/maps-config`;
    const response = await fetch(requestUrl, {
      method: 'GET',
      headers,
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to get Azure Maps key: ${response.status} - ${errorText}`);
    }
    
    const data = await response.json();
    
    if (!data || !data.azureMapsKey) {
      throw new Error('No Azure Maps key returned from server');
    }
    
    console.log('✅ Successfully retrieved Azure Maps key');
    
    // Cache the key for fallback
    try {
      await AsyncStorage.setItem('AZURE_MAPS_KEY_CACHE', data.azureMapsKey);
      await AsyncStorage.setItem('AZURE_MAPS_KEY_TIMESTAMP', Date.now().toString());
    } catch (cacheError) {
      console.warn('⚠️ Failed to cache Azure Maps key:', cacheError);
    }
    
    return data.azureMapsKey;
  } catch (error) {
    console.error('❌ Error getting Azure Maps key:', error);
    
    // Try to use cached key if available and not too old
    try {
      const cachedKey = await AsyncStorage.getItem('AZURE_MAPS_KEY_CACHE');
      const keyTimestamp = await AsyncStorage.getItem('AZURE_MAPS_KEY_TIMESTAMP');
      
      if (cachedKey && keyTimestamp) {
        const timestamp = parseInt(keyTimestamp, 10);
        const now = Date.now();
        
        // Use cached key if it's less than 24 hours old
        if (!isNaN(timestamp) && (now - timestamp) < 86400000) {
          console.log('📱 Using cached Azure Maps key');
          return cachedKey;
        }
      }
    } catch (cacheError) {
      console.warn('⚠️ Failed to retrieve cached Azure Maps key:', cacheError);
    }
    
    throw error;
  }
};

/**
 * Geocode an address to coordinates
 * @param {string} address Address to geocode
 * @returns {Promise<Object>} Geocoded location data
 */
export const geocodeAddress = async (address) => {
  try {
    if (!address || typeof address !== 'string') {
      throw new Error('Invalid address provided');
    }
    
    // Setup request headers
    const headers = {
      'Content-Type': 'application/json',
    };
    
    // Make the geocode request
    const response = await fetch(`${API_BASE_URL}/marketplace/geocode?address=${encodeURIComponent(address)}`, {
      method: 'GET',
      headers,
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Geocoding failed: ${errorText}`);
    }
    
    const data = await response.json();
    
    return {
      latitude: data.latitude,
      longitude: data.longitude,
      formattedAddress: data.formattedAddress,
      city: data.city,
      country: data.country,
      street: data.street,
      houseNumber: data.houseNumber,
      postalCode: data.postalCode
    };
  } catch (error) {
    console.error('❌ Geocoding error:', error);
    throw error;
  }
};

/**
 * Reverse geocode coordinates to an address
 * @param {number} latitude Latitude
 * @param {number} longitude Longitude
 * @returns {Promise<Object>} Address information
 */
export const reverseGeocode = async (latitude, longitude) => {
  try {
    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      throw new Error('Invalid coordinates provided');
    }
    
    // Setup request headers
    const headers = {
      'Content-Type': 'application/json',
    };
    
    // Make the reverse geocode request
    const response = await fetch(`${API_BASE_URL}/marketplace/reverseGeocode?lat=${latitude}&lon=${longitude}`, {
      method: 'GET',
      headers,
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Reverse geocoding failed: ${errorText}`);
    }
    
    const data = await response.json();
    
    return {
      formattedAddress: data.formattedAddress,
      city: data.city,
      country: data.country,
      street: data.street,
      houseNumber: data.houseNumber,
      postalCode: data.postalCode,
      latitude: data.latitude,
      longitude: data.longitude
    };
  } catch (error) {
    console.error('❌ Reverse geocoding error:', error);
    throw error;
  }
};

/**
 * Calculate distance between two coordinates in kilometers
 * @param {number} lat1 First point latitude
 * @param {number} lon1 First point longitude
 * @param {number} lat2 Second point latitude
 * @param {number} lon2 Second point longitude
 * @returns {number} Distance in kilometers
 */
export const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const toRad = (value) => (value * Math.PI) / 180;
  const R = 6371; // Earth's radius in km
  
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
    
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

export default {
  getAzureMapsKey,
  geocodeAddress,
  reverseGeocode,
  calculateDistance
};