// Firebase Notification Service for Web and Mobile
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

class FirebaseNotificationService {
  constructor() {
    this.isInitialized = false;
    this.messaging = null;
    this.app = null;
  }

  // Initialize Firebase for the current platform
  async initialize() {
    if (this.isInitialized) return true;

    try {
      if (Platform.OS === 'web') {
        await this.initializeWeb();
      } else {
        await this.initializeMobile();
      }
      this.isInitialized = true;
      console.log('✅ Firebase initialized for platform:', Platform.OS);
      return true;
    } catch (error) {
      console.error('❌ Firebase initialization failed:', error);
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

      // Set up foreground message handler
      onMessage(this.messaging, (payload) => {
        console.log('📱 Foreground message received:', payload);
        this.handleForegroundMessage(payload);
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
      console.log('✅ Service Worker registered:', registration);
    } catch (error) {
      console.log('⚠️ Service Worker registration failed:', error);
      // Continue without service worker - foreground messages will still work
    }
  }

  // Set up message handlers for mobile
  setupMobileMessageHandlers() {
    if (!this.messaging) return;

    // Foreground messages
    this.messaging().onMessage(async (remoteMessage) => {
      console.log('📱 Foreground message received:', remoteMessage);
      this.handleForegroundMessage(remoteMessage);
    });

    // Background/quit state messages
    this.messaging().onNotificationOpenedApp((remoteMessage) => {
      console.log('📱 Notification opened app:', remoteMessage);
      this.handleNotificationTap(remoteMessage);
    });

    // App opened from quit state
    this.messaging().getInitialNotification().then((remoteMessage) => {
      if (remoteMessage) {
        console.log('📱 App opened from quit state:', remoteMessage);
        this.handleNotificationTap(remoteMessage);
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
        console.log('✅ Web FCM token obtained');
        return token;
      } else {
        const token = await this.messaging().getToken();
        console.log('✅ Mobile FCM token obtained');
        return token;
      }
    } catch (error) {
      console.error('❌ Error getting FCM token:', error);
      return null;
    }
  }

  // Update token on server
  async updateTokenOnServer(email, token) {
    if (!token || !email) return false;

    try {
      const response = await fetch('https://usersfunctions.azurewebsites.net/api/saveUser', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          [Platform.OS === 'web' ? 'webPushSubscription' : 'fcmToken']: token,
          platform: Platform.OS
        }),
      });

      if (response.ok) {
        console.log('✅ Token updated on server');
        // Cache token locally
        await AsyncStorage.setItem(`fcm_token_${Platform.OS}`, token);
        return true;
      } else {
        console.error('❌ Failed to update token on server');
        return false;
      }
    } catch (error) {
      console.error('❌ Error updating token on server:', error);
      return false;
    }
  }

  // Handle foreground messages
  handleForegroundMessage(payload) {
    const { notification, data } = payload;
    
    if (Platform.OS === 'web') {
      // Show browser notification for web
      if (notification && Notification.permission === 'granted') {
        new Notification(notification.title || 'Greener App', {
          body: notification.body,
          icon: '/icon-192.png',
          badge: '/icon-72.png',
          tag: data?.type || 'general',
          data: data
        });
      }
    } else {
      // For mobile, you might want to show an in-app notification
      // This could be handled by your app's notification system
      console.log('📱 Handle mobile foreground notification:', notification);
    }
  }

  // Handle notification tap
  handleNotificationTap(remoteMessage) {
    const { data } = remoteMessage;
    console.log('📱 Notification tapped with data:', data);
    
    // Handle navigation based on notification data
    if (data?.screen) {
      // You can emit an event or use navigation service to navigate
      // Example: NavigationService.navigate(data.screen, data.params);
    }
  }

  // Setup token refresh listener
  setupTokenRefresh(email) {
    if (Platform.OS === 'web') {
      // Web doesn't have automatic token refresh, handle it manually if needed
      return;
    }

    // Mobile token refresh
    this.messaging().onTokenRefresh(async (token) => {
      console.log('🔄 FCM token refreshed');
      await this.updateTokenOnServer(email, token);
    });
  }

  // Get cached token
  async getCachedToken() {
    try {
      return await AsyncStorage.getItem(`fcm_token_${Platform.OS}`);
    } catch (error) {
      return null;
    }
  }

  // Clear token (for logout)
  async clearToken(email) {
    try {
      if (Platform.OS !== 'web') {
        await this.messaging().deleteToken();
      }
      await AsyncStorage.removeItem(`fcm_token_${Platform.OS}`);
      
      // Notify server to remove token
      await fetch('https://usersfunctions.azurewebsites.net/api/saveUser', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          [Platform.OS === 'web' ? 'webPushSubscription' : 'fcmToken']: null,
          platform: Platform.OS
        }),
      });
      
      console.log('✅ Token cleared');
    } catch (error) {
      console.error('❌ Error clearing token:', error);
    }
  }
}

// Singleton instance
const firebaseNotificationService = new FirebaseNotificationService();

export default firebaseNotificationService;