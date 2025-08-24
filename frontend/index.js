// index.js (project root)
import { registerRootComponent } from 'expo';
import { Platform } from 'react-native';
import App from './App';

// BG/quit handler must be registered at module scope (not inside a component).
if (Platform.OS === 'android') {
  // Use require so this file still works on web
  const messaging = require('@react-native-firebase/messaging').default;

  // Called when an FCM arrives while the app is in the background or killed.
  messaging().setBackgroundMessageHandler(async (remoteMessage) => {
    // Don't try to show an Expo local notification here — this runs headless.
    // Prefer sending FCM with a `notification` payload so Android shows it for you.
    console.log('[BG] FCM message data:', remoteMessage?.data);
  });

  // If user taps a notification that opened the app from background:
  messaging().onNotificationOpenedApp((remoteMessage) => {
    console.log('[NOTIF OPENED from background]', remoteMessage?.data);
    // TODO: stash deep link / route in a store if you want to navigate after mount
  });

  // If the app was opened from a notification while it was completely quit:
  messaging()
    .getInitialNotification()
    .then((remoteMessage) => {
      if (remoteMessage) {
        console.log('[NOTIF OPENED from quit]', remoteMessage?.data);
        // TODO: keep this somewhere to handle after App mounts
      }
    });
}

registerRootComponent(App);
