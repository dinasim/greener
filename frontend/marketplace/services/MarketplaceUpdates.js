// services/MarketplaceUpdates.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Define standard event types
export const UPDATE_TYPES = {
  WISHLIST: 'WISHLIST_UPDATED',
  PRODUCT: 'PRODUCT_UPDATED',
  PROFILE: 'PROFILE_UPDATED',
  REVIEW: 'REVIEW_UPDATED',
  MESSAGE: 'MESSAGE_UPDATED'
};

// For web - event listeners
const listeners = new Map();

/**
 * Triggers a marketplace update event
 * @param {string} updateType The type of update (use UPDATE_TYPES constants)
 * @param {Object} data Additional data related to the update
 */
export const triggerUpdate = async (updateType, data = {}) => {
  try {
    // Store update time and data
    const updateInfo = {
      timestamp: Date.now(),
      ...data
    };

    // Store in AsyncStorage for persistence across app restarts
    await AsyncStorage.setItem(updateType, JSON.stringify(updateInfo));

    // Broadcast event for real-time updates within the app
    if (Platform.OS === 'web') {
      // Use localStorage event for web
      window.localStorage.setItem(`${updateType}_EVENT`, JSON.stringify(updateInfo));
      // Dispatch custom event for web
      window.dispatchEvent(new CustomEvent('MARKETPLACE_UPDATE', {
        detail: { type: updateType, data: updateInfo }
      }));
    }

    console.log(`[MarketplaceUpdates] Triggered ${updateType} update:`, updateInfo);
    return true;
  } catch (error) {
    console.error(`[MarketplaceUpdates] Error triggering ${updateType} update:`, error);
    return false;
  }
};

/**
 * Checks if an update has occurred since a given time
 * @param {string} updateType The type of update to check
 * @param {number} since Timestamp to check against (default: 0)
 */
export const checkForUpdate = async (updateType, since = 0) => {
  try {
    const storedUpdate = await AsyncStorage.getItem(updateType);
    if (!storedUpdate) return false;

    const updateInfo = JSON.parse(storedUpdate);
    return updateInfo.timestamp > since;
  } catch (error) {
    console.error(`[MarketplaceUpdates] Error checking ${updateType} update:`, error);
    return false;
  }
};

/**
 * Clears a specific update flag
 * @param {string} updateType The type of update to clear
 */
export const clearUpdate = async (updateType) => {
  try {
    await AsyncStorage.removeItem(updateType);
    return true;
  } catch (error) {
    console.error(`[MarketplaceUpdates] Error clearing ${updateType} update:`, error);
    return false;
  }
};

/**
 * Add event listener for marketplace updates (for web only)
 * @param {string} id Unique identifier for this listener
 * @param {function} callback Function to call when an update occurs
 */
export const addUpdateListener = (id, callback) => {
  if (Platform.OS !== 'web') return;
  
  const handleUpdate = (event) => {
    if (typeof callback === 'function' && event.detail) {
      callback(event.detail.type, event.detail.data);
    }
  };
  
  // Store listener reference so we can remove it later
  listeners.set(id, handleUpdate);
  
  // Add event listener
  window.addEventListener('MARKETPLACE_UPDATE', handleUpdate);
};

/**
 * Remove event listener for marketplace updates
 * @param {string} id Unique identifier for the listener to remove
 */
export const removeUpdateListener = (id) => {
  if (Platform.OS !== 'web') return;
  
  const listener = listeners.get(id);
  if (listener) {
    window.removeEventListener('MARKETPLACE_UPDATE', listener);
    listeners.delete(id);
  }
};