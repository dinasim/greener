// Business/BusinessNavigation.js - UPDATED VERSION
import React, { useCallback } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
// Business/BusinessNavigation.js
import MessagesScreen from '../marketplace/screens/MessagesScreen'; 
// or '../marketplace/screens/MessagesScreen' / '../MessagesScreen'

// Import ALL EXISTING Business Screens
import BusinessWelcomeScreen from './BusinessScreens/BusinessWelcomeScreen';
import BusinessSignUpScreen from './BusinessScreens/BusinessSignUpScreen';
import BusinessSignInScreen from './BusinessScreens/BusinessSignInScreen';
import BusinessInventoryChoiceScreen from './BusinessScreens/BusinessInventoryChoiceScreen';
import BusinessInventoryScreen from './BusinessScreens/BusinessInventoryScreen';
import BusinessHomeScreen from './BusinessScreens/BusinessHomeScreen';
import BusinessProfileScreen from './BusinessScreens/BusinessProfileScreen';
import BusinessOrdersScreen from './BusinessScreens/BusinessOrdersScreen';
import BusinessSettingsScreen from './BusinessScreens/BusinessSettingsScreen';
import AddInventoryScreen from './BusinessScreens/AddInventoryScreen';
import CreateOrderScreen from './BusinessScreens/CreateOrderScreen';
import BusinessProductDetailScreen from './BusinessScreens/BusinessProductDetailScreen';
import GPSWateringNavigator from './BusinessScreens/GPSWateringNavigator';
import NotificationCenterScreen from './BusinessScreens/NotificationCenterScreen';
import NotificationSettingsScreen from './BusinessScreens/NotificationSettingsScreen';
import CustomerListScreen from './BusinessScreens/CustomerListScreen';
import PlantCareForumScreen from '../screens/PlantCareForumScreen';

// Import existing screens
import BusinessWeatherScreen from './BusinessScreens/BusinessWeatherScreen';
import BusinessCustomersScreen from './BusinessScreens/BusinessCustomersScreen';

// Import the missing screens that exist but weren't imported
import BusinessNotificationsScreen from './BusinessScreens/BusinessNotificationsScreen';
import BusinessInsightsScreen from './BusinessScreens/BusinessInsightsScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Business Tabs Navigator
const BusinessTabs = () => {
  const navigation = useNavigation();

  // Hide the parent (user) tab bar while in business area
  useFocusEffect(
    useCallback(() => {
      const parent = navigation.getParent?.();
      parent?.setOptions({ tabBarStyle: { display: 'none' } });
      return () => parent?.setOptions({ tabBarStyle: undefined });
    }, [navigation])
  );

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ color, size }) => {
          let iconName;
          let IconComponent = MaterialIcons;

          if (route.name === 'BusinessDashboard') {
            iconName = 'dashboard';
          } else if (route.name === 'BusinessInventory') {
            iconName = 'inventory';
          } else if (route.name === 'BusinessOrders') {
            iconName = 'receipt-long';
          } else if (route.name === 'BusinessProfile') {
            iconName = 'person';
          }
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
      <Stack.Screen name="BusinessWelcomeScreen" component={BusinessWelcomeScreen} />
      <Stack.Screen name="BusinessSignUpScreen" component={BusinessSignUpScreen} />
      <Stack.Screen name="BusinessSignInScreen" component={BusinessSignInScreen} />

      {/* Post-signup choice screen */}
      <Stack.Screen
        name="BusinessInventoryChoiceScreen"
        component={BusinessInventoryChoiceScreen}
        options={{ title: 'Setup Your Business' }}
      />

      {/* Setup Flow */}
      <Stack.Screen name="BusinessInventoryScreen" component={BusinessInventoryScreen} />
      <Stack.Screen
        name="BusinessInventorySetupScreen"
        component={BusinessInventoryScreen}
        options={{ title: 'Setup Inventory' }}
      />

      {/* Main App Flow */}
      <Stack.Screen name="BusinessHomeScreen" component={BusinessHomeScreen} />
      <Stack.Screen name="BusinessTabs" component={BusinessTabs} />

      {/* Orders / Profile */}
      <Stack.Screen
        name="BusinessOrdersScreen"
        component={BusinessOrdersScreen}
        options={{ title: 'Orders' }}
      />
      <Stack.Screen
        name="Messages"
        component={MessagesScreen}
        options={{ headerShown: false }}
      />

      <Stack.Screen
        name="BusinessProfileScreen"
        component={BusinessProfileScreen}
        options={{ title: 'Business Profile' }}
      />

      {/* Customers */}
      <Stack.Screen
        name="CustomerListScreen"
        component={CustomerListScreen}
        options={{ title: 'Customers' }}
      />
      <Stack.Screen
        name="BusinessCustomersScreen"
        component={BusinessCustomersScreen}
        options={{ title: 'Customers' }}
      />

      <Stack.Screen
        name="GPSWateringNavigator"
        component={GPSWateringNavigator}
        options={{ title: 'GPS Navigation' }}
      />

      {/* Notifications */}
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
        name="BusinessNotificationsScreen"
        component={BusinessNotificationsScreen}
        options={{ title: 'Business Notifications' }}
      />

      {/* Forum */}
      <Stack.Screen
        name="PlantCareForumScreen"
        component={PlantCareForumScreen}
        options={{ title: 'Plant Care Forum' }}
      />
      <Stack.Screen
        name="ForumTopicDetail"
        component={require('../screens/ForumTopicDetail').default}
        options={{ title: 'Forum Topic' }}
      />

      {/* Products / Settings / Insights / Weather */}
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
        name="BusinessWeatherScreen"
        component={BusinessWeatherScreen}
        options={{ title: 'Weather' }}
      />
      <Stack.Screen
        name="BusinessInsightsScreen"
        component={BusinessInsightsScreen}
        options={{ title: 'Business Insights' }}
      />
    </Stack.Navigator>
  );
};

export default BusinessNavigation;
