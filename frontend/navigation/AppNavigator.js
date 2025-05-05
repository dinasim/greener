import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LoginScreen from '../screens/LoginScreen';
import HomeScreen from '../screens/HomeScreen';
import SignUpScreen from '../screens/SignUpScreen';
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

import { FormProvider } from '../context/FormContext';

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  return (
    <FormProvider>
      <Stack.Navigator initialRouteName="Login" screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="SignUp" component={SignUpScreen} />
        <Stack.Screen name="SignupPlantsLocation" component={PlantLocationScreen} />
        <Stack.Screen name="SignupIntersted" component={SignupIntersted} />
        <Stack.Screen name="SignupAnimals" component={SignupAnimals} />
        <Stack.Screen name="SignupLocationReq" component={SignupLocationReq} />
        <Stack.Screen name="SignupReminders" component={SignupReminders} />
        <Stack.Screen name="SignInGoogleScreen" component={SignInGoogleScreen} />
        <Stack.Screen name="SignIn" component={SignInGoogleScreen} />
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="Camera" component={CameraScreen} />
        <Stack.Screen name="AddPlant" component={AddPlantScreen} />
        <Stack.Screen name="PlacePlantScreen" component={PlacePlantScreen} />
        <Stack.Screen name="Locations" component={LocationsScreen} />
        <Stack.Screen name="LocationPlants" component={LocationPlantsScreen} />
      </Stack.Navigator>
    </FormProvider>
  );
}