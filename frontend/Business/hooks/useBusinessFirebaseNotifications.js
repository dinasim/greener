// Business/hooks/useBusinessFirebaseNotifications.js
import { useState, useEffect, useCallback } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import businessFirebaseNotificationService from '../services/businessFirebaseNotifications';

export const useBusinessFirebaseNotifications = (businessId = null) => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [hasPermission, setHasPermission] = useState(false);
  const [token, setToken] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Initialize Firebase notifications
  const initialize = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const initialized = await businessFirebaseNotificationService.initialize(businessId);
      setIsInitialized(initialized);

      if (initialized) {
        // Request permission
        const permission = await businessFirebaseNotificationService.requestPermission();
        setHasPermission(permission);

        if (permission) {
          // Get token
          const fcmToken = await businessFirebaseNotificationService.getToken();
          setToken(fcmToken);

          if (fcmToken && businessId) {
            // Update token on server
            await businessFirebaseNotificationService.updateTokenOnServer(businessId, fcmToken);
            
            // Setup token refresh
            businessFirebaseNotificationService.setupTokenRefresh(businessId);
          }
        }
      }

      return initialized && hasPermission;
    } catch (err) {
      console.error('[useBusinessFirebase] Initialization error:', err);
      setError(err.message);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [businessId]);

  // Register for watering notifications
  const registerForWateringNotifications = useCallback(async (notificationTime = '07:00') => {
    try {
      setError(null);
      
      if (!token) {
        throw new Error('No FCM token available');
      }

      const success = await businessFirebaseNotificationService.registerForWateringNotifications(notificationTime);
      
      if (success) {
        console.log('[useBusinessFirebase] Watering notifications registered successfully');
      }
      
      return success;
    } catch (err) {
      console.error('[useBusinessFirebase] Registration error:', err);
      setError(err.message);
      return false;
    }
  }, [token]);

  // Send test notification
  const sendTestNotification = useCallback(async () => {
    try {
      setError(null);
      
      if (!token) {
        throw new Error('No FCM token available');
      }

      const result = await businessFirebaseNotificationService.sendTestNotification();
      return result;
    } catch (err) {
      console.error('[useBusinessFirebase] Test notification error:', err);
      setError(err.message);
      return { success: false, message: err.message };
    }
  }, [token]);

  // Get notification info
  const getNotificationInfo = useCallback(() => {
    return {
      isInitialized,
      hasPermission,
      token,
      tokenType: token ? (Platform.OS === 'web' ? 'FCM-Web' : 'FCM-Mobile') : null,
      platform: Platform.OS
    };
  }, [isInitialized, hasPermission, token]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      businessFirebaseNotificationService.cleanup();
    };
  }, []);

  return {
    isInitialized,
    hasPermission,
    token,
    isLoading,
    error,
    initialize,
    registerForWateringNotifications,
    sendTestNotification,
    getNotificationInfo
  };
};