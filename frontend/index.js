// Optional: uncomment if you use a custom dev client
// import 'expo-dev-client';

import { registerRootComponent } from 'expo';
import messaging from '@react-native-firebase/messaging';
import App from './App';

// Runs when a message arrives in BACKGROUND or when the app is QUIT.
// Useful for data-only messages or pre-processing.
messaging().setBackgroundMessageHandler(async (remoteMessage) => {
  // e.g., persist something, prefetch, analytics, etc.
   console.log('[BG] message', remoteMessage?.data);
});

registerRootComponent(App);
