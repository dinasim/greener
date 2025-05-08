import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Button, ScrollView, StyleSheet, Alert, TouchableOpacity, ActivityIndicator, Image } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Picker } from '@react-native-picker/picker';
import { useNavigation, useRoute } from '@react-navigation/native';
import { getSpecific, editProduct } from '../services/productData';
import { MaterialIcons } from '@expo/vector-icons';
import SimpleSider from '../components/Siders/SimpleSider';

const EditProduct = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const productId = route.params.plantId;

  const [product, setProduct] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getSpecific(productId)
      .then(res => setProduct(res))
      .catch(err => console.error(err));
  }, [productId]);

  const handleChange = (key, value) => {
    setProduct(prev => ({ ...prev, [key]: value }));
  };

  const handleImagePick = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission required', 'Please grant gallery access.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({ base64: true });
    if (!result.cancelled) {
      handleChange('image', result.base64);
    }
  };

  const handleSubmit = async () => {
    const { _id, title, price, description, city, category, image } = product;
    const payload = { title, price, description, city, category };

    setLoading(true);
    try {
      if (typeof image === 'string' && !image.startsWith('data:')) {
        payload.image = `data:image/jpeg;base64,${image}`;
      } else if (image && image.uri) {
        payload.image = image.uri; // or convert to base64 if needed
      }

      const res = await editProduct(_id, payload);
      if (!res.error) {
        navigation.navigate('ProductDetailsScreen', {
          plantId: _id,
          category,
        });
      } else {
        Alert.alert('Error', res.error.toString());
      }
    } catch (err) {
      console.error('Error editing product:', err);
      Alert.alert('Error', 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <SimpleSider />
      <View style={styles.profileIconContainer}>
        <TouchableOpacity onPress={() => navigation.navigate('ProfileScreen')}>
          <MaterialIcons name="person" size={28} color="#444" />
        </TouchableOpacity>
      </View>
      <Text style={styles.heading}>Edit Plant Listing</Text>

      <TextInput
        style={styles.input}
        placeholder="Title"
        value={product.title}
        onChangeText={text => handleChange('title', text)}
      />
      <TextInput
        style={styles.input}
        placeholder="Price"
        keyboardType="numeric"
        value={product.price}
        onChangeText={text => handleChange('price', text)}
      />
      <TextInput
        style={[styles.input, styles.textArea]}
        placeholder="Description"
        multiline
        numberOfLines={4}
        value={product.description}
        onChangeText={text => handleChange('description', text)}
      />
      <TextInput
        style={styles.input}
        placeholder="City"
        value={product.city}
        onChangeText={text => handleChange('city', text)}
      />
      <Picker
        selectedValue={product.category}
        style={styles.picker}
        onValueChange={value => handleChange('category', value)}
      >
        <Picker.Item label="Choose category..." value="" />
        <Picker.Item label="Cactus" value="cactus" />
        <Picker.Item label="Succulent" value="succulent" />
        <Picker.Item label="Indoor" value="indoor" />
        <Picker.Item label="Outdoor" value="outdoor" />
        <Picker.Item label="Seeds" value="seeds" />
        <Picker.Item label="Flowers" value="flowers" />
        <Picker.Item label="Herbs" value="herbs" />
      </Picker>

      <TouchableOpacity style={styles.imageButton} onPress={handleImagePick}>
        <Text style={styles.imageButtonText}>Pick New Image</Text>
      </TouchableOpacity>

      {product.image && typeof product.image === 'string' && (
        <Image
          source={{ uri: product.image.startsWith('data:') ? product.image : `data:image/jpeg;base64,${product.image}` }}
          style={styles.previewImage}
        />
      )}

      {loading ? (
        <ActivityIndicator size="large" color="#2e7d32" />
      ) : (
        <Button title="Save Changes" onPress={handleSubmit} color="#2e7d32" />
      )}
    </ScrollView>
  );
};

export default EditProduct;

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#fff',
  },
  heading: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#999',
    borderRadius: 6,
    padding: 10,
    marginBottom: 15,
    backgroundColor: '#f9f9f9',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  picker: {
    height: 50,
    marginBottom: 15,
    backgroundColor: '#f0f0f0',
  },
  imageButton: {
    backgroundColor: '#4caf50',
    padding: 12,
    alignItems: 'center',
    borderRadius: 6,
    marginBottom: 15,
  },
  imageButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  previewImage: {
    width: '100%',
    height: 200,
    resizeMode: 'cover',
    marginBottom: 15,
    borderRadius: 8,
  },
  profileIconContainer: {
    alignItems: 'flex-end',
    marginBottom: 10,
  },
});
