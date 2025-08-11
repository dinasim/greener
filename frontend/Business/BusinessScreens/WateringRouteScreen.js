// Business/BusinessScreens/WateringRouteScreen.js - GPS-based watering route optimization
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  Animated,
  Platform,
} from 'react-native';
import BusinessLayout from '../components/BusinessLayout';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import CrossPlatformAzureMapView from '../../marketplace/components/CrossPlatformAzureMapView';
import { getAzureMapsKey } from '../../marketplace/services/azureMapsService';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getBusinessWateringChecklist, optimizeWateringRoute } from '../services/businessPlantApi';

export default function WateringRouteScreen({ navigation, route }) {
  const { businessId } = route.params || {};

  const [plants, setPlants] = useState([]);
  const [optimizedRoute, setOptimizedRoute] = useState([]);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [routeStats, setRouteStats] = useState(null);
  const [selectedPlant, setSelectedPlant] = useState(null);
  const [azureMapsKey, setAzureMapsKey] = useState(null);
  const [error, setError] = useState(null);

  const mapRef = useRef(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    initializeRoute();
    loadAzureMapsKey();
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, []);

  const loadAzureMapsKey = async () => {
    try {
      const key = await getAzureMapsKey();
      setAzureMapsKey(key);
    } catch (error) {
      console.error('Error loading Azure Maps key:', error);
      setError('Failed to load map. Please try again.');
    }
  };

  const initializeRoute = async () => {
    try {
      // Get current location
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Location access is needed to optimize your watering route.');
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      setCurrentLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });

      // Load plants that need watering
      await loadPlantsForWatering();
    } catch (error) {
      console.error('Error initializing route:', error);
      setError('Failed to initialize watering route. Please check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const loadPlantsForWatering = async () => {
    try {
      // Use the real API call instead of mock data
      const response = await getBusinessWateringChecklist();

      if (response.success) {
        // Filter plants that need watering and have location data
        const plantsToWater = (response.checklist || [])
          .filter(plant => plant.location && plant.location.latitude && plant.location.longitude);

        setPlants(plantsToWater);

        if (plantsToWater.length > 0) {
          await optimizeRoute(plantsToWater);
        } else {
          setOptimizedRoute([]);
          setRouteStats({
            totalPlants: 0,
            totalDistance: 0,
            estimatedTime: 0,
            highPriority: 0
          });
        }
      } else {
        throw new Error('Failed to fetch watering checklist');
      }
    } catch (error) {
      console.error('Error loading plants:', error);
      setError('Failed to load plants for watering. Please try again.');

      // Try to get cached data as fallback
      try {
        const cachedPlants = await AsyncStorage.getItem('cached_watering_plants');
        if (cachedPlants) {
          const parsed = JSON.parse(cachedPlants);
          setPlants(parsed);
          await optimizeRoute(parsed);
        }
      } catch (cacheError) {
        console.error('Cache error:', cacheError);
      }
    }
  };

  const optimizeRoute = async (plantsToOptimize) => {
    setIsOptimizing(true);
    try {
      // Use real API call for route optimization
      if (!currentLocation) {
        throw new Error('Current location is required for route optimization');
      }

      // Add current location as starting point
      const enhancedPlants = plantsToOptimize.map(plant => ({
        ...plant,
        location: plant.location || {},
        waterDays: plant.waterDays || 7,
        priority: plant.priority || plant.isOverdue ? 'high' : 'medium'
      }));

      // Call the API to optimize the route
      const response = await optimizeWateringRoute(enhancedPlants);

      if (response.success) {
        setOptimizedRoute(response.optimizedRoute || enhancedPlants);

        // Calculate route statistics
        setRouteStats({
          totalPlants: response.optimizedRoute?.length || enhancedPlants.length,
          totalDistance: parseFloat(response.totalDistance || 0).toFixed(1),
          estimatedTime: response.estimatedTime || (enhancedPlants.length * 5), // 5 min per plant as fallback
          highPriority: (response.optimizedRoute || enhancedPlants).filter(p => p.priority === 'high').length
        });

        // Cache the plants data in case of network issues
        await AsyncStorage.setItem('cached_watering_plants', JSON.stringify(enhancedPlants));
        await AsyncStorage.setItem('cached_watering_route', JSON.stringify(response.optimizedRoute || enhancedPlants));
      } else {
        // Fallback to simple optimization if API fails
        const optimized = [...plantsToOptimize].sort((a, b) => {
          if (a.priority === 'high' && b.priority !== 'high') return -1;
          if (b.priority === 'high' && a.priority !== 'high') return 1;
          return 0;
        });

        setOptimizedRoute(optimized);

        // Calculate route statistics
        const totalDistance = calculateTotalDistance(optimized);
        const estimatedTime = optimized.length * 5; // 5 minutes per plant

        setRouteStats({
          totalPlants: optimized.length,
          totalDistance: totalDistance.toFixed(1),
          estimatedTime,
          highPriority: optimized.filter(p => p.priority === 'high').length
        });
      }
    } catch (error) {
      console.error('Error optimizing route:', error);
      setError('Failed to optimize watering route. Using simple prioritization instead.');

      // Fallback to simple sorting if optimization fails
      const optimized = [...plantsToOptimize].sort((a, b) => {
        if (a.priority === 'high' && b.priority !== 'high') return -1;
        if (b.priority === 'high' && a.priority !== 'high') return 1;
        return 0;
      });

      setOptimizedRoute(optimized);

      const totalDistance = calculateTotalDistance(optimized);
      setRouteStats({
        totalPlants: optimized.length,
        totalDistance: totalDistance.toFixed(1),
        estimatedTime: optimized.length * 5,
        highPriority: optimized.filter(p => p.priority === 'high').length
      });
    } finally {
      setIsOptimizing(false);
    }
  };

  const calculateTotalDistance = (route) => {
    if (!currentLocation || route.length === 0) return 0;

    // Simple distance calculation - using Haversine formula
    let totalDistance = 0;
    let prevLat = currentLocation.latitude;
    let prevLng = currentLocation.longitude;

    for (const plant of route) {
      if (plant.location?.latitude && plant.location?.longitude) {
        totalDistance += calculateHaversineDistance(
          prevLat, prevLng,
          plant.location.latitude, plant.location.longitude
        );
        prevLat = plant.location.latitude;
        prevLng = plant.location.longitude;
      }
    }

    return totalDistance;
  };

  const calculateHaversineDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Earth radius in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const handleStartRoute = () => {
    Alert.alert(
      'Start Watering Route',
      `Ready to start watering ${optimizedRoute.length} plants?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Start',
          onPress: () => navigation.navigate('GPSWateringNavigator', {
            route: optimizedRoute,
            businessId
          })
        }
      ]
    );
  };

  const renderPlantItem = ({ item, index }) => {
    const overdueDays = Math.floor((Date.now() - item.lastWatered.getTime()) / (24 * 60 * 60 * 1000)) - item.waterDays;
    const priorityColor = item.priority === 'high' ? '#F44336' : item.priority === 'medium' ? '#FF9800' : '#4CAF50';

    return (
      <TouchableOpacity
        style={styles.plantItem}
        onPress={() => setSelectedPlant(item)}
      >
        <View style={styles.plantItemLeft}>
          <View style={[styles.priorityIndicator, { backgroundColor: priorityColor }]}>
            <Text style={styles.routeNumber}>{index + 1}</Text>
          </View>
          <View style={styles.plantInfo}>
            <Text style={styles.plantName}>{item.name}</Text>
            <View style={styles.locationInfo}>
              <MaterialIcons name="location-on" size={14} color="#666" />
              <Text style={styles.locationText}>
                {item.location.section} - {item.location.aisle}
              </Text>
            </View>
            {overdueDays > 0 && (
              <View style={styles.overdueInfo}>
                <MaterialCommunityIcons name="alert" size={14} color="#F44336" />
                <Text style={[styles.overdueText, { color: '#F44336' }]}>
                  Overdue by {overdueDays} days
                </Text>
              </View>
            )}
          </View>
        </View>
        <MaterialIcons name="chevron-right" size={24} color="#ccc" />
      </TouchableOpacity>
    );
  };

  if (isLoading) {
    return (
      <BusinessLayout navigation={navigation} businessId={businessId} currentTab="insights">
        <SafeAreaView style={styles.container}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#4CAF50" />
            <Text style={styles.loadingText}>Optimizing watering route...</Text>
          </View>
        </SafeAreaView>
      </BusinessLayout>
    );
  }

  return (
    <BusinessLayout
      navigation={navigation}
      businessId={businessId}
      currentTab="insights"
      badges={{}} // optional
    >
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <MaterialIcons name="arrow-back" size={24} color="#4CAF50" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Watering Route</Text>
          <TouchableOpacity onPress={() => optimizeRoute(plants)} style={styles.refreshButton}>
            <MaterialIcons name="refresh" size={24} color="#4CAF50" />
          </TouchableOpacity>
        </View>

        <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
          {/* Route Statistics */}
          {routeStats && (
            <View style={styles.statsContainer}>
              <View style={styles.statItem}>
                <MaterialCommunityIcons name="sprout" size={20} color="#4CAF50" />
                <Text style={styles.statValue}>{routeStats.totalPlants}</Text>
                <Text style={styles.statLabel}>Plants</Text>
              </View>
              <View style={styles.statItem}>
                <MaterialIcons name="directions-walk" size={20} color="#2196F3" />
                <Text style={styles.statValue}>{routeStats.totalDistance} km</Text>
                <Text style={styles.statLabel}>Distance</Text>
              </View>
              <View style={styles.statItem}>
                <MaterialIcons name="schedule" size={20} color="#FF9800" />
                <Text style={styles.statValue}>{routeStats.estimatedTime} min</Text>
                <Text style={styles.statLabel}>Est. Time</Text>
              </View>
              <View style={styles.statItem}>
                <MaterialIcons name="priority-high" size={20} color="#F44336" />
                <Text style={styles.statValue}>{routeStats.highPriority}</Text>
                <Text style={styles.statLabel}>Urgent</Text>
              </View>
            </View>
          )}

          {/* Map View */}
          {currentLocation && azureMapsKey && (
            <View style={styles.mapContainer}>
              <CrossPlatformAzureMapView
                ref={mapRef}
                style={styles.map}
                initialRegion={{
                  latitude: currentLocation.latitude,
                  longitude: currentLocation.longitude,
                  zoom: 14
                }}
                markers={optimizedRoute.map((plant, index) => ({
                  id: plant.id,
                  latitude: plant.location.latitude,
                  longitude: plant.location.longitude,
                  title: plant.name,
                  description: `Stop ${index + 1} - ${plant.location.section}`,
                  type: 'plant'
                }))}
                azureMapsKey={azureMapsKey}
                showMyLocation={true}
                myLocation={currentLocation}
                onMarkerPress={(marker) => {
                  const plant = optimizedRoute.find(p => p.id === marker.id);
                  if (plant) setSelectedPlant(plant);
                }}
              />
            </View>
          )}

          {/* Route List */}
          <View style={styles.routeList}>
            <View style={styles.routeHeader}>
              <Text style={styles.routeTitle}>Optimized Route</Text>
              {isOptimizing && <ActivityIndicator size="small" color="#4CAF50" />}
            </View>

            <FlatList
              data={optimizedRoute}
              renderItem={renderPlantItem}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
            />
          </View>

          {/* Start Route Button */}
          <TouchableOpacity
            style={[styles.startButton, optimizedRoute.length === 0 && styles.startButtonDisabled]}
            onPress={handleStartRoute}
            disabled={optimizedRoute.length === 0}
          >
            <MaterialIcons name="navigation" size={24} color="#fff" />
            <Text style={styles.startButtonText}>Start Watering Route</Text>
          </TouchableOpacity>
        </Animated.View>
      </SafeAreaView>
    </BusinessLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#f0f9f3',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  refreshButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#f0f9f3',
  },
  content: {
    flex: 1,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 16,
    backgroundColor: '#fff',
    marginBottom: 8,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginTop: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  mapContainer: {
    height: 200,
    margin: 16,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#fff',
  },
  map: {
    flex: 1,
  },
  routeList: {
    flex: 1,
    backgroundColor: '#fff',
    margin: 16,
    marginTop: 8,
    borderRadius: 12,
    padding: 16,
  },
  routeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  routeTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  plantItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  plantItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  priorityIndicator: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  routeNumber: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  plantInfo: {
    flex: 1,
  },
  plantName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  locationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  locationText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
  overdueInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  overdueText: {
    fontSize: 12,
    marginLeft: 4,
    fontWeight: '500',
  },
  startButton: {
    backgroundColor: '#4CAF50',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    margin: 16,
    borderRadius: 12,
    gap: 8,
  },
  startButtonDisabled: {
    backgroundColor: '#ccc',
  },
  startButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});