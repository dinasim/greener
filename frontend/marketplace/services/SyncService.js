// services/SyncService.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import * as FileSystem from 'expo-file-system';
import marketplaceApi from './marketplaceApi';

/**
 * Service for handling data synchronization between local storage and server
 * Provides functionality for caching, offline data persistence, and sync
 */
class SyncService {
  constructor() {
    this.syncQueue = [];
    this.isOnline = true;
    this.isSyncing = false;
    this.syncListeners = [];
    this.SYNC_QUEUE_KEY = '@GreenerApp:syncQueue';
    this.DATA_TIMESTAMP_KEY = '@GreenerApp:dataTimestamps';
    
    // Initialize
    this.init();
  }

  /**
   * Initialize the sync service
   */
  async init() {
    try {
      // Load the sync queue from AsyncStorage
      const queueJson = await AsyncStorage.getItem(this.SYNC_QUEUE_KEY);
      if (queueJson) {
        this.syncQueue = JSON.parse(queueJson);
      }
      
      // Set up network status monitoring
      this.setupNetworkMonitoring();
      
      // Try to process any pending sync operations
      this.processSyncQueue();
    } catch (error) {
      console.error('Error initializing sync service:', error);
    }
  }

  /**
   * Set up network status monitoring
   */
  setupNetworkMonitoring() {
    // Check initial network status
    NetInfo.fetch().then(state => {
      this.isOnline = state.isConnected;
    });
    
    // Subscribe to network status changes
    NetInfo.addEventListener(state => {
      const wasOffline = !this.isOnline;
      this.isOnline = state.isConnected;
      
      // If we just came back online and we have items to sync
      if (wasOffline && this.isOnline && this.syncQueue.length > 0) {
        this.processSyncQueue();
      }
      
      // Notify listeners about network status change
      this.notifyListeners({
        type: 'CONNECTION_CHANGE',
        isOnline: this.isOnline
      });
    });
  }

  /**
   * Add a sync operation to the queue
   * @param {Object} operation - The operation to queue
   */
  async addToSyncQueue(operation) {
    try {
      // Add timestamp
      operation.timestamp = Date.now();
      
      // Add to queue
      this.syncQueue.push(operation);
      
      // Save queue to AsyncStorage
      await AsyncStorage.setItem(this.SYNC_QUEUE_KEY, JSON.stringify(this.syncQueue));
      
      // Notify listeners
      this.notifyListeners({
        type: 'QUEUE_UPDATED',
        queueLength: this.syncQueue.length
      });
      
      // Try to process queue if online
      if (this.isOnline) {
        this.processSyncQueue();
      }
      
      return true;
    } catch (error) {
      console.error('Error adding to sync queue:', error);
      return false;
    }
  }

  /**
   * Process the sync queue
   */
  async processSyncQueue() {
    // Don't process if already syncing or offline or empty queue
    if (this.isSyncing || !this.isOnline || this.syncQueue.length === 0) {
      return;
    }
    
    try {
      this.isSyncing = true;
      
      // Notify listeners that sync has started
      this.notifyListeners({
        type: 'SYNC_STARTED'
      });
      
      // Process each operation in order
      const initialQueueLength = this.syncQueue.length;
      let successCount = 0;
      
      for (let i = 0; i < this.syncQueue.length; i++) {
        const operation = this.syncQueue[0]; // Always process the first item
        
        try {
          // Process the operation based on its type
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
              success = true; // Remove unknown operations
          }
          
          if (success) {
            // Remove from queue if successful
            this.syncQueue.shift();
            successCount++;
          } else {
            // Skip to next operation if this one failed
            // Move failed operation to the end of the queue with a limit
            const failedOp = this.syncQueue.shift();
            failedOp.retryCount = (failedOp.retryCount || 0) + 1;
            
            // Only add back if under max retry limit
            if (failedOp.retryCount < 5) {
              this.syncQueue.push(failedOp);
            }
            
            // Break on network error
            if (!this.isOnline) {
              break;
            }
          }
        } catch (error) {
          console.error(`Error processing sync operation: ${operation.type}`, error);
          
          // Move failed operation to the end of the queue
          const failedOp = this.syncQueue.shift();
          failedOp.retryCount = (failedOp.retryCount || 0) + 1;
          
          // Only add back if under max retry limit
          if (failedOp.retryCount < 5) {
            this.syncQueue.push(failedOp);
          }
        }
      }
      
      // Save updated queue
      await AsyncStorage.setItem(this.SYNC_QUEUE_KEY, JSON.stringify(this.syncQueue));
      
      // Notify listeners that sync has completed
      this.notifyListeners({
        type: 'SYNC_COMPLETED',
        initialQueueLength,
        successCount,
        remainingItems: this.syncQueue.length
      });
      
    } catch (error) {
      console.error('Error processing sync queue:', error);
      
      // Notify listeners of sync error
      this.notifyListeners({
        type: 'SYNC_ERROR',
        error: error.message
      });
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Sync a CREATE_PLANT operation
   * @param {Object} operation - The operation to process
   * @returns {boolean} Whether the operation was successful
   */
  async syncCreatePlant(operation) {
    try {
      const { plantData, tempId } = operation.data;
      
      // Upload images first if they are local URI
      const processedPlantData = { ...plantData };
      
      // Process main image
      if (processedPlantData.image && processedPlantData.image.startsWith('file://')) {
        try {
          const uploadResult = await marketplaceApi.uploadImage(processedPlantData.image, 'plant');
          if (uploadResult && uploadResult.url) {
            processedPlantData.image = uploadResult.url;
          }
        } catch (err) {
          console.log('Failed to upload main image', err);
          return false; // Retry later
        }
      }
      
      // Process additional images
      if (Array.isArray(processedPlantData.images)) {
        const processedImages = [];
        for (const imgUri of processedPlantData.images) {
          if (imgUri && imgUri.startsWith('file://')) {
            try {
              const uploadResult = await marketplaceApi.uploadImage(imgUri, 'plant');
              if (uploadResult && uploadResult.url) {
                processedImages.push(uploadResult.url);
              }
            } catch (err) {
              console.log('Failed to upload additional image', err);
              // Continue with other images
            }
          } else {
            processedImages.push(imgUri);
          }
        }
        processedPlantData.images = processedImages;
      }
      
      // Send to API
      const result = await marketplaceApi.createPlant(processedPlantData);
      
      if (result && result.productId) {
        // Update local cache with the real ID
        await this.updateLocalPlantId(tempId, result.productId);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error syncing CREATE_PLANT:', error);
      return false;
    }
  }

  /**
   * Sync an UPDATE_PLANT operation
   * @param {Object} operation - The operation to process
   * @returns {boolean} Whether the operation was successful
   */
  async syncUpdatePlant(operation) {
    try {
      const { plantId, updateData } = operation.data;
      
      // Process any image updates
      const processedUpdateData = { ...updateData };
      
      // Process main image if changed
      if (processedUpdateData.image && processedUpdateData.image.startsWith('file://')) {
        try {
          const uploadResult = await marketplaceApi.uploadImage(processedUpdateData.image, 'plant');
          if (uploadResult && uploadResult.url) {
            processedUpdateData.image = uploadResult.url;
          }
        } catch (err) {
          console.log('Failed to upload updated main image', err);
          return false; // Retry later
        }
      }
      
      // Process additional images
      if (Array.isArray(processedUpdateData.images)) {
        const processedImages = [];
        for (const imgUri of processedUpdateData.images) {
          if (imgUri && imgUri.startsWith('file://')) {
            try {
              const uploadResult = await marketplaceApi.uploadImage(imgUri, 'plant');
              if (uploadResult && uploadResult.url) {
                processedImages.push(uploadResult.url);
              }
            } catch (err) {
              console.log('Failed to upload additional image in update', err);
              // Continue with other images
            }
          } else {
            processedImages.push(imgUri);
          }
        }
        processedUpdateData.images = processedImages;
      }
      
      // Send to API
      const result = await marketplaceApi.updateProduct(plantId, processedUpdateData);
      
      return result && result.success;
    } catch (error) {
      console.error('Error syncing UPDATE_PLANT:', error);
      return false;
    }
  }

  /**
   * Sync a DELETE_PLANT operation
   * @param {Object} operation - The operation to process
   * @returns {boolean} Whether the operation was successful
   */
  async syncDeletePlant(operation) {
    try {
      const { plantId } = operation.data;
      
      // Send to API
      const result = await marketplaceApi.deleteProduct(plantId);
      
      return result && result.success;
    } catch (error) {
      console.error('Error syncing DELETE_PLANT:', error);
      return false;
    }
  }

  /**
   * Sync a TOGGLE_WISHLIST operation
   * @param {Object} operation - The operation to process
   * @returns {boolean} Whether the operation was successful
   */
  async syncToggleWishlist(operation) {
    try {
      const { plantId } = operation.data;
      
      // Send to API
      const result = await marketplaceApi.wishProduct(plantId);
      
      return result && result.success;
    } catch (error) {
      console.error('Error syncing TOGGLE_WISHLIST:', error);
      return false;
    }
  }

  /**
   * Sync an UPDATE_PROFILE operation
   * @param {Object} operation - The operation to process
   * @returns {boolean} Whether the operation was successful
   */
  async syncUpdateProfile(operation) {
    try {
      const { userId, userData } = operation.data;
      
      // Process avatar if it's a local file
      const processedUserData = { ...userData };
      
      if (processedUserData.avatar && processedUserData.avatar.startsWith('file://')) {
        try {
          const uploadResult = await marketplaceApi.uploadImage(processedUserData.avatar, 'avatar');
          if (uploadResult && uploadResult.url) {
            processedUserData.avatar = uploadResult.url;
          }
        } catch (err) {
          console.log('Failed to upload avatar', err);
          return false; // Retry later
        }
      }
      
      // Send to API
      const result = await marketplaceApi.updateUserProfile(userId, processedUserData);
      
      return result && result.success;
    } catch (error) {
      console.error('Error syncing UPDATE_PROFILE:', error);
      return false;
    }
  }

  /**
   * Sync a SEND_MESSAGE operation
   * @param {Object} operation - The operation to process
   * @returns {boolean} Whether the operation was successful
   */
  async syncSendMessage(operation) {
    try {
      const { chatId, message, isNewConversation, receiver, plantId } = operation.data;
      
      let result;
      
      // Different API calls for new vs. existing conversations
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

  /**
   * Update a local plant ID after successful creation
   * @param {string} tempId - The temporary ID
   * @param {string} realId - The real ID from the server
   */
  async updateLocalPlantId(tempId, realId) {
    try {
      // Update any references in the sync queue
      for (const op of this.syncQueue) {
        if (op.data && op.data.plantId === tempId) {
          op.data.plantId = realId;
        }
      }
      
      // Save updated queue
      await AsyncStorage.setItem(this.SYNC_QUEUE_KEY, JSON.stringify(this.syncQueue));
      
      // You might also need to update other local storage references
      // This depends on your app's specific storage strategy
    } catch (error) {
      console.error('Error updating local plant ID:', error);
    }
  }

  /**
   * Cache data locally with timestamp
   * @param {string} key - The cache key
   * @param {any} data - The data to cache
   * @param {number} maxAge - Max age in milliseconds
   */
  async cacheData(key, data, maxAge = 1000 * 60 * 60) { // Default: 1 hour
    try {
      // Save the data
      await AsyncStorage.setItem(`@GreenerApp:${key}`, JSON.stringify(data));
      
      // Update the timestamp
      const timestamps = JSON.parse(await AsyncStorage.getItem(this.DATA_TIMESTAMP_KEY) || '{}');
      timestamps[key] = {
        timestamp: Date.now(),
        maxAge
      };
      await AsyncStorage.setItem(this.DATA_TIMESTAMP_KEY, JSON.stringify(timestamps));
      
      return true;
    } catch (error) {
      console.error('Error caching data:', error);
      return false;
    }
  }

  /**
   * Get cached data if it exists and is not expired
   * @param {string} key - The cache key
   * @returns {any} The cached data or null if not found/expired
   */
  async getCachedData(key) {
    try {
      // Get timestamps
      const timestamps = JSON.parse(await AsyncStorage.getItem(this.DATA_TIMESTAMP_KEY) || '{}');
      const entry = timestamps[key];
      
      // Check if we have a timestamp and it's not expired
      if (entry && entry.timestamp) {
        const age = Date.now() - entry.timestamp;
        if (age < entry.maxAge) {
          // Not expired, get the data
          const data = await AsyncStorage.getItem(`@GreenerApp:${key}`);
          return data ? JSON.parse(data) : null;
        }
      }
      
      // No timestamp or expired
      return null;
    } catch (error) {
      console.error('Error getting cached data:', error);
      return null;
    }
  }

  /**
   * Register a listener for sync events
   * @param {Function} listener - The listener function
   * @returns {Function} Function to unregister the listener
   */
  registerSyncListener(listener) {
    if (typeof listener === 'function') {
      this.syncListeners.push(listener);
      
      // Return function to unregister
      return () => {
        this.syncListeners = this.syncListeners.filter(l => l !== listener);
      };
    }
  }

  /**
   * Notify all listeners of an event
   * @param {Object} event - The event to send
   */
  notifyListeners(event) {
    for (const listener of this.syncListeners) {
      try {
        listener(event);
      } catch (error) {
        console.error('Error in sync listener:', error);
      }
    }
  }

  /**
   * Get the current sync queue status
   * @returns {Object} The sync queue status
   */
  getSyncStatus() {
    return {
      queueLength: this.syncQueue.length,
      isOnline: this.isOnline,
      isSyncing: this.isSyncing
    };
  }

  /**
   * Manually trigger a sync
   */
  sync() {
    if (!this.isSyncing) {
      this.processSyncQueue();
    }
    return this.getSyncStatus();
  }

  /**
   * Clear expired cache entries
   */
  async clearExpiredCache() {
    try {
      // Get timestamps
      const timestamps = JSON.parse(await AsyncStorage.getItem(this.DATA_TIMESTAMP_KEY) || '{}');
      let hasChanges = false;
      
      // Check each entry
      for (const [key, entry] of Object.entries(timestamps)) {
        if (entry && entry.timestamp) {
          const age = Date.now() - entry.timestamp;
          if (age >= entry.maxAge) {
            // Expired, remove it
            delete timestamps[key];
            await AsyncStorage.removeItem(`@GreenerApp:${key}`);
            hasChanges = true;
          }
        }
      }
      
      // Save updated timestamps if changed
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

// Create a singleton instance
const syncService = new SyncService();

export default syncService;