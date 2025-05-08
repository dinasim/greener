import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import Categories from '../marketplace/Pages/Categories';
import Messages from '../marketplace/Pages/Messages';
import Profile from '../marketplace/Pages/Profile';

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
        component={Categories}
        options={{
          tabBarLabel: 'Marketplace',
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons name="leaf" size={24} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Messages"
        component={Messages}
        options={{
          tabBarLabel: 'Messages',
          tabBarIcon: ({ color }) => (
            <FontAwesome5 name="comment-alt" size={24} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={Profile}
        options={{
          tabBarLabel: 'Profile',
          tabBarIcon: ({ color }) => (
            <FontAwesome5 name="user" size={24} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}
