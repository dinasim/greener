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

        // FIXED: Use proper token registration endpoint instead of saveUser
        // This prevents creating duplicate/incorrect user tables
        if (email && token) {
          try {
            await fetch('https://usersfunctions.azurewebsites.net/api/register_device_token', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                email,
                token,
                platform: Platform.OS
              }),
            });
            console.log("✅ FCM token registered for existing user:", email);
          } catch (tokenError) {
            console.warn("⚠️ Failed to register FCM token:", tokenError.message);
            // Don't fail - user can still use app without push notifications
          }
        }
      }
    } catch (err) {
      console.warn("⚠️ FCM registration failed:", err.message);
      // Don't fail - user can still use app without push notifications
    }
  }

  // No UI needed, but you can display token if you want:
  return null;
}
