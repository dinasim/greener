import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Image, SafeAreaView, ScrollView, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

export default function AddPlantScreen({ navigation }) {
  const [searchType, setSearchType] = useState(null);
  const [query, setQuery] = useState('');
  const [plantData, setPlantData] = useState(null);

  const handleNameSearch = async () => {
    try {
      const response = await fetch(`https://perenual.com/api/species-list?key=sk-mfnq681121cbef5de10110&q=${query}`);
      const data = await response.json();
      setPlantData(data);
    } catch (error) {
      console.error('Error fetching plant by name:', error);
      Alert.alert('Error', 'Could not find the plant.');
    }
  };

  const handlePhotoSearch = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permissionResult.granted === false) {
      Alert.alert('Permission Required', 'Permission to access camera roll is required!');
      return;
    }

    const pickerResult = await ImagePicker.launchImageLibraryAsync();
    if (pickerResult.cancelled === true) return;

    const formData = new FormData();
    formData.append('organs', 'leaf');
    formData.append('images', {
      uri: pickerResult.uri,
      type: 'image/jpeg',
      name: 'photo.jpg',
    });

    try {
      const response = await fetch('https://my-api.plantnet.org/v2/identify/all?api-key=2b10lLFTZi5uAsfZjCILnsIwie', {
        method: 'POST',
        body: formData,
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      const data = await response.json();
      if (data.results && data.results.length > 0) {
        setPlantData(data.results[0].species);
      } else {
        Alert.alert('No Plant Found', 'Could not identify the plant.');
      }
    } catch (error) {
      console.error('Error identifying plant:', error);
    }
  };

  const handleAddPlant = () => {
    navigation.navigate('PlacePlantScreen', { plantData });
  };

  if (plantData) {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView>
          <Text style={styles.title}>{plantData.common_name || plantData.scientific_name}</Text>
          {plantData.default_image?.original_url && (
            <Image source={{ uri: plantData.default_image.original_url }} style={styles.image} />
          )}
          <Text style={styles.description}>Family: {plantData.family_common_name || plantData.family}</Text>
          <TouchableOpacity style={styles.addButton} onPress={handleAddPlant}>
            <Text style={styles.addButtonText}>Add Plant</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.header}>Add a Plant</Text>
      <View style={styles.buttonRow}>
        <TouchableOpacity style={styles.button} onPress={() => setSearchType('name')}>
          <Text style={styles.buttonText}>Search by Name</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.button} onPress={handlePhotoSearch}>
          <Text style={styles.buttonText}>Search by Photo</Text>
        </TouchableOpacity>
      </View>

      {searchType === 'name' && (
        <View style={styles.searchSection}>
          <TextInput
            placeholder="Enter plant ID"
            style={styles.input}
            value={query}
            onChangeText={setQuery}
          />
          <TouchableOpacity style={styles.searchButton} onPress={handleNameSearch}>
            <Text style={styles.searchButtonText}>Search</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 20 },
  header: { fontSize: 24, fontWeight: 'bold', marginBottom: 20 },
  buttonRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 20 },
  button: { backgroundColor: '#2e7d32', padding: 15, borderRadius: 10 },
  buttonText: { color: '#fff', fontWeight: 'bold' },
  searchSection: { marginTop: 20 },
  input: { borderWidth: 1, borderColor: '#ccc', padding: 10, borderRadius: 10, marginBottom: 10 },
  searchButton: { backgroundColor: '#2e7d32', padding: 15, borderRadius: 10, alignItems: 'center' },
  searchButtonText: { color: '#fff', fontWeight: 'bold' },
  title: { fontSize: 22, fontWeight: 'bold', marginVertical: 20 },
  image: { width: '100%', height: 200, borderRadius: 10, marginBottom: 20 },
  description: { fontSize: 16, marginBottom: 20 },
  addButton: { backgroundColor: '#2e7d32', padding: 15, borderRadius: 10, alignItems: 'center' },
  addButtonText: { color: '#fff', fontWeight: 'bold' },
});
