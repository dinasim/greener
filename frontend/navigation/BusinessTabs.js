// frontend/navigation/BusinessTabs.js
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';

// Import business screens
import BusinessHomeScreen from '../Business/BusinessScreens/BusinessHomeScreen';
import BusinessInventoryScreen from '../Business/BusinessScreens/BusinessInventoryScreen';
import BusinessOrdersScreen from '../Business/BusinessScreens/BusinessOrdersScreen';
import BusinessProfileScreen from '../Business/BusinessScreens/BusinessProfileScreen';

// Import marketplace navigation
import BusinessMarketplaceNavigation from '../Business/BusinessMarketplaceNavigation';

const Tab = createBottomTabNavigator();

export default function BusinessTabs() {
  return (
    <Tab.Navigator 
      initialRouteName="BusinessDashboard"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#216a94',
        tabBarInactiveTintColor: '#757575',
        tabBarStyle: {
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
        }
      }}
    >
      <Tab.Screen 
        name="BusinessDashboard" 
        component={BusinessHomeScreen} 
        options={{
          tabBarLabel: 'Dashboard',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="dashboard" size={size} color={color} />
          ),
        }}
      />
      
      <Tab.Screen 
        name="BusinessInventory" 
        component={BusinessInventoryScreen} 
        options={{
          tabBarLabel: 'Inventory',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="inventory" size={size} color={color} />
          ),
        }}
      />
      
      <Tab.Screen 
        name="BusinessOrders" 
        component={BusinessOrdersScreen} 
        options={{
          tabBarLabel: 'Orders',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="receipt" size={size} color={color} />
          ),
        }}
      />
      
      <Tab.Screen 
        name="BusinessMarketplace" 
        component={BusinessMarketplaceNavigation} 
        options={{
          tabBarLabel: 'Marketplace',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="storefront" size={size} color={color} />
          ),
        }}
      />
      
      <Tab.Screen 
        name="BusinessProfile" 
        component={BusinessProfileScreen} 
        options={{
          tabBarLabel: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="person" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}