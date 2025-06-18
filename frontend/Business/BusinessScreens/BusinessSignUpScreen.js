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
import { useForm } from '../../context/FormContext';
import { useUniversalNotifications } from '../../hooks/useUniversalNotifications';
import ToastMessage from '../../marketplace/components/ToastMessage';
import { colors, spacing, typography, borderRadius, getShadow, getWebSafeShadow } from '../../marketplace/services/theme';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LocationPicker from '../../marketplace/components/LocationPicker';

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
      let data = null;
      try {
        const text = await response.text();
        if (text) {
          data = JSON.parse(text);
        } else {
          throw new Error('Empty response from server');
        }
      } catch (err) {
        console.warn('Failed to parse JSON:', err);
        throw new Error('Invalid response from server');
      }
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
    // FIXED: Business hours - all days start open with default hours
    businessHours: {
      monday: { isOpen: true, openTime: '09:00', closeTime: '16:00' },
      tuesday: { isOpen: true, openTime: '09:00', closeTime: '16:00' },
      wednesday: { isOpen: true, openTime: '09:00', closeTime: '16:00' },
      thursday: { isOpen: true, openTime: '09:00', closeTime: '16:00' },
      friday: { isOpen: true, openTime: '09:00', closeTime: '16:00' },
      saturday: { isOpen: true, openTime: '09:00', closeTime: '16:00' }, // FIXED: Saturday now defaults to open
      sunday: { isOpen: true, openTime: '09:00', closeTime: '16:00' } // FIXED: Sunday now defaults to open
    },
    socialMedia: {
      website: '',
      facebook: '',
      instagram: '',
      twitter: '',
      whatsapp: ''
    }
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
  
  // Notification hook - fix initialization parameters
  const {
    requestPermission,
    subscribeToTopic,
    unsubscribeFromTopic,
    getToken,
    deleteToken,
    onMessage,
    setBackgroundMessageHandler,
    initialize
  } = useUniversalNotifications('business', formData.email, formData.email); // Pass business email as both userId and businessId

  // Initialize notifications on component mount
  useEffect(() => {
    const initializeNotifications = async () => {
      try {
        // Initialize with business type and email
        await initialize('business', formData.email, formData.email);
        await requestPermission();
        console.log('✅ Notification permissions granted for business signup');
      } catch (error) {
        console.warn('⚠️ Notification permission denied:', error);
      }
    };

    // Only initialize if we have an email
    if (formData.email) {
      initializeNotifications();
    }
  }, [formData.email, initialize, requestPermission]);

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
      
      // FIXED: Upload to Azure instead of creating local blob
      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('type', 'business-logo');
        formData.append('contentType', file.type);

        const uploadResponse = await fetch(`${API_BASE_URL}/marketplace/uploadImage`, {
          method: 'POST',
          body: formData,
        });

        if (uploadResponse.ok) {
          let result = null;
          try {
            const text = await uploadResponse.text();
            if (text) {
              result = JSON.parse(text);
            } else {
              throw new Error('Empty response from server');
            }
          } catch (err) {
            console.warn('Failed to parse JSON:', err);
            Alert.alert('Error', 'Invalid response from server.');
            return;
          }
          handleChange('logo', result.url); // Use Azure URL
        } else {
          throw new Error('Upload failed');
        }
      } catch (uploadError) {
        console.error('Logo upload error:', uploadError);
        Alert.alert('Error', 'Failed to upload logo. Please try again.');
      }
      
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
    // Clear any existing toast first
    hideToast();
    
    if (!validateStep(currentStep)) {
      // Show error toast for validation failures
      showToast('Please check the required fields and try again', 'error');
      return;
    }
    
    if (currentStep === 1 && formData.email) {
      // Clear any existing debounce timeout
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
      
      setIsLoading(true);
      showToast('Validating email address...', 'info');
      
      // Debounce the business check to prevent rapid successive calls
      debounceTimeoutRef.current = setTimeout(async () => {
        try {
          // Hide validation toast before showing check toast
          hideToast();
          await new Promise(resolve => setTimeout(resolve, 300)); // Small delay
          showToast('Checking if business account already exists...', 'info');
          
          const existingAccount = await checkExistingBusinessAccount(formData.email);
          
          if (existingAccount.exists) {
            setIsLoading(false);
            hideToast(); // Clear checking toast
            await new Promise(resolve => setTimeout(resolve, 200));
            showToast(
              `A business account already exists for ${formData.email}. Please use a different email or sign in.`,
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
                    hideToast(); // Clear error toast
                  }
                },
                {
                  text: 'Sign In Instead',
                  style: 'default',
                  onPress: () => {
                    hideToast(); // Clear error toast
                    navigation.navigate('BusinessSignInScreen');
                  }
                }
              ]
            );
            return;
          }
          
          setIsLoading(false);
          hideToast(); // Clear checking toast
          await new Promise(resolve => setTimeout(resolve, 200));
          showToast('Email validated successfully! Moving to next step...', 'success');
          setTimeout(() => {
            hideToast(); // Clear success toast before navigating
            setCurrentStep(currentStep + 1);
          }, 1500); // Longer delay to show success message
        } catch (error) {
          setIsLoading(false);
          hideToast(); // Clear checking toast
          await new Promise(resolve => setTimeout(resolve, 200));
          showToast(error.message || 'Error checking business account', 'error');
        }
      }, 500); // 500ms debounce
    } else {
      // For step 2, just show validation success and move to next step
      showToast('All fields validated successfully!', 'success');
      setTimeout(() => {
        hideToast();
        setCurrentStep(currentStep + 1);
      }, 1000);
    }
  };
  
  const handleBack = () => {
    setCurrentStep(currentStep - 1);
  };
  
  // OPTIMAL: Simplified single-step signup using enhanced API
  const handleSubmit = async () => {
    if (!validateStep(currentStep)) return;
    if (isLoading) return;
    setIsLoading(true);
    showToast('Creating your business account. Please wait...', 'info');
    try {
      // Prepare business registration data
      const businessData = await prepareBusinessData();
      
      // Use the registeruser_business endpoint as requested
      const res = await fetch('https://usersfunctions.azurewebsites.net/api/registeruser_business', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: businessData.email,
          password: formData.password,
          businessName: businessData.businessName,
          contactName: businessData.contactName,
          phone: businessData.phone,
          businessType: businessData.businessType,
          description: businessData.description,
          location: businessData.location,
          businessHours: businessData.businessHours,
          socialMedia: businessData.socialMedia,
          logo: businessData.logo,
          notificationSettings: businessData.notificationSettings,
          fcmToken: businessData.fcmToken,
          webPushSubscription: businessData.webPushSubscription,
          expoPushToken: businessData.expoPushToken,
          platform: businessData.platform,
          createdAt: businessData.createdAt,
          updatedAt: businessData.updatedAt
        })
      });
      let data = null;
      try {
        const text = await res.text();
        if (text) {
          data = JSON.parse(text);
        } else {
          throw new Error('Empty response from server');
        }
      } catch (err) {
        throw new Error('Invalid response from server');
      }
      if (!res.ok) throw new Error(data.error || 'Business registration failed');
      
      setIsLoading(false);
      showToast('🎉 Business account created successfully! Welcome to Greener!', 'success');
      setTimeout(() => {
        navigation.replace('BusinessSignInScreen');
      }, 1500);
    } catch (error) {
      setIsLoading(false);
      showToast(error.message || 'Could not create your business account.', 'error');
    }
  };

  // FIXED: Upload logo to Azure Blob Storage before creating business profile
  const uploadLogoToAzureStorage = async (logoUri) => {
    if (!logoUri || !logoUri.startsWith('blob:')) {
      // If it's already a proper URL or no logo, return as-is
      return logoUri;
    }

    try {
      console.log('📤 Uploading logo to Azure Blob Storage...');
      showToast('Uploading business logo...', 'info');

      // Convert blob URL to actual file data
      const response = await fetch(logoUri);
      const blob = await response.blob();
      
      // Create FormData for upload
      const formData = new FormData();
      formData.append('file', blob, 'business-logo.jpg');
      formData.append('type', 'business');
      formData.append('contentType', blob.type || 'image/jpeg');

      // Get headers for authentication
      const headers = await getEnhancedHeaders();
      // Remove Content-Type header to let FormData set it with boundary
      delete headers['Content-Type'];

      // Upload to Azure Blob Storage using the existing upload endpoint
      const uploadResponse = await fetch(`${API_BASE_URL}/marketplace/uploadImage`, {
        method: 'POST',
        headers,
        body: formData,
      });

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        throw new Error(`Logo upload failed: ${uploadResponse.status} - ${errorText}`);
      }
      let uploadResult = null;
      try {
        const text = await uploadResponse.text();
        if (text) {
          uploadResult = JSON.parse(text);
        } else {
          throw new Error('Empty response from server');
        }
      } catch (err) {
        console.error('Failed to parse logo upload response:', err);
        showToast('Logo upload failed, invalid server response', 'warning');
        return null;
      }
      console.log('✅ Logo uploaded to Azure Storage:', uploadResult.url);
      
      // Clean up the blob URL
      URL.revokeObjectURL(logoUri);
      
      return uploadResult.url;
    } catch (error) {
      console.error('❌ Logo upload failed:', error);
      showToast('Logo upload failed, proceeding without logo', 'warning');
      // Don't fail the entire signup for logo upload issues
      return null;
    }
  };

  // FIXED: Complete business data preparation with proper logo upload
  const prepareBusinessData = async () => {
    // Upload logo to Azure Storage if it's a blob URL
    let logoUrl = formData.logo;
    if (logoUrl && logoUrl.startsWith('blob:')) {
      logoUrl = await uploadLogoToAzureStorage(logoUrl);
    }

    // Get notification token from universal notifications
    let notificationToken = null;
    try {
      notificationToken = await getToken();
    } catch (error) {
      console.warn('⚠️ Could not get notification token:', error);
    }

    // FIXED: Convert user's business hours input to proper format
    const formatBusinessHours = () => {
      return Object.entries(formData.businessHours).map(([day, hours]) => ({
        day: day,
        hours: hours.isOpen ? `${hours.openTime}-${hours.closeTime}` : 'Closed',
        isOpen: hours.isOpen
      }));
    };

    // FIXED: Clean up social media URLs and format properly
    const formatSocialMedia = () => {
      const social = {
        website: '',
        facebook: '',
        instagram: '',
        twitter: '',
        whatsapp: ''
      };
      if (formData.socialMedia.website && formData.socialMedia.website.trim()) {
        social.website = formData.socialMedia.website.trim();
      }
      if (formData.socialMedia.facebook && formData.socialMedia.facebook.trim()) {
        social.facebook = formData.socialMedia.facebook.trim();
      }
      if (formData.socialMedia.instagram && formData.socialMedia.instagram.trim()) {
        social.instagram = formData.socialMedia.instagram.trim();
      }
      if (formData.socialMedia.twitter && formData.socialMedia.twitter.trim()) {
        social.twitter = formData.socialMedia.twitter.trim();
      }
      if (formData.socialMedia.whatsapp && formData.socialMedia.whatsapp.trim()) {
        social.whatsapp = formData.socialMedia.whatsapp.trim();
      }
      return social;
    };

    return {
      // Basic identification
      email: formData.email,
      businessId: formData.email,
      name: formData.contactName,
      
      // Business details
      businessName: formData.businessName,
      businessType: formData.businessType,
      category: formData.businessType,
      description: formData.description || '',
      contactName: formData.contactName,
      contactPhone: formData.phone,
      phone: formData.phone,
      
      // Location data - properly structured
      location: formData.location ? {
        city: formData.location.city,
        street: formData.location.street || '',
        houseNumber: formData.location.houseNumber || '',
        latitude: formData.location.latitude,
        longitude: formData.location.longitude,
        formattedAddress: formData.location.formattedAddress || '',
        country: formData.location.country || 'Israel',
        postalCode: formData.location.postalCode || ''
      } : null,
      
      // FIXED: Use user's actual business hours input
      businessHours: formatBusinessHours(),
      
      // FIXED: Use user's actual social media input (can be empty)
      socialMedia: formatSocialMedia(),
      website: formData.socialMedia.website?.trim() || '',
      
      // Status and verification
      type: 'business',
      platform: Platform.OS,
      isVerified: false,
      
      // Ratings and reviews
      rating: 0,
      reviewCount: 0,
      
      // FIXED: Logo/avatar - use the uploaded Azure Storage URL
      logo: logoUrl || '',
      
      // Notification settings - complete structure
      notificationSettings: {
        enabled: true,
        wateringReminders: true,
        orderUpdates: true,
        marketplaceUpdates: true,
        reviewNotifications: true,
        promotionalEmails: false,
        platform: Platform.OS
      },
      
      // Token fields for notifications - use universal token
      fcmToken: notificationToken,
      webPushSubscription: null,
      expoPushToken: notificationToken,
      
      // Timestamps
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  };

  // FIXED: Improved inventory choice dialog with better navigation
  const showInventoryChoiceDialog = () => {
    console.log('✅ Business signup completed, navigating to choice screen');
    showToast('🎉 Business account created successfully! Welcome to Greener!', 'success');
    
    // Navigate to the dedicated choice screen
    setTimeout(() => {
      navigation.replace('BusinessInventoryChoiceScreen', {
        businessId: formData.email,
        businessName: formData.businessName,
        isNewUser: true
      });
    }, 1500);
  };
  
  // ADD: Helper functions for business hours and social media
  const handleBusinessHourChange = (day, field, value) => {
    let formattedValue = value;
    
    if (field === 'openTime' || field === 'closeTime') {
      formattedValue = formatTimeInput(value);
    }

    setFormData({
      ...formData,
      businessHours: {
        ...formData.businessHours,
        [day]: {
          ...formData.businessHours[day],
          [field]: formattedValue
        }
      }
    });
  };

  const handleSocialMediaChange = (platform, value) => {
    setFormData({
      ...formData,
      socialMedia: {
        ...formData.socialMedia,
        [platform]: value
      }
    });
  };

  // ENHANCED: Improved time input validation and formatting
  const formatTimeInput = (time) => {
    // Remove any non-numeric characters except colon
    const cleaned = time.replace(/[^\d:]/g, '');
    
    // Auto-format as HH:MM
    if (cleaned.length === 2 && !cleaned.includes(':')) {
      return cleaned + ':';
    }
    if (cleaned.length > 5) {
      return cleaned.substring(0, 5);
    }
    return cleaned;
  };

  const validateTime = (time) => {
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    return timeRegex.test(time);
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
          alwaysShowMap={true}
          placeholder="Enter your business address in Israel"
          showToastFeedback={true}
        />
        {errors.location && <Text style={styles.errorText}>{errors.location}</Text>}
      </View>

      {/* FIXED: Compact Business Hours Section for Web */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Business Hours</Text>
        <Text style={styles.subLabel}>Set your operating hours for each day</Text>
        <View style={styles.businessHoursContainer}>
          {Object.entries(formData.businessHours).map(([day, hours]) => (
            <View key={day} style={styles.dayRow}>
              {/* Day name - fixed width */}
              <View style={styles.dayNameContainer}>
                <Text style={[styles.dayName, !hours.isOpen && styles.dayNameClosed]}>
                  {day.charAt(0).toUpperCase() + day.slice(1)}
                </Text>
              </View>
              
              {/* Open/Closed toggle - compact */}
              <View style={styles.toggleContainerCompact}>
                <TouchableOpacity 
                  style={[
                    styles.toggleButtonCompact,
                    hours.isOpen && styles.toggleButtonCompactActive
                  ]}
                  onPress={() => {
                    if (!hours.isOpen) {
                      handleBusinessHourChange(day, 'isOpen', true);
                      if (!hours.openTime || !hours.closeTime) {
                        handleBusinessHourChange(day, 'openTime', '09:00');
                        handleBusinessHourChange(day, 'closeTime', '18:00');
                      }
                    }
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.toggleButtonTextCompact,
                    hours.isOpen && styles.toggleButtonTextCompactActive
                  ]}>
                    Open
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[
                    styles.toggleButtonCompact,
                    !hours.isOpen && styles.toggleButtonCompactActive
                  ]}
                  onPress={() => {
                    handleBusinessHourChange(day, 'isOpen', false);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.toggleButtonTextCompact,
                    !hours.isOpen && styles.toggleButtonTextCompactActive
                  ]}>
                    Closed
                  </Text>
                </TouchableOpacity>
              </View>
              
              {/* Time inputs - only show when open */}
              {hours.isOpen ? (
                <View style={styles.timeRowCompact}>
                  <TextInput
                    style={styles.timeInputCompact}
                    value={hours.openTime}
                    onChangeText={(time) => handleBusinessHourChange(day, 'openTime', time)}
                    placeholder="09:00"
                    placeholderTextColor="#999"
                    keyboardType="numeric"
                  />
                  <Text style={styles.timeSeparator}>-</Text>
                  <TextInput
                    style={styles.timeInputCompact}
                    value={hours.closeTime}
                    onChangeText={(time) => handleBusinessHourChange(day, 'closeTime', time)}
                    placeholder="18:00"
                    placeholderTextColor="#999"
                    keyboardType="numeric"
                  />
                </View>
              ) : (
                <View style={styles.closedIndicator}>
                  <Text style={styles.closedText}>Closed</Text>
                </View>
              )}
            </View>
          ))}
        </View>
      </View>

      {/* ADD: Social Media Section */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Online Presence</Text>
        <Text style={styles.subLabel}>Add your website and social media (optional)</Text>
        
        <View style={styles.socialMediaContainer}>
          <View style={styles.socialMediaRow}>
            <MaterialCommunityIcons name="web" size={20} color="#666" />
            <TextInput
              style={styles.socialMediaInput}
              value={formData.socialMedia.website}
              onChangeText={(text) => handleSocialMediaChange('website', text)}
              placeholder="https://yourwebsite.com"
              keyboardType="url"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.socialMediaRow}>
            <MaterialCommunityIcons name="facebook" size={20} color="#1877F2" />
            <TextInput
              style={styles.socialMediaInput}
              value={formData.socialMedia.facebook}
              onChangeText={(text) => handleSocialMediaChange('facebook', text)}
              placeholder="Facebook page URL"
              keyboardType="url"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.socialMediaRow}>
            <MaterialCommunityIcons name="instagram" size={20} color="#E4405F" />
            <TextInput
              style={styles.socialMediaInput}
              value={formData.socialMedia.instagram}
              onChangeText={(text) => handleSocialMediaChange('instagram', text)}
              placeholder="Instagram account"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.socialMediaRow}>
            <MaterialCommunityIcons name="twitter" size={20} color="#1DA1F2" />
            <TextInput
              style={styles.socialMediaInput}
              value={formData.socialMedia.twitter}
              onChangeText={(text) => handleSocialMediaChange('twitter', text)}
              placeholder="Twitter account"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.socialMediaRow}>
            <MaterialCommunityIcons name="whatsapp" size={20} color="#25D366" />
            <TextInput
              style={styles.socialMediaInput}
              value={formData.socialMedia.whatsapp}
              onChangeText={(text) => handleSocialMediaChange('whatsapp', text)}
              placeholder="WhatsApp number"
              keyboardType="phone-pad"
            />
          </View>
        </View>
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
          onHide={hideToast}
          type={toast.type}
          message={toast.message}
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
  // ADD: New styles for business hours and social media sections
  businessHoursContainer: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: Platform.OS === 'web' ? 16 : 12,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Platform.OS === 'web' ? 8 : 12,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    minHeight: Platform.OS === 'web' ? 50 : 60, // Slightly taller on mobile for better touch
  },
  dayNameContainer: {
    width: Platform.OS === 'web' ? 100 : 90,
    marginRight: Platform.OS === 'web' ? 16 : 12,
  },
  dayName: {
    fontSize: Platform.OS === 'web' ? 16 : 15,
    fontWeight: '600',
    color: '#333',
  },
  dayNameClosed: {
    color: '#999',
  },
  toggleContainerCompact: {
    flexDirection: 'row',
    marginRight: Platform.OS === 'web' ? 16 : 12,
    borderRadius: 6,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  toggleButtonCompact: {
    paddingVertical: Platform.OS === 'web' ? 8 : 10, // Slightly bigger touch target on mobile
    paddingHorizontal: Platform.OS === 'web' ? 16 : 14,
    backgroundColor: '#fff',
    borderRightWidth: 0.5,
    borderLeftWidth: 0.5,
    borderColor: '#ddd',
    minWidth: Platform.OS === 'web' ? 60 : 55,
    alignItems: 'center',
  },
  toggleButtonCompactActive: {
    backgroundColor: '#4CAF50',
  },
  toggleButtonTextCompact: {
    color: '#666',
    fontSize: 14,
    fontWeight: '500',
  },
  toggleButtonTextCompactActive: {
    color: '#fff',
    fontWeight: '600',
  },
  timeRowCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  timeInputCompact: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    padding: Platform.OS === 'web' ? 8 : 10, // Bigger touch target on mobile
    fontSize: 14,
    width: Platform.OS === 'web' ? 60 : 65,
    backgroundColor: '#fff',
    textAlign: 'center',
    color: '#333',
    minHeight: Platform.OS === 'web' ? 'auto' : 44, // iOS accessibility guidelines
  },
  timeSeparator: {
    marginHorizontal: 8,
    color: '#666',
    fontWeight: 'bold',
  },
  closedIndicator: {
    flex: 1,
    paddingLeft: 16,
  },
  closedText: {
    color: '#e53935',
    fontSize: 14,
    fontStyle: 'italic',
  },
  socialMediaContainer: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  socialMediaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  socialMediaInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 8,
    fontSize: 16,
    flex: 1,
    marginLeft: 8,
    backgroundColor: '#fff',
  },
  subLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
});