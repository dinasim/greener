import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ImageBackground,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Dimensions,
  Platform,
  ActivityIndicator,
  Alert,
} from "react-native";
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Ensure WebBrowser can complete auth session
WebBrowser.maybeCompleteAuthSession();

const windowHeight = Dimensions.get("window").height;

// Your Google Auth config
// Replace with your actual credentials
const GOOGLE_CLIENT_ID = {
  expoClientId: 'YOUR_EXPO_CLIENT_ID',
  iosClientId: 'YOUR_IOS_CLIENT_ID',
  androidClientId: 'YOUR_ANDROID_CLIENT_ID',
  webClientId: 'YOUR_WEB_CLIENT_ID',
};

export default function SignInGoogleScreen({ navigation }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [authError, setAuthError] = useState(null);

  // Set up Google Auth Request
  const [request, response, promptAsync] = Google.useAuthRequest(GOOGLE_CLIENT_ID);

  // Check if user is already logged in
  useEffect(() => {
    const checkLoginStatus = async () => {
      try {
        const storedUser = await AsyncStorage.getItem('user');
        const storedToken = await AsyncStorage.getItem('token');
        
        if (storedUser && storedToken) {
          // Set auth token globally for API requests
          global.authToken = storedToken;
          
          // User is logged in, navigate to Home screen
          navigation.replace('Home');
        }
      } catch (error) {
        console.error('Error checking login status:', error);
      }
    };
    
    checkLoginStatus();
  }, []);

  // Handle Google Auth Response
  useEffect(() => {
    if (response?.type === 'success') {
      setIsLoading(true);
      handleSignInWithGoogle(response.authentication);
    } else if (response?.type === 'error') {
      setAuthError('Google Sign In failed. Please try again.');
      console.error('Google Sign In Error:', response.error);
    }
  }, [response]);

  // Handle successful Google Sign-In
  const handleSignInWithGoogle = async (authentication) => {
    try {
      // Save auth token globally
      global.authToken = authentication.accessToken;
      
      // Get user info from Google
      const userInfoResponse = await fetch(
        'https://www.googleapis.com/userinfo/v2/me',
        {
          headers: { Authorization: `Bearer ${authentication.accessToken}` },
        }
      );
      
      const userInfo = await userInfoResponse.json();
      
      // Store user info and token for persistence
      await AsyncStorage.setItem('user', JSON.stringify(userInfo));
      await AsyncStorage.setItem('token', authentication.accessToken);
      
      // Update user state
      setUser(userInfo);
      
      // Navigate to Home screen
      navigation.replace('Home');
    } catch (error) {
      console.error('Error handling Google Sign In:', error);
      setAuthError('Failed to get user information. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Sign out function
  const signOut = async () => {
    try {
      await AsyncStorage.removeItem('user');
      await AsyncStorage.removeItem('token');
      global.authToken = null;
      setUser(null);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

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
                    onPress={() => navigation.navigate("SignUp")}
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