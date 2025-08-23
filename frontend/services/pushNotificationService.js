/**
 * Push Notification Service
 * Provides a clean API for interacting with push notifications
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, Alert } from 'react-native';
import { 
  enablePushAfterLogin, 
  initializeChatPush, 
  getCurrentPushToken, 
  sendTestNotification,
  setupAndroidNotificationChannels
} from '../notifications/expoPushSetup';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';

// Core constants for Azure Functions
const API_BASE = 'https://usersfunctions.azurewebsites.net/api';
const NOTIFICATION_TOKEN_ENDPOINT = `${API_BASE}/notification-tokens`;
const BUSINESS_TOKEN_ENDPOINT = `${API_BASE}/business/register-token`;

/**
 * Request permission for push notifications
 * @returns {Promise<boolean>} Whether permission was granted
 */
export async function requestNotificationPermissions() {
  try {
    console.log('[pushService] Permission request function called');
    
    if (!Device.isDevice) {
      console.log('[pushService] Notification permissions skipped - not on physical device');
      return false;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    console.log(`[pushService] Current permission status: ${existingStatus}`);

    // Android 13+ (API level 33+) requires explicit permission
    if (existingStatus !== 'granted') {
      console.log('[pushService] Requesting notification permissions...');
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
      console.log(`[pushService] New permission status: ${status}`);
      
      // On Android, we also need to set up notification channels
      if (Platform.OS === 'android' && status === 'granted') {
        console.log('[pushService] Setting up Android notification channels');
        // Import this function from expoPushSetup.js
        await setupAndroidNotificationChannels();
      }
    }

    const permitted = finalStatus === 'granted';
    console.log(`[pushService] Notification permissions ${permitted ? 'granted' : 'denied'}`);
    
    // For debugging, show notification settings on Android
    if (Platform.OS === 'android') {
      try {
        const settings = await Notifications.getPermissionsAsync();
        console.log('[pushService] Detailed Android notification settings:', settings);
      } catch (err) {
        console.log('[pushService] Could not get detailed settings:', err);
      }
    }
    
    return permitted;
  } catch (error) {
    console.error('[pushService] Error requesting permissions:', error);
    return false;
  }
}

/**
 * Explicitly request notification permissions with user feedback
 * @returns {Promise<boolean>} Whether permission was granted
 */
export async function requestNotificationPermissionsWithUI() {
  try {
    const result = await requestNotificationPermissions();
    
    // Show alert based on result
    setTimeout(() => {
      Alert.alert(
        result ? 'Notifications Enabled' : 'Notifications Disabled',
        result 
          ? 'You will now receive notifications from the app.'
          : 'You will not receive notifications. You can enable them in your device settings.'
      );
    }, 500);
    
    return result;
  } catch (error) {
    console.error('[pushService] Error in permission UI flow:', error);
    return false;
  }
}

/**
 * Setup push notifications after user login
 * @param {string} userId - User email or ID
 * @param {Function} notificationHandler - Function to handle tapped notifications
 * @returns {Promise<string|null>} Push token if successful
 */
export async function setupPushNotifications(userId, notificationHandler) {
  try {
    // First explicitly request permissions
    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) {
      console.log('[pushService] Setup aborted - no permission granted');
      return null;
    }
    
    // Enable push registration system
    await enablePushAfterLogin();
    
    // Initialize push with the current user
    const token = await initializeChatPush(userId, notificationHandler);
    
    if (token) {
      console.log('[pushService] Push notifications setup complete', 
        `token: ${token.substring(0, 15)}...`);
      
      // Register with notifications container in Azure
      await registerTokenWithNotificationsContainer(userId, token);
    } else {
      console.log('[pushService] No token obtained during setup');
    }
    
    return token;
  } catch (error) {
    console.error('[pushService] Setup failed:', error);
    return null;
  }
}

/**
 * Register token with the "notifications" container in Azure
 * @param {string} userId - User email or ID
 * @param {string} token - Push notification token
 * @returns {Promise<boolean>} Success indicator
 */
export async function registerTokenWithNotificationsContainer(userId, token) {
  try {
    if (!token) {
      token = await getCurrentPushToken();
    }
    
    if (!token) {
      console.log('[pushService] No token to register with notifications container');
      return false;
    }
    
    console.log('[pushService] Registering token with notifications container:', 
      `userId: ${userId}, token: ${token.substring(0, 15)}...`);
    
    const response = await fetch(NOTIFICATION_TOKEN_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Request-ID': `reg-${Date.now()}`
      },
      body: JSON.stringify({
        userId,
        deviceToken: token,
        platform: Platform.OS,
        provider: 'expo',
        appVersion: Device.osVersion || 'unknown',
        deviceName: Device.deviceName || 'unknown',
        timestamp: new Date().toISOString()
      })
    });
    
    if (response.ok) {
      console.log('[pushService] Token registered with notifications container');
      return true;
    } else {
      const errorText = await response.text();
      console.error('[pushService] Token registration failed:', response.status, errorText);
      return false;
    }
  } catch (error) {
    console.error('[pushService] Error registering with notifications container:', error);
    return false;
  }
}

/**
 * Register a device token with a specific business
 * @param {string} businessId - The business ID
 * @returns {Promise<boolean>} Success indicator
 */
export async function registerTokenWithBusiness(businessId) {
  try {
    const token = await getCurrentPushToken();
    if (!token) {
      console.log('[pushService] No token to register with business');
      return false;
    }
    
    console.log('[pushService] Registering token with business:', 
      `businessId: ${businessId}, token: ${token.substring(0, 15)}...`);
    
    const response = await fetch(BUSINESS_TOKEN_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        businessId,
        token,
        platform: Platform.OS,
        provider: 'expo',
        deviceName: Device.deviceName || 'unknown'
      })
    });
    
    if (response.ok) {
      console.log(`[pushService] Token registered with business: ${businessId}`);
      return true;
    } else {
      const text = await response.text();
      console.error(`[pushService] Failed to register with business: ${response.status}`, text);
      return false;
    }
  } catch (error) {
    console.error('[pushService] Business token registration error:', error);
    return false;
  }
}

/**
 * Send a test notification to yourself
 */
export async function sendTestNotificationToSelf() {
  try {
    await sendTestNotification();
    return true;
  } catch (error) {
    console.error('[pushService] Test notification failed:', error);
    return false;
  }
}

/**
 * Send a chat message notification to a user
 * @param {string} senderId - User ID of the sender
 * @param {string} recipientId - User ID of the recipient
 * @param {string} message - The message content
 * @param {string} conversationId - ID of the conversation
 * @returns {Promise<boolean>} Success indicator
 */
export async function sendChatNotification(senderId, recipientId, message, conversationId) {
  try {
    console.log('[pushService] Sending chat notification:', 
      `from: ${senderId}, to: ${recipientId}`);
    
    const response = await fetch(`${API_BASE}/chat-notification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Request-ID': `chat-msg-${Date.now()}`
      },
      body: JSON.stringify({
        senderId,
        recipientId,
        message: message.length > 100 ? message.substring(0, 97) + '...' : message,
        conversationId,
        timestamp: new Date().toISOString()
      })
    });
    
    if (response.ok) {
      console.log('[pushService] Chat notification sent successfully');
      return true;
    } else {
      const errorText = await response.text();
      console.error('[pushService] Failed to send chat notification:', response.status, errorText);
      return false;
    }
  } catch (error) {
    console.error('[pushService] Error sending chat notification:', error);
    return false;
  }
}

/**
 * Send a business event notification (new order, product update, etc.)
 * @param {string} businessId - The business ID
 * @param {string} eventType - Type of business event
 * @param {Object} eventData - Event details
 * @returns {Promise<boolean>} Success indicator
 */
export async function sendBusinessEventNotification(businessId, eventType, eventData) {
  try {
    console.log(`[pushService] Sending business event notification: ${eventType}`);
    
    const response = await fetch(`${API_BASE}/business/event-notification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        businessId,
        eventType,
        eventData,
        timestamp: new Date().toISOString()
      })
    });
    
    if (response.ok) {
      console.log(`[pushService] Business event notification sent: ${eventType}`);
      return true;
    } else {
      const errorText = await response.text();
      console.error('[pushService] Failed to send business event notification:', response.status, errorText);
      return false;
    }
  } catch (error) {
    console.error('[pushService] Error sending business event notification:', error);
    return false;
  }
}

/**
 * Check the current status of push notifications
 */
export async function checkPushNotificationStatus() {
  try {
    // Import the function from expoPushSetup if available
    if (typeof checkPushNotificationStatus === 'function') {
      return await checkPushNotificationStatus();
    }
    
    // Otherwise do basic checks
    const status = {
      hasPermissions: false,
      hasToken: false,
      tokenPreview: null,
      platform: Platform.OS
    };
    
    const { status: permStatus } = await Notifications.getPermissionsAsync();
    status.hasPermissions = permStatus === 'granted';
    status.permissionStatus = permStatus;
    
    const token = await getCurrentPushToken();
    status.hasToken = !!token;
    if (token) {
      status.tokenPreview = token.substring(0, 12) + '...';
    }
    
    console.log('[pushService] Push notification status:', status);
    return status;
  } catch (error) {
    console.error('[pushService] Status check error:', error);
    return { error: error.message };
  }
}

/**
 * Force a push notification token refresh and registration
 */
export async function forcePushSetup(userId) {
  console.log('[pushService] Forcing push notification setup...');
  
  try {
    // Request permissions explicitly
    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) {
      console.log('[pushService] Cannot force setup - no permission');
      return false;
    }
    
    // Import the force function from expoPushSetup if available
    if (typeof forcePushNotificationSetup === 'function') {
      return await forcePushNotificationSetup(userId);
    }
    
    // Otherwise do our best with what we have
    await enablePushAfterLogin();
    const token = await initializeChatPush(userId, null);
    
    const success = !!token;
    console.log('[pushService] Force push setup:', success ? 'successful' : 'failed');
    return success;
  } catch (error) {
    console.error('[pushService] Force setup error:', error);
    return false;
  }
}

/**
 * Clear notifications for a user
 * @param {string} userId - User ID 
 * @returns {Promise<boolean>} Success indicator
 */
export async function clearUserNotifications(userId) {
  try {
    console.log(`[pushService] Clearing notifications for user: ${userId}`);
    
    const response = await fetch(`${API_BASE}/clear-notifications/${userId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (response.ok) {
      console.log('[pushService] Notifications cleared successfully');
      // Also clear local notifications
      await Notifications.dismissAllNotificationsAsync();
      return true;
    } else {
      const errorText = await response.text();
      console.error('[pushService] Failed to clear notifications:', response.status, errorText);
      return false;
    }
  } catch (error) {
    console.error('[pushService] Error clearing notifications:', error);
    return false;
  }
}

export default {
  setupPushNotifications,
  registerTokenWithNotificationsContainer,
  registerTokenWithBusiness,
  sendTestNotificationToSelf,
  sendChatNotification,
  sendBusinessEventNotification,
  clearUserNotifications,
  requestNotificationPermissions,
  requestNotificationPermissionsWithUI,
  checkPushNotificationStatus,
  forcePushSetup
};