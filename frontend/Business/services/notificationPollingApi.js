// Business/services/notificationPollingApi.js
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = 'https://usersfunctions.azurewebsites.net/api';

/**
 * Poll for pending notifications
 * @param {string} businessId 
 * @returns {Promise<Object>}
 */
export const getPendingNotifications = async (businessId) => {
  try {
    if (!businessId) {
      businessId = await AsyncStorage.getItem('businessId');
    }
    
    const response = await fetch(`${API_BASE_URL}/business/pending-notifications?businessId=${businessId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Email': await AsyncStorage.getItem('userEmail'),
        'X-User-Type': 'business',
        'X-Business-ID': businessId
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching pending notifications:', error);
    throw error;
  }
};

/**
 * Get notification settings
 * @param {string} businessId 
 * @returns {Promise<Object>}
 */
export const getNotificationSettings = async (businessId) => {
  try {
    if (!businessId) {
      businessId = await AsyncStorage.getItem('businessId');
    }
    
    const response = await fetch(`${API_BASE_URL}/business/notification-settings?businessId=${businessId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Email': await AsyncStorage.getItem('userEmail'),
        'X-User-Type': 'business',
        'X-Business-ID': businessId
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching notification settings:', error);
    throw error;
  }
};

/**
 * Update notification settings
 * @param {Object} settings 
 * @returns {Promise<Object>}
 */
export const updateNotificationSettings = async (settings) => {
  try {
    const businessId = settings.businessId || await AsyncStorage.getItem('businessId');
    
    const response = await fetch(`${API_BASE_URL}/business/notification-settings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Email': await AsyncStorage.getItem('userEmail'),
        'X-User-Type': 'business',
        'X-Business-ID': businessId
      },
      body: JSON.stringify({
        ...settings,
        businessId
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error updating notification settings:', error);
    throw error;
  }
};

/**
 * Mark notification as read
 * @param {string} notificationId 
 * @param {string} notificationType 
 * @returns {Promise<Object>}
 */
export const markNotificationAsRead = async (notificationId, notificationType) => {
  try {
    const businessId = await AsyncStorage.getItem('businessId');
    
    const response = await fetch(`${API_BASE_URL}/business/mark-notification-read`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Email': await AsyncStorage.getItem('userEmail'),
        'X-User-Type': 'business',
        'X-Business-ID': businessId
      },
      body: JSON.stringify({
        businessId,
        notificationId,
        notificationType
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error marking notification as read:', error);
    throw error;
  }
};

/**
 * Start notification polling
 * @param {function} onNotification - Callback for new notifications
 * @param {number} interval - Polling interval in milliseconds
 * @returns {function} - Stop polling function
 */
export const startNotificationPolling = (onNotification, interval = 60000) => {
  const poll = async () => {
    try {
      const data = await getPendingNotifications();
      if (data.hasNotifications && data.notifications.length > 0) {
        onNotification(data.notifications, data.summary);
      }
    } catch (error) {
      console.warn('Notification polling error:', error);
    }
  };
  
  // Start immediate poll
  poll();
  
  // Start polling interval
  const intervalId = setInterval(poll, interval);
  
  // Return stop function
  return () => clearInterval(intervalId);
};

/**
 * Get cached notifications to prevent duplicates
 */
const NOTIFICATION_CACHE_KEY = 'cached_notifications';

export const getCachedNotifications = async () => {
  try {
    const cached = await AsyncStorage.getItem(NOTIFICATION_CACHE_KEY);
    return cached ? JSON.parse(cached) : [];
  } catch (error) {
    console.error('Error getting cached notifications:', error);
    return [];
  }
};

export const setCachedNotifications = async (notifications) => {
  try {
    await AsyncStorage.setItem(NOTIFICATION_CACHE_KEY, JSON.stringify(notifications));
  } catch (error) {
    console.error('Error caching notifications:', error);
  }
};

export const clearNotificationCache = async () => {
  try {
    await AsyncStorage.removeItem(NOTIFICATION_CACHE_KEY);
  } catch (error) {
    console.error('Error clearing notification cache:', error);
  }
};