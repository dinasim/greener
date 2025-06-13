// screens/PlantDetailScreen.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Dimensions,
  SafeAreaView,
  Platform,
} from 'react-native';
import { Ionicons, MaterialIcons, FontAwesome5, Entypo } from '@expo/vector-icons';

const PLANT_DETAIL_URL = 'https://usersfunctions.azurewebsites.net/api/plant_detail';
const { width } = Dimensions.get('window');
const IMAGE_HEIGHT = width * 0.58;

export default function PlantDetailScreen({ route, navigation }) {
  const plantId = route?.params?.plantId;
  const [plant, setPlant] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!plantId) {
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const res = await fetch(`${PLANT_DETAIL_URL}?name=${encodeURIComponent(plantId)}`);
        const data = await res.json();
        if (data && data.common_name) setPlant(data);
        else setPlant(null);
      } catch (e) {
        setPlant(null);
        console.warn(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [plantId]);

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={{ fontSize: 18, color: "#2e7d32", fontWeight: "bold" }}>Loading plant details…</Text>
      </SafeAreaView>
    );
  }

  if (!plant) {
    return (
      <SafeAreaView style={styles.center}>
        <Ionicons name="alert-circle" size={70} color="#bdbdbd" style={{ marginBottom: 14 }} />
        <Text style={{ fontSize: 24, fontWeight: "bold", color: "#333", marginBottom: 10 }}>
          Plant Not Found
        </Text>
        <Text style={{ color: "#666", fontSize: 17, marginBottom: 18, textAlign: 'center' }}>
          Sorry, we couldn't find details for this plant in our encyclopedia.
        </Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // Data helpers for nice formatting:
  const dash = '—';
  const care = plant.care_info || {};
  const schedule = plant.schedule || {};

  const careInfo = [
    {
      icon: <MaterialIcons name="wb-sunny" size={24} color="#FFD600" />,
      label: 'Light',
      value: care.light || dash,
    },
    {
      icon: <Entypo name="drop" size={22} color="#35B36B" />,
      label: 'Humidity',
      value: care.humidity || dash,
    },
    {
      icon: <FontAwesome5 name="temperature-low" size={22} color="#F26C4F" />,
      label: 'Temperature',
      value: (care.temperature_min_c && care.temperature_max_c)
        ? `${care.temperature_min_c}°–${care.temperature_max_c}°C`
        : dash,
    },
    {
      icon: <MaterialIcons name="pets" size={22} color="#826C5E" />,
      label: 'Pets',
      value: care.pets === "poisonous" ? "❌ Poisonous" :
             care.pets === "not poisonous" ? "✔️ Safe" :
             dash,
    },
    {
      icon: <MaterialIcons name="fitness-center" size={22} color="#8663DC" />,
      label: 'Difficulty',
      value: care.difficulty ? `${care.difficulty} / 10` : dash,
    },
  ];

  const scheduleInfo = [
    {
      icon: <MaterialIcons name="event" size={22} color="#4CAF50" />,
      label: 'Water every',
      value: schedule.water_days ? `every ${schedule.water_days} days` : dash,
    },
    {
      icon: <MaterialIcons name="local-florist" size={22} color="#7CB518" />,
      label: 'Feed',
      value: schedule.feed_days ? `every ${schedule.feed_days} days` : dash,
    },
    {
      icon: <MaterialIcons name="change-history" size={22} color="#8B5CF6" />,
      label: 'Repot',
      value: schedule.repot_years ? `every ${schedule.repot_years} years` : dash,
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={28} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {plant.common_name || plant.scientific_name || 'Plant details'}
        </Text>
        <View style={{ width: 36 }} /> {/* for symmetry */}
      </View>

      <ScrollView contentContainerStyle={styles.contentContainer}>
        {/* Plant Image */}
        {plant.image_url && (
          <Image source={{ uri: plant.image_url }} style={styles.image} />
        )}

        {/* Names */}
        <Text style={styles.commonName}>{plant.common_name || dash}</Text>
        <Text style={styles.latinName}>{plant.scientific_name || dash}</Text>

        {/* Care Info Section */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Care Info</Text>
          {careInfo.map((item, idx) => (
            <View style={styles.infoRow} key={item.label}>
              <View style={styles.infoIcon}>{item.icon}</View>
              <Text style={styles.infoLabel}>{item.label}:</Text>
              <Text style={styles.infoValue}>{item.value}</Text>
            </View>
          ))}
        </View>

        {/* Schedule Section */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Schedule & Maintenance</Text>
          {scheduleInfo.map((item, idx) => (
            <View style={styles.infoRow} key={item.label}>
              <View style={styles.infoIcon}>{item.icon}</View>
              <Text style={styles.infoLabel}>{item.label}:</Text>
              <Text style={styles.infoValue}>{item.value}</Text>
            </View>
          ))}
        </View>

        {/* Care Tips */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Care Tips</Text>
          <Text style={styles.sectionBody}>
            {plant.care_tips && plant.care_tips.trim() !== "" ? plant.care_tips : dash}
          </Text>
        </View>

        {/* Family */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Family</Text>
          <Text style={styles.sectionBody}>
            {plant.family && plant.family.trim() !== "" ? plant.family : dash}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2e7d32',
    padding: 13,
    paddingTop: Platform.OS === 'android' ? 30 : 13,
  },
  headerTitle: { flex: 1, textAlign: 'center', color: '#fff', fontSize: 20, fontWeight: '700' },
  contentContainer: { padding: 18, paddingBottom: 60 },
  image: { width: '100%', height: IMAGE_HEIGHT, borderRadius: 13, marginBottom: 14 },
  commonName: { fontSize: 26, fontWeight: 'bold', textAlign: 'center', marginBottom: 2, color: '#2e7d32' },
  latinName: { fontSize: 16, fontStyle: 'italic', color: '#888', textAlign: 'center', marginBottom: 18 },
  sectionCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 18,
    marginBottom: 18,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionTitle: { fontSize: 20, fontWeight: '700', marginBottom: 10, color: '#3a4b37' },
  infoRow: {
    flexDirection: 'row', alignItems: 'center', marginBottom: 6, paddingLeft: 4,
  },
  infoIcon: { width: 30, alignItems: 'center' },
  infoLabel: { fontSize: 17, fontWeight: 'bold', marginRight: 7, color: '#333', width: 90 },
  infoValue: { fontSize: 17, color: '#484848', flex: 1 },
  sectionBody: { fontSize: 15, color: '#545454', marginTop: 2, lineHeight: 21, paddingLeft: 4 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  backBtn: {
    padding: 10,
    backgroundColor: '#2e7d32',
    borderRadius: 7,
    marginTop: 8,
    alignSelf: 'center'
  },
  backText: { color: '#fff', fontWeight: "bold", fontSize: 17 },
});

