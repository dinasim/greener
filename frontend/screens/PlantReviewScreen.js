import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useForm } from '../context/FormContext';
import MainLayout from '../components/MainLayout'; // <--- ADDED

// Helper: upload photo to Azure Blob Storage via your backend
async function uploadPlantPhotoToAzure(uri) {
  const response = await fetch(uri);
  const blob = await response.blob();
  const base64 = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.readAsDataURL(blob);
  });
  const filename = `plant_${Date.now()}.jpg`;
  const apiRes = await fetch('https://usersfunctions.azurewebsites.net/api/uploadUserPlantPhoto', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageBase64: base64, filename }),
  });
  if (!apiRes.ok) throw new Error(await apiRes.text());
  const json = await apiRes.json();
  return json.url;
}

// Normalizes email and nickname for Cosmos-safe ID: replaces all non-alphanumeric chars with "_"
function normalizeId(email, nickname) {
  const safeEmail = (email || '').replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
  const safeNick = (nickname || 'plant').replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
  return `${safeEmail}_${safeNick}`;
}

export default function PlantReviewScreen({ route, navigation }) {
  // Plant info passed from AddPlantScreen
  const { plant } = route.params || {};
  const { formData } = useForm();
  const userEmail = formData?.email;

  const [nickname, setNickname] = useState('');
  const [location, setLocation] = useState('');
  const [photoUri, setPhotoUri] = useState(null);
  const [loading, setLoading] = useState(false);

  // For date pickers
  const [showWatered, setShowWatered] = useState(false);
  const [showFed, setShowFed] = useState(false);
  const [showRepotted, setShowRepotted] = useState(false);
  const [lastWatered, setLastWatered] = useState(null);
  const [lastFed, setLastFed] = useState(null);
  const [lastRepotted, setLastRepotted] = useState(null);

  // Tab handler for the nav bar
  const handleTabPress = (tab) => {
    if (tab === 'home') navigation.navigate('Home');
    else if (tab === 'plants') navigation.navigate('Locations');
    else if (tab === 'marketplace') navigation.navigate('MainTabs');
    else if (tab === 'forum') navigation.navigate('PlantCareForumScreen');
    else if (tab === 'disease') navigation.navigate('DiseaseChecker');
  };

  // Pick custom user photo
  const handlePhotoPick = async () => {
    let perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission required', 'Photo access needed.');
      return;
    }
    let res = await ImagePicker.launchImageLibraryAsync({ base64: false, quality: 0.8 });
    if (res.cancelled || (res.assets && res.assets.length === 0)) return;
    setPhotoUri(res.uri || res.assets[0].uri);
  };

  // Format date to readable string
  function formatDate(d) {
    if (!d) return 'Today';
    try {
      return new Date(d).toLocaleDateString();
    } catch {
      return d;
    }
  }

  // Save to backend (Cosmos + upload)
  const handleSave = async () => {
    if (!nickname.trim() || !location.trim()) {
      Alert.alert("Required", "Please enter a nickname and location.");
      return;
    }
    if (!userEmail) {
      Alert.alert("Error", "User email not found. Please sign in again.");
      return;
    }
    setLoading(true);
    try {
      let uploadedUrl = '';
      if (photoUri) {
        uploadedUrl = await uploadPlantPhotoToAzure(photoUri);
      }

      // Compose plant record using new data format
      const id = normalizeId(userEmail, nickname); // normalized, deterministic!

      const payload = {
        id,
        email: userEmail,
        nickname,
        location,
        common_name: plant.common_name,
        scientific_name: plant.scientific_name,
        image_url: uploadedUrl || plant.image_url || plant.image_urls?.[0] || "",
        care_info: plant.care_info || {},
        schedule: plant.schedule || {},
        family: plant.family || "",
        care_tips: plant.care_tips || "",
        common_problems: plant.common_problems || [],
        origin: plant.origin || "",
        avg_watering: plant.avg_watering || 0,
        // Date fields for backend logic
        last_watered: lastWatered,
        last_fed: lastFed,
        last_repotted: lastRepotted,
      };

      // Save to backend
      const apiRes = await fetch('https://usersfunctions.azurewebsites.net/api/userplants/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!apiRes.ok) throw new Error(await apiRes.text());
      Alert.alert('Success', 'Plant saved!');
      navigation.navigate('Locations');
    } catch (e) {
      Alert.alert('Error', e.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <MainLayout currentTab="plants" onTabPress={handleTabPress}>
      <ScrollView contentContainerStyle={{ paddingBottom: 60 }}>
        {/* Back Button */}
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#2e7d32" />
          <Text style={{ color: "#2e7d32", marginLeft: 7, fontWeight: "bold", fontSize: 17 }}>Back</Text>
        </TouchableOpacity>

        <Text style={styles.header}>Review Plant</Text>
        {/* Plant Image */}
        <Image
          source={{
            uri:
              photoUri ||
              plant.image_url ||
              (plant.image_urls && plant.image_urls[0]) ||
              "https://www.pngitem.com/pimgs/m/113-1136906_transparent-background-plant-pot-png-png-download.png"
          }}
          style={styles.image}
        />

        <Text style={styles.label}>Plant Name</Text>
        <Text style={styles.value}>{plant.common_name || plant.scientific_name}</Text>
        <Text style={styles.label}>Scientific Name</Text>
        <Text style={styles.value}>{plant.scientific_name || "—"}</Text>

        <Text style={styles.label}>Nickname</Text>
        <TextInput
          style={styles.input}
          value={nickname}
          onChangeText={setNickname}
          placeholder="E.g. Ficus on window"
        />

        <Text style={styles.label}>Location</Text>
        <TextInput
          style={styles.input}
          value={location}
          onChangeText={setLocation}
          placeholder="E.g. Living Room"
        />

        {/* Last Watered */}
        <Text style={styles.label}>Last Watered</Text>
        <TouchableOpacity style={styles.input} onPress={() => setShowWatered(true)}>
          <Text>{lastWatered ? formatDate(lastWatered) : "Today"}</Text>
        </TouchableOpacity>
        {showWatered && (
          <DateTimePicker
            value={lastWatered ? new Date(lastWatered) : new Date()}
            mode="date"
            display="default"
            onChange={(event, selectedDate) => {
              setShowWatered(false);
              if (selectedDate) setLastWatered(selectedDate.toISOString());
            }}
          />
        )}

        {/* Last Fed */}
        <Text style={styles.label}>Last Fed</Text>
        <TouchableOpacity style={styles.input} onPress={() => setShowFed(true)}>
          <Text>{lastFed ? formatDate(lastFed) : "Today"}</Text>
        </TouchableOpacity>
        {showFed && (
          <DateTimePicker
            value={lastFed ? new Date(lastFed) : new Date()}
            mode="date"
            display="default"
            onChange={(event, selectedDate) => {
              setShowFed(false);
              if (selectedDate) setLastFed(selectedDate.toISOString());
            }}
          />
        )}

        {/* Last Repotted */}
        <Text style={styles.label}>Last Repotted</Text>
        <TouchableOpacity style={styles.input} onPress={() => setShowRepotted(true)}>
          <Text>{lastRepotted ? formatDate(lastRepotted) : "Today"}</Text>
        </TouchableOpacity>
        {showRepotted && (
          <DateTimePicker
            value={lastRepotted ? new Date(lastRepotted) : new Date()}
            mode="date"
            display="default"
            onChange={(event, selectedDate) => {
              setShowRepotted(false);
              if (selectedDate) setLastRepotted(selectedDate.toISOString());
            }}
          />
        )}

        <Text style={styles.label}>Custom Photo (optional)</Text>
        <TouchableOpacity style={styles.uploadBtn} onPress={handlePhotoPick}>
          <Ionicons name="camera" size={20} color="#fff" />
          <Text style={styles.uploadBtnText}>Pick Photo</Text>
        </TouchableOpacity>
        {photoUri && <Image source={{ uri: photoUri }} style={styles.imagePreview} />}

        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save Plant</Text>}
        </TouchableOpacity>
      </ScrollView>
    </MainLayout>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4fff4', padding: 22 },
  backBtn: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  header: { fontSize: 25, fontWeight: "bold", marginBottom: 14, color: "#205d29" },
  image: { width: 130, height: 130, borderRadius: 14, marginBottom: 16, alignSelf: 'center' },
  label: { fontWeight: "bold", marginTop: 8, marginBottom: 3, color: "#222" },
  value: { marginBottom: 5, fontSize: 15, color: "#444" },
  input: { borderWidth: 1, borderColor: "#b7e2cd", borderRadius: 9, padding: 8, fontSize: 16, marginBottom: 8 },
  uploadBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: "#43a047", borderRadius: 7, padding: 9, marginTop: 8, width: 130 },
  uploadBtnText: { color: "#fff", marginLeft: 7, fontWeight: "bold" },
  imagePreview: { width: 100, height: 100, borderRadius: 9, marginVertical: 10, alignSelf: 'center' },
  saveBtn: { backgroundColor: "#2e7d32", borderRadius: 8, padding: 13, alignItems: "center", marginTop: 18 },
  saveBtnText: { color: "#fff", fontWeight: "bold", fontSize: 17 },
});
