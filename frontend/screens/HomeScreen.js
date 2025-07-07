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
  Platform,
  RefreshControl
} from 'react-native';
import { Ionicons, MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import PlantCareForumScreen from './PlantCareForumScreen';
import SearchPlantScreen from './SearchPlantScreen';
import AddPlantScreen from './AddPlantScreen';
import LocationsScreen from './LocationsScreen';
import DiseaseCheckerScreen from './DiseaseCheckerScreen';
import { useUniversalNotifications } from '../hooks/useUniversalNotifications';
import { 
  getWeatherData, 
  generateWateringAdvice, 
  getWeatherIconUrl, 
  getUserLocation 
} from '../services/weatherService';
import { fetchUserProfile } from '../marketplace/services/marketplaceApi';
// Use the enhanced AI component from business
import SmartPlantCareAssistant from '../components/ai/SmartPlantCareAssistant';
import { useCurrentUserType } from '../utils/authUtils';

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
  const [activeTab, setActiveTab] = useState('today');
  const [plants, setPlants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mainTab, setMainTab] = useState('home');
  const [selectedFeature, setSelectedFeature] = useState('home');
  const [userEmail, setUserEmail] = useState(null);
  const [weatherData, setWeatherData] = useState(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [wateringAdvice, setWateringAdvice] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  const [persona, setPersona] = useState(null);
  const { userType, userProfile, loading: userTypeLoading } = useCurrentUserType();
  const [personaChecked, setPersonaChecked] = useState(false);
  const [aiAssistantVisible, setAIAssistantVisible] = useState(false);
  const fadeAnim = useState(new Animated.Value(0))[0];

  // Initialize Firebase notifications
  const { isInitialized, hasPermission, token, error } = useUniversalNotifications(userEmail);

  // Load weather data
  const loadWeatherData = async (silent = false) => {
    try {
      if (!silent) {
        setWeatherLoading(true);
      }

      console.log('🌤️ Loading weather data for watering advice...');
      
      // Prefer userProfile.location if available
      let location = null;
      if (userProfile && userProfile.location && userProfile.location.latitude && userProfile.location.longitude) {
        location = {
          latitude: userProfile.location.latitude,
          longitude: userProfile.location.longitude,
          city: userProfile.location.city,
          country: userProfile.location.country || 'Israel'
        };
      }
      // Get weather data (will fallback to device if location is null)
      const weather = await getWeatherData(location);
      setWeatherData(weather);
      
      // Generate watering advice based on weather and plants
      const advice = generateWateringAdvice(weather, plants);
      setWateringAdvice(advice);
      
      console.log('✅ Weather data loaded successfully');
      
    } catch (error) {
      console.error('❌ Error loading weather data:', error);
      // Set fallback advice
      setWateringAdvice({
        general: 'Weather data unavailable. Follow your regular watering schedule.',
        urgency: 'normal',
        icon: 'help-circle-outline',
        color: '#666'
      });
    } finally {
      if (!silent) {
        setWeatherLoading(false);
      }
    }
  };

  // Handle navigation for tabs that should navigate immediately
  useEffect(() => {
    if (selectedFeature === 'plants') {
      navigation.navigate('Locations');
      setSelectedFeature('home'); // Reset to home after navigation
    } else if (selectedFeature === 'marketplace') {
      navigation.navigate('MainTabs');
      setSelectedFeature('home'); // Reset to home after navigation
    } else if (selectedFeature === 'disease') {
      navigation.navigate('DiseaseChecker');
      setSelectedFeature('home'); // Reset to home after navigation
    } else if (selectedFeature === 'search') {
      navigation.navigate('SearchScreen');
      setSelectedFeature('home'); // Reset to home after navigation
    } else if (selectedFeature === 'add') {
      navigation.navigate('AddOptionsScreen');
      setSelectedFeature('home'); // Reset to home after navigation
    } else if (selectedFeature === 'forum') {
      navigation.navigate('PlantCareForumScreen');
      setSelectedFeature('home'); // Reset to home after navigation
    }
  }, [selectedFeature, navigation]);

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Good morning');
    else if (hour < 18) setGreeting('Good afternoon');
    else setGreeting('Good evening');

    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: Platform.OS !== 'web', // Fix: only use native driver on native platforms
    }).start();
  }, []);

useEffect(() => {
  let mounted = true; // to avoid state updates if unmounted

  const fetchAllData = async () => {
    setLoading(true);

    // Fetch plants
    const plantsPromise = (async () => {
      try {
        let userEmail = await AsyncStorage.getItem('userEmail');
        setUserEmail(userEmail);
        if (!userEmail) return [];

        const res = await fetch(`${API_URL}?email=${encodeURIComponent(userEmail)}`);
        if (!res.ok) throw new Error('Failed to fetch');
        const data = await res.json();
        let allPlants = [];
        if (Array.isArray(data)) {
          data.forEach(locationObj => {
            if (locationObj.plants && Array.isArray(locationObj.plants)) {
              locationObj.plants.forEach(p => {
                allPlants.push({ ...p, location: p.location || locationObj.location });
              });
            }
          });
        }
        return allPlants;
      } catch (e) {
        return [];
      }
    })();

    // Fetch weather
    const weatherPromise = (async () => {
      try {
        const weather = await loadWeatherData(true); // "true" means silent loading (no extra spinner)
        return weather;
      } catch {
        return null;
      }
    })();

    // Wait for both to finish in parallel
    const [allPlants, weather] = await Promise.all([plantsPromise, weatherPromise]);
    if (mounted) {
      setPlants(allPlants);
      if (weather) setWeatherData(weather);
      setLoading(false);
      // If both exist, generate advice
      if (weather && allPlants.length > 0) {
        const advice = generateWateringAdvice(weather, allPlants);
        setWateringAdvice(advice);
      }
    }
  };

  fetchAllData();
  return () => { mounted = false; };
}, []);


  // Pull to refresh
  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      fetchPlants(),
      loadWeatherData(true)
    ]);
    setRefreshing(false);
  };

  const fetchPlants = async () => {
    try {
      let userEmail = await AsyncStorage.getItem('userEmail');
      if (!userEmail) {
        setPlants([]);
        return;
      }
      const res = await fetch(`${API_URL}?email=${encodeURIComponent(userEmail)}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      let allPlants = [];
      if (Array.isArray(data)) {
        data.forEach(locationObj => {
          if (locationObj.plants && Array.isArray(locationObj.plants)) {
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
  };

  // Only render content if persona is checked and not business
  useEffect(() => {
    if (!userTypeLoading) {
      setPersonaChecked(true);
    }
  }, [userTypeLoading]);

  if (!personaChecked) {
    return (
      <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text style={{ marginTop: 16, color: '#666' }}>Loading...</Text>
      </SafeAreaView>
    );
  }
  
  if (userType === 'business') {
    navigation.reset({
      index: 0,
      routes: [{ name: 'BusinessHome' }],
    });
    return null;
  }
  // --- Consumer Profile Card ---
  const renderConsumerProfileCard = () => {
    if (!userProfile) return null;
    
    const missingFields = [];
    if (!userProfile.name) missingFields.push('Name');
    if (!userProfile.intersted) missingFields.push('Interest Level');
    if (!userProfile.animals) missingFields.push('Animals');
    if (!userProfile.kids) missingFields.push('Kids');
    if (!userProfile.location || !userProfile.location.city) missingFields.push('Location');
    
    return (
      <View style={styles.enhancedProfileCard}>
        <View style={styles.profileHeader}>
          <View style={styles.profileAvatar}>
            <MaterialIcons name="person" size={32} color="#4CAF50" />
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileWelcome}>
              Welcome back, {userProfile.name || userProfile.email?.split('@')[0] || 'Plant Lover'}! 🌱
            </Text>
            <Text style={styles.profileSubtitle}>
              {plants.length} plant{plants.length !== 1 ? 's' : ''} in your garden
            </Text>
          </View>
          <TouchableOpacity 
            style={styles.profileEditButton}
            onPress={() => navigation.navigate('UserSettings')}
          >
            <MaterialIcons name="edit" size={20} color="#4CAF50" />
          </TouchableOpacity>
        </View>
        
        <View style={styles.profileDetails}>
          <View style={styles.profileDetailRow}>
            <MaterialIcons name="star" size={16} color="#FF9800" />
            <Text style={styles.profileDetailText}>
              Level: <Text style={styles.profileDetailValue}>{userProfile.intersted || 'Not set'}</Text>
            </Text>
          </View>
          <View style={styles.profileDetailRow}>
            <MaterialIcons name="pets" size={16} color="#8BC34A" />
            <Text style={styles.profileDetailText}>
              Animals: <Text style={styles.profileDetailValue}>{userProfile.animals || 'Not set'}</Text>
            </Text>
          </View>
          <View style={styles.profileDetailRow}>
            <MaterialIcons name="child-care" size={16} color="#2196F3" />
            <Text style={styles.profileDetailText}>
              Kids: <Text style={styles.profileDetailValue}>{userProfile.kids || 'Not set'}</Text>
            </Text>
          </View>
          <View style={styles.profileDetailRow}>
            <MaterialIcons name="location-on" size={16} color="#F44336" />
            <Text style={styles.profileDetailText}>
              Location: <Text style={styles.profileDetailValue}>{userProfile.location?.city || 'Not set'}</Text>
            </Text>
          </View>
        </View>
        
        {missingFields.length > 0 && (
          <TouchableOpacity 
            style={styles.profileCompleteButton} 
            onPress={() => navigation.navigate('UserSettings')}
          >
            <MaterialIcons name="info" size={16} color="#FF9800" />
            <Text style={styles.profileCompleteText}>
              Complete profile: {missingFields.join(', ')}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  // Enhanced tab navigation handling
  const handleTabNavigation = (tabKey) => {
    setMainTab(tabKey);
    
    // Handle immediate navigation for certain tabs
    switch (tabKey) {
      case 'plants':
        navigation.navigate('Locations');
        setMainTab('home'); // Reset after navigation
        break;
      case 'marketplace':
        navigation.navigate('MainTabs');
        setMainTab('home');
        break;
      case 'disease':
        navigation.navigate('DiseaseChecker');
        setMainTab('home');
        break;
      case 'forum':
        navigation.navigate('PlantCareForumScreen');
        setMainTab('home');
        break;
      case 'profile':
        navigation.navigate('UserSettings');
        setMainTab('home');
        break;
      default:
        // For home, ai, weather tabs - stay in current screen
        break;
    }
  };

  // --- Enhanced Feature Tabs Row (proportional, scrollable) ---
  const FEATURE_TABS = [
    { key: 'home', label: 'Home', icon: <MaterialIcons name="home" size={22} color="#2e7d32" /> },
    { key: 'ai', label: 'AI Assistant', icon: <MaterialCommunityIcons name="robot-excited" size={22} color="#FF5722" /> },
    { key: 'weather', label: 'Weather', icon: <MaterialCommunityIcons name="weather-partly-cloudy" size={22} color="#2196F3" /> },
    { key: 'plants', label: 'My Plants', icon: <Ionicons name="leaf" size={22} color="#4CAF50" /> },
    { key: 'marketplace', label: 'Market', icon: <Ionicons name="cart-outline" size={22} color="#FF9800" /> },
    { key: 'forum', label: 'Forum', icon: <MaterialCommunityIcons name="forum" size={22} color="#2196F3" /> },
    { key: 'disease', label: 'Disease Check', icon: <Ionicons name="medkit" size={22} color="#E91E63" /> },
    { key: 'profile', label: 'Profile', icon: <MaterialIcons name="person" size={22} color="#9C27B0" /> },
  ];

  // --- Enhanced Feature Tabs Row ---
  const renderFeatureTabsRow = () => (
    <ScrollView 
      horizontal 
      showsHorizontalScrollIndicator={false} 
      style={styles.featureTabsRow} 
      contentContainerStyle={styles.featureTabsContent}
    >
      {FEATURE_TABS.map(tab => (
        <TouchableOpacity
          key={tab.key}
          style={[
            styles.featureTabCard, 
            mainTab === tab.key && styles.featureTabCardActive
          ]}
          onPress={() => handleTabNavigation(tab.key)}
          accessibilityLabel={tab.label}
        >
          <View style={styles.featureTabIconContainer}>
            {tab.icon}
          </View>
          <Text style={[
            styles.featureTabCardLabel, 
            mainTab === tab.key && styles.featureTabCardLabelActive
          ]}>
            {tab.label}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  // --- Main Content by Tab ---
  const renderMainTabContent = () => {
    switch (mainTab) {
      case 'home':
        return (
          <ScrollView 
            style={styles.scrollContent}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
          >
            {renderConsumerProfileCard()}
            {renderTabRow()}
            {renderPlantsSection()}
            {renderWeatherCard()}
          </ScrollView>
        );
      case 'ai':
        return (
          <SmartPlantCareAssistant
            visible={true}
            onClose={() => setMainTab('home')}
            plant={null}
            onSelectPlant={(plant) => {
              console.log('Selected plant:', plant);
            }}
          />
        );
      case 'weather':
        return (
          <ScrollView style={styles.scrollContent}>
            {renderWeatherCard()}
            {renderConsumerWeatherInsights()}
          </ScrollView>
        );
      default:
        return renderHomeTabContent();
    }
  };

  // Enhanced Plants Section
  const renderPlantsSection = () => {
    const filteredPlants = plants.filter((plant) => {
      const days = daysUntil(plant.next_water);
      if (activeTab === 'today') return days <= 0;
      if (activeTab === 'upcoming') return days > 0 && days <= 3;
      return false;
    });

    return (
      <View style={[styles.weatherCard, {marginBottom: 8}]}>
        <View style={styles.plantsSection}>
          <Text style={styles.sectionTitle}>
            {activeTab === 'today' ? "Today's Care" : 'Upcoming Care'}
          </Text>
          <View style={styles.plantsCountBadge}>
            <Text style={styles.plantsCountText}>
              {filteredPlants.length}
            </Text>
          </View>
        </View>
        
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#4CAF50" />
            <Text style={styles.loadingText}>Loading your plants...</Text>
          </View>
        ) : filteredPlants.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="sprout" size={64} color="#E0E0E0" />
            <Text style={styles.emptyTitle}>
              {activeTab === 'today' ? 'No plants need care today' : 'No upcoming care needed'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {plants.length === 0 ? 'Add some plants to get started!' : 'Great job keeping up with your plants! 🌿'}
            </Text>
            {plants.length === 0 && (
              <TouchableOpacity 
                style={styles.addPlantButton}
                onPress={() => navigation.navigate('AddPlant')}
              >
                <MaterialIcons name="add" size={20} color="#fff" />
                <Text style={styles.addPlantButtonText}>Add Your First Plant</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          filteredPlants.map((item, index) => renderPlantItem(item, index))
        )}
      </View>
    );
  };

  // Enhanced Plant Item Rendering
  const renderPlantItem = (item, index) => {
    const days = daysUntil(item.next_water);
    let status = '';
    let statusColor = '#2e7d32';
    let statusIcon = 'water-outline';
    
    if (days < 0) {
      status = `Late by ${Math.abs(days)} day${Math.abs(days) !== 1 ? 's' : ''}`;
      statusColor = '#f44336';
      statusIcon = 'alert-circle';
    } else if (days === 0) {
      status = 'Water today';
      statusColor = '#FF9800';
      statusIcon = 'water';
    } else {
      status = `In ${days} day${days !== 1 ? 's' : ''}`;
      statusColor = '#2e7d32';
      statusIcon = 'time-outline';
    }

    return (
      <TouchableOpacity 
        key={item.id || index}
        style={styles.enhancedTaskCard}
        onPress={() => navigation.navigate('UserPlantDetail', { plant: item })}
      >
        <View style={styles.plantImageContainer}>
          <Image 
            source={item.image_url ? { uri: item.image_url } : require('../assets/plant-placeholder.png')} 
            style={styles.plantImage} 
          />
          <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
            <MaterialCommunityIcons name={statusIcon} size={12} color="#fff" />
          </View>
        </View>
        
        <View style={styles.taskInfo}>
          <Text style={styles.plantName}>{item.nickname || item.common_name}</Text>
          <Text style={styles.plantLocation}>{item.location}</Text>
          <View style={styles.statusRow}>
            <MaterialCommunityIcons name={statusIcon} size={16} color={statusColor} />
            <Text style={[styles.statusText, { color: statusColor }]}>
              {status}
            </Text>
          </View>
        </View>
        
        <MaterialIcons name="chevron-right" size={24} color="#ccc" />
      </TouchableOpacity>
    );
  };

  // Tab row for today/upcoming
  const renderTabRow = () => (
    <View style={styles.tabRow}>
      <TouchableOpacity
        style={[styles.tab, activeTab === 'today' && styles.activeTab]}
        onPress={() => setActiveTab('today')}
      >
        <Text style={[styles.tabText, activeTab === 'today' && styles.activeTabText]}>
          Today
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.tab, activeTab === 'upcoming' && styles.activeTab]}
        onPress={() => setActiveTab('upcoming')}
      >
        <Text style={[styles.tabText, activeTab === 'upcoming' && styles.activeTabText]}>
          Upcoming
        </Text>
      </TouchableOpacity>
    </View>
  );

  // Fallback content
  const renderHomeTabContent = () => (
    <ScrollView style={styles.scrollContent}>
      {renderConsumerProfileCard()}
      {renderTabRow()}
      {renderWeatherCard()}
      {renderPlantsSection()}
    </ScrollView>
  );

const renderWeatherCard = () => {
  if (!weatherData || weatherLoading) {
    return (
      <View style={styles.weatherCard}>
        {/* CARD HEADER */}
        <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 6}}>
          <MaterialCommunityIcons name="weather-partly-cloudy" size={26} color="#388e3c" style={{marginRight: 6}} />
          <Text style={{fontSize: 22, fontWeight: 'bold', color: '#388e3c', flex: 1}}>
            Weather
          </Text>
          <View style={styles.weatherActions}>
            <TouchableOpacity onPress={() => loadWeatherData()}>
              <MaterialIcons name="refresh" size={20} color="#4CAF50" />
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.weatherLoading}>
          <ActivityIndicator size="small" color="#4CAF50" />
          <Text style={styles.weatherLoadingText}>Loading weather data...</Text>
        </View>
      </View>
    );
  }

  // Only show the advice and stats — no temp, city, or description!
  return (
    <View style={styles.weatherCard}>
      {/* CARD HEADER */}
      <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 6}}>
        <MaterialCommunityIcons name="weather-partly-cloudy" size={26} color="#388e3c" style={{marginRight: 6}} />
        <Text style={{fontSize: 22, fontWeight: 'bold', color: '#388e3c', flex: 1}}>
          Weather
        </Text>
        <View style={styles.weatherActions}>
          <TouchableOpacity onPress={() => loadWeatherData()}>
            <MaterialIcons name="refresh" size={20} color="#4CAF50" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Watering Advice Block (pale green background) */}
      {wateringAdvice && (
        <View style={styles.weatherAdviceRow}>
          <View style={styles.adviceSectionLeft}>
            <MaterialCommunityIcons 
              name={wateringAdvice.icon} 
              size={24} 
              color={wateringAdvice.color} 
              style={{ marginRight: 8, marginTop: 4 }} 
            />
            <View>
              <Text style={styles.advicePriorityText}>
                {wateringAdvice.urgency === 'high' ? 'High Priority' :
                  wateringAdvice.urgency === 'medium' ? 'Medium Priority' :
                  wateringAdvice.urgency === 'low' ? 'Low Priority' : 'Normal'}
              </Text>
              <Text style={[styles.adviceGeneral, { color: wateringAdvice.color }]}>
                {wateringAdvice.general}
              </Text>
            </View>
          </View>
          {/* Stats row */}
          {wateringAdvice.details && (
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <MaterialCommunityIcons name="thermometer" size={20} color="#FF5722" />
                <Text style={styles.statValue}>{wateringAdvice.details.temperature}°C</Text>
                <Text style={styles.statLabel}>Temp</Text>
              </View>
              <View style={styles.statItem}>
                <MaterialCommunityIcons name="water-percent" size={20} color="#2196F3" />
                <Text style={styles.statValue}>{wateringAdvice.details.humidity}%</Text>
                <Text style={styles.statLabel}>Humidity</Text>
              </View>
              <View style={styles.statItem}>
                <MaterialCommunityIcons name="weather-rainy" size={20} color="#4FC3F7" />
                <Text style={styles.statValue}>{wateringAdvice.details.precipitation} mm</Text>
                <Text style={styles.statLabel}>Rain</Text>
              </View>
              <View style={styles.statItem}>
                <MaterialCommunityIcons name="weather-windy" size={20} color="#9E9E9E" />
                <Text style={styles.statValue}>{Math.round(wateringAdvice.details.windSpeed)} m/s</Text>
                <Text style={styles.statLabel}>Wind</Text>
              </View>
              <View style={styles.statItem}>
                <MaterialCommunityIcons name="white-balance-sunny" size={20} color="#FFD600" />
                <Text style={styles.statValue}>{wateringAdvice.details.uvIndex}</Text>
                <Text style={styles.statLabel}>UV</Text>
              </View>
            </View>
          )}
        </View>
      )}
    </View>
  );
};


  // --- Consumer Weather Insights Section (Business Style) ---
  const renderConsumerWeatherInsights = () => {
    if (!weatherData || weatherLoading) return null;
    const { current, location } = weatherData;
    return (
      <View style={styles.businessWeatherCard}>
        <View style={styles.businessWeatherHeader}>
          <MaterialCommunityIcons name="weather-cloudy-clock" size={24} color="#4CAF50" />
          <Text style={styles.businessWeatherTitle}>Weather Insights</Text>
        </View>
        <View style={styles.businessWeatherContent}>
          <View style={styles.businessWeatherMain}>
            <View style={styles.businessWeatherLeft}>
              <Image 
                source={{ uri: getWeatherIconUrl(current.icon) }}
                style={styles.weatherIcon}
              />
              <View>
                <Text style={styles.businessTemperature}>{current.temperature}°C</Text>
                <Text style={styles.businessWeatherDescription}>{current.description}</Text>
                <Text style={styles.businessLocation}>{location.city}</Text>
              </View>
            </View>
            <View style={styles.businessWeatherDetails}>
              <View style={styles.businessWeatherDetailItem}>
                <MaterialCommunityIcons name="water-percent" size={16} color="#2196F3" />
                <Text style={styles.businessWeatherDetailText}>{current.humidity}%</Text>
              </View>
              <View style={styles.businessWeatherDetailItem}>
                <MaterialCommunityIcons name="weather-windy" size={16} color="#9E9E9E" />
                <Text style={styles.businessWeatherDetailText}>{Math.round(current.windSpeed)} m/s</Text>
              </View>
              <View style={styles.businessWeatherDetailItem}>
                <MaterialCommunityIcons name="thermometer" size={16} color="#FF5722" />
                <Text style={styles.businessWeatherDetailText}>Feels {current.feelsLike}°</Text>
              </View>
            </View>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Enhanced Header with Settings */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>Greener</Text>
          <Text style={styles.headerSubtitle}>Your Plant Care Companion</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity 
            style={styles.headerActionButton}
            onPress={() => navigation.navigate('PlantCareCalendarScreen')}
            accessibilityLabel="Calendar"
          >
            <MaterialIcons name="calendar-today" size={24} color="#4CAF50" />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.settingsButton}
            onPress={() => navigation.navigate('UserSettings')}
            accessibilityLabel="Settings"
          >
            <MaterialIcons name="settings" size={24} color="#4CAF50" />
          </TouchableOpacity>
        </View>
      </View>
      
      {/* Enhanced Feature Tabs Row */}
      {renderFeatureTabsRow()}
      
      {/* Main Content */}
      <View style={styles.contentContainer}>
        {renderMainTabContent()}
      </View>
    </SafeAreaView>
  );
}

const isWeb = Platform.OS === 'web';

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#f8f9fa' 
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e8f5e8',
    elevation: 2,
    ...(!isWeb ? {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
    } : {
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    }),
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
    color: '#66bb6a',
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerActionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f9f3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f9f3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  // Enhanced Profile Card Styles
  enhancedProfileCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    padding: 16,
    elevation: 3,
    ...(!isWeb ? {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 6,
    } : {
      boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
    }),
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  profileAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#e8f5e8',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  profileInfo: {
    flex: 1,
  },
  profileWelcome: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2e7d32',
    marginBottom: 4,
  },
  profileSubtitle: {
    fontSize: 14,
    color: '#66bb6a',
  },
  profileEditButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f0f9f3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileDetails: {
    gap: 8,
  },
  profileDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileDetailText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
  },
  profileDetailValue: {
    fontWeight: '600',
    color: '#2e7d32',
  },
  profileCompleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff3e0',
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#FF9800',
  },
  profileCompleteText: {
    color: '#FF9800',
    fontWeight: '600',
    marginLeft: 8,
    flex: 1,
  },

  // Enhanced Feature Tabs
  featureTabsRow: {
    flexGrow: 0,
    flexShrink: 0,
    marginVertical: 8,
  },
  featureTabsContent: {
    paddingHorizontal: 16,
    gap: 12,
  },
  featureTabCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    minWidth: 80,
    minHeight: 80,
    elevation: 2,
    ...(!isWeb ? {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 3,
    } : {
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    }),
  },
  featureTabCardActive: {
    backgroundColor: '#e8f5e8',
    borderWidth: 2,
    borderColor: '#4CAF50',
    elevation: 4,
    ...(!isWeb ? {
      shadowOpacity: 0.15,
      shadowRadius: 6,
    } : {
      boxShadow: '0 2px 8px rgba(76,175,80,0.2)',
    }),
  },
  featureTabIconContainer: {
    marginBottom: 6,
  },
  featureTabCardLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2e7d32',
    textAlign: 'center',
  },
  featureTabCardLabelActive: {
    color: '#388e3c',
    fontWeight: '700',
  },

  // Enhanced Plant Item Styles
  enhancedTaskCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    alignItems: 'center',
    elevation: 2,
    ...(!isWeb ? {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 3,
    } : {
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    }),
  },
  plantImageContainer: {
    position: 'relative',
    marginRight: 16,
  },
  plantImage: { 
    width: 60, 
    height: 60, 
    borderRadius: 30 
  },
  statusBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  taskInfo: { 
    justifyContent: 'center', 
    flex: 1 
  },
  plantName: { 
    fontSize: 18, 
    fontWeight: 'bold', 
    color: '#2e7d32',
    marginBottom: 2,
  },
  plantLocation: {
    fontSize: 14,
    color: '#66bb6a',
    marginBottom: 4,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusText: { 
    marginLeft: 6,
    fontWeight: '600',
    fontSize: 14,
  },

  // Tab row styles
  tabRow: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    padding: 4,
    elevation: 1,
    ...(!isWeb ? {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
    } : {
      boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
    }),
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  activeTab: {
    backgroundColor: '#4CAF50',
  },
  tabText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  activeTabText: {
    color: '#fff',
  },

  // Content styles
  scrollContent: {
    flex: 1,
  },
  contentContainer: {
    flex: 1,
  },
  plantsSection: {
    flex: 1,
    paddingBottom: 20,
  },
  plantsSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginVertical: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2e7d32',
  },
  plantsCountBadge: {
    backgroundColor: '#4CAF50',
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  plantsCountText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
  },
  loadingContainer: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    color: '#666',
    marginTop: 12,
    fontSize: 16,
  },
  emptyState: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  addPlantButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginTop: 20,
  },
  addPlantButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },

  // Weather Card Styles (keep existing)
  weatherCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    ...(!isWeb ? {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    } : {
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    }),
  },
  weatherHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  weatherTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2e7d32',
    flex: 1,
    marginLeft: 8,
  },
  weatherLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  weatherLoadingText: {
    color: '#666',
    marginLeft: 8,
    fontSize: 14,
  },
  weatherUnavailable: {
    color: '#666',
    textAlign: 'center',
    paddingVertical: 20,
    fontSize: 14,
  },
  weatherContent: {
    flexDirection: 'column',
  },
  weatherMain: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  weatherLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  weatherIcon: {
    width: 50,
    height: 50,
    marginRight: 12,
  },
  temperature: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2e7d32',
  },
  weatherDescription: {
    fontSize: 14,
    color: '#666',
    textTransform: 'capitalize',
  },
  location: {
    fontSize: 12,
    fontWeight: '500',
    color: '#888',
    marginTop: 2,
  },
  weatherDetails: {
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: 4,
  },
  weatherDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  weatherDetailText: {
    fontSize: 12,
    color: '#333',
    marginLeft: 4,
  },
  // Watering Advice Styles
  wateringAdvice: {
    borderLeftWidth: 4,
    paddingLeft: 12,
    paddingVertical: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    marginTop: 12,
  },
  adviceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  adviceTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginLeft: 8,
    flex: 1,
  },
  plantsBadge: {
    backgroundColor: '#4CAF50',
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginLeft: 8,
  },
  plantsBadgeText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#fff',
  },
  adviceText: {
    fontSize: 13,
    color: '#333',
    lineHeight: 18,
  },
  weatherActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  calendarButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f0f9f3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Business Weather Insights Styles
  businessWeatherCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    ...(!isWeb ? {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    } : {
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    }),
  },
  businessWeatherHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  businessWeatherTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2e7d32',
    flex: 1,
    marginLeft: 8,
  },
  businessWeatherContent: {
    flexDirection: 'column',
  },
  businessWeatherMain: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  businessWeatherLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  businessTemperature: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2e7d32',
  },
  businessWeatherDescription: {
    fontSize: 14,
    color: '#666',
    textTransform: 'capitalize',
  },
  businessLocation: {
    fontSize: 12,
    fontWeight: '500',
    color: '#888',
    marginTop: 2,
  },
  businessWeatherDetails: {
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: 4,
  },
  businessWeatherDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  businessWeatherDetailText: {
    fontSize: 12,
    color: '#333',
    marginLeft: 4,
  },
  weatherMainRow: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: 8,
},
weatherLeftColumn: {
  flexDirection: 'row',
  alignItems: 'center',
  flex: 1,
},
bigTemperature: {
  fontSize: 32,
  fontWeight: 'bold',
  color: '#2e7d32',
  marginBottom: 2,
},
weatherInfoCol: {
  alignItems: 'flex-end',
  justifyContent: 'center',
  gap: 6,
  marginLeft: 12,
},
weatherInfoItem: {
  flexDirection: 'row',
  alignItems: 'center',
  marginBottom: 2,
},
weatherInfoText: {
  fontSize: 13,
  color: '#333',
  marginLeft: 4,
},
weatherAdviceRow: { // PALE GREEN advice area
  marginTop: 6,
  borderRadius: 12,
  backgroundColor: '#F7FCF7',
  padding: 14,
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 10,
},
adviceSectionLeft: {
  flexDirection: 'row',
  alignItems: 'flex-start',
  flex: 2,
  minWidth: 0,
  marginRight: 12,
},
advicePriorityText: {
  fontSize: 15,
  fontWeight: 'bold',
  color: '#388e3c',
  marginBottom: 4,
},
adviceGeneral: {
  fontSize: 14,
  fontWeight: '600',
  marginTop: 2,
  flexWrap: 'wrap',
},
statsRow: {
  flexDirection: 'row',
  flex: 2.5,
  justifyContent: 'space-evenly',
  alignItems: 'center',
  marginLeft: 10,
  flexWrap: 'wrap',
},
statItem: {
  alignItems: 'center',
  marginHorizontal: 4,
  minWidth: 52,
},
statValue: {
  fontWeight: 'bold',
  color: '#2e7d32',
  fontSize: 15,
},
statLabel: {
  fontSize: 11,
  color: '#444',
},
});
