// AddPlantScreen.js

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  Image,
  SafeAreaView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
  ActionSheetIOS,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons, MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import NavigationBar from '../components/NavigationBar';
import AppHeader from '../components/AppHeader';

const PLANT_SEARCH_URL   = 'https://usersfunctions.azurewebsites.net/api/plant_search';
const PLANTNET_PROXY_URL = 'https://usersfunctions.azurewebsites.net/api/identifyPlantPhoto';

// Fallback list for trending/popular plants
const fallbackPopular = [
  { id: 'Epipremnum aureum', common_name: 'Golden Pothos', scientific_name: 'Epipremnum aureum', family_common_name: 'Araceae', image_url: null },
  { id: 'Sansevieria trifasciata', common_name: "Snake Plant 'Laurentii'", scientific_name: 'Sansevieria trifasciata', family_common_name: 'Asparagaceae', image_url: null },
  { id: 'Monstera deliciosa', common_name: 'Monstera', scientific_name: 'Monstera deliciosa', family_common_name: 'Araceae', image_url: null },
  { id: 'Ocimum basilicum', common_name: 'Basil', scientific_name: 'Ocimum basilicum', family_common_name: 'Lamiaceae', image_url: null },
  { id: 'Zamioculcas zamiifolia', common_name: 'ZZ Plant', scientific_name: 'Zamioculcas zamiifolia', family_common_name: 'Araceae', image_url: null },
];

export default function AddPlantScreen({ navigation }) {
  const [query, setQuery]                 = useState('');
  const [plants, setPlants]               = useState([]);
  const [popularPlants, setPopularPlants] = useState(fallbackPopular);
  const [loading, setLoading]             = useState(false);
  const [searchDone, setSearchDone]       = useState(false);
  const [scanBusy, setScanBusy]           = useState(false);
  const webFileInputRef = useRef(null);

  // Normalize API data
  const normalize = (p) => ({
    id:                  p.id,
    common_name:         p.common_name || '',
    scientific_name:     p.scientific_name || p.latin_name || '',
    image_url:           p.image_url || (Array.isArray(p.image_urls) ? p.image_urls[0] : null) || null,
    family_common_name:  p.family_common_name || p.origin || '',
    care_difficulty:     p.care_difficulty || null,
    shade:               p.shade || null,
    moisture:            p.moisture || null,
    temperature:         p.temperature || null,
  });

  async function fetchByScientificName(name) {
    try {
      const res  = await fetch(`${PLANT_SEARCH_URL}?name=${encodeURIComponent(name)}`);
      const data = await res.json();
      const match = data.find((p) => p.scientific_name === name);
      return match ? normalize(match) : null;
    } catch {
      return null;
    }
  }

  useEffect(() => {
    (async () => {
      setLoading(true);
      const results = await Promise.all(
        fallbackPopular.map(async (stub) => (await fetchByScientificName(stub.scientific_name)) || stub)
      );
      setPopularPlants(results);
      setLoading(false);
    })();
  }, []);

  // Search by text
  const loadCosmosPlants = async () => {
    if (!query.trim() || loading || scanBusy) return;
    setLoading(true);
    setSearchDone(false);
    try {
      const res  = await fetch(`${PLANT_SEARCH_URL}?name=${encodeURIComponent(query)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setPlants(data.map(normalize));
      setSearchDone(true);
    } catch (e) {
      console.warn('plant search error:', e);
      Alert.alert('Error', 'Failed to search for plants.');
    } finally {
      setLoading(false);
    }
  };

  // Native (iOS/Android) upload
  const processFileNative = async (uri) => {
    const filename = uri.split('/').pop();
    const extMatch = /\.(\w+)$/.exec(filename);
    const type     = extMatch ? `image/${extMatch[1]}` : 'image/jpeg';
    const form = new FormData();
    form.append('images', { uri, name: filename, type });
    form.append('organs', 'leaf');
    const resp = await fetch(PLANTNET_PROXY_URL, { method: 'POST', body: form });
    if (!resp.ok) throw new Error(await resp.text());
    return resp.json();
  };

  const identifyAndShow = async (uri) => {
    const json = await processFileNative(uri);
    const results = json.results || [];
    setPlants(results.map((r) => ({
      id:                 r.species?.scientificNameWithoutAuthor || Math.random().toString(),
      common_name:        r.species?.commonNames?.[0] || '',
      scientific_name:    r.species?.scientificNameWithoutAuthor,
      image_url:          r.images?.[0]?.url?.o || r.images?.[0]?.url?.m || r.images?.[0]?.url?.s || null,
      family_common_name: r.species?.family?.scientificNameWithoutAuthor,
    })));
    setSearchDone(true);
  };

  // Choose camera or library
  const handlePhotoSearch = async () => {
    if (Platform.OS === 'web') {
      webFileInputRef.current?.click();
      return;
    }

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ['Cancel', 'Take Photo', 'Choose from Library'], cancelButtonIndex: 0 },
        async (i) => { if (i === 1) await pickFromCamera(); if (i === 2) await pickFromLibrary(); }
      );
      return;
    }

    Alert.alert('Scan a plant', 'Choose a source', [
      { text: 'Camera', onPress: pickFromCamera },
      { text: 'Photo Library', onPress: pickFromLibrary },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const pickFromCamera = async () => {
    try {
      setScanBusy(true);
      setLoading(true);
      setSearchDone(false);
      setPlants([]);

      const camPerm = await ImagePicker.requestCameraPermissionsAsync();
      if (!camPerm.granted) {
        Alert.alert('Permission required', 'Please allow camera access.');
        return;
      }

      const res = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.9,
      });
      if (res.canceled) return;
      const uri = res.assets?.[0]?.uri;
      if (!uri) return;

      await identifyAndShow(uri);
    } catch (err) {
      Alert.alert('Error', 'Failed to take/identify photo.\n' + err.message);
    } finally {
      setScanBusy(false);
      setLoading(false);
    }
  };

  const pickFromLibrary = async () => {
    try {
      setScanBusy(true);
      setLoading(true);
      setSearchDone(false);
      setPlants([]);

      const libPerm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!libPerm.granted) {
        Alert.alert('Permission required', 'Please allow photo access.');
        return;
      }

      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.9,
      });
      if (res.canceled) return;
      const uri = res.assets?.[0]?.uri;
      if (!uri) return;

      await identifyAndShow(uri);
    } catch (err) {
      Alert.alert('Error', 'Failed to pick/identify photo.\n' + err.message);
    } finally {
      setScanBusy(false);
      setLoading(false);
    }
  };

  // Web upload
  const handleWebFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setScanBusy(true);
    setLoading(true);
    setSearchDone(false);
    setPlants([]);
    const form = new FormData();
    form.append('images', file, file.name);
    form.append('organs', 'leaf');
    try {
      const resp = await fetch(PLANTNET_PROXY_URL, { method: 'POST', body: form });
      if (!resp.ok) throw new Error(await resp.text());
      const json = await resp.json();
      const results = json.results || [];
      setPlants(results.map((r) => ({
        id:                 r.species?.scientificNameWithoutAuthor || Math.random().toString(),
        common_name:        r.species?.commonNames?.[0] || '',
        scientific_name:    r.species?.scientificNameWithoutAuthor,
        image_url:          r.images?.[0]?.url?.o || r.images?.[0]?.url?.m || r.images?.[0]?.url?.s || null,
        family_common_name: r.species?.family?.scientificNameWithoutAuthor,
      })));
      setSearchDone(true);
    } catch (err) {
      Alert.alert('Error', 'Failed to identify plant.\n' + err.message);
    } finally {
      setScanBusy(false);
      setLoading(false);
      e.target.value = '';
    }
  };

  const onAdd = (item) => {
    navigation.navigate('PlantReview', { plant: item });
  };

  const CareIcons = (p) => {
    const col = (v, c) => (v ? c : '#ccc');
    return (
      <View style={styles.iconRow}>
        {p.care_difficulty ? (
          <View
            style={[
              styles.tag,
              p.care_difficulty === 'Easy'
                ? styles.tagEasy
                : p.care_difficulty === 'Moderate'
                ? styles.tagModerate
                : styles.tagHard,
            ]}
          >
            <Text style={styles.tagText}>{p.care_difficulty}</Text>
          </View>
        ) : null}
        <MaterialIcons name="wb-sunny" size={18} color={col(p.shade, '#f39c12')} style={styles.icon} />
        <Ionicons name="water" size={18} color={col(p.moisture, '#3498db')} style={styles.icon} />
        <FontAwesome5 name="thermometer-half" size={16} color={col(p.temperature, '#e74c3c')} style={styles.icon} />
      </View>
    );
  };

  const renderItem = ({ item, index }) => (
    <View style={styles.card}>
      {item.image_url ? (
        <Image source={{ uri: item.image_url }} style={styles.cardImage} />
      ) : (
        <View style={[styles.cardImage, styles.placeholder]}>
          <Text style={styles.placeholderText}>No image</Text>
        </View>
      )}

      <View style={styles.content}>
        <TouchableOpacity
          onPress={() => navigation.navigate('PlantDetail', { plantId: item.id })}
          activeOpacity={0.8}
        >
          <Text style={styles.title}>{item.common_name || item.scientific_name}</Text>
          {item.scientific_name ? <Text style={styles.subtitle}>{item.scientific_name}</Text> : null}
          {item.family_common_name ? <Text style={styles.origin}>Origin: {item.family_common_name}</Text> : null}
        </TouchableOpacity>

        <CareIcons {...item} />

        {/* Nice Add button */}
        <View style={styles.cardFooter}>
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => onAdd(item)}
            accessibilityLabel={`Add ${item.common_name || item.scientific_name}`}
            activeOpacity={0.9}
          >
            <MaterialIcons name="add" size={18} color="#fff" />
            <Text style={styles.addBtnText}>Add</Text>
          </TouchableOpacity>
          {index === 0 ? <Text style={styles.hint}>Tap “Add” to add this plant</Text> : <View />}
        </View>
      </View>
    </View>
  );

  const dataToShow = !searchDone ? popularPlants : plants;

  return (
    <SafeAreaView style={styles.container}>
      <AppHeader showBack onBack={() => navigation.goBack()} title="Add a Plant" />

      <View style={styles.contentWrap}>
        {/* Search + Scan */}
        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <TouchableOpacity onPress={loadCosmosPlants} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="search" size={18} color="#999" />
            </TouchableOpacity>
            <TextInput
              style={styles.input}
              placeholder="Search plants"
              placeholderTextColor="#999"
              returnKeyType="search"
              onSubmitEditing={loadCosmosPlants}
              value={query}
              onChangeText={setQuery}
            />
          </View>

          <TouchableOpacity
            style={[styles.scanBtn, scanBusy && styles.scanBtnDisabled]}
            onPress={handlePhotoSearch}
            disabled={scanBusy}
            activeOpacity={0.9}
          >
            {scanBusy ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="camera" size={18} color="#fff" />
                <Text style={styles.scanText}>Scan</Text>
              </>
            )}
          </TouchableOpacity>

          {Platform.OS === 'web' && (
            <input
              ref={webFileInputRef}
              type="file"
              accept="image/*"
              onChange={handleWebFileUpload}
              style={{ display: 'none' }}
            />
          )}
        </View>

        <FlatList
          data={dataToShow}
          renderItem={renderItem}
          keyExtractor={(i, idx) => String(i.id || idx)}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.listContent}
          ListFooterComponent={loading ? <ActivityIndicator style={{ margin: 16 }} /> : null}
        />

        {!loading && searchDone && plants.length === 0 ? (
          <Text style={styles.noResults}>No plants found. Try another search.</Text>
        ) : null}
      </View>

      <NavigationBar currentTab="home" navigation={navigation} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  contentWrap: { flex: 1, paddingHorizontal: 16, paddingTop: 8 },

  // Search + scan
  searchRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 12,
    borderRadius: 22,
    height: 44,
  },
  input: { flex: 1, marginLeft: 8, color: '#000' },
  scanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    paddingHorizontal: 16,
    height: 44,
    borderRadius: 22,
    marginLeft: 8,
  },
  scanBtnDisabled: { opacity: 0.7 },
  scanText: { color: '#fff', fontWeight: 'bold', marginLeft: 6 },

  // card
  card: {
    flexDirection: 'row',
    backgroundColor: '#fafafa',
    borderRadius: 12,
    marginBottom: 12,
    elevation: 2,
    overflow: 'hidden',
    ...(Platform.OS !== 'web'
      ? { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 3 }
      : { boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }),
  },
  cardImage: { width: 80, height: 80 },
  placeholder: { backgroundColor: '#eee', justifyContent: 'center', alignItems: 'center' },
  placeholderText: { color: '#888', fontSize: 12 },
  content: { flex: 1, padding: 10 },
  title: { fontSize: 16, fontWeight: 'bold' },
  subtitle: { color: '#555', marginTop: 2 },
  origin: { color: '#777', marginTop: 2 },

  iconRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  icon: { marginRight: 10 },

  tag: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, marginRight: 10 },
  tagEasy: { backgroundColor: '#d4edda' },
  tagModerate: { backgroundColor: '#fff3cd' },
  tagHard: { backgroundColor: '#f8d7da' },
  tagText: { fontSize: 12, color: '#333' },

  // footer with add button
  cardFooter: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    paddingHorizontal: 14,
    height: 36,
    borderRadius: 18,
  },
  addBtnText: { color: '#fff', fontWeight: '700', marginLeft: 6, fontSize: 14 },
  hint: { fontSize: 12, color: '#888', marginLeft: 10, flex: 1, textAlign: 'right' },

  listContent: { paddingBottom: 112 },
  noResults: { textAlign: 'center', color: '#666', marginTop: 20 },
});
