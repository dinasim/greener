// frontend/Business/BusinessScreens/BusinessSignUpScreen.js
import React, { useState, useRef } from 'react';
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

// Safe ImagePicker import with web compatibility
let ImagePicker;
try {
  ImagePicker = require('expo-image-picker');
} catch (error) {
  console.warn('expo-image-picker not available:', error);
  // Mock ImagePicker for web compatibility
  ImagePicker = {
    launchImageLibraryAsync: () => Promise.resolve({ canceled: true }),
    requestMediaLibraryPermissionsAsync: () => Promise.resolve({ status: 'denied' }),
    getMediaLibraryPermissionsAsync: () => Promise.resolve({ status: 'denied' }),
    MediaTypeOptions: { Images: 'images' }
  };
}

// API Configuration
const API_BASE_URL = 'https://usersfunctions.azurewebsites.net/api';

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
  
  // Web file picker handler
  const handleWebFilePick = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    try {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        Alert.alert('Error', 'Please select an image file');
        return;
      }
      
      // Validate file size (2MB limit)
      const maxSize = 2 * 1024 * 1024; // 2MB
      if (file.size > maxSize) {
        Alert.alert('Error', 'Image size must be less than 2MB');
        return;
      }
      
      // Create object URL for preview
      const imageUrl = URL.createObjectURL(file);
      handleChange('logo', imageUrl);
      
      // Reset input
      event.target.value = '';
      
    } catch (error) {
      console.error('Web image pick error:', error);
      Alert.alert('Error', 'Failed to select image');
    }
  };
  
  // Mobile image picker
  const pickImageMobile = async () => {
    try {
      // Check permissions first
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

      // Launch image picker with fallback options
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
        console.log('Primary image picker failed, trying fallback...');
        // Fallback with string format
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: 'images',
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.8,
        });
      }
      
      console.log('ImagePicker result:', result);
      
      if (!result.canceled) {
        if (result.assets && result.assets.length > 0) {
          const selectedImage = result.assets[0];
          console.log('Image selected:', selectedImage.uri);
          handleChange('logo', selectedImage.uri);
        } else if (result.uri) {
          // Fallback for older versions
          console.log('Image selected (fallback):', result.uri);
          handleChange('logo', result.uri);
        }
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Could not select image. Please try again.');
    }
  };
  
  // Unified image picker function
  const pickImage = async () => {
    if (Platform.OS === 'web') {
      // Trigger web file input
      webFileInputRef.current?.click();
    } else {
      // Use mobile image picker
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
  
  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(currentStep + 1);
    }
  };
  
  const handleBack = () => {
    setCurrentStep(currentStep - 1);
  };
  
  const handleSubmit = async () => {
    if (!validateStep(currentStep)) return;
    
    setIsLoading(true);
    
    try {
      // Prepare user data
      const userData = {
        email: formData.email,
        type: 'business',
        name: formData.contactName,
        businessType: 'business'
      };
      
      // Prepare business data with ALL form fields
      const businessData = {
        id: formData.email,
        email: formData.email,
        name: formData.contactName,
        businessName: formData.businessName,
        businessType: formData.businessType,
        description: formData.description,
        contactPhone: formData.phone,
        contactEmail: formData.email,
        phone: formData.phone, // Add phone field
        logo: null, // Will be updated after logo upload
        address: {
          street: formData.location?.street || '',
          city: formData.location?.city || '',
          postalCode: formData.location?.postalCode || '',
          country: formData.location?.country || 'Israel',
          latitude: formData.location?.latitude || null,
          longitude: formData.location?.longitude || null,
          formattedAddress: formData.location?.formattedAddress || ''
        },
        location: {
          latitude: formData.location?.latitude || null,
          longitude: formData.location?.longitude || null,
          address: formData.location?.formattedAddress || '',
          city: formData.location?.city || '',
          country: formData.location?.country || 'Israel'
        },
        joinDate: new Date().toISOString(),
        status: 'active',
        verificationStatus: 'pending',
        businessHours: [], // Can be set later
        paymentMethods: ['cash', 'pickup'],
        socialMedia: {},
        settings: {
          notifications: true,
          messages: true,
          lowStockThreshold: 5,
        },
        stats: {
          productsCount: 0,
          salesCount: 0,
          rating: 0,
          reviewCount: 0
        },
        rating: 0,
        reviewCount: 0,
        isVerified: false
      };
      
      console.log('Creating business with data:', businessData);
      
      // First, create a normal user account
      await saveUserToBackend(userData);
      
      // Then create a business account (without logo first)
      const businessResult = await saveBusinessToBackend(businessData);
      
      // If we have a logo, upload it and update the business profile
      let logoUrl = null;
      if (formData.logo) {
        try {
          logoUrl = await uploadLogo(formData.logo, formData.email);
          
          // Update business profile with logo
          if (logoUrl) {
            const updatedBusinessData = { ...businessData, logo: logoUrl };
            await updateBusinessProfile(updatedBusinessData);
          }
        } catch (logoError) {
          console.warn('Logo upload failed, but continuing with signup:', logoError);
          // Don't fail the entire signup if logo upload fails
        }
      }
      
      // Update form context for global state
      updateFormData('email', formData.email);
      updateFormData('businessId', formData.email);
      
      // Save email for marketplace
      await AsyncStorage.setItem('userEmail', formData.email);
      await AsyncStorage.setItem('userType', 'business');
      await AsyncStorage.setItem('businessId', formData.email);
      
      setIsLoading(false);
      
      console.log('Business signup completed successfully');
      
      // Navigate to inventory screen
      navigation.navigate('BusinessInventoryScreen');
      
    } catch (error) {
      console.error('Error during signup:', error);
      setIsLoading(false);
      Alert.alert('Sign Up Failed', `Could not create your business account: ${error.message}`);
    }
  };
  
  // ACTUAL API IMPLEMENTATION - Replace placeholder functions
  const saveUserToBackend = async (userData) => {
    try {
      console.log('Creating user account:', userData);
      
      const response = await fetch(`${API_BASE_URL}/saveUser`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`User creation failed: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log('User created successfully:', result);
      return result;
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  };
  
  const saveBusinessToBackend = async (businessData) => {
    try {
      console.log('Creating business profile:', businessData);
      
      const response = await fetch(`${API_BASE_URL}/business/profile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Email': businessData.email
        },
        body: JSON.stringify(businessData)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Business creation failed: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log('Business profile created successfully:', result);
      return result;
    } catch (error) {
      console.error('Error creating business profile:', error);
      throw error;
    }
  };

  const updateBusinessProfile = async (businessData) => {
    try {
      console.log('Updating business profile with logo:', businessData.logo);
      
      const response = await fetch(`${API_BASE_URL}/business/profile`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Email': businessData.email
        },
        body: JSON.stringify({ logo: businessData.logo })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.warn(`Business profile update failed: ${response.status} - ${errorText}`);
        return null;
      }

      const result = await response.json();
      console.log('Business profile updated with logo successfully');
      return result;
    } catch (error) {
      console.error('Error updating business profile:', error);
      throw error;
    }
  };
  
  const uploadLogo = async (logoUri, businessId) => {
    try {
      console.log('Uploading logo:', logoUri.substring(0, 50) + '...');
      
      let imageData;
      let contentType = 'image/jpeg';
      
      if (Platform.OS === 'web') {
        // For web, convert blob URL to base64
        if (logoUri.startsWith('blob:')) {
          const response = await fetch(logoUri);
          const blob = await response.blob();
          
          return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async () => {
              try {
                const base64 = reader.result;
                
                const uploadResponse = await fetch(`${API_BASE_URL}/marketplace/uploadImage`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'X-User-Email': businessId
                  },
                  body: JSON.stringify({
                    image: base64,
                    type: 'user',
                    filename: `business_logo_${businessId.replace('@', '_').replace('.', '_')}_${Date.now()}.jpg`
                  })
                });

                if (!uploadResponse.ok) {
                  const errorText = await uploadResponse.text();
                  throw new Error(`Upload failed: ${uploadResponse.status} - ${errorText}`);
                }

                const result = await uploadResponse.json();
                console.log('Logo uploaded successfully:', result.url);
                resolve(result.url);
              } catch (error) {
                reject(error);
              }
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
        }
      } else {
        // For mobile, convert file URI to base64
        const response = await fetch(logoUri);
        const blob = await response.blob();
        
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = async () => {
            try {
              const base64 = reader.result;
              
              const uploadResponse = await fetch(`${API_BASE_URL}/marketplace/uploadImage`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'X-User-Email': businessId
                },
                body: JSON.stringify({
                  image: base64,
                  type: 'user',
                  filename: `business_logo_${businessId.replace('@', '_').replace('.', '_')}_${Date.now()}.jpg`
                })
              });

              if (!uploadResponse.ok) {
                const errorText = await uploadResponse.text();
                throw new Error(`Upload failed: ${uploadResponse.status} - ${errorText}`);
              }

              const result = await uploadResponse.json();
              console.log('Logo uploaded successfully:', result.url);
              resolve(result.url);
            } catch (error) {
              reject(error);
            }
          };
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      }
    } catch (error) {
      console.error('Error uploading logo:', error);
      throw error;
    }
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
        {/* Hidden file input for web */}
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