import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView, Alert } from 'react-native';
import { useForm } from '../context/FormContext';

export default function PlacePlantScreen({ route, navigation }) {
  const { plantData } = route.params;
  const { formData } = useForm(); // <-- get the user data

  const [location, setLocation] = useState('');
  const [lastRepotted, setLastRepotted] = useState('');
  const [lastWatered, setLastWatered] = useState('');

  const handleSave = async () => {
    const payload = {
      email: formData.email,
      id: `${plantData.common_name || plantData.scientific_name}-${Date.now()}`,
      plantName: plantData.common_name || plantData.scientific_name,
      location,
      lastRepotted,
      lastWatered,
      imageUrl: plantData.default_image?.original_url || '',
    };

    // try {
    //   const response = await fetch('https://your-azure-function-url/api/saveUserPlant', {
    //     method: 'POST',
    //     headers: {
    //       'Content-Type': 'application/json',
    //     },
    //     body: JSON.stringify(payload),
    //   });

    //   if (response.ok) {
    //     Alert.alert('Success', 'Plant added successfully!');
    //     navigation.navigate('Home');
    //   } else {
    //     Alert.alert('Error', 'Failed to save plant.');
    //   }
    // } catch (error) {
    //   console.error('Error saving plant:', error);
    //   Alert.alert('Error', 'Could not save plant.');
    // }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        <Text style={styles.title}>Set Up Your Plant</Text>

        <TextInput
          style={styles.input}
          placeholder="Where is the plant placed? (e.g., Balcony, Bathroom)"
          value={location}
          onChangeText={setLocation}
        />

        <TextInput
          style={styles.input}
          placeholder="When was it last repotted? (YYYY-MM-DD)"
          value={lastRepotted}
          onChangeText={setLastRepotted}
        />

        <TextInput
          style={styles.input}
          placeholder="When was it last watered? (YYYY-MM-DD)"
          value={lastWatered}
          onChangeText={setLastWatered}
        />

        <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
          <Text style={styles.saveButtonText}>Save Plant</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 20 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20 },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
  },
  saveButton: {
    backgroundColor: '#2e7d32',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  saveButtonText: { color: '#fff', fontWeight: 'bold' },
});
