import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import messaging from '@react-native-firebase/messaging';

export default function PushMobileSetup({ email }) {
  const [fcmToken, setFcmToken] = useState(null);

  useEffect(() => {
    if (Platform.OS === "android" || Platform.OS === "ios") {
      registerAndSaveFCMToken();
    }
    // eslint-disable-next-line
  }, [email]);

  async function registerAndSaveFCMToken() {
    try {
      // Ask for permission (Android 13+ requires runtime permission)
      const authStatus = await messaging().requestPermission();
      const enabled =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;

      if (enabled) {
        const token = await messaging().getToken();
        setFcmToken(token);

        // Save FCM token to your backend
        await fetch('https://usersfunctions.azurewebsites.net/api/saveUser?', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email,
            expoPushToken: null,         // Deprecated
            fcmToken: token,             // NEW FIELD
            platform: Platform.OS
          }),
        });
        // Optionally: console.log("FCM token registered:", token);
      }
    } catch (err) {
      // Optionally: console.error("FCM registration failed:", err);
    }
  }

  // No UI needed, but you can display token if you want:
  return null;
}
