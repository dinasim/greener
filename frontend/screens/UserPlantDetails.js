// screens/UserPlantDetailScreen.js

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  Alert,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');
const PLANT_PHOTO_PLACEHOLDER = require('../assets/plant-placeholder.png');

function daysUntil(dateStr) {
  if (!dateStr) return '?';
  const now = new Date();
  const target = new Date(dateStr);
  const diffMs = target - now;
  return diffMs > 0 ? Math.ceil(diffMs / (1000 * 60 * 60 * 24)) : 0;
}

export default function UserPlantDetailScreen({ route, navigation }) {
  const { plant: passedPlant, plantId } = route.params || {};
  const [plant, setPlant] = useState(passedPlant || null);
  const [loading, setLoading] = useState(!passedPlant);

  useEffect(() => {
    if (!plant && plantId) {
      setLoading(true);
      fetch(`https://usersfunctions.azurewebsites.net/api/getuserplantbyid?id=${encodeURIComponent(plantId)}`)
        .then(res => res.json())
        .then(data => setPlant(data))
        .catch(() => Alert.alert('Error', 'Failed to load plant data.'))
        .finally(() => setLoading(false));
    }
  }, [plantId]);

  if (loading || !plant) {
    return (
      <View style={{flex:1, justifyContent:'center', alignItems:'center', backgroundColor:'#f7f7fa'}}>
        <ActivityIndicator size="large" color="#4caf50" />
        <Text style={{marginTop:18}}>Loading plant info…</Text>
      </View>
    );
  }

  // For next care actions in X days
  const nextWaterDays = plant.next_water ? daysUntil(plant.next_water) : '?';
  const nextFeedDays  = plant.next_feed  ? daysUntil(plant.next_feed)  : '?';
  const nextRepotDays = plant.next_repot ? daysUntil(plant.next_repot) : '?';

  return (
    <View style={{ flex: 1, backgroundColor: '#f7f7fa' }}>
      {/* Header with back */}
      <View style={styles.headerRow}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={26} color="#2e7d32" />
          <Text style={{ color: "#2e7d32", fontWeight: "bold", marginLeft: 6, fontSize: 16 }}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{plant.nickname || plant.common_name}</Text>
        <View style={{ width: 34 }} />
      </View>

      <ScrollView contentContainerStyle={styles.container}>

        {/* Plant Image */}
        <Image
          source={plant.image_url ? { uri: plant.image_url } : PLANT_PHOTO_PLACEHOLDER}
          style={styles.image}
        />

        {/* Plant Name & Species */}
        <Text style={styles.name}>{plant.nickname || plant.common_name}</Text>
        <Text style={styles.scientific}>{plant.scientific_name}</Text>

        {/* Origin */}
        <View style={styles.rowCard}>
          <Ionicons name="earth-outline" size={20} color="#388e3c" style={{ marginRight: 7 }} />
          <Text style={styles.rowCardText}>Origin: </Text>
          <Text style={styles.rowCardValue}>{plant.origin || '—'}</Text>
        </View>

        {/* Care summary card */}
        <View style={styles.summaryCard}>
          <View style={styles.careBlock}>
            <Ionicons name="water" size={20} color="#4caf50" />
            <Text style={styles.careTitle}>Water in</Text>
            <Text style={styles.careValue}>{nextWaterDays} days</Text>
          </View>
          <View style={styles.careBlock}>
            <Ionicons name="nutrition" size={20} color="#f9a825" />
            <Text style={styles.careTitle}>Feed in</Text>
            <Text style={styles.careValue}>{nextFeedDays} days</Text>
          </View>
          <View style={styles.careBlock}>
            <MaterialCommunityIcons name="pot-mix" size={20} color="#7e57c2" />
            <Text style={styles.careTitle}>Repot in</Text>
            <Text style={styles.careValue}>{nextRepotDays} days</Text>
          </View>
        </View>

        {/* Care info section */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Care Info</Text>
          <View style={styles.infoRow}>
            <MaterialCommunityIcons name="white-balance-sunny" size={18} color="#ffd600" style={styles.infoIcon} />
            <Text style={styles.infoLabel}>Light:</Text>
            <Text style={styles.infoValue}>{plant.light || "—"}</Text>
          </View>
          <View style={styles.infoRow}>
            <MaterialIcons name="water-drop" size={18} color="#4caf50" style={styles.infoIcon} />
            <Text style={styles.infoLabel}>Humidity:</Text>
            <Text style={styles.infoValue}>{plant.humidity || "—"}</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="thermometer-outline" size={18} color="#e57373" style={styles.infoIcon} />
            <Text style={styles.infoLabel}>Temperature:</Text>
            <Text style={styles.infoValue}>
              {plant.temperature?.min ?? '?'}°–{plant.temperature?.max ?? '?'}°F
            </Text>
          </View>
          <View style={styles.infoRow}>
            <MaterialCommunityIcons name="dog-side" size={18} color="#a1887f" style={styles.infoIcon} />
            <Text style={styles.infoLabel}>Pets:</Text>
            <Text style={styles.infoValue}>{plant.pets || "—"}</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="barbell-outline" size={18} color="#b388ff" style={styles.infoIcon} />
            <Text style={styles.infoLabel}>Difficulty:</Text>
            <Text style={styles.infoValue}>{plant.difficulty ?? "—"} / 10</Text>
          </View>
        </View>

        {/* Schedule & Maintenance */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Schedule & Maintenance</Text>
          <View style={styles.infoRow}>
            <Ionicons name="calendar" size={18} color="#38b000" style={styles.infoIcon} />
            <Text style={styles.infoLabel}>Water every</Text>
            <Text style={styles.infoValue}>{plant.water_days} days</Text>
          </View>
          <View style={styles.infoRow}>
            <MaterialIcons name="grass" size={18} color="#43a047" style={styles.infoIcon} />
            <Text style={styles.infoLabel}>Feed:</Text>
            <Text style={styles.infoValue}>{plant.feed || "—"}</Text>
          </View>
          <View style={styles.infoRow}>
            <MaterialCommunityIcons name="pot-mix" size={18} color="#7e57c2" style={styles.infoIcon} />
            <Text style={styles.infoLabel}>Repot:</Text>
            <Text style={styles.infoValue}>{plant.repot || "—"}</Text>
          </View>
        </View>

        {/* Problems */}
        {plant.common_problems && plant.common_problems.length > 0 && (
          <View style={styles.problemsCard}>
            <Text style={styles.infoTitle}>Common Problems</Text>
            {plant.common_problems.map((prob, idx) => (
              <View key={idx} style={{ marginBottom: 6 }}>
                <Text style={{ fontWeight: "bold", color: "#c62828" }}>• {prob.symptom}</Text>
                <Text style={{ color: "#666", marginLeft: 12 }}>Cause: {prob.cause}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* NAV BAR */}
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => navigation.navigate('Home')}>
          <Ionicons name="home" size={24} color="black" />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.navigate('Locations')}>
          <Ionicons name="leaf" size={24} color="black" />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.navigate('MainTabs')}>
          <Ionicons name="cart-outline" size={24} color="black" />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.navigate('DiseaseChecker')}>
          <Ionicons name="medkit" size={24} color="black" />
        </TouchableOpacity>
      </View>

      <View style={styles.floatingContainer}>
        <TouchableOpacity style={styles.addButton} onPress={() => Alert.alert('Edit', 'Coming soon!')}>
          <Ionicons name="create-outline" size={32} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row', alignItems: 'center', paddingTop: 18, paddingHorizontal: 12, paddingBottom: 2,
    backgroundColor: 'transparent', zIndex: 1, justifyContent: 'space-between'
  },
  backBtn: {
    flexDirection: 'row', alignItems: 'center', padding: 6,
    borderRadius: 10, backgroundColor: "#e6f4ea", alignSelf: 'flex-start'
  },
  headerTitle: { fontWeight: 'bold', fontSize: 21, color: "#205d29" },
  container: { padding: 18, alignItems: 'center', backgroundColor: '#f7f7fa' },
  image: { width: 148, height: 148, borderRadius: 18, borderWidth: 2, borderColor: "#e0f2f1", marginTop: 12, marginBottom: 10 },
  name: { fontSize: 25, fontWeight: "bold", marginTop: 6, marginBottom: 3, color: "#205d29" },
  scientific: { fontStyle: 'italic', fontSize: 15, color: "#666" },

  rowCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: "#e5fae7", borderRadius: 8, padding: 7, marginTop: 6, marginBottom: 6
  },
  rowCardText: { fontWeight: '600', color: "#305f2d" },
  rowCardValue: { marginLeft: 2, color: "#222" },

  summaryCard: {
    flexDirection: 'row', backgroundColor: "#f2fff0", borderRadius: 12, padding: 12, marginVertical: 12,
    width: "98%", justifyContent: 'space-between', elevation: 1
  },
  careBlock: { alignItems: 'center', flex: 1 },
  careTitle: { color: "#666", fontSize: 14, marginTop: 2 },
  careValue: { fontWeight: "bold", color: "#388e3c", fontSize: 16, marginTop: 3 },

  infoCard: {
    backgroundColor: "#fff", borderRadius: 13, padding: 13, width: "99%",
    marginTop: 14, marginBottom: 8, elevation: 1, shadowColor: "#000", shadowOpacity: 0.03, shadowRadius: 2
  },
  infoTitle: { fontWeight: "bold", fontSize: 17, marginBottom: 6, color: "#3b6147" },
  infoRow: { flexDirection: "row", alignItems: "center", marginVertical: 2 },
  infoIcon: { marginRight: 9 },
  infoLabel: { fontWeight: "bold", width: 80, color: "#333" },
  infoValue: { color: "#444", flex: 1 },

  problemsCard: {
    backgroundColor: "#fff5f5", borderRadius: 13, padding: 13, width: "99%",
    marginTop: 18, marginBottom: 10, borderColor: "#ffd6d6", borderWidth: 1
  },

  navBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#eee', flexDirection: 'row',
    justifyContent: 'space-around', alignItems: 'center',
    paddingVertical: 10, borderTopLeftRadius: 20,
    borderTopRightRadius: 20, elevation: 10,
  },
  floatingContainer: {
    position: 'absolute', bottom: 70, right: 25, alignItems: 'center',
  },
  addButton: {
    backgroundColor: '#2e7d32', width: 56, height: 56,
    borderRadius: 28, justifyContent: 'center', alignItems: 'center',
    elevation: 6, shadowColor: "#000", shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2, shadowRadius: 3,
  },
});
