import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialCommunityIcons } from '@expo/vector-icons';

// Import marketplace navigator
import MarketplaceNavigator from '../marketplace/MarketplaceNavigation';

const Tab = createBottomTabNavigator();

export default function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: { display: 'none' } // Hide the tab bar completely
      }}
    >
      {/* Use MarketplaceNavigator as the only tab without showing its tab bar */}
      <Tab.Screen
        name="Marketplace"
        component={MarketplaceNavigator}
        options={{
          tabBarButton: () => null // This hides the tab button completely
        }}
      />
    </Tab.Navigator>
  );
}