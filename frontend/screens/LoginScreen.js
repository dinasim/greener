import React, { useState } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, SafeAreaView, KeyboardAvoidingView, Platform 
} from 'react-native';
import { useForm } from "../context/FormContext";
import AsyncStorage from '@react-native-async-storage/async-storage';

// Firebase imports - using your existing setup
import { initializeApp } from "firebase/app";
import { getMessaging, getToken } from "firebase/messaging";
import messaging from '@react-native-firebase/messaging';

// Your Firebase configuration
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

const LOGIN_API = 'https://usersfunctions.azurewebsites.net/api/loginUser';

export default function LoginScreen({ navigation }) {
  const { updateFormData } = useForm();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const canLogin = username.trim() && password.trim();

  // --------- Web Push Helper Function (from your SignInGoogleScreen) ------------
  async function getAndUpdateWebPushToken(email) {
    if (Platform.OS !== "web" || !email) return null;
    try {
      await navigator.serviceWorker.register('/firebase-messaging-sw.js');
      const app = initializeApp(firebaseConfig);
      const messaging = getMessaging(app);
      const token = await getToken(messaging, { vapidKey });

      console.log('✅ Web push token obtained during login:', token?.substring(0, 20) + '...');
      
      // Update user with new token in case it changed
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
      console.error('❌ Error getting web push token:', err);
      return null;
    }
  }

  // --------- FCM (Mobile) Push Helper Function (from your SignInGoogleScreen) ------------
  async function getAndUpdateFcmToken(email) {
    if ((Platform.OS !== "android" && Platform.OS !== "ios") || !email) return null;
    try {
      const authStatus = await messaging().requestPermission();
      const enabled =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;
      
      if (enabled) {
        const token = await messaging().getToken();
        console.log('✅ FCM token obtained during login:', token?.substring(0, 20) + '...');
        
        // Update user with new token in case it changed
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
      } else {
        console.log('❌ FCM permission not granted during login');
        return null;
      }
    } catch (err) {
      console.error('❌ Error getting FCM token:', err);
      return null;
    }
  }

  const handleLogin = async () => {
    setErrorMsg('');
    setLoading(true);
    
    try {
      console.log('🔑 Starting login process...');
      
      const res = await fetch(LOGIN_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || 'Login failed');

      console.log('✅ Login successful for user:', data.email);

      // Update form context with user data
      updateFormData('email', data.email);
      updateFormData('username', data.username);
      updateFormData('name', data.name);
      updateFormData('intersted', data.intersted || '');
      updateFormData('animals', data.animals || '');
      updateFormData('kids', data.kids || '');

      // Save to AsyncStorage for marketplace integration
      await AsyncStorage.setItem('userEmail', data.email);
      await AsyncStorage.setItem('userName', data.username);

      // --------- Update notification tokens based on platform ---------
      let webPushToken = null;
      let fcmToken = null;
      
      if (Platform.OS === "web") {
        webPushToken = await getAndUpdateWebPushToken(data.email);
        updateFormData('webPushSubscription', webPushToken);
        if (webPushToken) {
          await AsyncStorage.setItem('webPushToken', webPushToken);
        }
      } else if (Platform.OS === "android" || Platform.OS === "ios") {
        fcmToken = await getAndUpdateFcmToken(data.email);
        updateFormData('fcmToken', fcmToken);
        if (fcmToken) {
          await AsyncStorage.setItem('fcmToken', fcmToken);
        }
      }

      console.log('🔔 Notification tokens updated:', {
        platform: Platform.OS,
        webPushToken: webPushToken?.substring(0, 20) + '...' || null,
        fcmToken: fcmToken?.substring(0, 20) + '...' || null
      });

      setLoading(false);
      navigation.navigate('Home');
    } catch (err) {
      console.error('❌ Login error:', err);
      setLoading(false);
      setErrorMsg(err.message);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1  }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.container}>
          <Text style={styles.title}>Welcome Back</Text>
          <Text style={styles.subtitle}>Sign in to continue caring for your plants</Text>
          
          {errorMsg ? <Text style={styles.errorMsg}>{errorMsg}</Text> : null}
          
          <TextInput
            style={styles.input}
            placeholder="Username"
            value={username}
            autoCapitalize="none"
            onChangeText={setUsername}
            editable={!loading}
            returnKeyType="next"
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            editable={!loading}
            returnKeyType="done"
          />
          
          <TouchableOpacity
            style={[styles.button, !canLogin && { opacity: 0.5 }]}
            disabled={!canLogin || loading}
            onPress={handleLogin}
          >
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator color="#fff" />
                <Text style={styles.loadingText}>Signing in...</Text>
              </View>
            ) : (
              <Text style={styles.buttonText}>Login</Text>
            )}
          </TouchableOpacity>
          
          <View style={styles.notificationInfo}>
            <Text style={styles.notificationText}>
              🔔 We'll update your notification settings to ensure you get plant care reminders
            </Text>
          </View>
          
          <TouchableOpacity onPress={() => navigation.navigate('SignupPlantsLocation')}>
            <Text style={styles.toggleText}>Don't have an account? Register</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, flex: 1, justifyContent: 'center' },
  title: { fontSize: 28, fontWeight: 'bold', color: '#2e7d32', marginBottom: 8, textAlign: "center" },
  subtitle: { fontSize: 14, color: '#666', marginBottom: 18, textAlign: "center", lineHeight: 20 },
  input: {
    width: '100%', borderColor: "#ccc", borderWidth: 1, borderRadius: 10, padding: 13,
    fontSize: 16, marginBottom: 12, backgroundColor: "#f8f8fa",
  },
  button: {
    width: '100%', backgroundColor: '#2e7d32', paddingVertical: 15, borderRadius: 10,
    marginTop: 6, marginBottom: 12, alignItems: 'center',
  },
  buttonText: { color: '#fff', fontWeight: "bold", fontSize: 17 },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  loadingText: {
    color: '#fff',
    fontSize: 14,
  },
  notificationInfo: {
    backgroundColor: '#e8f5e8',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  notificationText: {
    color: '#2e7d32',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  toggleText: { color: '#2e7d32', marginTop: 8, fontSize: 15, textAlign: "center" },
  errorMsg: { color: "#c62828", marginBottom: 10, textAlign: "center" }
});