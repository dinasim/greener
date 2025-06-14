// Business/services/BusinessFirebaseNotificationService.js
// Firebase Notification Service specifically for Business users
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

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

const vapidKey = "BKF6MrQxSOYR9yI6nZR45zgrz248vA62XXw0232dE8e6CdPxSAoxGTG2e-JC8bN2YwbPZhSX4qBxcSd23sn_nwg";
const API_BASE_URL = 'https://usersfunctions.azurewebsites.net/api';

class BusinessFirebaseNotificationService {
  constructor() {
    this.isInitialized = false;
    this.messaging = null;
    this.app = null;
    this.businessId = null;
  }

  // Initialize Firebase for the current platform
  async initialize(businessId = null) {
    if (this.isInitialized) return true;

    try {
      this.businessId = businessId || await AsyncStorage.getItem('businessId');
      
      if (Platform.OS === 'web') {
        await this.initializeWeb();
      } else {
        await this.initializeMobile();
      }
      this.isInitialized = true;
      console.log('✅ Business Firebase initialized for platform:', Platform.OS);
      return true;
    } catch (error) {
      console.error('❌ Business Firebase initialization failed:', error);
      return false;
    }
  }

  // Initialize Firebase for web
  async initializeWeb() {
    try {
      // Check if notifications are supported
      if (!('Notification' in window)) {
        throw new Error('Notifications not supported in this browser');
      }

      // Dynamic import for web Firebase
      const { initializeApp, getApps } = await import('firebase/app');
      const { getMessaging, getToken, onMessage } = await import('firebase/messaging');

      // Initialize Firebase app (avoid duplicate initialization)
      const existingApps = getApps();
      this.app = existingApps.length > 0 ? existingApps[0] : initializeApp(firebaseConfig);
      
      // Initialize messaging
      this.messaging = getMessaging(this.app);

      // Set up foreground message handler for business notifications
      onMessage(this.messaging, (payload) => {
        console.log('📱 Business foreground message received:', payload);
        this.handleBusinessForegroundMessage(payload);
      });

      // Register service worker for background messages
      await this.registerServiceWorker();
      
    } catch (error) {
      console.error('Web Firebase initialization error:', error);
      throw error;
    }
  }

  // Initialize Firebase for mobile (React Native)
  async initializeMobile() {
    try {
      // Import React Native Firebase
      const messaging = (await import('@react-native-firebase/messaging')).default;
      this.messaging = messaging;

      // Request permission
      const authStatus = await messaging().requestPermission();
      const enabled = authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
                     authStatus === messaging.AuthorizationStatus.PROVISIONAL;

      if (!enabled) {
        throw new Error('Push notification permission not granted');
      }

      // Set up message handlers
      this.setupMobileMessageHandlers();

    } catch (error) {
      console.error('Mobile Firebase initialization error:', error);
      throw error;
    }
  }

  // Register service worker for web background messages
  async registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;

    try {
      const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
      console.log('✅ Business Service Worker registered:', registration);
    } catch (error) {
      console.log('⚠️ Business Service Worker registration failed:', error);
      // Continue without service worker - foreground messages will still work
    }
  }

  // Set up message handlers for mobile
  setupMobileMessageHandlers() {
    if (!this.messaging) return;

    // Foreground messages
    this.messaging().onMessage(async (remoteMessage) => {
      console.log('📱 Business foreground message received:', remoteMessage);
      this.handleBusinessForegroundMessage(remoteMessage);
    });

    // Background/quit state messages
    this.messaging().onNotificationOpenedApp((remoteMessage) => {
      console.log('📱 Business notification opened app:', remoteMessage);
      this.handleBusinessNotificationTap(remoteMessage);
    });

    // App opened from quit state
    this.messaging().getInitialNotification().then((remoteMessage) => {
      if (remoteMessage) {
        console.log('📱 Business app opened from quit state:', remoteMessage);
        this.handleBusinessNotificationTap(remoteMessage);
      }
    });
  }

  // Request notification permission
  async requestPermission() {
    if (Platform.OS === 'web') {
      if (Notification.permission === 'granted') return true;
      if (Notification.permission === 'denied') return false;
      
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    } else {
      // Mobile permission is handled during initialization
      return this.isInitialized;
    }
  }

  // Get FCM token
  async getToken() {
    if (!this.isInitialized) {
      const initialized = await this.initialize();
      if (!initialized) return null;
    }

    try {
      if (Platform.OS === 'web') {
        const { getToken } = await import('firebase/messaging');
        const token = await getToken(this.messaging, { vapidKey });
        console.log('✅ Business Web FCM token obtained');
        return token;
      } else {
        const token = await this.messaging().getToken();
        console.log('✅ Business Mobile FCM token obtained');
        return token;
      }
    } catch (error) {
      console.error('❌ Error getting business FCM token:', error);
      return null;
    }
  }

  // Register business for watering notifications
  async registerForWateringNotifications(notificationTime = '07:00') {
    const token = await this.getToken();
    if (!token || !this.businessId) return false;

    try {
      const response = await fetch(`${API_BASE_URL}/business/register-notification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Email': await AsyncStorage.getItem('userEmail'),
          'X-User-Type': 'business',
          'X-Business-ID': this.businessId
        },
        body: JSON.stringify({
          businessId: this.businessId,
          deviceToken: token,
          notificationTime,
          tokenType: Platform.OS === 'web' ? 'web' : 'fcm',
          platform: Platform.OS
        })
      });

      if (response.ok) {
        console.log('✅ Business registered for watering notifications');
        // Cache settings locally
        await AsyncStorage.setItem('wateringNotificationTime', notificationTime);
        await AsyncStorage.setItem('wateringNotificationsEnabled', 'true');
        await AsyncStorage.setItem(`business_fcm_token_${Platform.OS}`, token);
        return true;
      } else {
        console.error('❌ Failed to register business for notifications');
        return false;
      }
    } catch (error) {
      console.error('❌ Error registering business for notifications:', error);
      return false;
    }
  }

  // Update notification settings
  async updateNotificationSettings(settings) {
    const token = await this.getToken();
    if (!token || !this.businessId) return false;

    try {
      const response = await fetch(`${API_BASE_URL}/business/update-notification-settings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Email': await AsyncStorage.getItem('userEmail'),
          'X-User-Type': 'business',
          'X-Business-ID': this.businessId
        },
        body: JSON.stringify({
          businessId: this.businessId,
          deviceToken: token,
          ...settings,
          platform: Platform.OS
        })
      });

      if (response.ok) {
        console.log('✅ Business notification settings updated');
        return true;
      } else {
        console.error('❌ Failed to update business notification settings');
        return false;
      }
    } catch (error) {
      console.error('❌ Error updating business notification settings:', error);
      return false;
    }
  }

  // Send test notification
  async sendTestNotification() {
    const token = await this.getToken();
    if (!token || !this.businessId) return { success: false, message: 'No token available' };

    try {
      const response = await fetch(`${API_BASE_URL}/business/test-notification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Email': await AsyncStorage.getItem('userEmail'),
          'X-User-Type': 'business',
          'X-Business-ID': this.businessId
        },
        body: JSON.stringify({
          businessId: this.businessId,
          deviceToken: token,
          platform: Platform.OS
        })
      });

      const result = await response.json();
      
      if (response.ok) {
        console.log('✅ Business test notification sent');
        return { success: true, message: 'Test notification sent successfully' };
      } else {
        console.error('❌ Failed to send business test notification');
        return { success: false, message: result.error || 'Failed to send test notification' };
      }
    } catch (error) {
      console.error('❌ Error sending business test notification:', error);
      return { success: false, message: error.message };
    }
  }

  // Handle foreground messages for business
  handleBusinessForegroundMessage(payload) {
    const { notification, data } = payload;
    
    // Check if this is a business notification
    if (data?.businessId && data.businessId !== this.businessId) {
      return; // Ignore notifications for other businesses
    }
    
    if (Platform.OS === 'web') {
      // Show browser notification for web
      if (notification && Notification.permission === 'granted') {
        new Notification(notification.title || 'Greener Business', {
          body: notification.body,
          icon: '/icon-192.png',
          badge: '/icon-72.png',
          tag: data?.type || 'business',
          data: data,
          actions: [
            { action: 'open', title: 'Open App' },
            { action: 'dismiss', title: 'Dismiss' }
          ]
        });
      }
    } else {
      // For mobile, you might want to show an in-app notification
      console.log('📱 Handle business mobile foreground notification:', notification);
    }
  }

  // Handle notification tap for business
  handleBusinessNotificationTap(remoteMessage) {
    const { data } = remoteMessage;
    console.log('📱 Business notification tapped with data:', data);
    
    // Handle business-specific navigation
    if (data?.screen) {
      switch (data.screen) {
        case 'watering':
          // Navigate to watering checklist
          break;
        case 'inventory':
          // Navigate to inventory
          break;
        case 'orders':
          // Navigate to orders
          break;
        default:
          // Navigate to business home
          break;
      }
    }
  }

  // Setup token refresh listener
  setupTokenRefresh() {
    if (Platform.OS === 'web') {
      // Web doesn't have automatic token refresh, handle it manually if needed
      return;
    }

    // Mobile token refresh
    this.messaging().onTokenRefresh(async (token) => {
      console.log('🔄 Business FCM token refreshed');
      if (this.businessId) {
        await this.registerForWateringNotifications();
      }
    });
  }

  // Get cached token
  async getCachedToken() {
    try {
      return await AsyncStorage.getItem(`business_fcm_token_${Platform.OS}`);
    } catch (error) {
      return null;
    }
  }

  // Clear token (for logout)
  async clearToken() {
    try {
      if (Platform.OS !== 'web') {
        await this.messaging().deleteToken();
      }
      await AsyncStorage.removeItem(`business_fcm_token_${Platform.OS}`);
      await AsyncStorage.removeItem('wateringNotificationsEnabled');
      await AsyncStorage.removeItem('wateringNotificationTime');
      
      // Notify server to remove token
      if (this.businessId) {
        await fetch(`${API_BASE_URL}/business/unregister-notification`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-User-Email': await AsyncStorage.getItem('userEmail'),
            'X-User-Type': 'business',
            'X-Business-ID': this.businessId
          },
          body: JSON.stringify({
            businessId: this.businessId,
            platform: Platform.OS
          })
        });
      }
      
      console.log('✅ Business token cleared');
    } catch (error) {
      console.error('❌ Error clearing business token:', error);
    }
  }

  // Check if notifications are enabled
  async isNotificationEnabled() {
    const enabled = await AsyncStorage.getItem('wateringNotificationsEnabled');
    return enabled === 'true';
  }

  // Get notification time
  async getNotificationTime() {
    const time = await AsyncStorage.getItem('wateringNotificationTime');
    return time || '07:00';
  }
}

// Singleton instance
const businessFirebaseNotificationService = new BusinessFirebaseNotificationService();

export default businessFirebaseNotificationService;