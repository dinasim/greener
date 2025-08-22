// MarketplaceNavigation.js - COMPLETE FIXED VERSION
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import MarketplaceScreen from './screens/MarketplaceScreen';
import PlantDetailScreen from './screens/PlantDetailScreen';
import AddPlantScreen from './screens/AddPlantScreen';
import ProfileScreen from './screens/ProfileScreen';
import EditProfileScreen from './screens/EditProfileScreen';
import MessagesScreen from './screens/MessagesScreen';
import SellerProfileScreen from './screens/SellerProfileScreen';
import MapScreen from './screens/MapScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function MarketplaceTabs() {
  return (
    <Tab.Navigator initialRouteName="MarketplaceHome" screenOptions={{ headerShown: false, tabBarActiveTintColor: '#4CAF50', tabBarInactiveTintColor: '#888', tabBarLabelStyle: { fontSize: 12, paddingBottom: 4 }, tabBarStyle: { backgroundColor: '#fff', borderTopColor: '#eee', height: 60 } }}>
      <Tab.Screen name="MarketplaceHome" component={MarketplaceScreen} options={{ tabBarLabel: 'Market', tabBarIcon: ({ color }) => (<MaterialCommunityIcons name="leaf" size={24} color={color} />) }} />
      <Tab.Screen name="Messages" component={MessagesScreen} options={{ tabBarLabel: 'Messages', tabBarIcon: ({ color }) => (<FontAwesome5 name="comment-alt" size={22} color={color} />) }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ tabBarLabel: 'Profile', tabBarIcon: ({ color }) => (<FontAwesome5 name="user" size={22} color={color} />) }} />
    </Tab.Navigator>
  );
}

const MarketplaceNavigation = () => {
  return (
    <Stack.Navigator initialRouteName="MarketplaceTabs" screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#fff' }, animation: 'slide_from_right' }}>
      <Stack.Screen name="MarketplaceTabs" component={MarketplaceTabs} />
      <Stack.Screen name="PlantDetail" component={PlantDetailScreen} />
      {/* FIXED: Add both PlantDetail and PlantDetails to prevent navigation errors */}
      <Stack.Screen name="PlantDetails" component={PlantDetailScreen} />
      <Stack.Screen name="AddPlant" component={AddPlantScreen} />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} />
      <Stack.Screen name="SellerProfile" component={SellerProfileScreen} />
      <Stack.Screen name="BusinessSellerProfile" component={SellerProfileScreen} />
      <Stack.Screen name="MapView" component={MapScreen} />
    </Stack.Navigator>
  );
};

export default MarketplaceNavigation;