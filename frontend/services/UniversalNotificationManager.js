// services/UniversalNotificationManager.js - UNIFIED NOTIFICATION SYSTEM
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Notification Types
export const NOTIFICATION_TYPES = {
  // Universal types
  SYSTEM: 'system',
  TEST: 'test',
  
  // User types
  WATERING_REMINDER: 'watering_reminder',
  PLANT_CARE: 'plant_care',
  DISEASE_ALERT: 'disease_alert',
  FORUM_REPLY: 'forum_reply',
  MARKETPLACE_UPDATE: 'marketplace_update',
  DIRECT_MESSAGE: 'direct_message',
  
  // Business types
  NEW_ORDER: 'new_order',
  LOW_STOCK: 'low_stock',
  CUSTOMER_MESSAGE: 'customer_message',
  PAYMENT_RECEIVED: 'payment_received',
  DAILY_REPORT: 'daily_report',
  BUSINESS_UPDATE: 'business_update'
};

export const PRIORITY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  URGENT: 'urgent'
};

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

class UniversalNotificationManager {
  constructor() {
    this.isInitialized = false;
    this.hasPermission = false;
    this.token = null;
    this.userType = 'user'; // 'user' or 'business'
    this.userId = null;
    this.businessId = null;
    this.messaging = null;
    this.settings = this.getDefaultSettings();
    this.notificationQueue = [];
    this.statistics = {
      sentCount: 0,
      queuedNotifications: 0,
      lastSent: null
    };
  }

  getDefaultSettings() {
    return {
      // Universal settings
      enabled: true,
      soundEnabled: true,
      vibrationEnabled: Platform.OS !== 'web',
      
      // Quiet hours
      quietHours: {
        enabled: false,
        start: '22:00',
        end: '07:00'
      },
      
      // User-specific settings
      wateringReminders: true,
      plantCare: true,
      diseaseAlerts: true,
      forumReplies: true,
      marketplaceUpdates: false,
      directMessages: true,
      appUpdates: true,
      
      // Business-specific settings
      newOrders: true,
      lowStock: true,
      customerMessages: true,
      paymentReceived: true,
      dailyReports: false,
      businessUpdates: true,
      
      // Advanced settings
      batchNotifications: false,
      maxNotificationsPerHour: 10,
      customTones: {},
      
      // Platform specific
      platform: Platform.OS,
      lastUpdated: new Date().toISOString()
    };
  }

  async initialize(userType = 'user', userId = null, businessId = null) {
    try {
      console.log(`🔔 Initializing Universal Notification Manager for ${userType}`);
      
      this.userType = userType;
      this.userId = userId;
      this.businessId = businessId;
      
      // Load settings
      await this.loadSettings();
      
      // Initialize platform-specific services
      if (Platform.OS === 'web') {
        await this.initializeWeb();
      } else {
        await this.initializeMobile();
      }
      
      // Setup message handlers
      this.setupMessageHandlers();
      
      // Process queued notifications
      await this.processNotificationQueue();
      
      this.isInitialized = true;
      console.log('✅ Universal Notification Manager initialized successfully');
      
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize Universal Notification Manager:', error);
      return false;
    }
  }

  async initializeWeb() {
    try {
      // Dynamic import for web Firebase
      const { initializeApp, getApps } = await import('firebase/app');
      const { getMessaging, getToken, onMessage } = await import('firebase/messaging');
      
      // Initialize Firebase app if not already done
      let app;
      if (getApps().length === 0) {
        app = initializeApp(firebaseConfig);
      } else {
        app = getApps()[0];
      }
      
      // Initialize messaging
      this.messaging = getMessaging(app);
      
      // Request permission
      await this.requestPermission();
      
      // Get token
      if (this.hasPermission) {
        this.token = await getToken(this.messaging, {
          vapidKey: "BKx8nYqV8L5L5r5r5r5r5r5r5r5r5r5r5r5r5r5r5r5r5r5r5r5r5"
        });
        
        if (this.token) {
          await this.updateTokenOnServer(this.token);
        }
      }
      
      return true;
    } catch (error) {
      console.error('❌ Web Firebase initialization failed:', error);
      throw error;
    }
  }

  async initializeMobile() {
    try {
      // Dynamic import for mobile Firebase
      const messaging = (await import('@react-native-firebase/messaging')).default;
      this.messaging = messaging;
      
      // Request permission
      const authStatus = await messaging().requestPermission();
      this.hasPermission = authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
                         authStatus === messaging.AuthorizationStatus.PROVISIONAL;
      
      if (!this.hasPermission) {
        throw new Error('Push notification permission not granted');
      }
      
      // Get token
      this.token = await messaging().getToken();
      
      if (this.token) {
        await this.updateTokenOnServer(this.token);
      }
      
      return true;
    } catch (error) {
      console.error('❌ Mobile Firebase initialization failed:', error);
      throw error;
    }
  }

  async requestPermission() {
    try {
      if (Platform.OS === 'web') {
        if (!('Notification' in window)) {
          throw new Error('This browser does not support notifications');
        }
        
        const permission = await Notification.requestPermission();
        this.hasPermission = permission === 'granted';
        
        if (permission === 'denied') {
          this.showPermissionGuidance();
        }
        
        return this.hasPermission;
      } else {
        // Mobile permission is handled during initialization
        return this.hasPermission;
      }
    } catch (error) {
      console.error('❌ Permission request failed:', error);
      return false;
    }
  }

  setupMessageHandlers() {
    if (!this.messaging) return;
    
    if (Platform.OS === 'web') {
      this.setupWebMessageHandlers();
    } else {
      this.setupMobileMessageHandlers();
    }
  }

  setupWebMessageHandlers() {
    if (!this.messaging) return;
    
    // Import onMessage dynamically
    import('firebase/messaging').then(({ onMessage }) => {
      onMessage(this.messaging, (payload) => {
        console.log('📱 Web foreground message received:', payload);
        this.handleForegroundMessage(payload);
      });
    });
  }

  setupMobileMessageHandlers() {
    if (!this.messaging) return;
    
    // Foreground messages
    this.messaging().onMessage(async (remoteMessage) => {
      console.log('📱 Mobile foreground message received:', remoteMessage);
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

  handleForegroundMessage(payload) {
    const { notification, data } = payload;
    
    // Check if notifications are enabled
    if (!this.settings.enabled) return;
    
    // Check quiet hours
    if (this.isQuietHours() && data?.priority !== PRIORITY.URGENT) {
      this.queueNotification(payload);
      return;
    }
    
    // Show notification based on platform
    if (Platform.OS === 'web') {
      this.showWebNotification(notification, data);
    } else {
      this.showMobileNotification(notification, data);
    }
    
    // Update statistics
    this.updateStatistics();
  }

  showWebNotification(notification, data) {
    if (Notification.permission === 'granted') {
      const webNotification = new Notification(notification.title || 'Greener App', {
        body: notification.body,
        icon: '/icon-192.png',
        badge: '/icon-72.png',
        tag: data?.type || 'general',
        data: data,
        requireInteraction: data?.priority === PRIORITY.URGENT,
        silent: !this.settings.soundEnabled
      });
      
      webNotification.onclick = () => {
        this.handleNotificationTap({ data });
        webNotification.close();
      };
    }
  }

  showMobileNotification(notification, data) {
    // For mobile, show in-app notification or use local notifications
    console.log('📱 Showing mobile notification:', notification);
    // You can implement in-app notification display here
  }

  handleNotificationTap(remoteMessage) {
    const { data } = remoteMessage;
    console.log('📱 Notification tapped:', data);
    
    // Emit navigation event or handle directly
    this.emitNavigationEvent(data);
  }

  emitNavigationEvent(data) {
    // Emit custom event that navigation can listen to
    if (Platform.OS === 'web') {
      window.dispatchEvent(new CustomEvent('notificationNavigation', {
        detail: { screen: data?.screen, params: data?.params }
      }));
    } else {
      // For mobile, you might use a different event system
      // or pass navigation reference to this manager
    }
  }

  async updateTokenOnServer(token) {
    try {
      const endpoint = this.userType === 'business' 
        ? 'business-notification-settings' 
        : 'register_device_token';
      
      const body = this.userType === 'business'
        ? {
            businessId: this.businessId,
            deviceToken: token,
            platform: Platform.OS,
            settings: this.settings
          }
        : {
            email: this.userId,
            token: token,
            platform: Platform.OS
          };
      
      const response = await fetch(`https://usersfunctions.azurewebsites.net/api/${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Email': this.userId,
          'X-User-Type': this.userType,
          ...(this.businessId && { 'X-Business-ID': this.businessId })
        },
        body: JSON.stringify(body)
      });
      
      if (response.ok) {
        console.log('✅ Token updated on server');
        await AsyncStorage.setItem(`fcm_token_${Platform.OS}`, token);
      }
    } catch (error) {
      console.error('❌ Failed to update token on server:', error);
    }
  }

  async sendTestNotification() {
    try {
      if (!this.token) {
        throw new Error('No notification token available');
      }
      
      const endpoint = this.userType === 'business' 
        ? 'test_notification' 
        : 'test_notification';
      
      const response = await fetch(`https://usersfunctions.azurewebsites.net/api/${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Email': this.userId,
          'X-User-Type': this.userType,
          ...(this.businessId && { 'X-Business-ID': this.businessId })
        },
        body: JSON.stringify({
          [this.userType === 'business' ? 'businessId' : 'email']: this.userType === 'business' ? this.businessId : this.userId,
          fcmToken: this.token,
          testMessage: `This is a test notification for ${this.userType} users!`,
          platform: Platform.OS
        })
      });
      
      if (response.ok) {
        console.log('✅ Test notification sent');
        return { success: true, message: 'Test notification sent successfully' };
      } else {
        throw new Error('Failed to send test notification');
      }
    } catch (error) {
      console.error('❌ Test notification failed:', error);
      return { success: false, message: error.message };
    }
  }

  async loadSettings() {
    try {
      const settingsKey = `notification_settings_${this.userType}${this.businessId ? `_${this.businessId}` : ''}`;
      const savedSettings = await AsyncStorage.getItem(settingsKey);
      
      if (savedSettings) {
        this.settings = { ...this.getDefaultSettings(), ...JSON.parse(savedSettings) };
      }
      
      console.log('✅ Notification settings loaded');
    } catch (error) {
      console.error('❌ Failed to load settings:', error);
      this.settings = this.getDefaultSettings();
    }
  }

  async updateSettings(newSettings) {
    try {
      this.settings = { ...this.settings, ...newSettings, lastUpdated: new Date().toISOString() };
      
      const settingsKey = `notification_settings_${this.userType}${this.businessId ? `_${this.businessId}` : ''}`;
      await AsyncStorage.setItem(settingsKey, JSON.stringify(this.settings));
      
      // Update server
      await this.syncSettingsWithServer();
      
      console.log('✅ Notification settings updated');
      return true;
    } catch (error) {
      console.error('❌ Failed to update settings:', error);
      return false;
    }
  }

  async syncSettingsWithServer() {
    try {
      const endpoint = this.userType === 'business' 
        ? 'business-notification-settings' 
        : 'notification_settings';
      
      await fetch(`https://usersfunctions.azurewebsites.net/api/${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Email': this.userId,
          'X-User-Type': this.userType,
          ...(this.businessId && { 'X-Business-ID': this.businessId })
        },
        body: JSON.stringify({
          [this.userType === 'business' ? 'businessId' : 'email']: this.userType === 'business' ? this.businessId : this.userId,
          settings: this.settings
        })
      });
      
      console.log('✅ Settings synced with server');
    } catch (error) {
      console.error('❌ Failed to sync settings with server:', error);
    }
  }

  isQuietHours() {
    if (!this.settings.quietHours.enabled) return false;
    
    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();
    
    const [startHour, startMin] = this.settings.quietHours.start.split(':').map(Number);
    const [endHour, endMin] = this.settings.quietHours.end.split(':').map(Number);
    
    const startTime = startHour * 60 + startMin;
    const endTime = endHour * 60 + endMin;
    
    if (startTime <= endTime) {
      return currentTime >= startTime && currentTime <= endTime;
    } else {
      // Crosses midnight
      return currentTime >= startTime || currentTime <= endTime;
    }
  }

  queueNotification(payload) {
    this.notificationQueue.push({
      ...payload,
      queuedAt: new Date().toISOString()
    });
    
    this.statistics.queuedNotifications = this.notificationQueue.length;
    console.log(`📝 Notification queued (${this.notificationQueue.length} in queue)`);
  }

  async processNotificationQueue() {
    if (this.notificationQueue.length === 0) return;
    
    // Only process if not in quiet hours
    if (this.isQuietHours()) return;
    
    console.log(`📬 Processing ${this.notificationQueue.length} queued notifications`);
    
    while (this.notificationQueue.length > 0) {
      const notification = this.notificationQueue.shift();
      this.handleForegroundMessage(notification);
      
      // Small delay between notifications
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    this.statistics.queuedNotifications = 0;
  }

  updateStatistics() {
    this.statistics.sentCount++;
    this.statistics.lastSent = new Date().toISOString();
  }

  getSettings() {
    return { ...this.settings };
  }

  getStatistics() {
    return { ...this.statistics };
  }

  getStatus() {
    return {
      isInitialized: this.isInitialized,
      hasPermission: this.hasPermission,
      token: this.token ? 'Available' : 'Not Available',
      userType: this.userType,
      platform: Platform.OS,
      queuedNotifications: this.notificationQueue.length
    };
  }

  showPermissionGuidance() {
    // Emit event for UI to show guidance
    if (Platform.OS === 'web') {
      window.dispatchEvent(new CustomEvent('notificationPermissionBlocked', {
        detail: {
          message: 'Notifications are blocked. Please enable them in your browser settings.',
          instructions: [
            '1. Click the lock icon in the address bar',
            '2. Change notifications to "Allow"',
            '3. Refresh the page'
          ]
        }
      }));
    }
  }

  async cleanup() {
    console.log('🧹 Cleaning up Universal Notification Manager');
    
    // Clear any intervals or listeners
    this.notificationQueue = [];
    this.isInitialized = false;
    this.hasPermission = false;
    this.token = null;
  }
}

// Export singleton instance
const universalNotificationManager = new UniversalNotificationManager();
export default universalNotificationManager;