// services/BusinessMarketplaceSyncBridge.js - Unified Sync Bridge for Business/Marketplace
import AsyncStorage from '@react-native-async-storage/async-storage';
import { triggerUpdate, UPDATE_TYPES } from './MarketplaceUpdates';

/**
 * Unified Sync Bridge for Business and Marketplace Modules
 * Handles cross-module data synchronization and cache management
 */
class BusinessMarketplaceSyncBridge {
  constructor() {
    this.unifiedCacheKeys = {
      BUSINESS_PROFILE: 'unified_business_profile',
      BUSINESS_INVENTORY: 'unified_business_inventory',
      MARKETPLACE_PRODUCTS: 'unified_marketplace_products',
      USER_PROFILE: 'unified_user_profile',
      SYNC_STATUS: 'unified_sync_status'
    };
    
    this.syncListeners = new Map();
    this.lastSyncTimes = new Map();
    this.isInitialized = false;
    
    this.initialize();
  }

  /**
   * Initialize the sync bridge
   */
  async initialize() {
    try {
      // Load last sync times
      const syncStatus = await AsyncStorage.getItem(this.unifiedCacheKeys.SYNC_STATUS);
      if (syncStatus) {
        const parsed = JSON.parse(syncStatus);
        this.lastSyncTimes = new Map(Object.entries(parsed));
      }
      
      this.isInitialized = true;
      console.log('🔄 BusinessMarketplaceSyncBridge initialized successfully');
    } catch (error) {
      console.error('❌ Error initializing sync bridge:', error);
    }
  }

  /**
   * Add business profile sync across modules
   */
  async addBusinessProfileSync(profileData, sourceModule = 'unknown') {
    try {
      console.log(`🏢 Syncing business profile from ${sourceModule}`);
      
      // Update unified cache
      const unifiedData = {
        data: profileData,
        timestamp: Date.now(),
        source: sourceModule,
        syncId: `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      };
      
      await AsyncStorage.setItem(
        this.unifiedCacheKeys.BUSINESS_PROFILE, 
        JSON.stringify(unifiedData)
      );
      
      // Update sync status
      this.lastSyncTimes.set('business_profile', Date.now());
      await this.saveSyncStatus();
      
      // Trigger marketplace updates
      await triggerUpdate(UPDATE_TYPES.BUSINESS_PROFILE, {
        businessId: profileData.id || profileData.email,
        source: sourceModule,
        action: 'profile_updated'
      });
      
      // Notify listeners
      this.notifyListeners('BUSINESS_PROFILE_SYNC', { profileData, sourceModule });
      
      console.log('✅ Business profile sync completed');
      return true;
    } catch (error) {
      console.error('❌ Business profile sync failed:', error);
      return false;
    }
  }

  /**
   * Add inventory sync across modules
   */
  async addInventorySync(inventoryData, sourceModule = 'unknown') {
    try {
      console.log(`📦 Syncing inventory from ${sourceModule}`);
      
      // Update unified cache
      const unifiedData = {
        data: inventoryData,
        timestamp: Date.now(),
        source: sourceModule,
        syncId: `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      };
      
      await AsyncStorage.setItem(
        this.unifiedCacheKeys.BUSINESS_INVENTORY, 
        JSON.stringify(unifiedData)
      );
      
      // Update sync status
      this.lastSyncTimes.set('business_inventory', Date.now());
      await this.saveSyncStatus();
      
      // Trigger marketplace updates
      await triggerUpdate(UPDATE_TYPES.INVENTORY, {
        inventoryCount: Array.isArray(inventoryData) ? inventoryData.length : 0,
        source: sourceModule,
        action: 'inventory_updated'
      });
      
      // Clear related marketplace caches
      await this.invalidateMarketplaceCache([
        'marketplace_plants',
        'marketplace_business_products_cache',
        'all_businesses'
      ]);
      
      // Notify listeners
      this.notifyListeners('INVENTORY_SYNC', { inventoryData, sourceModule });
      
      console.log('✅ Inventory sync completed');
      return true;
    } catch (error) {
      console.error('❌ Inventory sync failed:', error);
      return false;
    }
  }

  /**
   * Invalidate marketplace cache entries
   */
  async invalidateMarketplaceCache(cacheKeys = []) {
    try {
      console.log('🧹 Invalidating marketplace cache:', cacheKeys);
      
      // Remove specified cache keys
      await Promise.all(
        cacheKeys.map(key => AsyncStorage.removeItem(key))
      );
      
      // Remove unified cache entries that are stale
      const staleThreshold = 5 * 60 * 1000; // 5 minutes
      const now = Date.now();
      
      for (const [key, lastSync] of this.lastSyncTimes.entries()) {
        if (now - lastSync > staleThreshold) {
          await AsyncStorage.removeItem(this.unifiedCacheKeys[key.toUpperCase()]);
          this.lastSyncTimes.delete(key);
        }
      }
      
      await this.saveSyncStatus();
      
      // Trigger cache invalidation update
      await triggerUpdate(UPDATE_TYPES.PRODUCT, {
        action: 'cache_invalidated',
        cacheKeys
      });
      
      console.log('✅ Marketplace cache invalidation completed');
      return true;
    } catch (error) {
      console.error('❌ Cache invalidation failed:', error);
      return false;
    }
  }

  /**
   * Get unified business profile
   */
  async getUnifiedBusinessProfile(businessId) {
    try {
      const cached = await AsyncStorage.getItem(this.unifiedCacheKeys.BUSINESS_PROFILE);
      if (cached) {
        const parsed = JSON.parse(cached);
        
        // Check if cache is still valid (5 minutes)
        if (Date.now() - parsed.timestamp < 300000) {
          console.log('📱 Using unified business profile cache');
          return {
            success: true,
            data: parsed.data,
            source: parsed.source,
            cached: true
          };
        }
      }
      
      return { success: false, cached: false };
    } catch (error) {
      console.error('❌ Error getting unified business profile:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get unified inventory data
   */
  async getUnifiedInventory(businessId) {
    try {
      const cached = await AsyncStorage.getItem(this.unifiedCacheKeys.BUSINESS_INVENTORY);
      if (cached) {
        const parsed = JSON.parse(cached);
        
        // Check if cache is still valid (3 minutes)
        if (Date.now() - parsed.timestamp < 180000) {
          console.log('📱 Using unified inventory cache');
          return {
            success: true,
            data: parsed.data,
            source: parsed.source,
            cached: true
          };
        }
      }
      
      return { success: false, cached: false };
    } catch (error) {
      console.error('❌ Error getting unified inventory:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Add sync listener
   */
  addSyncListener(listenerId, eventTypes, callback) {
    if (!Array.isArray(eventTypes)) {
      eventTypes = [eventTypes];
    }
    
    this.syncListeners.set(listenerId, {
      eventTypes,
      callback,
      addedAt: Date.now()
    });
    
    console.log(`🔄 Added sync listener: ${listenerId} for events: ${eventTypes.join(', ')}`);
  }

  /**
   * Remove sync listener
   */
  removeSyncListener(listenerId) {
    const removed = this.syncListeners.delete(listenerId);
    if (removed) {
      console.log(`🔄 Removed sync listener: ${listenerId}`);
    }
    return removed;
  }

  /**
   * Notify sync listeners
   */
  notifyListeners(eventType, data) {
    for (const [listenerId, listener] of this.syncListeners.entries()) {
      try {
        if (listener.eventTypes.includes(eventType) || listener.eventTypes.includes('*')) {
          listener.callback({
            type: eventType,
            data,
            timestamp: Date.now(),
            source: 'sync_bridge'
          });
        }
      } catch (error) {
        console.error(`❌ Error notifying sync listener ${listenerId}:`, error);
      }
    }
  }

  /**
   * Save sync status to storage
   */
  async saveSyncStatus() {
    try {
      const statusData = Object.fromEntries(this.lastSyncTimes.entries());
      await AsyncStorage.setItem(
        this.unifiedCacheKeys.SYNC_STATUS, 
        JSON.stringify(statusData)
      );
    } catch (error) {
      console.error('❌ Error saving sync status:', error);
    }
  }

  /**
   * Get sync status
   */
  getSyncStatus() {
    return {
      isInitialized: this.isInitialized,
      lastSyncTimes: Object.fromEntries(this.lastSyncTimes.entries()),
      activeListeners: this.syncListeners.size,
      cacheKeys: Object.values(this.unifiedCacheKeys)
    };
  }

  /**
   * Force sync refresh
   */
  async forceSyncRefresh() {
    try {
      console.log('🔄 Forcing sync refresh');
      
      // Clear all unified caches
      await Promise.all(
        Object.values(this.unifiedCacheKeys).map(key => 
          AsyncStorage.removeItem(key)
        )
      );
      
      // Reset sync times
      this.lastSyncTimes.clear();
      await this.saveSyncStatus();
      
      // Trigger global refresh
      await triggerUpdate(UPDATE_TYPES.PRODUCT, {
        action: 'forced_refresh',
        timestamp: Date.now()
      });
      
      // Notify listeners
      this.notifyListeners('FORCED_REFRESH', {
        action: 'all_caches_cleared',
        timestamp: Date.now()
      });
      
      console.log('✅ Sync refresh completed');
      return true;
    } catch (error) {
      console.error('❌ Sync refresh failed:', error);
      return false;
    }
  }

  /**
   * Clean up expired data
   */
  async cleanup() {
    try {
      console.log('🧹 Cleaning up sync bridge data');
      
      const now = Date.now();
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours
      
      // Clean up old sync times
      for (const [key, timestamp] of this.lastSyncTimes.entries()) {
        if (now - timestamp > maxAge) {
          this.lastSyncTimes.delete(key);
        }
      }
      
      // Clean up old listeners
      for (const [listenerId, listener] of this.syncListeners.entries()) {
        if (now - listener.addedAt > maxAge) {
          this.syncListeners.delete(listenerId);
        }
      }
      
      await this.saveSyncStatus();
      
      console.log('✅ Sync bridge cleanup completed');
      return true;
    } catch (error) {
      console.error('❌ Sync bridge cleanup failed:', error);
      return false;
    }
  }
}

// Create singleton instance
const syncBridge = new BusinessMarketplaceSyncBridge();

// Export individual functions for convenience
export const addBusinessProfileSync = (profileData, sourceModule) => 
  syncBridge.addBusinessProfileSync(profileData, sourceModule);

export const addInventorySync = (inventoryData, sourceModule) => 
  syncBridge.addInventorySync(inventoryData, sourceModule);

export const invalidateMarketplaceCache = (cacheKeys) => 
  syncBridge.invalidateMarketplaceCache(cacheKeys);

export const getUnifiedBusinessProfile = (businessId) => 
  syncBridge.getUnifiedBusinessProfile(businessId);

export const getUnifiedInventory = (businessId) => 
  syncBridge.getUnifiedInventory(businessId);

export const addSyncListener = (listenerId, eventTypes, callback) => 
  syncBridge.addSyncListener(listenerId, eventTypes, callback);

export const removeSyncListener = (listenerId) => 
  syncBridge.removeSyncListener(listenerId);

export const getSyncStatus = () => 
  syncBridge.getSyncStatus();

export const forceSyncRefresh = () => 
  syncBridge.forceSyncRefresh();

export const cleanupSyncBridge = () => 
  syncBridge.cleanup();

export default syncBridge;