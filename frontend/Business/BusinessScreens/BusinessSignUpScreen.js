// frontend/Business/BusinessScreens/BusinessSignUpScreen.js - OPTIMAL VERSION
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LocationPicker from '../../marketplace/components/LocationPicker';
import { useForm } from '../../context/FormContext';
import { useBusinessFirebaseNotifications } from '../hooks/useBusinessFirebaseNotifications';
import ToastMessage from '../../marketplace/components/ToastMessage'; // ADD: Import proper ToastMessage

// Safe ImagePicker import
let ImagePicker;
try {
  ImagePicker = require('expo-image-picker');
} catch (error) {
  console.warn('expo-image-picker not available:', error);
  ImagePicker = {
    launchImageLibraryAsync: () => Promise.resolve({ canceled: true }),
    requestMediaLibraryPermissionsAsync: () => Promise.resolve({ status: 'denied' }),
    getMediaLibraryPermissionsAsync: () => Promise.resolve({ status: 'denied' }),
    MediaTypeOptions: { Images: 'images' }
  };
}

// OPTIMAL: Only import the enhanced API functions we need
import { 
  createBusinessProfile, 
  onBusinessRefresh,
  checkApiHealth,
  getBusinessProfile 
} from '../services/businessApi';

// API Configuration
const API_BASE_URL = 'https://usersfunctions.azurewebsites.net/api';

// ADDED: Missing helper functions for business check
const getEnhancedHeaders = async () => {
  try {
    const [userEmail, userType, businessId, authToken] = await Promise.all([
      AsyncStorage.getItem('userEmail'),
      AsyncStorage.getItem('userType'),
      AsyncStorage.getItem('businessId'),
      AsyncStorage.getItem('googleAuthToken')
    ]);

    const headers = {
      'Content-Type': 'application/json',
      'X-API-Version': '1.0',
      'X-Client': 'greener-mobile'
    };

    // Always include X-User-Email for business profile operations
    if (userEmail) {
      headers['X-User-Email'] = userEmail;
      headers['X-Business-ID'] = userEmail; // Use email as business ID
    }
    if (userType) headers['X-User-Type'] = userType;
    if (businessId) headers['X-Business-ID'] = businessId;
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

    return headers;
  } catch (error) {
    console.error('❌ Error getting headers:', error);
    return { 'Content-Type': 'application/json' };
  }
};

// Simple single check function - no retries
const checkBusinessExists = async (url, options = {}, context = 'Request') => {
  try {
    console.log(`🔍 Single check - ${context}: ${url}`);
    const response = await fetch(url, {
      timeout: 10000, // Shorter timeout for single check
      ...options
    });
    
    // Simple response handling - just check if it exists or not
    if (response.status === 404) {
      console.log('✅ Business profile not found - ready for signup');
      return { exists: false };
    }
    
    if (response.ok) {
      const data = await response.json();
      console.log('⚠️ Business profile already exists');
      return { exists: true, data };
    }
    
    // For other errors, log and assume doesn't exist (allow signup)
    console.warn(`⚠️ Check failed with status ${response.status}, assuming business doesn't exist`);
    return { exists: false };
    
  } catch (error) {
    console.warn(`⚠️ Network error during check: ${error.message}, assuming business doesn't exist`);
    return { exists: false }; // On error, allow signup to proceed
  }
};

export default function BusinessSignUpScreen({ navigation }) {
  const { updateFormData } = useForm();
  const webFileInputRef = useRef(null);
  
  // Add refs to track API calls and prevent loops
  const checkingBusinessRef = useRef(false);
  const lastCheckedEmailRef = useRef('');
  const debounceTimeoutRef = useRef(null);
  
  // Toast state for proper ToastMessage component
  const [toast, setToast] = useState({
    visible: false,
    message: '',
    type: 'info'
  });
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    businessName: '',
    contactName: '',
    phone: '',
    businessType: '',
    description: '',
    logo: null,
    location: null,
  });
  
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [businessTypes] = useState([
    'Nursery',
    'Garden Center',
    'Flower Shop',
    'Plant Store',
    'Tool Supplier',
    'Other'
  ]);
  
  // Firebase notifications hook
  const {
    isInitialized,
    hasPermission,
    token,
    initialize,
    registerForWateringNotifications
  } = useBusinessFirebaseNotifications(formData.email);

  // Show toast message
  const showToast = (message, type = 'info') => {
    setToast({
      visible: true,
      message,
      type
    });
  };
  
  // Hide toast message
  const hideToast = () => {
    setToast(prev => ({
      ...prev,
      visible: false
    }));
  };
  
  // OPTIMAL: Set up auto-refresh listener
  useEffect(() => {
    const unsubscribe = onBusinessRefresh((data) => {
      if (data.type === 'created') {
        console.log('✅ Business profile created, auto-refreshing UI');
        showInventoryChoiceDialog();
      }
    });

    return unsubscribe; // Cleanup on unmount
  }, []);

  const handleChange = (key, value) => {
    setFormData({
      ...formData,
      [key]: value
    });
    
    // Clear error when field is changed
    if (errors[key]) {
      setErrors({
        ...errors,
        [key]: null
      });
    }
  };
  
  // Image picker functions (same as before)
  const handleWebFilePick = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    try {
      if (!file.type.startsWith('image/')) {
        Alert.alert('Error', 'Please select an image file');
        return;
      }
      
      const maxSize = 2 * 1024 * 1024; // 2MB
      if (file.size > maxSize) {
        Alert.alert('Error', 'Image size must be less than 2MB');
        return;
      }
      
      const imageUrl = URL.createObjectURL(file);
      handleChange('logo', imageUrl);
      event.target.value = '';
    } catch (error) {
      console.error('Web image pick error:', error);
      Alert.alert('Error', 'Failed to select image');
    }
  };
  
  const pickImageMobile = async () => {
    try {
      if (ImagePicker.getMediaLibraryPermissionsAsync) {
        const { status } = await ImagePicker.getMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          const { status: newStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (newStatus !== 'granted') {
            Alert.alert('Permission Required', 'Please allow access to your photo library to upload a logo.');
            return;
          }
        }
      }

      let result;
      try {
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions?.Images || 'images',
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.8,
          base64: false,
        });
      } catch (primaryError) {
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: 'images',
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.8,
        });
      }
      
      if (!result.canceled) {
        if (result.assets && result.assets.length > 0) {
          handleChange('logo', result.assets[0].uri);
        } else if (result.uri) {
          handleChange('logo', result.uri);
        }
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Could not select image. Please try again.');
    }
  };
  
  const pickImage = async () => {
    if (Platform.OS === 'web') {
      webFileInputRef.current?.click();
    } else {
      await pickImageMobile();
    }
  };
  
  const handleLocationChange = (location) => {
    handleChange('location', location);
  };
  
  const validateStep = (step) => {
    const newErrors = {};
    
    if (step === 1) {
      if (!formData.email) newErrors.email = 'Email is required';
      else if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = 'Email is invalid';
      
      if (!formData.password) newErrors.password = 'Password is required';
      else if (formData.password.length < 6) newErrors.password = 'Password must be at least 6 characters';
      
      if (!formData.confirmPassword) newErrors.confirmPassword = 'Please confirm your password';
      else if (formData.password !== formData.confirmPassword) newErrors.confirmPassword = 'Passwords do not match';
      
      if (!formData.businessName) newErrors.businessName = 'Business name is required';
      if (!formData.contactName) newErrors.contactName = 'Contact name is required';
    }
    
    if (step === 2) {
      if (!formData.phone) newErrors.phone = 'Phone number is required';
      if (!formData.businessType) newErrors.businessType = 'Business type is required';
      if (!formData.description) newErrors.description = 'Description is required';
      else if (formData.description.length < 20) newErrors.description = 'Description should be at least 20 characters';
      if (!formData.location) newErrors.location = 'Business location is required';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  // SIMPLIFIED: Single check for existing business - no retries, no loops
  const checkExistingBusinessAccount = async (email) => {
    // Prevent multiple simultaneous checks for the same email
    if (checkingBusinessRef.current || lastCheckedEmailRef.current === email) {
      console.log('🔄 Business check already in progress or recently completed for:', email);
      return { exists: false };
    }
    
    try {
      checkingBusinessRef.current = true;
      lastCheckedEmailRef.current = email;
      
      console.log('🔍 Single check for existing business account:', email);
      
      // Temporarily set user email for the API call
      await AsyncStorage.setItem('userEmail', email);
      const headers = await getEnhancedHeaders();
      
      // Use the simple single check function instead of the retry-heavy getBusinessProfile
      const url = `${API_BASE_URL}/business-profile`;
      const result = await checkBusinessExists(url, {
        method: 'GET',
        headers,
      }, 'Check Business Exists');
      
      if (result.exists && result.data) {
        const profile = result.data.profile || result.data.business || result.data;
        return {
          exists: true,
          businessName: profile.businessName || 'Unknown Business',
          businessType: profile.category || profile.businessType || 'Unknown Type',
          registrationDate: profile.createdAt || profile.registrationDate || new Date().toISOString()
        };
      }
      
      return { exists: false };
    } catch (error) {
      console.warn('⚠️ Business check failed:', error.message);
      return { exists: false }; // On any error, allow signup to proceed
    } finally {
      // Reset the checking flag immediately since we're doing a single check
      checkingBusinessRef.current = false;
    }
  };

  const handleNext = async () => {
    if (!validateStep(currentStep)) return;
    
    if (currentStep === 1 && formData.email) {
      // Clear any existing debounce timeout
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
      
      setIsLoading(true);
      
      // Debounce the business check to prevent rapid successive calls
      debounceTimeoutRef.current = setTimeout(async () => {
        try {
          const existingAccount = await checkExistingBusinessAccount(formData.email);
          
          if (existingAccount.exists) {
            setIsLoading(false);
            showToast(
              `A business account already exists for ${formData.email}. Business: "${existingAccount.businessName}". Please use a different email or sign in to your existing account.`,
              'error'
            );
            Alert.alert(
              'Business Account Already Exists',
              `A business account for "${existingAccount.businessName}" is already registered with this email address.\n\nRegistered: ${new Date(existingAccount.registrationDate).toLocaleDateString()}\nType: ${existingAccount.businessType}`,
              [
                {
                  text: 'Use Different Email',
                  style: 'default',
                  onPress: () => {
                    handleChange('email', '');
                    lastCheckedEmailRef.current = ''; // Reset the last checked email
                  }
                },
                {
                  text: 'Sign In Instead',
                  style: 'default',
                  onPress: () => navigation.navigate('BusinessSignInScreen')
                }
              ]
            );
            return;
          }
          
          setIsLoading(false);
          setCurrentStep(currentStep + 1);
        } catch (error) {
          setIsLoading(false);
          showToast(error.message || 'Error checking business account', 'error');
        }
      }, 500); // 500ms debounce
    } else {
      setCurrentStep(currentStep + 1);
    }
  };
  
  const handleBack = () => {
    setCurrentStep(currentStep - 1);
  };
  
  // OPTIMAL: Simplified single-step signup using enhanced API
  const handleSubmit = async () => {
    if (!validateStep(currentStep)) return;
    
    // Prevent multiple submissions
    if (isLoading) {
      console.log('🔒 Business creation already in progress');
      return;
    }
    
    setIsLoading(true);
    showToast('Creating your business account. Please wait a moment while we set up your account.', 'info');
    
    try {
      console.log('🚀 Starting business signup process...');
      
      // STEP 1: Initialize Firebase notifications
      showToast('Setting up notifications...', 'info');
      try {
        await initialize(formData.email);
        console.log('✅ Firebase notifications initialized');
      } catch (notifError) {
        console.warn('⚠️ Firebase notifications failed:', notifError);
      }
      
      // STEP 2: Create basic user account
      showToast('Creating user account...', 'info');
      await createUserAccount();
      console.log('✅ User account created');
      
      // STEP 3: Create business profile (SINGLE CALL)
      showToast('Creating business profile...', 'info');
      const businessData = prepareBusinessData();
      console.log('🏢 Creating business profile - SINGLE ATTEMPT');
      
      const result = await createBusinessProfile(businessData);
      console.log('✅ Business profile created:', result?.businessId || 'success');
      
      // STEP 4: Set up notifications if available
      if (hasPermission && token) {
        try {
          showToast('Configuring notifications...', 'info');
          await registerForWateringNotifications('07:00');
          console.log('✅ Business notifications configured');
        } catch (notificationError) {
          console.warn('⚠️ Failed to setup notifications:', notificationError);
        }
      }
      
      // STEP 5: Update storage
      console.log('💾 Updating local storage...');
      updateFormData('email', formData.email);
      updateFormData('businessId', formData.email);
      
      await AsyncStorage.setItem('userEmail', formData.email);
      await AsyncStorage.setItem('userType', 'business');
      await AsyncStorage.setItem('businessId', formData.email);
      await AsyncStorage.setItem('isBusinessUser', 'true');
      
      setIsLoading(false);
      console.log('✅ Business signup completed successfully');
      
      // IMMEDIATE success feedback
      showToast('Business account created successfully!', 'success');
      
      // Show inventory choice dialog after successful creation
      setTimeout(() => {
        showInventoryChoiceDialog();
      }, 1000);
      
    } catch (error) {
      console.error('❌ Error during business signup:', error);
      setIsLoading(false);
      
      // Better error messages based on error type
      let errorMessage = 'Could not create your business account.';
      let errorDetails = error.message;
      
      if (error.message.includes('Business creation failed')) {
        errorMessage = 'Failed to create business profile. This may be due to a network issue.';
      } else if (error.message.includes('User creation failed')) {
        errorMessage = 'Failed to create user account. Please check your information and try again.';
      } else if (error.message.includes('timeout') || error.message.includes('network')) {
        errorMessage = 'Network timeout. Please check your connection and try again.';
      } else if (error.message.includes('already exists')) {
        errorMessage = 'A business account with this email already exists.';
      }
      
      showToast(errorMessage, 'error');
      
      Alert.alert(
        'Business Signup Failed', 
        `${errorMessage}\n\nPlease try again. If the problem persists, contact support.\n\nTechnical details: ${errorDetails}`,
        [
          { text: 'OK', style: 'default' },
          { 
            text: 'Retry', 
            style: 'default',
            onPress: () => {
              // Reset loading state and allow retry
              setIsLoading(false);
            }
          }
        ]
      );
    }
  };

  // OPTIMAL: Simplified user creation (only what's needed for main user table)
  const createUserAccount = async () => {
    try {
      console.log('👤 Creating basic user account');
      
      const userData = {
        email: formData.email,
        type: 'business',
        name: formData.contactName,
        businessName: formData.businessName,
        businessType: formData.businessType,
        fcmToken: token || null,
        platform: Platform.OS,
      };
      
      const response = await fetch(`${API_BASE_URL}/saveUser`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Email': formData.email,
          'X-User-Type': 'business',
        },
        body: JSON.stringify(userData)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`User creation failed: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log('✅ Basic user account created');
      return result;
    } catch (error) {
      console.error('❌ Error creating user account:', error);
      throw error;
    }
  };

  // OPTIMAL: Prepare data specifically for enhanced createBusinessProfile API
  const prepareBusinessData = () => {
    return {
      // Core business information
      businessName: formData.businessName,
      description: formData.description, // This was missing proper mapping
      
      // Contact information - properly map phone fields
      phone: formData.phone,
      contactPhone: formData.phone, // Map to both fields for compatibility
      
      // Location data - properly structure the location object
      address: formData.location ? {
        street: formData.location.street || '',
        city: formData.location.city || '',
        postalCode: formData.location.postalCode || '',
        country: formData.location.country || 'Israel',
        latitude: formData.location.latitude || null,
        longitude: formData.location.longitude || null,
        formattedAddress: formData.location.formattedAddress || ''
      } : {},
      
      location: formData.location ? {
        street: formData.location.street || '',
        city: formData.location.city || '',
        postalCode: formData.location.postalCode || '',
        country: formData.location.country || 'Israel',
        latitude: formData.location.latitude || null,
        longitude: formData.location.longitude || null,
        formattedAddress: formData.location.formattedAddress || ''
      } : {},
      
      // Business details
      website: '',
      category: formData.businessType,
      businessType: formData.businessType, // Map to both fields
      logo: formData.logo || '',
      
      // Business hours with proper structure
      businessHours: [
        { day: 'monday', hours: '9:00-18:00', isOpen: true },
        { day: 'tuesday', hours: '9:00-18:00', isOpen: true },
        { day: 'wednesday', hours: '9:00-18:00', isOpen: true },
        { day: 'thursday', hours: '9:00-18:00', isOpen: true },
        { day: 'friday', hours: '9:00-18:00', isOpen: true },
        { day: 'saturday', hours: '10:00-16:00', isOpen: true },
        { day: 'sunday', hours: 'Closed', isOpen: false }
      ],
      
      openingHours: {
        monday: '9:00-18:00',
        tuesday: '9:00-18:00',
        wednesday: '9:00-18:00',
        thursday: '9:00-18:00',
        friday: '9:00-18:00',
        saturday: '10:00-16:00',
        sunday: 'Closed'
      },
      
      // Social media structure
      socialMedia: {
        facebook: '',
        instagram: '',
        twitter: '',
        website: ''
      },
      
      // Additional fields that might be expected by the backend
      name: formData.contactName, // Contact person name
      contactEmail: formData.email,
      status: 'active',
      type: 'business'
    };
  };

  const showInventoryChoiceDialog = () => {
    Alert.alert(
      '🎉 Welcome to Greener!',
      `Your business "${formData.businessName}" has been created successfully!\n\nWould you like to add your plant inventory now?`,
      [
        {
          text: 'Add Inventory Now',
          style: 'default',
          onPress: () => {
            navigation.navigate('AddInventoryScreen', {
              businessId: formData.email,
              showInventory: false,
              isNewBusiness: true
            });
          }
        },
        {
          text: 'Do It Later',
          style: 'cancel',
          onPress: () => {
            navigation.navigate('BusinessHomeScreen', {
              businessId: formData.email,
              isNewUser: true
            });
          }
        }
      ],
      { cancelable: false }
    );
  };
  
  const renderStep1 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Account Information</Text>
      
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Email Address <Text style={styles.required}>*</Text></Text>
        <TextInput
          style={[styles.input, errors.email && styles.inputError]}
          value={formData.email}
          onChangeText={(text) => handleChange('email', text)}
          placeholder="Business email address"
          keyboardType="email-address"
          autoCapitalize="none"
        />
        {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}
      </View>
      
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Password <Text style={styles.required}>*</Text></Text>
        <TextInput
          style={[styles.input, errors.password && styles.inputError]}
          value={formData.password}
          onChangeText={(text) => handleChange('password', text)}
          placeholder="Create a password"
          secureTextEntry
        />
        {errors.password && <Text style={styles.errorText}>{errors.password}</Text>}
      </View>
      
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Confirm Password <Text style={styles.required}>*</Text></Text>
        <TextInput
          style={[styles.input, errors.confirmPassword && styles.inputError]}
          value={formData.confirmPassword}
          onChangeText={(text) => handleChange('confirmPassword', text)}
          placeholder="Confirm your password"
          secureTextEntry
        />
        {errors.confirmPassword && <Text style={styles.errorText}>{errors.confirmPassword}</Text>}
      </View>
      
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Business Name <Text style={styles.required}>*</Text></Text>
        <TextInput
          style={[styles.input, errors.businessName && styles.inputError]}
          value={formData.businessName}
          onChangeText={(text) => handleChange('businessName', text)}
          placeholder="Your business name"
        />
        {errors.businessName && <Text style={styles.errorText}>{errors.businessName}</Text>}
      </View>
      
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Contact Person Name <Text style={styles.required}>*</Text></Text>
        <TextInput
          style={[styles.input, errors.contactName && styles.inputError]}
          value={formData.contactName}
          onChangeText={(text) => handleChange('contactName', text)}
          placeholder="Your full name"
        />
        {errors.contactName && <Text style={styles.errorText}>{errors.contactName}</Text>}
      </View>
      
      <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
        <Text style={styles.nextButtonText}>Next</Text>
        <MaterialIcons name="arrow-forward" size={20} color="#fff" />
      </TouchableOpacity>
      
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
        <Text style={styles.backButtonText}>Back</Text>
      </TouchableOpacity>
    </View>
  );
  
  const renderStep2 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Business Details</Text>
      
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Business Phone <Text style={styles.required}>*</Text></Text>
        <TextInput
          style={[styles.input, errors.phone && styles.inputError]}
          value={formData.phone}
          onChangeText={(text) => handleChange('phone', text)}
          placeholder="Contact phone number"
          keyboardType="phone-pad"
        />
        {errors.phone && <Text style={styles.errorText}>{errors.phone}</Text>}
      </View>
      
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Business Type <Text style={styles.required}>*</Text></Text>
        <View style={styles.businessTypeContainer}>
          {businessTypes.map((type) => (
            <TouchableOpacity
              key={type}
              style={[
                styles.businessTypeButton,
                formData.businessType === type && styles.selectedBusinessType
              ]}
              onPress={() => handleChange('businessType', type)}
            >
              <Text
                style={[
                  styles.businessTypeText,
                  formData.businessType === type && styles.selectedBusinessTypeText
                ]}
              >
                {type}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        {errors.businessType && <Text style={styles.errorText}>{errors.businessType}</Text>}
      </View>
      
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Business Description <Text style={styles.required}>*</Text></Text>
        <TextInput
          style={[styles.input, styles.textArea, errors.description && styles.inputError]}
          value={formData.description}
          onChangeText={(text) => handleChange('description', text)}
          placeholder="Tell customers about your business"
          multiline
          numberOfLines={4}
        />
        {errors.description && <Text style={styles.errorText}>{errors.description}</Text>}
      </View>
      
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Business Logo</Text>
        {Platform.OS === 'web' && (
          <input
            ref={webFileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleWebFilePick}
          />
        )}
        <TouchableOpacity style={styles.logoPickerButton} onPress={pickImage}>
          {formData.logo ? (
            <Image source={{ uri: formData.logo }} style={styles.logoPreview} />
          ) : (
            <View style={styles.logoPlaceholder}>
              <MaterialCommunityIcons name="image-plus" size={40} color="#888" />
              <Text style={styles.logoPlaceholderText}>Add Logo</Text>
              <Text style={styles.logoHintText}>
                {Platform.OS === 'web' ? 'Click to select from computer' : 'Tap to select from gallery'}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
      
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Business Location <Text style={styles.required}>*</Text></Text>
        <LocationPicker
          value={formData.location}
          onChange={handleLocationChange}
        />
        {errors.location && <Text style={styles.errorText}>{errors.location}</Text>}
      </View>
      
      <View style={styles.buttonRow}>
        <TouchableOpacity style={styles.backStepButton} onPress={handleBack}>
          <MaterialIcons name="arrow-back" size={20} color="#216a94" />
          <Text style={styles.backStepButtonText}>Back</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.createButton} 
          onPress={handleSubmit}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Text style={styles.createButtonText}>Create Business</Text>
              <MaterialIcons name="check" size={20} color="#fff" />
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <View style={styles.header}>
          <MaterialCommunityIcons name="store" size={28} color="#216a94" />
          <Text style={styles.headerTitle}>Create Business Account</Text>
        </View>
        
        <View style={styles.progressContainer}>
          <View style={[styles.progressBar, { width: `${(currentStep / 2) * 100}%` }]} />
        </View>
        
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {currentStep === 1 ? renderStep1() : renderStep2()}
        </ScrollView>
        
        <ToastMessage 
          visible={toast.visible} 
          onDismiss={hideToast}
          type={toast.type}
          message={toast.message}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#216a94',
    marginLeft: 8,
  },
  progressContainer: {
    height: 4,
    backgroundColor: '#eee',
    width: '100%',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#216a94',
  },
  scrollContent: {
    flexGrow: 1,
    padding: 16,
  },
  stepContainer: {
    padding: 16,
  },
  stepTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    marginBottom: 8,
    color: '#333',
  },
  required: {
    color: '#e53935',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
  },
  inputError: {
    borderColor: '#e53935',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  errorText: {
    color: '#e53935',
    fontSize: 12,
    marginTop: 4,
  },
  businessTypeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  businessTypeButton: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginRight: 8,
    marginBottom: 8,
    backgroundColor: '#f9f9f9',
  },
  selectedBusinessType: {
    backgroundColor: '#216a94',
    borderColor: '#216a94',
  },
  businessTypeText: {
    color: '#666',
  },
  selectedBusinessTypeText: {
    color: '#fff',
    fontWeight: '600',
  },
  logoPickerButton: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 1,
    borderColor: '#ddd',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginTop: 8,
    backgroundColor: '#f9f9f9',
  },
  logoPreview: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  logoPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoPlaceholderText: {
    color: '#888',
    marginTop: 8,
    fontSize: 14,
    fontWeight: '500',
  },
  logoHintText: {
    color: '#aaa',
    marginTop: 4,
    fontSize: 12,
    textAlign: 'center',
  },
  nextButton: {
    backgroundColor: '#216a94',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 8,
    marginTop: 16,
  },
  nextButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
    marginRight: 8,
  },
  backButton: {
    alignItems: 'center',
    marginTop: 16,
  },
  backButtonText: {
    color: '#666',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  backStepButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#216a94',
    borderRadius: 8,
  },
  backStepButtonText: {
    color: '#216a94',
    marginLeft: 8,
    fontWeight: '600',
  },
  createButton: {
    backgroundColor: '#216a94',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    flex: 1,
    marginLeft: 12,
  },
  createButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
    marginRight: 8,
  },
});