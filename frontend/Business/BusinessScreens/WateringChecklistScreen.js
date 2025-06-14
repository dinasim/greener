// Business/BusinessScreens/WateringChecklistScreen.js - FIXED VERSION
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Animated,
  Platform,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons, MaterialIcons, Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';

// Import components
import NotificationBell from '../components/NotificationBell';
import { useNotificationManager } from '../components/NotificationManager';

// Import services
import { 
  getWateringChecklist, 
  markPlantAsWatered, 
  getOptimizedWateringRoute,
  getBusinessWeather 
} from '../services/businessWateringApi';

export default function WateringChecklistScreen({ navigation, route }) {
  // State management
  const [checklist, setChecklist] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [businessId, setBusinessId] = useState(null);
  const [error, setError] = useState(null);
  const [weatherInfo, setWeatherInfo] = useState(null);
  const [stats, setStats] = useState({
    totalCount: 0,
    needsWateringCount: 0,
    completedCount: 0
  });
  const [optimizedRoute, setOptimizedRoute] = useState(null);
  const [showOptimizedRoute, setShowOptimizedRoute] = useState(false);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  
  // Animation refs
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const headerHeightAnim = useRef(new Animated.Value(Platform.OS === 'ios' ? 120 : 100)).current;
  
  // Auto-refresh timer
  const refreshTimer = useRef(null);
  const autoRefreshInterval = 60000; // 1 minute

  // Notification manager
  const {
    hasNewNotifications,
    notifications,
    clearAllNotifications
  } = useNotificationManager(businessId, navigation);
  
  // Initialize when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      const initialize = async () => {
        try {
          const storedBusinessId = await AsyncStorage.getItem('businessId');
          if (storedBusinessId) {
            setBusinessId(storedBusinessId);
            loadChecklist(storedBusinessId);
            loadWeatherInfo(storedBusinessId);
            startAutoRefresh(storedBusinessId);
            startEntranceAnimation();
          } else {
            setError('Business ID not found. Please set up your business profile.');
            setIsLoading(false);
          }
        } catch (error) {
          console.error('Error initializing:', error);
          setError('Failed to initialize checklist');
          setIsLoading(false);
        }
      };
      
      initialize();
      
      return () => {
        if (refreshTimer.current) {
          clearInterval(refreshTimer.current);
        }
      };
    }, [])
  );
  
  // Animation functions
  const startEntranceAnimation = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 100,
        friction: 8,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start();
  };
  
  const startShakeAnimation = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, {
        toValue: 10,
        duration: 100,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.timing(shakeAnim, {
        toValue: -10,
        duration: 100,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.timing(shakeAnim, {
        toValue: 0,
        duration: 100,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start();
  };
  
  // Auto-refresh setup
  const startAutoRefresh = (businessId) => {
    if (refreshTimer.current) {
      clearInterval(refreshTimer.current);
    }
    
    refreshTimer.current = setInterval(() => {
      if (businessId && autoRefreshEnabled) {
        loadChecklist(businessId, true); // Silent refresh
      }
    }, autoRefreshInterval);
  };
  
  // Load weather info
  const loadWeatherInfo = async (businessId) => {
    try {
      const weather = await getBusinessWeather(businessId);
      if (weather) {
        setWeatherInfo(weather);
      }
    } catch (error) {
      console.warn('Could not load weather info:', error);
    }
  };
  
  // Load checklist data
  const loadChecklist = async (businessId, silent = false) => {
    if (!businessId) return;
    
    if (!silent) {
      setIsLoading(true);
      setRefreshing(true);
    }
    
    try {
      const data = await getWateringChecklist(businessId, silent);
      
      // Process and sort the checklist
      let checklistData = data.checklist || [];
      
      // Sort: First plants that need watering, then by days remaining
      checklistData.sort((a, b) => {
        // First priority: plants that need watering
        if (a.needsWatering && !b.needsWatering) return -1;
        if (!a.needsWatering && b.needsWatering) return 1;
        
        // Second priority: days remaining (for plants that don't need watering)
        if (!a.needsWatering && !b.needsWatering) {
          return a.daysRemaining - b.daysRemaining;
        }
        
        // Plants that both need watering - sort by location if available
        if (a.location?.section && b.location?.section) {
          if (a.location.section !== b.location.section) {
            return a.location.section.localeCompare(b.location.section);
          }
          
          if (a.location.aisle && b.location.aisle) {
            return a.location.aisle.localeCompare(b.location.aisle);
          }
        }
        
        return 0;
      });
      
      setChecklist(checklistData);
      
      // Calculate stats
      const completedCount = checklistData.filter(plant => plant.completed).length;
      
      setStats({
        totalCount: data.totalCount || checklistData.length || 0,
        needsWateringCount: data.needsWateringCount || checklistData.filter(p => p.needsWatering).length || 0,
        completedCount
      });
      
      // Get optimized route if there are plants needing watering and not already shown
      if (data.needsWateringCount > 0 && !optimizedRoute) {
        try {
          const routeData = await getOptimizedWateringRoute(businessId);
          setOptimizedRoute(routeData);
        } catch (routeError) {
          console.warn('Could not get optimized route:', routeError);
        }
      }
      
      setError(null);
    } catch (error) {
      console.error('Error loading checklist:', error);
      if (!silent) {
        setError('Could not load watering checklist');
        startShakeAnimation();
      }
    } finally {
      if (!silent) {
        setIsLoading(false);
        setRefreshing(false);
      }
    }
  };
  
  // Pull-to-refresh handler
  const onRefresh = useCallback(() => {
    if (businessId) {
      loadChecklist(businessId);
      loadWeatherInfo(businessId);
    }
  }, [businessId]);
  
  // Mark plant as watered
  const handleMarkWatered = async (plantId) => {
    try {
      // Provide haptic feedback
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
      
      const result = await markPlantAsWatered(plantId, 'manual');
      
      if (result.success) {
        // Update the local state
        setChecklist(prev => prev.map(plant => 
          plant.id === plantId 
            ? { ...plant, needsWatering: false, lastWatered: new Date().toISOString().split('T')[0], completed: true } 
            : plant
        ));
        
        // Update stats
        setStats(prev => ({
          ...prev,
          needsWateringCount: Math.max(0, prev.needsWateringCount - 1),
          completedCount: prev.completedCount + 1
        }));
        
        // Show success feedback
        Alert.alert('✅ Success', `${result.plant.name} has been watered.`);
        
        // Refresh checklist after a short delay
        setTimeout(() => {
          if (businessId) {
            loadChecklist(businessId, true);
          }
        }, 1000);
      }
    } catch (error) {
      console.error('Error marking plant as watered:', error);
      Alert.alert('❌ Error', 'Could not mark plant as watered');
      startShakeAnimation();
    }
  };
  
  
  
  // Handle barcode scan result
  const handleBarcodeScanned = (data) => {
    try {
      // Parse barcode data
      const barcodeData = JSON.parse(data);
      
      if (barcodeData.type === 'plant' && barcodeData.id) {
        // Find the plant in the checklist
        const plant = checklist.find(p => p.id === barcodeData.id);
        
        if (plant) {
          // Mark plant as watered
          handleMarkWatered(plant.id);
        } else {
          Alert.alert('⚠️ Plant Not Found', 'This plant is not in your watering checklist');
        }
      } else {
        Alert.alert('⚠️ Invalid Barcode', 'This barcode does not contain valid plant data');
      }
    } catch (error) {
      console.error('Error processing barcode:', error);
      Alert.alert('❌ Invalid Format', 'The scanned barcode is not in a valid format');
    }
  };
  
  // Handle GPS navigation
  const handleGPSNavigation = () => {
    if (optimizedRoute && optimizedRoute.route && optimizedRoute.route.length > 0) {
      navigation.navigate('GPSWateringNavigator', {
        route: optimizedRoute.route,
        businessId,
        onPlantWatered: (plantId) => {
          handleMarkWatered(plantId);
        }
      });
    } else {
      Alert.alert('⚠️ No Route Available', 'Could not generate a watering route. Please make sure your plants have location data.');
    }
  };
  
  // Toggle optimized route view
  const toggleOptimizedRoute = () => {
    setShowOptimizedRoute(!showOptimizedRoute);
    
    // Animate header height
    Animated.timing(headerHeightAnim, {
      toValue: !showOptimizedRoute ? (Platform.OS === 'ios' ? 170 : 150) : (Platform.OS === 'ios' ? 120 : 100),
      duration: 300,
      useNativeDriver: false,
    }).start();
  };
  
  // Toggle auto-refresh
  const toggleAutoRefresh = async () => {
    const newState = !autoRefreshEnabled;
    setAutoRefreshEnabled(newState);
    
    if (newState) {
      startAutoRefresh(businessId);
    } else if (refreshTimer.current) {
      clearInterval(refreshTimer.current);
    }
    
    // Save preference
    try {
      await AsyncStorage.setItem('watering_auto_refresh', newState ? 'true' : 'false');
    } catch (error) {
      console.warn('Could not save auto-refresh preference:', error);
    }
  };
  
  // Render loading state
  if (isLoading && checklist.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#4CAF50" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text style={styles.loadingText}>Loading watering checklist...</Text>
        </View>
      </SafeAreaView>
    );
  }
  
  // Render error state
  if (error && checklist.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#4CAF50" />
        <View style={styles.errorContainer}>
          <MaterialIcons name="error-outline" size={64} color="#f44336" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => loadChecklist(businessId)}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }
  
  // Calculate completion percentage
  const completionPercentage = stats.needsWateringCount === 0 && stats.totalCount > 0 
    ? 100 
    : stats.totalCount > 0 
      ? Math.round((stats.completedCount / stats.totalCount) * 100) 
      : 0;
  
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#4CAF50" />
      
      {/* Animated Header */}
      <Animated.View 
        style={[
          styles.header,
          {
            height: headerHeightAnim,
            transform: [{ translateX: shakeAnim }],
          }
        ]}
      >
        <View style={styles.headerTopRow}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <MaterialIcons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Plant Watering</Text>
            <View style={styles.headerStats}>
              <Text style={styles.headerSubtitle}>
                {stats.needsWateringCount > 0 
                  ? `${stats.needsWateringCount} plants need watering` 
                  : 'All plants watered 🌱'}
              </Text>
              
              <View style={styles.progressContainer}>
                <View style={styles.progressBar}>
                  <View style={[styles.progressFill, { width: `${completionPercentage}%` }]} />
                </View>
                <Text style={styles.progressText}>{completionPercentage}%</Text>
              </View>
            </View>
          </View>
          
          <View style={styles.headerButtons}>
            <NotificationBell
              hasNotifications={hasNewNotifications}
              notificationCount={notifications.length}
              onPress={() => navigation.navigate('NotificationCenterScreen', { businessId })}
              size={20}
              color="#fff"
            />
            
            <TouchableOpacity 
              style={styles.headerButton}
              onPress={toggleAutoRefresh}
            >
              <MaterialIcons 
                name={autoRefreshEnabled ? "sync" : "sync-disabled"} 
                size={22} 
                color="#fff" 
              />
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.headerButton}
              onPress={() => navigation.navigate('NotificationSettingsScreen', { businessId })}
            >
              <MaterialIcons name="notifications" size={22} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
        
        {/* Action Buttons */}
        <Animated.View 
          style={[
            styles.actionButtonsContainer,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            }
          ]}
        >
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={handleScanBarcode}
          >
            <MaterialCommunityIcons name="barcode-scan" size={22} color="#fff" />
            <Text style={styles.actionButtonText}>Scan</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[
              styles.actionButton,
              stats.needsWateringCount === 0 && styles.disabledButton
            ]}
            onPress={handleGPSNavigation}
            disabled={stats.needsWateringCount === 0}
          >
            <MaterialIcons name="map" size={22} color="#fff" />
            <Text style={styles.actionButtonText}>Navigate</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[
              styles.actionButton,
              stats.needsWateringCount === 0 && styles.disabledButton,
              optimizedRoute?.route?.length > 0 && showOptimizedRoute && styles.activeButton
            ]}
            onPress={toggleOptimizedRoute}
            disabled={stats.needsWateringCount === 0 || !optimizedRoute}
          >
            <MaterialIcons name="route" size={22} color="#fff" />
            <Text style={styles.actionButtonText}>
              {showOptimizedRoute ? 'Hide Route' : 'Show Route'}
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
      
      {/* Weather Card */}
      {weatherInfo && (
        <Animated.View 
          style={[
            styles.weatherCard,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            }
          ]}
        >
          <View style={styles.weatherIconContainer}>
            <MaterialCommunityIcons 
              name={getWeatherIcon(weatherInfo.condition)} 
              size={40} 
              color="#2196F3" 
            />
          </View>
          
          <View style={styles.weatherInfo}>
            <Text style={styles.weatherLocation}>{weatherInfo.location}</Text>
            <Text style={styles.weatherTemp}>{weatherInfo.temperature}°C</Text>
            <Text style={styles.weatherCondition}>{weatherInfo.condition}</Text>
          </View>
          
          {weatherInfo.precipitation !== undefined && (
            <View style={styles.precipitation}>
              <MaterialCommunityIcons name="water" size={16} color="#2196F3" />
              <Text style={styles.precipitationText}>
                {weatherInfo.precipitation}% chance of rain
              </Text>
            </View>
          )}
        </Animated.View>
      )}
      
      {/* Optimized Route View */}
      {showOptimizedRoute && optimizedRoute && optimizedRoute.route && optimizedRoute.route.length > 0 && (
        <Animated.View 
          style={[
            styles.optimizedRouteContainer,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            }
          ]}
        >
          <View style={styles.routeHeader}>
            <Text style={styles.routeTitle}>Optimized Watering Route</Text>
            <Text style={styles.routeSubtitle}>
              {optimizedRoute.totalPlants} plants • {optimizedRoute.estimatedTime.formatted}
            </Text>
          </View>
          
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.routeSteps}>
              {optimizedRoute.route.map((plant, index) => (
                <View key={plant.id} style={styles.routeStep}>
                  <View style={styles.routeStepNumber}>
                    <Text style={styles.stepNumberText}>{index + 1}</Text>
                  </View>
                  
                  <View style={styles.routeStepInfo}>
                    <Text style={styles.routeStepName} numberOfLines={1}>
                      {plant.name}
                    </Text>
                    {plant.location && (
                      <Text style={styles.routeStepLocation} numberOfLines={1}>
                        {[
                          plant.location.section && `Section ${plant.location.section}`,
                          plant.location.aisle && `Aisle ${plant.location.aisle}`,
                          plant.location.shelfNumber && `Shelf ${plant.location.shelfNumber}`
                        ].filter(Boolean).join(', ')}
                      </Text>
                    )}
                  </View>
                  
                  {index < optimizedRoute.route.length - 1 && (
                    <View style={styles.routeArrow}>
                      <MaterialIcons name="arrow-forward" size={16} color="#4CAF50" />
                    </View>
                  )}
                </View>
              ))}
            </View>
          </ScrollView>
          
          <TouchableOpacity 
            style={styles.startNavigationButton}
            onPress={handleGPSNavigation}
          >
            <MaterialIcons name="navigation" size={20} color="#fff" />
            <Text style={styles.startNavigationText}>Start Navigation</Text>
          </TouchableOpacity>
        </Animated.View>
      )}
      
      {/* Checklist */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#4CAF50']}
            tintColor="#4CAF50"
          />
        }
      >
        <Animated.View 
          style={{
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          }}
        >
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Watering Checklist</Text>
            <Text style={styles.sectionSubtitle}>
              {stats.needsWateringCount === 0 
                ? 'All caught up!' 
                : `${stats.needsWateringCount} plants need attention`}
            </Text>
          </View>
          
          {checklist.length === 0 ? (
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons name="water-off" size={64} color="#e0e0e0" />
              <Text style={styles.emptyText}>No plants need watering</Text>
              <Text style={styles.emptySubtext}>All your plants are properly watered!</Text>
            </View>
          ) : (
            checklist.map((plant) => (
              <Animated.View 
                key={plant.id}
                style={[
                  styles.plantCard,
                  plant.needsWatering && styles.needsWateringCard,
                  plant.completed && styles.completedCard,
                  {
                    transform: [{ scale: scaleAnim }],
                  }
                ]}
              >
                <View style={styles.plantInfo}>
                  <View style={[
                    styles.plantIconContainer,
                    plant.needsWatering ? styles.needsWateringIcon : styles.normalIcon
                  ]}>
                    <MaterialCommunityIcons 
                      name="leaf" 
                      size={28} 
                      color={plant.needsWatering ? "#fff" : "#4CAF50"} 
                    />
                  </View>
                  
                  <View style={styles.plantDetails}>
                    <Text style={styles.plantName} numberOfLines={1}>
                      {plant.name}
                    </Text>
                    {plant.scientificName && (
                      <Text style={styles.scientificName} numberOfLines={1}>
                        {plant.scientificName}
                      </Text>
                    )}
                    <View style={styles.plantMeta}>
                      {plant.needsWatering ? (
                        <View style={styles.needsWateringBadge}>
                          <MaterialCommunityIcons name="water" size={14} color="#fff" />
                          <Text style={styles.needsWateringText}>Needs Watering</Text>
                        </View>
                      ) : (
                        <View style={styles.daysRemainingBadge}>
                          <Text style={styles.daysRemainingText}>
                            {plant.daysRemaining} day{plant.daysRemaining !== 1 ? 's' : ''} remaining
                          </Text>
                        </View>
                      )}
                      
                      {plant.location && plant.location.section && (
                        <View style={styles.locationBadge}>
                          <MaterialIcons name="place" size={12} color="#2196F3" />
                          <Text style={styles.locationText}>
                            {[
                              plant.location.section && `S${plant.location.section}`,
                              plant.location.aisle && `A${plant.location.aisle}`
                            ].filter(Boolean).join('-')}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                </View>
                
                {plant.needsWatering && (
                  <TouchableOpacity 
                    style={styles.waterButton}
                    onPress={() => handleMarkWatered(plant.id)}
                  >
                    <MaterialCommunityIcons name="water" size={20} color="#fff" />
                    <Text style={styles.waterButtonText}>Water Now</Text>
                  </TouchableOpacity>
                )}
                
                {!plant.needsWatering && (
                  <View style={styles.lastWatered}>
                    <MaterialCommunityIcons name="calendar-check" size={14} color="#4CAF50" />
                    <Text style={styles.lastWateredText}>
                      Last watered: {formatDate(plant.lastWatered)}
                    </Text>
                  </View>
                )}
              </Animated.View>
            ))
          )}
          
          {/* Extra space at bottom */}
          <View style={{ height: 80 }} />
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

// Helper function to get weather icon based on condition
const getWeatherIcon = (condition) => {
  if (!condition) return "weather";
  
  condition = condition.toLowerCase();
  
  if (condition.includes('rain') || condition.includes('drizzle')) {
    return "weather-rainy";
  } else if (condition.includes('snow')) {
    return "weather-snowy";
  } else if (condition.includes('cloud')) {
    return "weather-cloudy";
  } else if (condition.includes('clear') || condition.includes('sun')) {
    return "weather-sunny";
  } else if (condition.includes('storm') || condition.includes('thunder')) {
    return "weather-lightning-rainy";
  } else if (condition.includes('fog') || condition.includes('mist')) {
    return "weather-fog";
  } else if (condition.includes('wind')) {
    return "weather-windy";
  } else {
    return "weather";
  }
};

// Helper function to format date
const formatDate = (dateString) => {
  if (!dateString) return 'Never';
  
  try {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      });
    }
  } catch (error) {
    return dateString;
  }
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#f44336',
    textAlign: 'center',
    marginVertical: 16,
  },
  retryButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  header: {
    backgroundColor: '#4CAF50',
    paddingTop: Platform.OS === 'ios' ? 0 : 8,
    paddingBottom: 12,
    paddingHorizontal: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  backButton: {
    padding: 8,
  },
  headerContent: {
    flex: 1,
    marginLeft: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerStats: {
    marginTop: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  progressBar: {
    flex: 1,
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 2,
    marginRight: 8,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#fff',
    borderRadius: 2,
  },
  progressText: {
    fontSize: 12,
    color: '#fff',
    width: 36,
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  headerButton: {
    padding: 8,
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    marginTop: 8,
    gap: 8,
  },
  actionButton: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  disabledButton: {
    opacity: 0.5,
  },
  activeButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: '600',
    marginLeft: 6,
    fontSize: 13,
  },
  weatherCard: {
    backgroundColor: '#fff',
    margin: 16,
    marginBottom: 8,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  weatherIconContainer: {
    marginRight: 16,
    justifyContent: 'center',
  },
  weatherInfo: {
    flex: 1,
  },
  weatherLocation: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  weatherTemp: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginVertical: 4,
  },
  weatherCondition: {
    fontSize: 14,
    color: '#666',
  },
  precipitation: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  precipitationText: {
    fontSize: 12,
    color: '#2196F3',
    marginLeft: 4,
  },
  optimizedRouteContainer: {
    backgroundColor: '#fff',
    margin: 16,
    marginTop: 8,
    marginBottom: 8,
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  routeHeader: {
    marginBottom: 12,
  },
  routeTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  routeSubtitle: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  routeSteps: {
    flexDirection: 'row',
    paddingVertical: 8,
  },
  routeStep: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
  },
  routeStepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  stepNumberText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  routeStepInfo: {
    marginRight: 8,
    maxWidth: 120,
  },
  routeStepName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  routeStepLocation: {
    fontSize: 12,
    color: '#666',
  },
  routeArrow: {
    marginHorizontal: 8,
  },
  startNavigationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4CAF50',
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 12,
  },
  startNavigationText: {
    color: '#fff',
    fontWeight: '600',
    marginLeft: 8,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  sectionHeader: {
    marginTop: 8,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  sectionSubtitle: {
    fontSize: 14, 
    color: '#666',
    marginTop: 2,
  },
  emptyContainer: {
    alignItems: 'center',
    padding: 32,
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
  },
  plantCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  needsWateringCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#f44336',
  },
  completedCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  plantInfo: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  plantIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  needsWateringIcon: {
    backgroundColor: '#f44336',
  },
  normalIcon: {
    backgroundColor: '#f0f9f3',
  },
  plantDetails: {
    flex: 1,
  },
  plantName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  scientificName: {
    fontSize: 14,
    fontStyle: 'italic',
    color: '#666',
    marginTop: 2,
  },
  plantMeta: {
    flexDirection: 'row',
    marginTop: 8,
    flexWrap: 'wrap',
    gap: 8,
  },
  needsWateringBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f44336',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  needsWateringText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  daysRemainingBadge: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  daysRemainingText: {
    color: '#666',
    fontSize: 12,
  },
  locationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e3f2fd',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  locationText: {
    color: '#2196F3',
    fontSize: 12,
    marginLeft: 4,
  },
  waterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4CAF50',
    paddingVertical: 10,
    borderRadius: 8,
  },
  waterButtonText: {
    color: '#fff',
    fontWeight: '600',
    marginLeft: 8,
  },
  lastWatered: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lastWateredText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
});