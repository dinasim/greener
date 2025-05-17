// services/MarketplaceUpdates.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
export const UPDATE_TYPES = { WISHLIST: 'WISHLIST_UPDATED', PRODUCT: 'PRODUCT_UPDATED', PROFILE: 'PROFILE_UPDATED', REVIEW: 'REVIEW_UPDATED', MESSAGE: 'MESSAGE_UPDATED' };
const listeners = new Map();
export const triggerUpdate = async (updateType, data = {}) => {
  try {
    const updateInfo = { timestamp: Date.now(), ...data };
    await AsyncStorage.setItem(updateType, JSON.stringify(updateInfo));
    if (Platform.OS === 'web') {
      window.localStorage.setItem(`${updateType}_EVENT`, JSON.stringify(updateInfo));
      window.dispatchEvent(new CustomEvent('MARKETPLACE_UPDATE', { detail: { type: updateType, data: updateInfo } }));
    }
    console.log(`[MarketplaceUpdates] Triggered ${updateType} update:`, updateInfo);
    return true;
  } catch (error) {
    console.error(`[MarketplaceUpdates] Error triggering ${updateType} update:`, error);
    return false;
  }
};
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
export const clearUpdate = async (updateType) => {
  try {
    await AsyncStorage.removeItem(updateType);
    return true;
  } catch (error) {
    console.error(`[MarketplaceUpdates] Error clearing ${updateType} update:`, error);
    return false;
  }
};
export const addUpdateListener = (id, callback) => {
  if (Platform.OS !== 'web') return;
  const handleUpdate = (event) => {
    if (typeof callback === 'function' && event.detail) {
      callback(event.detail.type, event.detail.data);
    }
  };
  listeners.set(id, handleUpdate);
  window.addEventListener('MARKETPLACE_UPDATE', handleUpdate);
};
export const removeUpdateListener = (id) => {
  if (Platform.OS !== 'web') return;
  const listener = listeners.get(id);
  if (listener) {
    window.removeEventListener('MARKETPLACE_UPDATE', listener);
    listeners.delete(id);
  }
};