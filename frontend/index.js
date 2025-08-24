// index.js
import { registerRootComponent } from 'expo';
import { Platform } from 'react-native';
import App from './App';

// --- ANDROID ONLY: FCM background / quit handlers must be declared at module scope ---
if (Platform.OS === 'android') {
  // Use require() so this file still loads on web/iOS without bundling the native module.
  const messaging = require('@react-native-firebase/messaging').default;

  // Runs when an FCM arrives while the app is in the BACKGROUND or QUIT state (headless JS).
  messaging().setBackgroundMessageHandler(async (remoteMessage) => {
    // Prefer sending a server "notification" payload so the OS shows it automatically.
    // If you later add Notifee, you can display a local notification here too.
    console.log('[BG] FCM message:', {
      messageId: remoteMessage?.messageId,
      data: remoteMessage?.data,
      notification: remoteMessage?.notification,
    });
  });

  // App opened from a notification while it was in the background.
  messaging().onNotificationOpenedApp((remoteMessage) => {
    console.log('[NOTIF OPENED from background]', remoteMessage?.data);
    // Optional: stash deep link route somewhere to navigate after App mounts.
    global.__lastOpenedNotification = remoteMessage?.data || null;
  });

  // App opened from a notification while it was completely quit.
  messaging()
    .getInitialNotification()
    .then((remoteMessage) => {
      if (remoteMessage) {
        console.log('[NOTIF OPENED from quit]', remoteMessage?.data);
        // Optional: stash for navigation after the root component mounts.
        global.__initialNotification = remoteMessage?.data || null;
      }
    })
    .catch(() => {
      // no-op
    });
}

// Register the root component (works for Expo Go and custom dev clients)
registerRootComponent(App);
