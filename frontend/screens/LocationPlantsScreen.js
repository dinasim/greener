import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, SafeAreaView, TouchableOpacity } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useForm } from '../context/FormContext';
import { Ionicons } from '@expo/vector-icons';

export default function LocationPlantsScreen() {
  const { params } = useRoute();
  const navigation = useNavigation();
  const { formData } = useForm();
  const { location } = params;

  const [plants, setPlants] = useState([]);

  useEffect(() => {
    if (formData?.email) {
      fetchPlants();
    }
  }, [formData?.email]);

  const fetchPlants = async () => {
    try {
      const res = await fetch(`https://usersfunctions.azurewebsites.net/api/getuserplantsbylocation?email=${formData.email}&location=${location}`);
      const data = await res.json();
      setPlants(data || []);
    } catch (e) {
      console.error('Failed to fetch plants:', e);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#2e7d32" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Plants in {location}</Text>
      </View>

      <FlatList
        data={plants}
        keyExtractor={(item) => item.nickname}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.name}>{item.nickname}</Text>
            <Text style={styles.info}>Species: {item.scientific_name}</Text>
            <Text style={styles.info}>Water every {item.water_days} days</Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4fff4', padding: 20 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginLeft: 10,
    color: '#2e7d32',
  },
  card: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  name: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  info: { fontSize: 14, color: '#555', marginTop: 4 },
});
