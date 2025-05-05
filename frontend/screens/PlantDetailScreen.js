import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';

export default function PlantDetailScreen() {
  const { params } = useRoute();
  const { plant } = params;
  const navigation = useNavigation();

  const goToPlacement = () => {
    navigation.navigate('PlacePlantScreen', { plantData: plant });
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>{plant.common_name || plant.scientific_name}</Text>

      <Text style={styles.label}>Scientific Name:</Text>
      <Text style={styles.value}>{plant.scientific_name}</Text>

      <Text style={styles.label}>Origin:</Text>
      <Text style={styles.value}>{plant.origin}</Text>

      <Text style={styles.label}>Water every:</Text>
      <Text style={styles.value}>{plant.water_days} days</Text>

      <Text style={styles.label}>Light:</Text>
      <Text style={styles.value}>{plant.light}</Text>

      <Text style={styles.label}>Humidity:</Text>
      <Text style={styles.value}>{plant.humidity}</Text>

      <Text style={styles.label}>Temperature:</Text>
      <Text style={styles.value}>
        Min {plant.temperature?.min}°C – Max {plant.temperature?.max}°C
      </Text>

      <Text style={styles.label}>Pets:</Text>
      <Text style={styles.value}>{plant.pets}</Text>

      <Text style={styles.label}>Difficulty:</Text>
      <Text style={styles.value}>{plant.difficulty}/10</Text>

      <Text style={styles.label}>Repot:</Text>
      <Text style={styles.value}>{plant.repot}</Text>

      <Text style={styles.label}>Feed:</Text>
      <Text style={styles.value}>{plant.feed}</Text>

      <Text style={styles.label}>Common Problems:</Text>
      {plant.common_problems?.map((p, i) => (
        <View key={i} style={styles.problemBox}>
          <Text style={styles.problemText}>• {p.symptom}</Text>
          <Text style={styles.causeText}>→ {p.cause}</Text>
        </View>
      ))}

      <TouchableOpacity style={styles.addButton} onPress={goToPlacement}>
        <Text style={styles.addText}>Add This Plant</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, backgroundColor: '#f0fdf4' },
  title: { fontSize: 26, fontWeight: 'bold', textAlign: 'center', marginBottom: 16 },
  label: { fontWeight: 'bold', marginTop: 12 },
  value: { marginBottom: 8 },
  problemBox: { marginBottom: 8 },
  problemText: { fontWeight: '600' },
  causeText: { marginLeft: 8, color: '#555' },
  addButton: {
    backgroundColor: '#4CAF50',
    padding: 14,
    borderRadius: 10,
    marginTop: 30,
    alignItems: 'center'
  },
  addText: { color: '#fff', fontWeight: 'bold', fontSize: 16 }
});
