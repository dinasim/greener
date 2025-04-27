import React, { useEffect } from 'react';
import { Button, View, StyleSheet } from 'react-native';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const [request, response, promptAsync] = Google.useAuthRequest({
    clientId: "137391532421-qge2ocrdega22mkq53iu722h1uvoll4l.apps.googleusercontent.com",
    redirectUri: "https://auth.expo.io/@dina2/greener", // Web-specific URI
  });

  useEffect(() => {
    if (response?.type === 'success') {
      const { id_token } = response.authentication;
      fetchUserInfo(id_token);
    }
  }, [response]);

  async function fetchUserInfo(id_token) {
    try {
      const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${id_token}` },
      });
      const userInfo = await res.json();
      console.log('User Info:', userInfo);

      await saveUserToBackend(userInfo);
    } catch (error) {
      console.error('Error fetching user info:', error);
    }
  }

  async function saveUserToBackend(userInfo) {
    try {
      const response = await fetch('https://YOUR-BACKEND-API.com/saveUser', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: userInfo.email,
          name: userInfo.name,
          picture: userInfo.picture,
          googleId: userInfo.sub,
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
        onPress={() => promptAsync()}
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
