// screens/LocationPlantsDetail.js
import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, SafeAreaView, TouchableOpacity, Image, StyleSheet, ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useForm } from '../context/FormContext';

const PLANT_PHOTO_PLACEHOLDER = require('../assets/plant-placeholder.png');

export default function LocationPlantsDetail() {
  const { params } = useRoute();
  const navigation = useNavigation();
  const { formData } = useForm();
  const location = params?.location;

  const [plants, setPlants] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (formData?.email && location) fetchPlants();
  }, [formData?.email, location]);

  const fetchPlants = async () => {
    setLoading(true);
    try {
      const res = await fetch(`https://usersfunctions.azurewebsites.net/api/getuserplantsbylocation?email=${formData.email}&location=${encodeURIComponent(location)}`);
      const data = await res.json();
      setPlants(data || []);
    } catch {
      setPlants([]);
    } finally {
      setLoading(false);
    }
  };

  const renderPlantCard = ({ item }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => navigation.navigate('PlantDetail', { plantId: item.id })}
    >
      <Image
        source={item.image_url ? { uri: item.image_url } : PLANT_PHOTO_PLACEHOLDER}
        style={styles.image}
        resizeMode="cover"
      />
      <View style={styles.body}>
        <Text style={styles.name}>{item.nickname || item.common_name || item.scientific_name}</Text>
        <Text style={styles.species}>{item.scientific_name}</Text>
        <View style={styles.waterRow}>
          <Ionicons name="water" size={16} color="#53b881" />
          <Text style={styles.waterText}>Every {item.water_days} days</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={28} color="#53b881" />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{location}</Text>
        <View style={{ width: 45 }} /> {/* Spacer for symmetry */}
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#53b881" style={{ marginTop: 60 }} />
      ) : plants.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="leaf-outline" size={60} color="#cceedd" />
          <Text style={styles.emptyText}>No plants in this site yet!</Text>
        </View>
      ) : (
        <FlatList
          data={plants}
          renderItem={renderPlantCard}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', padding: 18, backgroundColor: '#fff', justifyContent: 'space-between',
    borderBottomWidth: 0.5, borderColor: '#d2f3dd'
  },
  backBtn: { flexDirection: 'row', alignItems: 'center' },
  backText: { fontSize: 18, color: '#53b881', fontWeight: '600', marginLeft: 6 },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#273d1a' },

  list: { paddingHorizontal: 10, paddingBottom: 100 },
  card: {
    flexDirection: 'row',
    backgroundColor: '#f5fbf4',
    borderRadius: 16,
    marginBottom: 14,
    alignItems: 'center',
    padding: 10,
    elevation: 1,
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 1,
    marginHorizontal: 6,
  },
  image: {
    width: 70, height: 70, borderRadius: 14, backgroundColor: '#e1ffe8', marginRight: 15
  },
  body: { flex: 1 },
  name: { fontSize: 17, fontWeight: 'bold', color: '#273d1a' },
  species: { color: '#657465', marginTop: 2, fontSize: 13 },
  waterRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  waterText: { color: '#57a66b', marginLeft: 4, fontSize: 13 },
  emptyState: { alignItems: 'center', marginTop: 60 },
  emptyText: { color: "#b6bdb1", fontSize: 19, fontWeight: 'bold' },
});
