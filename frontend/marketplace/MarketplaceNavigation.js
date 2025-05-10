import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';

// Import all your screens
import MarketplaceScreen from './screens/MarketplaceScreen';
import PlantDetailScreen from './screens/PlantDetailScreen';
import AddPlantScreen from './screens/AddPlantScreen';
import ProfileScreen from './screens/ProfileScreen';
import EditProfileScreen from './screens/EditProfileScreen';
import MessagesScreen from './screens/MessagesScreen';
import SellerProfileScreen from './screens/SellerProfileScreen';

// Create navigators
const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Create a tab navigator for the main marketplace tabs
function MarketplaceTabs() {
  return (
    <Tab.Navigator
      initialRouteName="MarketplaceHome"
      screenOptions={{
        headerShown: false,
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
        name="MarketplaceHome"
        component={MarketplaceScreen}
        options={{
          tabBarLabel: 'Market',
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

// Main stack navigator that includes tabs and other screens
const MarketplaceNavigation = () => {
  return (
    <Stack.Navigator
      initialRouteName="MarketplaceTabs"
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#fff' },
        animation: 'slide_from_right',
      }}
    >
      {/* Tabs as the root */}
      <Stack.Screen 
        name="MarketplaceTabs" 
        component={MarketplaceTabs}
      />
      
      {/* Other stack screens */}
      <Stack.Screen 
        name="PlantDetail" 
        component={PlantDetailScreen}
      />
      
      <Stack.Screen 
        name="AddPlant" 
        component={AddPlantScreen}
      />
      
      <Stack.Screen 
        name="EditProfile" 
        component={EditProfileScreen}
      />
      
      <Stack.Screen 
        name="SellerProfile" 
        component={SellerProfileScreen}
      />
    </Stack.Navigator>
  );
};

export default MarketplaceNavigation;