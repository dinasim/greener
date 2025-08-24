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
  Alert,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import MainLayout from '../components/MainLayout';

const PLANT_PHOTO_PLACEHOLDER = require('../assets/plant-placeholder.png');
const DELETE_URL = 'https://usersfunctions.azurewebsites.net/api/userplants/delete';

function daysUntil(dateStr) {
  if (!dateStr) return '?';
  const now = new Date();
  const target = new Date(dateStr);
  const diffMs = target - now;
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

export default function UserPlantDetailScreen({ route, navigation }) {
  const { plant: passedPlant, plantId } = route.params || {};
  const [plant, setPlant] = useState(passedPlant || null);
  const [loading, setLoading] = useState(!passedPlant);
  const [deleting, setDeleting] = useState(false);

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

  const canDelete = Boolean(plant?.id && plant?.email);

  const confirmDelete = () => {
    if (!canDelete) return;
    Alert.alert(
      'Remove plant',
      'This will remove the plant from your collection. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: handleDelete },
      ]
    );
  };

  const handleDelete = async () => {
    if (!canDelete) return;
    try {
      setDeleting(true);
      const resp = await fetch(DELETE_URL, {
        method: 'POST', // your function accepts POST/DELETE
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: plant.id,
          email: plant.email,
          location: plant.location || undefined, // helps clean location index
        }),
      });
      if (!resp.ok) {
        const txt = await resp.text();
        throw new Error(txt || 'Delete failed');
      }
      Alert.alert('Deleted', 'Plant removed from your collection.');
      navigation.navigate('Locations');
    } catch (e) {
      Alert.alert('Error', e.message || String(e));
    } finally {
      setDeleting(false);
    }
  };

  if (loading || !plant) {
    return (
      <MainLayout currentTab="plants" navigation={navigation}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f7f7fa' }}>
          <ActivityIndicator size="large" color="#4caf50" />
          <Text style={{ marginTop: 18 }}>Loading plant info…</Text>
        </View>
      </MainLayout>
    );
  }

  const care = plant.care_info || {};
  const schedule = plant.schedule || {};

  const nextWaterDays = plant.next_water ? daysUntil(plant.next_water) : '?';
  const nextFeedDays = plant.next_feed ? daysUntil(plant.next_feed) : '?';
  const nextRepotDays = plant.next_repot ? daysUntil(plant.next_repot) : '?';

  const actions = [
    {
      key: 'water',
      label: 'Water',
      icon: <Ionicons name="water" size={22} color="#379c41" />,
      next: plant.next_water,
      last: plant.last_watered,
      days: nextWaterDays,
      color: '#4caf50',
    },
    {
      key: 'feed',
      label: 'Feed',
      icon: <MaterialCommunityIcons name="leaf" size={22} color="#f9a825" />,
      next: plant.next_feed,
      last: plant.last_fed,
      days: nextFeedDays,
      color: '#f9a825',
    },
    {
      key: 'repot',
      label: 'Repot',
      icon: <MaterialCommunityIcons name="pot-mix" size={22} color="#7e57c2" />,
      next: plant.next_repot,
      last: plant.last_repotted,
      days: nextRepotDays,
      color: '#7e57c2',
    }
  ];

  async function markTaskDone(key) {
    try {
      const res = await fetch('https://usersfunctions.azurewebsites.net/api/markTaskDone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: plant.id, email: plant.email, task: key, date: new Date().toISOString() }),
      });
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`HTTP ${res.status}: ${errorText}`);
      }
      const updated = await res.json();
      setPlant(updated);
    } catch (err) {
      Alert.alert("Error", "Failed to update task: " + err.message);
    }
  }

  return (
    <MainLayout currentTab="plants" navigation={navigation}>
      <View style={styles.headerRow}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={26} color="#2e7d32" />
          <Text style={{ color: "#2e7d32", fontWeight: "bold", marginLeft: 6, fontSize: 16 }}>Back</Text>
        </TouchableOpacity>

        <Text style={styles.headerTitle} numberOfLines={1}>
          {plant.nickname || plant.common_name}
        </Text>

        {canDelete ? (
          <TouchableOpacity onPress={confirmDelete} disabled={deleting} style={styles.deleteBtn}>
            {deleting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Ionicons name="trash" size={20} color="#fff" />
            )}
          </TouchableOpacity>
        ) : (
          <View style={{ width: 34 }} />
        )}
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 90 }}>
        {/* Plant image & name */}
        <View style={styles.heroBox}>
          <Image
            source={plant.image_url ? { uri: plant.image_url } : PLANT_PHOTO_PLACEHOLDER}
            style={styles.image}
          />
          <Text style={styles.name}>{plant.nickname || plant.common_name || '—'}</Text>
          <Text style={styles.scientific}>{plant.scientific_name || '—'}</Text>
        </View>

        {/* Task summary row */}
        <View style={styles.tasksRow}>
          {actions.map((act) => {
            let status = '';
            let statusColor = act.color;
            const days = parseInt(act.days);
            if (Number.isFinite(days)) {
              if (days < 0) { status = `${Math.abs(days)}d late`; statusColor = "#D90429"; }
              else if (days === 0) { status = "Today"; statusColor = "#e68c29"; }
              else { status = `in ${days}d`; }
            } else {
              status = '—';
            }
            return (
              <View key={act.key} style={styles.kpiCard}>
                <View style={[styles.kpiIconCircle, { borderColor: act.color }]}>
                  {act.icon}
                </View>
                <Text style={styles.kpiLabel}>{act.label}</Text>
                <Text style={[styles.kpiStatus, { color: statusColor }]}>{status}</Text>
                <Text style={styles.kpiLast}>Last: {formatDate(act.last)}</Text>
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: act.color }]}
                  onPress={() => markTaskDone(act.key)}
                >
                  <Ionicons name="checkmark" size={18} color="#fff" />
                </TouchableOpacity>
              </View>
            );
          })}
        </View>

        {/* Care Info Card */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Care Info</Text>
          <View style={styles.infoRow}>
            <MaterialCommunityIcons name="white-balance-sunny" size={18} color="#ffd600" style={styles.infoIcon} />
            <Text style={styles.infoLabel}>Light:</Text>
            <Text style={styles.infoValue}>{care.light || plant.light || "—"}</Text>
          </View>
          <View style={styles.infoRow}>
            <MaterialCommunityIcons name="water" size={18} color="#4caf50" style={styles.infoIcon} />
            <Text style={styles.infoLabel}>Humidity:</Text>
            <Text style={styles.infoValue}>{care.humidity || plant.humidity || "—"}</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="thermometer-outline" size={18} color="#e57373" style={styles.infoIcon} />
            <Text style={styles.infoLabel}>Temperature:</Text>
            <Text style={styles.infoValue}>
              {care.temperature_min_c != null && care.temperature_max_c != null
                ? `${care.temperature_min_c}°C – ${care.temperature_max_c}°C`
                : plant.temperature?.min != null && plant.temperature?.max != null
                  ? `${plant.temperature.min}°C – ${plant.temperature.max}°C`
                  : "—"}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <MaterialCommunityIcons name="dog-side" size={18} color="#a1887f" style={styles.infoIcon} />
            <Text style={styles.infoLabel}>Pets:</Text>
            <Text style={styles.infoValue}>{care.pets || plant.pets || "—"}</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="barbell-outline" size={18} color="#b388ff" style={styles.infoIcon} />
            <Text style={styles.infoLabel}>Difficulty:</Text>
            <Text style={styles.infoValue}>
              {care.difficulty != null && care.difficulty !== "" ? `${care.difficulty} / 10`
                : plant.difficulty != null ? `${plant.difficulty} / 10` : "—"}
            </Text>
          </View>
        </View>

        {/* Schedule & Maintenance Card */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Schedule & Maintenance</Text>
          <View style={styles.infoRow}>
            <Ionicons name="calendar" size={18} color="#38b000" style={styles.infoIcon} />
            <Text style={styles.infoLabel}>Water:</Text>
            <Text style={styles.infoValue}>
              {schedule.water && schedule.water.amount
                ? `every ${schedule.water.amount} ${schedule.water.unit || ''}`
                : plant.water_days ? `every ${plant.water_days} days` : '—'}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <MaterialIcons name="grass" size={18} color="#43a047" style={styles.infoIcon} />
            <Text style={styles.infoLabel}>Feed:</Text>
            <Text style={styles.infoValue}>
              {schedule.feed && schedule.feed.amount
                ? `every ${schedule.feed.amount} ${schedule.feed.unit || ''}`
                : plant.feed || '—'}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <MaterialCommunityIcons name="pot-mix" size={18} color="#7e57c2" style={styles.infoIcon} />
            <Text style={styles.infoLabel}>Repot:</Text>
            <Text style={styles.infoValue}>
              {schedule.repot && schedule.repot.amount
                ? `every ${schedule.repot.amount} ${schedule.repot.unit || ''}`
                : plant.repot || '—'}
            </Text>
          </View>
        </View>

        {/* Problems */}
        {plant.common_problems && plant.common_problems.length > 0 && (
          <View style={styles.problemsCard}>
            <Text style={styles.infoTitle}>Common Problems</Text>
            {plant.common_problems.map((prob, idx) => (
              <View key={idx} style={{ marginBottom: 7 }}>
                <Text style={{ fontWeight: "bold", color: "#c62828" }}>
                  • {prob.name || prob.symptom || "Unknown problem"}
                </Text>
                <Text style={{ color: "#7e5a26", marginLeft: 10 }}>{prob.description || prob.cause || ""}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </MainLayout>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 18,
    paddingHorizontal: 12,
    paddingBottom: 2,
    backgroundColor: 'transparent',
    zIndex: 1,
    justifyContent: 'space-between'
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 6,
    borderRadius: 10,
    backgroundColor: "#e6f4ea",
    alignSelf: 'flex-start'
  },
  headerTitle: { fontWeight: 'bold', fontSize: 21, color: "#205d29", flex: 1, textAlign: 'center' },
  deleteBtn: {
    backgroundColor: '#d32f2f',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    minWidth: 34,
    alignItems: 'center',
    justifyContent: 'center'
  },

  heroBox: { alignItems: 'center', marginTop: 10, marginBottom: 12, paddingBottom: 2 },
  image: { width: 122, height: 122, borderRadius: 16, borderWidth: 2, borderColor: "#e0f2f1", marginBottom: 7 },
  name: { fontSize: 25, fontWeight: "bold", marginTop: 6, marginBottom: 3, color: "#205d29", textAlign: 'center' },
  scientific: { fontStyle: 'italic', fontSize: 15, color: "#666", textAlign: 'center', marginBottom: 6 },

  // Task row - KPI style
  tasksRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    backgroundColor: "#fff",
    borderRadius: 16,
    marginHorizontal: 10,
    marginBottom: 18,
    paddingVertical: 10,
    paddingHorizontal: 6,
    elevation: 2,
  },
  kpiCard: { alignItems: "center", flex: 1, paddingHorizontal: 2, marginHorizontal: 4, minWidth: 90, maxWidth: 130 },
  kpiIconCircle: {
    width: 38, height: 38, borderRadius: 19, borderWidth: 2,
    alignItems: "center", justifyContent: "center", marginBottom: 4, backgroundColor: "#f7fff9"
  },
  kpiLabel: { fontWeight: "bold", fontSize: 14, color: "#206d32", marginTop: 1, marginBottom: 2 },
  kpiStatus: { fontWeight: "bold", fontSize: 15, marginBottom: 0 },
  kpiLast: { color: "#999", fontSize: 11, marginBottom: 4, marginTop: 1 },
  actionBtn: {
    backgroundColor: "#4caf50", borderRadius: 13, paddingVertical: 5, paddingHorizontal: 13,
    alignItems: "center", marginTop: 4, alignSelf: "center"
  },

  // Care & info cards
  infoCard: {
    backgroundColor: "#fff",
    borderRadius: 13,
    padding: 13,
    width: "95%",
    alignSelf: "center",
    marginTop: 11,
    marginBottom: 11,
    elevation: 1,
    boxShadow: "0px 1px 2px rgba(0, 0, 0, 0.03)",
  },
  infoTitle: { fontWeight: "bold", fontSize: 17, marginBottom: 8, color: "#3b6147" },
  infoRow: { flexDirection: "row", alignItems: "center", marginVertical: 2 },
  infoIcon: { marginRight: 9 },
  infoLabel: { fontWeight: "bold", width: 90, color: "#333" },
  infoValue: { color: "#444", flex: 1, fontSize: 14 },

  // Problems card
  problemsCard: {
    backgroundColor: "#fff5f5",
    borderRadius: 13,
    padding: 13,
    width: "95%",
    alignSelf: "center",
    marginTop: 18,
    marginBottom: 10,
    borderColor: "#ffd6d6",
    borderWidth: 1
  },
});
