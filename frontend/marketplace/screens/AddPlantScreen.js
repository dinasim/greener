import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TextInput, 
  TouchableOpacity, 
  ScrollView, 
  Image,
  Platform,
  KeyboardAvoidingView
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

// Import our placeholder map component
import MapView, { Marker } from '../components/maps';

const AddPlantScreen = ({ navigation }) => {
  // Form state
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Houseplant');
  const [condition, setCondition] = useState('Healthy');
  const [images, setImages] = useState([]);
  const [location, setLocation] = useState({
    latitude: 32.0853,
    longitude: 34.8461,
  });

  // Categories for plants
  const categories = [
    'Houseplant', 
    'Succulent', 
    'Cactus', 
    'Flowering', 
    'Tropical', 
    'Herb', 
    'Tree/Shrub', 
    'Other'
  ];

  // Conditions for plants
  const conditions = [
    'Healthy', 
    'Needs Care', 
    'Young/Seedling', 
    'Mature', 
    'Flowering'
  ];

  // Handle image picking
  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      // Add the new image to the images array
      setImages([...images, result.assets[0].uri]);
    }
  };

  // Handle form submission
  const handleSubmit = () => {
    // Validate form
    if (!title || !price || !description || images.length === 0) {
      alert('Please fill out all fields and add at least one image');
      return;
    }

    // Create plant object
    const plantData = {
      title,
      price: parseFloat(price),
      description,
      category,
      condition,
      images,
      location,
      createdAt: new Date().toISOString(),
      seller: {
        id: 'user123', // This would come from authentication
        name: 'Current User', // This would come from authentication
      },
    };

    console.log('Submitting plant:', plantData);
    
    // Here you would normally submit the data to your backend
    // For now, let's just navigate back to the marketplace
    navigation.navigate('Marketplace');
  };

  // Handle location selection on map
  const handleMapPress = (event) => {
    setLocation(event.nativeEvent.coordinate);
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView style={styles.container}>
        <Text style={styles.title}>Add a New Plant</Text>
        
        {/* Plant Images */}
        <View style={styles.imageSection}>
          <Text style={styles.sectionTitle}>Plant Images</Text>
          <ScrollView horizontal={true} style={styles.imageScroller}>
            {images.map((uri, index) => (
              <View key={index} style={styles.imageContainer}>
                <Image source={{ uri }} style={styles.plantImage} />
                <TouchableOpacity 
                  style={styles.removeImageButton}
                  onPress={() => setImages(images.filter((_, i) => i !== index))}
                >
                  <MaterialIcons name="close" size={20} color="white" />
                </TouchableOpacity>
              </View>
            ))}
            
            <TouchableOpacity style={styles.addImageButton} onPress={pickImage}>
              <MaterialIcons name="add-a-photo" size={30} color="#228B22" />
              <Text style={styles.addImageText}>Add Photo</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
        
        {/* Basic Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Basic Information</Text>
          
          <Text style={styles.label}>Title</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="What kind of plant is it?"
            maxLength={50}
          />
          
          <Text style={styles.label}>Price</Text>
          <TextInput
            style={styles.input}
            value={price}
            onChangeText={setPrice}
            placeholder="How much are you selling it for?"
            keyboardType="numeric"
          />
          
          <Text style={styles.label}>Category</Text>
          <View style={styles.optionsContainer}>
            {categories.map((cat) => (
              <TouchableOpacity 
                key={cat}
                style={[
                  styles.optionButton,
                  category === cat && styles.selectedOption
                ]}
                onPress={() => setCategory(cat)}
              >
                <Text 
                  style={[
                    styles.optionText,
                    category === cat && styles.selectedOptionText
                  ]}
                >
                  {cat}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          
          <Text style={styles.label}>Condition</Text>
          <View style={styles.optionsContainer}>
            {conditions.map((cond) => (
              <TouchableOpacity 
                key={cond}
                style={[
                  styles.optionButton,
                  condition === cond && styles.selectedOption
                ]}
                onPress={() => setCondition(cond)}
              >
                <Text 
                  style={[
                    styles.optionText,
                    condition === cond && styles.selectedOptionText
                  ]}
                >
                  {cond}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        
        {/* Description */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Description</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={description}
            onChangeText={setDescription}
            placeholder="Describe your plant (size, age, care instructions, etc.)"
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>
        
        {/* Location */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pickup Location</Text>
          <Text style={styles.mapInstructions}>Tap on the map to set your location</Text>
          
          {/* This is our placeholder map component */}
          <View style={styles.mapContainer}>
            <MapView
              style={styles.map}
              initialRegion={{
                latitude: location.latitude,
                longitude: location.longitude,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
              }}
              onPress={handleMapPress}
            >
              <Marker coordinate={location} />
            </MapView>
          </View>
        </View>
        
        {/* Submit Button */}
        <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
          <Text style={styles.submitButtonText}>List Plant for Sale</Text>
        </TouchableOpacity>
        
        {/* Spacing at the bottom */}
        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#228B22',
    marginBottom: 16,
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
  imageSection: {
    marginBottom: 24,
  },
  imageScroller: {
    flexDirection: 'row',
  },
  imageContainer: {
    position: 'relative',
    marginRight: 12,
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
    color: '#228B22',
  },
  label: {
    fontSize: 16,
    marginBottom: 8,
    color: '#444',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
    backgroundColor: '#f9f9f9',
  },
  textArea: {
    height: 120,
    textAlignVertical: 'top',
  },
  optionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  optionButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ddd',
    marginRight: 8,
    marginBottom: 8,
    backgroundColor: '#f9f9f9',
  },
  selectedOption: {
    backgroundColor: '#228B22',
    borderColor: '#228B22',
  },
  optionText: {
    color: '#444',
  },
  selectedOptionText: {
    color: 'white',
  },
  mapContainer: {
    height: 200,
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 16,
  },
  map: {
    flex: 1,
  },
  mapInstructions: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    fontStyle: 'italic',
  },
  submitButton: {
    backgroundColor: '#228B22',
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  submitButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default AddPlantScreen;