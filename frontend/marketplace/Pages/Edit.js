import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Button,
  ActivityIndicator,
  Alert,
  ScrollView,
  Image,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { getSpecific, editProduct } from '../services/productData';

export default function EditProductScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { id: productId } = route.params;

  const [product, setProduct] = useState({
    title: '',
    price: '',
    description: '',
    city: '',
    category: '',
    image: '',
  });

  const [loading, setLoading] = useState(false);
  const [newImageBase64, setNewImageBase64] = useState(null);
  const [localImageURI, setLocalImageURI] = useState(null);

  useEffect(() => {
    getSpecific(productId)
      .then(res => {
        setProduct(res);
      })
      .catch(err => {
        console.error('Failed to fetch product:', err);
      });
  }, [productId]);

  const handleChange = (key, value) => {
    setProduct(prev => ({ ...prev, [key]: value }));
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      base64: true,
      allowsEditing: true,
      quality: 0.7,
    });

    if (!result.cancelled) {
      setNewImageBase64(result.base64);
      setLocalImageURI(result.uri);
    }
  };

  const handleSubmit = async () => {
    const { _id, title, price, description, city, category } = product;

    if (!title || !price || !description || !city || !category) {
      Alert.alert('Error', 'All fields except image are required.');
      return;
    }

    const updatedProduct = { title, price, description, city, category };

    if (newImageBase64) {
      updatedProduct.image = `data:image/jpeg;base64,${newImageBase64}`;
    }

    try {
      setLoading(true);
      const res = await editProduct(_id, updatedProduct);
      if (res.error) {
        Alert.alert('Error', res.error.toString());
      } else {
        navigation.navigate('ProductDetails', {
          category,
          id: _id,
        });
      }
    } catch (err) {
      console.error('Edit product error:', err);
      Alert.alert('Error', 'Failed to edit product.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.heading}>Edit Product</Text>

      <TextInput
        placeholder="Title"
        style={styles.input}
        value={product.title}
        onChangeText={val => handleChange('title', val)}
      />

      <TextInput
        placeholder="Price"
        style={styles.input}
        keyboardType="numeric"
        value={product.price?.toString()}
        onChangeText={val => handleChange('price', val)}
      />

      <TextInput
        placeholder="Description"
        style={[styles.input, styles.textArea]}
        multiline
        numberOfLines={4}
        value={product.description}
        onChangeText={val => handleChange('description', val)}
      />

      <TextInput
        placeholder="City"
        style={styles.input}
        value={product.city}
        onChangeText={val => handleChange('city', val)}
      />

      <TextInput
        placeholder="Category"
        style={styles.input}
        value={product.category}
        onChangeText={val => handleChange('category', val)}
      />

      <TouchableOpacity onPress={pickImage} style={styles.imageButton}>
        <Text style={styles.imageButtonText}>Pick New Image</Text>
      </TouchableOpacity>

      {localImageURI ? (
        <Image source={{ uri: localImageURI }} style={styles.previewImage} />
      ) : product.image ? (
        <Image source={{ uri: product.image }} style={styles.previewImage} />
      ) : null}

      {loading ? (
        <ActivityIndicator size="large" />
      ) : (
        <Button title="Save Changes" onPress={handleSubmit} />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#fff',
  },
  heading: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#999',
    borderRadius: 5,
    padding: 10,
    marginBottom: 15,
  },
  textArea: {
    height: 100,
  },
  imageButton: {
    backgroundColor: '#333',
    padding: 10,
    marginBottom: 15,
    borderRadius: 5,
  },
  imageButtonText: {
    color: 'white',
    textAlign: 'center',
  },
  previewImage: {
    width: '100%',
    height: 200,
    borderRadius: 5,
    marginBottom: 15,
  },
});
