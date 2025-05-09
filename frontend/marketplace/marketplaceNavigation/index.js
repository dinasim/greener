import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MaterialIcons } from '@expo/vector-icons';
import { TouchableOpacity } from 'react-native';

// Import screens
import MarketplaceScreen from '../screens/MarketplaceScreen';
import PlantDetailScreen from '../screens/PlantDetailScreen';
import AddPlantScreen from '../screens/AddPlantScreen';
import ProfileScreen from '../screens/ProfileScreen';
import EditProfileScreen from '../screens/EditProfileScreen';
import MessagesScreen from '../screens/MessagesScreen';
import SellerProfileScreen from '../screens/SellerProfileScreen';

const Stack = createNativeStackNavigator();

/**
 * MarketplaceNavigation - Stack navigator for the marketplace feature
 * This manages navigation between marketplace-related screens
 */
const MarketplaceNavigation = () => {
  return (
    <Stack.Navigator
      initialRouteName="Marketplace"
      screenOptions={({ navigation }) => ({
        headerShown: false, // We're using our custom header
        contentStyle: { backgroundColor: '#fff' },
        animation: 'slide_from_right',
      })}
    >
      <Stack.Screen 
        name="Marketplace" 
        component={MarketplaceScreen}
      />
      
      <Stack.Screen 
        name="PlantDetail" 
        component={PlantDetailScreen}
      />
      
      <Stack.Screen 
        name="AddPlant" 
        component={AddPlantScreen}
      />
      
      <Stack.Screen 
        name="Profile" 
        component={ProfileScreen}
      />
      
      <Stack.Screen 
        name="EditProfile" 
        component={EditProfileScreen}
      />
      
      <Stack.Screen 
        name="Messages" 
        component={MessagesScreen}
      />
      
      <Stack.Screen 
        name="SellerProfile" 
        component={SellerProfileScreen}
      />
    </Stack.Navigator>
  );
};

export default MarketplaceNavigation;