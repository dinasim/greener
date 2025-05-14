// PlantDetailScreen.js
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
} from 'react-native';
import { Ionicons, MaterialIcons, FontAwesome5 } from '@expo/vector-icons';

const PLANT_SEARCH_URL = 'https://usersfunctions.azurewebsites.net/api/plant_search';
const { width } = Dimensions.get('window');
const IMAGE_HEIGHT = width * 0.6;

export default function PlantDetailScreen({ route, navigation }) {
  const plantId = route?.params?.plantId;
  const [plant, setPlant] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!plantId) return;
    (async () => {
      try {
        const res = await fetch(`${PLANT_SEARCH_URL}?name=${encodeURIComponent(plantId)}`);
        const data = await res.json();
        if (data.length) setPlant(data[0]);
      } catch (e) {
        console.warn(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [plantId]);

  if (loading) return <ActivityIndicator style={styles.loader} size="large" />;

  if (!plant) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.message}>No data available</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={28} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{plant.common_name || plant.latin_name}</Text>
        <TouchableOpacity onPress={() => {/* share logic */}}>
          <Ionicons name="share-social-outline" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.contentContainer}>
        {/* Image */}
        {plant.image_urls?.[0] && (
          <Image
            source={{ uri: plant.image_urls[0] }}
            style={styles.image}
          />
        )}

        {/* Names */}
        <Text style={styles.commonName}>{plant.common_name || '—'}</Text>
        <Text style={styles.latinName}>{plant.latin_name || '—'}</Text>

        {/* Info Cards */}
        <View style={styles.infoRow}>
          <View style={styles.infoCard}>
            <MaterialIcons name="wb-sunny" size={24} color="#e1c699" />
            <Text style={styles.infoText}>{plant.shade || 'N/A'}</Text>
          </View>
          <View style={styles.infoCard}>
            <Ionicons name="water" size={24} color="#69a6f9" />
            <Text style={styles.infoText}>{plant.moisture || 'N/A'}</Text>
          </View>
          <View style={styles.infoCard}>
            <FontAwesome5 name="temperature-low" size={24} color="#f07a5f" />
            <Text style={styles.infoText}>
              {plant.temperature?.min || '-'}° - {plant.temperature?.max || '-'}°
            </Text>
          </View>
          <View style={styles.infoCard}>
            <MaterialIcons name="speed" size={24} color="#a3d9a5" />
            <Text style={styles.infoText}>{plant.care_difficulty || 'N/A'}</Text>
          </View>
        </View>

        {/* Sections */}
        <Text style={styles.sectionTitle}>Care Tips</Text>
        <Text style={styles.sectionBody}>{plant.care_tips || 'No care tips available.'}</Text>

        <Text style={styles.sectionTitle}>Propagation</Text>
        <Text style={styles.sectionBody}>{plant.propagation || 'No propagation info.'}</Text>

        <Text style={styles.sectionTitle}>Family</Text>
        <Text style={styles.sectionBody}>{plant.family_common_name || 'Unknown'}</Text>
      </ScrollView>

      {/* Bottom Nav */}
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => navigation.navigate('Home')}>
          <Ionicons name="home" size={28} color="#555" />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.navigate('Locations')}>
          <Ionicons name="leaf" size={28} color="#555" />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.navigate('MainTabs')}>
          <Ionicons name="cart" size={28} color="#555" />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.navigate('Notifications')}>
          <Ionicons name="notifications" size={28} color="#555" />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  message: { fontSize: 16, marginBottom: 12 },
  backBtn: { padding: 10, backgroundColor: '#2e7d32', borderRadius: 6 },
  backText: { color: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#2e7d32', padding: 12 },
  headerTitle: { flex: 1, textAlign: 'center', color: '#fff', fontSize: 18, fontWeight: '600' },
  contentContainer: { padding: 16, paddingBottom: 120 },
  image: { width: '100%', height: IMAGE_HEIGHT, borderRadius: 12, marginBottom: 16 },
  commonName: { fontSize: 24, fontWeight: '700', textAlign: 'center' },
  latinName: { fontSize: 16, fontStyle: 'italic', color: '#666', textAlign: 'center', marginBottom: 16 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },
  infoCard: { flex: 1, alignItems: 'center' },
  infoText: { marginTop: 6, fontSize: 14, color: '#333' },
  sectionTitle: { fontSize: 18, fontWeight: '600', marginTop: 16 },
  sectionBody: { fontSize: 14, color: '#444', marginTop: 8, lineHeight: 20 },
  navBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center',
    height: 60, backgroundColor: '#fafafa', borderTopWidth: 1, borderColor: '#ddd'
  },
});
