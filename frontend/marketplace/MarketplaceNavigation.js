import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MaterialIcons } from '@expo/vector-icons';
import { TouchableOpacity } from 'react-native';

// Import screens
import MarketplaceScreen from './screens/MarketplaceScreen';
import PlantDetailScreen from './screens/PlantDetailScreen';
import AddPlantScreen from './screens/AddPlantScreen';
import ProfileScreen from './screens/ProfileScreen';
import EditProfileScreen from './screens/EditProfileScreen';
import MessagesScreen from './screens/MessagesScreen';
import SellerProfileScreen from './screens/SellerProfileScreen';

const Stack = createNativeStackNavigator();

const MarketplaceNavigation = () => {
  return (
    <Stack.Navigator
      initialRouteName="Marketplace"
      screenOptions={({ navigation }) => ({
        headerStyle: {
          backgroundColor: '#4CAF50',
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
        headerLeft: ({ canGoBack }) =>
          canGoBack ? (
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <MaterialIcons name="arrow-back" size={24} color="#fff" style={{ marginRight: 10 }} />
            </TouchableOpacity>
          ) : null,
        headerRight: () => (
          <TouchableOpacity onPress={() => navigation.navigate('Profile')}>
            <MaterialIcons name="person" size={24} color="#fff" />
          </TouchableOpacity>
        ),
      })}
    >
      <Stack.Screen
        name="Marketplace"
        component={MarketplaceScreen}
        options={{
          title: 'Plant Marketplace',
        }}
      />

      <Stack.Screen
        name="PlantDetail"
        component={PlantDetailScreen}
        options={{
          title: 'Plant Details',
          headerShown: false, // Hide header for detail screen for full-screen image
        }}
      />

      <Stack.Screen
        name="AddPlant"
        component={AddPlantScreen}
        options={{
          title: 'Add New Plant',
        }}
      />

      <Stack.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          title: 'My Profile',
          headerRight: null, // Remove profile icon in profile screen
        }}
      />

      <Stack.Screen
        name="EditProfile"
        component={EditProfileScreen}
        options={{
          title: 'Edit Profile',
          headerRight: null, // Remove profile icon in edit profile screen
        }}
      />

      <Stack.Screen
        name="Messages"
        component={MessagesScreen}
        options={{
          title: 'Messages',
        }}
      />

      <Stack.Screen
        name="SellerProfile"
        component={SellerProfileScreen}
        options={({ route }) => ({
          title: route.params?.sellerName || 'Seller Profile',
        })}
      />
    </Stack.Navigator>
  );
};

export default MarketplaceNavigation;
