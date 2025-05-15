import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
} from 'react-native';
import { MaterialIcons, Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Import the consistent header component
import MarketplaceHeader from '../components/MarketplaceHeader';

// Import API service
import { fetchUserProfile, updateUserProfile } from '../services/marketplaceApi';
import config from '../services/config';

// Sample user data for development (same as in ProfileScreen)
const SAMPLE_USER = {
  id: 'user123',
  name: 'Plant Enthusiast',
  email: 'plant.lover@example.com',
  phoneNumber: '+1 (555) 123-4567',
  avatar: 'https://via.placeholder.com/150?text=User',
  bio: 'Passionate plant enthusiast with a love for tropical houseplants. I enjoy propagating plants and helping others grow their own indoor jungles.',
  location: 'Seattle, WA',
};

const EditProfileScreen = () => {
  const navigation = useNavigation();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [user, setUser] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phoneNumber: '',
    bio: '',
    location: '',
    avatar: null,
  });
  const [formErrors, setFormErrors] = useState({
    name: '',
    email: '',
    phoneNumber: '',
  });

  // Load user profile on mount
  useEffect(() => {
    loadUserProfile();
  }, []);

  const loadUserProfile = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // For real app, use API:
      let data;
      try {
        data = await fetchUserProfile();
      } catch (apiError) {
        console.log('API Error (Development Mode):', apiError);
        // For development, use sample data with a delay to simulate API call:
        await new Promise(resolve => setTimeout(resolve, 500));
        data = { user: SAMPLE_USER };
      }

      // Extract user info from the response
      const userData = data.user || SAMPLE_USER;

      setUser(userData);
      setFormData({
        name: userData.name || '',
        email: userData.email || '',
        phoneNumber: userData.phoneNumber || '',
        bio: userData.bio || '',
        location: userData.location || '',
        avatar: userData.avatar || null,
      });

      setIsLoading(false);
    } catch (err) {
      setError('Failed to load profile. Please try again later.');
      setIsLoading(false);
      console.error('Error loading profile:', err);
    }
  };

  const handleChange = (key, value) => {
    setFormData({
      ...formData,
      [key]: value,
    });

    // Clear error for this field if it exists
    if (formErrors[key]) {
      setFormErrors({
        ...formErrors,
        [key]: '',
      });
    }
  };

  const pickImage = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permissionResult.granted) {
        Alert.alert('Permission Required', 'We need permission to access your photos');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mmediaTypes: [ImagePicker.MediaType.IMAGE],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setFormData({
          ...formData,
          avatar: result.assets[0].uri,
        });
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const validateForm = () => {
    const errors = {};

    if (!formData.name.trim()) {
      errors.name = 'Please enter your name';
    } else if (formData.name.trim().length < 3 || formData.name.trim().length > 50) {
      errors.name = 'Name should be between 3 and 50 characters';
    }

    if (!formData.email.trim()) {
      errors.email = 'Please enter your email';
    } else {
      // Basic email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email)) {
        errors.email = 'Please enter a valid email address';
      }
    }

    if (!formData.phoneNumber.trim()) {
      errors.phoneNumber = 'Please enter your phone number';
    } else if (formData.phoneNumber.trim().length < 7) {
      errors.phoneNumber = 'Please enter a valid phone number';
    }

    setFormErrors(errors);

    // Return true if no errors, else false
    return Object.keys(errors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;
  
    try {
      setIsSaving(true);
      setError(null);
  
      // Prepare formData for the API call
      const updatedUserData = {
        name: formData.name,
        email: formData.email,
        phoneNumber: formData.phoneNumber,
        bio: formData.bio || '',
        location: formData.location || '',
      };
  
      // Only include avatar if it was changed
      if (formData.avatar && formData.avatar !== user.avatar) {
        updatedUserData.avatar = formData.avatar;
      }
  
      // For real app, use API
      if (config.isDevelopment && !config.features.useRealApi) {
        // Simulate API delay in development
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Simulate success in development
        console.log('Development mode: Simulating successful profile update');
        
        Alert.alert(
          'Success',
          'Your profile has been updated',
          [{ 
            text: 'OK', 
            onPress: () => {
              // Always navigate back to ProfileScreen on success
              navigation.goBack();
            }
          }]
        );
      } else {
        // Make the actual API call in production
        try {
          await updateUserProfile(user.id, updatedUserData);
          
          Alert.alert(
            'Success',
            'Your profile has been updated',
            [{ 
              text: 'OK', 
              onPress: () => navigation.goBack() 
            }]
          );
        } catch (apiError) {
          console.error('API Error:', apiError);
          throw apiError;
        }
      }
    } catch (err) {
      setError('Failed to update profile. Please try again later.');
      Alert.alert('Error', 'Failed to update profile. Please try again later.');
      console.error('Error updating profile:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    // Simply go back to previous screen
    navigation.goBack();
  };

  // Loading state with consistent header
  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <MarketplaceHeader
          title="Edit Profile"
          showBackButton={true}
          onNotificationsPress={() => navigation.navigate('Messages')}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Error state with consistent header
  if (error && !user) {
    return (
      <SafeAreaView style={styles.container}>
        <MarketplaceHeader
          title="Edit Profile"
          showBackButton={true}
          onNotificationsPress={() => navigation.navigate('Messages')}
        />
        <View style={styles.errorContainer}>
          <MaterialIcons name="error-outline" size={48} color="#f44336" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={loadUserProfile}
          >
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <MarketplaceHeader
        title="Edit Profile"
        showBackButton={true}
        showNotifications={false}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView style={styles.scrollView}>
          {/* Avatar */}
          <View style={styles.avatarContainer}>
            <TouchableOpacity onPress={pickImage}>
              <Image
                source={{ uri: formData.avatar || 'https://via.placeholder.com/150?text=User' }}
                style={styles.avatar}
              />
              <View style={styles.editAvatarButton}>
                <Feather name="camera" size={16} color="#fff" />
              </View>
            </TouchableOpacity>
          </View>

          {/* Form Fields */}
          <View style={styles.formContainer}>
            <View style={styles.formGroup}>
              <Text style={styles.label}>Name</Text>
              <TextInput
                style={[styles.input, formErrors.name && styles.errorInput]}
                value={formData.name}
                onChangeText={(text) => handleChange('name', text)}
                placeholder="Your name"
              />
              {formErrors.name && <Text style={styles.errorText}>{formErrors.name}</Text>}
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={[styles.input, formErrors.email && styles.errorInput]}
                value={formData.email}
                onChangeText={(text) => handleChange('email', text)}
                placeholder="Your email"
                keyboardType="email-address"
                autoCapitalize="none"
              />
              {formErrors.email && <Text style={styles.errorText}>{formErrors.email}</Text>}
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Phone Number</Text>
              <TextInput
                style={[styles.input, formErrors.phoneNumber && styles.errorInput]}
                value={formData.phoneNumber}
                onChangeText={(text) => handleChange('phoneNumber', text)}
                placeholder="Your phone number"
                keyboardType="phone-pad"
              />
              {formErrors.phoneNumber && <Text style={styles.errorText}>{formErrors.phoneNumber}</Text>}
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Location</Text>
              <TextInput
                style={styles.input}
                value={formData.location}
                onChangeText={(text) => handleChange('location', text)}
                placeholder="Your location (city, state)"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Bio</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={formData.bio}
                onChangeText={(text) => handleChange('bio', text)}
                placeholder="Tell others about yourself and your plants"
                multiline
                numberOfLines={4}
              />
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={handleCancel}
              disabled={isSaving}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.saveButton, isSaving && styles.disabledButton]}
              onPress={handleSave}
              disabled={isSaving}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.saveButtonText}>Save Changes</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollView: {
    flex: 1,
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    color: '#f44336',
    fontSize: 14,
    marginTop: 2,
  },
  retryButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 4,
    marginTop: 16,
  },
  retryText: {
    color: '#fff',
    fontWeight: '600',
  },
  avatarContainer: {
    alignItems: 'center',
    marginBottom: 30,
    marginTop: 16,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#f0f0f0',
  },
  editAvatarButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  formContainer: {
    marginBottom: 20,
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
  },
  textArea: {
    height: 120,
    textAlignVertical: 'top',
  },
  errorInput: {
    borderColor: '#f44336',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 40,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: '#f5f5f5',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: '#4CAF50',
    marginLeft: 8,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  disabledButton: {
    backgroundColor: '#A5D6A7',
  },
});

export default EditProfileScreen;