import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Constants
const TOKEN_KEY = 'expo_push_token_v1';
// Using direct URLs to Azure Function endpoints (no placeholders)
const TOKEN_SYNC_ENDPOINT_PRIMARY = 'https://usersfunctions.azurewebsites.net/api/register_device_token';
const TOKEN_SYNC_ENDPOINT_FALLBACK = 'https://usersfunctions.azurewebsites.net/api/update_device_token';
// From app.json -> extra.eas.projectId
const EAS_PROJECT_ID = '6915a87a-3492-4315-b77e-ca7cfbf609fc';

let listenersRegistered = false;
let notificationListener = null;
let responseListener = null;
let lastFailureAt = 0;
let firebaseInitFailed = false;
let pushRegistrationEnabled = false;
let registrationAttempts = 0;
let lastTokenReturned = null;
let pendingInit = null; // { userId, navigationHandler }
let recentMessageIds = new Set();
const MAX_RECENT_IDS = 50;
let hasRegisteredOnce = false; // new flag
let watchdogTimer = null;

// Auto-initialize push on startup if user is already logged in
(async function checkForLoggedInUser() {
  try {
    // Check if user is logged in by checking for user email/ID in AsyncStorage
    const userEmail = await AsyncStorage.getItem('userEmail');
    const userId = await AsyncStorage.getItem('currentUserId');
    
    if (userEmail || userId) {
      const user = userEmail || userId;
      console.log('[push] Found logged in user at startup:', user);
      
      // Enable push registration
      await enablePushRegistration();
      
      // Initialize push with the user ID
      await initializeChatPush(user, (notificationData) => {
        // This is a placeholder for handling tapped notifications
        console.log('[push] Notification tapped:', notificationData);
      });
    }
  } catch (e) {
    console.log('[push] Auto-init error:', e?.message);
  }
})();

// Enable gating after successful auth
export async function enablePushRegistration() {
  if (pushRegistrationEnabled) {
    console.log('[push] registration already enabled');
    return;
  } else {
    pushRegistrationEnabled = true;
    console.log('[push] registration enabled (post-login)');
  }
  startPushWatchdog();
  
  // Automatically flush any pending initialization
  try {
    await flushPendingPushInit();
  } catch (e) {
    console.log('[push] error during auto-flush after enabling:', e?.message);
  }
}

// Simple wrapper for easy integration
export async function enablePushAfterLogin() {
  console.log('[push] enablePushAfterLogin called');
  if (Platform.OS === 'android') {
    await setupAndroidNotificationChannels();
  }
  return await enablePushRegistration();
}

// New: explicit flush
export async function flushPendingPushInit() {
  if (!pushRegistrationEnabled) {
    console.log('[push] flushPendingPushInit called while gated');
    return;
  }
  if (!pendingInit) {
    console.log('[push] no pending init to flush');
    return;
  }
  const { userId, navigationHandler } = pendingInit;
  console.log('[push] flushing queued initializeChatPush for', userId);
  const saved = pendingInit;
  pendingInit = null;
  try {
    await initializeChatPush(userId, navigationHandler);
  } catch (e) {
    console.log('[push] flushed init error', e?.message);
    // restore once for retry
    if (!pendingInit) pendingInit = saved;
  }
  console.log('[push] flushPendingPushInit start state', { pending: !!pendingInit, enabled: pushRegistrationEnabled });
}

export function debugPushState() {
  return {
    pushRegistrationEnabled,
    registrationAttempts,
    lastFailureAt,
    firebaseInitFailed,
    lastTokenReturned
  };
}

// Suppressor hook
export let shouldSuppressChatNotification = (_data) => false;
export function setChatNotificationSuppressor(fn) {
  if (typeof fn === 'function') shouldSuppressChatNotification = fn;
}

// Foreground display behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false
  })
});

// Permissions + Android channel
async function setupNotifications() {
  try {
    console.log('[push] Setting up notifications - checking permissions');
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    console.log('[push] Current permission status:', existingStatus);
    
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      console.log('[push] Requesting notification permissions...');
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
      console.log('[push] Permission request result:', status);
    }
    
    if (finalStatus !== 'granted') {
      console.log('[push] Notification permissions denied');
      return false;
    }
    
    console.log('[push] Notification permissions granted');
    
    // Set up channels for Android
    if (Platform.OS === 'android') {
      console.log('[push] Setting up Android notification channels');
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
        sound: 'default'
      });
      
      await Notifications.setNotificationChannelAsync('chat-messages', {
        name: 'Chat Messages',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#00ff00',
        sound: 'default'
      });
      
      console.log('[push] Android notification channels created');
    }
    
    return true;
  } catch (e) {
    console.error('[push] setupNotifications error:', e);
    return false;
  }
}

// Get (or refresh) Expo push token
async function getExpoPushToken() {
  if (firebaseInitFailed) {
    console.log('[push] Skipping token fetch (previous Firebase init failure)');
    return null;
  }
  try {
    console.log('[push] Requesting Expo push token with projectId:', EAS_PROJECT_ID);
    const token = await Notifications.getExpoPushTokenAsync({ 
      projectId: EAS_PROJECT_ID 
    });
    console.log('[push] Successfully retrieved token:', token.data.substring(0, 10) + '...');
    return token.data;
  } catch (e) {
    const msg = String(e.message || e);
    console.error('[push] getExpoPushToken error:', msg);
    
    if (msg.includes('Default FirebaseApp is not initialized')) {
      firebaseInitFailed = true;
      console.error('[push] Android build missing google-services.json or incorrect path. Check that:');
      console.error('[push] 1. google-services.json exists in frontend/ directory');
      console.error('[push] 2. app.json correctly references the file path');
      console.error('[push] 3. The app was rebuilt after adding the file');
    }
    
    return null;
  }
}

// Main initializer
export async function initializeChatPush(userId, navigationHandler) {
  userId = (userId || '').trim();
  
  if (!pushRegistrationEnabled) {
    if (!userId) {
      console.log('[push] init without userId (still gated) – skipping');
      return null;
    }
    console.log('[push] registration gated; queueing init for user', userId);
    pendingInit = { userId, navigationHandler };
    return null;
  }

  registrationAttempts++;
  console.log('[push] initializeChatPush attempt', registrationAttempts, 'userId=', userId);

  if (!userId) {
    console.log('[push] abort init (empty userId after trim)');
    return null;
  }

  console.log('[push] Setting up notifications...');
  const ok = await setupNotifications();
  if (!ok) {
    console.log('[push] Failed to set up notifications - check permissions');
    return null;
  }

  console.log('[push] Getting Expo push token...');
  const token = await getExpoPushToken();
  if (!token) {
    lastFailureAt = Date.now();
    console.error('[push] No token obtained - check Firebase setup');
    return null;
  }

  lastTokenReturned = token;
  try {
    console.log('[push] Checking for existing token...');
    const stored = await AsyncStorage.getItem(TOKEN_KEY);
    console.log('[push] Stored token:', stored ? (stored.substring(0, 10) + '...') : 'none');
    
    if (stored !== token) {
      console.log('[push] Token changed or new - registering with backend');
      const registered = await registerTokenWithBackend(userId, token);
      if (registered) {
        console.log('[push] Token registration complete');
      } else {
        lastFailureAt = Date.now();
        console.error('[push] Token registration failed (will retry later)');
      }
    } else {
      console.log('[push] Expo push token unchanged');
    }
    
    // Always store the token locally as well for robustness
    await AsyncStorage.setItem(TOKEN_KEY, token);
    console.log('[push] Token stored in AsyncStorage');
  } catch (e) {
    lastFailureAt = Date.now();
    console.error('[push] Error persisting token:', e?.message || e);
  }

  console.log('[push] Setting up notification listeners');
  setupNotificationListeners(navigationHandler);
  hasRegisteredOnce = true;
  console.log('[push] initializeChatPush completed userId=', userId, 'tokenPreview=', token.slice(0,18)+'...');
  return token;
}

// Sync token to backend with improved resilience
async function registerTokenWithBackend(userId, token) {
  console.log('[push] registering token', {
    userId,
    tokenPreview: token?.slice(0, 18) + '...',
    primary: TOKEN_SYNC_ENDPOINT_PRIMARY
  });
  
  // Always store locally first - this ensures push works even if backend fails
  try {
    await AsyncStorage.setItem(TOKEN_KEY, token);
    console.log('[push] token stored locally');
  } catch (localError) {
    console.log('[push] failed to store token locally:', localError?.message);
  }
  
  const correlationId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
  const payload = {
    userId,
    email: userId,           // some existing endpoints expect 'email'
    token,
    provider: 'expo',
    platform: Platform.OS,
    timestamp: new Date().toISOString()
  };

  // For Android, use the standard fetch API since timedPost might not be defined
  try {
    const response = await fetch(TOKEN_SYNC_ENDPOINT_PRIMARY, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json', 
        'X-Request-ID': correlationId,
      },
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      // If primary fails, try fallback
      console.log('[push] Primary endpoint failed, trying fallback');
      const fallbackResponse = await fetch(TOKEN_SYNC_ENDPOINT_FALLBACK, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          'X-Request-ID': correlationId,
        },
        body: JSON.stringify(payload)
      });
      
      if (!fallbackResponse.ok) {
        console.log('[push] Both endpoints failed to register token');
        return false;
      }
    }
    
    console.log('[push] Token registered successfully with backend');
    return true;
  } catch (e) {
    console.log('[push] registerTokenWithBackend error', e?.message || e);
    return false;
  }
}

// Listeners
function setupNotificationListeners(navigationHandler) {
  if (listenersRegistered) return;
  notificationListener = Notifications.addNotificationReceivedListener(notification => {
    const data = notification.request.content.data || {};
    if (data.messageId) {
      if (recentMessageIds.has(data.messageId)) {
        console.log('[push] duplicate messageId suppressed', data.messageId);
        return;
      }
      recentMessageIds.add(data.messageId);
      if (recentMessageIds.size > MAX_RECENT_IDS) {
        recentMessageIds = new Set(Array.from(recentMessageIds).slice(-MAX_RECENT_IDS));
      }
    }
    if (shouldSuppressChatNotification(data)) {
      console.log('Notification suppressed by custom suppressor');
    }
  });
  responseListener = Notifications.addNotificationResponseReceivedListener(response => {
    const data = response.notification.request.content.data || {};
    if (navigationHandler) navigationHandler(data);
  });
  listenersRegistered = true;
}

function removeNotificationListeners() {
  if (notificationListener) {
    Notifications.removeNotificationSubscription(notificationListener);
    notificationListener = null;
  }
  if (responseListener) {
    Notifications.removeNotificationSubscription(responseListener);
    responseListener = null;
  }
  listenersRegistered = false;
}

// Watchdog: if queued but not flushed after enable
function startPushWatchdog() {
  if (watchdogTimer) clearTimeout(watchdogTimer);
  watchdogTimer = setTimeout(() => {
    if (pendingInit && pushRegistrationEnabled) {
      console.log('[push] watchdog firing – pending init still present, forcing initialize');
      const { userId, navigationHandler } = pendingInit;
      pendingInit = null;
      initializeChatPush(userId, navigationHandler).catch(e =>
        console.log('[push] watchdog forced init failed', e?.message)
      );
    }
  }, 2000);
}

// Helper function for diagnoses
export async function checkPushNotificationStatus() {
  const status = {
    hasPermissions: false,
    token: null,
    storedToken: null,
    androidChannels: [],
    firebaseInitFailed: firebaseInitFailed,
    pushEnabled: pushRegistrationEnabled,
    hasRegistered: hasRegisteredOnce
  };
  
  try {
    const { status: permStatus } = await Notifications.getPermissionsAsync();
    status.hasPermissions = permStatus === 'granted';
    
    if (status.hasPermissions) {
      try {
        const token = await Notifications.getExpoPushTokenAsync({ projectId: EAS_PROJECT_ID });
        status.token = token.data;
      } catch (e) {
        console.log('[push] Error getting token:', e?.message);
      }
    }
    
    status.storedToken = await AsyncStorage.getItem(TOKEN_KEY);
    
    if (Platform.OS === 'android') {
      status.androidChannels = await Notifications.getNotificationChannelsAsync();
    }
    
    console.log('[push] Status check:', JSON.stringify(status, null, 2));
    return status;
  } catch (e) {
    console.error('[push] Status check error:', e);
    return { error: e?.message, ...status };
  }
}

// For testing
export async function forcePushNotificationSetup(userId) {
  pushRegistrationEnabled = true;
  const status = await setupNotifications();
  if (!status) {
    console.log('[push] Force setup failed - permissions denied');
    return false;
  }
  
  const token = await getExpoPushToken();
  if (token) {
    await AsyncStorage.setItem(TOKEN_KEY, token);
    if (userId) {
      await registerTokenWithBackend(userId, token);
    }
    console.log('[push] Force setup completed, token obtained');
    return true;
  } else {
    console.log('[push] Force setup failed - no token obtained');
    return false;
  }
}

// No-op background handler (Expo push local notifications do not need this)
export function registerBackgroundHandler() {
  // Intentionally empty – kept for compatibility with legacy code.
}

// Backwards compatibility for typo (some code may call registerbackgroundhander)
export const registerbackgroundhander = registerBackgroundHandler;

export function getPushInitState() {
  return { pushRegistrationEnabled, hasRegisteredOnce, pendingInit: !!pendingInit };
}

/**
 * Set up Android notification channels
 * Required for Android 8.0+ (API level 26+)
 */
export async function setupAndroidNotificationChannels() {
  if (Platform.OS !== 'android') return;
  
  try {
    console.log('[push] Setting up Android notification channels');
    
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
    
    await Notifications.setNotificationChannelAsync('chat', {
      name: 'Chat Messages',
      description: 'Chat and message notifications',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 100, 200, 300],
      lightColor: '#4CAF50',
    });
    
    console.log('[push] Android notification channels configured');
    return true;
  } catch (error) {
    console.error('[push] Error setting up notification channels:', error);
    return false;
  }
}

/**
 * Set up notification handler and default settings
 */
export function setupNotificationHandling() {
  // Configure how notifications appear when the app is in the foreground
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });

  // For Android, set notification categories/channels
  if (Platform.OS === 'android') {
    setupAndroidNotificationChannels();
  }
}

/**
 * Get the current push token for testing with external tools
 * @returns {Promise<Object>} The token and relevant information
 */
export async function getTokenForTesting() {
  try {
    // Get stored token first
    const storedToken = await AsyncStorage.getItem(TOKEN_KEY);
    
    // If we have a stored token, return it
    if (storedToken) {
      console.log('[push] Found stored token for testing:', storedToken.substring(0, 10) + '...');
      return {
        success: true,
        token: storedToken,
        source: 'storage'
      };
    }
    
    // Otherwise try to get a fresh token
    console.log('[push] No stored token, requesting new one...');
    const ok = await setupNotifications();
    if (!ok) {
      return { 
        success: false, 
        error: 'Permission denied',
        message: 'Notification permissions not granted'
      };
    }
    
    const token = await getExpoPushToken();
    if (!token) {
      return { 
        success: false, 
        error: 'Token generation failed',
        message: firebaseInitFailed ? 
          'Firebase initialization failed - check google-services.json' : 
          'Could not obtain Expo push token'
      };
    }
    
    // Store the token for future use
    await AsyncStorage.setItem(TOKEN_KEY, token);
    
    return {
      success: true,
      token: token,
      source: 'fresh',
      note: 'Token has been stored for future use'
    };
  } catch (error) {
    console.error('[push] Error getting token for testing:', error);
    return {
      success: false,
      error: error.message,
      message: 'Error getting push token for testing'
    };
  }
}
