import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import { FormProvider } from './frontend/context/FormContext';
import { registerBackgroundHandler, setupNotificationHandling } from './frontend/notifications/expoPushSetup';
import * as Notifications from 'expo-notifications';

// Configure notification behavior for when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,  // show alert when app is in foreground
    shouldPlaySound: true,  // play sound
    shouldSetBadge: false   // don't set badge number
  }),
});

// Ensure background handler is registered ASAP (outside component)
registerBackgroundHandler();

// Main App component
export default function App() {
  // Set up notification handling on app startup
  useEffect(() => {
    setupNotificationHandling();
    
    // Set up notification response handler (what happens when user taps a notification)
    const responseListener = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data;
      console.log("Notification tapped:", data);
      
      // Handle navigation based on notification data
      // This will be called when user taps on notification
      // You can add navigation logic here if needed
    });

    // Clean up listener
    return () => {
      Notifications.removeNotificationSubscription(responseListener);
    };
  }, []);
  
  // ...existing code for state, effects, etc...
  
  return (
    <FormProvider>
      {/* ...existing app component tree... */}
    </FormProvider>
  );
}

// ...existing code for any helper functions, styles, etc...