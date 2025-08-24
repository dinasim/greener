import React, { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ensureChatFCM } from '../../notifications/chatFCMSetup';
import { useAuth } from './AuthProvider';

export default function FCMInitializer() {
  const { user, profile, loading } = useAuth();
  const lastEmailRef = useRef(null);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    if (loading) return;

    (async () => {
      const email =
        user?.email ||
        profile?.email ||
        (await AsyncStorage.getItem('userEmail'));

      if (!email) return;
      if (lastEmailRef.current === email) return;
      lastEmailRef.current = email;

      try {
        await ensureChatFCM(email);
        // optional: console.log('[FCM] initialized for', email);
      } catch (e) {
        console.warn('[FCM] init failed (continuing):', e?.message);
      }
    })();
  }, [loading, user?.uid, user?.email, profile?.email]);

  return null; // IMPORTANT: never render text
}
