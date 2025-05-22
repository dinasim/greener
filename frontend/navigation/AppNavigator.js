import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { FormProvider } from '../context/FormContext';
import { Platform } from 'react-native';

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

// Import Business navigation
import BusinessNavigation from '../Business/BusinessNavigation';

// Import Persona Selection
import PersonaSelectionScreen from '../Business/BusinessScreens/PersonaSelectionScreen';

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  return (
    <FormProvider>
      <Stack.Navigator 
        initialRouteName="PersonaSelection" 
        screenOptions={{ 
          headerShown: false,
          animation: Platform.OS === 'web' ? 'none' : 'default',
          gestureEnabled: Platform.OS !== 'web'
        }}
      >
        {/* Persona Selection */}
        <Stack.Screen name="PersonaSelection" component={PersonaSelectionScreen} />
        
        {/* Business Flow - using the updated BusinessNavigation */}
        <Stack.Screen 
          name="BusinessFlow" 
          component={BusinessNavigation}
          options={{
            animation: 'none', // Disable animation for this transition to prevent rendering issues
          }} 
        />
        
        {/* Consumer/User Login and Signup screens */}
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="SignupPlantsLocation" component={PlantLocationScreen} />
        <Stack.Screen name="SignupIntersted" component={SignupIntersted} />
        <Stack.Screen name="SignupAnimals" component={SignupAnimals} />
        <Stack.Screen name="SignupLocationReq" component={SignupLocationReq} />
        <Stack.Screen name="SignupReminders" component={SignupReminders} />
        <Stack.Screen name="SignInGoogleScreen" component={SignInGoogleScreen} />
        <Stack.Screen name="SignIn" component={SignInGoogleScreen} />
        
        <Stack.Screen name="PlantReview" component={PlantReviewScreen} />

        {/* Consumer Home and Other Screens */}
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="UserPlantDetail" component={UserPlantDetails} />

        {/* Navigate to the marketplace (MainTabs) after home */}
        <Stack.Screen 
          name="MainTabs" 
          component={MainTabs}
          options={{
            animation: 'none', // Disable animation for tab transitions
          }}
        />

        {/* Other consumer screens */}
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