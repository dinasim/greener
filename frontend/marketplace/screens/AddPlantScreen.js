import React, { useState } from 'react';
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
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';

import MarketplaceHeader from '../components/MarketplaceHeader';
import { createPlant } from '../services/marketplaceApi';

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
  });

  const [formErrors, setFormErrors] = useState({
    title: '',
    price: '',
    description: '',
    city: '',
    images: '',
  });

  const categories = [
    'Indoor Plants',
    'Outdoor Plants',
    'Succulents',
    'Cacti',
    'Flowering Plants',
    'Herbs',
    'Vegetable Plants',
  ];

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
        aspect: [4, 3],
        quality: 0.8,
        allowsMultipleSelection: false,
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
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  const removeImage = (index) => {
    const newImages = [...images];
    newImages.splice(index, 1);
    setImages(newImages);
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

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setIsLoading(true);

    try {
      const plantData = {
        title: formData.title,
        price: parseFloat(formData.price),
        category: formData.category,
        description: formData.description,
        city: formData.city,
        careInstructions: formData.careInstructions,
        image: images[0],
        images: images.length > 1 ? images.slice(1) : [],
        addedAt: new Date().toISOString(),
      };

      const result = await createPlant(plantData);

      if (result?.productId) {
        Alert.alert('Success', 'Your plant has been listed!', [
          {
            text: 'View Listing',
            onPress: () => navigation.navigate('PlantDetail', { plantId: result.productId }),
          },
          {
            text: 'Go to Marketplace',
            onPress: () => navigation.navigate('Marketplace'),
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
                <TouchableOpacity style={styles.addImageButton} onPress={pickImage}>
                  <MaterialIcons name="add-a-photo" size={30} color="#4CAF50" />
                  <Text style={styles.addImageText}>Add Photo</Text>
                </TouchableOpacity>
              </ScrollView>
              {formErrors.images ? (
                <Text style={styles.errorText}>{formErrors.images}</Text>
              ) : null}
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
              <TextInput
                style={[styles.input, formErrors.city && styles.inputError]}
                value={formData.city}
                onChangeText={(text) => handleChange('city', text)}
                placeholder="Where can buyers pick up the plant?"
              />
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
  inputError: {
    borderColor: '#f44336',
  },
  errorText: {
    color: '#f44336',
    fontSize: 12,
    marginTop: -12,
    marginBottom: 12,
  },
  textArea: {
    height: 120,
    textAlignVertical: 'top',
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
});

export default AddPlantScreen;
