import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';

export default function PlantDetailScreen() {
  const { params } = useRoute();
  const { plant } = params;
  const navigation = useNavigation();

  const goToPlacement = () => {
    navigation.navigate('PlacePlantScreen', { plantData: plant });
  };

  const renderField = (label, value) => {
    if (!value || value === '') return null;
    return (
      <>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value}>{value}</Text>
      </>
    );
  };

  const renderTemperature = () => {
    if (!plant.temperature || (!plant.temperature.min && !plant.temperature.max)) return null;
    return (
      <>
        <Text style={styles.label}>Temperature</Text>
        <Text style={styles.value}>
          {plant.temperature.min ? `Min ${plant.temperature.min}°C ` : ''}
          {plant.temperature.max ? `– Max ${plant.temperature.max}°C` : ''}
        </Text>
      </>
    );
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {plant.image_urls?.length > 0 && (
        <Image
          source={{ uri: plant.image_urls[0] }}
          style={styles.image}
          resizeMode="cover"
        />
      )}

      <Text style={styles.title}>{plant.common_name || plant.latin_name}</Text>

      {renderField("Scientific Name", plant.latin_name)}
      {renderField("Origin", plant.origin)}
      {renderField("Watering", plant.water_days ? `Every ${plant.water_days} days` : null)}
      {renderField("Light", plant.light)}
      {renderField("Humidity", plant.humidity)}
      {renderTemperature()}
      {renderField("Shade Tolerance", plant.shade)}
      {renderField("Soil Type", plant.soil)}
      {renderField("Growth Rate", plant.growth)}
      {renderField("Edibility Rating", plant.edibility_rating)}
      {renderField("Medicinal Use", plant.medicinal)}
      {renderField("Pets Safe?", plant.pets)}
      {renderField("Difficulty", plant.difficulty ? `${plant.difficulty}/10` : null)}
      {renderField("Feed", plant.feed)}
      {renderField("Repot", plant.repot)}
      {renderField("Habitat", plant.habitat)}
      {renderField("Propagation", plant.propagation)}
      {renderField("Care Tips", plant.care_tips)}

      {plant.common_problems?.length > 0 && (
        <>
          <Text style={styles.label}>Common Problems</Text>
          {plant.common_problems.map((p, i) => (
            <View key={i} style={styles.problemBox}>
              <Text style={styles.problemText}>• {p.symptom}</Text>
              <Text style={styles.causeText}>→ {p.cause}</Text>
            </View>
          ))}
        </>
      )}

      <TouchableOpacity style={styles.addButton} onPress={goToPlacement}>
        <Text style={styles.addText}>Add This Plant</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, backgroundColor: '#f0fdf4' },
  image: {
    width: '100%',
    height: 220,
    borderRadius: 16,
    marginBottom: 20
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
    color: '#2e7d32'
  },
  label: {
    fontWeight: 'bold',
    fontSize: 16,
    marginTop: 12,
    color: '#1b4332'
  },
  value: {
    fontSize: 15,
    marginBottom: 8,
    color: '#3a3a3a'
  },
  problemBox: {
    marginBottom: 10,
    paddingLeft: 6
  },
  problemText: {
    fontWeight: '600',
    color: '#cc3300'
  },
  causeText: {
    marginLeft: 8,
    color: '#555'
  },
  addButton: {
    backgroundColor: '#4CAF50',
    padding: 14,
    borderRadius: 10,
    marginTop: 30,
    alignItems: 'center'
  },
  addText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16
  }
});
