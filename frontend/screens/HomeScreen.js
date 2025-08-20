import React, { useState, useEffect } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Animated,
  ActivityIndicator,
  ScrollView,
  Platform,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useUniversalNotifications } from '../hooks/useUniversalNotifications';
import {
  getWeatherData,
  generateWateringAdvice,
} from '../services/weatherService';
import SmartPlantCareAssistant from '../components/ai/SmartPlantCareAssistant';
import { useCurrentUserType } from '../utils/authUtils';
import NavigationBar from '../components/NavigationBar';

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

// Which tasks do we track + default icon/colors
const TASK_DEFS = [
  { key: 'next_water', type: 'Water', icon: 'water', color: '#4CAF50' },
  { key: 'next_feed', type: 'Feed', icon: 'leaf', color: '#FF9800' },
  { key: 'next_repot', type: 'Repot', icon: 'flower-outline', color: '#8D6E63' },
];
// Visual palette for chips by urgency
const CHIP_PALETTE = {
  late: { bg: '#FDECEA', border: '#F44336', text: '#C62828', icon: '#D32F2F' },
  today: { bg: '#FFF4E5', border: '#FF9800', text: '#E65100', icon: '#E65100' },
  upcoming: { bg: '#EDF7ED', border: '#4CAF50', text: '#1B5E20', icon: '#2E7D32' },
};

const taskVariant = (t) => (t.days < 0 ? 'late' : t.days === 0 ? 'today' : 'upcoming');

const TaskChip = ({ task }) => {
  const variant = taskVariant(task);
  const pal = CHIP_PALETTE[variant];
  return (
    <View style={[styles.taskChip, { backgroundColor: pal.bg, borderColor: pal.border }]}>
      <MaterialCommunityIcons name={task.icon} size={14} color={pal.icon} style={{ marginRight: 6 }} />
      <Text style={[styles.taskChipText, { color: pal.text }]} numberOfLines={1}>
        {task.type} {task.status}
      </Text>
    </View>
  );
};

// Build all tasks for a plant and filter by tab
function getTasksForPlant(plant, tab = 'today') {
  const tasks = TASK_DEFS
    .map(def => {
      const date = plant?.[def.key];
      if (!date) return null;
      const d = daysUntil(date);
      let status = '';
      let color = def.color;

      if (d < 0) { status = `Late by ${Math.abs(d)} day${Math.abs(d) !== 1 ? 's' : ''}`; color = '#F44336'; }
      else if (d === 0) { status = 'today'; color = '#FF9800'; }
      else { status = `in ${d} day${d !== 1 ? 's' : ''}`; }

      return { ...def, date, days: d, status, color };
    })
    .filter(Boolean);

  // tab filtering
  const filtered = tasks.filter(t =>
    tab === 'today' ? t.days <= 0 : t.days > 0
  );

  // sort urgent first
  filtered.sort((a, b) => a.days - b.days);
  return filtered;
}

function getNextTask(plant) {
  const tasks = [
    { type: 'Water', date: plant.next_water, icon: 'water', color: '#4CAF50' },
    { type: 'Feed', date: plant.next_feed, icon: 'spa', color: '#FFD600' },
    { type: 'Repot', date: plant.next_repot, icon: 'flower-pot', color: '#8D6E63' },
  ].filter(t => !!t.date);

  if (!tasks.length) return null;
  tasks.sort((a, b) => new Date(a.date) - new Date(b.date));
  return tasks[0];
}

export default function HomeScreen({ navigation }) {
  const [greeting, setGreeting] = useState('');
  const [activeTab, setActiveTab] = useState('today');
  const [plants, setPlants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mainTab, setMainTab] = useState('home');
  const [userEmail, setUserEmail] = useState(null);
  const [weatherData, setWeatherData] = useState(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [wateringAdvice, setWateringAdvice] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const { userType, userProfile, loading: userTypeLoading } = useCurrentUserType();
  const [personaChecked, setPersonaChecked] = useState(false);
  const fadeAnim = useState(new Animated.Value(0))[0];
  const [fabOpen, setFabOpen] = useState(false);


  useUniversalNotifications(userEmail);

  // Weather data loading
  const loadWeatherData = async (silent = false) => {
    try {
      if (!silent) setWeatherLoading(true);
      let location = null;
      if (
        userProfile &&
        userProfile.location &&
        userProfile.location.latitude &&
        userProfile.location.longitude
      ) {
        location = {
          latitude: userProfile.location.latitude,
          longitude: userProfile.location.longitude,
          city: userProfile.location.city,
          country: userProfile.location.country || 'Israel',
        };
      }
      const weather = await getWeatherData(location);
      setWeatherData(weather);
      const advice = generateWateringAdvice(weather, plants);
      setWateringAdvice(advice);
    } catch (error) {
      setWateringAdvice({
        general: 'Weather data unavailable. Follow your regular watering schedule.',
        urgency: 'normal',
        icon: 'help-circle-outline',
        color: '#666',
      });
    } finally {
      if (!silent) setWeatherLoading(false);
    }
  };

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Good morning');
    else if (hour < 18) setGreeting('Good afternoon');
    else setGreeting('Good evening');

    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, []);

  useEffect(() => {
    let mounted = true;
    const fetchAllData = async () => {
      setLoading(true);
      const plantsPromise = (async () => {
        try {
          let userEmail = await AsyncStorage.getItem('userEmail');
          setUserEmail(userEmail);
          if (!userEmail) return [];
          const res = await fetch(`${API_URL}?email=${encodeURIComponent(userEmail)}`);
          if (!res.ok) throw new Error('Failed to fetch');
          const data = await res.json();
          // console.log("API returned data:", data);
          let allPlants = [];
          if (Array.isArray(data)) {
            allPlants = data;
          }
          return allPlants;
        } catch (e) {
          return [];
        }
      })();

      const weatherPromise = (async () => {
        try {
          const weather = await loadWeatherData(true);
          return weather;
        } catch {
          return null;
        }
      })();

      const [allPlants, weather] = await Promise.all([plantsPromise, weatherPromise]);
      if (mounted) {
        setPlants(allPlants);
        if (weather) setWeatherData(weather);
        setLoading(false);
        if (weather && allPlants.length > 0) {
          const advice = generateWateringAdvice(weather, allPlants);
          setWateringAdvice(advice);
        }
      }
    };
    fetchAllData();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!userTypeLoading) setPersonaChecked(true);
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

  // Main tab content
  const renderMainTabContent = () => {
    switch (mainTab) {
      case 'home':
        return (
          <ScrollView
            style={styles.scrollContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
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
            onSelectPlant={() => { }}
          />
        );
      default:
        return null;
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchPlants(), loadWeatherData(true)]);
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
        allPlants = data;
      }
      setPlants(allPlants);
    } catch (e) {
      setPlants([]);
    }
  };

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

  // --- Plants Section & Tabs ---
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

  const renderPlantsSection = () => {
    const grouped = plants.map(p => ({ plant: p, tasks: getTasksForPlant(p, activeTab) }))
      .filter(x => x.tasks.length > 0);

    const totalTasks = grouped.reduce((sum, x) => sum + x.tasks.length, 0);

    return (
      <View style={[styles.weatherCard, { marginBottom: 8 }]}>
        <View style={styles.plantsSection}>
          <Text style={styles.sectionTitle}>
            {activeTab === 'today' ? "Today's Care" : 'Upcoming Care'}
          </Text>
          <View style={styles.countPill}>
            <MaterialCommunityIcons name="format-list-checkbox" size={14} color="#fff" />
            <Text style={styles.countPillText}>{totalTasks}</Text>
          </View>
        </View>


        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#4CAF50" />
            <Text style={styles.loadingText}>Loading your plants...</Text>
          </View>
        ) : grouped.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="sprout" size={64} color="#E0E0E0" />
            <Text style={styles.emptyTitle}>
              {activeTab === 'today' ? 'No plants need care today' : 'No upcoming care needed'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {plants.length === 0 ? 'Add some plants to get started!' : 'Great job keeping up with your plants! 🌿'}
            </Text>
            {plants.length === 0 && (
              <TouchableOpacity style={styles.addPlantButton} onPress={() => navigation.navigate('AddPlant')}>
                <MaterialIcons name="add" size={20} color="#fff" />
                <Text style={styles.addPlantButtonText}>Add Your First Plant</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          grouped.map((row, i) => renderPlantItem(row.plant, row.tasks, i))
        )}
      </View>
    );
  };


  const renderPlantItem = (item, tasks, index) => {
    const main = tasks[0] || { color: '#4CAF50', icon: 'leaf' };
    const overdueCount = tasks.filter(t => t.days < 0).length;

    return (
      <TouchableOpacity
        key={item.id || index}
        style={styles.enhancedTaskCard}
        onPress={() => navigation.navigate('UserPlantDetail', { plant: item })}
        activeOpacity={0.85}
      >
        <View style={styles.plantImageContainer}>
          <Image
            source={item.image_url && item.image_url !== '—'
              ? { uri: item.image_url }
              : require('../assets/plant-placeholder.png')}
            style={styles.plantImage}
          />
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: overdueCount ? '#F44336' : main.color },
            ]}
          >
            {overdueCount ? (
              <Text style={styles.statusBadgeCount}>{overdueCount}</Text>
            ) : (
              <MaterialCommunityIcons name={main.icon} size={12} color="#fff" />
            )}
          </View>
        </View>

        <View style={styles.taskInfo}>
          <Text style={styles.plantName}>{item.nickname || item.common_name}</Text>
          <Text style={styles.plantLocation}>{item.location}</Text>

          {/* Pretty chips */}
          <View style={styles.chipsWrap}>
            {tasks.slice(0, 4).map((t, idx) => (
              <TaskChip key={`${t.type}-${idx}`} task={t} />
            ))}
            {tasks.length > 4 && (
              <View style={[styles.taskChip, styles.taskMoreChip]}>
                <Text style={styles.taskMoreText}>+{tasks.length - 4} more</Text>
              </View>
            )}
          </View>
        </View>

        <MaterialIcons name="chevron-right" size={24} color="#CFCFCF" />
      </TouchableOpacity>
    );
  };



  // --- Weather Card ---
  const renderWeatherCard = () => {
    if (!weatherData || weatherLoading) {
      return (
        <View style={styles.weatherCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
            <MaterialCommunityIcons name="weather-partly-cloudy" size={26} color="#388e3c" style={{ marginRight: 6 }} />
            <Text style={{ fontSize: 22, fontWeight: 'bold', color: '#388e3c', flex: 1 }}>
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

    // Format date string (short weekday, day, short month)
    const dateStr = new Date().toLocaleDateString(undefined, {
      weekday: "short", day: "numeric", month: "short"
    });

    const wd = weatherData.current || {};
    const icon = wd.icon
      ? { uri: `https://openweathermap.org/img/wn/${wd.icon}@2x.png` }
      : null;

    return (
      <View style={styles.weatherCard}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
          <MaterialCommunityIcons name="weather-partly-cloudy" size={26} color="#388e3c" style={{ marginRight: 6 }} />
          <Text style={{ fontSize: 22, fontWeight: 'bold', color: '#388e3c', flex: 1 }}>
            Weather
          </Text>
          <View style={styles.weatherActions}>
            <TouchableOpacity onPress={() => loadWeatherData()}>
              <MaterialIcons name="refresh" size={20} color="#4CAF50" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Main Weather Row */}
        <View style={styles.weatherMainRow2}>
          {/* Left - Big temp + weather icon + city/date */}
          <View style={styles.weatherLeftCol2}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              {icon && (
                <Image source={icon} style={{ width: 52, height: 52, marginRight: 6 }} />
              )}
              <Text style={styles.weatherBigTemp}>
                {wd.temperature}°C
              </Text>
            </View>
            <Text style={styles.weatherDesc2}>
              {wd.description && wd.description.charAt(0).toUpperCase() + wd.description.slice(1)}
            </Text>
            <Text style={styles.weatherCityDate2}>
              {(weatherData.location?.city || "Location")} · {dateStr}
            </Text>
          </View>
          {/* Right - weather stats */}
          <View style={styles.weatherMetricsCol2}>
            <WeatherMetric icon="water-percent" value={wd.humidity + "%"} label="Humidity" color="#2196F3" />
            <WeatherMetric icon="weather-rainy" value={weatherData.precipitation?.last24h + " mm"} label="Rain" color="#4FC3F7" />
            <WeatherMetric icon="weather-windy" value={Math.round(wd.windSpeed) + " m/s"} label="Wind" color="#888" />
            <WeatherMetric icon="white-balance-sunny" value={wd.uvIndex || 0} label="UV" color="#FFD600" />
          </View>
        </View>
        {/* Advice */}
        {wateringAdvice && (
          <View style={styles.weatherAdviceBanner}>
            <MaterialCommunityIcons
              name={wateringAdvice.icon || "water-outline"}
              size={22}
              color={wateringAdvice.color}
              style={{ marginRight: 8, marginTop: 2 }}
            />
            <Text style={[styles.weatherAdviceText, { color: wateringAdvice.color }]}>
              {wateringAdvice.general}
            </Text>
          </View>
        )}
      </View>
    );
  };

  // WeatherMetric helper
  function WeatherMetric({ icon, value, label, color }) {
    return (
      <View style={styles.weatherMetricBox2}>
        <MaterialCommunityIcons name={icon} size={18} color={color} />
        <Text style={styles.weatherMetricVal2}>{value}</Text>
        <Text style={styles.weatherMetricLabel2}>{label}</Text>
      </View>
    );
  }


  return (
    <SafeAreaView style={styles.container}>
      {/* === Add the header here === */}
      {mainTab === 'home' && (
        <View style={styles.header}>
          <View style={styles.headerLeftRow}>
            <Image
              source={require('../assets/icon.png')}
              style={styles.logoImg}
              resizeMode="contain"
            />
            <Text style={styles.headerTitle}>Greener</Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.settingsButton}
              onPress={() => navigation.navigate('UserSettings')}
              accessibilityLabel="Settings"
            >
              <MaterialIcons name="settings" size={24} color="#4CAF50" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Main content below the header */}
      <View style={styles.contentContainer}>
        {renderMainTabContent()}
      </View>
      {/* Bottom navigation bar */}
      <NavigationBar currentTab={mainTab} navigation={navigation} />
      <>
        {/* Floating Action Button */}
        <View style={styles.fabContainer} pointerEvents="box-none">
          {fabOpen && (
            <View style={styles.fabActions}>
              <TouchableOpacity
                style={styles.fabActionButton}
                onPress={() => {
                  setFabOpen(false);
                  navigation.navigate('AddPlant');
                }}
              >
                <MaterialIcons name="local-florist" size={24} color="#fff" />
                <Text style={styles.fabActionLabel}>Add Plant</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.fabActionButton}
                onPress={() => {
                  setFabOpen(false);
                  navigation.navigate('AddSite');
                }}
              >
                <MaterialIcons name="location-on" size={24} color="#fff" />
                <Text style={styles.fabActionLabel}>Add Site</Text>
              </TouchableOpacity>
            </View>
          )}
          <TouchableOpacity
            style={styles.fab}
            onPress={() => setFabOpen((prev) => !prev)}
            activeOpacity={0.85}
          >
            <MaterialIcons name={fabOpen ? 'close' : 'add'} size={32} color="#fff" />
          </TouchableOpacity>
        </View>
      </>
    </SafeAreaView>
  );
}


const isWeb = Platform.OS === 'web';

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
    ...(!isWeb
      ? {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      }
      : {
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      }),
  },
  headerLeftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  logoImg: {
    width: 36,
    height: 36,
    marginRight: 10,
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
    flex: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
  // --- chips ---
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 6,
  },
  taskChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 4,
    paddingHorizontal: 10,
    marginRight: 8,
    marginTop: 6,
  },
  taskChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  taskMoreChip: {
    backgroundColor: '#F4F6F8',
    borderColor: '#E0E0E0',
  },
  taskMoreText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#607D8B',
  },

  // --- card tweaks ---
  enhancedTaskCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    alignItems: 'center',
    elevation: 2,
    ...(Platform.OS !== 'web'
      ? { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4 }
      : { boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }),
  },
  plantImage: { width: 64, height: 64, borderRadius: 12 }, // squircle look
  statusBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  statusBadgeCount: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 12,
  },
  plantName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#2e7d32',
  },
  plantLocation: {
    fontSize: 13,
    color: '#7CB342',
    marginTop: 2,
  },
  taskRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },

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
  taskRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
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
  fabContainer: {
    position: 'absolute',
    right: 24,
    bottom: Platform.OS === 'web' ? 36 : 36,
    alignItems: 'flex-end',
    zIndex: 1000,
    pointerEvents: 'box-none',
  },
  fab: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#4CAF50',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6,
    marginBottom: 8,
  },
  fabActions: {
    marginBottom: 12,
    alignItems: 'flex-end',
  },
  fabActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#388e3c',
    borderRadius: 24,
    paddingVertical: 10,
    paddingHorizontal: 18,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.17,
    shadowRadius: 3,
    elevation: 3,
  },
  fabActionLabel: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
    marginLeft: 10,
  },
  weatherMainRow2: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 6,
    paddingHorizontal: 2,
  },
  weatherLeftCol2: {
    flex: 1.3,
    justifyContent: 'center',
  },
  weatherBigTemp: {
    fontSize: 34,
    fontWeight: 'bold',
    color: '#2e7d32',
    marginRight: 2,
  },
  weatherDesc2: {
    fontSize: 15,
    color: '#555',
    marginBottom: 1,
  },
  weatherCityDate2: {
    fontSize: 12,
    color: '#888',
  },
  weatherMetricsCol2: {
    flex: 1.4,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 6,
  },
  weatherMetricBox2: {
    alignItems: 'center',
    marginLeft: 10,
    marginBottom: 2,
    backgroundColor: '#F0F7F0',
    borderRadius: 8,
    paddingVertical: 7,
    paddingHorizontal: 9,
    minWidth: 56,
  },
  weatherMetricVal2: {
    fontWeight: 'bold',
    color: '#222',
    fontSize: 15,
    marginTop: 1,
  },
  weatherMetricLabel2: {
    fontSize: 11,
    color: '#666',
  },
  weatherAdviceBanner: {
    marginTop: 14,
    borderRadius: 10,
    backgroundColor: '#e7fbe5',
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: -4,
    marginBottom: -6,
  },
  weatherAdviceText: {
    fontWeight: '600',
    fontSize: 14,
    flex: 1,
    flexWrap: 'wrap',
  },
  countPill: {
  flexDirection: 'row',
  alignItems: 'center',
  backgroundColor: '#43A047',
  borderRadius: 14,
  paddingHorizontal: 10,
  paddingVertical: 4,
  alignSelf: 'flex-start',
  marginTop: 8,
},
countPillText: { color: '#fff', fontWeight: '800', marginLeft: 6, fontSize: 12 },
});
