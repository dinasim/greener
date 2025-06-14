// Business/BusinessNavigation.js - FIXED VERSION
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';

// Import Business Screens
import BusinessWelcomeScreen from './BusinessScreens/BusinessWelcomeScreen';
import BusinessSignUpScreen from './BusinessScreens/BusinessSignUpScreen';
import BusinessSignInScreen from './BusinessScreens/BusinessSignInScreen';
import BusinessInventoryScreen from './BusinessScreens/BusinessInventoryScreen';
import BusinessHomeScreen from './BusinessScreens/BusinessHomeScreen';
import BusinessProfileScreen from './BusinessScreens/BusinessProfileScreen';
import BusinessOrdersScreen from './BusinessScreens/BusinessOrdersScreen';
import AddInventoryScreen from './BusinessScreens/AddInventoryScreen';
import BusinessAnalyticsScreen from './BusinessScreens/BusinessAnalyticsScreen';
import CustomerListScreen from './BusinessScreens/CustomerListScreen';
import WateringChecklistScreen from './BusinessScreens/WateringChecklistScreen';
import GPSWateringNavigator from './BusinessScreens/GPSWateringNavigator';
import NotificationCenterScreen from './BusinessScreens/NotificationCenterScreen';
import NotificationSettingsScreen from './BusinessScreens/NotificationSettingsScreen';

// Import Components (if they have their own screens)
import NotificationSettings from './components/NotificationSettings';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Business Tabs Navigator
const BusinessTabs = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;
          let iconType = 'MaterialIcons';

          if (route.name === 'BusinessDashboard') {
            iconName = 'dashboard';
          } else if (route.name === 'BusinessInventory') {
            iconName = 'inventory';
          } else if (route.name === 'BusinessOrders') {
            iconName = 'receipt';
          } else if (route.name === 'BusinessProfile') {
            iconName = 'person';
          } else if (route.name === 'WateringChecklist') {
            iconName = 'water-drop';
            iconType = 'MaterialCommunityIcons';
          }

          const IconComponent = iconType === 'MaterialIcons' ? MaterialIcons : MaterialCommunityIcons;
          return <IconComponent name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#216a94',
        tabBarInactiveTintColor: '#757575',
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopWidth: 1,
          borderTopColor: '#eee',
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
      })}
    >
      <Tab.Screen 
        name="BusinessDashboard" 
        component={BusinessHomeScreen}
        options={{ title: 'Dashboard' }}
      />
      <Tab.Screen 
        name="BusinessInventory" 
        component={AddInventoryScreen}
        options={{ title: 'Inventory' }}
        initialParams={{ businessId: null, showInventory: true }}
      />
      <Tab.Screen 
        name="WateringChecklist" 
        component={WateringChecklistScreen}
        options={{ title: 'Watering' }}
      />
      <Tab.Screen 
        name="BusinessOrders" 
        component={BusinessOrdersScreen}
        options={{ title: 'Orders' }}
      />
      <Tab.Screen 
        name="BusinessProfile" 
        component={BusinessProfileScreen}
        options={{ title: 'Profile' }}
      />
    </Tab.Navigator>
  );
};

// Main Business Stack Navigator
const BusinessNavigation = () => {
  return (
    <Stack.Navigator
      initialRouteName="BusinessWelcomeScreen"
      screenOptions={{
        headerShown: false,
        gestureEnabled: true,
        animation: 'slide_from_right',
      }}
    >
      {/* Auth Flow */}
      <Stack.Screen 
        name="BusinessWelcomeScreen" 
        component={BusinessWelcomeScreen} 
        options={{ title: 'Welcome' }}
      />
      <Stack.Screen 
        name="BusinessSignUpScreen" 
        component={BusinessSignUpScreen}
        options={{ title: 'Sign Up' }}
      />
      <Stack.Screen 
        name="BusinessSignInScreen" 
        component={BusinessSignInScreen}
        options={{ title: 'Sign In' }}
      />
      
      {/* Setup Flow */}
      <Stack.Screen 
        name="BusinessInventoryScreen" 
        component={BusinessInventoryScreen}
        options={{ title: 'Setup Inventory' }}
      />
      
      {/* Main App Flow - Tab Navigator */}
      <Stack.Screen 
        name="BusinessHomeScreen" 
        component={BusinessHomeScreen}
        options={{ title: 'Dashboard' }}
      />
      <Stack.Screen 
        name="BusinessTabs" 
        component={BusinessTabs}
        options={{ title: 'Business App' }}
      />
      
      {/* Individual Screens */}
      <Stack.Screen 
        name="BusinessProfileScreen" 
        component={BusinessProfileScreen}
        options={{ title: 'Business Profile' }}
      />
      <Stack.Screen 
        name="BusinessOrdersScreen" 
        component={BusinessOrdersScreen}
        options={{ title: 'Orders' }}
      />
      <Stack.Screen 
        name="BusinessAnalyticsScreen" 
        component={BusinessAnalyticsScreen} 
        options={{ title: 'Analytics' }} 
      />
      <Stack.Screen 
        name="CustomerListScreen" 
        component={CustomerListScreen}
        options={{ title: 'Customers' }}
      />
      
      {/* Inventory Management Screens */}
      <Stack.Screen 
        name="AddInventoryScreen" 
        component={AddInventoryScreen}
        options={{ title: 'Manage Inventory' }}
      />
      <Stack.Screen 
        name="InventoryScreen" 
        component={AddInventoryScreen}
        options={{ title: 'Inventory' }}
      />
      <Stack.Screen 
        name="EditProductScreen" 
        component={AddInventoryScreen}
        options={{ title: 'Edit Product' }}
        initialParams={{ editMode: true }}
      />
      
      {/* Watering & Plant Care Screens */}
      <Stack.Screen 
        name="WateringChecklistScreen" 
        component={WateringChecklistScreen}
        options={{ title: 'Watering Checklist' }}
      />
      <Stack.Screen 
        name="GPSWateringNavigator" 
        component={GPSWateringNavigator}
        options={{ title: 'GPS Navigation' }}
      />
      
      {/* Notification Screens */}
      <Stack.Screen 
        name="NotificationCenterScreen" 
        component={NotificationCenterScreen}
        options={{ title: 'Notifications' }}
      />
      <Stack.Screen 
        name="NotificationSettingsScreen" 
        component={NotificationSettingsScreen}
        options={{ title: 'Notification Settings' }}
      />
      <Stack.Screen 
        name="NotificationSettings" 
        component={NotificationSettings} 
        options={{ title: 'Notification Settings' }}
      />
      
      {/* Additional Screens */}
      <Stack.Screen 
        name="BusinessSettingsScreen" 
        component={BusinessProfileScreen}
        options={{ title: 'Settings' }}
        initialParams={{ settingsMode: true }}
      />
      <Stack.Screen 
        name="CreateOrderScreen" 
        component={BusinessOrdersScreen}
        options={{ title: 'Create Order' }}
        initialParams={{ createMode: true }}
      />
      <Stack.Screen 
        name="BusinessProductDetailScreen" 
        component={AddInventoryScreen}
        options={{ title: 'Product Details' }}
        initialParams={{ detailMode: true }}
      />
    </Stack.Navigator>
  );
};

export default BusinessNavigation;