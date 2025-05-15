// screens/AddPlantScreen.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  Modal,
  FlatList,
} from 'react-native';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { uploadImage } from '../services/marketplaceApi'; 


// Import components
import MarketplaceHeader from '../components/MarketplaceHeader';

// Import services
import { createPlant } from '../services/marketplaceApi';
import { getAddPlantCategories } from '../services/categories';

// Simulated scientific names data
// In a real app, this would be fetched from your Plants database
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
  
  const [isLoading, setIsLoading] = useState(false);
  const [images, setImages] = useState([]);
  const [formData, setFormData] = useState({
    title: '',
    price: '',
    category: 'Indoor Plants',
    description: '',
    careInstructions: '',
    city: '',
    scientificName: '', 
  });

  const [formErrors, setFormErrors] = useState({
    title: '',
    price: '',
    description: '',
    city: '',
    images: '',
  });

  const [showScientificNameModal, setShowScientificNameModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredScientificNames, setFilteredScientificNames] = useState(SCIENTIFIC_NAMES);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);

  // Load plant categories
  const categories = getAddPlantCategories();
  
  // Prefill city if available
  useEffect(() => {
    const loadUserLocation = async () => {
      try {
        const userProfile = await AsyncStorage.getItem('userProfile');
        if (userProfile) {
          const profile = JSON.parse(userProfile);
          if (profile.location) {
            setFormData(prevData => ({
              ...prevData,
              city: profile.location
            }));
          }
        }
      } catch (error) {
        console.error('Error loading user location:', error);
      }
    };
    
    loadUserLocation();
  }, []);
  
  // Filter scientific names when search query changes
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredScientificNames(SCIENTIFIC_NAMES);
    } else {
      const lowercaseQuery = searchQuery.toLowerCase();
      const filtered = SCIENTIFIC_NAMES.filter(
        plant => 
          plant.name.toLowerCase().includes(lowercaseQuery) ||
          plant.common.toLowerCase().includes(lowercaseQuery)
      );
      setFilteredScientificNames(filtered);
    }
  }, [searchQuery]);

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
        mediaTypes: ImagePicker.MediaType.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        selectionLimit: images.length < 4 ? 5 - images.length : 0, // NEW key for RN Web & Native
      });
  
      if (!result.canceled && result.assets?.length > 0) {
        if (images.length + result.assets.length > 5) {
          Alert.alert('Too Many Images', 'You can only upload up to 5 images');
          return;
        }
  
        const newImages = [...images];
  
        for (const asset of result.assets) {
          const imageUri = asset.uri;
  
          if (Platform.OS !== 'web') {
            const fileInfo = await FileSystem.getInfoAsync(imageUri);
            if (fileInfo.size > 5 * 1024 * 1024) {
              Alert.alert('Image Too Large', 'Please select images smaller than 5MB');
              continue;
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
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };
  

  const takePhoto = async () => {
    try {
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Permission Required', 'We need camera permission to take photos');
        return;
      }
      
      if (images.length >= 5) {
        Alert.alert('Too Many Images', 'You can only upload up to 5 images');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets?.length > 0) {
        const imageUri = result.assets[0].uri;
        
        if (Platform.OS !== 'web') {
          const fileInfo = await FileSystem.getInfoAsync(imageUri);
          const fileSize = fileInfo.size;
          
          if (fileSize > 5 * 1024 * 1024) {
            Alert.alert('Image Too Large', 'Please select an image smaller than 5MB');
            return;
          }
        }
        
        setImages([...images, imageUri]);

        if (formErrors.images) {
          setFormErrors({ ...formErrors, images: '' });
        }
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo. Please try again.');
    }
  };

  const removeImage = (index) => {
    const newImages = [...images];
    newImages.splice(index, 1);
    setImages(newImages);
  };

  const selectScientificName = (item) => {
    setFormData({
      ...formData,
      scientificName: item.name,
      // Optionally set the title if it's empty
      title: formData.title || item.common
    });
    setShowScientificNameModal(false);
  };

  const useCurrentLocation = async () => {
    setIsLoadingLocation(true);
    try {
      // In a real app, you would use something like expo-location to get the current position
      // For this demo, we'll simulate it with a timeout and hardcoded location
      setTimeout(() => {
        const location = "Tel Aviv, Israel";
        setFormData({ ...formData, city: location });
        setIsLoadingLocation(false);
      }, 1000);
    } catch (error) {
      console.error('Error getting location:', error);
      Alert.alert('Location Error', 'Could not get your current location. Please enter it manually.');
      setIsLoadingLocation(false);
    }
  };

  const validateForm = () => {
    const errors = {};
    let isValid = true;

    if (!formData.title.trim()) {
      errors.title = 'Plant name is required';
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

    if (!formData.city.trim()) {
      errors.city = 'Location is required';
      isValid = false;
    }

    if (images.length === 0) {
      errors.images = 'Please add at least one image';
      isValid = false;
    }

    setFormErrors(errors);
    return isValid;
  };


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
  

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setIsLoading(true);

    try {
      // Get the user's email from AsyncStorage
      const userEmail = await AsyncStorage.getItem('userEmail');
      
      if (!userEmail) {
        throw new Error('User is not authenticated');
      }

      // Prepare image data
      const imageData = await prepareImageData();
      
      // Prepare plant data
      const plantData = {
        title: formData.title,
        price: parseFloat(formData.price),
        category: formData.category,
        description: formData.description,
        city: formData.city,
        careInstructions: formData.careInstructions,
        scientificName: formData.scientificName,
        image: imageData[0],  // Main image
        images: imageData.slice(1),  // Additional images
        sellerId: userEmail, // Use the authenticated user's email as sellerId
      };

      // Submit to API
      const result = await createPlant(plantData);

      if (result?.productId) {
        Alert.alert('Success', 'Your plant has been listed!', [
          {
            text: 'View Listing',
            onPress: () => navigation.navigate('PlantDetail', { plantId: result.productId }),
          },
          {
            text: 'Go to Marketplace',
            onPress: () => navigation.navigate('MarketplaceHome'),
          },
        ]);
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

  // Render Scientific Name Modal
  const renderScientificNameModal = () => {
    return (
      <Modal
        visible={showScientificNameModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowScientificNameModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select a Plant Type</Text>
              <TouchableOpacity 
                onPress={() => setShowScientificNameModal(false)}
                style={styles.closeButton}
              >
                <MaterialIcons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.searchContainer}>
              <MaterialIcons name="search" size={20} color="#999" style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search by common or scientific name"
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoFocus={true}
              />
              {searchQuery ? (
                <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}>
                  <MaterialIcons name="clear" size={20} color="#999" />
                </TouchableOpacity>
              ) : null}
            </View>
            
            <FlatList
              data={filteredScientificNames}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity 
                  style={styles.nameItem}
                  onPress={() => selectScientificName(item)}
                >
                  <View>
                    <Text style={styles.commonName}>{item.common}</Text>
                    <Text style={styles.scientificName}>{item.name}</Text>
                  </View>
                  <MaterialIcons name="chevron-right" size={24} color="#999" />
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={styles.emptyList}>
                  <Text style={styles.emptyText}>No plants found matching your search</Text>
                </View>
              }
            />
          </View>
        </View>
      </Modal>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <MarketplaceHeader
        title="Add New Plant"
        showBackButton={true}
        onNotificationsPress={() => navigation.navigate('Messages')}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidingView}
      >
        <ScrollView style={styles.scrollView}>
          <View style={styles.content}>
            <Text style={styles.title}>Add a New Plant</Text>
            
            {/* Image Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Plant Images</Text>
              <ScrollView horizontal style={styles.imageScroller}>
                {images.map((uri, index) => (
                  <View key={index} style={styles.imageContainer}>
                    <Image source={{ uri }} style={styles.plantImage} />
                    <TouchableOpacity
                      style={styles.removeImageButton}
                      onPress={() => removeImage(index)}
                    >
                      <MaterialIcons name="close" size={20} color="white" />
                    </TouchableOpacity>
                  </View>
                ))}
                
                {images.length < 5 && (
                  <View style={styles.imageActionButtons}>
                    <TouchableOpacity style={styles.addImageButton} onPress={pickImage}>
                      <MaterialIcons name="add-photo-alternate" size={30} color="#4CAF50" />
                      <Text style={styles.addImageText}>Gallery</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity style={styles.addImageButton} onPress={takePhoto}>
                      <MaterialIcons name="camera-alt" size={30} color="#4CAF50" />
                      <Text style={styles.addImageText}>Camera</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </ScrollView>
              
              {formErrors.images ? (
                <Text style={styles.errorText}>{formErrors.images}</Text>
              ) : (
                <Text style={styles.helperText}>
                  Add up to 5 images. First image will be the main image.
                </Text>
              )}
            </View>
            
            {/* Basic Info */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Basic Information</Text>
              
              <Text style={styles.label}>Plant Name</Text>
              <TextInput
                style={[styles.input, formErrors.title && styles.inputError]}
                value={formData.title}
                onChangeText={(text) => handleChange('title', text)}
                placeholder="What kind of plant is it?"
              />
              {formErrors.title ? <Text style={styles.errorText}>{formErrors.title}</Text> : null}

              <Text style={styles.label}>Scientific Name (Optional)</Text>
              <TouchableOpacity 
                style={[
                  styles.input, 
                  styles.pickerButton,
                  formData.scientificName ? styles.filledInput : null
                ]}
                onPress={() => setShowScientificNameModal(true)}
              >
                <Text 
                  style={[
                    styles.pickerButtonText,
                    formData.scientificName ? styles.filledInputText : null
                  ]}
                >
                  {formData.scientificName || "Select plant type to auto-fill care info"}
                </Text>
                <MaterialIcons name="arrow-drop-down" size={24} color="#666" />
              </TouchableOpacity>

              <Text style={styles.label}>Price</Text>
              <TextInput
                style={[styles.input, formErrors.price && styles.inputError]}
                value={formData.price}
                onChangeText={(text) => handleChange('price', text)}
                placeholder="How much are you selling it for?"
                keyboardType="numeric"
              />
              {formErrors.price ? <Text style={styles.errorText}>{formErrors.price}</Text> : null}

              <Text style={styles.label}>Category</Text>
              <ScrollView horizontal style={styles.categoryScroller}>
                {categories.map((category) => (
                  <TouchableOpacity
                    key={category}
                    style={[
                      styles.categoryButton,
                      formData.category === category && styles.selectedCategoryButton,
                    ]}
                    onPress={() => handleChange('category', category)}
                  >
                    <Text
                      style={[
                        styles.categoryText,
                        formData.category === category && styles.selectedCategoryText,
                      ]}
                    >
                      {category}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.label}>Location</Text>
              <View style={styles.locationContainer}>
                <TextInput
                  style={[
                    styles.input, 
                    styles.locationInput, 
                    formErrors.city && styles.inputError
                  ]}
                  value={formData.city}
                  onChangeText={(text) => handleChange('city', text)}
                  placeholder="Where can buyers pick up the plant?"
                />
                <TouchableOpacity 
                  style={styles.locationButton}
                  onPress={useCurrentLocation}
                  disabled={isLoadingLocation}
                >
                  {isLoadingLocation ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <MaterialIcons name="my-location" size={20} color="#fff" />
                  )}
                </TouchableOpacity>
              </View>
              {formErrors.city ? <Text style={styles.errorText}>{formErrors.city}</Text> : null}
            </View>
            
            {/* Description */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Description</Text>
              <TextInput
                style={[styles.input, styles.textArea, formErrors.description && styles.inputError]}
                value={formData.description}
                onChangeText={(text) => handleChange('description', text)}
                placeholder="Describe your plant (size, age, condition, etc.)"
                multiline
              />
              {formErrors.description ? (
                <Text style={styles.errorText}>{formErrors.description}</Text>
              ) : null}
            </View>
            
            {/* Care Instructions */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Care Instructions</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={formData.careInstructions}
                onChangeText={(text) => handleChange('careInstructions', text)}
                placeholder="Share how to care for this plant (optional)"
                multiline
              />
              <Text style={styles.helperText}>
                Providing care instructions can help increase interest in your plant.
                {formData.scientificName ? " Care info will be auto-filled from our database." : ""}
              </Text>
            </View>
            
            {/* Submit */}
            <TouchableOpacity
              style={[styles.submitButton, isLoading && styles.disabledButton]}
              onPress={handleSubmit}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.submitText}>List Plant for Sale</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      
      {/* Scientific Name Selection Modal */}
      {renderScientificNameModal()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#2E7D32',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333',
  },
  imageScroller: {
    flexDirection: 'row',
    marginBottom: 10,
    minHeight: 110,
  },
  imageContainer: {
    position: 'relative',
    marginRight: 10,
  },
  plantImage: {
    width: 100,
    height: 100,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
  },
  removeImageButton: {
    position: 'absolute',
    top: 5,
    right: 5,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageActionButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addImageButton: {
    width: 100,
    height: 100,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ccc',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9f9f9',
    marginRight: 10,
  },
  addImageText: {
    marginTop: 4,
    color: '#4CAF50',
    fontSize: 12,
  },
  label: {
    fontSize: 16,
    marginBottom: 8,
    color: '#555',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
  },
  pickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pickerButtonText: {
    color: '#999',
    fontSize: 16,
  },
  filledInput: {
    borderColor: '#A5D6A7',
    backgroundColor: '#f0f9f0',
  },
  filledInputText: {
    color: '#333',
  },
  inputError: {
    borderColor: '#f44336',
  },
  errorText: {
    color: '#f44336',
    fontSize: 12,
    marginTop: -12,
    marginBottom: 12,
  },
  helperText: {
    color: '#666',
    fontSize: 12,
    marginTop: 4,
    marginBottom: 12,
  },
  textArea: {
    height: 120,
    textAlignVertical: 'top',
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationInput: {
    flex: 1,
    marginBottom: 0,
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
  },
  locationButton: {
    backgroundColor: '#4CAF50',
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    borderTopRightRadius: 8,
    borderBottomRightRadius: 8,
  },
  categoryScroller: {
    marginBottom: 16,
  },
  categoryButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    marginRight: 8,
    marginBottom: 8,
  },
  selectedCategoryButton: {
    backgroundColor: '#C8E6C9',
  },
  categoryText: {
    color: '#333',
  },
  selectedCategoryText: {
    color: '#2E7D32',
    fontWeight: 'bold',
  },
  submitButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  disabledButton: {
    opacity: 0.6,
  },
  submitText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    padding: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#f5f5f5',
    margin: 10,
    borderRadius: 8,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  clearButton: {
    padding: 4,
  },
  nameItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  commonName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  scientificName: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
  emptyList: {
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
});

export default AddPlantScreen