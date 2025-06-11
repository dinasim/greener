// Business/components/NotificationManager.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Alert, AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { 
  startNotificationPolling, 
  markNotificationAsRead,
  getCachedNotifications,
  setCachedNotifications 
} from '../services/notificationPollingApi';

export const useNotificationManager = (businessId, navigation) => {
  const [notifications, setNotifications] = useState([]);
  const [hasNewNotifications, setHasNewNotifications] = useState(false);
  const [notificationSummary, setNotificationSummary] = useState(null);
  const [isPolling, setIsPolling] = useState(false);
  
  const pollingRef = useRef(null);
  const appStateRef = useRef(AppState.currentState);
  const lastNotificationCheck = useRef(new Date());
  
  // Handle new notifications
  const handleNewNotifications = useCallback(async (newNotifications, summary) => {
    try {
      // Get cached notifications to check for duplicates
      const cachedNotifications = await getCachedNotifications();
      const cachedIds = cachedNotifications.map(n => n.id);
      
      // Filter out already seen notifications
      const unseenNotifications = newNotifications.filter(n => !cachedIds.includes(n.id));
      
      if (unseenNotifications.length > 0) {
        setNotifications(newNotifications);
        setNotificationSummary(summary);
        setHasNewNotifications(true);
        
        // Show alert for important notifications
        const urgentNotifications = unseenNotifications.filter(n => n.urgent);
        if (urgentNotifications.length > 0) {
          showUrgentNotificationAlert(urgentNotifications[0]);
        } else if (unseenNotifications.length > 0) {
          showNotificationAlert(unseenNotifications[0]);
        }
        
        // Cache notifications
        await setCachedNotifications(newNotifications);
      }
    } catch (error) {
      console.error('Error handling new notifications:', error);
    }
  }, []);
  
  // Show urgent notification alert
  const showUrgentNotificationAlert = (notification) => {
    Alert.alert(
      '🚨 ' + notification.title,
      notification.message,
      [
        {
          text: 'Dismiss',
          style: 'cancel',
          onPress: () => markAsRead(notification.id, notification.type)
        },
        {
          text: 'Take Action',
          style: 'default',
          onPress: () => {
            markAsRead(notification.id, notification.type);
            handleNotificationAction(notification);
          }
        }
      ]
    );
  };
  
  // Show regular notification alert
  const showNotificationAlert = (notification) => {
    Alert.alert(
      notification.title,
      notification.message,
      [
        {
          text: 'OK',
          onPress: () => markAsRead(notification.id, notification.type)
        },
        {
          text: 'View',
          onPress: () => {
            markAsRead(notification.id, notification.type);
            handleNotificationAction(notification);
          }
        }
      ]
    );
  };
  
  // Handle notification actions
  const handleNotificationAction = (notification) => {
    switch (notification.action) {
      case 'open_watering_checklist':
        navigation.navigate('WateringChecklistScreen', { businessId });
        break;
      case 'open_inventory':
        navigation.navigate('AddInventoryScreen', { 
          businessId, 
          showInventory: true,
          filter: 'lowStock' 
        });
        break;
      default:
        // No specific action
        break;
    }
  };
  
  // Mark notification as read
  const markAsRead = async (notificationId, notificationType) => {
    try {
      await markNotificationAsRead(notificationId, notificationType);
      
      // Remove from local state
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      
      // Update cache
      const cachedNotifications = await getCachedNotifications();
      const updatedCache = cachedNotifications.filter(n => n.id !== notificationId);
      await setCachedNotifications(updatedCache);
      
      // Check if any notifications remain
      if (notifications.length <= 1) {
        setHasNewNotifications(false);
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };
  
  // Start polling
  const startPolling = useCallback(() => {
    if (pollingRef.current || !businessId) return;
    
    console.log('🔔 Starting notification polling for business:', businessId);
    setIsPolling(true);
    
    pollingRef.current = startNotificationPolling(
      handleNewNotifications,
      60000 // Poll every minute
    );
  }, [businessId, handleNewNotifications]);
  
  // Stop polling
  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      console.log('🔕 Stopping notification polling');
      pollingRef.current();
      pollingRef.current = null;
      setIsPolling(false);
    }
  }, []);
  
  // Handle app state changes
  useEffect(() => {
    const handleAppStateChange = (nextAppState) => {
      if (appStateRef.current.match(/inactive|background/) && nextAppState === 'active') {
        // App came to foreground - resume polling
        console.log('📱 App came to foreground, resuming polling');
        startPolling();
      } else if (nextAppState.match(/inactive|background/)) {
        // App went to background - stop polling to save battery
        console.log('📱 App went to background, stopping polling');
        stopPolling();
      }
      
      appStateRef.current = nextAppState;
    };
    
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    
    return () => {
      subscription?.remove();
    };
  }, [startPolling, stopPolling]);
  
  // Initialize polling
  useEffect(() => {
    if (businessId) {
      startPolling();
    }
    
    return () => {
      stopPolling();
    };
  }, [businessId, startPolling, stopPolling]);
  
  // Clear notifications
  const clearAllNotifications = () => {
    setNotifications([]);
    setHasNewNotifications(false);
    setNotificationSummary(null);
  };
  
  return {
    notifications,
    hasNewNotifications,
    notificationSummary,
    isPolling,
    markAsRead,
    clearAllNotifications,
    startPolling,
    stopPolling
  };
};

export default useNotificationManager;