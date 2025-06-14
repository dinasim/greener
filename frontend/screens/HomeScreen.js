import React, { useState, useEffect } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  FlatList,
  Image,
  Animated,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import HomeToolbar from '../components/HomeTool';
import AsyncStorage from '@react-native-async-storage/async-storage';
import PlantCareForumScreen from './PlantCareForumScreen';
import SearchPlantScreen from './SearchPlantScreen';
import AddPlantScreen from './AddPlantScreen';
import LocationsScreen from './LocationsScreen';
import DiseaseCheckerScreen from './DiseaseCheckerScreen';

const { width } = Dimensions.get('window');
const API_URL = 'https://usersfunctions.azurewebsites.net/api/getalluserplants';

function daysUntil(dateStr) {
  if (!dateStr) return 9999;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  return Math.floor((target - today) / (1000 * 60 * 60 * 24));
}

const MAIN_TABS = [
  { key: 'home', label: 'Home', icon: <MaterialIcons name="home" size={20} color="#2e7d32" /> },
  { key: 'plants', label: 'My Plants', icon: <Ionicons name="leaf" size={20} color="#4CAF50" /> },
  { key: 'marketplace', label: 'Market', icon: <Ionicons name="cart-outline" size={20} color="#FF9800" /> },
  { key: 'disease', label: 'Disease', icon: <Ionicons name="medkit" size={20} color="#F44336" /> },
  { key: 'forum', label: 'Forum', icon: <MaterialCommunityIcons name="forum" size={20} color="#2196F3" /> },
  { key: 'search', label: 'Search', icon: <Ionicons name="search" size={20} color="#9C27B0" /> },
  { key: 'add', label: 'Add', icon: <Ionicons name="add-circle" size={20} color="#673AB7" /> },
];

// Add component for Add tab options
const AddTabContent = ({ navigation }) => {
  return (
    <View style={styles.addTabContainer}>
      <Text style={styles.addTabTitle}>What would you like to add?</Text>
      
      <TouchableOpacity 
        style={styles.addOption}
        onPress={() => navigation.navigate('AddPlant')}
      >
        <View style={styles.addOptionIcon}>
          <Ionicons name="leaf" size={30} color="#4CAF50" />
        </View>
        <Text style={styles.addOptionText}>🌿 Add Plant</Text>
        <Text style={styles.addOptionDesc}>Add a new plant to your collection</Text>
      </TouchableOpacity>

      <TouchableOpacity 
        style={styles.addOption}
        onPress={() => navigation.navigate('AddSite')}
      >
        <View style={styles.addOptionIcon}>
          <Ionicons name="location" size={30} color="#FF9800" />
        </View>
        <Text style={styles.addOptionText}>📍 Add Site</Text>
        <Text style={styles.addOptionDesc}>Create a new location for your plants</Text>
      </TouchableOpacity>
    </View>
  );
};

export default function HomeScreen({ navigation }) {
  const [greeting, setGreeting] = useState('');
  const [activeTab, setActiveTab] = useState('today');
  const [plants, setPlants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mainTab, setMainTab] = useState('home');
  const fadeAnim = useState(new Animated.Value(0))[0]; // Add this missing line

  // Handle navigation for tabs that should navigate immediately
  useEffect(() => {
    if (mainTab === 'plants') {
      navigation.navigate('Locations');
      setMainTab('home'); // Reset to home after navigation
    } else if (mainTab === 'marketplace') {
      navigation.navigate('MainTabs');
      setMainTab('home'); // Reset to home after navigation
    } else if (mainTab === 'disease') {
      navigation.navigate('DiseaseChecker');
      setMainTab('home'); // Reset to home after navigation
    } else if (mainTab === 'search') {
      navigation.navigate('SearchScreen');
      setMainTab('home'); // Reset to home after navigation
    } else if (mainTab === 'add') {
      navigation.navigate('AddOptionsScreen');
      setMainTab('home'); // Reset to home after navigation
    } else if (mainTab === 'forum') {
      navigation.navigate('PlantCareForumScreen');
      setMainTab('home'); // Reset to home after navigation
    }
  }, [mainTab, navigation]);

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Good morning');
    else if (hour < 18) setGreeting('Good afternoon');
    else setGreeting('Good evening');

    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: false,
    }).start();
  }, []);

  useEffect(() => {
    const fetchPlants = async () => {
      setLoading(true);
      try {
        let userEmail = await AsyncStorage.getItem('userEmail');
        if (!userEmail) {
          setPlants([]);
          setLoading(false);
          return;
        }
        const res = await fetch(`${API_URL}?email=${encodeURIComponent(userEmail)}`);
        if (!res.ok) throw new Error('Failed to fetch');
        const data = await res.json();
        // data = [{ location: 'Living Room', plants: [ {...}, ... ] }, ...]
        let allPlants = [];
        if (Array.isArray(data)) {
          data.forEach(locationObj => {
            if (locationObj.plants && Array.isArray(locationObj.plants)) {
              // add location to plant if not present
              locationObj.plants.forEach(p => {
                allPlants.push({ ...p, location: p.location || locationObj.location });
              });
            }
          });
        }
        setPlants(allPlants);
      } catch (e) {
        setPlants([]);
      }
      setLoading(false);
    };
    fetchPlants();
  }, []);

  // Filter by selected tab (by next_water)
  const filteredPlants = plants.filter((plant) => {
    const days = daysUntil(plant.next_water);
    if (activeTab === 'today') return days <= 0; // due/overdue
    if (activeTab === 'upcoming') return days > 0 && days <= 3; // next 3 days
    return false;
  });

  const renderItem = ({ item }) => {
    const days = daysUntil(item.next_water);
    let status = '';
    let statusColor = '#2e7d32';
    if (days < 0) {
      status = `Late by ${Math.abs(days)} day${Math.abs(days) !== 1 ? 's' : ''}`;
      statusColor = 'red';
    } else if (days === 0) {
      status = 'Water today';
      statusColor = '#e2b400';
    } else {
      status = `In ${days} day${days !== 1 ? 's' : ''}`;
      statusColor = '#2e7d32';
    }

    return (
      <View style={styles.taskCard}>
        <Image source={item.image_url ? { uri: item.image_url } : require('../assets/plant-placeholder.png')} style={styles.plantImage} />
        <View style={styles.taskInfo}>
          <Text style={styles.plantName}>{item.nickname || item.common_name}</Text>
          <Text style={styles.location}>{item.location}</Text>
          <Text style={[styles.statusText, { color: statusColor }]}>
            {status}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <Animated.View style={[styles.header, { opacity: fadeAnim }]}>
        <Text style={styles.greeting}>{greeting}</Text>
      </Animated.View>

      {/* Main Tabs */}
      <View style={styles.mainTabsRow}>
        {MAIN_TABS.map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.mainTab, mainTab === tab.key && styles.activeMainTab]}
            onPress={() => setMainTab(tab.key)}
          >
            {tab.icon}
            <Text style={[styles.mainTabLabel, mainTab === tab.key && styles.activeMainTabLabel]}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Only show Today/Upcoming tabs in Home */}
      {mainTab === 'home' && (
        <View style={styles.tabRow}>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setActiveTab('today')}>
            <LinearGradient
              colors={activeTab === 'today' ? ['#a8e063', '#56ab2f'] : ['#f0f0f0', '#e0e0e0']}
              style={activeTab === 'today' ? styles.activeTab : styles.inactiveTab}
            >
              <Text style={activeTab === 'today' ? styles.tabText : styles.tabInactiveText}>Today</Text>
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setActiveTab('upcoming')}>
            <LinearGradient
              colors={activeTab === 'upcoming' ? ['#a8e063', '#56ab2f'] : ['#f0f0f0', '#e0e0e0']}
              style={activeTab === 'upcoming' ? styles.activeTab : styles.inactiveTab}
            >
              <Text style={activeTab === 'upcoming' ? styles.tabText : styles.tabInactiveText}>Upcoming</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}

      {/* Main Tab Content */}
      {mainTab === 'home' && (
        loading ? (
          <ActivityIndicator size="large" color="#4CAF50" style={{ marginTop: 30 }} />
        ) : (
          <FlatList
            data={filteredPlants}
            keyExtractor={(item, idx) => item.id || `${item.nickname || item.common_name}-${idx}`}
            renderItem={renderItem}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContainer}
            ListEmptyComponent={
              <Text style={{ textAlign: 'center', color: '#aaa', marginTop: 40 }}>
                {activeTab === 'today'
                  ? "No plants to water today! 🎉"
                  : "No upcoming watering tasks."}
              </Text>
            }
          />
        )
      )}
      {mainTab === 'forum' && <PlantCareForumScreen navigation={navigation} />}
      {mainTab === 'search' && <SearchPlantScreen navigation={navigation} />}
      {mainTab === 'add' && <AddTabContent navigation={navigation} />}

      <HomeToolbar navigation={navigation} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent', padding: 20, paddingBottom: 90 },
  header: { marginTop: 10, marginBottom: 15 },
  greeting: { fontSize: 30, color: '#2e7d32', fontWeight: 'bold' },
  tabRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  activeTab: {
    paddingVertical: 8, paddingHorizontal: 0, borderRadius: 20,
    justifyContent: 'center', alignItems: 'center', marginHorizontal: 4,
    elevation: 2, flex: 1,
  },
  inactiveTab: {
    paddingVertical: 8, paddingHorizontal: 0, borderRadius: 20,
    justifyContent: 'center', alignItems: 'center', marginHorizontal: 4,
    flex: 1,
  },
  tabText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  tabInactiveText: { color: '#666', fontWeight: 'bold', fontSize: 16 },
  listContainer: { paddingBottom: 100 },
  taskCard: {
    flexDirection: 'row', backgroundColor: '#fff', padding: 15,
    borderRadius: 16, marginBottom: 12, shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1,
    shadowRadius: 4, elevation: 3,
  },
  plantImage: { width: 60, height: 60, borderRadius: 30, marginRight: 15 },
  taskInfo: { justifyContent: 'center' },
  plantName: { fontSize: 18, fontWeight: 'bold', color: '#222' },
  location: { color: '#555' },
  statusText: { marginTop: 4, fontWeight: 'bold' },
  mainTabsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginBottom: 10,
    marginTop: 5,
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    paddingVertical: 6,
    paddingHorizontal: 4,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  mainTab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderRadius: 8,
  },
  activeMainTab: {
    backgroundColor: '#e0f7fa',
  },
  mainTabLabel: {
    fontSize: 10,
    color: '#333',
    marginTop: 2,
    fontWeight: '500',
    textAlign: 'center',
  },
  activeMainTabLabel: {
    color: '#2e7d32',
    fontWeight: 'bold',
  },
  addTabContainer: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  addTabTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2e7d32',
    textAlign: 'center',
    marginBottom: 40,
  },
  addOption: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  addOptionIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },
  addOptionText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  addOptionDesc: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
});
