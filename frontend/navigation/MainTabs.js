import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';

// Import marketplace components from the correct directory
import MarketplaceScreen from '../marketplace/screens/MarketplaceScreen'; // Correct path
import MessagesScreen from '../marketplace/screens/MessagesScreen'; // Correct path
import ProfileScreen from '../marketplace/screens/ProfileScreen'; // Correct path

import MarketplaceNavigator from '../marketplace/MarketplaceNavigation'; // Correct path

const Tab = createBottomTabNavigator();

export default function MainTabs() {
  return (
    <Tab.Navigator
      initialRouteName="MarketHome"
      screenOptions={{
        headerShown: false,  // Ensure no header overlap
        tabBarActiveTintColor: '#4CAF50',
        tabBarInactiveTintColor: '#888',
        tabBarLabelStyle: {
          fontSize: 12,
          paddingBottom: 4,
        },
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopColor: '#eee',
          height: 60,
        },
      }}
    >
      <Tab.Screen
        name="MarketHome"
        component={MarketplaceScreen} // Using the marketplace screen directly
        options={{
          tabBarLabel: 'Marketplace',
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons name="leaf" size={24} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Messages"
        component={MessagesScreen}
        options={{
          tabBarLabel: 'Messages',
          tabBarIcon: ({ color }) => (
            <FontAwesome5 name="comment-alt" size={22} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarLabel: 'Profile',
          tabBarIcon: ({ color }) => (
            <FontAwesome5 name="user" size={22} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}
