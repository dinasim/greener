import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { FormProvider } from '../context/FormContext';

// Importing screens
import LoginScreen from '../screens/LoginScreen';
import HomeScreen from '../screens/HomeScreen';
import SignInGoogleScreen from '../screens/SignInGoogleScreen';
import PlantLocationScreen from '../screens/SignupPlantsLocation';
import SignupIntersted from "../screens/SignupIntersted";
import SignupAnimals from "../screens/SignupAnimals";
import SignupLocationReq from "../screens/SignupLocationReq";
import SignupReminders from "../screens/SignupReminders";
import CameraScreen from '../screens/CameraScreen';
import AddPlantScreen from '../screens/AddPlantScreen';
import PlacePlantScreen from '../screens/PlacePlantScreen';
import LocationsScreen from '../screens/LocationsScreen';
import LocationPlantsScreen from '../screens/LocationPlantsScreen';
import PlantDetail from '../screens/PlantDetailScreen';
import DiseaseChecker from '../screens/DiseaseCheckerScreen';
import PlantReviewScreen from '../screens/PlantReviewScreen';
import searchPlants from '../screens/SearchPlantScreen';
import UserPlantDetails from '../screens/UserPlantDetails';

// Import marketplace navigation
import MainTabs from './MainTabs';

// Import Business screens
import PersonaSelectionScreen from '../Business/BusinessScreens/PersonaSelectionScreen';
import BusinessWelcomeScreen from '../Business/BusinessScreens/BusinessWelcomeScreen';
import BusinessSignUpScreen from '../Business/BusinessScreens/BusinessSignUpScreen';
import BusinessSignInScreen from '../Business/BusinessScreens/BusinessSignInScreen';
import BusinessInventoryScreen from '../Business/BusinessScreens/BusinessInventoryScreen';
import AddInventoryScreen from '../Business/BusinessScreens/AddInventoryScreen';
import BusinessHomeScreen from '../Business/BusinessScreens/BusinessHomeScreen';
import BusinessProfileScreen from '../Business/BusinessScreens/BusinessProfileScreen';
import BusinessOrdersScreen from '../Business/BusinessScreens/BusinessOrdersScreen';

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  return (
    <FormProvider>
      <Stack.Navigator initialRouteName="PersonaSelection" screenOptions={{ headerShown: false }}>
        {/* Persona Selection */}
        <Stack.Screen name="PersonaSelection" component={PersonaSelectionScreen} />
        
        {/* Business Flow */}
        <Stack.Screen name="BusinessWelcomeScreen" component={BusinessWelcomeScreen} />
        <Stack.Screen name="BusinessSignUpScreen" component={BusinessSignUpScreen} />
        <Stack.Screen name="BusinessSignInScreen" component={BusinessSignInScreen} />
        <Stack.Screen name="BusinessInventoryScreen" component={BusinessInventoryScreen} />
        <Stack.Screen name="AddInventoryScreen" component={AddInventoryScreen} />
        <Stack.Screen name="BusinessHomeScreen" component={BusinessHomeScreen} />
        <Stack.Screen name="BusinessProfileScreen" component={BusinessProfileScreen} />
        <Stack.Screen name="OrdersScreen" component={BusinessOrdersScreen} />
        
        {/* Consumer Login and Signup screens */}
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="SignupPlantsLocation" component={PlantLocationScreen} />
        <Stack.Screen name="SignupIntersted" component={SignupIntersted} />
        <Stack.Screen name="SignupAnimals" component={SignupAnimals} />
        <Stack.Screen name="SignupLocationReq" component={SignupLocationReq} />
        <Stack.Screen name="SignupReminders" component={SignupReminders} />
        <Stack.Screen name="SignInGoogleScreen" component={SignInGoogleScreen} />
        <Stack.Screen name="SignIn" component={SignInGoogleScreen} />
        
        <Stack.Screen name="PlantReview" component={PlantReviewScreen} />

        {/* Home and Other Screens */}
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="UserPlantDetail" component={UserPlantDetails} />

        {/* Navigate to the marketplace (MainTabs) after home */}
        <Stack.Screen name="MainTabs" component={MainTabs} />

        {/* Other screens */}
        <Stack.Screen name="Camera" component={CameraScreen} />
        <Stack.Screen name="AddPlant" component={AddPlantScreen} />
        <Stack.Screen name="SearchPlants" component={searchPlants} />
        <Stack.Screen name="PlacePlantScreen" component={PlacePlantScreen} />
        <Stack.Screen name="Locations" component={LocationsScreen} />
        <Stack.Screen name="LocationPlants" component={LocationPlantsScreen} />
        <Stack.Screen name="PlantDetail" component={PlantDetail} />
        <Stack.Screen name="PlantLocationScreen" component={PlantLocationScreen} />
        <Stack.Screen name="DiseaseChecker" component={DiseaseChecker} />
      </Stack.Navigator>
    </FormProvider>
  );
}