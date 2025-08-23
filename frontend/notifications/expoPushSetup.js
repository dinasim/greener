import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Constants
const TOKEN_KEY = 'expo_push_token_v1';
// Replace <FUNCTION_KEY> if your Function auth level is 'function'; remove query if 'anonymous'
const TOKEN_SYNC_ENDPOINT = 'https://usersfunctions.azurewebsites.net/api/registerDeviceToken'; // authLevel=anonymous, no function key needed
// From app.json -> extra.eas.projectId
const EAS_PROJECT_ID = '6915a87a-3492-4315-b77e-ca7cfbf609fc';

let listenersRegistered = false;
let notificationListener = null;
let responseListener = null;
let lastFailureAt = 0;
let firebaseInitFailed = false;

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
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      console.log('Notification permissions not granted');
      return false;
    }
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('chat-messages', {
        name: 'Chat Messages',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#00ff00',
        sound: 'default'
      });
    }
    return true;
  } catch (e) {
    console.log('setupNotifications error', e);
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
    const token = await Notifications.getExpoPushTokenAsync({ projectId: EAS_PROJECT_ID });
    return token.data;
  } catch (e) {
    const msg = String(e.message || e);
    console.log('getExpoPushToken error', msg);
    if (msg.includes('Default FirebaseApp is not initialized')) {
      firebaseInitFailed = true;
      console.log('[push] Android build missing google-services.json. Rebuild with android.googleServicesFile or use Expo Go.');
    }
    return null;
  }
}

// Sync token to backend
async function registerTokenWithBackend(userId, token) {
  console.log('[push] registering token', {
    userId,
    tokenPreview: token?.slice(0, 18) + '...',
    endpoint: TOKEN_SYNC_ENDPOINT
  });
  try {
    const res = await fetch(TOKEN_SYNC_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        token,
        provider: 'expo',
        platform: Platform.OS,
        timestamp: new Date().toISOString()
      })
    });
    const text = await res.text();
    if (!res.ok) {
      console.log('[push] backend rejected token', res.status, text);
      return false;
    }
    console.log('[push] backend accepted token', text || '(empty body)');
    return true;
  } catch (e) {
    console.log('registerTokenWithBackend error', e);
    return false;
  }
}

// Listeners
function setupNotificationListeners(navigationHandler) {
  if (listenersRegistered) return;
  notificationListener = Notifications.addNotificationReceivedListener(notification => {
    const data = notification.request.content.data || {};
    if (shouldSuppressChatNotification(data)) {
      console.log('Notification suppressed');
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

// Main initializer
export async function initializeChatPush(userId, navigationHandler) {
  if (!userId) {
    console.log('[push] Skipping init (no userId yet)');
    return null;
  }
  if (Date.now() - lastFailureAt < 30000) {
    console.log('[push] Recent failure, backing off token retry');
  }
  const ok = await setupNotifications();
  if (!ok) return null;

  const token = await getExpoPushToken();
  if (!token) return null;

  const stored = await AsyncStorage.getItem(TOKEN_KEY);
  if (stored !== token) {
    const registered = await registerTokenWithBackend(userId, token);
    if (registered) {
      await AsyncStorage.setItem(TOKEN_KEY, token);
      console.log('Stored new Expo push token');
    } else {
      console.log('Will retry token registration later');
    }
  } else {
    console.log('Expo push token unchanged');
  }

  setupNotificationListeners(navigationHandler);
  return token;
}

// Helpers
export async function clearPushToken() {
  try {
    await AsyncStorage.removeItem(TOKEN_KEY);
    removeNotificationListeners();
  } catch {}
}

export async function getCurrentPushToken() {
  try {
    return await AsyncStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function sendTestNotification() {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Test Notification',
        body: 'This is a local test notification',
        data: { test: true },
        channelId: 'chat-messages'
      },
      trigger: null
    });
  } catch (e) {
    console.log('sendTestNotification error', e);
  }
}

// No-op background handler (Expo push local notifications do not need this)
export function registerBackgroundHandler() {
  // Intentionally empty – kept for compatibility with legacy code.
}

// Backwards compatibility for typo (some code may call registerbackgroundhander)
export const registerbackgroundhander = registerBackgroundHandler;
