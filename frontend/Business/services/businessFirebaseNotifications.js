// Business/services/businessFirebaseNotifications.js
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Firebase imports for different platforms
let messaging = null;
let firebaseWeb = null;

if (Platform.OS === 'web') {
  // Web Firebase imports
  try {
    const { initializeApp, getApps } = require('firebase/app');
    const { getMessaging, getToken, onMessage } = require('firebase/messaging');
    
    firebaseWeb = {
      initializeApp,
      getApps,
      getMessaging,
      getToken,
      onMessage
    };
  } catch (error) {
    console.warn('[BusinessFirebase] Web Firebase import failed:', error);
  }
} else {
  // Mobile Firebase imports
  try {
    messaging = require('@react-native-firebase/messaging').default;
  } catch (error) {
    console.warn('[BusinessFirebase] Mobile Firebase import failed:', error);
  }
}

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBAKWjXK-zjao231_SDeuOIT8Rr95K7Bk0",
  authDomain: "greenerapp2025.firebaseapp.com",
  projectId: "greenerapp2025",
  storageBucket: "greenerapp2025.appspot.com",
  messagingSenderId: "241318918547",
  appId: "1:241318918547:web:9fc472ce576da839f11066",
  measurementId: "G-8K9XS4GPRM"
};

const vapidKey = "BHNdMNzA_Zt1-Y4hUB8-96CpGhcKpqn5m1WPkCUpMNpJBIJcFcxdNgCLBAiEeRjFwR7iE7LRVHRKwRWYX_Wj6bw";

class BusinessFirebaseNotificationService {
  constructor() {
    this.isInitialized = false;
    this.hasPermission = false;
    this.token = null;
    this.businessId = null;
    this.messageUnsubscribe = null;
  }

  async initialize(businessId = null) {
    try {
      this.businessId = businessId || await AsyncStorage.getItem('businessId');
      
      if (Platform.OS === 'web') {
        return await this.initializeWeb();
      } else {
        return await this.initializeMobile();
      }
    } catch (error) {
      console.error('[BusinessFirebase] Initialization failed:', error);
      return false;
    }
  }

  async initializeWeb() {
    if (!firebaseWeb) {
      console.warn('[BusinessFirebase] Web Firebase not available');
      return false;
    }

    try {
      // Register service worker
      if ('serviceWorker' in navigator) {
        await navigator.serviceWorker.register('/firebase-messaging-sw.js');
        await navigator.serviceWorker.ready;
      }

      // Initialize Firebase app
      const app = firebaseWeb.getApps().length === 0 
        ? firebaseWeb.initializeApp(firebaseConfig) 
        : firebaseWeb.getApps()[0];
      
      const messagingInstance = firebaseWeb.getMessaging(app);

      // Set up foreground message handler
      firebaseWeb.onMessage(messagingInstance, (payload) => {
        console.log('[BusinessFirebase] Foreground message received:', payload);
        this.handleForegroundMessage(payload);
      });

      this.isInitialized = true;
      console.log('[BusinessFirebase] Web Firebase initialized successfully');
      return true;
    } catch (error) {
      console.error('[BusinessFirebase] Web initialization failed:', error);
      return false;
    }
  }

  async initializeMobile() {
    if (!messaging) {
      console.warn('[BusinessFirebase] Mobile Firebase not available');
      return false;
    }

    try {
      // Set up foreground message handler
      this.messageUnsubscribe = messaging().onMessage(async (remoteMessage) => {
        console.log('[BusinessFirebase] Foreground message received:', remoteMessage);
        this.handleForegroundMessage(remoteMessage);
      });

      // Handle notification opened from background
      messaging().onNotificationOpenedApp((remoteMessage) => {
        console.log('[BusinessFirebase] Notification opened from background:', remoteMessage);
        this.handleNotificationOpened(remoteMessage);
      });

      // Check if app was opened from notification
      const initialNotification = await messaging().getInitialNotification();
      if (initialNotification) {
        console.log('[BusinessFirebase] App opened from notification:', initialNotification);
        this.handleNotificationOpened(initialNotification);
      }

      this.isInitialized = true;
      console.log('[BusinessFirebase] Mobile Firebase initialized successfully');
      return true;
    } catch (error) {
      console.error('[BusinessFirebase] Mobile initialization failed:', error);
      return false;
    }
  }

  async requestPermission() {
    try {
      if (Platform.OS === 'web') {
        const permission = await Notification.requestPermission();
        this.hasPermission = permission === 'granted';
      } else if (messaging) {
        const authStatus = await messaging().requestPermission();
        this.hasPermission = authStatus === messaging.AuthorizationStatus.AUTHORIZED || 
                           authStatus === messaging.AuthorizationStatus.PROVISIONAL;
      }

      console.log('[BusinessFirebase] Permission status:', this.hasPermission);
      return this.hasPermission;
    } catch (error) {
      console.error('[BusinessFirebase] Permission request failed:', error);
      return false;
    }
  }

  async getToken() {
    if (!this.isInitialized) {
      console.warn('[BusinessFirebase] Service not initialized');
      return null;
    }

    try {
      let token = null;

      if (Platform.OS === 'web' && firebaseWeb) {
        const app = firebaseWeb.getApps()[0];
        const messagingInstance = firebaseWeb.getMessaging(app);
        const registration = await navigator.serviceWorker.getRegistration();
        
        token = await firebaseWeb.getToken(messagingInstance, {
          vapidKey,
          serviceWorkerRegistration: registration
        });
      } else if (messaging) {
        token = await messaging().getToken();
      }

      if (token) {
        this.token = token;
        await AsyncStorage.setItem('businessFcmToken', token);
        console.log('[BusinessFirebase] Token obtained successfully');
      }

      return token;
    } catch (error) {
      console.error('[BusinessFirebase] Failed to get token:', error);
      return null;
    }
  }

  async updateTokenOnServer(businessId, token) {
    try {
      const response = await fetch('https://usersfunctions.azurewebsites.net/api/business/notification-settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Email': await AsyncStorage.getItem('userEmail'),
          'X-Business-ID': businessId
        },
        body: JSON.stringify({
          businessId,
          fcmToken: token,
          platform: Platform.OS,
          enabled: true
        })
      });

      if (!response.ok) {
        throw new Error(`Server update failed: ${response.status}`);
      }

      console.log('[BusinessFirebase] Token updated on server successfully');
      return true;
    } catch (error) {
      console.error('[BusinessFirebase] Failed to update token on server:', error);
      return false;
    }
  }

  async registerForWateringNotifications(notificationTime = '07:00') {
    try {
      if (!this.token) {
        console.warn('[BusinessFirebase] No token available for watering notifications');
        return false;
      }

      const response = await fetch('https://usersfunctions.azurewebsites.net/api/business/register-notification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Email': await AsyncStorage.getItem('userEmail'),
          'X-Business-ID': this.businessId
        },
        body: JSON.stringify({
          businessId: this.businessId,
          fcmToken: this.token,
          notificationTime,
          platform: Platform.OS
        })
      });

      if (!response.ok) {
        throw new Error(`Registration failed: ${response.status}`);
      }

      await AsyncStorage.setItem('wateringNotificationTime', notificationTime);
      await AsyncStorage.setItem('wateringNotificationsEnabled', 'true');

      console.log('[BusinessFirebase] Watering notifications registered successfully');
      return true;
    } catch (error) {
      console.error('[BusinessFirebase] Failed to register for watering notifications:', error);
      return false;
    }
  }

  async sendTestNotification() {
    try {
      if (!this.token) {
        throw new Error('No FCM token available');
      }

      const response = await fetch('https://usersfunctions.azurewebsites.net/api/test_notification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Email': await AsyncStorage.getItem('userEmail'),
          'X-Business-ID': this.businessId
        },
        body: JSON.stringify({
          businessId: this.businessId,
          fcmToken: this.token,
          testMessage: 'This is a test notification from your Greener business app!'
        })
      });

      if (!response.ok) {
        throw new Error(`Test notification failed: ${response.status}`);
      }

      console.log('[BusinessFirebase] Test notification sent successfully');
      return { success: true };
    } catch (error) {
      console.error('[BusinessFirebase] Failed to send test notification:', error);
      return { success: false, message: error.message };
    }
  }

  handleForegroundMessage(payload) {
    const { notification, data } = payload;
    
    // Show browser notification for web, or handle custom display for mobile
    if (Platform.OS === 'web') {
      if (Notification.permission === 'granted') {
        new Notification(notification?.title || 'Business Notification', {
          body: notification?.body || 'You have a new business notification',
          icon: '/icon-192.png',
          tag: data?.type || 'business',
          data: data
        });
      }
    } else {
      // For mobile, you might want to show an in-app notification
      console.log('[BusinessFirebase] Handle mobile foreground message:', payload);
    }
  }

  handleNotificationOpened(payload) {
    const { data } = payload;
    
    // Handle notification tap - navigate to appropriate screen
    if (data?.screen) {
      console.log('[BusinessFirebase] Navigate to:', data.screen);
      // You can emit an event here that your navigation system listens to
    }
  }

  setupTokenRefresh(businessId) {
    if (Platform.OS !== 'web' && messaging) {
      // Set up token refresh listener for mobile
      const unsubscribe = messaging().onTokenRefresh(async (token) => {
        console.log('[BusinessFirebase] Token refreshed:', token);
        this.token = token;
        await AsyncStorage.setItem('businessFcmToken', token);
        await this.updateTokenOnServer(businessId, token);
      });

      return unsubscribe;
    }
    return null;
  }

  cleanup() {
    if (this.messageUnsubscribe) {
      this.messageUnsubscribe();
      this.messageUnsubscribe = null;
    }
  }
}

// Export singleton instance
export const businessFirebaseNotificationService = new BusinessFirebaseNotificationService();
export default businessFirebaseNotificationService;