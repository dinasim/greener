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
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';

// Mock placeholder for actual API service
const createPlant = async (plantData) => {
  // In a real app, this would be an Azure Function call
  return new Promise((resolve) => {
    // Simulate API delay
    setTimeout(() => {
      resolve({ success: true, plantId: 'new-plant-' + Date.now() });
    }, 1000);
  });
};

const AddPlantScreen = () => {
  const navigation = useNavigation();
  const [isLoading, setIsLoading] = useState(false);
  const [images, setImages] = useState([]);
  const [formData, setFormData] = useState({
    name: '',
    price: '',
    category: 'Indoor Plants',
    description: '',
    careInstructions: '',
    location: '',
  });

  // Categories for plants
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
    setFormData({
      ...formData,
      [key]: value,
    });
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
        quality: 1,
      });
      
      if (!result.canceled && result.assets && result.assets.length > 0) {
        setImages([...images, result.assets[0].uri]);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const removeImage = (index) => {
    const newImages = [...images];
    newImages.splice(index, 1);
    setImages(newImages);
  };

  const validateForm = () => {
    if (!formData.name.trim()) {
      Alert.alert('Error', 'Please enter a plant name');
      return false;
    }
    
    if (!formData.price || isNaN(parseFloat(formData.price))) {
      Alert.alert('Error', 'Please enter a valid price');
      return false;
    }
    
    if (!formData.description.trim()) {
      Alert.alert('Error', 'Please enter a description');
      return false;
    }
    
    if (!formData.location.trim()) {
      Alert.alert('Error', 'Please enter a location');
      return false;
    }
    
    if (images.length === 0) {
      Alert.alert('Error', 'Please add at least one image');
      return false;
    }
    
    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    
    setIsLoading(true);
    
    try {
      // Prepare data for upload
      const plantData = {
        ...formData,
        price: parseFloat(formData.price),
        images: images,
        createdAt: new Date().toISOString(),
      };
      
      // Call Azure Function to create plant
      const result = await createPlant(plantData);
      
      if (result.success) {
        Alert.alert(
          'Success',
          'Your plant has been listed!',
          [
            {
              text: 'View Listing',
              onPress: () => navigation.navigate('PlantDetail', { plantId: result.plantId }),
            },
            {
              text: 'Go to Marketplace',
              onPress: () => navigation.navigate('Marketplace'),
            },
          ]
        );
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
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView>
        <Text style={styles.title}>Add a New Plant</Text>
        
        {/* Plant Images */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Plant Images</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.imageScroller}
          >
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
            
            <TouchableOpacity 
              style={styles.addImageButton} 
              onPress={pickImage}
            >
              <MaterialIcons name="add-a-photo" size={30} color="#4CAF50" />
              <Text style={styles.addImageText}>Add Photo</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
        
        {/* Basic Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Basic Information</Text>
          
          <Text style={styles.label}>Plant Name</Text>
          <TextInput
            style={styles.input}
            value={formData.name}
            onChangeText={(text) => handleChange('name', text)}
            placeholder="What kind of plant is it?"
          />
          
          <Text style={styles.label}>Price</Text>
          <TextInput
            style={styles.input}
            value={formData.price}
            onChangeText={(text) => handleChange('price', text)}
            placeholder="How much are you selling it for?"
            keyboardType="numeric"
          />
          
          <Text style={styles.label}>Category</Text>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            style={styles.categoryScroller}
          >
            {categories.map((category) => (
              <TouchableOpacity 
                key={category}
                style={[
                  styles.categoryButton,
                  formData.category === category && styles.selectedCategoryButton
                ]}
                onPress={() => handleChange('category', category)}
              >
                <Text 
                  style={[
                    styles.categoryText,
                    formData.category === category && styles.selectedCategoryText
                  ]}
                >
                  {category}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          
          <Text style={styles.label}>Location</Text>
          <TextInput
            style={styles.input}
            value={formData.location}
            onChangeText={(text) => handleChange('location', text)}
            placeholder="Where can buyers pick up the plant?"
          />
        </View>
        
        {/* Description */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Description</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={formData.description}
            onChangeText={(text) => handleChange('description', text)}
            placeholder="Describe your plant (size, age, condition, etc.)"
            multiline
            numberOfLines={4}
          />
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
            numberOfLines={4}
          />
        </View>
        
        {/* Submit Button */}
        <TouchableOpacity 
          style={[
            styles.submitButton,
            isLoading && styles.disabledButton
          ]} 
          onPress={handleSubmit}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.submitText}>List Plant for Sale</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 16,
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
    borderWidth: 1,
    borderColor: '#ddd',
  },
  selectedCategoryButton: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },
  categoryText: {
    color: '#333',
  },
  selectedCategoryText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  submitButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginBottom: 30,
  },
  disabledButton: {
    backgroundColor: '#A5D6A7',
  },
  submitText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default AddPlantScreen;