// services/SyncService.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import * as FileSystem from 'expo-file-system';
import marketplaceApi from './marketplaceApi';

class SyncService {
  constructor() {
    this.syncQueue = [];
    this.isOnline = true;
    this.isSyncing = false;
    this.syncListeners = [];
    this.SYNC_QUEUE_KEY = '@GreenerApp:syncQueue';
    this.DATA_TIMESTAMP_KEY = '@GreenerApp:dataTimestamps';
    this.init();
  }

  async init() {
    try {
      const queueJson = await AsyncStorage.getItem(this.SYNC_QUEUE_KEY);
      if (queueJson) {
        this.syncQueue = JSON.parse(queueJson);
      }
      this.setupNetworkMonitoring();
      this.processSyncQueue();
    } catch (error) {
      console.error('Error initializing sync service:', error);
    }
  }

  setupNetworkMonitoring() {
    NetInfo.fetch().then(state => {
      this.isOnline = state.isConnected;
    });

    NetInfo.addEventListener(state => {
      const wasOffline = !this.isOnline;
      this.isOnline = state.isConnected;

      if (wasOffline && this.isOnline && this.syncQueue.length > 0) {
        this.processSyncQueue();
      }

      this.notifyListeners({
        type: 'CONNECTION_CHANGE',
        isOnline: this.isOnline
      });
    });
  }

  async addToSyncQueue(operation) {
    try {
      operation.timestamp = Date.now();
      this.syncQueue.push(operation);
      await AsyncStorage.setItem(this.SYNC_QUEUE_KEY, JSON.stringify(this.syncQueue));
      this.notifyListeners({ type: 'QUEUE_UPDATED', queueLength: this.syncQueue.length });
      if (this.isOnline) this.processSyncQueue();
      return true;
    } catch (error) {
      console.error('Error adding to sync queue:', error);
      return false;
    }
  }

  async processSyncQueue() {
    if (this.isSyncing || !this.isOnline || this.syncQueue.length === 0) return;

    try {
      this.isSyncing = true;
      this.notifyListeners({ type: 'SYNC_STARTED' });
      const initialQueueLength = this.syncQueue.length;
      let successCount = 0;

      while (this.syncQueue.length > 0) {
        const operation = this.syncQueue[0];
        try {
          let success = false;
          switch (operation.type) {
            case 'CREATE_PLANT':
              success = await this.syncCreatePlant(operation);
              break;
            case 'UPDATE_PLANT':
              success = await this.syncUpdatePlant(operation);
              break;
            case 'DELETE_PLANT':
              success = await this.syncDeletePlant(operation);
              break;
            case 'TOGGLE_WISHLIST':
              success = await this.syncToggleWishlist(operation);
              break;
            case 'UPDATE_PROFILE':
              success = await this.syncUpdateProfile(operation);
              break;
            case 'SEND_MESSAGE':
              success = await this.syncSendMessage(operation);
              break;
            default:
              console.warn(`Unknown operation type: ${operation.type}`);
              success = true;
          }

          if (success) {
            this.syncQueue.shift();
            successCount++;
          } else {
            const failedOp = this.syncQueue.shift();
            failedOp.retryCount = (failedOp.retryCount || 0) + 1;
            if (failedOp.retryCount < 5) {
              this.syncQueue.push(failedOp);
            }
            if (!this.isOnline) break;
          }
        } catch (error) {
          console.error(`Error processing sync operation: ${operation.type}`, error);
          const failedOp = this.syncQueue.shift();
          failedOp.retryCount = (failedOp.retryCount || 0) + 1;
          if (failedOp.retryCount < 5) {
            this.syncQueue.push(failedOp);
          }
        }
      }

      await AsyncStorage.setItem(this.SYNC_QUEUE_KEY, JSON.stringify(this.syncQueue));
      this.notifyListeners({ type: 'SYNC_COMPLETED', initialQueueLength, successCount, remainingItems: this.syncQueue.length });
    } catch (error) {
      console.error('Error processing sync queue:', error);
      this.notifyListeners({ type: 'SYNC_ERROR', error: error.message });
    } finally {
      this.isSyncing = false;
    }
  }

  async syncCreatePlant(operation) {
    try {
      const { plantData, tempId } = operation.data;
      const processedPlantData = { ...plantData };

      if (processedPlantData.image?.startsWith('file://')) {
        const uploadResult = await marketplaceApi.uploadImage(processedPlantData.image, 'plant');
        if (uploadResult?.url) processedPlantData.image = uploadResult.url;
        else return false;
      }

      if (Array.isArray(processedPlantData.images)) {
        const processedImages = [];
        for (const imgUri of processedPlantData.images) {
          if (imgUri.startsWith('file://')) {
            const uploadResult = await marketplaceApi.uploadImage(imgUri, 'plant');
            if (uploadResult?.url) processedImages.push(uploadResult.url);
          } else {
            processedImages.push(imgUri);
          }
        }
        processedPlantData.images = processedImages;
      }

      const result = await marketplaceApi.createPlant(processedPlantData);
      if (result?.productId) {
        await this.updateLocalPlantId(tempId, result.productId);
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error syncing CREATE_PLANT:', error);
      return false;
    }
  }

  async syncUpdatePlant(operation) {
    try {
      const { plantId, updateData } = operation.data;
      const processedUpdateData = { ...updateData };

      if (processedUpdateData.image?.startsWith('file://')) {
        const uploadResult = await marketplaceApi.uploadImage(processedUpdateData.image, 'plant');
        if (uploadResult?.url) processedUpdateData.image = uploadResult.url;
        else return false;
      }

      if (Array.isArray(processedUpdateData.images)) {
        const processedImages = [];
        for (const imgUri of processedUpdateData.images) {
          if (imgUri.startsWith('file://')) {
            const uploadResult = await marketplaceApi.uploadImage(imgUri, 'plant');
            if (uploadResult?.url) processedImages.push(uploadResult.url);
          } else {
            processedImages.push(imgUri);
          }
        }
        processedUpdateData.images = processedImages;
      }

      const result = await marketplaceApi.updateProduct(plantId, processedUpdateData);
      return result?.success;
    } catch (error) {
      console.error('Error syncing UPDATE_PLANT:', error);
      return false;
    }
  }

  async syncDeletePlant(operation) {
    try {
      const { plantId } = operation.data;
      const result = await marketplaceApi.deleteProduct(plantId);
      return result?.success;
    } catch (error) {
      console.error('Error syncing DELETE_PLANT:', error);
      return false;
    }
  }

  async syncToggleWishlist(operation) {
    try {
      const { plantId } = operation.data;
      const result = await marketplaceApi.wishProduct(plantId);
      return result?.success;
    } catch (error) {
      console.error('Error syncing TOGGLE_WISHLIST:', error);
      return false;
    }
  }

  async syncUpdateProfile(operation) {
    try {
      const { userId, userData } = operation.data;
      const processedUserData = { ...userData };

      if (processedUserData.avatar?.startsWith('file://')) {
        const uploadResult = await marketplaceApi.uploadImage(processedUserData.avatar, 'avatar');
        if (uploadResult?.url) processedUserData.avatar = uploadResult.url;
        else return false;
      }

      const result = await marketplaceApi.updateUserProfile(userId, processedUserData);
      return result?.success;
    } catch (error) {
      console.error('Error syncing UPDATE_PROFILE:', error);
      return false;
    }
  }

  async syncSendMessage(operation) {
    try {
      const { chatId, message, isNewConversation, receiver, plantId } = operation.data;
      let result;
      if (isNewConversation) {
        result = await marketplaceApi.startConversation(receiver, plantId, message);
      } else {
        result = await marketplaceApi.sendMessage(chatId, message);
      }
      return result && (result.success || result.messageId);
    } catch (error) {
      console.error('Error syncing SEND_MESSAGE:', error);
      return false;
    }
  }

  async updateLocalPlantId(tempId, realId) {
    try {
      for (const op of this.syncQueue) {
        if (op.data?.plantId === tempId) {
          op.data.plantId = realId;
        }
      }
      await AsyncStorage.setItem(this.SYNC_QUEUE_KEY, JSON.stringify(this.syncQueue));
    } catch (error) {
      console.error('Error updating local plant ID:', error);
    }
  }

  async cacheData(key, data, maxAge = 1000 * 60 * 60) {
    try {
      await AsyncStorage.setItem(`@GreenerApp:${key}`, JSON.stringify(data));
      const timestamps = JSON.parse(await AsyncStorage.getItem(this.DATA_TIMESTAMP_KEY) || '{}');
      timestamps[key] = { timestamp: Date.now(), maxAge };
      await AsyncStorage.setItem(this.DATA_TIMESTAMP_KEY, JSON.stringify(timestamps));
      return true;
    } catch (error) {
      console.error('Error caching data:', error);
      return false;
    }
  }

  async getCachedData(key) {
    try {
      const timestamps = JSON.parse(await AsyncStorage.getItem(this.DATA_TIMESTAMP_KEY) || '{}');
      const entry = timestamps[key];
      if (entry && Date.now() - entry.timestamp < entry.maxAge) {
        const data = await AsyncStorage.getItem(`@GreenerApp:${key}`);
        return data ? JSON.parse(data) : null;
      }
      return null;
    } catch (error) {
      console.error('Error getting cached data:', error);
      return null;
    }
  }

  registerSyncListener(listener) {
    if (typeof listener === 'function') {
      this.syncListeners.push(listener);
      return () => {
        this.syncListeners = this.syncListeners.filter(l => l !== listener);
      };
    }
  }

  notifyListeners(event) {
    for (const listener of this.syncListeners) {
      try {
        listener(event);
      } catch (error) {
        console.error('Error in sync listener:', error);
      }
    }
  }

  getSyncStatus() {
    return {
      queueLength: this.syncQueue.length,
      isOnline: this.isOnline,
      isSyncing: this.isSyncing
    };
  }

  sync() {
    if (!this.isSyncing) this.processSyncQueue();
    return this.getSyncStatus();
  }

  async clearExpiredCache() {
    try {
      const timestamps = JSON.parse(await AsyncStorage.getItem(this.DATA_TIMESTAMP_KEY) || '{}');
      let hasChanges = false;
      for (const [key, entry] of Object.entries(timestamps)) {
        if (Date.now() - entry.timestamp >= entry.maxAge) {
          delete timestamps[key];
          await AsyncStorage.removeItem(`@GreenerApp:${key}`);
          hasChanges = true;
        }
      }
      if (hasChanges) {
        await AsyncStorage.setItem(this.DATA_TIMESTAMP_KEY, JSON.stringify(timestamps));
      }
      return true;
    } catch (error) {
      console.error('Error clearing expired cache:', error);
      return false;
    }
  }
}

// ✅ NEW: Add AppState persistence methods
/**
 * Save application state for persistence
 */
export const saveAppState = async (key, value) => {
  try {
    const stateKey = `@AppState:${key}`;
    await AsyncStorage.setItem(stateKey, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error(`Error saving app state for ${key}:`, error);
    return false;
  }
};

/**
 * Load saved application state
 */
export const loadAppState = async (key, defaultValue = null) => {
  try {
    const stateKey = `@AppState:${key}`;
    const savedState = await AsyncStorage.getItem(stateKey);
    return savedState ? JSON.parse(savedState) : defaultValue;
  } catch (error) {
    console.error(`Error loading app state for ${key}:`, error);
    return defaultValue;
  }
};

/**
 * Remove saved application state
 */
export const clearAppState = async (key) => {
  try {
    const stateKey = `@AppState:${key}`;
    await AsyncStorage.removeItem(stateKey);
    return true;
  } catch (error) {
    console.error(`Error clearing app state for ${key}:`, error);
    return false;
  }
};

export default new SyncService();
