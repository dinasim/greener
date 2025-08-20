// services/MarketplaceUpdates.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import signalRService from './signalRservice';

// ---- Optional RNFirebase (app + messaging). We guard everything. ----
let firebaseCore = null;         // @react-native-firebase/app
let messaging = null;            // @react-native-firebase/messaging

if (Platform.OS === 'android' || Platform.OS === 'ios') {
  try {
    firebaseCore = require('@react-native-firebase/app'); // { firebase }
  } catch (e) {
    console.warn('[MarketplaceUpdates] RNFirebase app module not available:', e?.message);
  }
  try {
    messaging = require('@react-native-firebase/messaging').default;
  } catch (e) {
    console.warn('[MarketplaceUpdates] Firebase Messaging import failed:', e?.message);
  }
}

// Tiny helper: do we actually have a default RNFirebase app?
const hasDefaultFirebaseApp = () => {
  try {
    // if @react-native-firebase/app is present, this throws when not configured
    return !!firebaseCore?.firebase?.app();
  } catch {
    return false;
  }
};

// ---------------- Update event types ----------------
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
  NOTIFICATION: 'NOTIFICATION_UPDATED',
};

// Unified storage keys
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
  [UPDATE_TYPES.NOTIFICATION]: 'NOTIFICATION_UPDATED',
};

// Listener registry
const updateListeners = new Map();

// FCM unsubscribe
let messageUnsubscribe = null;

// Cross-module cascades
const SYNC_TRIGGERS = {
  [UPDATE_TYPES.BUSINESS_PROFILE]: [UPDATE_TYPES.PRODUCT, UPDATE_TYPES.INVENTORY],
  [UPDATE_TYPES.INVENTORY]: [UPDATE_TYPES.PRODUCT, UPDATE_TYPES.BUSINESS_PROFILE],
  [UPDATE_TYPES.PROFILE]: [UPDATE_TYPES.BUSINESS_PROFILE],
  [UPDATE_TYPES.PRODUCT]: [UPDATE_TYPES.INVENTORY],
};

// ---------------- FCM init (guarded) ----------------
const initializeFCM = () => {
  // Only try on real mobile AND when both modules are present AND default app exists
  if (!(Platform.OS === 'android' || Platform.OS === 'ios')) return;
  if (!messaging) return;
  if (!hasDefaultFirebaseApp()) {
    console.warn(
      "[MarketplaceUpdates] ⛔ Skipping FCM: default Firebase app isn't configured. " +
      "Install @react-native-firebase/app and add google-services.json/GoogleService-Info.plist."
    );
    return;
  }

  try {
    // Foreground messages
    messageUnsubscribe = messaging().onMessage(async (remoteMessage) => {
      console.log('[MarketplaceUpdates] 📬 FCM (foreground):', remoteMessage);
      handleFCMMessage(remoteMessage);
    });

    // Background -> foreground taps
    messaging().onNotificationOpenedApp((remoteMessage) => {
      console.log('[MarketplaceUpdates] 🔔 Opened from background:', remoteMessage);
      handleFCMMessage(remoteMessage, true);
    });

    // Cold start via notification
    messaging()
      .getInitialNotification()
      .then((remoteMessage) => {
        if (remoteMessage) {
          console.log('[MarketplaceUpdates] 🚀 Opened from quit:', remoteMessage);
          handleFCMMessage(remoteMessage, true);
        }
      });

    console.log('[MarketplaceUpdates] ✅ FCM setup complete');
  } catch (error) {
    // Previously you saw: "No Firebase App '[DEFAULT]' ..."
    console.error('[MarketplaceUpdates] ❌ Error setting up FCM (guarded):', error);
  }
};

// ---------------- FCM handler ----------------
const handleFCMMessage = (remoteMessage, wasClicked = false) => {
  try {
    const { notification, data } = remoteMessage || {};
    if (!data?.type) {
      console.log('[MarketplaceUpdates] ⚠️ FCM message missing type:', remoteMessage);
      return;
    }

    let updateType = data.type;
    if (data.type === 'NEW_MESSAGE') updateType = UPDATE_TYPES.MESSAGE;
    if (data.type === 'NEW_REVIEW') updateType = UPDATE_TYPES.REVIEW;
    if (data.type === 'PROFILE_UPDATED') updateType = UPDATE_TYPES.PROFILE;
    if (data.type === 'BUSINESS_PROFILE_UPDATED') updateType = UPDATE_TYPES.BUSINESS_PROFILE;
    if (data.type === 'INVENTORY_UPDATED') updateType = UPDATE_TYPES.INVENTORY;
    if (data.type === 'ORDER_CREATED') updateType = UPDATE_TYPES.ORDER;

    const updateData = {
      source: 'fcm',
      notification: notification ? { title: notification.title, body: notification.body } : null,
      data,
      wasClicked,
      timestamp: Date.now(),
    };

    triggerUpdate(updateType, updateData, { silent: !wasClicked, source: 'fcm' });
  } catch (error) {
    console.error('[MarketplaceUpdates] ❌ Error handling FCM message:', error);
  }
};

// ---------------- Public API ----------------
export const triggerUpdate = async (
  updateType,
  data = {},
  options = { silent: false, retry: true, source: 'manual' }
) => {
  const { silent, retry, source } = options;

  try {
    if (
      !Object.values(UPDATE_TYPES).includes(updateType) &&
      !updateType.includes('_STARTED') &&
      !updateType.includes('_STOPPED') &&
      !updateType.includes('_READ')
    ) {
      console.warn(`[MarketplaceUpdates] Invalid update type: ${updateType}`);
      return false;
    }

    const updateInfo = { timestamp: Date.now(), type: updateType, source, ...data };

    const storageKey = STORAGE_KEYS[updateType] || updateType;
    await AsyncStorage.setItem(storageKey, JSON.stringify(updateInfo));

    const relatedUpdates = SYNC_TRIGGERS[updateType] || [];
    for (const relatedType of relatedUpdates) {
      const relatedStorageKey = STORAGE_KEYS[relatedType] || relatedType;
      const relatedUpdateInfo = {
        ...updateInfo,
        type: relatedType,
        source: `cascade_from_${updateType}`,
        originalUpdate: updateType,
      };
      await AsyncStorage.setItem(relatedStorageKey, JSON.stringify(relatedUpdateInfo));
      if (!silent) console.log(`[MarketplaceUpdates] ⚡ Cascade: ${relatedType} from ${updateType}`);
    }

    if (Platform.OS === 'web') {
      try {
        window.localStorage.setItem(`${storageKey}_EVENT`, JSON.stringify(updateInfo));
        const evt = new CustomEvent('MARKETPLACE_UPDATE', { detail: { type: updateType, data: updateInfo } });
        window.dispatchEvent(evt);
        if (window.BroadcastChannel) {
          const channel = new BroadcastChannel('greener_updates');
          channel.postMessage({ type: updateType, data: updateInfo });
          channel.close();
        }
      } catch (webError) {
        console.warn('[MarketplaceUpdates] Web event dispatch failed:', webError);
      }
    }

    notifyUpdateListeners(updateType, updateInfo);
    for (const relatedType of relatedUpdates) {
      notifyUpdateListeners(relatedType, { ...updateInfo, type: relatedType, source: `cascade_from_${updateType}` });
    }

    if (!silent) console.log(`[MarketplaceUpdates] ✅ Triggered ${updateType}`, updateInfo);
    return true;
  } catch (error) {
    console.error(`[MarketplaceUpdates] ❌ Error triggering ${updateType}:`, error);
    if (retry) {
      await new Promise((r) => setTimeout(r, 1000));
      return triggerUpdate(updateType, data, { ...options, retry: false });
    }
    return false;
  }
};

export const checkForUpdate = async (updateType) => {
  try {
    const storageKey = STORAGE_KEYS[updateType] || updateType;
    const updateData = await AsyncStorage.getItem(storageKey);
    if (updateData) {
      const parsed = JSON.parse(updateData);
      const isRecent = Date.now() - (parsed.timestamp || 0) < 5 * 60 * 1000;
      return { hasUpdate: true, updateInfo: parsed, isRecent };
    }
    return { hasUpdate: false, updateInfo: null, isRecent: false };
  } catch (error) {
    console.error(`[MarketplaceUpdates] ❌ Error checking ${updateType}:`, error);
    return { hasUpdate: false, updateInfo: null, isRecent: false };
  }
};

export const clearUpdate = async (updateType) => {
  try {
    const storageKey = STORAGE_KEYS[updateType] || updateType;
    await AsyncStorage.removeItem(storageKey);
    console.log(`[MarketplaceUpdates] 🧹 Cleared ${updateType}`);
    return true;
  } catch (error) {
    console.error(`[MarketplaceUpdates] ❌ Error clearing ${updateType}:`, error);
    return false;
  }
};

export const addUpdateListener = (listenerId, updateTypes, callback) => {
  if (!listenerId || typeof callback !== 'function') {
    console.warn('[MarketplaceUpdates] Invalid listener registration');
    return;
  }
  const types = Array.isArray(updateTypes) ? updateTypes : [updateTypes];
  types.forEach((type) => {
    if (!updateListeners.has(type)) updateListeners.set(type, new Map());
    updateListeners.get(type).set(listenerId, callback);
  });
  console.log(`[MarketplaceUpdates] 📡 Registered ${listenerId} for: ${types.join(', ')}`);
};

export const removeUpdateListener = (listenerId) => {
  let removed = 0;
  updateListeners.forEach((map, type) => {
    if (map.has(listenerId)) {
      map.delete(listenerId);
      removed++;
      if (map.size === 0) updateListeners.delete(type);
    }
  });
  if (removed) console.log(`[MarketplaceUpdates] 🗑️ Removed ${listenerId} from ${removed} types`);
};

const notifyUpdateListeners = (updateType, updateInfo) => {
  const map = updateListeners.get(updateType);
  if (!map || map.size === 0) return;
  map.forEach((cb, id) => {
    try { cb(updateType, updateInfo); } catch (e) { console.error(`[MarketplaceUpdates] ❌ Listener ${id} error:`, e); }
  });
};

export const clearAllUpdates = async () => {
  try {
    const keys = Object.values(STORAGE_KEYS);
    await Promise.all(keys.map((k) => AsyncStorage.removeItem(k)));
    const legacy = [
      'FAVORITES_UPDATED', 'marketplace_wishlist_update', 'marketplace_product_update',
      'marketplace_profile_update', 'marketplace_review_update', 'marketplace_message_update',
      'business_inventory_update', 'business_order_update', 'business_profile_update',
      'business_dashboard_update', 'business_settings_update', 'business_customer_update',
      'business_watering_update', 'business_notification_update',
    ];
    await Promise.all(legacy.map((k) => AsyncStorage.removeItem(k)));
    console.log('[MarketplaceUpdates] 🧹 All update flags cleared');
    return true;
  } catch (error) {
    console.error('[MarketplaceUpdates] ❌ Error clearing all updates:', error);
    return false;
  }
};

export const getAllUpdateStatus = async () => {
  try {
    const status = {};
    for (const [type, key] of Object.entries(STORAGE_KEYS)) {
      const val = await AsyncStorage.getItem(key);
      if (val) {
        const parsed = JSON.parse(val);
        status[type] = {
          hasUpdate: true,
          timestamp: parsed.timestamp,
          source: parsed.source,
          isRecent: Date.now() - (parsed.timestamp || 0) < 5 * 60 * 1000,
        };
      } else {
        status[type] = { hasUpdate: false };
      }
    }
    return status;
  } catch (error) {
    console.error('[MarketplaceUpdates] ❌ Error getting status:', error);
    return {};
  }
};

export const initializeMarketplaceUpdates = () => {
  console.log('[MarketplaceUpdates] 🚀 Initializing...');
  try {
    initializeFCM(); // will no-op if not configured
    if (signalRService?.initialize) signalRService.initialize();
    console.log('[MarketplaceUpdates] ✅ Initialized');
  } catch (error) {
    console.error('[MarketplaceUpdates] ❌ Init error:', error);
  }
};

export const cleanupMarketplaceUpdates = () => {
  try {
    if (messageUnsubscribe) { messageUnsubscribe(); messageUnsubscribe = null; }
    updateListeners.clear();
    console.log('[MarketplaceUpdates] 🧹 Cleaned up');
  } catch (error) {
    console.error('[MarketplaceUpdates] ❌ Cleanup error:', error);
  }
};

// Safe auto-init (kept, but now guarded)
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
  UPDATE_TYPES,
};
