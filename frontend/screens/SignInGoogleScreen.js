import React, { useEffect } from 'react';
import { Button, View, StyleSheet } from 'react-native';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import Constants from 'expo-constants';
import * as AuthSession from 'expo-auth-session';
import { useForm } from "../context/FormContext"; // This import is correct


WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  // Call useForm inside the function component
  const { formData } = useForm();  // Valid hook call now

  const [request, response, promptAsync] = Google.useAuthRequest({
    clientId: Constants.expoConfig.extra.expoClientId,
    webClientId: Constants.expoConfig.extra.webClientId,
    redirectUri: AuthSession.makeRedirectUri({
      useProxy: true, // important for Expo Go
    }),
  });
  useEffect(() => {
    if (response?.type === 'success') {
      const { id_token } = response.authentication;
      if (id_token) {
        fetchUserInfo(id_token);
      } else {
        console.error("No id_token received from Google response");
      }
    } else {
      console.error('Failed to authenticate with Google', response);
    }
  }, [response]);
  
  async function fetchUserInfo(id_token) {
    try {
      const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${id_token}` },
      });
  
      if (!res.ok) {
        throw new Error('Failed to fetch user info from Google API');
      }
  
      const userInfo = await res.json();
      console.log('User Info:', userInfo);
  
      if (!userInfo.email || !userInfo.name) {
        throw new Error('Missing email or name from Google response');
      }
  
      await saveUserToBackend(userInfo);
    } catch (error) {
      console.error('Error fetching user info:', error);
    }
  }
  

  async function saveUserToBackend(userInfo) {
    try {
      console.log('Sending user info:', {
        email: userInfo.email,
        name: userInfo.name,
        googleId: userInfo.sub,
        plants_location: formData.plants_location,
        Intersted: formData.Intersted,
        animals: formData.animals,
        kids: formData.kids
      });
      const response = await fetch('https://usershandle.azurewebsites.net/api/saveUser?', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: userInfo.email,
          name: userInfo.name,
          googleId: userInfo.sub,
          plants_location: formData.plants_location,
          Intersted: formData.Intersted,
          animals: formData.animals,
          kids: formData.kids
        }),
      });

      const data = await response.json();
      console.log('Save result:', data);
    } catch (error) {
      console.error('Error saving user to backend:', error);
    }
  }

  return (
    <View style={styles.container}>
      <Button
        disabled={!request}
        title="Login with Google"
        onPress={() =>  {
          console.log('Redirect URI:', AuthSession.makeRedirectUri({ useProxy: true }));
          promptAsync({ useProxy: true })
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
});
