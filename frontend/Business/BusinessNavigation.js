// Business/BusinessNavigation.js - CORRECTED VERSION WITH ALL EXISTING SCREENS
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';

// Import ALL EXISTING Business Screens
import BusinessWelcomeScreen from './BusinessScreens/BusinessWelcomeScreen';
import BusinessSignUpScreen from './BusinessScreens/BusinessSignUpScreen';
import BusinessSignInScreen from './BusinessScreens/BusinessSignInScreen';
import BusinessInventoryScreen from './BusinessScreens/BusinessInventoryScreen';
import BusinessHomeScreen from './BusinessScreens/BusinessHomeScreen';
import BusinessProfileScreen from './BusinessScreens/BusinessProfileScreen';
import BusinessOrdersScreen from './BusinessScreens/BusinessOrdersScreen';
import BusinessAnalyticsScreen from './BusinessScreens/BusinessAnalyticsScreen';
import BusinessSettingsScreen from './BusinessScreens/BusinessSettingsScreen';
import AddInventoryScreen from './BusinessScreens/AddInventoryScreen';
import CreateOrderScreen from './BusinessScreens/CreateOrderScreen';
import BusinessProductDetailScreen from './BusinessScreens/BusinessProductDetailScreen';
import WateringChecklistScreen from './BusinessScreens/WateringChecklistScreen';
import GPSWateringNavigator from './BusinessScreens/GPSWateringNavigator';
import NotificationCenterScreen from './BusinessScreens/NotificationCenterScreen';
import NotificationSettingsScreen from './BusinessScreens/NotificationSettingsScreen';
import PlantCareForumScreen from '../screens/PlantCareForumScreen';
import CustomerListScreen from './BusinessScreens/CustomerListScreen';
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
      />
      <Stack.Screen 
        name="BusinessSignUpScreen" 
        component={BusinessSignUpScreen}
      />
      <Stack.Screen 
        name="BusinessSignInScreen" 
        component={BusinessSignInScreen}
      />
      
      {/* Setup Flow */}
      <Stack.Screen 
        name="BusinessInventoryScreen" 
        component={BusinessInventoryScreen}
      />
      
      {/* Main App Flow */}
      <Stack.Screen 
        name="BusinessHomeScreen" 
        component={BusinessHomeScreen}
      />
      <Stack.Screen 
        name="BusinessTabs" 
        component={BusinessTabs}
      />
      
      {/* Individual Screens */}
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
      
      {/* Watering & Plant Care Screens - ALL EXISTING */}
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
      
      {/* Notification Screens - EXISTING AND NEW */}
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
        name="BusinessProductDetailScreen" 
        component={BusinessProductDetailScreen}
        options={{ title: 'Product Details' }}
      />
      <Stack.Screen 
        name="AddInventoryScreen" 
        component={AddInventoryScreen}
        options={{ title: 'Add Product' }}
      />
      <Stack.Screen 
        name="CreateOrderScreen" 
        component={CreateOrderScreen}
        options={{ title: 'Create Order' }}
      />
      <Stack.Screen 
        name="BusinessSettingsScreen" 
        component={BusinessSettingsScreen}
        options={{ title: 'Settings' }}
      />
      <Stack.Screen 
        name="EditProductScreen" 
        component={AddInventoryScreen}
        options={{ title: 'Edit Product' }}
        initialParams={{ editMode: true }}
      />
      <Stack.Screen 
        name="ProductDetailScreen" 
        component={BusinessProductDetailScreen}
        options={{ title: 'Product Details' }}
        initialParams={{ detailMode: true }}
      />
      <Stack.Screen 
        name="PlantCareForumScreen" 
        component={PlantCareForumScreen}
        options={{ title: 'Plant Care Forum' }}
      />
    </Stack.Navigator>
  );
};

export default BusinessNavigation;