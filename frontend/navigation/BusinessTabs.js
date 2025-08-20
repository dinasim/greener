import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';

import BusinessHomeScreen from '../Business/BusinessScreens/BusinessHomeScreen';
import BusinessInventoryScreen from '../Business/BusinessScreens/BusinessInventoryScreen';
import BusinessProfileScreen from '../Business/BusinessScreens/BusinessProfileScreen';
import BusinessMarketplaceNavigation from '../Business/BusinessMarketplaceNavigation';

// ✅ bring in the orders screen and messages screen
import BusinessOrdersScreen from '../Business/BusinessScreens/BusinessOrdersScreen';
import MessagesScreen from '../marketplace/screens/MessagesScreen';

const Tab = createBottomTabNavigator();
const OrdersStack = createNativeStackNavigator();

// ✅ A local stack just for the Orders tab
function OrdersStackNavigator() {
  return (
    <OrdersStack.Navigator screenOptions={{ headerShown: false }}>
      <OrdersStack.Screen name="OrdersHome" component={BusinessOrdersScreen} />
      <OrdersStack.Screen name="Messages" component={MessagesScreen} />
    </OrdersStack.Navigator>
  );
}

export default function BusinessTabs() {
  return (
    <Tab.Navigator
      initialRouteName="BusinessDashboard"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#216a94',
        tabBarInactiveTintColor: '#757575',
        tabBarStyle: { height: 60, paddingBottom: 8, paddingTop: 8 },
        tabBarLabelStyle: { fontSize: 12, fontWeight: '500' },
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

      {/* ✅ Use the Orders stack here */}
      <Tab.Screen
        name="BusinessOrders"
        component={OrdersStackNavigator}
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
