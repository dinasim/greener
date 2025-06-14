import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import AppNavigator from './navigation/AppNavigator';
import PushWebSetup from './components/PushWebSetup';

export default function App() {
  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Initialize app components
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