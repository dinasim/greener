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
  Modal,
} from 'react-native';
import { MaterialIcons, Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import * as Animatable from 'react-native-animatable';

import MarketplaceHeader from '../components/MarketplaceHeader';
import { fetchUserProfile, updateUserProfile } from '../services/marketplaceApi';
import config from '../services/config';

const SAMPLE_USER = {
  id: 'user123',
  name: 'Plant Enthusiast',
  email: 'plant.lover@example.com',
  phoneNumber: '+1 (555) 123-4567',
  avatar: 'https://via.placeholder.com/150?text=User',
  bio: 'Passionate plant enthusiast with a love for tropical houseplants.',
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
  const [formErrors, setFormErrors] = useState({});
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    loadUserProfile();
  }, []);

  const loadUserProfile = async () => {
    try {
      setIsLoading(true);
      setError(null);
      let data;
      try {
        data = await fetchUserProfile();
      } catch {
        await new Promise(resolve => setTimeout(resolve, 500));
        data = { user: SAMPLE_USER };
      }

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
      setError('Failed to load profile.');
      setIsLoading(false);
    }
  };

  const handleChange = (key, value) => {
    setFormData({ ...formData, [key]: value });
    if (formErrors[key]) {
      setFormErrors({ ...formErrors, [key]: '' });
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
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (!result.canceled && result.assets?.length > 0) {
        setFormData({ ...formData, avatar: result.assets[0].uri });
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const validateForm = () => {
    const errors = {};
    if (!formData.name.trim()) errors.name = 'Please enter your name';
    else if (formData.name.length < 3 || formData.name.length > 50)
      errors.name = 'Name should be between 3 and 50 characters';

    if (!formData.email.trim()) errors.email = 'Please enter your email';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email))
      errors.email = 'Invalid email format';

    if (!formData.phoneNumber.trim()) errors.phoneNumber = 'Enter your phone number';
    else if (formData.phoneNumber.length < 7)
      errors.phoneNumber = 'Enter a valid phone number';

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;
    try {
      setIsSaving(true);
      const updatedUserData = {
        name: formData.name,
        email: formData.email,
        phoneNumber: formData.phoneNumber,
        bio: formData.bio,
        location: formData.location,
      };
      if (formData.avatar !== user.avatar) {
        updatedUserData.avatar = formData.avatar;
      }

      await updateUserProfile(user.id, updatedUserData);
      await AsyncStorage.setItem('userProfile', JSON.stringify({ ...user, ...updatedUserData }));
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        navigation.goBack();
      }, 1500);
    } catch (err) {
      Alert.alert('Error', 'Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => navigation.goBack();

  const renderSuccessModal = () => (
    <Modal visible={showSuccess} transparent animationType="fade">
      <View style={styles.successOverlay}>
        <Animatable.View animation="zoomIn" style={styles.successContent}>
          <MaterialIcons name="check-circle" size={60} color="#4CAF50" />
          <Text style={styles.successTitle}>Profile Updated</Text>
          <Text style={styles.successText}>Your changes have been saved.</Text>
        </Animatable.View>
      </View>
    </Modal>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <LinearGradient colors={['#4CAF50', '#81C784']}>
          <MarketplaceHeader title="Edit Profile" showBackButton onNotificationsPress={() => navigation.navigate('Messages')} />
        </LinearGradient>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={['#4CAF50', '#81C784']}>
        <MarketplaceHeader title="Edit Profile" showBackButton showNotifications={false} />
      </LinearGradient>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView style={styles.scrollView}>
          <Animatable.View animation="fadeInDown" delay={150} style={styles.avatarContainer}>
            <TouchableOpacity onPress={pickImage}>
              <Image
                source={{ uri: formData.avatar || 'https://via.placeholder.com/150?text=User' }}
                style={styles.avatar}
              />
              <View style={styles.editAvatarButton}>
                <Feather name="camera" size={16} color="#fff" />
              </View>
            </TouchableOpacity>
          </Animatable.View>

          <Animatable.View animation="fadeInUp" delay={300} style={styles.formContainer}>
            {['name', 'email', 'phoneNumber', 'location', 'bio'].map((field, index) => (
              <View key={field} style={styles.formGroup}>
                <Text style={styles.label}>{field.charAt(0).toUpperCase() + field.slice(1)}</Text>
                <TextInput
                  style={[styles.input, formErrors[field] && styles.errorInput, field === 'bio' && styles.textArea]}
                  value={formData[field]}
                  onChangeText={(text) => handleChange(field, text)}
                  placeholder={`Your ${field}`}
                  multiline={field === 'bio'}
                  numberOfLines={field === 'bio' ? 4 : 1}
                  keyboardType={field === 'email' ? 'email-address' : field === 'phoneNumber' ? 'phone-pad' : 'default'}
                />
                {formErrors[field] && <Text style={styles.errorText}>{formErrors[field]}</Text>}
              </View>
            ))}
          </Animatable.View>

          <View style={styles.actionButtons}>
            <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={handleCancel}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.saveButton, isSaving && styles.disabledButton]}
              onPress={handleSave}
              disabled={isSaving}
            >
              {isSaving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveButtonText}>Save</Text>}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {renderSuccessModal()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  scrollView: { padding: 16 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 10, color: '#666' },
  avatarContainer: { alignItems: 'center', marginTop: 20, marginBottom: 30 },
  avatar: { width: 120, height: 120, borderRadius: 60, backgroundColor: '#f0f0f0' },
  editAvatarButton: {
    position: 'absolute', bottom: 0, right: 0, width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#4CAF50', justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: '#fff',
  },
  formContainer: { marginBottom: 20 },
  formGroup: { marginBottom: 16 },
  label: { fontSize: 16, fontWeight: '600', marginBottom: 6, color: '#333' },
  input: {
    borderWidth: 1, borderColor: '#ddd', borderRadius: 8, paddingHorizontal: 12,
    paddingVertical: 10, fontSize: 16, backgroundColor: '#f9f9f9',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1, shadowRadius: 4, elevation: 2,
  },
  textArea: { height: 100, textAlignVertical: 'top' },
  errorInput: { borderColor: '#f44336' },
  errorText: { color: '#f44336', fontSize: 14, marginTop: 2 },
  actionButtons: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 40 },
  button: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  cancelButton: { backgroundColor: '#f5f5f5', marginRight: 8, borderWidth: 1, borderColor: '#ddd' },
  cancelButtonText: { color: '#666', fontSize: 16, fontWeight: '600' },
  saveButton: { backgroundColor: '#4CAF50', marginLeft: 8 },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  disabledButton: { backgroundColor: '#A5D6A7' },
  successOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
  successContent: { backgroundColor: '#fff', padding: 30, borderRadius: 12, alignItems: 'center', width: '80%' },
  successTitle: { fontSize: 22, fontWeight: 'bold', color: '#333', marginTop: 16, marginBottom: 8 },
  successText: { fontSize: 16, color: '#666', textAlign: 'center' },
});

export default EditProfileScreen;
