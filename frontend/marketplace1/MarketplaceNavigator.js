import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

// Import all screens from the screens directory
import MarketplaceScreen from '../marketplace/screens/MarketplaceScreen';
import PlantDetailScreen from '../marketplace/screens/PlantDetailScreen';
import AddPlantScreen from '../marketplace/screens/AddPlantScreen';
import SellerProfileScreen from '../marketplace/screens/SellerProfileScreen';
import FavoritesScreen from '../marketplace/screens/FavoritesScreen';
import MessagesScreen from '../marketplace/screens/MessagesScreen';
import ProfileScreen from '../marketplace/screens/ProfileScreen';

const Stack = createNativeStackNavigator();

const MarketplaceNavigator = () => {
  return (
    <Stack.Navigator
      initialRouteName="Marketplace"
      screenOptions={{
        headerStyle: {
          backgroundColor: '#228B22', // Forest green header
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      }}
    >
      <Stack.Screen 
        name="Marketplace" 
        component={MarketplaceScreen}
        options={{ title: 'Plant Marketplace' }}
      />
      <Stack.Screen 
        name="PlantDetail" 
        component={PlantDetailScreen}
        options={{ title: 'Plant Details' }}
      />
      <Stack.Screen 
        name="AddPlant" 
        component={AddPlantScreen}
        options={{ title: 'Add New Plant' }}
      />
      <Stack.Screen 
        name="SellerProfile" 
        component={SellerProfileScreen}
        options={{ title: 'Seller Profile' }}
      />
      <Stack.Screen 
        name="Favorites" 
        component={FavoritesScreen}
        options={{ title: 'My Favorites' }}
      />
      <Stack.Screen 
        name="Messages" 
        component={MessagesScreen}
        options={{ title: 'Messages' }}
      />
      <Stack.Screen 
        name="Profile" 
        component={ProfileScreen}
        options={{ title: 'My Profile' }}
      />
    </Stack.Navigator>
  );
};

export default MarketplaceNavigator;