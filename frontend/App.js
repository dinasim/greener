import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import AppNavigator from './navigation/AppNavigator';
import PushWebSetup from './components/PushWebSetup';


export default function App() {
  return (
    <NavigationContainer>
      <AppNavigator />
      <PushWebSetup />
    </NavigationContainer>
  );
}