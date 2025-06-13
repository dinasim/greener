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
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import HomeToolbar from '../components/HomeTool';
import AsyncStorage from '@react-native-async-storage/async-storage';

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

export default function HomeScreen({ navigation }) {
  const [greeting, setGreeting] = useState('');
  const [showPopup, setShowPopup] = useState(false);
  const fadeAnim = useState(new Animated.Value(0))[0];
  const [activeTab, setActiveTab] = useState('today');
  const [plants, setPlants] = useState([]);
  const [loading, setLoading] = useState(true);

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

  const handleAddPress = () => setShowPopup(true);
  const handleOptionPress = (type) => {
    setShowPopup(false);
    if (type === 'plant') navigation.navigate('AddPlant');
    else if (type === 'site') navigation.navigate('AddSite');
  };

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

      {loading ? (
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
      )}

      {/* Floating buttons */}
      <View style={styles.floatingContainer}>
        <TouchableOpacity style={styles.floatingButton} onPress={() => navigation.navigate('SearchPlants')}>
          <Ionicons name="search" size={32} color="#4CAF50" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.addButton} onPress={handleAddPress}>
          <Ionicons name="add" size={36} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Add Plant popup */}
      <Modal transparent visible={showPopup} animationType="slide" onRequestClose={() => setShowPopup(false)}>
        <TouchableOpacity style={styles.popupOverlay} onPress={() => setShowPopup(false)}>
          <View style={styles.modalContent}>
            <TouchableOpacity style={styles.popupOption} onPress={() => handleOptionPress('plant')}>
              <Text style={styles.modalButtonText}>🌿 Add Plant</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.popupOption} onPress={() => handleOptionPress('site')}>
              <Text style={styles.modalButtonText}>📍 Add Site</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

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
  floatingContainer: {
    position: 'absolute', bottom: 70, right: 25, alignItems: 'center',
  },
  floatingButton: { marginBottom: 12 },
  addButton: {
    backgroundColor: '#2e7d32', width: 64, height: 64,
    borderRadius: 32, justifyContent: 'center', alignItems: 'center',
    elevation: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3, shadowRadius: 4,
  },
  popupOverlay: {
    flex: 1, backgroundColor: '#00000088', justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff', borderRadius: 16, padding: 16,
    width: width * 0.6, alignSelf: 'flex-end', elevation: 5,
  },
  popupOption: { paddingVertical: 14 },
  modalButtonText: { fontSize: 16, color: '#333', textAlign: 'right' },
});
