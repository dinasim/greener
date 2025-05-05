import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, FlatList, TouchableOpacity, Image,
  SafeAreaView, StyleSheet, ActivityIndicator, Alert, Platform
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';

const PLANT_SEARCH_URL = 'https://usersfunctions.azurewebsites.net/api/plant_search';
const PLANTNET_PROXY_URL = 'https://usersfunctions.azurewebsites.net/api/identifyPlantPhoto';

export default function AddPlantScreen({ navigation }) {
  const [searchType, setSearchType] = useState(null);
  const [query, setQuery] = useState('');
  const [plants, setPlants] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadCosmosPlants = async () => {
    if (!query || loading) return;
    setLoading(true);

    try {
      const response = await fetch(`${PLANT_SEARCH_URL}?name=${encodeURIComponent(query)}`);
      const data = await response.json();

      const parsed = data.map((p) => ({
        id: p.id || p.common_name,
        ...p,
        image_url: null,
        family_common_name: p.origin
      }));

      setPlants(parsed);
    } catch (error) {
      console.error('Cosmos DB search error:', error);
      Alert.alert('Error', 'Failed to search for plants.');
    }

    setLoading(false);
  };

  const handlePhotoSearch = async () => {
    if (Platform.OS === 'web') {
      document.getElementById('web-file-input').click();
      return;
    }

    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert('Permission Required', 'Access to media library is required!');
      return;
    }

    const pickerResult = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: false,
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      base64: false,
    });

    if (pickerResult.canceled) return;

    const uri = pickerResult.assets?.[0]?.uri;
    if (!uri) {
      Alert.alert('Error', 'No image selected.');
      return;
    }

    const filename = uri.split('/').pop();
    const match = /\.(\w+)$/.exec(filename ?? '');
    const type = match ? `image/${match[1]}` : `image/jpeg`;

    const formData = new FormData();
    formData.append('images', {
      uri,
      name: filename ?? 'photo.jpg',
      type,
    });
    formData.append('organs', 'leaf');

    setLoading(true);

    try {
      const res = await fetch(PLANTNET_PROXY_URL, {
        method: 'POST',
        body: formData,
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text);
      }

      const data = await res.json();
      const results = data.results || [];

      const parsed = results.map((r) => ({
        id: r.species?.scientificNameWithoutAuthor || Math.random().toString(),
        common_name: r.species?.commonNames?.[0],
        scientific_name: r.species?.scientificNameWithoutAuthor,
        image_url: r.images?.[0]?.url?.m || null,
        family_common_name: r.species?.family?.scientificNameWithoutAuthor,
      }));

      setPlants(parsed);
    } catch (err) {
      console.error('PlantNet error:', err);
      Alert.alert('Error', 'Failed to identify plant.\n' + err.message);
    }

    setLoading(false);
  };

  const handleWebFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('images', file);
    formData.append('organs', 'leaf');

    setLoading(true);

    try {
      const res = await fetch(PLANTNET_PROXY_URL, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text);
      }

      const data = await res.json();
      const results = data.results || [];

      const parsed = results.map((r) => ({
        id: r.species?.scientificNameWithoutAuthor || Math.random().toString(),
        common_name: r.species?.commonNames?.[0],
        scientific_name: r.species?.scientificNameWithoutAuthor,
        image_url: r.images?.[0]?.url?.m || null,
        family_common_name: r.species?.family?.scientificNameWithoutAuthor,
      }));

      setPlants(parsed);
    } catch (err) {
      console.error('PlantNet error:', err);
      Alert.alert('Error', 'Failed to identify plant.\n' + err.message);
    }

    setLoading(false);
  };

  const renderCard = ({ item }) => (
    <View style={styles.card}>
      {item.image_url ? (
        <Image source={{ uri: item.image_url }} style={styles.cardImage} />
      ) : (
        <View style={[styles.cardImage, styles.placeholderImage]}>
          <Text style={styles.placeholderText}>No image</Text>
        </View>
      )}
      <View style={styles.cardContent}>
        <Text style={styles.cardTitle}>{item.common_name || item.scientific_name}</Text>
        <Text style={styles.cardSubtitle}>Origin: {item.family_common_name || 'N/A'}</Text>
        <TouchableOpacity style={styles.cardButton} onPress={() => navigation.navigate('PlantDetailScreen', { plant: item })}>
          <Text style={styles.cardButtonText}>View</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.header}>Add a Plant</Text>

      <View style={styles.buttonRow}>
        <TouchableOpacity style={styles.button} onPress={() => { setSearchType('name'); setPlants([]); }}>
          <Text style={styles.buttonText}>Search by Name</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.button} onPress={() => { setSearchType('photo'); setPlants([]); handlePhotoSearch(); }}>
          <Text style={styles.buttonText}>Search by Photo</Text>
        </TouchableOpacity>
        {Platform.OS === 'web' && (
          <input
            id="web-file-input"
            type="file"
            accept="image/*"
            onChange={handleWebFileUpload}
            style={{ display: 'none' }}
          />
        )}
      </View>

      {searchType === 'name' && (
        <View style={styles.searchSection}>
          <TextInput
            placeholder="Enter plant name"
            value={query}
            onChangeText={setQuery}
            style={styles.input}
          />
          <TouchableOpacity style={styles.searchButton} onPress={loadCosmosPlants}>
            <Text style={styles.searchButtonText}>Search</Text>
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={plants}
        renderItem={renderCard}
        keyExtractor={(item, index) => item.id || index.toString()}
        contentContainerStyle={{ paddingBottom: 100 }}
        ListFooterComponent={loading ? <ActivityIndicator size="large" color="#4CAF50" /> : null}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#f0fdf4' },
  header: { fontSize: 26, fontWeight: 'bold', textAlign: 'center', marginBottom: 16 },
  buttonRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 16 },
  button: { backgroundColor: '#4CAF50', padding: 12, borderRadius: 10 },
  buttonText: { color: '#fff', fontWeight: 'bold' },
  searchSection: { marginBottom: 16 },
  input: { backgroundColor: '#fff', padding: 10, borderRadius: 10, marginBottom: 8, borderWidth: 1, borderColor: '#ccc' },
  searchButton: { backgroundColor: '#2e7d32', padding: 12, borderRadius: 10, alignItems: 'center' },
  searchButtonText: { color: '#fff', fontWeight: 'bold' },
  card: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 12, marginBottom: 12, elevation: 3 },
  cardImage: { width: 100, height: 100, borderTopLeftRadius: 12, borderBottomLeftRadius: 12 },
  placeholderImage: { backgroundColor: '#eee', justifyContent: 'center', alignItems: 'center' },
  placeholderText: { color: '#888', fontSize: 12 },
  cardContent: { flex: 1, padding: 10, justifyContent: 'center' },
  cardTitle: { fontSize: 16, fontWeight: 'bold' },
  cardSubtitle: { fontSize: 14, color: '#555', marginVertical: 4 },
  cardButton: { backgroundColor: '#388E3C', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, alignSelf: 'flex-start' },
  cardButtonText: { color: '#fff', fontWeight: 'bold' },
});
