// hooks/useUniversalNotifications.js - UNIFIED NOTIFICATION HOOK
import { useState, useEffect, useCallback } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import universalNotificationManager, { NOTIFICATION_TYPES, PRIORITY } from '../services/UniversalNotificationManager';

export const useUniversalNotifications = (userType = 'user', userId = null, businessId = null) => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [hasPermission, setHasPermission] = useState(false);
  const [token, setToken] = useState(null);
  const [error, setError] = useState(null);
  const [settings, setSettings] = useState({});
  const [statistics, setStatistics] = useState({});
  const [isLoading, setIsLoading] = useState(true);

  // Initialize the notification manager
  const initialize = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const success = await universalNotificationManager.initialize(userType, userId, businessId);
      
      if (success) {
        const status = universalNotificationManager.getStatus();
        setIsInitialized(status.isInitialized);
        setHasPermission(status.hasPermission);
        setToken(status.token);
        
        const currentSettings = universalNotificationManager.getSettings();
        setSettings(currentSettings);
        
        const currentStats = universalNotificationManager.getStatistics();
        setStatistics(currentStats);
      } else {
        throw new Error('Failed to initialize notification manager');
      }
    } catch (err) {
      console.error('❌ Notification initialization error:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [userType, userId, businessId]);

  // Request permission
  const requestPermission = useCallback(async () => {
    try {
      setError(null);
      const granted = await universalNotificationManager.requestPermission();
      setHasPermission(granted);
      
      if (granted) {
        const status = universalNotificationManager.getStatus();
        setToken(status.token);
      }
      
      return granted;
    } catch (err) {
      console.error('❌ Permission request error:', err);
      setError(err.message);
      return false;
    }
  }, []);

  // Update settings
  const updateSettings = useCallback(async (newSettings) => {
    try {
      setError(null);
      const success = await universalNotificationManager.updateSettings(newSettings);
      
      if (success) {
        const currentSettings = universalNotificationManager.getSettings();
        setSettings(currentSettings);
      }
      
      return success;
    } catch (err) {
      console.error('❌ Settings update error:', err);
      setError(err.message);
      return false;
    }
  }, []);

  // Send test notification
  const sendTestNotification = useCallback(async () => {
    try {
      setError(null);
      const result = await universalNotificationManager.sendTestNotification();
      
      if (!result.success) {
        setError(result.message);
      }
      
      return result;
    } catch (err) {
      console.error('❌ Test notification error:', err);
      setError(err.message);
      return { success: false, message: err.message };
    }
  }, []);

  // Get notification info
  const getNotificationInfo = useCallback(() => {
    return {
      isInitialized,
      hasPermission,
      token: token !== 'Not Available' ? token : null,
      tokenType: Platform.OS === 'web' ? 'FCM-Web' : 'FCM-Mobile',
      platform: Platform.OS,
      userType,
      settings,
      statistics
    };
  }, [isInitialized, hasPermission, token, userType, settings, statistics]);

  // Register for specific notification types
  const registerForNotifications = useCallback(async (notificationType, options = {}) => {
    try {
      setError(null);
      
      // Update settings to enable this notification type
      const newSettings = {
        ...settings,
        [notificationType]: true,
        ...options
      };
      
      return await updateSettings(newSettings);
    } catch (err) {
      console.error('❌ Registration error:', err);
      setError(err.message);
      return false;
    }
  }, [settings, updateSettings]);

  // Unregister from notification types
  const unregisterFromNotifications = useCallback(async (notificationType) => {
    try {
      setError(null);
      
      const newSettings = {
        ...settings,
        [notificationType]: false
      };
      
      return await updateSettings(newSettings);
    } catch (err) {
      console.error('❌ Unregistration error:', err);
      setError(err.message);
      return false;
    }
  }, [settings, updateSettings]);

  // Clear all notifications
  const clearNotifications = useCallback(async () => {
    try {
      await universalNotificationManager.cleanup();
      await AsyncStorage.removeItem(`notification_settings_${userType}${businessId ? `_${businessId}` : ''}`);
      await AsyncStorage.removeItem(`fcm_token_${Platform.OS}`);
      
      setIsInitialized(false);
      setHasPermission(false);
      setToken(null);
      setSettings({});
      setStatistics({});
      
      console.log('✅ Notifications cleared');
    } catch (err) {
      console.error('❌ Clear notifications error:', err);
      setError(err.message);
    }
  }, [userType, businessId]);

  // Retry initialization
  const retry = useCallback(async () => {
    await initialize();
  }, [initialize]);

  // Initialize on mount
  useEffect(() => {
    if (userId || (userType === 'business' && businessId)) {
      initialize();
    }
  }, [initialize, userId, userType, businessId]);

  // Setup navigation listener for web
  useEffect(() => {
    if (Platform.OS === 'web') {
      const handleNavigationEvent = (event) => {
        const { screen, params } = event.detail;
        console.log('🔗 Navigation event from notification:', screen, params);
        // You can emit this to your navigation system
      };

      window.addEventListener('notificationNavigation', handleNavigationEvent);
      
      return () => {
        window.removeEventListener('notificationNavigation', handleNavigationEvent);
      };
    }
  }, []);

  // Return hook interface
  return {
    // Status
    isInitialized,
    hasPermission,
    token: token !== 'Not Available' ? token : null,
    error,
    isLoading,
    
    // Settings & Stats
    settings,
    statistics,
    
    // Actions
    initialize,
    requestPermission,
    updateSettings,
    sendTestNotification,
    registerForNotifications,
    unregisterFromNotifications,
    clearNotifications,
    retry,
    
    // Info
    getNotificationInfo,
    
    // Convenience methods for backward compatibility
    registerForWateringNotifications: (time = '07:00') => 
      registerForNotifications('wateringReminders', { notificationTime: time }),
    
    // Platform info
    platform: Platform.OS,
    userType
  };
};

// Specific hooks for backward compatibility
export const useFirebaseNotifications = (userEmail) => {
  return useUniversalNotifications('user', userEmail);
};

export const useBusinessFirebaseNotifications = (businessId) => {
  return useUniversalNotifications('business', null, businessId);
};

export default useUniversalNotifications;