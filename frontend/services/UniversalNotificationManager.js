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

// Correct VAPID key from your existing codebase
const VAPID_KEY = "BKF6MrQxSOYR9yI6nZR45zgrz248vA62XXw0232dE8e6CdPxSAoxGTG2e-JC8bN2YwbPZhSX4qBxcSd23sn_nwg";

class UniversalNotificationManager {
  constructor(userType = 'user', userId = null, businessId = null) {
    this.userType = userType;
    this.userId = userId;
    this.businessId = businessId;
    this.settings = {};
    this.isInitialized = false;
    this.fcmToken = null;
    this.token = null; // Add missing token property
    this.hasPermission = false; // Add missing hasPermission property
    this.retryCount = 0;
    this.maxRetries = 3;
    this.messaging = null; // Add missing messaging property
    this.notificationQueue = []; // Add missing notificationQueue property
    this.statistics = { // Add missing statistics property
      sentCount: 0,
      receivedCount: 0,
      queuedNotifications: 0,
      lastSent: null,
      lastReceived: null
    };
    
    // Use separate endpoints for different user types
    this.apiEndpoints = {
      consumer: 'https://usersfunctions.azurewebsites.net/api/consumer-notification-settings',
      business: 'https://usersfunctions.azurewebsites.net/api/business/notification-settings',
      user: 'https://usersfunctions.azurewebsites.net/api/consumer-notification-settings' // Default to consumer
    };
    
    // Use separate storage keys for different user types
    this.storageKey = `notification_settings_${userType}${businessId ? `_${businessId}` : ''}${userId ? `_${userId}` : ''}`;
    
    console.log(`🔔 UniversalNotificationManager initialized for ${userType}`, {
      userId,
      businessId,
      storageKey: this.storageKey,
      endpoint: this.apiEndpoints[userType]
    });
  }

  async initialize(userType = null, userId = null, businessId = null) {
    // Update instance properties if new values provided
    if (userType) this.userType = userType;
    if (userId) this.userId = userId;
    if (businessId) this.businessId = businessId;
    
    // Update storage key and API endpoints based on new userType
    this.storageKey = `notification_settings_${this.userType}${this.businessId ? `_${this.businessId}` : ''}${this.userId ? `_${this.userId}` : ''}`;
    
    try {
      console.log(`🔄 Initializing notifications for ${this.userType}...`);
      
      // Load settings from appropriate storage
      await this.loadSettings();
      
      // Initialize Firebase
      await this.initializeFirebase();
      
      // Request permissions if needed
      if (!this.hasPermission) {
        await this.requestPermission();
      }
      
      // Set token reference for getStatus method
      this.token = this.fcmToken;
      
      this.isInitialized = true;
      console.log(`✅ ${this.userType} notifications initialized`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to initialize ${this.userType} notifications:`, error);
      this.isInitialized = false;
      return false;
    }
  }

  async loadSettings() {
    try {
      // Load from local storage first
      const localSettings = await AsyncStorage.getItem(this.storageKey);
      if (localSettings) {
        this.settings = { ...this.getDefaultSettings(), ...JSON.parse(localSettings) };
      } else {
        this.settings = this.getDefaultSettings();
      }
      
      // Sync with server
      await this.syncSettingsWithServer();
      
      console.log(`📋 ${this.userType} settings loaded:`, this.settings);
    } catch (error) {
      console.error(`❌ Error loading ${this.userType} settings:`, error);
      this.settings = this.getDefaultSettings();
    }
  }

  async syncSettingsWithServer() {
    try {
      const endpoint = this.apiEndpoints[this.userType];
      const identifier = this.userType === 'business' ? this.businessId : this.userId;
      
      if (!endpoint || !identifier) {
        console.warn(`⚠️ Cannot sync ${this.userType} settings - missing endpoint or identifier`);
        return;
      }
      
      const headers = {
        'Content-Type': 'application/json',
        'X-User-Type': this.userType
      };
      
      if (this.userType === 'business') {
        headers['X-Business-ID'] = this.businessId;
        headers['X-User-Email'] = this.businessId; // Business uses email as ID
      } else {
        headers['X-User-Email'] = this.userId;
      }
      
      const queryParam = this.userType === 'business' ? 
        `businessId=${encodeURIComponent(identifier)}` : 
        `userEmail=${encodeURIComponent(identifier)}`;
      
      const response = await fetch(`${endpoint}?${queryParam}`, {
        method: 'GET',
        headers
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.settings && Object.keys(data.settings).length > 0) {
          this.settings = { ...this.settings, ...data.settings };
          await AsyncStorage.setItem(this.storageKey, JSON.stringify(this.settings));
          console.log(`✅ ${this.userType} settings synced from server`);
        }
      }
    } catch (error) {
      console.error(`❌ Error syncing ${this.userType} settings:`, error);
    }
  }

  getDefaultSettings() {
    const baseSettings = {
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
      
      // Platform specific
      platform: Platform.OS,
      lastUpdated: new Date().toISOString(),
      userType: this.userType
    };

    // User-specific settings (consumers)
    if (this.userType === 'user' || this.userType === 'consumer') {
      return {
        ...baseSettings,
        // Consumer-specific notification types
        wateringReminders: true,
        plantCare: true,
        diseaseAlerts: true,
        forumReplies: true,
        marketplaceUpdates: false,
        directMessages: true,
        appUpdates: false,
        notificationTime: '08:00', // 8 AM default for consumers
        
        // Advanced settings
        batchNotifications: false,
        maxNotificationsPerHour: 5,
        customTones: {}
      };
    }

    // Business-specific settings
    if (this.userType === 'business') {
      return {
        ...baseSettings,
        // Business-specific notification types
        newOrders: true,
        lowStock: true,
        customerMessages: true,
        wateringReminders: true, // Business watering reminders
        paymentReceived: true,
        dailyReports: false,
        businessUpdates: true,
        notificationTime: '07:00', // 7 AM default for business
        
        // Business advanced settings
        batchNotifications: true,
        maxNotificationsPerHour: 20,
        customTones: {},
        enableLowStockAlerts: true,
        enableSuccessNotifications: true,
        pollingInterval: 60
      };
    }

    return baseSettings;
  }

  async updateSettings(newSettings) {
    try {
      this.settings = { ...this.settings, ...newSettings, lastUpdated: new Date().toISOString() };
      
      // Save locally
      await AsyncStorage.setItem(this.storageKey, JSON.stringify(this.settings));
      
      // Update server
      await this.saveSettingsToServer();
      
      console.log(`✅ ${this.userType} notification settings updated`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to update ${this.userType} settings:`, error);
      return false;
    }
  }

  async saveSettingsToServer() {
    try {
      const endpoint = this.apiEndpoints[this.userType];
      const identifier = this.userType === 'business' ? this.businessId : this.userId;
      
      if (!endpoint || !identifier) {
        console.warn(`⚠️ Cannot save ${this.userType} settings - missing endpoint or identifier`);
        return false;
      }
      
      const headers = {
        'Content-Type': 'application/json',
        'X-User-Type': this.userType
      };
      
      const payload = {
        ...this.settings,
        fcmTokens: this.fcmToken ? [this.fcmToken] : [],
        deviceTokens: this.fcmToken ? [this.fcmToken] : []
      };
      
      if (this.userType === 'business') {
        headers['X-Business-ID'] = identifier;
        headers['X-User-Email'] = identifier;
        payload.businessId = identifier;
      } else {
        headers['X-User-Email'] = identifier;
        payload.userEmail = identifier;
      }
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });
      
      if (response.ok) {
        console.log(`✅ ${this.userType} settings saved to server`);
        return true;
      } else {
        console.error(`❌ Failed to save ${this.userType} settings: ${response.status}`);
        return false;
      }
    } catch (error) {
      console.error(`❌ Error saving ${this.userType} settings:`, error);
      return false;
    }
  }

  async initializeFirebase() {
    try {
      // Dynamic import for Firebase
      const firebase = await import('firebase/app');
      const { initializeApp, getApps } = firebase;
      
      // Initialize Firebase app if not already done
      let app;
      if (getApps().length === 0) {
        app = initializeApp(firebaseConfig);
      } else {
        app = getApps()[0];
      }
      
      // Initialize messaging
      this.messaging = (await import('firebase/messaging')).getMessaging(app);
      
      // Request permission
      await this.requestPermission();
      
      // Get token
      if (this.hasPermission) {
        this.fcmToken = await (await import('firebase/messaging')).getToken(this.messaging, {
          vapidKey: VAPID_KEY
        });
        
        if (this.fcmToken) {
          await this.updateTokenOnServer(this.fcmToken);
        }
      }
      
      // Setup message handlers
      this.setupMessageHandlers();
      
      return true;
    } catch (error) {
      console.error('❌ Firebase initialization failed:', error);
      throw error;
    }
  }

  requestPermission() {
    return new Promise(async (resolve, reject) => {
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
        } else {
          // Mobile permission is handled during initialization
          this.hasPermission = true;
        }
        
        resolve(this.hasPermission);
      } catch (error) {
        console.error('❌ Permission request failed:', error);
        reject(error);
      }
    });
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
        ? 'business/notification-settings' 
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
    try {
      // Remove local storage
      await AsyncStorage.removeItem(this.storageKey);
      await AsyncStorage.removeItem(`fcm_token_${Platform.OS}_${this.userType}`);
      
      // Cancel all scheduled notifications for this user type
      if (Platform.OS !== 'web') {
        const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
        
        for (const notification of scheduledNotifications) {
          const data = notification.content.data;
          if (data && data.userType === this.userType) {
            if (this.userType === 'business' && data.businessId === this.businessId) {
              await Notifications.cancelScheduledNotificationAsync(notification.identifier);
            } else if (this.userType !== 'business' && data.userEmail === this.userId) {
              await Notifications.cancelScheduledNotificationAsync(notification.identifier);
            }
          }
        }
      }
      
      this.isInitialized = false;
      this.fcmToken = null;
      this.settings = {};
      
      console.log(`🧹 ${this.userType} notifications cleaned up`);
    } catch (error) {
      console.error(`❌ Error cleaning up ${this.userType} notifications:`, error);
    }
  }
}

// Export singleton instance
const universalNotificationManager = new UniversalNotificationManager();
export default universalNotificationManager;