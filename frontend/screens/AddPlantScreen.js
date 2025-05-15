import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Swipeable } from 'react-native-gesture-handler';
import { Ionicons, MaterialIcons, FontAwesome5 } from '@expo/vector-icons';

const PLANT_SEARCH_URL   = 'https://usersfunctions.azurewebsites.net/api/plant_search';
const PLANTNET_PROXY_URL = 'https://usersfunctions.azurewebsites.net/api/identifyplantphoto';

// Stub data for names & origins; image_url is filled in dynamically below
const fallbackPopular = [
  { id: 'Epipremnum aureum', common_name: 'Golden Pothos',    scientific_name: 'Epipremnum aureum',    family_common_name: 'Araceae', image_url: null },
  { id: 'Sansevieria trifasciata', common_name: "Snake Plant 'Laurentii'", scientific_name: 'Sansevieria trifasciata', family_common_name: 'Asparagaceae', image_url: null },
  { id: 'Monstera deliciosa',     common_name: 'Monstera',       scientific_name: 'Monstera deliciosa',     family_common_name: 'Araceae', image_url: null },
  { id: 'Ocimum basilicum',       common_name: 'Basil',          scientific_name: 'Ocimum basilicum',       family_common_name: 'Lamiaceae', image_url: null },
  { id: 'Zamioculcas zamiifolia', common_name: 'ZZ Plant',       scientific_name: 'Zamioculcas zamiifolia', family_common_name: 'Araceae', image_url: null },
];

export default function AddPlantScreen({ navigation }) {
  const [query, setQuery]                 = useState('');
  const [plants, setPlants]               = useState([]);
  const [popularPlants, setPopularPlants] = useState(fallbackPopular);
  const [loading, setLoading]             = useState(false);
  const [searchDone, setSearchDone]       = useState(false);

  // normalize data shape
  const normalize = p => ({
    id:                  p.id,
    common_name:         p.common_name || '',
    scientific_name:     p.scientific_name || p.latin_name || '',
    image_url:           p.image_url      || p.image_urls?.[0]    || null,
    family_common_name:  p.family_common_name || p.origin      || '',
    care_difficulty:     p.care_difficulty || null,
    shade:               p.shade           || null,
    moisture:            p.moisture        || null,
    temperature:         p.temperature     || null,
  });

  // fetch full record by scientific name
  async function fetchByScientificName(name) {
    try {
      const res  = await fetch(`${PLANT_SEARCH_URL}?name=${encodeURIComponent(name)}`);
      const data = await res.json();
      const match = data.find(p => p.scientific_name === name);
      return match ? normalize(match) : null;
    } catch {
      return null;
    }
  }

  // on mount, load popular plants
  useEffect(() => {
    (async () => {
      setLoading(true);
      const results = await Promise.all(
        fallbackPopular.map(async stub => {
          const fetched = await fetchByScientificName(stub.scientific_name);
          return fetched || stub;
        })
      );
      setPopularPlants(results);
      setLoading(false);
    })();
  }, []);

  // text search
  const loadCosmosPlants = async () => {
    if (!query.trim() || loading) return;
    setLoading(true);
    setSearchDone(false);
    try {
      const res  = await fetch(`${PLANT_SEARCH_URL}?name=${encodeURIComponent(query)}`);
      const data = await res.json();
      setPlants(data.map(normalize));
      setSearchDone(true);
    } catch {
      Alert.alert('Error', 'Failed to search for plants.');
    } finally {
      setLoading(false);
    }
  };

  // photo search (native)
  const processFileNative = async uri => {
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

  const handlePhotoSearch = async () => {
    if (Platform.OS === 'web') {
      document.getElementById('web-file-input').click();
      return;
    }
    setLoading(true);
    setSearchDone(false);
    setPlants([]);
    const { granted } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!granted) {
      Alert.alert('Permission required', 'Please allow photo access.');
      setLoading(false);
      return;
    }
    const pick = await ImagePicker.launchImageLibraryAsync({mediaTypes: [ImagePicker.MediaType.IMAGE]});
    const uri  = pick.assets?.[0]?.uri || pick.uri;
    if (!uri) { setLoading(false); return; }

    try {
      const json    = await processFileNative(uri);
      const results = json.results || [];
      setPlants(results.map(r => ({
        id:                 r.species.scientificNameWithoutAuthor,
        common_name:        r.species.commonNames?.[0] || '',
        scientific_name:    r.species.scientificNameWithoutAuthor,
        image_url:          r.images[0]?.url?.o || r.images[0]?.url?.m || r.images[0]?.url?.s || null,
        family_common_name: r.species.family.scientificNameWithoutAuthor,
      })));
      setSearchDone(true);
    } catch (err) {
      Alert.alert('Error', 'Failed to identify plant.\n' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // web file upload
  const handleWebFileUpload = async e => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setSearchDone(false);
    setPlants([]);
    const form = new FormData();
    form.append('organs', 'leaf');
    form.append('images', file, file.name);
    try {
      const resp = await fetch(PLANTNET_PROXY_URL, { method: 'POST', body: form });
      if (!resp.ok) throw new Error(await resp.text());
      const json    = await resp.json();
      const results = json.results || [];
      setPlants(results.map(r => ({
        id:                 r.species.scientificNameWithoutAuthor,
        common_name:        r.species.commonNames?.[0] || '',
        scientific_name:    r.species.scientificNameWithoutAuthor,
        image_url:          r.images[0]?.url?.o || r.images[0]?.url?.m || r.images[0]?.url?.s || null,
        family_common_name: r.species.family.scientificNameWithoutAuthor,
      })));
      setSearchDone(true);
    } catch (err) {
      Alert.alert('Error', 'Failed to identify plant.\n' + err.message);
    } finally {
      setLoading(false);
      e.target.value = '';
    }
  };

  // render care icons
  const renderCareIcons = p => {
    const col = (v,c) => v ? c : '#ccc';
    return (
      <View style={styles.iconRow}>
        {p.care_difficulty && (
          <View style={[
            styles.tag,
            p.care_difficulty === 'Easy'     ? styles.tagEasy :
            p.care_difficulty === 'Moderate' ? styles.tagModerate :
                                               styles.tagHard
          ]}>
            <Text style={styles.tagText}>{p.care_difficulty}</Text>
          </View>
        )}
        <MaterialIcons name="wb-sunny" size={18} color={col(p.shade,'#f39c12')} style={styles.icon}/>
        <Ionicons       name="water" size={18} color={col(p.moisture,'#3498db')} style={styles.icon}/>
        <FontAwesome5   name="thermometer-half" size={16} color={col(p.temperature,'#e74c3c')} style={styles.icon}/>
      </View>
    );
  };

  // render each card and handle navigation if exists
  const renderCard = ({ item, index }) => (
    <Swipeable
      renderRightActions={() => (
        <View style={styles.swipeAction}>
          <Text style={styles.swipeText}>Save</Text>
        </View>
      )}
      onSwipeableRightOpen={() => Alert.alert('Saved', `${item.common_name || item.scientific_name} added!`)}
    >
      <TouchableOpacity
        style={styles.card}
        onPress={() => {
          const exists = searchDone ? plants.find(p => p.id === item.id) : popularPlants.find(p => p.id === item.id);
          if (exists) navigation.navigate('PlantDetail', { plantId: item.id });
        }}
      >
        {item.image_url ? (
          <Image source={{ uri: item.image_url }} style={styles.cardImage}/>
        ) : (
          <View style={[styles.cardImage,styles.placeholder]}>
            <Text style={styles.placeholderText}>No image</Text>
          </View>
        )}
        <View style={styles.content}>
          <Text style={styles.title}>{item.common_name || item.scientific_name}</Text>
          {item.scientific_name && <Text style={styles.subtitle}>{item.scientific_name}</Text>}
          {item.family_common_name && <Text style={styles.origin}>Origin: {item.family_common_name}</Text>}
          {renderCareIcons(item)}
          {index===0 && <Text style={styles.hint}>Swipe left to save this plant</Text>}
        </View>
      </TouchableOpacity>
    </Swipeable>
  );

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.header}>Add a Plant</Text>

      {/* Search + Scan */}
      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color="#999" onPress={loadCosmosPlants}/>
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
        <TouchableOpacity style={styles.scanBtn} onPress={handlePhotoSearch}>
          <Ionicons name="camera" size={18} color="#fff"/>
          <Text style={styles.scanText}>Scan</Text>
        </TouchableOpacity>
        {Platform.OS==='web' && (
          <input
            id="web-file-input"
            type="file"
            accept="image/*"
            onChange={handleWebFileUpload}
            style={{ display:'none' }}
          />
        )}
      </View>

      {/* List */}
      {!searchDone ? (
        <FlatList
          data={popularPlants}
          renderItem={renderCard}
          keyExtractor={i=>i.id}
          ListFooterComponent={loading && <ActivityIndicator style={{margin:16}}/>}
        />
      ) : plants.length>0 ? (
        <FlatList
          data={plants}
          renderItem={renderCard}
          keyExtractor={i=>i.id}
          ListFooterComponent={loading && <ActivityIndicator style={{margin:16}}/>}
        />
      ) : (
        !loading && <Text style={styles.noResults}>No plants found. Try another search.</Text>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:      { flex:1, backgroundColor:'#fff', padding:16, paddingBottom:100 },
  header:         { fontSize:26, fontWeight:'bold', textAlign:'center', marginBottom:16 },
  searchRow:      { flexDirection:'row', alignItems:'center', marginBottom:12 },
  searchBox:      { flex:1, flexDirection:'row', alignItems:'center', backgroundColor:'#f0f0f0', paddingHorizontal:12, borderRadius:20, height:44 },
  input:          { flex:1, marginLeft:8, color:'#000' },
  scanBtn:        { flexDirection:'row', alignItems:'center', backgroundColor:'#4CAF50', paddingHorizontal:16, paddingVertical:10, borderRadius:20, marginLeft:8 },
  scanText:       { color:'#fff', fontWeight:'bold', marginLeft:6 },
  card:           { flexDirection:'row', backgroundColor:'#fafafa', borderRadius:12, marginBottom:12, elevation:2, overflow:'hidden' },
  cardImage:      { width:80, height:80 },
  placeholder:    { backgroundColor:'#eee', justifyContent:'center', alignItems:'center' },
  placeholderText:{ color:'#888', fontSize:12 },
  content:        { flex:1, padding:10 },
  title:          { fontSize:16, fontWeight:'bold' },
  subtitle:       { color:'#555', marginTop:2 },
  origin:         { color:'#777', marginTop:2 },
  iconRow:        { flexDirection:'row', alignItems:'center', marginTop:6 },
  icon:           { marginRight:10 },
  tag:            { paddingHorizontal:6, paddingVertical:2, borderRadius:8, marginRight:10 },
  tagEasy:        { backgroundColor:'#d4edda' },
  tagModerate:    { backgroundColor:'#fff3cd' },
  tagHard:        { backgroundColor:'#f8d7da' },
  tagText:        { fontSize:12, color:'#333' },
  swipeAction:    { backgroundColor:'#c8e6c9', justifyContent:'center', alignItems:'center', width:80 },
  swipeText:      { color:'#2e7d32', fontWeight:'bold' },
  hint:           { fontSize:12, color:'#888', marginTop:4, fontStyle:'italic', marginRight:6 },
  noResults:      { textAlign:'center', color:'#666', marginTop:20 },
});