import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import AppNavigator from './navigation/AppNavigator';
import PushWebSetup from './components/PushWebSetup';
import AuthProvider from './src/providers/AuthProvider';
import * as Notifications from 'expo-notifications';

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
      const { getMessaging, onMessage } = await import('@react-native-firebase/messaging');
      const messaging = getMessaging();
      unsub = onMessage(messaging, async (remoteMessage) => {
        const n = remoteMessage.notification;
        await Notifications.scheduleNotificationAsync({
          content: {
            title: n?.title || 'Greener',
            body: n?.body || '',
            data: remoteMessage.data || {},
          },
          trigger: null,
        });
      });
    })();
    return () => { if (typeof unsub === 'function') unsub(); };
  }, []);
}

export default function App() {
  useForegroundPushUI();

  return (
    <AuthProvider>
      <NavigationContainer>
        <AppNavigator />
        {Platform.OS === 'web' ? <PushWebSetup /> : null}
        {/* FCM registration is done in each profile's Home screen, not here */}
      </NavigationContainer>
    </AuthProvider>
  );
}
