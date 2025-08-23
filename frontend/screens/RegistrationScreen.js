import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, SafeAreaView, KeyboardAvoidingView, Platform
} from 'react-native';
import { useForm } from "../context/FormContext";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { registerAfterLogin } from '../pushRegistrationSnippet';

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

  const handleRegister = async () => {
    setErrorMsg('');
    setSuccessMsg('');
    setLoading(true);

    try {
      console.log('📝 Starting registration process...');

      // Combine registration fields and context fields
      const registrationData = {
        username: username || '',
        password: password || '',
        email: email || '',
        name: formData.name || '',
        intersted: formData.intersted || '',
        animals: formData.animals || '',
        kids: formData.kids || '',
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
        plantLocations: formData.plantLocations || [],
        expoPushToken: null, // deprecated
        webPushSubscription: null,
        notificationSettings: {
          enabled: true,
          wateringReminders: true,
          marketplaceUpdates: false,
          platform: Platform.OS
        },
        type: 'consumer',
        platform: Platform.OS,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      console.log('📦 Sending registration data:', {
        ...registrationData,
        password: '[HIDDEN]',
        webPushSubscription: registrationData.webPushSubscription?.substring(0, 20) + '...' || null,
        location: registrationData.location ? {
          city: registrationData.location.city,
          hasCoordinates: !!(registrationData.location.latitude && registrationData.location.longitude),
          coordinates: registrationData.location.latitude && registrationData.location.longitude ? 
            `${registrationData.location.latitude.toFixed(4)}, ${registrationData.location.longitude.toFixed(4)}` : 'None'
        } : 'No location'
      });

      const res = await fetch(REGISTER_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(registrationData),
      });
      
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || 'Registration failed');

      // Do not save any user data to AsyncStorage (except session token if needed)
      console.log('✅ Registration successful');
      setSuccessMsg('Registration successful! You can now log in.');
      setLoading(false);
      
      // Register for push notifications (Expo)
      try {
        await registerAfterLogin(data.id || data.email, pushData => {
          if (pushData?.conversationId) {
            // navigation.navigate('Chat', { conversationId: pushData.conversationId });
          }
        });
      } catch (e) {
        console.log('Expo push registration failed/skipped', e);
      }

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