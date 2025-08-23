// screens/SignInGoogleScreen.js
import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  ScrollView,
  Dimensions,
  Animated,
  Platform,
} from 'react-native';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import Constants from 'expo-constants';
import * as AuthSession from 'expo-auth-session';
import { useForm } from "../context/FormContext";
import AsyncStorage from '@react-native-async-storage/async-storage';
import marketplaceApi from '../marketplace/services/marketplaceApi';
import { AntDesign } from '@expo/vector-icons';
import { initializeChatPush, enablePushRegistration } from '../notifications/expoPushSetup';

WebBrowser.maybeCompleteAuthSession();

const windowHeight = Dimensions.get("window").height;

// -- These values must match your Google Cloud OAuth client IDs --
const EXPO_GOOGLE_CLIENT_ID = "241318918547-apo19m563ah7q2ii68mv975l9fvbtpdv.apps.googleusercontent.com";
const ANDROID_GOOGLE_CLIENT_ID = Constants.expoConfig.extra.androidClientId;
const IOS_GOOGLE_CLIENT_ID = Constants.expoConfig.extra.iosClientId;
const WEB_GOOGLE_CLIENT_ID = Constants.expoConfig.extra.expoClientId;

// Helper
const isStandalone = Constants.appOwnership === 'standalone';

export default function SignInGoogleScreen({ navigation }) {
  const { formData, updateFormData } = useForm();
  const [isLoading, setIsLoading] = useState(false);
  const [authError, setAuthError] = useState(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Conditional proxy/redirect for cross-platform Google auth
  const useProxy = !isStandalone;
  const redirectUri = AuthSession.makeRedirectUri({
    useProxy,
    native: 'greener://',
  });

  const [request, response, promptAsync] = Google.useAuthRequest(
    {
      expoClientId: EXPO_GOOGLE_CLIENT_ID, // for Expo Go (optional for production)
      androidClientId: ANDROID_GOOGLE_CLIENT_ID,
      iosClientId: IOS_GOOGLE_CLIENT_ID,
      webClientId: WEB_GOOGLE_CLIENT_ID,
      redirectUri,
      scopes: ['openid', 'profile', 'email'],
    },
    { useProxy }
  );

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
          .then(async (userInfo) => {
            if (userInfo) {
              updateFormData('email', userInfo.email);
              saveEmailForMarketplace(userInfo.email);

              // Only store minimal data locally for authentication
              await AsyncStorage.setItem('userEmail', userInfo.email);
              await AsyncStorage.setItem('currentUserId', userInfo.email);
              await AsyncStorage.setItem('persona', 'consumer'); // Set persona for AI assistant

              const userData = {
                email: userInfo.email,
                name: userInfo.name,
                googleId: userInfo.sub,
                plantLocations: formData.plantLocations,
                intersted: formData.intersted,
                animals: formData.animals,
                kids: formData.kids,
                // FIXED: Ensure location data includes coordinates and address
                location: formData.userLocation ? {
                  city: formData.userLocation.city || '',
                  street: formData.userLocation.street || '',
                  houseNumber: formData.userLocation.houseNumber || '',
                  latitude: formData.userLocation.latitude || null,
                  longitude: formData.userLocation.longitude || null,
                  formattedAddress: formData.userLocation.formattedAddress || '',
                  country: formData.userLocation.country || 'Israel',
                  postalCode: formData.userLocation.postalCode || ''
                } : null,
              };

              console.log("Sending user data:", {
                ...userData,
                location: userData.location ? {
                  city: userData.location.city,
                  hasCoordinates: !!(userData.location.latitude && userData.location.longitude),
                  coordinates: userData.location.latitude && userData.location.longitude ? 
                    `${userData.location.latitude.toFixed(4)}, ${userData.location.longitude.toFixed(4)}` : 'None'
                } : 'No location'
              });
              saveUserToBackend(userData);
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
      // Use the correct consumer registration endpoint instead of saveUser
      const registrationData = {
        // Required fields for consumer registration
        username: userData.name?.replace(/\s+/g, '').toLowerCase() || userData.email.split('@')[0],
        email: userData.email,
        name: userData.name || userData.email.split('@')[0],
        
        // Optional consumer fields from form context
        intersted: userData.intersted || formData.intersted || '',
        animals: userData.animals || formData.animals || '',
        kids: userData.kids || formData.kids || '',
        
        // Location data
        location: userData.location,
        plantLocations: userData.plantLocations || formData.plantLocations || [],
        
        // Notification settings
        notificationSettings: {
          enabled: true,
          wateringReminders: true,
          marketplaceUpdates: false,
          platform: Platform.OS
        },
        
        // User type and metadata
        type: 'consumer',
        platform: Platform.OS,
        googleId: userData.googleId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        
        // Generate a secure password for Google users (they won't use it for login)
        password: Math.random().toString(36).slice(-16) + Date.now().toString(36)
      };

      console.log("Using consumer registration endpoint with data:", {
        ...registrationData,
        password: '[HIDDEN]',
        location: registrationData.location ? {
          city: registrationData.location.city,
          hasCoordinates: !!(registrationData.location.latitude && registrationData.location.longitude)
        } : 'No location'
      });

      // Use registerUser endpoint for consumers
      const response = await fetch('https://usersfunctions.azurewebsites.net/api/registerUser', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(registrationData),
      });

      const text = await response.text();
      const data = text ? JSON.parse(text) : null;

      if (!response.ok) {
        setIsLoading(false);
        setAuthError(data?.error || 'Error creating your account.');
        return;
      }

      console.log('Consumer registration successful via Google sign-in');
      
      setIsLoading(false);
      
      // Register for push notifications (Expo) - AFTER successful registration
      try {
        const pushToken = await (async () => {
          try {
            enablePushRegistration();
            const cleanEmail = (userData.email || '').trim();
            return await initializeChatPush(cleanEmail, (notificationData) => {
              // Navigation handler when notification is tapped
              if (notificationData?.conversationId) {
                navigation.navigate('Chat', { conversationId: notificationData.conversationId });
              } else if (notificationData?.chatId) {
                navigation.navigate('Chat', { chatId: notificationData.chatId });
              }
            });
          } catch (e) { return null; }
        })();
        
        if (pushToken) {
          console.log('Expo push token registered:', pushToken);
        }
      } catch (pushError) {
        console.log('Push notification registration failed:', pushError);
        // Don't block user flow for push notification errors
      }

      // Navigate to home screen
      navigation.navigate('Home');
      
    } catch (error) {
      console.error('Registration error:', error);
      setIsLoading(false);
      setAuthError('Server connection error.');
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  background: { flex: 1, width: "100%", height: "100%" },
  overlay: { flex: 1, backgroundColor: "transparent", justifyContent: "center" },
  scrollContent: { flexGrow: 1, justifyContent: "center", minHeight: windowHeight },
  contentContainer: { paddingHorizontal: 24, alignItems: "center" },
  title: { fontSize: 32, fontWeight: "bold", color: "#2e7d32", marginBottom: 10 },
  subtitle: { fontSize: 16, color: "#388e3c", marginBottom: 30, textAlign: "center" },
  googleButton: {
    backgroundColor: "#228b22",
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