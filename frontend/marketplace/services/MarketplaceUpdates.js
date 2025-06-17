// services/MarketplaceUpdates.js - Enhanced Auto-Refresh Service with FCM Integration
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import signalRService from './signalRservice';

// Firebase imports for mobile
let messaging = null;
if (Platform.OS === 'android' || Platform.OS === 'ios') {
  try {
    messaging = require('@react-native-firebase/messaging').default;
  } catch (error) {
    console.warn('[MarketplaceUpdates] Firebase Messaging import failed:', error);
  }
}

// Update event types
export const UPDATE_TYPES = {
  WISHLIST: 'WISHLIST_UPDATED',
  PRODUCT: 'PRODUCT_UPDATED',
  PROFILE: 'PROFILE_UPDATED',
  REVIEW: 'REVIEW_UPDATED',
  MESSAGE: 'MESSAGE_UPDATED',
  INVENTORY: 'INVENTORY_UPDATED',
  ORDER: 'ORDER_UPDATED',
  BUSINESS_PROFILE: 'BUSINESS_PROFILE_UPDATED',
  DASHBOARD: 'DASHBOARD_UPDATED',
  SETTINGS: 'SETTINGS_UPDATED',
  CUSTOMER: 'CUSTOMER_UPDATED',
  WATERING: 'WATERING_UPDATED',
  NOTIFICATION: 'NOTIFICATION_UPDATED'
};

// FIXED: Unified storage keys for consistent sync
const STORAGE_KEYS = {
  [UPDATE_TYPES.WISHLIST]: 'WISHLIST_UPDATED',
  [UPDATE_TYPES.PRODUCT]: 'PRODUCT_UPDATED',
  [UPDATE_TYPES.PROFILE]: 'PROFILE_UPDATED',
  [UPDATE_TYPES.REVIEW]: 'REVIEW_UPDATED',
  [UPDATE_TYPES.MESSAGE]: 'MESSAGE_UPDATED',
  [UPDATE_TYPES.INVENTORY]: 'INVENTORY_UPDATED',
  [UPDATE_TYPES.ORDER]: 'ORDER_UPDATED',
  [UPDATE_TYPES.BUSINESS_PROFILE]: 'BUSINESS_PROFILE_UPDATED',
  [UPDATE_TYPES.DASHBOARD]: 'DASHBOARD_UPDATED',
  [UPDATE_TYPES.SETTINGS]: 'SETTINGS_UPDATED',
  [UPDATE_TYPES.CUSTOMER]: 'CUSTOMER_UPDATED',
  [UPDATE_TYPES.WATERING]: 'WATERING_UPDATED',
  [UPDATE_TYPES.NOTIFICATION]: 'NOTIFICATION_UPDATED'
};

// Event listeners map for cleanup
const listeners = new Map();
const updateListeners = new Map();

// FCM unsubscribe function
let messageUnsubscribe = null;

// FIXED: Cross-module sync triggers
const SYNC_TRIGGERS = {
  // Business profile changes should trigger marketplace refresh
  [UPDATE_TYPES.BUSINESS_PROFILE]: [UPDATE_TYPES.PRODUCT, UPDATE_TYPES.INVENTORY],
  // Inventory changes should trigger marketplace product refresh
  [UPDATE_TYPES.INVENTORY]: [UPDATE_TYPES.PRODUCT, UPDATE_TYPES.BUSINESS_PROFILE],
  // Profile changes should trigger both business and marketplace refresh
  [UPDATE_TYPES.PROFILE]: [UPDATE_TYPES.BUSINESS_PROFILE],
  // Product changes should trigger inventory sync for businesses
  [UPDATE_TYPES.PRODUCT]: [UPDATE_TYPES.INVENTORY]
};

// Initialize FCM for notifications (only on mobile)
const initializeFCM = () => {
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') return;
  if (!messaging) return;
  
  try {
    // Set up foreground message handler
    messageUnsubscribe = messaging().onMessage(async remoteMessage => {
      console.log('[MarketplaceUpdates] 📬 FCM message received in foreground:', remoteMessage);
      handleFCMMessage(remoteMessage);
    });
    
    // Handle notifications opened from background state
    messaging().onNotificationOpenedApp(remoteMessage => {
      console.log('[MarketplaceUpdates] 🔔 Notification opened from background state:', remoteMessage);
      handleFCMMessage(remoteMessage, true);
    });
    
    // Check if app was opened from a notification
    messaging()
      .getInitialNotification()
      .then(remoteMessage => {
        if (remoteMessage) {
          console.log('[MarketplaceUpdates] 🚀 App opened from quit state by notification:', remoteMessage);
          handleFCMMessage(remoteMessage, true);
        }
      });
    
    console.log('[MarketplaceUpdates] ✅ FCM setup completed successfully');
  } catch (error) {
    console.error('[MarketplaceUpdates] ❌ Error setting up FCM:', error);
  }
};

/**
 * Process FCM message and map to update type
 */
const handleFCMMessage = (remoteMessage, wasClicked = false) => {
  try {
    // Extract data from the notification
    const { notification, data } = remoteMessage;
    
    if (!data || !data.type) {
      console.log('[MarketplaceUpdates] ⚠️ FCM message missing type:', remoteMessage);
      return;
    }
    
    // Map FCM message type to our UPDATE_TYPES
    let updateType = data.type;
    
    // Map common FCM message types to our update types
    if (data.type === 'NEW_MESSAGE') updateType = UPDATE_TYPES.MESSAGE;
    if (data.type === 'NEW_REVIEW') updateType = UPDATE_TYPES.REVIEW;
    if (data.type === 'PROFILE_UPDATED') updateType = UPDATE_TYPES.PROFILE;
    if (data.type === 'BUSINESS_PROFILE_UPDATED') updateType = UPDATE_TYPES.BUSINESS_PROFILE;
    if (data.type === 'INVENTORY_UPDATED') updateType = UPDATE_TYPES.INVENTORY;
    if (data.type === 'ORDER_CREATED') updateType = UPDATE_TYPES.ORDER;
    
    // Create update data from FCM payload
    const updateData = {
      source: 'fcm',
      notification: notification ? {
        title: notification.title,
        body: notification.body
      } : null,
      data: data,
      wasClicked: wasClicked,
      timestamp: Date.now()
    };
    
    // Trigger the update
    triggerUpdate(updateType, updateData, { 
      silent: !wasClicked, // Only show logs if user clicked notification
      source: 'fcm' 
    });
    
  } catch (error) {
    console.error('[MarketplaceUpdates] ❌ Error handling FCM message:', error);
  }
};

/**
 * FIXED: Enhanced update trigger with cross-module sync
 */
export const triggerUpdate = async (updateType, data = {}, options = { silent: false, retry: true, source: 'manual' }) => {
  const { silent, retry, source } = options;
  
  try {
    // Validate update type
    if (!Object.values(UPDATE_TYPES).includes(updateType) && !updateType.includes('_STARTED') && !updateType.includes('_STOPPED') && !updateType.includes('_READ')) {
      console.warn(`[MarketplaceUpdates] Invalid update type: ${updateType}`);
      return false;
    }
    
    const updateInfo = {
      timestamp: Date.now(),
      type: updateType,
      source,
      ...data
    };
    
    // Store update info using unified storage keys
    const storageKey = STORAGE_KEYS[updateType] || updateType;
    await AsyncStorage.setItem(storageKey, JSON.stringify(updateInfo));
    
    // FIXED: Trigger related updates for cross-module sync
    const relatedUpdates = SYNC_TRIGGERS[updateType] || [];
    for (const relatedType of relatedUpdates) {
      const relatedStorageKey = STORAGE_KEYS[relatedType] || relatedType;
      const relatedUpdateInfo = {
        ...updateInfo,
        type: relatedType,
        source: `cascade_from_${updateType}`,
        originalUpdate: updateType
      };
      await AsyncStorage.setItem(relatedStorageKey, JSON.stringify(relatedUpdateInfo));
      
      if (!silent) {
        console.log(`[MarketplaceUpdates] ⚡ Triggered cascade update: ${relatedType} from ${updateType}`);
      }
    }
    
    // Web-specific cross-tab communication
    if (Platform.OS === 'web') {
      try {
        // Set localStorage for cross-tab detection
        window.localStorage.setItem(`${storageKey}_EVENT`, JSON.stringify(updateInfo));
        
        // Dispatch custom event
        const customEvent = new CustomEvent('MARKETPLACE_UPDATE', {
          detail: { type: updateType, data: updateInfo }
        });
        window.dispatchEvent(customEvent);
        
        // Broadcast channel for better cross-tab communication
        if (window.BroadcastChannel) {
          const channel = new BroadcastChannel('greener_updates');
          channel.postMessage({ type: updateType, data: updateInfo });
          channel.close();
        }
      } catch (webError) {
        console.warn('[MarketplaceUpdates] Web event dispatch failed:', webError);
      }
    }
    
    // Notify registered listeners
    notifyUpdateListeners(updateType, updateInfo);
    
    // FIXED: Also notify listeners for related updates
    for (const relatedType of relatedUpdates) {
      notifyUpdateListeners(relatedType, {
        ...updateInfo,
        type: relatedType,
        source: `cascade_from_${updateType}`
      });
    }
    
    if (!silent) {
      console.log(`[MarketplaceUpdates] ✅ Triggered ${updateType} update:`, updateInfo);
    }
    
    return true;
  } catch (error) {
    console.error(`[MarketplaceUpdates] ❌ Error triggering ${updateType} update:`, error);
    
    // Retry once on failure
    if (retry) {
      console.log(`[MarketplaceUpdates] 🔄 Retrying ${updateType} update...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
      return triggerUpdate(updateType, data, { ...options, retry: false });
    }
    
    return false;
  }
};

/**
 * FIXED: Enhanced check for updates with cross-module awareness
 */
export const checkForUpdate = async (updateType) => {
  try {
    const storageKey = STORAGE_KEYS[updateType] || updateType;
    const updateData = await AsyncStorage.getItem(storageKey);
    
    if (updateData) {
      const parsedData = JSON.parse(updateData);
      
      // Check if this is a recent update (within last 5 minutes)
      const isRecent = Date.now() - (parsedData.timestamp || 0) < 5 * 60 * 1000;
      
      return {
        hasUpdate: true,
        updateInfo: parsedData,
        isRecent: isRecent
      };
    }
    
    return { hasUpdate: false, updateInfo: null, isRecent: false };
  } catch (error) {
    console.error(`[MarketplaceUpdates] ❌ Error checking for ${updateType} update:`, error);
    return { hasUpdate: false, updateInfo: null, isRecent: false };
  }
};

/**
 * Clear specific update flag
 */
export const clearUpdate = async (updateType) => {
  try {
    const storageKey = STORAGE_KEYS[updateType] || updateType;
    await AsyncStorage.removeItem(storageKey);
    console.log(`[MarketplaceUpdates] 🧹 Cleared ${updateType} update flag`);
    return true;
  } catch (error) {
    console.error(`[MarketplaceUpdates] ❌ Error clearing ${updateType} update:`, error);
    return false;
  }
};

/**
 * FIXED: Enhanced listener registration with support for multiple update types
 */
export const addUpdateListener = (listenerId, updateTypes, callback) => {
  if (!listenerId || !callback || typeof callback !== 'function') {
    console.warn('[MarketplaceUpdates] Invalid listener registration');
    return;
  }
  
  // Ensure updateTypes is an array
  const types = Array.isArray(updateTypes) ? updateTypes : [updateTypes];
  
  // Register listener for each update type
  types.forEach(updateType => {
    if (!updateListeners.has(updateType)) {
      updateListeners.set(updateType, new Map());
    }
    updateListeners.get(updateType).set(listenerId, callback);
  });
  
  console.log(`[MarketplaceUpdates] 📡 Registered listener ${listenerId} for: ${types.join(', ')}`);
};

/**
 * Remove update listener
 */
export const removeUpdateListener = (listenerId) => {
  let removedCount = 0;
  
  updateListeners.forEach((listeners, updateType) => {
    if (listeners.has(listenerId)) {
      listeners.delete(listenerId);
      removedCount++;
    }
    
    // Clean up empty listener maps
    if (listeners.size === 0) {
      updateListeners.delete(updateType);
    }
  });
  
  if (removedCount > 0) {
    console.log(`[MarketplaceUpdates] 🗑️ Removed listener ${listenerId} from ${removedCount} update types`);
  }
};

/**
 * Notify registered listeners of updates
 */
const notifyUpdateListeners = (updateType, updateInfo) => {
  const listeners = updateListeners.get(updateType);
  if (!listeners || listeners.size === 0) return;
  
  listeners.forEach((callback, listenerId) => {
    try {
      callback(updateType, updateInfo);
    } catch (error) {
      console.error(`[MarketplaceUpdates] ❌ Error in listener ${listenerId}:`, error);
    }
  });
};

/**
 * FIXED: Clear all update flags for fresh start
 */
export const clearAllUpdates = async () => {
  try {
    const keysToRemove = Object.values(STORAGE_KEYS);
    await Promise.all(keysToRemove.map(key => AsyncStorage.removeItem(key)));
    
    // Also clear legacy keys
    const legacyKeys = [
      'FAVORITES_UPDATED',
      'marketplace_wishlist_update',
      'marketplace_product_update',
      'marketplace_profile_update',
      'marketplace_review_update',
      'marketplace_message_update',
      'business_inventory_update',
      'business_order_update',
      'business_profile_update',
      'business_dashboard_update',
      'business_settings_update',
      'business_customer_update',
      'business_watering_update',
      'business_notification_update'
    ];
    
    await Promise.all(legacyKeys.map(key => AsyncStorage.removeItem(key)));
    
    console.log('[MarketplaceUpdates] 🧹 All update flags cleared');
    return true;
  } catch (error) {
    console.error('[MarketplaceUpdates] ❌ Error clearing all updates:', error);
    return false;
  }
};

/**
 * Get status of all updates
 */
export const getAllUpdateStatus = async () => {
  try {
    const status = {};
    
    for (const [updateType, storageKey] of Object.entries(STORAGE_KEYS)) {
      const updateData = await AsyncStorage.getItem(storageKey);
      if (updateData) {
        const parsedData = JSON.parse(updateData);
        status[updateType] = {
          hasUpdate: true,
          timestamp: parsedData.timestamp,
          source: parsedData.source,
          isRecent: Date.now() - (parsedData.timestamp || 0) < 5 * 60 * 1000
        };
      } else {
        status[updateType] = { hasUpdate: false };
      }
    }
    
    return status;
  } catch (error) {
    console.error('[MarketplaceUpdates] ❌ Error getting all update status:', error);
    return {};
  }
};

/**
 * Initialize the service
 */
export const initializeMarketplaceUpdates = () => {
  console.log('[MarketplaceUpdates] 🚀 Initializing marketplace updates service...');
  
  try {
    // Initialize FCM if available
    initializeFCM();
    
    // Initialize SignalR if available
    if (signalRService && typeof signalRService.initialize === 'function') {
      signalRService.initialize();
    }
    
    console.log('[MarketplaceUpdates] ✅ Marketplace updates service initialized');
  } catch (error) {
    console.error('[MarketplaceUpdates] ❌ Error initializing marketplace updates:', error);
  }
};

/**
 * Cleanup function
 */
export const cleanupMarketplaceUpdates = () => {
  try {
    // Clean up FCM listener
    if (messageUnsubscribe) {
      messageUnsubscribe();
      messageUnsubscribe = null;
    }
    
    // Clear all listeners
    updateListeners.clear();
    listeners.clear();
    
    console.log('[MarketplaceUpdates] 🧹 Marketplace updates service cleaned up');
  } catch (error) {
    console.error('[MarketplaceUpdates] ❌ Error cleaning up marketplace updates:', error);
  }
};

// Auto-initialize on import
initializeMarketplaceUpdates();

export default {
  triggerUpdate,
  checkForUpdate,
  clearUpdate,
  clearAllUpdates,
  addUpdateListener,
  removeUpdateListener,
  getAllUpdateStatus,
  initializeMarketplaceUpdates,
  cleanupMarketplaceUpdates,
  UPDATE_TYPES
};