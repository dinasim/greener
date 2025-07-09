import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Image,
  Dimensions,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useForm } from '../context/FormContext';
import { Ionicons } from '@expo/vector-icons';
import NavigationBar from '../components/NavigationBar';

const PLANT_PHOTO_PLACEHOLDER = require('../assets/plant-placeholder.png');
// const GEAR_ICON = require('../assets/gear.png'); // Use Ionicons for gear if you don't have a PNG

const { width } = Dimensions.get('window');

export default function LocationPlantsScreen() {
  const navigation = useNavigation();
  const { formData } = useForm();

  const [plants, setPlants] = useState([]);
  const [locations, setLocations] = useState([]);
  const [tab, setTab] = useState('Sites');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (formData?.email) fetchPlants();
  }, [formData?.email]);

  const fetchPlants = async () => {
    setLoading(true);
    try {
      const res = await fetch(`https://usersfunctions.azurewebsites.net/api/getalluserplants?email=${formData.email}`);
      const data = await res.json();
      setPlants(data || []);
      setLocations(Array.from(new Set((data || []).map(p => p.location))));
    } catch {
      setPlants([]); setLocations([]);
    } finally {
      setLoading(false);
    }
  };

  // Sites: Card per location, showing big plant image and site stats
  const renderSiteCard = (loc) => {
    const sitePlants = plants.filter(p => p.location === loc);
    const firstPlantImg = sitePlants[0]?.image_url;
    return (
      <TouchableOpacity
        key={loc}
        style={styles.siteCard}
        onPress={() => navigation.navigate('LocationPlants', { location: loc })}
        activeOpacity={0.85}
      >
        <Image
          source={firstPlantImg ? { uri: firstPlantImg } : PLANT_PHOTO_PLACEHOLDER}
          style={styles.siteImage}
        />
        <View style={styles.siteInfo}>
          <Text style={styles.siteName}>{loc}</Text>
          <Text style={styles.siteDetails}>{sitePlants.length} plant{sitePlants.length !== 1 ? 's' : ''}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>My Plants</Text>
          <Text style={styles.headerSub}>
            {plants.length} plant • {locations.length} site
          </Text>
        </View>
        <TouchableOpacity
          style={styles.gearBtn}
          onPress={() => navigation.navigate('Settings')}
        >
          <Ionicons name="settings-outline" size={24} color="#647264" />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabBar}>
        {['Sites', 'Plants'].map(tabLabel => (
          <TouchableOpacity
            key={tabLabel}
            style={[styles.tabBtn, tab === tabLabel && styles.activeTab]}
            onPress={() => setTab(tabLabel)}
          >
            <Text style={[styles.tabText, tab === tabLabel && styles.activeTabText]}>{tabLabel}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Sites List */}
      {tab === 'Sites' && (
        <FlatList
          data={locations}
          renderItem={({ item }) => renderSiteCard(item)}
          keyExtractor={(item) => item}
          contentContainerStyle={styles.siteList}
          ListEmptyComponent={
            !loading && (
              <View style={styles.emptyState}>
                <Ionicons name="leaf-outline" size={70} color="#e0e0e0" style={{ marginBottom: 10 }} />
                <Text style={styles.emptyText}>No sites found!</Text>
              </View>
            )
          }
        />
      )}

      {/* Plants List */}
      {tab === 'Plants' && (
        <FlatList
          data={plants}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.plantCard}
              onPress={() => navigation.navigate('UserPlantDetail', { plantId: item.id })}
            >
              <Image
                source={item.image_url ? { uri: item.image_url } : PLANT_PHOTO_PLACEHOLDER}
                style={styles.plantImg}
              />
              <View style={styles.plantInfo}>
                <Text style={styles.plantName}>{item.nickname || item.common_name || item.scientific_name}</Text>
                <Text style={styles.plantSpecies}>{item.scientific_name}</Text>
                <View style={styles.waterRow}>
                  <Ionicons name="water" size={16} color="#4caf50" />
                  <Text style={styles.waterText}>Every {item.water_days} days</Text>
                </View>
              </View>
            </TouchableOpacity>
          )}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.plantList}
          ListEmptyComponent={
            !loading && (
              <View style={styles.emptyState}>
                <Ionicons name="leaf-outline" size={70} color="#e0e0e0" style={{ marginBottom: 10 }} />
                <Text style={styles.emptyText}>No plants found!</Text>
              </View>
            )
          }
        />
      )}
      <NavigationBar currentTab="plants" navigation={navigation} />
    </SafeAreaView>
  );
}

const CARD_RADIUS = 18;
const PLANT_CARD_WIDTH = (width - 60) / 2;

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 12,
    backgroundColor: '#fff',
    justifyContent: 'space-between',
  },
  headerTitle: { fontSize: 36, fontWeight: 'bold', color: '#273d1a', marginBottom: 3 },
  headerSub: { color: '#657465', fontSize: 16, marginLeft: 2, marginBottom: 2 },
  gearBtn: { padding: 6, borderRadius: 99, backgroundColor: '#f3f3f5' },
  headerCenter: {
    flex: 1,
    alignItems: 'flex-start',
  },

  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    justifyContent: 'center',
    marginVertical: 6,
    marginBottom: 10,
  },
  tabBtn: {
    marginHorizontal: 6,
    paddingVertical: 8,
    paddingHorizontal: 22,
    borderRadius: 18,
    backgroundColor: 'transparent',
  },
  activeTab: { backgroundColor: '#d9f8c7' },
  tabText: { fontSize: 18, color: '#657465', fontWeight: '600' },
  activeTabText: { color: '#212d1a' },

  siteList: { paddingBottom: 100 },
  siteCard: {
    backgroundColor: '#eafbe2',
    borderRadius: 23,
    marginHorizontal: 12,
    marginBottom: 20,
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 3,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOpacity: 0.08,
        shadowRadius: 2,
        shadowOffset: { width: 0, height: 1 },
      },
      android: {
        elevation: 3,
      },
      web: {
        boxShadow: "0px 2px 4px rgba(0, 0, 0, 0.08)",
      },
    }),
    padding: 8,
  },
  siteImage: {
    width: 90, height: 90, borderRadius: 18, marginRight: 16, backgroundColor: '#d7ffdf',
  },
  siteInfo: { flex: 1 },
  siteName: { fontSize: 22, fontWeight: 'bold', color: '#233', marginBottom: 2 },
  siteDetails: { fontSize: 15, color: '#516d44', marginBottom: 2 },

  plantList: { paddingHorizontal: 14, paddingBottom: 100 },
  plantCard: {
    flexDirection: 'row',
    backgroundColor: '#f6fbf6',
    borderRadius: 16,
    marginBottom: 14,
    alignItems: 'center',
    padding: 8,
    elevation: 2,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOpacity: 0.04,
        shadowRadius: 1,
        shadowOffset: { width: 0, height: 1 },
      },
      android: {
        elevation: 2,
      },
      web: {
        boxShadow: "0px 1px 2px rgba(0, 0, 0, 0.04)",
      },
    }),
    marginHorizontal: 8,
  },
  plantImg: {
    width: 65,
    height: 65,
    borderRadius: 13,
    backgroundColor: '#e3ffe3',
    marginRight: 14,
  },
  plantInfo: { flex: 1 },
  plantName: { fontSize: 18, fontWeight: 'bold', color: '#273d1a' },
  plantSpecies: { color: '#657465', marginTop: 2, fontSize: 14 },
  waterRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  waterText: { color: '#57a66b', marginLeft: 4, fontSize: 13 },

  photoList: { paddingHorizontal: 8, paddingBottom: 100 },
  photoCard: {
    width: (width - 56) / 3,
    backgroundColor: '#e6ffe8',
    borderRadius: 15,
    marginBottom: 14,
    marginHorizontal: 3,
    alignItems: 'center',
    padding: 6,
    elevation: 1,
  },
  photoImg: {
    width: '100%',
    height: 70,
    borderRadius: 13,
    marginBottom: 4,
    backgroundColor: '#e6ffe5'
  },
  photoLabel: {
    fontWeight: 'bold', color: '#143d14', fontSize: 13, marginBottom: 1,
  },
  photoLoc: { fontSize: 11, color: '#49874f' },

  emptyState: { alignItems: 'center', marginTop: 60 },
  emptyText: { color: "#b6bdb1", fontSize: 20, fontWeight: 'bold' },
});
