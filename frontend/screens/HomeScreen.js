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
  ScrollView,
  Platform
} from 'react-native';
import { Ionicons, MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import PlantCareForumScreen from './PlantCareForumScreen';
import SearchPlantScreen from './SearchPlantScreen';
import AddPlantScreen from './AddPlantScreen';
import LocationsScreen from './LocationsScreen';
import DiseaseCheckerScreen from './DiseaseCheckerScreen';
import { useFirebaseNotifications } from '../hooks/useFirebaseNotifications';

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
  const [userEmail, setUserEmail] = useState(null);
  const fadeAnim = useState(new Animated.Value(0))[0]; // Add this missing line

  // Initialize Firebase notifications
  const { isInitialized, hasPermission, token, error } = useFirebaseNotifications(userEmail);

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

  const renderContent = () => {
    switch (activeTab) {
      case 'plants':
        return (
          <View style={styles.content}>
            <Text style={styles.contentTitle}>🌿 My Plants</Text>
            <Text style={styles.contentDescription}>Manage and care for your plant collection</Text>
            
            {/* Quick Actions */}
            <View style={styles.quickActions}>
              <TouchableOpacity 
                style={styles.quickAction}
                onPress={() => navigation.navigate('AddPlant')}
              >
                <View style={styles.quickActionIcon}>
                  <Ionicons name="add" size={24} color="#4CAF50" />
                </View>
                <Text style={styles.quickActionText}>Add Plant</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.quickAction}
                onPress={() => navigation.navigate('Locations')}
              >
                <View style={styles.quickActionIcon}>
                  <Ionicons name="location" size={24} color="#FF9800" />
                </View>
                <Text style={styles.quickActionText}>My Locations</Text>
              </TouchableOpacity>
            </View>

            {/* Notification Status */}
            {userEmail && (
              <View style={styles.notificationStatus}>
                <View style={styles.notificationHeader}>
                  <MaterialIcons name="notifications" size={20} color="#4CAF50" />
                  <Text style={styles.notificationTitle}>Notifications</Text>
                </View>
                <View style={styles.notificationInfo}>
                  <View style={styles.statusRow}>
                    <Text style={styles.statusLabel}>Status:</Text>
                    <View style={[styles.statusIndicator, hasPermission ? styles.statusActive : styles.statusInactive]}>
                      <Text style={styles.statusText}>{hasPermission ? 'Active' : 'Inactive'}</Text>
                    </View>
                  </View>
                  {error && (
                    <Text style={styles.errorText}>⚠️ {error}</Text>
                  )}
                  <TouchableOpacity 
                    style={styles.setupButton}
                    onPress={() => navigation.navigate('NotificationSettings')}
                  >
                    <Text style={styles.setupButtonText}>Manage Notifications</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        );
      case 'marketplace':
        return (
          <View style={styles.content}>
            <Text style={styles.contentTitle}>🛒 Marketplace</Text>
            <Text style={styles.contentDescription}>Buy and sell plants with other enthusiasts</Text>
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => navigation.navigate('MainTabs')}
            >
              <Text style={styles.actionButtonText}>Browse Marketplace</Text>
            </TouchableOpacity>
          </View>
        );
      case 'disease':
        return (
          <DiseaseCheckerScreen navigation={navigation} />
        );
      case 'forum':
        return <PlantCareForumScreen navigation={navigation} />;
      case 'search':
        return <SearchPlantScreen navigation={navigation} />;
      case 'add':
        return <AddTabContent navigation={navigation} />;
      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header with Settings Button */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>Greener</Text>
          <Text style={styles.headerSubtitle}>Your Plant Care Companion</Text>
        </View>
        <TouchableOpacity 
          style={styles.settingsButton}
          onPress={() => navigation.navigate('UserSettings')}
        >
          <MaterialIcons name="settings" size={24} color="#4CAF50" />
        </TouchableOpacity>
      </View>

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

      {/* Content */}
      <View style={styles.contentContainer}>
        {renderContent()}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent', padding: 20, paddingBottom: 20 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2e7d32',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  settingsButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f9f3',
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  listContainer: { paddingBottom: 20 },
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
  content: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  contentTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2e7d32',
    marginBottom: 8,
  },
  contentDescription: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
    lineHeight: 24,
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  quickAction: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    marginHorizontal: 4,
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  quickActionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f9f3',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  quickActionText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  notificationStatus: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  notificationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginLeft: 8,
  },
  notificationInfo: {
    gap: 8,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusLabel: {
    fontSize: 14,
    color: '#666',
  },
  statusIndicator: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusActive: {
    backgroundColor: '#e8f5e8',
  },
  statusInactive: {
    backgroundColor: '#ffebee',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
  },
  errorText: {
    fontSize: 12,
    color: '#f44336',
    marginTop: 4,
  },
  setupButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  setupButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
