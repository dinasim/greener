import React, { useEffect } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, Platform, SafeAreaView } from 'react-native';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import Constants from 'expo-constants';
import * as AuthSession from 'expo-auth-session';
import { useForm } from "../context/FormContext"; // ✅ your form context

WebBrowser.maybeCompleteAuthSession();

export default function SignInGoogleScreen({ navigation }) {
  const { formData, updateFormData } = useForm(); // ✅ include updater

  const [request, response, promptAsync] = Google.useAuthRequest({
    clientId: Constants.expoConfig.extra.expoClientId,
    webClientId: Constants.expoConfig.extra.webClientId,
    redirectUri: AuthSession.makeRedirectUri({ useProxy: true }),
    scopes: ['openid', 'profile', 'email'],
  });

  useEffect(() => {
    if (!response) return;

    console.log('Google Response:', response);

    if (response.type === 'success') {
      const { access_token } = response.params || {};
      console.log('Access Token:', access_token);

      if (access_token) {
        fetchUserInfoFromGoogle(access_token)
          .then((userInfo) => {
            if (userInfo) {
              console.log('User Info:', userInfo);

              // ✅ Save email into global context
              updateFormData('email', userInfo.email);

              saveUserToBackend({
                email: userInfo.email,
                name: userInfo.name,
                googleId: userInfo.sub,
                plantLocations: formData.plantLocations,
                Intersted: formData.Intersted,
                animals: formData.animals,
                kids: formData.kids,
              });
            } else {
              console.error('Failed to fetch user info from Google');
            }
          })
          .catch((error) => {
            console.error('Error fetching user info:', error);
          });
      } else {
        console.error('Missing access_token in Google response');
      }
    } else {
      console.error('Failed to authenticate with Google', response.error || response);
    }
  }, [response]);

  async function fetchUserInfoFromGoogle(access_token) {
    try {
      const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${access_token}` },
      });

      if (!res.ok) {
        throw new Error('Failed to fetch user info from Google API');
      }

      const userInfo = await res.json();
      return userInfo;
    } catch (error) {
      console.error('Error fetching user info from Google API:', error);
      return null;
    }
  }

  async function saveUserToBackend(userData) {
    try {
      console.log('Sending user to backend:', userData);

      const response = await fetch('https://usersfunctions.azurewebsites.net/api/saveUser?', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      });

      const text = await response.text();
      let data;

      try {
        data = text ? JSON.parse(text) : null;
      } catch (jsonError) {
        console.error('Failed to parse JSON:', text);
        throw new Error('Invalid JSON returned from backend');
      }

      if (!response.ok) {
        console.error('Backend returned error status:', response.status, data);
        throw new Error(data?.error || 'Unknown error occurred');
      }

      console.log('Saved to backend result:', data);
      navigation.navigate('Home');
    } catch (error) {
      console.error('Error saving user to backend:', error);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.title}>Sign in with Google</Text>
        <TouchableOpacity
          style={styles.loginButton}
          disabled={!request}
          onPress={() => promptAsync()}
          activeOpacity={0.8}
        >
          <Text style={styles.buttonText}>Login with Google</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    color: '#2e7d32',
    fontWeight: 'bold',
    marginBottom: 40,
    textAlign: 'center',
  },
  loginButton: {
    backgroundColor: '#2e7d32',
    padding: Platform.OS === 'ios' ? 16 : 14,
    borderRadius: 12,
    alignItems: 'center',
    width: '100%',
    maxWidth: 300,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
