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

const REGISTER_API = 'https://usersfunctions.azurewebsites.net/api/registerUser';

export default function RegistrationScreen({ navigation }) {
  const { formData, updateFormData } = useForm();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const canRegister = username.trim() && password.trim() && email.trim();

  // --------- Web Push Helper Function (from your SignInGoogleScreen) ------------
  async function getAndSaveWebPushToken(email) {
    if (Platform.OS !== "web" || !email) return null;
    try {
      await navigator.serviceWorker.register('/firebase-messaging-sw.js');
      const app = initializeApp(firebaseConfig);
      const messaging = getMessaging(app);
      const token = await getToken(messaging, { vapidKey });

      console.log('✅ Web push token obtained during registration:', token?.substring(0, 20) + '...');
      return token;
    } catch (err) {
      console.error('❌ Error getting web push token:', err);
      return null;
    }
  }

  // --------- FCM (Mobile) Push Helper Function (from your SignInGoogleScreen) ------------
  async function getAndSaveFcmToken(email) {
    if ((Platform.OS !== "android" && Platform.OS !== "ios") || !email) return null;
    try {
      const authStatus = await messaging().requestPermission();
      const enabled =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;
      
      if (enabled) {
        const token = await messaging().getToken();
        console.log('✅ FCM token obtained during registration:', token?.substring(0, 20) + '...');
        return token;
      } else {
        console.log('❌ FCM permission not granted during registration');
        return null;
      }
    } catch (err) {
      console.error('❌ Error getting FCM token:', err);
      return null;
    }
  }

  const handleRegister = async () => {
    setErrorMsg('');
    setSuccessMsg('');
    setLoading(true);

    try {
      console.log('📝 Starting registration process...');

      // --------- Get notification tokens based on platform ---------
      let webPushToken = null;
      let fcmToken = null;
      
      if (Platform.OS === "web") {
        webPushToken = await getAndSaveWebPushToken(email);
        updateFormData('webPushSubscription', webPushToken);
      } else if (Platform.OS === "android" || Platform.OS === "ios") {
        fcmToken = await getAndSaveFcmToken(email);
        updateFormData('fcmToken', fcmToken);
      }

      console.log('🔔 Notification tokens obtained:', {
        platform: Platform.OS,
        webPushToken: webPushToken?.substring(0, 20) + '...' || null,
        fcmToken: fcmToken?.substring(0, 20) + '...' || null
      });

      // Combine registration fields and context fields
      const registrationData = {
        username,
        password,
        email,
        // The following are pulled from your FormContext
        name: formData.name || '',
        intersted: formData.intersted || '',
        animals: formData.animals || '',
        kids: formData.kids || '',
        location: formData.userLocation || null,
        plantLocations: formData.plantLocations || [],
        // Add notification tokens
        expoPushToken: null, // deprecated
        webPushSubscription: webPushToken || formData.webPushSubscription || null,
        fcmToken: fcmToken || formData.fcmToken || null,
        notificationSettings: {
          enabled: true,
          wateringReminders: true,
          marketplaceUpdates: false,
          platform: Platform.OS
        }
      };

      console.log('📦 Sending registration data:', {
        ...registrationData,
        password: '[HIDDEN]',
        webPushSubscription: registrationData.webPushSubscription?.substring(0, 20) + '...' || null,
        fcmToken: registrationData.fcmToken?.substring(0, 20) + '...' || null
      });

      const res = await fetch(REGISTER_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(registrationData),
      });
      
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || 'Registration failed');

      // Save important data to AsyncStorage for marketplace integration
      await AsyncStorage.setItem('userEmail', email);
      await AsyncStorage.setItem('userName', username);
      
      if (webPushToken) {
        await AsyncStorage.setItem('webPushToken', webPushToken);
      }
      if (fcmToken) {
        await AsyncStorage.setItem('fcmToken', fcmToken);
      }

      console.log('✅ Registration successful');
      setSuccessMsg('Registration successful! You can now log in.');
      setLoading(false);
      
      setTimeout(() => navigation.navigate('LoginUser'), 1200);
    } catch (err) {
      console.error('❌ Registration error:', err);
      setLoading(false);
      setErrorMsg(err.message);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1}}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.container}>
          <Text style={styles.title}>One Last Step</Text>
          <Text style={styles.subtitle}>Create your account and get notifications for your plants</Text>
          
          {errorMsg ? <Text style={styles.errorMsg}>{errorMsg}</Text> : null}
          {successMsg ? <Text style={styles.successMsg}>{successMsg}</Text> : null}
          
          <TextInput
            style={styles.input}
            placeholder="Email"
            value={email}
            autoCapitalize="none"
            keyboardType="email-address"
            onChangeText={setEmail}
            editable={!loading}
            returnKeyType="next"
          />
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
          
          <View style={styles.notificationInfo}>
            <Text style={styles.notificationText}>
              🔔 We'll set up notifications to remind you when your plants need water
            </Text>
          </View>
          
          <TouchableOpacity
            style={[styles.button, !canRegister && { opacity: 0.5 }]}
            disabled={!canRegister || loading}
            onPress={handleRegister}
          >
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator color="#fff" />
                <Text style={styles.loadingText}>Setting up your account...</Text>
              </View>
            ) : (
              <Text style={styles.buttonText}>Register & Enable Notifications</Text>
            )}
          </TouchableOpacity>
          
          <TouchableOpacity onPress={() => navigation.navigate('LoginUser')}>
            <Text style={styles.toggleText}>Already have an account? Login</Text>
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
  toggleText: { color: '#2e7d32', marginTop: 8, fontSize: 15, textAlign: "center" },
  errorMsg: { color: "#c62828", marginBottom: 10, textAlign: "center" },
  successMsg: { color: "#205d29", marginBottom: 10, textAlign: "center" }
});