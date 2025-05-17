// services/azureMapsService.js
const API_BASE_URL = 'https://usersfunctions.azurewebsites.net/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Get Azure Maps API key from the server with authentication
 * @returns {Promise<string>} Azure Maps API key
 */
export const getAzureMapsKey = async () => {
  try {
    console.log('=== AZURE MAPS KEY DEBUG ===');
    console.log('Starting request to fetch Azure Maps key');
    
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
      console.log('Added user email to headers:', userEmail);
    } else {
      console.log('No user email found in AsyncStorage');
    }
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
      console.log('Added auth token to headers (token hidden)');
    } else {
      console.log('No auth token found in AsyncStorage');
    }
    
    // Log the full request details
    const requestUrl = `${API_BASE_URL}/marketplace/maps-config`;
    console.log('Making request to:', requestUrl);
    console.log('With headers:', JSON.stringify(headers, null, 2));
    
    // Get Azure Maps key from backend
    const response = await fetch(requestUrl, {
      method: 'GET',
      headers,
    });
    
    console.log('Response status:', response.status);
    
    // Get the response text first for debugging
    const responseText = await response.text();
    console.log('Response text:', responseText);
    
    if (!response.ok) {
      throw new Error(`Failed to get Azure Maps key: ${response.status} - ${responseText}`);
    }
    
    // Parse the text response as JSON
    let data;
    try {
      data = JSON.parse(responseText);
      console.log('Parsed response data:', JSON.stringify(data, null, 2));
    } catch (parseError) {
      console.error('Failed to parse response as JSON:', parseError);
      throw new Error('Invalid JSON response from server');
    }
    
    if (!data || !data.azureMapsKey) {
      console.error('Response missing azureMapsKey property:', data);
      throw new Error('No Azure Maps key returned from server');
    }
    
    console.log('Successfully retrieved Azure Maps key');
    
    // Cache the key for fallback
    try {
      await AsyncStorage.setItem('AZURE_MAPS_KEY_CACHE', data.azureMapsKey);
      await AsyncStorage.setItem('AZURE_MAPS_KEY_TIMESTAMP', Date.now().toString());
    } catch (cacheError) {
      console.warn('Failed to cache Azure Maps key:', cacheError);
    }
    
    return data.azureMapsKey;
  } catch (error) {
    console.error('Error getting Azure Maps key:', error);
    
    // Try to use cached key if available
    try {
      const cachedKey = await AsyncStorage.getItem('AZURE_MAPS_KEY_CACHE');
      const keyTimestamp = await AsyncStorage.getItem('AZURE_MAPS_KEY_TIMESTAMP');
      
      if (cachedKey && keyTimestamp) {
        const timestamp = parseInt(keyTimestamp, 10);
        const now = Date.now();
        
        // Use cached key if it's less than 24 hours old
        if (!isNaN(timestamp) && (now - timestamp) < 86400000) {
          console.log('Using cached Azure Maps key');
          return cachedKey;
        }
      }
    } catch (cacheError) {
      console.warn('Failed to retrieve cached Azure Maps key:', cacheError);
    }
    
    // TEMPORARY FOR DEBUGGING: Use a direct fallback key
    if (__DEV__) {
      console.warn('*** USING HARDCODED DEVELOPMENT KEY ***');
      const devKey = 'x4lgzsiW3KfzGLWVhIcgG3p0VavqZH7iUlPQ1VJgC0k';
      return devKey;
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
    console.error('Geocoding error:', error);
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
    console.error('Reverse geocoding error:', error);
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