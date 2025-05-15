// screens/SignInGoogleScreen.js
import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  SafeAreaView,
  ImageBackground,
  ActivityIndicator,
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
              <Text style={styles.title}>Sign In</Text>
              <Text style={styles.subtitle}>Use your Google account to log in</Text>

              {authError && (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorText}>{authError}</Text>
                </View>
              )}

              <TouchableOpacity
                style={styles.googleButton}
                onPress={() => promptAsync()}
                disabled={isLoading}
                activeOpacity={0.85}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <View style={styles.googleContent}>
                    <AntDesign name="google" size={22} color="white" style={{ marginRight: 8 }} />
                    <Text style={styles.googleButtonText}>Continue with Google</Text>
                  </View>
                )}
              </TouchableOpacity>

              <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                <Text style={styles.backButtonText}>Back to other login options</Text>
              </TouchableOpacity>
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
  overlay: { flex: 1, backgroundColor: "rgba(255,255,255,0.88)", justifyContent: "center" },
  scrollContent: { flexGrow: 1, justifyContent: "center", minHeight: windowHeight },
  contentContainer: { paddingHorizontal: 24, alignItems: "center" },
  title: { fontSize: 32, fontWeight: "bold", color: "#2e7d32", marginBottom: 10 },
  subtitle: { fontSize: 16, color: "#388e3c", marginBottom: 30, textAlign: "center" },
  googleButton: {
    backgroundColor: "#4285F4",
    paddingVertical: 14,
    borderRadius: 10,
    width: "100%",
    alignItems: "center",
    elevation: 2,
  },
  googleContent: { flexDirection: "row", alignItems: "center" },
  googleButtonText: { color: "white", fontSize: 16, fontWeight: "600" },
  backButton: { marginTop: 30 },
  backButtonText: { fontSize: 14, color: "#777" },
  errorContainer: {
    backgroundColor: "#ffebee",
    padding: 10,
    borderRadius: 6,
    marginBottom: 20,
    width: "100%",
  },
  errorText: { color: "#c62828", textAlign: "center" },
});
