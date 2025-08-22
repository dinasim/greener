// notifications/chatFCMSetup.js - Direct FCM setup for Android chat
import { Platform } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';

const TOKEN_KEY = 'fcm_primary_token_v1';
// Use dedicated endpoint that appends device token without overwriting user
const TOKEN_SYNC_ENDPOINT = 'https://usersfunctions.azurewebsites.net/api/update_device_token';

export async function ensureChatFCM(userEmail) {
  if (!userEmail) return null;
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') return null;

  // Request permissions for notifications (expo-notifications)
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') {
      await Notifications.requestPermissionsAsync();
    }
  } catch {}

  // Create / ensure Android channel
  if (Platform.OS === 'android') {
    try {
      await Notifications.setNotificationChannelAsync('chat-messages', {
        name: 'Chat Messages',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#00ff00'
      });
    } catch (e) {
      console.log('Channel setup failed:', e.message);
    }
  }

  // Get token
  const token = await messaging().getToken();
  if (!token) return null;

  const existing = await AsyncStorage.getItem(TOKEN_KEY);
  if (existing !== token) {
    await AsyncStorage.setItem(TOKEN_KEY, token);
  // Push to backend (lightweight update, idempotent)
    try {
      await fetch(TOKEN_SYNC_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: userEmail, token, platform: Platform.OS })
      });
    } catch (e) {
      // swallow
    }
  }

  // Foreground listener
  messaging().onMessage(async remoteMessage => {
    if (!remoteMessage) return;
    const { notification, data } = remoteMessage;
    const title = notification?.title || data?.title || 'New message';
    const body = notification?.body || data?.body || 'You have a new chat message';
    try {
      await Notifications.scheduleNotificationAsync({
        content: { title, body, data },
        trigger: null, // immediate
      });
    } catch (e) {
      console.log('Foreground local notification failed:', e.message);
    }
  });

  // Background handler (must be in root index, but keep here for reference)
  return token;
}

// Background handler (to be re-exported in index.js if needed)
export function registerBackgroundHandler() {
  messaging().setBackgroundMessageHandler(async remoteMessage => {
    // Could log or persist badge counts here
  });
}
