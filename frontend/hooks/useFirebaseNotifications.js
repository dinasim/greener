import { useEffect, useState, useCallback } from 'react';
import { Platform } from 'react-native';
import firebaseNotificationService from '../services/FirebaseNotificationService';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const useFirebaseNotifications = (userEmail = null) => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [hasPermission, setHasPermission] = useState(false);
  const [token, setToken] = useState(null);
  const [error, setError] = useState(null);

  // Initialize notifications
  const initializeNotifications = useCallback(async () => {
    if (!userEmail) return;

    try {
      setError(null);
      
      // Initialize Firebase
      const initialized = await firebaseNotificationService.initialize();
      setIsInitialized(initialized);
      
      if (!initialized) {
        throw new Error('Firebase initialization failed');
      }

      // Request permission
      const permission = await firebaseNotificationService.requestPermission();
      setHasPermission(permission);
      
      if (!permission) {
        throw new Error('Notification permission denied');
      }

      // Get token
      const fcmToken = await firebaseNotificationService.getToken();
      setToken(fcmToken);
      
      if (fcmToken && userEmail) {
        // Update token on server
        await firebaseNotificationService.updateTokenOnServer(userEmail, fcmToken);
        // Setup token refresh
        firebaseNotificationService.setupTokenRefresh(userEmail);
      }

    } catch (err) {
      setError(err.message);
      console.log('🔇 Notification setup failed:', err.message);
    }
  }, [userEmail]);

  // Request permission manually
  const requestPermission = useCallback(async () => {
    try {
      const permission = await firebaseNotificationService.requestPermission();
      setHasPermission(permission);
      
      if (permission && userEmail) {
        const fcmToken = await firebaseNotificationService.getToken();
        setToken(fcmToken);
        
        if (fcmToken) {
          await firebaseNotificationService.updateTokenOnServer(userEmail, fcmToken);
        }
      }
      
      return permission;
    } catch (err) {
      setError(err.message);
      return false;
    }
  }, [userEmail]);

  // Clear notifications (for logout)
  const clearNotifications = useCallback(async () => {
    if (userEmail) {
      await firebaseNotificationService.clearToken(userEmail);
    }
    setToken(null);
    setHasPermission(false);
    setIsInitialized(false);
    setError(null);
  }, [userEmail]);

  // Get cached token
  const getCachedToken = useCallback(async () => {
    const cachedToken = await firebaseNotificationService.getCachedToken();
    setToken(cachedToken);
    return cachedToken;
  }, []);

  // Initialize on mount and when userEmail changes
  useEffect(() => {
    if (userEmail) {
      initializeNotifications();
    }
  }, [userEmail, initializeNotifications]);

  // Listen for service worker messages (web only)
  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const handleServiceWorkerMessage = (event) => {
      if (event.data?.type === 'NOTIFICATION_CLICK') {
        // Handle notification click navigation
        console.log('📱 Notification clicked:', event.data);
        // You can emit an event here or use your navigation system
      }
    };

    navigator.serviceWorker?.addEventListener('message', handleServiceWorkerMessage);

    return () => {
      navigator.serviceWorker?.removeEventListener('message', handleServiceWorkerMessage);
    };
  }, []);

  return {
    isInitialized,
    hasPermission,
    token,
    error,
    requestPermission,
    clearNotifications,
    getCachedToken,
    retry: initializeNotifications
  };
};