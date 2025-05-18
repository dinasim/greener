// screens/AddPlantScreen.js
import React, { useState, useEffect } from 'react';
import {
  View, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Text,
  KeyboardAvoidingView, 
  Platform, 
  SafeAreaView, 
  Alert,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { useNavigation } from '@react-navigation/native';

// Import services
import { createPlant, uploadImage } from '../services/marketplaceApi'; 
import { getAddPlantCategories } from '../services/categories';
import { triggerUpdate, UPDATE_TYPES } from '../services/MarketplaceUpdates';

// Import components
import MarketplaceHeader from '../components/MarketplaceHeader';
import PlantTypeSelector from '../components/plant/PlantTypeSelector';
import PlantImagePicker from '../components/plant/PlantImagePicker';
import BasicInfoForm from '../components/plant/BasicInfoForm';
import LocationPickerIntegration from '../components/plant/LocationPickerIntegration';
import DescriptionForm from '../components/plant/DescriptionForm';
import ScientificNameSelector from '../components/plant/ScientificNameSelector';
import SuccessOverlay from '../components/plant/SuccessOverlay';

// Scientific plant names data
const SCIENTIFIC_NAMES = [
  { id: '1', name: 'Monstera Deliciosa', common: 'Swiss Cheese Plant' },
  { id: '2', name: 'Ficus Lyrata', common: 'Fiddle Leaf Fig' },
  { id: '3', name: 'Sansevieria Trifasciata', common: 'Snake Plant' },
  { id: '4', name: 'Epipremnum Aureum', common: 'Pothos' },
  { id: '5', name: 'Chlorophytum Comosum', common: 'Spider Plant' },
  { id: '6', name: 'Spathiphyllum', common: 'Peace Lily' },
  { id: '7', name: 'Zamioculcas Zamiifolia', common: 'ZZ Plant' },
  { id: '8', name: 'Calathea Orbifolia', common: 'Prayer Plant' },
  { id: '9', name: 'Dracaena Marginata', common: 'Dragon Tree' },
  { id: '10', name: 'Crassula Ovata', common: 'Jade Plant' },
];

const AddPlantScreen = () => {
  const navigation = useNavigation();
  
  // State variables
  const [isLoading, setIsLoading] = useState(false);
  const [isImageLoading, setIsImageLoading] = useState(false);
  const [images, setImages] = useState([]);
  const [listingType, setListingType] = useState('plant');
  const [formData, setFormData] = useState({
    title: '', 
    price: '', 
    category: 'Indoor Plants', 
    description: '', 
    careInstructions: '', 
    scientificName: '', 
    location: {
      city: '',
      street: '',
      houseNumber: '',
      latitude: null,
      longitude: null,
    },
  });
  const [formErrors, setFormErrors] = useState({
    title: '', 
    price: '', 
    description: '', 
    city: '', 
    images: '',
  });
  const [showScientificNameModal, setShowScientificNameModal] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [newPlantId, setNewPlantId] = useState(null);
  
  // Get categories from service
  const categories = getAddPlantCategories();
  
  // Load user location from AsyncStorage
  useEffect(() => {
    const loadUserLocation = async () => {
      try {
        const userProfile = await AsyncStorage.getItem('userProfile');
        if (userProfile) {
          const profile = JSON.parse(userProfile);
          if (profile.location) {
            setFormData(prevData => ({
              ...prevData,
              location: {
                ...prevData.location,
                city: profile.city || '',
                street: profile.street || '',
                houseNumber: profile.houseNumber || ''
              }
            }));
          }
        }
      } catch (error) {
        console.error('Error loading user location:', error);
      }
    };
    loadUserLocation();
  }, []);
  
  // Handle listing type change
  useEffect(() => {
    if (listingType === 'accessory') {
      setFormData(prev => ({
        ...prev,
        category: 'Accessories'
      }));
    } else if (listingType === 'tool') {
      setFormData(prev => ({
        ...prev,
        category: 'Tools'
      }));
    } else {
      if (formData.category === 'Accessories' || formData.category === 'Tools') {
        setFormData(prev => ({
          ...prev,
          category: 'Indoor Plants'
        }));
      }
    }
  }, [listingType]);
  
  // Form field change handler
  const handleChange = (key, value) => {
    if (key.includes('.')) {
      // Handle nested objects like location.city
      const [parent, child] = key.split('.');
      setFormData({ 
        ...formData, 
        [parent]: { 
          ...formData[parent], 
          [child]: value 
        } 
      });
    } else {
      setFormData({ ...formData, [key]: value });
    }
    
    // Clear error when field is changed
    if (formErrors[key]) {
      setFormErrors({ ...formErrors, [key]: '' });
    }
  };
  
  // Location change handler
  const handleLocationChange = (location) => {
    setFormData({
      ...formData,
      location: location
    });
    
    if (formErrors.city && location.city) {
      setFormErrors({
        ...formErrors,
        city: ''
      });
    }
  };
  
  // Scientific name selection handler
  const handleSelectScientificName = (item) => {
    setFormData({
      ...formData,
      scientificName: item.name,
      title: formData.title || item.common
    });
    setShowScientificNameModal(false);
  };
  
  // Camera handler
  const takePhoto = async () => {
    try {
      setIsImageLoading(true);
      
      // Special handling for web platform
      if (Platform.OS === 'web') {
        // Check if the browser supports the MediaDevices API
        if (!navigator?.mediaDevices?.getUserMedia) {
          Alert.alert('Not Supported', 'Your browser does not support camera access. Please use the gallery option instead.', [{ text: 'OK' }]);
          setIsImageLoading(false);
          return;
        }
        
        try {
          // Request camera permissions via browser API
          await navigator.mediaDevices.getUserMedia({ video: true });
          
          // If we get here, permission was granted. Now use ImagePicker
          const result = await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [4, 3],
            quality: 0.8,
          });
          
          if (result.canceled) {
            setIsImageLoading(false);
            return;
          }
          
          const selectedAsset = result.assets?.[0] || { uri: result.uri };
          if (selectedAsset?.uri) {
            setImages([...images, selectedAsset.uri]);
            if (formErrors.images) {
              setFormErrors({ ...formErrors, images: '' });
            }
          }
        } catch (err) {
          console.error('Camera access error:', err);
          Alert.alert('Camera Access Error', 'Could not access your camera. Please check your browser permissions or use the gallery option instead.', [{ text: 'OK' }]);
        }
        setIsImageLoading(false);
        return;
      }
      
      // Original code for native platforms
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Permission Required', 'We need camera permission to take photos', [{ text: 'OK' }]);
        setIsImageLoading(false);
        return;
      }
      
      if (images.length >= 5) {
        Alert.alert('Too Many Images', 'You can only upload up to 5 images', [{ text: 'OK' }]);
        setIsImageLoading(false);
        return;
      }
      
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });
      
      if (result.canceled) {
        setIsImageLoading(false);
        return;
      }
      
      const selectedAsset = result.assets?.[0] || { uri: result.uri };
      if (selectedAsset?.uri) {
        const imageUri = selectedAsset.uri;
        
        if (Platform.OS !== 'web') {
          try {
            const fileInfo = await FileSystem.getInfoAsync(imageUri);
            if (fileInfo.size > 5 * 1024 * 1024) {
              Alert.alert('Image Too Large', 'This image is larger than 5MB. It may upload slowly or fail.',
                [{ text: 'Continue Anyway' }]);
            }
          } catch (e) {
            console.warn('Could not check image size:', e);
          }
        }
        
        setImages([...images, imageUri]);
        if (formErrors.images) {
          setFormErrors({ ...formErrors, images: '' });
        }
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo. Please try again later.', [{ text: 'OK' }]);
    } finally {
      setIsImageLoading(false);
    }
  };
  
  // Gallery image picker handler
  const pickImage = async () => {
    try {
      setIsImageLoading(true);
      
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Permission Required', 'We need permission to access your photos', [{ text: 'OK' }]);
        setIsImageLoading(false);
        return;
      }
      
      if (images.length >= 5) {
        Alert.alert('Too Many Images', 'You can only upload up to 5 images', [{ text: 'OK' }]);
        setIsImageLoading(false);
        return;
      }
      
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        allowsMultipleSelection: Platform.OS === 'ios' || Platform.OS === 'android',
        selectionLimit: images.length < 4 ? 5 - images.length : 1,
      });
      
      if (result.canceled) {
        setIsImageLoading(false);
        return;
      }
      
      const selectedAssets = result.assets || (result.uri ? [{ uri: result.uri }] : []);
      if (selectedAssets.length > 0) {
        if (images.length + selectedAssets.length > 5) {
          Alert.alert('Too Many Images', 'You can only upload up to 5 images. Only the first few will be added.',
            [{ text: 'OK' }]);
          selectedAssets.length = 5 - images.length;
        }
        
        const newImages = [...images];
        for (const asset of selectedAssets) {
          const imageUri = asset.uri;
          if (Platform.OS !== 'web') {
            try {
              const fileInfo = await FileSystem.getInfoAsync(imageUri);
              if (fileInfo.size > 5 * 1024 * 1024) {
                Alert.alert('Image Too Large', 'This image is larger than 5MB. It may upload slowly or fail.',
                  [{ text: 'Continue Anyway' }]);
              }
            } catch (e) {
              console.warn('Could not check image size:', e);
            }
          }
          newImages.push(imageUri);
        }
        
        setImages(newImages);
        if (formErrors.images) {
          setFormErrors({ ...formErrors, images: '' });
        }
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again or use a different image.',
        [{ text: 'OK' }]);
    } finally {
      setIsImageLoading(false);
    }
  };
  
  // Image removal handler
  const removeImage = (index) => {
    const newImages = [...images];
    newImages.splice(index, 1);
    setImages(newImages);
  };
  
  // Form validation
  const validateForm = () => {
    const errors = {};
    let isValid = true;
    
    if (!formData.title.trim()) {
      errors.title = 'Name is required';
      isValid = false;
    } else if (formData.title.length < 3 || formData.title.length > 50) {
      errors.title = 'Name should be between 3 and 50 characters';
      isValid = false;
    }
    
    if (!formData.price) {
      errors.price = 'Price is required';
      isValid = false;
    } else if (isNaN(parseFloat(formData.price)) || parseFloat(formData.price) <= 0) {
      errors.price = 'Please enter a valid price';
      isValid = false;
    }
    
    if (!formData.description.trim()) {
      errors.description = 'Description is required';
      isValid = false;
    } else if (formData.description.length < 10) {
      errors.description = 'Description must be at least 10 characters';
      isValid = false;
    }
    
    if (!formData.location?.city?.trim()) {
      errors.city = 'City is required';
      isValid = false;
    }
    
    if (images.length === 0) {
      errors.images = 'Please add at least one image';
      isValid = false;
    }
    
    setFormErrors(errors);
    return isValid;
  };
  
  // Upload images to server
  const prepareImageData = async () => {
    try {
      const uploaded = [];
      for (const uri of images) {
        const result = await uploadImage(uri, 'plant');
        if (result?.url) uploaded.push(result.url);
      }
      return uploaded;
    } catch (error) {
      console.error('Error uploading images:', error);
      throw new Error('Image upload failed. Please try again.');
    }
  };
  
  // Submit form handler
  const handleSubmit = async () => {
    if (!validateForm()) return;
    
    setIsLoading(true);
    
    try {
      const userEmail = await AsyncStorage.getItem('userEmail') || 'default@example.com';
      if (!userEmail) {
        throw new Error('User is not authenticated');
      }
      
      const imageData = await prepareImageData();
      
      // Prepare location data structure for backend
      const locationData = {
        city: formData.location.city,
        street: formData.location.street,
        houseNumber: formData.location.houseNumber
      };
      
      // If we have coordinates, include them
      if (formData.location?.latitude && formData.location?.longitude) {
        locationData.latitude = formData.location.latitude;
        locationData.longitude = formData.location.longitude;
      }
      
      const plantData = {
        title: formData.title,
        price: parseFloat(formData.price),
        category: formData.category,
        description: formData.description,
        careInstructions: formData.careInstructions,
        scientificName: formData.scientificName,
        image: imageData[0],
        images: imageData.slice(1),
        sellerId: userEmail,
        productType: listingType,
        location: locationData,
      };
      
      const result = await createPlant(plantData);
      
      if (result?.productId) {
        setNewPlantId(result.productId);
        
        // Trigger update to refresh other screens
        await triggerUpdate(UPDATE_TYPES.PRODUCT, {
          productId: result.productId,
          action: 'create',
          category: formData.category,
          seller: userEmail,
          timestamp: Date.now()
        });
        
        // Show success message and navigate back
        setShowSuccess(true);
        setTimeout(() => {
          setShowSuccess(false);
          navigation.navigate('MarketplaceHome', { refresh: true });
          setTimeout(() => {
            navigation.navigate('Profile', { refresh: true });
          }, 300);
        }, 1500);
      } else {
        throw new Error('Failed to create listing');
      }
    } catch (error) {
      console.error('Error creating plant:', error);
      Alert.alert('Error', 'Failed to create listing. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <SafeAreaView style={styles.container}>
      <MarketplaceHeader
        title="Add New Listing"
        showBackButton={true}
        onBackPress={() => navigation.goBack()}
        onNotificationsPress={() => navigation.navigate('Messages')}
      />
      
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
        style={styles.keyboardAvoidingView}
      >
        <ScrollView style={styles.scrollView}>
          <View style={styles.content}>
            {/* Listing Type Selector */}
            <PlantTypeSelector 
              listingType={listingType} 
              onTypeChange={setListingType} 
            />
            
            <Text style={styles.title}>
              Add New {listingType === 'plant' ? 'Plant' : listingType === 'accessory' ? 'Accessory' : 'Tool'}
            </Text>
            
            {/* Image Picker */}
            <PlantImagePicker
              images={images}
              onTakePhoto={takePhoto}
              onPickImage={pickImage}
              onRemoveImage={removeImage}
              isLoading={isImageLoading}
              error={formErrors.images}
            />
            
            {/* Basic Information Form */}
            <BasicInfoForm
              formData={formData}
              formErrors={formErrors}
              onChange={handleChange}
              listingType={listingType}
              categories={categories}
              onScientificNamePress={() => setShowScientificNameModal(true)}
            />
            
            {/* Location Picker */}
            <LocationPickerIntegration
              value={formData.location}
              onChange={handleLocationChange}
              formErrors={formErrors}
            />
            
            {/* Description Form */}
            <DescriptionForm
              formData={formData}
              formErrors={formErrors}
              onChange={handleChange}
              listingType={listingType}
            />
            
            <Text style={styles.requiredNote}>
              <Text style={styles.requiredField}>*</Text> Required fields
            </Text>
            
            {/* Submit Button */}
            <TouchableOpacity 
              style={[styles.submitButton, isLoading && styles.disabledButton]}
              onPress={handleSubmit} 
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.submitText}>
                  List {listingType === 'plant' ? 'Plant' : listingType === 'accessory' ? 'Accessory' : 'Tool'} for Sale
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      
      {/* Scientific Name Selector Modal */}
      <ScientificNameSelector
        visible={showScientificNameModal}
        onClose={() => setShowScientificNameModal(false)}
        onSelect={handleSelectScientificName}
        scientificNames={SCIENTIFIC_NAMES}
      />
      
      {/* Success Overlay */}
      <SuccessOverlay visible={showSuccess} />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#FAFAFA' 
  },
  keyboardAvoidingView: { 
    flex: 1 
  },
  scrollView: { 
    flex: 1 
  },
  content: { 
    padding: 20, 
    paddingBottom: 50 
  },
  title: { 
    fontSize: 26, 
    fontWeight: '700', 
    marginBottom: 20, 
    color: '#1B5E20', 
    textAlign: 'center' 
  },
  requiredField: { 
    color: '#D32F2F', 
    fontWeight: 'bold' 
  },
  requiredNote: { 
    fontSize: 12, 
    color: '#777', 
    marginBottom: 16, 
    marginTop: -8, 
    fontStyle: 'italic' 
  },
  submitButton: { 
    backgroundColor: '#388E3C', 
    paddingVertical: 14, 
    borderRadius: 10, 
    alignItems: 'center' 
  },
  disabledButton: { 
    opacity: 0.6 
  },
  submitText: { 
    color: '#fff', 
    fontSize: 17, 
    fontWeight: '600' 
  },
});

export default AddPlantScreen;