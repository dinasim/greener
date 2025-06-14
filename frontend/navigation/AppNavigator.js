import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { FormProvider } from '../context/FormContext';
import { Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';

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
import login from '../screens/loginUserScreen';
import registration from '../screens/RegistrationScreen';
import PlantCareForumScreen from '../screens/PlantCareForumScreen';
import AddSiteScreen from '../screens/AddSiteScreen';
import ForumScreen from '../screens/ForumScreen';
import SearchScreen from '../screens/SearchScreen';
import AddOptionsScreen from '../screens/AddOptionsScreen';
import NotificationSettingsScreen from '../screens/NotificationSettingsScreen';
import UserSettingsScreen from '../screens/UserSettingsScreen';

// Import marketplace navigation
import MainTabs from './MainTabs';

// Import Business navigation
import BusinessNavigation from '../Business/BusinessNavigation';

// Import Persona Selection
import PersonaSelectionScreen from '../Business/BusinessScreens/PersonaSelectionScreen';

// Import the global background wrapper
import BackgroundWrapper from '../components/BackgroundWrapper';

const Stack = createNativeStackNavigator();

// Helper to wrap a screen with the background
function withBackground(Component) {
  return function(props) {
    return (
      <BackgroundWrapper>
        <Component {...props} />
      </BackgroundWrapper>
    );
  };
}

export default function AppNavigator() {
  return (
    <FormProvider>
      <NavigationContainer>
        <Stack.Navigator
          initialRouteName="PersonaSelection"
          screenOptions={{
            headerShown: false,
            gestureEnabled: true,
            animation: 'slide_from_right',
          }}
        >
          {/* Persona Selection */}
          <Stack.Screen name="PersonaSelection" component={withBackground(PersonaSelectionScreen)} />
          
          {/* Business Flow - using the updated BusinessNavigation */}
          <Stack.Screen 
            name="BusinessFlow" 
            component={BusinessNavigation}
            options={{
              animation: 'none', // No animation for this transition
            }} 
          />
          
          {/* Consumer/User Login and Signup screens */}
          <Stack.Screen name="Login" component={withBackground(LoginScreen)} />
          <Stack.Screen name="SignupPlantsLocation" component={withBackground(PlantLocationScreen)} />
          <Stack.Screen name="SignupIntersted" component={withBackground(SignupIntersted)} />
          <Stack.Screen name="SignupAnimals" component={withBackground(SignupAnimals)} />
          <Stack.Screen name="SignupLocationReq" component={withBackground(SignupLocationReq)} />
          <Stack.Screen name="SignupReminders" component={withBackground(SignupReminders)} />
          <Stack.Screen name="SignInGoogleScreen" component={withBackground(SignInGoogleScreen)} />
          <Stack.Screen name="SignIn" component={withBackground(SignInGoogleScreen)} />
          <Stack.Screen name="Registration" component={withBackground(registration)} />
          <Stack.Screen name="LoginUser" component={withBackground(login)} />
          <Stack.Screen name="PlantReview" component={withBackground(PlantReviewScreen)} />
          <Stack.Screen name="AddSite" component={withBackground(AddSiteScreen)} />

          {/* Consumer Home and Other Screens */}
          <Stack.Screen name="Home" component={withBackground(HomeScreen)} />
          <Stack.Screen name="UserPlantDetail" component={withBackground(UserPlantDetails)} />
          <Stack.Screen name="UserSettings" component={withBackground(UserSettingsScreen)} />
          <Stack.Screen name="NotificationSettings" component={withBackground(NotificationSettingsScreen)} />

          {/* Navigate to the marketplace (MainTabs) after home */}
          <Stack.Screen 
            name="MainTabs" 
            component={MainTabs}
            options={{
              animation: 'none', // Disable animation for tab transitions
            }}
          />

          {/* Other consumer screens */}
          <Stack.Screen name="Camera" component={withBackground(CameraScreen)} />
          <Stack.Screen name="AddPlant" component={withBackground(AddPlantScreen)} />
          <Stack.Screen name="SearchPlants" component={withBackground(searchPlants)} />
          <Stack.Screen name="PlacePlantScreen" component={withBackground(PlacePlantScreen)} />
          <Stack.Screen name="Locations" component={withBackground(LocationsScreen)} />
          <Stack.Screen name="LocationPlants" component={withBackground(LocationPlantsScreen)} />
          <Stack.Screen name="PlantDetail" component={withBackground(PlantDetail)} />
          <Stack.Screen name="PlantLocationScreen" component={withBackground(PlantLocationScreen)} />
          <Stack.Screen name="DiseaseChecker" component={withBackground(DiseaseChecker)} />
          <Stack.Screen name="PlantCareForumScreen" component={withBackground(PlantCareForumScreen)} />
          <Stack.Screen name="ForumScreen" component={withBackground(ForumScreen)} />
          <Stack.Screen name="SearchScreen" component={withBackground(SearchScreen)} />
          <Stack.Screen name="AddOptionsScreen" component={withBackground(AddOptionsScreen)} />
        </Stack.Navigator>
      </NavigationContainer>
    </FormProvider>
  );
}
