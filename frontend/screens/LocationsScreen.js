import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, SafeAreaView } from 'react-native';
import { useForm } from '../context/FormContext';
import { Ionicons } from '@expo/vector-icons';

export default function LocationsScreen({ navigation }) {
  const { formData } = useForm();
  const [locations, setLocations] = useState([]);

  useEffect(() => {
    if (formData?.email) {
      fetchLocations();
    }
  }, [formData?.email]);

  const fetchLocations = async () => {
    try {
      const res = await fetch(`https://usersfunctions.azurewebsites.net/api/getuserlocations?email=${formData.email}`);
      const data = await res.json();
      setLocations(data || []);
    } catch (e) {
      console.error('Failed to fetch locations:', e);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#2e7d32" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Locations</Text>
      </View>

      <FlatList
        data={locations}
        keyExtractor={(item) => item}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.locationButton}
            onPress={() => navigation.navigate('LocationPlants', { location: item })}
          >
            <Text style={styles.locationText}>{item}</Text>
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0fff0', padding: 20 },
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
  locationButton: {
    padding: 15,
    backgroundColor: '#d0f0d0',
    borderRadius: 10,
    marginBottom: 10,
  },
  locationText: {
    fontSize: 18,
    color: '#333',
  },
});
