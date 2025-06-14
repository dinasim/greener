// screens/EditProfileScreen.js (enhanced version)

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
  KeyboardAvoidingView,
  SafeAreaView,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { updateUserProfile, fetchUserProfile } from '../services/marketplaceApi';
import MarketplaceHeader from '../components/MarketplaceHeader';
import LocationPicker from '../components/LocationPicker';

const EditProfileScreen = () => {
  const navigation = useNavigation();
  
  // Profile state
  const [profile, setProfile] = useState({
    name: '',
    email: '',
    avatar: '',
    bio: '',
    city: '',
    phone: '',
    languages: '',
    fullAddress: '',
    birthDate: '',
    socialMedia: {
      instagram: '',
      facebook: '',
    },
    location: null,
    joinDate: new Date().toISOString()
  });
  
  // UI state
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [avatarChanged, setAvatarChanged] = useState(false);
  
  // Load user profile
  useEffect(() => {
    loadUserProfile();
  }, []);
  
  const loadUserProfile = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Get email from AsyncStorage
      const userEmail = await AsyncStorage.getItem('userEmail');
      
      if (!userEmail) {
        setError('User not logged in');
        setIsLoading(false);
        return;
      }
      
      // Fetch user profile
      const data = await fetchUserProfile(userEmail);
      
      if (data && data.user) {
        // Update state with user data, preserving defaults for missing fields
        setProfile({
          ...profile,
          ...data.user,
          name: data.user.name || '',
          email: data.user.email || userEmail,
          avatar: data.user.avatar || '',
          bio: data.user.bio || '',
          city: data.user.city || (data.user.location?.city || ''),
          phone: data.user.phone || '',
          languages: data.user.languages || '',
          fullAddress: data.user.fullAddress || '',
          birthDate: data.user.birthDate || '',
          socialMedia: data.user.socialMedia || {
            instagram: '',
            facebook: ''
          },
          joinDate: data.user.joinDate || new Date().toISOString()
        });
      } else {
        // Set default profile with email
        setProfile({
          ...profile,
          email: userEmail,
        });
      }
      
      setIsLoading(false);
    } catch (err) {
      console.error('Error loading profile:', err);
      setError('Failed to load profile. Please try again later.');
      setIsLoading(false);
    }
  };
  
  // Handle field changes
  const handleChange = (field, value) => {
    if (field.includes('.')) {
      // Handle nested fields like socialMedia.instagram
      const [parent, child] = field.split('.');
      setProfile(prev => ({
        ...prev,
        [parent]: {
          ...prev[parent],
          [child]: value
        }
      }));
    } else {
      // Handle regular fields
      setProfile(prev => ({
        ...prev,
        [field]: value
      }));
    }
  };
  
  // Handle location change
  const handleLocationChange = (locationData) => {
    setProfile(prev => ({
      ...prev,
      location: locationData,
      city: locationData.city || prev.city
    }));
  };
  
  // Pick avatar image (gallery or camera)
  const pickAvatar = async () => {
    try {
      let result;
      if (Platform.OS === 'web') {
        // Web: use file input for both camera and gallery
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.capture = 'environment';
        input.onchange = async (event) => {
          const file = event.target.files[0];
          if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
              setProfile(prev => ({ ...prev, avatar: e.target.result }));
              setAvatarChanged(true);
            };
            reader.readAsDataURL(file);
          }
        };
        input.click();
        return;
      }
      // Mobile: ask user for camera or gallery
      Alert.alert(
        'Change Profile Photo',
        'Choose a method',
        [
          {
            text: 'Take Photo',
            onPress: async () => {
              const cameraPerm = await ImagePicker.requestCameraPermissionsAsync();
              if (!cameraPerm.granted) {
                Alert.alert('Permission Required', 'Camera access is needed.');
                return;
              }
              result = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 0.7 });
              if (!result.cancelled && result.assets?.[0]?.uri) {
                setProfile(prev => ({ ...prev, avatar: result.assets[0].uri }));
                setAvatarChanged(true);
              }
            }
          },
          {
            text: 'Choose from Gallery',
            onPress: async () => {
              const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
              if (!permissionResult.granted) {
                Alert.alert('Permission Required', 'We need permission to access your photos');
                return;
              }
              result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 0.7 });
              if (!result.cancelled && result.assets?.[0]?.uri) {
                setProfile(prev => ({ ...prev, avatar: result.assets[0].uri }));
                setAvatarChanged(true);
              }
            }
          },
          { text: 'Cancel', style: 'cancel' }
        ]
      );
    } catch (err) {
      Alert.alert('Error', 'Could not update photo.');
    }
  };
  
  // Save profile changes
  const handleSave = async () => {
    try {
      // Validate required fields
      if (!profile.name.trim()) {
        Alert.alert('Error', 'Name is required');
        return;
      }
      
      setIsSaving(true);
      
      // Prepare data for API
      const profileData = {
        name: profile.name,
        bio: profile.bio,
        city: profile.city,
        phone: profile.phone,
        languages: profile.languages,
        fullAddress: profile.fullAddress,
        birthDate: profile.birthDate,
        socialMedia: profile.socialMedia,
        location: profile.location,
      };
      
      // Upload avatar if changed
      if (avatarChanged && profile.avatar) {
        try {
          // Upload image implementation goes here
          // For now, we'll just use the URI directly
          profileData.avatar = profile.avatar;
        } catch (uploadErr) {
          console.error('Error uploading avatar:', uploadErr);
          Alert.alert('Warning', 'Could not upload avatar, but other profile changes will be saved.');
        }
      }
      
      // Call API to update profile
      await updateUserProfile(profile.email, profileData);
      
      // Success!
      Alert.alert('Success', 'Profile updated successfully');
      
      // Navigate back
      navigation.navigate('Profile', { refresh: true });
    } catch (err) {
      console.error('Error saving profile:', err);
      Alert.alert('Error', 'Failed to save profile. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };
  
  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <MarketplaceHeader
          title="Edit Profile"
          showBackButton={true}
          onBackPress={() => navigation.goBack()}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      </SafeAreaView>
    );
  }
  
  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <MarketplaceHeader
          title="Edit Profile"
          showBackButton={true}
          onBackPress={() => navigation.goBack()}
        />
        <View style={styles.errorContainer}>
          <MaterialIcons name="error-outline" size={48} color="#f44336" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadUserProfile}>
            <Text style={styles.retryButtonText}>Retry</Text>
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
        onBackPress={() => navigation.goBack()}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidContainer}
      >
        <ScrollView style={styles.scrollView}>
          <View style={styles.avatarSection}>
            <Image
              source={{
                uri: profile.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.name || 'U')}&background=4CAF50&color=fff&size=256`
              }}
              style={styles.avatar}
            />
            <TouchableOpacity style={styles.changeAvatarButton} onPress={pickAvatar}>
              <MaterialIcons name="photo-camera" size={18} color="#fff" />
              <Text style={styles.changeAvatarText}>Change Photo</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>Public Information</Text>
            <Text style={styles.sectionSubtitle}>This information will be visible to other users</Text>
            
            <Text style={styles.label}>Name <Text style={styles.requiredText}>*</Text></Text>
            <TextInput
              style={styles.input}
              value={profile.name}
              onChangeText={(text) => handleChange('name', text)}
              placeholder="Your name"
            />
            
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={[styles.input, styles.disabledInput]}
              value={profile.email}
              editable={false}
            />
            
            <Text style={styles.label}>Bio</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={profile.bio}
              onChangeText={(text) => handleChange('bio', text)}
              placeholder="Tell others about yourself..."
              multiline
            />
            
            <Text style={styles.label}>Languages</Text>
            <TextInput
              style={styles.input}
              value={profile.languages}
              onChangeText={(text) => handleChange('languages', text)}
              placeholder="Hebrew, English, Arabic, etc."
            />
            
            <Text style={styles.label}>Location</Text>
            <LocationPicker
              value={profile.location}
              onChange={handleLocationChange}
            />
          </View>
          
          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>Private Information</Text>
            <Text style={styles.sectionSubtitle}>This information is private and not shown to other users</Text>
            
            <Text style={styles.label}>Phone Number</Text>
            <TextInput
              style={styles.input}
              value={profile.phone}
              onChangeText={(text) => handleChange('phone', text)}
              placeholder="Your phone number"
              keyboardType="phone-pad"
            />
            
            <Text style={styles.label}>Full Address</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={profile.fullAddress}
              onChangeText={(text) => handleChange('fullAddress', text)}
              placeholder="Your complete address"
              multiline
            />
            
            <Text style={styles.label}>Birth Date</Text>
            <TextInput
              style={styles.input}
              value={profile.birthDate}
              onChangeText={(text) => handleChange('birthDate', text)}
              placeholder="YYYY-MM-DD"
            />
          </View>
          
          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>Social Media</Text>
            
            <Text style={styles.label}>Instagram</Text>
            <TextInput
              style={styles.input}
              value={profile.socialMedia?.instagram || ''}
              onChangeText={(text) => handleChange('socialMedia.instagram', text)}
              placeholder="Your Instagram username"
            />
            
            <Text style={styles.label}>Facebook</Text>
            <TextInput
              style={styles.input}
              value={profile.socialMedia?.facebook || ''}
              onChangeText={(text) => handleChange('socialMedia.facebook', text)}
              placeholder="Your Facebook profile"
            />
          </View>
          
          <TouchableOpacity
            style={[styles.saveButton, isSaving && styles.disabledButton]}
            onPress={handleSave}
            disabled={isSaving}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.saveButtonText}>Save Changes</Text>
            )}
          </TouchableOpacity>
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
  keyboardAvoidContainer: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#4CAF50',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    marginTop: 10,
    fontSize: 16,
    color: '#f44336',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  avatarSection: {
    alignItems: 'center',
    marginVertical: 20,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#eee',
  },
  changeAvatarButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginTop: 10,
  },
  changeAvatarText: {
    color: '#fff',
    marginLeft: 8,
    fontWeight: '600',
  },
  formSection: {
    padding: 16,
    borderTopWidth: 8,
    borderTopColor: '#f0f0f0',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  requiredText: {
    color: '#f44336',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#333',
    backgroundColor: '#f9f9f9',
    marginBottom: 16,
  },
  disabledInput: {
    backgroundColor: '#eee',
    color: '#999',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  saveButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 16,
    borderRadius: 8,
    marginHorizontal: 16,
    marginTop: 20,
    marginBottom: 40,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  disabledButton: {
    opacity: 0.7,
  },
});

export default EditProfileScreen;