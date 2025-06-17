// COST-OPTIMIZED Azure Maps Service - greener-marketplace-maps ONLY
import { Platform } from 'react-native';

// Configuration - Using your deployed Azure Functions with greener-marketplace-maps
const BASE_URL = 'https://usersfunctions.azurewebsites.net/api';
const CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days to minimize API calls

// Enhanced cache management for cost optimization
let cachedKey = null;
let keyTimestamp = null;
const locationCache = new Map();
const reverseCache = new Map();

// Aggressive rate limiting to minimize costs
let lastApiCall = 0;
const MIN_API_INTERVAL = 1000; // 1 second between calls (reduced from 500ms)
const MAX_CACHE_SIZE = 1000; // Prevent memory issues

// Request queue to batch similar requests
const requestQueue = new Map();

const rateLimitedFetch = async (url, options) => {
  const now = Date.now();
  const timeSinceLastCall = now - lastApiCall;
  
  if (timeSinceLastCall < MIN_API_INTERVAL) {
    await new Promise(resolve => setTimeout(resolve, MIN_API_INTERVAL - timeSinceLastCall));
  }
  
  lastApiCall = Date.now();
  return fetch(url, options);
};

const debouncedRequest = (key, requestFn, delay = 300) => {
  return new Promise((resolve, reject) => {
    if (requestQueue.has(key)) {
      clearTimeout(requestQueue.get(key).timeout);
    }
    
    const timeout = setTimeout(async () => {
      try {
        const result = await requestFn();
        requestQueue.delete(key);
        resolve(result);
      } catch (error) {
        requestQueue.delete(key);
        reject(error);
      }
    }, delay);
    
    requestQueue.set(key, { timeout, resolve, reject });
  });
};

/**
 * Get Azure Maps key - ONLY greener-marketplace-maps account
 * @returns {Promise<string>} Azure Maps API key
 */
export const getAzureMapsKey = async () => {
  console.log('🗺️ Fetching greener-marketplace-maps key...');
  
  // Check cache first
  if (cachedKey && keyTimestamp && (Date.now() - keyTimestamp < CACHE_DURATION)) {
    console.log('✅ Using cached greener-marketplace-maps key');
    return cachedKey;
  }

  try {
    const response = await rateLimitedFetch(`${BASE_URL}/marketplace/maps-config`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Maps config error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    
    if (!data.azureMapsKey) {
      throw new Error('No Azure Maps key in response');
    }

    // Verify this is the correct account
    if (data.accountName !== 'greener-marketplace-maps') {
      console.warn(`⚠️ Unexpected account: ${data.accountName}, expected: greener-marketplace-maps`);
    }

    console.log('✅ greener-marketplace-maps key retrieved with cost guidelines');
    cachedKey = data.azureMapsKey;
    keyTimestamp = Date.now();
    return data.azureMapsKey;

  } catch (error) {
    console.error('❌ Failed to get greener-marketplace-maps key:', error.message);
    throw error;
  }
};

/**
 * Geocode with aggressive cost optimization
 * @param {string} address Address to geocode
 * @returns {Promise<Object>} Geocoded location data
 */
export const geocodeAddress = async (address) => {
  if (!address || address.trim().length < 3) {
    throw new Error('Address must be at least 3 characters long');
  }

  const normalizedAddress = address.trim().toLowerCase();
  
  // Check cache first (7-day cache for cost savings)
  if (locationCache.has(normalizedAddress)) {
    const { data, timestamp } = locationCache.get(normalizedAddress);
    if (Date.now() - timestamp < CACHE_DURATION) {
      console.log('✅ GEOCODE CACHE HIT - Avoided Azure Maps API call');
      return data;
    }
  }

  // Use debounced requests to prevent duplicate calls
  return debouncedRequest(`geocode_${normalizedAddress}`, async () => {
    try {
      console.log('🔍 Geocoding (rate-limited):', address);
      
      const response = await rateLimitedFetch(`${BASE_URL}/marketplace/geocode`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ 
          address: address.trim() 
        }),
        signal: AbortSignal.timeout(20000),
      });

      if (!response.ok) {
        const errorText = await response.text();
        
        // Handle rate limiting gracefully
        if (response.status === 429) {
          throw new Error('Rate limit exceeded - please wait before making more requests');
        }
        
        throw new Error(`Geocoding failed: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      
      if (!data.latitude || !data.longitude) {
        throw new Error('Invalid geocoding response: missing coordinates');
      }

      const result = {
        latitude: parseFloat(data.latitude),
        longitude: parseFloat(data.longitude),
        formattedAddress: data.formattedAddress || address,
        city: data.city || '',
        street: data.street || '',
        houseNumber: data.houseNumber || '',
        postalCode: data.postalCode || '',
        country: data.country || 'Israel',
        source: data.source || 'greener-marketplace-maps'
      };

      if (isNaN(result.latitude) || isNaN(result.longitude)) {
        throw new Error('Invalid coordinates in response');
      }

      // Cache with 7-day expiry for cost optimization
      manageCacheSize(locationCache);
      locationCache.set(normalizedAddress, {
        data: result,
        timestamp: Date.now()
      });

      console.log('✅ Geocoding successful - cached for 7 days');
      return result;

    } catch (error) {
      console.error('❌ Geocoding error:', error.message);
      throw error;
    }
  });
};

/**
 * Reverse geocode with aggressive cost optimization
 * @param {number} latitude Latitude
 * @param {number} longitude Longitude
 * @returns {Promise<Object>} Address information
 */
export const reverseGeocode = async (latitude, longitude) => {
  if (!latitude || !longitude) {
    throw new Error('Latitude and longitude are required');
  }

  const lat = parseFloat(latitude);
  const lon = parseFloat(longitude);
  
  if (isNaN(lat) || isNaN(lon)) {
    throw new Error('Invalid latitude or longitude values');
  }

  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    throw new Error('Coordinates out of valid range');
  }

  // Create cache key with reduced precision for better cache hits
  const cacheKey = `${lat.toFixed(4)},${lon.toFixed(4)}`;
  
  if (reverseCache.has(cacheKey)) {
    const { data, timestamp } = reverseCache.get(cacheKey);
    if (Date.now() - timestamp < CACHE_DURATION) {
      console.log('✅ REVERSE GEOCODE CACHE HIT - Avoided Azure Maps API call');
      return data;
    }
  }

  // Use debounced requests to prevent duplicate calls
  return debouncedRequest(`reverse_${cacheKey}`, async () => {
    try {
      console.log('🗺️ Reverse geocoding (rate-limited):', lat, lon);
      
      const response = await rateLimitedFetch(`${BASE_URL}/marketplace/reverseGeocode?lat=${lat}&lon=${lon}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(20000),
      });

      if (!response.ok) {
        const errorText = await response.text();
        
        // Handle rate limiting gracefully
        if (response.status === 429) {
          throw new Error('Rate limit exceeded - please wait before making more requests');
        }
        
        throw new Error(`Reverse geocoding failed: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      
      const result = {
        latitude: lat,
        longitude: lon,
        formattedAddress: data.formattedAddress || `${lat.toFixed(4)}, ${lon.toFixed(4)}`,
        city: data.city || '',
        street: data.street || '',
        houseNumber: data.houseNumber || '',
        postalCode: data.postalCode || '',
        country: data.country || 'Israel',
        countryCode: data.countryCode || '',
        source: data.source || 'greener-marketplace-maps'
      };

      // Add additional fields if available
      if (data.cityHe) result.cityHe = data.cityHe;
      if (data.streetHe) result.streetHe = data.streetHe;
      if (data.regionHe) result.regionHe = data.regionHe;
      if (data.neighborhood) result.neighborhood = data.neighborhood;

      // Cache with 7-day expiry for cost optimization
      manageCacheSize(reverseCache);
      reverseCache.set(cacheKey, {
        data: result,
        timestamp: Date.now()
      });

      console.log('✅ Reverse geocoding successful - cached for 7 days');
      return result;

    } catch (error) {
      console.error('❌ Reverse geocoding error:', error.message);
      throw error;
    }
  });
};

/**
 * Manage cache size to prevent memory issues
 */
const manageCacheSize = (cache) => {
  if (cache.size >= MAX_CACHE_SIZE) {
    // Remove oldest 20% of entries
    const entries = Array.from(cache.entries());
    const sortedEntries = entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    const toRemove = Math.floor(MAX_CACHE_SIZE * 0.2);
    
    for (let i = 0; i < toRemove; i++) {
      cache.delete(sortedEntries[i][0]);
    }
    
    console.log(`🧹 Cache cleanup: removed ${toRemove} old entries`);
  }
};

// Periodic cache cleanup to remove expired entries
setInterval(() => {
  const now = Date.now();
  
  // Clean location cache
  for (const [key, { timestamp }] of locationCache.entries()) {
    if (now - timestamp > CACHE_DURATION) {
      locationCache.delete(key);
    }
  }
  
  // Clean reverse geocode cache
  for (const [key, { timestamp }] of reverseCache.entries()) {
    if (now - timestamp > CACHE_DURATION) {
      reverseCache.delete(key);
    }
  }
}, 60 * 60 * 1000); // Clean every hour

// Helper functions remain the same
export const formatCoordinates = (latitude, longitude, precision = 4) => {
  const lat = parseFloat(latitude);
  const lon = parseFloat(longitude);
  
  if (isNaN(lat) || isNaN(lon)) {
    return 'Invalid coordinates';
  }
  
  return `${lat.toFixed(precision)}, ${lon.toFixed(precision)}`;
};

export const validateCoordinates = (latitude, longitude) => {
  const lat = parseFloat(latitude);
  const lon = parseFloat(longitude);
  
  return !isNaN(lat) && !isNaN(lon) && 
         lat >= -90 && lat <= 90 && 
         lon >= -180 && lon <= 180;
};

export const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Radius of the Earth in kilometers
  const toRad = (value) => (value * Math.PI) / 180;
  
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c; // Distance in kilometers
};

export const isInIsrael = (latitude, longitude) => {
  const lat = parseFloat(latitude);
  const lon = parseFloat(longitude);
  
  // Rough bounding box for Israel
  return lat >= 29.5 && lat <= 33.4 && lon >= 34.2 && lon <= 35.9;
};

// Export cache statistics for monitoring
export const getCacheStats = () => {
  return {
    locationCacheSize: locationCache.size,
    reverseCacheSize: reverseCache.size,
    totalCacheEntries: locationCache.size + reverseCache.size,
    maxCacheSize: MAX_CACHE_SIZE,
    cacheUtilization: ((locationCache.size + reverseCache.size) / (MAX_CACHE_SIZE * 2) * 100).toFixed(1) + '%'
  };
};

export default {
  getAzureMapsKey,
  geocodeAddress,
  reverseGeocode,
  formatCoordinates,
  validateCoordinates,
  calculateDistance,
  isInIsrael,
  getCacheStats
};