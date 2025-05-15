import React, { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  Platform,
  SafeAreaView,
  ImageBackground,
  ActivityIndicator,
  Alert,
  ScrollView,
  Dimensions
} from 'react-native';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import Constants from 'expo-constants';
import * as AuthSession from 'expo-auth-session';
import { useForm } from "../context/FormContext";
import AsyncStorage from '@react-native-async-storage/async-storage';

// Import marketplace API for integration
import marketplaceApi from '../marketplace/services/marketplaceApi';

WebBrowser.maybeCompleteAuthSession();

const windowHeight = Dimensions.get("window").height;

export default function SignInGoogleScreen({ navigation }) {
  const { formData, updateFormData } = useForm();
  const [isLoading, setIsLoading] = useState(false);
  const [authError, setAuthError] = useState(null);

  const [request, response, promptAsync] = Google.useAuthRequest({
    clientId: Constants.expoConfig.extra.expoClientId,
    webClientId: Constants.expoConfig.extra.webClientId,
    redirectUri: AuthSession.makeRedirectUri({ useProxy: true }),
    scopes: ['openid', 'profile', 'email'],
  });

  useEffect(() => {
    if (!response) return;

    console.log('Google Response:', response);
    setIsLoading(true);

    if (response.type === 'success') {
      const { access_token } = response.params || {};
      console.log('Access Token:', access_token);

      if (access_token) {
        // Set the token for marketplace
        setMarketplaceToken(access_token);
        
        fetchUserInfoFromGoogle(access_token)
          .then((userInfo) => {
            if (userInfo) {
              console.log('User Info:', userInfo);

              // Save email into global context
              updateFormData('email', userInfo.email);
              
              // Save email for marketplace API
              saveEmailForMarketplace(userInfo.email);

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
              setIsLoading(false);
              setAuthError('Failed to fetch user info from Google');
              console.error('Failed to fetch user info from Google');
            }
          })
          .catch((error) => {
            setIsLoading(false);
            setAuthError('Error retrieving your profile information');
            console.error('Error fetching user info:', error);
          });
      } else {
        setIsLoading(false);
        setAuthError('Authentication failed: Missing token');
        console.error('Missing access_token in Google response');
      }
    } else {
      setIsLoading(false);
      setAuthError('Failed to authenticate with Google');
      console.error('Failed to authenticate with Google', response.error || response);
    }
  }, [response]);

  // Save token for marketplace integration
  const setMarketplaceToken = async (token) => {
    try {
      // Save to AsyncStorage
      await AsyncStorage.setItem('googleAuthToken', token);
      
      // Set global variable
      global.googleAuthToken = token;
      
      // Set in marketplace API service
      await marketplaceApi.setAuthToken(token);
      
      console.log('Token saved for marketplace integration');
    } catch (error) {
      console.error('Error saving token for marketplace:', error);
    }
  };
  
  // Save email for marketplace user identification
  const saveEmailForMarketplace = async (email) => {
    try {
      await AsyncStorage.setItem('userEmail', email);
      console.log('Email saved for marketplace integration');
    } catch (error) {
      console.error('Error saving email for marketplace:', error);
    }
  };

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
        setIsLoading(false);
        setAuthError(data?.error || 'Error saving your profile. Please try again.');
        throw new Error(data?.error || 'Unknown error occurred');
      }

      console.log('Saved to backend result:', data);
      setIsLoading(false);
      navigation.navigate('Home');
    } catch (error) {
      setIsLoading(false);
      setAuthError('Error connecting to the server');
      console.error('Error saving user to backend:', error);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ImageBackground
        source={require("../assets/homescreen1.png")}
        style={styles.background}
        resizeMode="cover"
      >
        <View style={styles.overlay}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            bounces={false}
          >
            <View style={styles.contentContainer}>
              <View style={styles.view1}>
                <Text style={styles.title}>Sign In</Text>
                <Text style={styles.subtitle}>
                  Sign in with Google to continue to Greener
                </Text>

                {authError && (
                  <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>{authError}</Text>
                  </View>
                )}

                <View style={styles.buttonContainer}>
                  <TouchableOpacity
                    style={styles.googleButton}
                    onPress={() => promptAsync()}
                    disabled={isLoading}
                    activeOpacity={0.8}
                  >
                    {isLoading ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.googleButtonText}>
                        Sign in with Google
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>

                <View style={styles.bottomContainer}>
                  <Text style={styles.signInText}>Don't have an account? </Text>
                  <TouchableOpacity
                    onPress={() => navigation.navigate("Home")}
                    style={styles.signInButton}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Text style={styles.signInLink}>Sign up here</Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={styles.backButton}
                  onPress={() => navigation.goBack()}
                >
                  <Text style={styles.backButtonText}>Back to login options</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </ImageBackground>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#fff",
  },
  background: {
    flex: 1,
    width: "100%",
    height: "100%",
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.85)",
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    minHeight: windowHeight,
  },
  contentContainer: {
    width: "100%",
    paddingHorizontal: 20,
    paddingVertical: Platform.OS === "ios" ? 40 : 20,
    alignItems: "center",
  },
  view1: {
    position: "relative",
    minHeight: 580,
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    paddingVertical: 20,
  },
  title: {
    fontSize: Platform.OS === "ios" ? 36 : 32,
    fontWeight: "bold",
    color: "#2e7d32",
    marginBottom: 10,
    textAlign: "center",
    width: "100%",
    includeFontPadding: false,
  },
  subtitle: {
    fontSize: Platform.OS === "ios" ? 18 : 16,
    color: "#4caf50",
    marginBottom: 40,
    textAlign: "center",
    width: "100%",
    paddingHorizontal: 20,
  },
  buttonContainer: {
    width: "100%",
    marginBottom: 30,
    paddingHorizontal: 20,
  },
  googleButton: {
    backgroundColor: "#4285F4",
    padding: Platform.OS === "ios" ? 16 : 15,
    borderRadius: 8,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  googleButtonText: {
    color: "white",
    fontSize: Platform.OS === "ios" ? 18 : 16,
    fontWeight: "600",
    marginLeft: 10,
  },
  bottomContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 20,
    width: "100%",
    justifyContent: "center",
    paddingVertical: 10,
  },
  signInText: {
    fontSize: Platform.OS === "ios" ? 16 : 14,
    color: "#000",
  },
  signInButton: {
    padding: 8,
  },
  signInLink: {
    fontSize: Platform.OS === "ios" ? 16 : 14,
    color: "#2e7d32",
    textDecorationLine: "underline",
  },
  backButton: {
    marginTop: 20,
    padding: 10,
  },
  backButtonText: {
    fontSize: 14,
    color: "#666",
  },
  errorContainer: {
    backgroundColor: "#ffebee",
    padding: 10,
    borderRadius: 5,
    marginBottom: 20,
    width: "100%",
  },
  errorText: {
    color: "#c62828",
    textAlign: "center",
  },
});