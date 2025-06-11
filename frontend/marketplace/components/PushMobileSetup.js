import React, { useEffect, useState } from 'react';
import { View, Text, Button, Platform } from 'react-native';
import messaging from '@react-native-firebase/messaging';

export default function PushMobileSetup() {
  const [token, setToken] = useState(null);

  useEffect(() => {
    getFcmToken();
    // Foreground message handler
    const unsubscribe = messaging().onMessage(async remoteMessage => {
      alert(`Push notification received: ${remoteMessage.notification.title}\n${remoteMessage.notification.body}`);
    });
    return unsubscribe;
  }, []);

  async function getFcmToken() {
    const authStatus = await messaging().requestPermission();
    const enabled =
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL;

    if (enabled) {
      const fcmToken = await messaging().getToken();
      setToken(fcmToken);
      console.log('FCM Token:', fcmToken);
      // send token to backend if needed
    } else {
      alert('No notification permission granted!');
    }
  }

  return (
    <View style={{marginTop: 40, padding: 16}}>
      <Text style={{ fontWeight: 'bold' }}>FCM Token (Mobile):</Text>
      <Text selectable style={{ fontSize: 12 }}>{token || 'Not registered yet'}</Text>
      <Button title="Refresh FCM Token" onPress={getFcmToken} />
    </View>
  );
}
