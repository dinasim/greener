// screens/BusinessSignInScreen.js
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,            // 👈 added
  Linking,          // 👈 added (for optional "Email us" action)
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useForm } from '../../context/FormContext';
import { useUniversalNotifications } from '../../hooks/useUniversalNotifications';
import ToastMessage from '../../marketplace/components/ToastMessage';

const COLORS = {
  primary: '#216a94',      // app blue
  primaryDark: '#194e6a',
  primaryLight: '#eaf3fb', // soft blue surface
  surfaceLight: '#f0f8ff',
  border: '#cfe1ec',
  text: '#333',
  textMuted: '#556570',
  error: '#c62828',
  white: '#fff',
};

export default function BusinessSignInScreen({ navigation }) {
  const { updateFormData } = useForm();
  const { initialize } = useUniversalNotifications();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState({ visible: false, message: '', type: 'info' });

  const handleForgotPassword = () => {
    Alert.alert(
      'Forgot Password',
      'Contact us at dina2@gmail.com',
      [
        { text: 'Email us', onPress: () => Linking.openURL('mailto:dina2@gmail.com?subject=Password%20Reset%20Help') },
        { text: 'OK', style: 'cancel' },
      ]
    );
    // If you prefer a toast instead of an alert, use:
    // setToast({ visible: true, message: 'Contact us at dina2@gmail.com', type: 'info' });
  };

  const handleSignIn = async () => {
    if (!email.trim()) {
      setToast({ visible: true, message: 'Email is required', type: 'error' });
      return;
    }
    if (!password) {
      setToast({ visible: true, message: 'Password is required', type: 'error' });
      return;
    }
    
    setIsLoading(true);
    setToast({ visible: false, message: '', type: 'info' });
    
    try {
      const res = await fetch('https://usersfunctions.azurewebsites.net/api/business-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      
      const responseText = await res.text();
      let data = null;
      if (responseText) {
        try {
          data = JSON.parse(responseText);
        } catch {
          setToast({ visible: true, message: 'Invalid server response. Please try again.', type: 'error' });
          setIsLoading(false);
          return;
        }
      } else {
        setToast({ visible: true, message: 'No response from server. Please check your connection.', type: 'error' });
        setIsLoading(false);
        return;
      }
      
      if (!res.ok) {
        const errorMessage = data?.error || `Server error (${res.status})`;
        setToast({ visible: true, message: errorMessage, type: 'error' });
        setIsLoading(false);
        return;
      }
      
      if (!data || !data.success || !data.business) {
        const errorMessage = data?.error || 'Invalid login response from server';
        setToast({ visible: true, message: errorMessage, type: 'error' });
        setIsLoading(false);
        return;
      }
      
      // Persist business persona
      await AsyncStorage.setItem('persona', 'business');
      await AsyncStorage.setItem('userEmail', data.email);
      await AsyncStorage.setItem('businessId', data.email);
      await AsyncStorage.setItem('userType', 'business');
      await AsyncStorage.setItem('isBusinessUser', 'true');
      
      // Update form context
      updateFormData('email', data.email);
      updateFormData('businessId', data.email);
      
      // Initialize notifications in background
      setTimeout(async () => {
        try {
          await initialize('business', data.email, data.email);
        } catch (notificationError) {
          console.warn('⚠️ Business notifications failed to initialize:', notificationError);
        }
      }, 1000);
      
      setToast({ visible: true, message: 'Login successful! Redirecting...', type: 'success' });
      setTimeout(() => {
        navigation.navigate('BusinessHomeScreen');
      }, 1000);
      
    } catch {
      setToast({ 
        visible: true, 
        message: 'Connection failed. Please check your internet and try again.', 
        type: 'error' 
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.logoBadge}>
              <MaterialCommunityIcons name="store" size={26} color={COLORS.white} />
            </View>
            <Text style={styles.headerTitle}>Business Sign In</Text>
            <Text style={styles.headerSubtitle}>Access your shop dashboard</Text>
          </View>

          {/* Card */}
          <View style={styles.card}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Business Email</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="Enter your business email"
                placeholderTextColor="#93a7b5"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
              />
            </View>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Password</Text>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="Enter your password"
                placeholderTextColor="#93a7b5"
                secureTextEntry
                returnKeyType="done"
              />
            </View>
            
            <TouchableOpacity style={styles.forgotPassword} onPress={handleForgotPassword}>
              <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.signInButton, isLoading && { opacity: 0.85 }]}
              onPress={handleSignIn}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color={COLORS.white} />
              ) : (
                <Text style={styles.signInButtonText}>Sign In</Text>
              )}
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.createAccountButton}
              onPress={() => navigation.navigate('BusinessSignUpScreen')}
            >
              <Text style={styles.createAccountText}>
                Don’t have a business account? <Text style={styles.createAccountLink}>Create One</Text>
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Text style={styles.backButtonText}>Back</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

        <ToastMessage
          visible={toast.visible}
          message={toast.message}
          type={toast.type}
          onHide={() => setToast(prev => ({ ...prev, visible: false }))}
          duration={3000}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.primaryLight, // soft blue background
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 16,
    paddingBottom: 24,
  },

  // Header
  header: {
    alignItems: 'center',
    marginTop: 18,
    marginBottom: 18,
  },
  logoBadge: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.primaryDark,
    marginTop: 12,
  },
  headerSubtitle: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: 4,
  },

  // Card
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 14,
    paddingVertical: 20,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },

  // Form
  formContainer: {
    paddingHorizontal: 20,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    marginBottom: 6,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    backgroundColor: COLORS.surfaceLight,
    color: COLORS.text,
  },

  // Actions
  forgotPassword: {
    alignSelf: 'flex-end',
    marginTop: 2,
    marginBottom: 18,
  },
  forgotPasswordText: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  signInButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 16,
  },
  signInButtonText: {
    color: COLORS.white,
    fontWeight: '800',
    fontSize: 16,
    letterSpacing: 0.2,
  },
  createAccountButton: {
    alignItems: 'center',
    marginBottom: 12,
  },
  createAccountText: {
    color: COLORS.textMuted,
  },
  createAccountLink: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  backButton: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  backButtonText: {
    color: COLORS.textMuted,
    fontWeight: '600',
  },
});
