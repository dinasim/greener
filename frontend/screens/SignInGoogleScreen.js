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

// For web push
import { initializeApp } from "firebase/app";
import { getMessaging, getToken } from "firebase/messaging";

// For mobile push
import messaging from '@react-native-firebase/messaging';

// Firebase web config and VAPID key
const firebaseConfig = {
  apiKey: "AIzaSyBAKWjXK-zjao231_SDeuOIT8Rr95K7Bk0",
  authDomain: "greenerapp2025.firebaseapp.com",
  projectId: "greenerapp2025",
  storageBucket: "greenerapp2025.appspot.com",
  messagingSenderId: "241318918547",
  appId: "1:241318918547:web:9fc472ce576da839f11066",
  measurementId: "G-8K9XS4GPRM"
};
const vapidKey = "BKF6MrQxSOYR9yI6nZR45zgrz248vA62XXw0232dE8e6CdPxSAoxGTG2e-JC8bN2YwbPZhSX4qBxcSd23sn_nwg";

WebBrowser.maybeCompleteAuthSession();

const windowHeight = Dimensions.get("window").height;

// This is your Expo Go client ID (from host.exp.exponent)
const EXPO_GOOGLE_CLIENT_ID = "241318918547-apo19m563ah7q2ii68mv975l9fvbtpdv.apps.googleusercontent.com";
// Replace these with your real values from Google Cloud Console if you have them:
const ANDROID_GOOGLE_CLIENT_ID = Constants.expoConfig.extra.androidClientId;
const IOS_GOOGLE_CLIENT_ID = Constants.expoConfig.extra.iosClientId;
const WEB_GOOGLE_CLIENT_ID = Constants.expoConfig.extra.expoClientId;
;

// ====================================

export default function SignInGoogleScreen({ navigation }) {
  const { formData, updateFormData } = useForm();
  const [isLoading, setIsLoading] = useState(false);
  const [authError, setAuthError] = useState(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const isWeb = Platform.OS === 'web';
  const isStandalone = Constants.appOwnership === 'standalone';

  const redirectUri = AuthSession.makeRedirectUri({
    useProxy: !isStandalone,
    native: 'greener://',
  });

  // --- This will automatically choose the right clientId for the platform ---
  const [request, response, promptAsync] = Google.useAuthRequest(
    {
      expoClientId: EXPO_GOOGLE_CLIENT_ID,
      androidClientId: ANDROID_GOOGLE_CLIENT_ID,
      iosClientId: IOS_GOOGLE_CLIENT_ID,
      webClientId: WEB_GOOGLE_CLIENT_ID,
      redirectUri,
      scopes: ['openid', 'profile', 'email'],
    },
    { useProxy: !isStandalone }
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

              // --------- Register push token based on platform ---------
              let webPushToken = null;
              let fcmToken = null;
              if (Platform.OS === "web") {
                webPushToken = await getAndSaveWebPushToken(userInfo.email);
                updateFormData('webPushSubscription', webPushToken);
              } else if (Platform.OS === "android" || Platform.OS === "ios") {
                fcmToken = await getAndSaveFcmToken(userInfo.email);
                updateFormData('fcmToken', fcmToken);
              }
              // -------------------------------------------------------

              const userData = {
                email: userInfo.email,
                name: userInfo.name,
                googleId: userInfo.sub,
                plantLocations: formData.plantLocations,
                intersted: formData.intersted,
                animals: formData.animals,
                kids: formData.kids,
                expoPushToken: null, // deprecated
                webPushSubscription: webPushToken || formData.webPushSubscription || null,
                fcmToken: fcmToken || formData.fcmToken || null,
                location: formData.userLocation,
              };

              console.log("📦 Sending user data:", userData);

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
    // eslint-disable-next-line
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

  // --------- Web Push Helper Function ------------
  async function getAndSaveWebPushToken(email) {
    if (Platform.OS !== "web" || !email) return null;
    try {
      await navigator.serviceWorker.register('/firebase-messaging-sw.js');
      const app = initializeApp(firebaseConfig);
      const messaging = getMessaging(app);
      const token = await getToken(messaging, { vapidKey });

      // Save token to backend (update user with webPushSubscription)
      await fetch('https://usersfunctions.azurewebsites.net/api/saveUser?', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          webPushSubscription: token,
          platform: "web"
        }),
      });
      return token;
    } catch (err) {
      return null;
    }
  }
  // -----------------------------------------------

  // --------- FCM (Mobile) Push Helper Function ------------
  async function getAndSaveFcmToken(email) {
    if ((Platform.OS !== "android" && Platform.OS !== "ios") || !email) return null;
    try {
      const authStatus = await messaging().requestPermission();
      const enabled =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;
      if (enabled) {
        const token = await messaging().getToken();

        // Save token to backend (update user with fcmToken)
        await fetch('https://usersfunctions.azurewebsites.net/api/saveUser?', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email,
            fcmToken: token,
            platform: Platform.OS
          }),
        });
        return token;
      }
    } catch (err) {
      return null;
    }
  }
  // --------------------------------------------------------

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
