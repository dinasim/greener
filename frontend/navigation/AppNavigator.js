import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LoginScreen from '../screens/LoginScreen';
import HomeScreen from '../screens/HomeScreen';
import SignUpScreen from '../screens/SignUpScreen';
import SignInScreen from '../screens/SignInGoogleScreen';
import PlantLocationScreen from '../screens/SignupPlantsLocation';
import SignupIntersted from "../screens/SignupIntersted.js";
import SignupAnimals from "../screens/SignupAnimals.js";
import SignupLocationReq from "../screens/SignupLocationReq.js";
import SignupReminders from "../screens/SignupReminders.js";
import SignInGoogleScreen from "../screens/SignInGoogleScreen.js";
import CameraScreen from '../screens/CameraScreen';

import { FormProvider } from '../context/FormContext';

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  return (
    <FormProvider>
    <Stack.Navigator initialRouteName="Login">
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="SignUp" component={SignUpScreen} />
      <Stack.Screen name="SignupPlantsLocation" component={PlantLocationScreen} />
      <Stack.Screen name="SignupIntersted" component={SignupIntersted} />
      <Stack.Screen name="SignupAnimals" component={SignupAnimals} />
      <Stack.Screen name="SignupLocationReq" component={SignupLocationReq} />
      <Stack.Screen name="SignupReminders" component={SignupReminders} />
      <Stack.Screen name="SignIn" component={SignInScreen} />
      <Stack.Screen name="Home" component={HomeScreen} />
    </Stack.Navigator>
    </FormProvider>
  );
}