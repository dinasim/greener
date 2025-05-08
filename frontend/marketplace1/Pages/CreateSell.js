import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Button,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  TouchableOpacity,
  Image
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Picker } from '@react-native-picker/picker';
import { useNavigation } from '@react-navigation/native';
import { createProduct } from '../services/productData'; // Assuming this function is correctly set up for Azure
import SimpleSider from '../components/Siders/SimpleSider';

const CreateSell = () => {
  const navigation = useNavigation();
  const [formData, setFormData] = useState({
    title: '',
    price: '',
    description: '',
    city: '',
    category: '',
    image: null,
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (name, value) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const pickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      alert('Permission to access the photo library is required!');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
    });

    if (!result.cancelled) {
      setFormData(prev => ({ ...prev, image: result.uri }));
    }
  };

  const handleSubmit = async () => {
    if (!formData.title || !formData.price || !formData.category || !formData.city) {
      Alert.alert('Validation Error', 'All fields must be filled!');
      return;
    }

    setLoading(true);
    try {
      // Assuming createProduct sends the form data to your Azure backend
      await createProduct(formData); 
      setLoading(false);
      navigation.navigate('Marketplace'); // Redirect to marketplace or another screen
    } catch (error) {
      setLoading(false);
      Alert.alert('Error', 'An error occurred while creating the product.');
    }
  };

  return (
    <ScrollView style={styles.container}>
      <SimpleSider title="Sell Your Plant" />

      <View style={styles.formGroup}>
        <Text style={styles.label}>Title</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter title"
          value={formData.title}
          onChangeText={(text) => handleChange('title', text)}
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Price</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter price"
          keyboardType="numeric"
          value={formData.price}
          onChangeText={(text) => handleChange('price', text)}
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Description</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter description"
          multiline
          numberOfLines={4}
          value={formData.description}
          onChangeText={(text) => handleChange('description', text)}
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>City</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter city"
          value={formData.city}
          onChangeText={(text) => handleChange('city', text)}
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Category</Text>
        <Picker
          selectedValue={formData.category}
          style={styles.input}
          onValueChange={(itemValue) => handleChange('category', itemValue)}
        >
          <Picker.Item label="Indoor" value="indoor" />
          <Picker.Item label="Outdoor" value="outdoor" />
          <Picker.Item label="Succulent" value="succulent" />
          <Picker.Item label="Flower" value="flower" />
        </Picker>
      </View>

      <View style={styles.formGroup}>
        <TouchableOpacity onPress={pickImage} style={styles.imageButton}>
          <Text style={styles.imageButtonText}>Pick an Image</Text>
        </TouchableOpacity>
        {formData.image && <Image source={{ uri: formData.image }} style={styles.imagePreview} />}
      </View>

      <View style={styles.formGroup}>
        {loading ? (
          <ActivityIndicator size="large" color="#4CAF50" />
        ) : (
          <Button title="Submit" onPress={handleSubmit} />
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#fff',
  },
  formGroup: {
    marginBottom: 15,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 5,
  },
  input: {
    height: 40,
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 5,
    paddingLeft: 10,
    fontSize: 16,
  },
  imageButton: {
    backgroundColor: '#4CAF50',
    padding: 10,
    borderRadius: 5,
    alignItems: 'center',
  },
  imageButtonText: {
    color: '#fff',
    fontSize: 16,
  },
  imagePreview: {
    width: 100,
    height: 100,
    marginTop: 10,
    borderRadius: 5,
  },
});

export default CreateSell;
