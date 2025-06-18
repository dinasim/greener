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
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useForm } from '../../context/FormContext';
import ToastMessage from '../../marketplace/components/ToastMessage';

export default function BusinessSignInScreen({ navigation }) {
  const { updateFormData } = useForm();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState({ visible: false, message: '', type: 'info' });

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
      // Use the new business-login endpoint for business authentication
      const res = await fetch('https://usersfunctions.azurewebsites.net/api/business-login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!res.ok || !data || !data.success || !data.business) {
        setToast({ visible: true, message: data.error || 'Invalid business credentials', type: 'error' });
        setIsLoading(false);
        return;
      }
      
      // Set persona to business for proper AI assistant behavior
      await AsyncStorage.setItem('persona', 'business');
      await AsyncStorage.setItem('userEmail', data.email);
      await AsyncStorage.setItem('businessId', data.email);
      
      // Update form context
      updateFormData('email', data.email);
      updateFormData('businessId', data.email);
      navigation.navigate('BusinessHomeScreen');
    } catch (err) {
      console.error('Sign in error:', err);
      setToast({ visible: true, message: 'Authentication failed. Please try again.', type: 'error' });
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
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <MaterialCommunityIcons name="store" size={28} color="#216a94" />
            <Text style={styles.headerTitle}>Business Sign In</Text>
          </View>
          <View style={styles.formContainer}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Business Email</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="Enter your business email"
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Password</Text>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="Enter your password"
                secureTextEntry
              />
            </View>
            
            <TouchableOpacity style={styles.forgotPassword}>
              <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.signInButton}
              onPress={handleSignIn}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.signInButtonText}>Sign In</Text>
              )}
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.createAccountButton}
              onPress={() => navigation.navigate('BusinessSignUpScreen')}
            >
              <Text style={styles.createAccountText}>
                Don't have a business account? <Text style={styles.createAccountLink}>Create One</Text>
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
    backgroundColor: '#fff',
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 16,
  },
  header: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 40,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#216a94',
    marginTop: 8,
  },
  formContainer: {
    paddingHorizontal: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    marginBottom: 8,
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: 20,
  },
  forgotPasswordText: {
    color: '#216a94',
  },
  signInButton: {
    backgroundColor: '#216a94',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 20,
  },
  signInButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  createAccountButton: {
    alignItems: 'center',
    marginBottom: 20,
  },
  createAccountText: {
    color: '#666',
  },
  createAccountLink: {
    color: '#216a94',
    fontWeight: '600',
  },
  backButton: {
    alignItems: 'center',
  },
  backButtonText: {
    color: '#666',
  },
});