import React, { useState } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, SafeAreaView, KeyboardAvoidingView, Platform 
} from 'react-native';
import { useForm } from "../context/FormContext";
import AsyncStorage from '@react-native-async-storage/async-storage';
import firebaseNotificationService from '../services/FirebaseNotificationService';

const LOGIN_API = 'https://usersfunctions.azurewebsites.net/api/loginUser';

export default function LoginScreen({ navigation }) {
  const { updateFormData } = useForm();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const canLogin = username.trim() && password.trim();

  // Setup Firebase notifications for the user
  const setupNotifications = async (email) => {
    try {
      console.log('🔔 Setting up Firebase notifications...');
      
      // Initialize Firebase
      const initialized = await firebaseNotificationService.initialize();
      if (!initialized) {
        console.log('⚠️ Firebase initialization failed - continuing without notifications');
        return;
      }

      // Request permission
      const hasPermission = await firebaseNotificationService.requestPermission();
      if (!hasPermission) {
        console.log('⚠️ Notification permission denied - continuing without notifications');
        return;
      }

      // Get FCM token
      const token = await firebaseNotificationService.getToken();
      if (!token) {
        console.log('⚠️ Failed to get FCM token - continuing without notifications');
        return;
      }

      // Update token on server
      const tokenUpdated = await firebaseNotificationService.updateTokenOnServer(email, token);
      if (tokenUpdated) {
        // Setup token refresh listener
        firebaseNotificationService.setupTokenRefresh(email);
        console.log('✅ Notifications setup completed successfully');
      } else {
        console.log('⚠️ Failed to update token on server');
      }

    } catch (error) {
      console.log('⚠️ Notification setup failed:', error.message);
      // Don't throw - continue with login even if notifications fail
    }
  };

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

      // Setup Firebase notifications (non-blocking)
      setupNotifications(data.email);

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