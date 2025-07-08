import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, Image, StyleSheet, TouchableOpacity, Dimensions, Platform
} from 'react-native';
import { Ionicons, MaterialIcons, FontAwesome5, Entypo, Feather } from '@expo/vector-icons';
import MainLayout from '../components/MainLayout';

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

  // --- Nav bar handler ---
  const handleTabPress = (tab) => {
    if (tab === 'home') navigation.navigate('Home');
    else if (tab === 'plants') navigation.navigate('Locations');
    else if (tab === 'marketplace') navigation.navigate('MainTabs');
    else if (tab === 'forum') navigation.navigate('PlantCareForumScreen');
    else if (tab === 'disease') navigation.navigate('DiseaseChecker');
  };

  if (loading) {
    return (
      <MainLayout currentTab="plants" onTabPress={handleTabPress}>
        <View style={styles.center}>
          <Text style={{ fontSize: 18, color: "#2e7d32", fontWeight: "bold" }}>Loading plant details…</Text>
        </View>
      </MainLayout>
    );
  }

  if (!plant) {
    return (
      <MainLayout currentTab="plants" onTabPress={handleTabPress}>
        <View style={styles.center}>
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
        </View>
      </MainLayout>
    );
  }

  const dash = '—';
  const care = plant.care_info || {};
  const schedule = plant.schedule || {};

  // Pet icon color and value
  let petIconColor = '#826C5E', petValue = dash;
  if (care.pets === 'poisonous') { petIconColor = '#D90429'; petValue = '❌ Poisonous'; }
  else if (care.pets === 'not poisonous') { petIconColor = '#59BA2C'; petValue = '✔️ Safe'; }
  else if (care.pets === 'unknown') { petIconColor = '#826C5E'; petValue = 'Unknown'; }

  // Care Info (Temperature is always one row, never wrapped)
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
      value: care.temperature_min_c && care.temperature_max_c
        ? `${care.temperature_min_c}°–${care.temperature_max_c}°C`
        : care.temperature_min_c
        ? `${care.temperature_min_c}°C`
        : care.temperature_max_c
        ? `${care.temperature_max_c}°C`
        : dash,
      oneLine: true,
    },
    {
      icon: <MaterialIcons name="pets" size={22} color={petIconColor} />,
      label: 'Pets',
      value: petValue,
    },
    {
      icon: <MaterialIcons name="fitness-center" size={22} color="#8663DC" />,
      label: 'Difficulty',
      value: care.difficulty ? `${care.difficulty} / 10` : dash,
    },
  ];

  const formatSchedule = (item) =>
    item && item.amount
      ? `every ${item.amount} ${item.unit || ''}`.trim()
      : dash;

  const scheduleInfo = [
    {
      icon: <MaterialIcons name="event" size={22} color="#4CAF50" />,
      label: 'Water',
      value: formatSchedule(schedule.water),
    },
    {
      icon: <MaterialIcons name="local-florist" size={22} color="#7CB518" />,
      label: 'Feed',
      value: formatSchedule(schedule.feed),
    },
    {
      icon: <MaterialIcons name="change-history" size={22} color="#8B5CF6" />,
      label: 'Repot',
      value: formatSchedule(schedule.repot),
    },
  ];

  const problems = Array.isArray(plant.common_problems) ? plant.common_problems : [];

  return (
    <MainLayout currentTab="plants" onTabPress={handleTabPress}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={28} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {plant.common_name || plant.scientific_name || 'Plant details'}
        </Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.contentContainer}>
        {/* Plant Image */}
        {!!plant.image_url && (
          <Image source={{ uri: plant.image_url }} style={styles.image} />
        )}
        <Text style={styles.commonName}>{plant.common_name || dash}</Text>
        <Text style={styles.latinName}>{plant.scientific_name || dash}</Text>

        {/* Care Info Section */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Care Info</Text>
          {careInfo.map((item, idx) => (
            <View
              style={[
                styles.infoRow,
                item.oneLine && { flexWrap: 'nowrap', alignItems: 'center' }
              ]}
              key={item.label}
            >
              <View style={styles.infoIcon}>{item.icon}</View>
              {item.oneLine ? (
                <>
                  <Text style={[styles.infoLabel, { flexShrink: 0, minWidth: 90 }]}>{item.label}:</Text>
                  <Text style={[styles.infoValue, { flex: 1, flexWrap: 'nowrap' }]}>{item.value}</Text>
                </>
              ) : (
                <>
                  <Text style={styles.infoLabel}>{item.label}:</Text>
                  <Text style={styles.infoValue}>{item.value}</Text>
                </>
              )}
            </View>
          ))}
        </View>

        {/* Schedule Section */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Schedule & Maintenance</Text>
          {scheduleInfo.map((item) => (
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

        {/* Common Problems */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>
            <Feather name="alert-triangle" size={22} color="#e68c29" /> Common Problems
          </Text>
          {problems.length === 0 ? (
            <Text style={styles.sectionBody}>No common problems known for this plant.</Text>
          ) : (
            problems.map((problem, idx) => (
              <View key={idx} style={styles.problemItem}>
                <Text style={styles.problemName}>
                  <Feather name="alert-circle" size={17} color="#e68c29" /> {problem.name}
                </Text>
                <Text style={styles.problemDesc}>{problem.description}</Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </MainLayout>
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
  sectionTitle: { fontSize: 20, fontWeight: '700', marginBottom: 10, color: '#3a4b37', flexDirection: 'row', alignItems: 'center' },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    paddingLeft: 4,
    flexWrap: 'nowrap',
  },
  infoIcon: { width: 30, alignItems: 'center' },
  infoLabel: { fontSize: 17, fontWeight: 'bold', marginRight: 7, color: '#333', width: 90, flexShrink: 0 },
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
  // --- Problems section
  problemItem: { marginBottom: 10, marginLeft: 6 },
  problemName: { fontSize: 16, fontWeight: '600', color: '#be7d13', flexDirection: 'row', alignItems: 'center' },
  problemDesc: { fontSize: 14, color: '#684e23', marginLeft: 6, marginTop: 2 },
  imageContainer: {
    alignItems: "center",
    marginBottom: 20,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 15,
    boxShadow: "0px 8px 8px rgba(0, 0, 0, 0.06)",
    elevation: 4,
  },
});
