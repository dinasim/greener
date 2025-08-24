// App.js
import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import AppNavigator from './navigation/AppNavigator';
import PushWebSetup from './components/PushWebSetup';
import AuthProvider from './src/providers/AuthProvider';
import * as Notifications from 'expo-notifications';

// Foreground policy: actually render a banner
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,     // you can set false if you prefer
    shouldSetBadge: false,
  }),
});

// Make sure we have permission + a high-importance Android channel
async function prepareNotifications() {
  await Notifications.requestPermissionsAsync();

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
      sound: 'default',
    });
  }
}

// Foreground banner for data-only FCM
function useForegroundPushUI() {
  useEffect(() => {
    let unsub;

    (async () => {
      await prepareNotifications();

      // Dynamic import so web still bundles fine
      const messaging = (await import('@react-native-firebase/messaging')).default;

      // Called when an FCM arrives while app is in FOREGROUND
      unsub = messaging().onMessage(async (remoteMessage) => {
        const n = remoteMessage?.notification; // present if your FCM had "notification" payload
        const data = remoteMessage?.data || {};
        if (!n) {
          await Notifications.presentNotificationAsync({
            title: data.title || 'Greener',
            body: data.body || '',
            data,
          });
        }
      });
    })();

    return () => unsub?.();
  }, []);
}

export default function App() {
  useForegroundPushUI();

  return (
    <AuthProvider>
      <NavigationContainer>
        <AppNavigator />
        {Platform.OS === 'web' ? <PushWebSetup /> : null}
        {/* FCM registration can remain where you currently do it */}
      </NavigationContainer>
    </AuthProvider>
  );
}
