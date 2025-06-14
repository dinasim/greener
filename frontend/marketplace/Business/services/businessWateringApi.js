// Business/services/businessWateringApi.js - FIXED VERSION (Barcode Removed)
// 
// This API service handles plant watering management, notifications, and related features.
// Works on both real devices and simulators/emulators for development and testing.
// 
// REMOVED: All barcode functionality as requested
//
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const API_BASE_URL = 'https://usersfunctions.azurewebsites.net/api';
const DEFAULT_TIMEOUT = 15000; // 15 seconds
const MAX_RETRY_ATTEMPTS = 3;

/**
 * Check if push notifications are supported
 * @returns {boolean} - True if notifications should be supported
 */
const areNotificationsSupported = () => {
  // Allow notifications on all platforms for development
  // In production, you might want to add more specific checks
  return true;
};

/**
 * Get watering checklist for a business
 * @param {string} businessId - Business identifier
 * @param {boolean} silent - If true, no error will be thrown on failure
 * @returns {Promise<Object>} - Watering checklist data
 */
export const getWateringChecklist = async (businessId, silent = false) => {
  try {
    if (!businessId) {
      businessId = await AsyncStorage.getItem('businessId');
    }
    
    const response = await fetchWithRetry(`${API_BASE_URL}/business/watering-checklist?businessId=${businessId}`, {
      method: 'GET',
      headers: await getAuthHeaders(businessId)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to get watering checklist: ${response.status} ${errorText}`);
    }
    
    const data = await response.json();
    
    // Save to cache for offline use
    try {
      await AsyncStorage.setItem('cached_watering_checklist', JSON.stringify({
        data,
        timestamp: Date.now(),
        businessId
      }));
    } catch (cacheError) {
      console.warn('Failed to cache watering checklist:', cacheError);
    }
    
    return data;
  } catch (error) {
    console.error('Error fetching watering checklist:', error);
    
    // Try to get from cache if silent mode
    if (silent) {
      try {
        const cachedData = await AsyncStorage.getItem('cached_watering_checklist');
        if (cachedData) {
          const parsed = JSON.parse(cachedData);
          if (parsed.businessId === businessId) {
            console.log('Using cached watering checklist data');
            return parsed.data;
          }
        }
      } catch (cacheError) {
        console.warn('Error reading cache:', cacheError);
      }
    }
    
    if (!silent) {
      throw error;
    }
    
    // Return empty structure if silent
    return {
      checklist: [],
      totalCount: 0,
      needsWateringCount: 0,
      timestamp: new Date().toISOString()
    };
  }
};

/**
 * Mark a plant as watered (FIXED: Removed barcode method)
 * @param {string} plantId - Plant identifier
 * @param {string} method - Watering method ('manual' or 'gps')
 * @param {Object} coordinates - Optional GPS coordinates
 * @returns {Promise<Object>} - Result data
 */
export const markPlantAsWatered = async (plantId, method = 'manual', coordinates = null) => {
  try {
    const businessId = await AsyncStorage.getItem('businessId');
    
    // If method is 'gps' but no coordinates provided, get current location
    if (method === 'gps' && !coordinates) {
      try {
        // Import Location dynamically to avoid issues if not available
        const Location = await import('expo-location');
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High
          });
          
          coordinates = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude
          };
        }
      } catch (locationError) {
        console.warn('Could not get location:', locationError);
      }
    }
    
    const response = await fetchWithRetry(`${API_BASE_URL}/business/watering-checklist`, {
      method: 'POST',
      headers: await getAuthHeaders(businessId),
      body: JSON.stringify({
        businessId,
        plantId,
        method,
        coordinates
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to mark plant as watered: ${response.status} ${errorText}`);
    }
    
    const data = await response.json();
    
    // Clear cache to force refresh
    await AsyncStorage.removeItem('cached_watering_checklist');
    
    return data;
  } catch (error) {
    console.error('Error marking plant as watered:', error);
    throw error;
  }
};

/**
 * Get optimized watering route
 * @param {string} businessId - Business identifier
 * @returns {Promise<Object>} - Optimized route data
 */
export const getOptimizedWateringRoute = async (businessId) => {
  try {
    if (!businessId) {
      businessId = await AsyncStorage.getItem('businessId');
    }
    
    const response = await fetchWithRetry(`${API_BASE_URL}/business/watering-route?businessId=${businessId}`, {
      method: 'GET',
      headers: await getAuthHeaders(businessId)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to get optimized route: ${response.status} ${errorText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching optimized watering route:', error);
    throw error;
  }
};

/**
 * Register device for watering notifications
 * @param {string} deviceToken - FCM or Expo push token
 * @param {string} notificationTime - Format: HH:MM (24-hour)
 * @returns {Promise<Object>} - Registration result
 */
export const registerForWateringNotifications = async (deviceToken, notificationTime = '07:00') => {
  try {
    const businessId = await AsyncStorage.getItem('businessId');
    
    // If no token provided, get one from Expo
    if (!deviceToken) {
      deviceToken = await getExpoPushToken();
    }
    
    if (!deviceToken) {
      throw new Error('Failed to get device token for notifications');
    }
    
    // Register with backend
    const response = await fetchWithRetry(`${API_BASE_URL}/business/register-notification`, {
      method: 'POST',
      headers: await getAuthHeaders(businessId),
      body: JSON.stringify({
        businessId,
        deviceToken,
        notificationTime
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to register for notifications: ${response.status} ${errorText}`);
    }
    
    // Save notification settings locally
    await AsyncStorage.setItem('wateringNotificationTime', notificationTime);
    await AsyncStorage.setItem('wateringNotificationsEnabled', 'true');
    await AsyncStorage.setItem('devicePushToken', deviceToken);
    
    return await response.json();
  } catch (error) {
    console.error('Error registering for watering notifications:', error);
    throw error;
  }
};

/**
 * Send a test notification
 * @param {string} deviceToken - Optional specific device token to test
 * @returns {Promise<Object>} - Test result
 */
export const sendTestNotification = async (deviceToken = null) => {
  try {
    const businessId = await AsyncStorage.getItem('businessId');
    
    // Get token if not provided
    if (!deviceToken) {
      deviceToken = await AsyncStorage.getItem('devicePushToken');
      
      if (!deviceToken) {
        deviceToken = await getExpoPushToken();
        
        if (deviceToken) {
          await AsyncStorage.setItem('devicePushToken', deviceToken);
        }
      }
    }
    
    if (!deviceToken) {
      throw new Error('No device token available for test notification');
    }
    
    // Send test notification request
    const response = await fetchWithRetry(`${API_BASE_URL}/business/test-notification`, {
      method: 'POST',
      headers: await getAuthHeaders(businessId),
      body: JSON.stringify({
        businessId,
        deviceToken
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to send test notification: ${response.status} ${errorText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error sending test notification:', error);
    throw error;
  }
};

/**
 * Get business weather information (FIXED: Real weather integration)
 * @param {string} businessId - Business identifier 
 * @returns {Promise<Object>} - Weather data
 */
export const getBusinessWeather = async (businessId) => {
  try {
    if (!businessId) {
      businessId = await AsyncStorage.getItem('businessId');
    }
    
    const response = await fetchWithRetry(`${API_BASE_URL}/business/weather?businessId=${businessId}`, {
      method: 'GET',
      headers: await getAuthHeaders(businessId)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.warn(`Weather API failed: ${response.status} ${errorText}`);
      
      // Return fallback weather data if API fails
      return {
        location: "Business Location",
        temperature: 22,
        condition: "Partly Cloudy", 
        precipitation: 0,
        icon: "partly-cloudy",
        timestamp: new Date().toISOString(),
        note: "Weather service unavailable - using fallback"
      };
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching business weather:', error);
    
    // Return fallback weather data on error
    return {
      location: "Business Location",
      temperature: 22,
      condition: "Weather Unavailable",
      precipitation: 0,
      icon: "unknown",
      timestamp: new Date().toISOString(),
      note: "Weather service error - using fallback"
    };
  }
};

/**
 * Get Expo push notification token
 * @returns {Promise<string|null>} - Push token or null if not available
 */
export const getExpoPushToken = async () => {
  // Allow notifications on simulators/emulators for development
  if (!areNotificationsSupported()) {
    console.log('Push notifications are not supported on this platform');
    return null;
  }
  
  try {
    // Check permission
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      console.log('Permission not granted for push notifications');
      return null;
    }
    
    // Get token - this works on simulators too in development
    const tokenData = await Notifications.getExpoPushTokenAsync();
    const token = tokenData.data;
    console.log('Expo push token:', token);
    
    return token;
  } catch (error) {
    console.error('Error getting push token:', error);
    
    // On simulators, sometimes we get a mock token for development
    if (__DEV__) {
      console.log('Using development token for simulator');
      return 'ExponentPushToken[simulator-development-token]';
    }
    
    return null;
  }
};

/**
 * Helper function to get auth headers
 * @param {string} businessId - Business identifier
 * @returns {Object} - Headers object
 */
const getAuthHeaders = async (businessId) => {
  const userEmail = await AsyncStorage.getItem('userEmail');
  const authToken = await AsyncStorage.getItem('authToken');
  
  const headers = {
    'Content-Type': 'application/json',
    'X-User-Email': userEmail || '',
    'X-User-Type': 'business',
    'X-Business-ID': businessId || userEmail || '',
    'X-API-Version': '1.0',
    'X-Client': 'greener-mobile'
  };
  
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }
  
  return headers;
};

/**
 * Helper function for fetch with retry logic
 * @param {string} url - The URL to fetch
 * @param {Object} options - Fetch options
 * @returns {Promise<Response>} - Fetch response
 */
const fetchWithRetry = async (url, options, attempt = 1) => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);
    
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    if (error.name === 'AbortError') {
      console.warn(`Request timeout: ${url}`);
    }
    
    if (attempt >= MAX_RETRY_ATTEMPTS) {
      throw error;
    }
    
    // Exponential backoff
    const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
    console.log(`Retrying request (${attempt}/${MAX_RETRY_ATTEMPTS}) after ${delay}ms`);
    
    await new Promise(resolve => setTimeout(resolve, delay));
    return fetchWithRetry(url, options, attempt + 1);
  }
};