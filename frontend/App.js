// App.js
import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import AppNavigator from './navigation/AppNavigator';
import PushWebSetup from './components/PushWebSetup';
import AuthProvider from './src/providers/AuthProvider';
import * as Notifications from 'expo-notifications';

// Make sure foreground notifications actually render a banner
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

// Android channel
if (Platform.OS === 'android') {
  Notifications.setNotificationChannelAsync('default', {
    name: 'default',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

// Foreground banner (modular messaging + dynamic import)
function useForegroundPushUI() {
  useEffect(() => {
    if (Platform.OS !== 'android') return;

    let unsub;

    (async () => {
      // On Android 13+, ask the POST_NOTIFICATIONS permission once
      try {
        await Notifications.requestPermissionsAsync();
      } catch {}

      const m = await import('@react-native-firebase/messaging');
      const { getMessaging, onMessage } = m;

      const msg = getMessaging();
      unsub = onMessage(msg, async (remoteMessage) => {
        // Prefer server-side "notification" payloads; fallback to data
        const n = remoteMessage?.notification || {};
        const data = remoteMessage?.data || {};

        await Notifications.scheduleNotificationAsync({
          content: {
            title: n.title || data.title || 'Greener',
            body: n.body || data.body || '',
            data,
          },
          trigger: null, // show immediately in foreground
        });
      });
    })();

    return () => {
      if (typeof unsub === 'function') unsub();
    };
  }, []);
}

export default function App() {
  useForegroundPushUI();

  return (
    <AuthProvider>
      <NavigationContainer>
        <AppNavigator />
        {Platform.OS === 'web' ? <PushWebSetup /> : null}
        {/* FCM registration is triggered in each profile's Home screen */}
      </NavigationContainer>
    </AuthProvider>
  );
}
