// Business/BusinessScreens/BusinessProfileScreen.js - COMPLETELY REDESIGNED AS PROPER PROFILE SCREEN
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  SafeAreaView,
  StatusBar,
  Image,
  Alert,
  Platform,
  ActivityIndicator,
  TextInput
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';

// Import business services
import { 
  getBusinessProfile, 
  updateBusinessProfile
} from '../services/businessApi';

const DEFAULT_BUSINESS_IMAGE = 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D';

export default function BusinessProfileScreen({ navigation, route }) {
  const [businessProfile, setBusinessProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedProfile, setEditedProfile] = useState({});
  const [isSaving, setIsSaving] = useState(false);

  // Load business profile data
  const loadBusinessProfile = useCallback(async () => {
    try {
      setError(null);
      console.log('🔄 Loading business profile...');
      
      const businessId = await AsyncStorage.getItem('businessId') || 
                         await AsyncStorage.getItem('userEmail');
      
      if (!businessId) {
        setError('Business ID not found. Please log in again.');
        setIsLoading(false);
        return;
      }

      // Load business profile
      const profileData = await getBusinessProfile(businessId);
      
      if (profileData && profileData.success) {
        setBusinessProfile(profileData.business || profileData.profile);
        setEditedProfile(profileData.business || profileData.profile);
      } else {
        // Create basic profile if none exists
        const userEmail = await AsyncStorage.getItem('userEmail');
        const basicProfile = {
          id: businessId,
          email: userEmail,
          businessName: 'My Business',
          businessType: 'Plant Nursery',
          description: '',
          contactPhone: '',
          contactEmail: userEmail,
          website: '',
          logo: '',
          address: {
            street: '',
            city: '',
            postalCode: '',
            country: 'Israel'
          },
          businessHours: [],
          socialMedia: {
            instagram: '',
            facebook: '',
            website: ''
          },
          settings: {
            isPublic: true,
            allowReviews: true,
            showInventory: true
          },
          joinDate: new Date().toISOString(),
          isVerified: false
        };
        setBusinessProfile(basicProfile);
        setEditedProfile(basicProfile);
      }

    } catch (err) {
      console.error('❌ Error loading business profile:', err);
      setError(`Failed to load profile: ${err.message}`);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Handle profile save
  const handleSaveProfile = async () => {
    try {
      setIsSaving(true);
      
      const businessId = await AsyncStorage.getItem('businessId') || 
                         await AsyncStorage.getItem('userEmail');
      
      const updatedProfile = await updateBusinessProfile(businessId, editedProfile);
      
      if (updatedProfile && updatedProfile.success) {
        setBusinessProfile(editedProfile);
        setIsEditing(false);
        Alert.alert('Success', 'Profile updated successfully!');
      } else {
        throw new Error('Failed to update profile');
      }
      
    } catch (error) {
      console.error('❌ Error saving profile:', error);
      Alert.alert('Error', 'Failed to save profile changes. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // Handle image picker
  const handleImagePicker = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setEditedProfile(prev => ({
          ...prev,
          logo: result.assets[0].uri
        }));
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  // Handle field updates
  const handleFieldUpdate = (field, value, nested = null) => {
    setEditedProfile(prev => {
      if (nested) {
        return {
          ...prev,
          [nested]: {
            ...prev[nested],
            [field]: value
          }
        };
      }
      return {
        ...prev,
        [field]: value
      };
    });
  };

  // Handle refresh
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadBusinessProfile();
  }, [loadBusinessProfile]);

  // Load data on mount and focus
  useEffect(() => {
    loadBusinessProfile();
  }, [loadBusinessProfile]);

  useFocusEffect(
    useCallback(() => {
      loadBusinessProfile();
    }, [loadBusinessProfile])
  );

  // Loading state
  if (isLoading && !businessProfile) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#f8f9fa" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text style={styles.loadingText}>Loading your business profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Error state
  if (error && !businessProfile) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#f8f9fa" />
        <View style={styles.errorContainer}>
          <MaterialIcons name="error-outline" size={48} color="#f44336" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadBusinessProfile}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const profile = isEditing ? editedProfile : businessProfile;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8f9fa" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <MaterialIcons name="arrow-back" size={24} color="#4CAF50" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Business Profile</Text>
        <TouchableOpacity 
          style={styles.editButton} 
          onPress={() => {
            if (isEditing) {
              handleSaveProfile();
            } else {
              setIsEditing(true);
            }
          }}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color="#4CAF50" />
          ) : (
            <MaterialIcons 
              name={isEditing ? "save" : "edit"} 
              size={24} 
              color="#4CAF50" 
            />
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Business Logo & Basic Info */}
        <View style={styles.profileCard}>
          <View style={styles.logoSection}>
            <TouchableOpacity 
              style={styles.logoContainer}
              onPress={isEditing ? handleImagePicker : null}
              disabled={!isEditing}
            >
              <Image 
                source={{ 
                  uri: profile?.logo || DEFAULT_BUSINESS_IMAGE 
                }} 
                style={styles.businessLogo}
                onError={() => {
                  if (isEditing) {
                    setEditedProfile(prev => ({ ...prev, logo: DEFAULT_BUSINESS_IMAGE }));
                  }
                }}
              />
              {isEditing && (
                <View style={styles.editLogoOverlay}>
                  <MaterialIcons name="camera-alt" size={24} color="#fff" />
                </View>
              )}
            </TouchableOpacity>
            
            {isEditing ? (
              <TextInput
                style={styles.businessNameInput}
                value={profile?.businessName || ''}
                onChangeText={(text) => handleFieldUpdate('businessName', text)}
                placeholder="Business Name"
                multiline={false}
              />
            ) : (
              <Text style={styles.businessName}>
                {profile?.businessName || 'Business Name'}
              </Text>
            )}
            
            <Text style={styles.businessType}>
              {profile?.businessType || 'Plant Business'}
            </Text>
            
            <Text style={styles.memberSince}>
              Member since {new Date(profile?.joinDate || Date.now()).toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'long' 
              })}
            </Text>
          </View>
        </View>

        {/* Business Description */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="description" size={20} color="#4CAF50" />
            <Text style={styles.sectionTitle}>About Your Business</Text>
          </View>
          {isEditing ? (
            <TextInput
              style={styles.descriptionInput}
              value={profile?.description || ''}
              onChangeText={(text) => handleFieldUpdate('description', text)}
              placeholder="Tell customers about your business..."
              multiline
              numberOfLines={4}
            />
          ) : (
            <Text style={styles.descriptionText}>
              {profile?.description || 'No description provided'}
            </Text>
          )}
        </View>

        {/* Contact Information */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="contact-phone" size={20} color="#4CAF50" />
            <Text style={styles.sectionTitle}>Contact Information</Text>
          </View>
          
          <View style={styles.contactField}>
            <MaterialIcons name="email" size={20} color="#666" />
            {isEditing ? (
              <TextInput
                style={styles.contactInput}
                value={profile?.contactEmail || ''}
                onChangeText={(text) => handleFieldUpdate('contactEmail', text)}
                placeholder="business@example.com"
                keyboardType="email-address"
              />
            ) : (
              <Text style={styles.contactText}>
                {profile?.contactEmail || profile?.email || 'No email provided'}
              </Text>
            )}
          </View>
          
          <View style={styles.contactField}>
            <MaterialIcons name="phone" size={20} color="#666" />
            {isEditing ? (
              <TextInput
                style={styles.contactInput}
                value={profile?.contactPhone || ''}
                onChangeText={(text) => handleFieldUpdate('contactPhone', text)}
                placeholder="+972-XX-XXXXXXX"
                keyboardType="phone-pad"
              />
            ) : (
              <Text style={styles.contactText}>
                {profile?.contactPhone || 'No phone provided'}
              </Text>
            )}
          </View>
          
          <View style={styles.contactField}>
            <MaterialIcons name="language" size={20} color="#666" />
            {isEditing ? (
              <TextInput
                style={styles.contactInput}
                value={profile?.socialMedia?.website || ''}
                onChangeText={(text) => handleFieldUpdate('website', text, 'socialMedia')}
                placeholder="https://www.yourwebsite.com"
                keyboardType="url"
              />
            ) : (
              <Text style={styles.contactText}>
                {profile?.socialMedia?.website || 'No website provided'}
              </Text>
            )}
          </View>
        </View>

        {/* Address */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="location-on" size={20} color="#4CAF50" />
            <Text style={styles.sectionTitle}>Business Address</Text>
          </View>
          
          {isEditing ? (
            <View style={styles.addressForm}>
              <TextInput
                style={styles.addressInput}
                value={profile?.address?.street || ''}
                onChangeText={(text) => handleFieldUpdate('street', text, 'address')}
                placeholder="Street Address"
              />
              <View style={styles.addressRow}>
                <TextInput
                  style={[styles.addressInput, styles.cityInput]}
                  value={profile?.address?.city || ''}
                  onChangeText={(text) => handleFieldUpdate('city', text, 'address')}
                  placeholder="City"
                />
                <TextInput
                  style={[styles.addressInput, styles.postalInput]}
                  value={profile?.address?.postalCode || ''}
                  onChangeText={(text) => handleFieldUpdate('postalCode', text, 'address')}
                  placeholder="Postal Code"
                  keyboardType="numeric"
                />
              </View>
            </View>
          ) : (
            <Text style={styles.addressText}>
              {profile?.address ? 
                `${profile.address.street || ''}, ${profile.address.city || ''} ${profile.address.postalCode || ''}`.trim() || 'No address provided'
                : 'No address provided'
              }
            </Text>
          )}
        </View>

        {/* Social Media */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="share-variant" size={20} color="#4CAF50" />
            <Text style={styles.sectionTitle}>Social Media</Text>
          </View>
          
          <View style={styles.socialField}>
            <MaterialIcons name="instagram" size={20} color="#E4405F" />
            {isEditing ? (
              <TextInput
                style={styles.socialInput}
                value={profile?.socialMedia?.instagram || ''}
                onChangeText={(text) => handleFieldUpdate('instagram', text, 'socialMedia')}
                placeholder="@yourbusiness"
              />
            ) : (
              <Text style={styles.socialText}>
                {profile?.socialMedia?.instagram || 'Not connected'}
              </Text>
            )}
          </View>
          
          <View style={styles.socialField}>
            <MaterialIcons name="facebook" size={20} color="#1877F2" />
            {isEditing ? (
              <TextInput
                style={styles.socialInput}
                value={profile?.socialMedia?.facebook || ''}
                onChangeText={(text) => handleFieldUpdate('facebook', text, 'socialMedia')}
                placeholder="YourBusinessPage"
              />
            ) : (
              <Text style={styles.socialText}>
                {profile?.socialMedia?.facebook || 'Not connected'}
              </Text>
            )}
          </View>
        </View>

        {/* Cancel Edit Button */}
        {isEditing && (
          <TouchableOpacity 
            style={styles.cancelButton}
            onPress={() => {
              setIsEditing(false);
              setEditedProfile(businessProfile);
            }}
          >
            <Text style={styles.cancelButtonText}>Cancel Changes</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#f44336',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  backButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#f0f9f3',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
    textAlign: 'center',
  },
  editButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#f0f9f3',
    minWidth: 40,
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  profileCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  logoSection: {
    alignItems: 'center',
  },
  logoContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  businessLogo: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#e0e0e0',
  },
  editLogoOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#4CAF50',
    borderRadius: 16,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  businessName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 4,
  },
  businessNameInput: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#4CAF50',
    paddingVertical: 4,
    minWidth: 200,
  },
  businessType: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
  },
  memberSince: {
    fontSize: 14,
    color: '#999',
  },
  sectionCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginLeft: 8,
  },
  descriptionText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  descriptionInput: {
    fontSize: 14,
    color: '#333',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  contactField: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  contactText: {
    fontSize: 14,
    color: '#333',
    marginLeft: 12,
    flex: 1,
  },
  contactInput: {
    fontSize: 14,
    color: '#333',
    marginLeft: 12,
    flex: 1,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    paddingVertical: 4,
  },
  addressText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  addressForm: {
    gap: 12,
  },
  addressInput: {
    fontSize: 14,
    color: '#333',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
  },
  addressRow: {
    flexDirection: 'row',
    gap: 12,
  },
  cityInput: {
    flex: 2,
  },
  postalInput: {
    flex: 1,
  },
  socialField: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  socialText: {
    fontSize: 14,
    color: '#333',
    marginLeft: 12,
    flex: 1,
  },
  socialInput: {
    fontSize: 14,
    color: '#333',
    marginLeft: 12,
    flex: 1,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    paddingVertical: 4,
  },
  cancelButton: {
    backgroundColor: '#f44336',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 32,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
