import React, { useEffect, useState, useRef } from 'react';
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
  Dimensions,
  Animated,
} from 'react-native';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import Constants from 'expo-constants';
import * as AuthSession from 'expo-auth-session';
import { useForm } from "../context/FormContext";
import AsyncStorage from '@react-native-async-storage/async-storage';
import marketplaceApi from '../marketplace/services/marketplaceApi';
import { AntDesign } from '@expo/vector-icons';

WebBrowser.maybeCompleteAuthSession();

const windowHeight = Dimensions.get("window").height;

export default function SignInGoogleScreen({ navigation }) {
  const { formData, updateFormData } = useForm();
  const [isLoading, setIsLoading] = useState(false);
  const [authError, setAuthError] = useState(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const [request, response, promptAsync] = Google.useAuthRequest({
    clientId: Constants.expoConfig.extra.expoClientId,
    webClientId: Constants.expoConfig.extra.webClientId,
    redirectUri: AuthSession.makeRedirectUri({ useProxy: true }),
    scopes: ['openid', 'profile', 'email'],
  });

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 700,
      useNativeDriver: true,
    }).start();
  }, []);

  useEffect(() => {
    if (!response) return;
    setIsLoading(true);

    if (response.type === 'success') {
      const { access_token } = response.params || {};

      if (access_token) {
        setMarketplaceToken(access_token);

        fetchUserInfoFromGoogle(access_token)
          .then((userInfo) => {
            if (userInfo) {
              updateFormData('email', userInfo.email);
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
            }
          })
          .catch(() => {
            setIsLoading(false);
            setAuthError('Error retrieving your profile information');
          });
      } else {
        setIsLoading(false);
        setAuthError('Authentication failed: Missing token');
      }
    } else {
      setIsLoading(false);
      setAuthError('Failed to authenticate with Google');
    }
  }, [response]);

  const setMarketplaceToken = async (token) => {
    try {
      await AsyncStorage.setItem('googleAuthToken', token);
      global.googleAuthToken = token;
      await marketplaceApi.setAuthToken(token);
    } catch (error) {
      console.error('Error saving token:', error);
    }
  };

  const saveEmailForMarketplace = async (email) => {
    try {
      await AsyncStorage.setItem('userEmail', email);
    } catch (error) {
      console.error('Error saving email:', error);
    }
  };

  async function fetchUserInfoFromGoogle(access_token) {
    try {
      const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${access_token}` },
      });

      if (!res.ok) throw new Error('Failed to fetch user info');

      return await res.json();
    } catch (error) {
      console.error(error);
      return null;
    }
  }

  async function saveUserToBackend(userData) {
    try {
      const response = await fetch('https://usersfunctions.azurewebsites.net/api/saveUser?', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData),
      });

      const text = await response.text();
      const data = text ? JSON.parse(text) : null;

      if (!response.ok) {
        setIsLoading(false);
        setAuthError(data?.error || 'Error saving your profile.');
        return;
      }

      setIsLoading(false);
      navigation.navigate('Home');
    } catch (error) {
      setIsLoading(false);
      setAuthError('Server connection error.');
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
          <ScrollView contentContainerStyle={styles.scrollContent} bounces={false}>
            <Animated.View style={[styles.contentContainer, { opacity: fadeAnim }]}>
              <View style={styles.view1}>
                <Text style={styles.title}>Login</Text>
                <Text style={styles.subtitle}>Use your Google account to log into Greener</Text>

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
                      <View style={styles.googleContent}>
  <AntDesign name="google" size={22} color="white" />
  <Text style={styles.googleButtonText}>Login with Google</Text>
</View>
                    )}
                  </TouchableOpacity>
                </View>

                <View style={styles.bottomContainer}>
                  <Text style={styles.signInText}>Don't have an account? </Text>
                  <TouchableOpacity onPress={() => navigation.navigate("SignUp")} style={styles.signInButton}>
                    <Text style={styles.signInLink}>Sign up here</Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                  <Text style={styles.backButtonText}>Back to other login options</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          </ScrollView>
        </View>
      </ImageBackground>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#fff" },
  background: { flex: 1, width: "100%", height: "100%" },
  overlay: { flex: 1, backgroundColor: "rgba(255,255,255,0.85)" },
  scrollContent: { flexGrow: 1, justifyContent: "center", minHeight: windowHeight },
  contentContainer: { width: "100%", paddingHorizontal: 20, alignItems: "center" },
  view1: { minHeight: 580, width: "100%", alignItems: "center", justifyContent: "center", paddingVertical: 20 },
  title: {
    fontSize: 34,
    fontWeight: "bold",
    color: "#2e7d32",
    marginBottom: 10,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    color: "#388e3c",
    marginBottom: 40,
    textAlign: "center",
    lineHeight: 22,
    paddingHorizontal: 10,
  },
  buttonContainer: { width: "100%", marginBottom: 30, paddingHorizontal: 20 },
  googleButton: {
    backgroundColor: "#4285F4",
    padding: 14,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  googleButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  bottomContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 20,
    justifyContent: "center",
    paddingVertical: 10,
  },
  signInText: { fontSize: 14, color: "#000" },
  signInButton: { padding: 8 },
  signInLink: {
    fontSize: 14,
    color: "#2e7d32",
    textDecorationLine: "underline",
  },
  googleContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10, // if gap doesn't work in your version, use marginRight in icon instead
  },
  googleButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  backButton: { marginTop: 20, padding: 10 },
  backButtonText: { fontSize: 14, color: "#666" },
  errorContainer: {
    backgroundColor: "#ffebee",
    padding: 10,
    borderRadius: 5,
    marginBottom: 20,
    width: "100%",
  },
  errorText: { color: "#c62828", textAlign: "center" },
});
