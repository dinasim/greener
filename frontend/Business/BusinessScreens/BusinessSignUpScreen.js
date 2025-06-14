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

// Toast notification function
const showToast = (message, type = 'info') => {
  if (Platform.OS === 'web') {
    const toast = document.createElement('div');
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 12px 20px;
      border-radius: 8px;
      color: white;
      font-weight: 500;
      z-index: 10000;
      max-width: 300px;
      word-wrap: break-word;
      background-color: ${type === 'error' ? '#f44336' : type === 'success' ? '#4caf50' : '#2196f3'};
    `;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
  } else {
    Alert.alert(
      type === 'error' ? 'Error' : type === 'success' ? 'Success' : 'Info',
      message
    );
  }
};

export default function BusinessSignUpScreen({ navigation }) {
  const { updateFormData } = useForm();
  const webFileInputRef = useRef(null);
  
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
  
  // OPTIMAL: Simplified existing business check using enhanced API
  const checkExistingBusinessAccount = async (email) => {
    try {
      console.log('🔍 Checking for existing business account via enhanced API:', email);
      
      // Temporarily set user email for the API call
      await AsyncStorage.setItem('userEmail', email);
      
      const existingProfile = await getBusinessProfile(email);
      
      if (existingProfile && existingProfile.profile) {
        return {
          exists: true,
          businessName: existingProfile.profile.businessName,
          businessType: existingProfile.profile.category || existingProfile.profile.businessType,
          registrationDate: existingProfile.profile.createdAt
        };
      }
      
      return { exists: false };
    } catch (error) {
      // 404 means no existing business - which is what we want for new signups
      if (error.message.includes('404') || error.message.includes('not found')) {
        console.log('✅ No existing business found - can proceed');
        return { exists: false };
      }
      
      console.warn('⚠️ Error checking existing business, proceeding:', error.message);
      return { exists: false };
    }
  };

  const handleNext = async () => {
    if (!validateStep(currentStep)) return;
    
    if (currentStep === 1 && formData.email) {
      setIsLoading(true);
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
                onPress: () => handleChange('email', '')
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
        showToast(error.message, 'error');
      }
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
    
    setIsLoading(true);
    
    try {
      // Initialize Firebase notifications
      console.log('🔔 Setting up Firebase notifications...');
      await initialize(formData.email);
      
      // STEP 1: Create basic user account first (still needed for main user table)
      await createUserAccount();
      
      // STEP 2: Create comprehensive business profile using enhanced API
      const businessData = prepareBusinessData();
      console.log('🏢 Creating business profile with enhanced API');
      
      const result = await createBusinessProfile(businessData);
      
      // Set up notifications if permission is granted
      if (hasPermission && token) {
        try {
          console.log('🔔 Setting up business notifications...');
          await registerForWateringNotifications('07:00');
          console.log('✅ Business notifications configured');
        } catch (notificationError) {
          console.warn('⚠️ Failed to setup notifications:', notificationError);
        }
      }
      
      // Update storage
      updateFormData('email', formData.email);
      updateFormData('businessId', formData.email);
      
      await AsyncStorage.setItem('userEmail', formData.email);
      await AsyncStorage.setItem('userType', 'business');
      await AsyncStorage.setItem('businessId', formData.email);
      
      setIsLoading(false);
      console.log('✅ Business signup completed successfully with enhanced API');
      
      // Note: showInventoryChoiceDialog() will be called automatically via auto-refresh
      
    } catch (error) {
      console.error('❌ Error during signup:', error);
      setIsLoading(false);
      
      let errorMessage = 'Could not create your business account.';
      if (error.message.includes('Business creation failed')) {
        errorMessage = 'Failed to create business profile. Please try again.';
      } else if (error.message.includes('User creation failed')) {
        errorMessage = 'Failed to create user account. Please try again.';
      } else if (error.message.includes('timeout')) {
        errorMessage = 'Request timeout. Please check your connection and try again.';
      }
      
      Alert.alert('Sign Up Failed', `${errorMessage}\n\nError: ${error.message}`);
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
      businessName: formData.businessName,
      description: formData.description,
      address: formData.location?.formattedAddress || '',
      phone: formData.phone,
      website: '',
      category: formData.businessType,
      logo: formData.logo || '',
      openingHours: {
        monday: '9:00-18:00',
        tuesday: '9:00-18:00',
        wednesday: '9:00-18:00',
        thursday: '9:00-18:00',
        friday: '9:00-18:00',
        saturday: '10:00-16:00',
        sunday: 'Closed'
      },
      socialMedia: {
        facebook: '',
        instagram: '',
        twitter: ''
      }
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