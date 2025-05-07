import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { FormProvider } from '../context/FormContext';

// Screens
import LoginScreen from '../screens/LoginScreen';
import SignUpScreen from '../screens/SignUpScreen';
import SignInGoogleScreen from '../screens/SignInGoogleScreen';
import HomeScreen from '../screens/HomeScreen';
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

// Marketplace Pages
import Categories from '../marketplace/Pages/Categories';
import CreateSell from '../marketplace/Pages/CreateSell';
import Edit from '../marketplace/Pages/Edit';
import EditProfile from '../marketplace/Pages/EditProfile';
import Messages from '../marketplace/Pages/Messages';
import Profile from '../marketplace/Pages/Profile';
import Error404 from '../marketplace/Pages/Error404';

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  return (
    <FormProvider>
      <Stack.Navigator initialRouteName="Login" screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="SignUp" component={SignUpScreen} />
        <Stack.Screen name="SignIn" component={SignInGoogleScreen} />
        <Stack.Screen name="SignInGoogleScreen" component={SignInGoogleScreen} />
        <Stack.Screen name="SignupPlantsLocation" component={PlantLocationScreen} />
        <Stack.Screen name="SignupIntersted" component={SignupIntersted} />
        <Stack.Screen name="SignupAnimals" component={SignupAnimals} />
        <Stack.Screen name="SignupLocationReq" component={SignupLocationReq} />
        <Stack.Screen name="SignupReminders" component={SignupReminders} />
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="Camera" component={CameraScreen} />
        <Stack.Screen name="AddPlant" component={AddPlantScreen} />
        <Stack.Screen name="PlacePlantScreen" component={PlacePlantScreen} />
        <Stack.Screen name="Locations" component={LocationsScreen} />
        <Stack.Screen name="LocationPlants" component={LocationPlantsScreen} />
        <Stack.Screen name="Marketplace" component={Categories} />
        <Stack.Screen name="CreateSell" component={CreateSell} />
        <Stack.Screen name="EditProduct" component={Edit} />
        <Stack.Screen name="EditProfile" component={EditProfile} />
        <Stack.Screen name="Messages" component={Messages} />
        <Stack.Screen name="UserProfile" component={Profile} />
        <Stack.Screen name="Error404" component={Error404} />
      </Stack.Navigator>
    </FormProvider>
  );
}
