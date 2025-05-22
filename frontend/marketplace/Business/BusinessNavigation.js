// Business/BusinessNavigation.js
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import NotificationSettings from './components/NotificationSettings';
import BusinessAnalyticsScreen from './BusinessScreens/BusinessAnalyticsScreen';


// Import Business Screens
import BusinessWelcomeScreen from './BusinessScreens/BusinessWelcomeScreen';
import BusinessSignUpScreen from './BusinessScreens/BusinessSignUpScreen';
import BusinessSignInScreen from './BusinessScreens/BusinessSignInScreen';
import BusinessInventoryScreen from './BusinessScreens/BusinessInventoryScreen';
import BusinessHomeScreen from './BusinessScreens/BusinessHomeScreen';
import BusinessProfileScreen from './BusinessScreens/BusinessProfileScreen';
import BusinessOrdersScreen from './BusinessScreens/BusinessOrdersScreen';
import AddInventoryScreen from './BusinessScreens/AddInventoryScreen';

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
        initialParams={{ businessId: null }}
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
      
      {/* Setup Flow */}
      <Stack.Screen name="BusinessInventoryScreen" component={BusinessInventoryScreen} />
      <Stack.Screen name="AddInventoryScreen" component={AddInventoryScreen} />
      
      {/* Main App Flow - Tab Navigator */}
      <Stack.Screen name="BusinessHomeScreen" component={BusinessHomeScreen} />
      <Stack.Screen name="BusinessTabs" component={BusinessTabs} />
      
      {/* Individual Screens */}
      <Stack.Screen name="BusinessProfileScreen" component={BusinessProfileScreen} />
      <Stack.Screen name="BusinessOrdersScreen" component={BusinessOrdersScreen} />
      
      {/* Inventory Management Screens */}
      <Stack.Screen 
        name="InventoryScreen" 
        component={AddInventoryScreen}
        options={{ title: 'Manage Inventory' }}
      />
      <Stack.Screen 
        name="EditProductScreen" 
        component={AddInventoryScreen}
        options={{ title: 'Edit Product' }}
      />
      <Stack.Screen 
        name="NotificationSettings" 
        component={NotificationSettings} 
        options={{ title: 'Notification Settings' }}
      />
      <Stack.Screen 
        name="BusinessAnalyticsScreen" 
        component={BusinessAnalyticsScreen} 
        options={{ title: 'Analytics' }} 
      />

    </Stack.Navigator>
  );
};

export default BusinessNavigation;