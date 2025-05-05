import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  FlatList
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useForm } from '../context/FormContext';

export default function PlacePlantScreen() {
  const navigation = useNavigation();
  const { params } = useRoute();
  const { plantData } = params;
  const { formData } = useForm();

  const [nickname, setNickname] = useState('');
  const [location, setLocation] = useState('');
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(false);

  const userEmail = formData?.email;

  useEffect(() => {
    console.log("formData.email =", formData?.email);
    if (formData?.email) {
      fetchLocations();
    }
  }, [formData]);

  const fetchLocations = async () => {
    try {
      console.log("Fetching locations for", userEmail);
      const res = await fetch(`https://usersfunctions.azurewebsites.net/api/getuserlocations?email=${userEmail}`);
      const data = await res.json();
      console.log("Locations fetched:", data);
      setLocations(data || []);
    } catch (e) {
      console.error("Failed to fetch locations", e);
    }
  };

  const handleSubmit = async () => {
    if (!nickname || !location) {
      Alert.alert("Missing fields", "Please enter a nickname and select a location.");
      return;
    }

    const payload = {
      email: userEmail,
      nickname,
      location,
      common_name: plantData.common_name,
      scientific_name: plantData.scientific_name,
      origin: plantData.origin || 'Unknown',
      water_days: plantData.water_days || 7,
      light: plantData.light || 'Unknown',
      humidity: plantData.humidity || 'Unknown',
      temperature: plantData.temperature || { min: 15, max: 30 },
      pets: plantData.pets || 'Unknown',
      difficulty: plantData.difficulty || 5,
      repot: plantData.repot || 'Every 2 years',
      feed: plantData.feed || 'Every 10 weeks',
      common_problems: plantData.common_problems || []
    };

    setLoading(true);
    try {
      const res = await fetch('https://usersfunctions.azurewebsites.net/api/userplants/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error("Add failed");
      Alert.alert("Success", "Plant added to your garden!");
      navigation.navigate('Home');
    } catch (e) {
      console.error("Save failed", e);
      Alert.alert("Error", "Could not save your plant.");
    }
    setLoading(false);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Give your plant a nickname:</Text>
      <TextInput
        placeholder="e.g., Spike, My Balcony Aloe"
        value={nickname}
        onChangeText={setNickname}
        style={styles.input}
      />

      <Text style={styles.title}>Select a location:</Text>
      <FlatList
        data={locations}
        keyExtractor={(item) => item}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[
              styles.locationOption,
              item === location && styles.locationSelected
            ]}
            onPress={() => setLocation(item)}
          >
            <Text style={styles.locationText}>{item}</Text>
          </TouchableOpacity>
        )}
      />

      <Text style={styles.title}>Or enter a new location:</Text>
      <TextInput
        placeholder="New location"
        value={location}
        onChangeText={setLocation}
        style={styles.input}
      />

      <TouchableOpacity style={styles.submitButton} onPress={handleSubmit} disabled={loading}>
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.submitText}>Save Plant</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#f5fff5' },
  title: { fontSize: 18, fontWeight: 'bold', marginTop: 20, marginBottom: 8 },
  input: {
    backgroundColor: '#fff',
    padding: 10,
    borderRadius: 10,
    borderColor: '#ccc',
    borderWidth: 1,
    marginBottom: 12
  },
  locationOption: {
    padding: 10,
    backgroundColor: '#e0ffe0',
    borderRadius: 8,
    marginBottom: 8
  },
  locationSelected: {
    backgroundColor: '#4CAF50'
  },
  locationText: {
    fontSize: 16,
    color: '#333'
  },
  submitButton: {
    backgroundColor: '#2e7d32',
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 20
  },
  submitText: {
    color: '#fff',
    fontWeight: 'bold'
  }
});
