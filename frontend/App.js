import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import AppNavigator from './navigation/AppNavigator';
import PushWebSetup from './components/PushWebSetup';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ensureChatFCM } from './notifications/chatFCMSetup';

// Toggle if you need to quickly disable FCM without removing code
const ENABLE_FCM_INIT = true;

export default function App() {
  useEffect(() => {
    const initializeApp = async () => {
      try {
        if (ENABLE_FCM_INIT) {
          const email = await AsyncStorage.getItem('userEmail');
            if (email) {
              try {
                const token = await ensureChatFCM(email);
                console.log('[FCM] init token', token ? token.slice(0, 16) + '...' : 'none');
              } catch (fcmErr) {
                console.warn('[FCM] init failed (continuing):', fcmErr?.message);
              }
            } else {
              console.log('[FCM] skipped (no stored userEmail)');
            }
        } else {
          console.log('[FCM] disabled via flag');
        }
        console.log('✅ App initialized successfully');
      } catch (error) {
        console.error('❌ App initialization error:', error);
      }
    };
    initializeApp();
  }, []);

  return (
    <NavigationContainer>
      <AppNavigator />
      <PushWebSetup />
    </NavigationContainer>
  );
}