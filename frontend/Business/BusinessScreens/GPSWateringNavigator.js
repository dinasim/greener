// Business/BusinessScreens/GPSWateringNavigator.js
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
  Dimensions,
  Image,
  Animated,
  SafeAreaView,
  StatusBar,
  Platform,
} from 'react-native';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';

// Import services
import { markPlantAsWatered } from '../services/businessWateringApi';

const { width, height } = Dimensions.get('window');

export default function GPSWateringNavigator({ navigation, route }) {
  const { route: plantsRoute, businessId, onPlantWatered } = route.params || {};
  
  // State management
  const [currentLocation, setCurrentLocation] = useState(null);
  const [locationPermission, setLocationPermission] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [currentStep, setCurrentStep] = useState(0);
  const [routeProgress, setRouteProgress] = useState(0);
  const [navigationStarted, setNavigationStarted] = useState(false);
  const [currentPlant, setCurrentPlant] = useState(null);
  const [distanceToTarget, setDistanceToTarget] = useState(null);
  const [isWatering, setIsWatering] = useState(false);
  const [completedPlants, setCompletedPlants] = useState([]);
  
  // Animation refs
  const slideAnim = useRef(new Animated.Value(300)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  
  // Location tracking
  const locationSubscription = useRef(null);
  
  // Initialize and request permissions
  useEffect(() => {
    const initialize = async () => {
      try {
        // Request location permission
        const { status } = await Location.requestForegroundPermissionsAsync();
        setLocationPermission(status === 'granted');
        
        if (status !== 'granted') {
          Alert.alert(
            'Permission Denied',
            'GPS navigation requires location permission',
            [{ text: 'OK', onPress: () => navigation.goBack() }]
          );
          return;
        }
        
        // Get initial location
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        
        setCurrentLocation({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          accuracy: location.coords.accuracy,
        });
        
        // If we have a route, set the current plant
        if (plantsRoute && plantsRoute.length > 0) {
          setCurrentPlant(plantsRoute[currentStep]);
        }
        
        // Start animations
        Animated.parallel([
          Animated.timing(slideAnim, {
            toValue: 0,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
        ]).start();
        
        setIsLoading(false);
      } catch (error) {
        console.error('Error initializing GPS navigator:', error);
        Alert.alert(
          'Error',
          'Could not initialize GPS navigation',
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
      }
    };
    
    initialize();
    
    // Start pulse animation for the target
    startPulseAnimation();
    
    // Cleanup
    return () => {
      if (locationSubscription.current) {
        locationSubscription.current.remove();
      }
    };
  }, []);
  
  // Start pulse animation for target indicator
  const startPulseAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };
  
  // Start tracking when navigation begins
  useEffect(() => {
    if (navigationStarted && locationPermission) {
      // Start location tracking
      const startTracking = async () => {
        locationSubscription.current = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            distanceInterval: 1, // Update every 1 meter
            timeInterval: 1000, // Or every 1 second
          },
          (location) => {
            const newPosition = {
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
              accuracy: location.coords.accuracy,
            };
            
            setCurrentLocation(newPosition);
            
            // Check distance to current target plant
            if (currentPlant && currentPlant.location && currentPlant.location.gpsCoordinates) {
              const targetCoords = currentPlant.location.gpsCoordinates;
              
              // Calculate distance
              const distance = calculateDistance(
                newPosition.latitude,
                newPosition.longitude,
                targetCoords.latitude,
                targetCoords.longitude
              );
              
              setDistanceToTarget(distance);
              
              // If within 3 meters of target plant, vibrate and show alert
              if (distance < 3 && !completedPlants.includes(currentPlant.id)) {
                // Vibration feedback
                if (Platform.OS !== 'web') {
                  Haptics.notificationAsync(
                    Haptics.NotificationFeedbackType.Success
                  );
                }
                
                // Show plant reached alert
                Alert.alert(
                  'Plant Reached! 🌱',
                  `You've reached ${currentPlant.name}. Would you like to mark it as watered?`,
                  [
                    {
                      text: 'Water Later',
                      style: 'cancel',
                    },
                    {
                      text: 'Water Now',
                      onPress: () => handleWaterPlant(),
                    },
                  ]
                );
              }
            }
          }
        );
      };
      
      startTracking();
    } else if (!navigationStarted && locationSubscription.current) {
      // Stop location tracking when navigation is paused
      locationSubscription.current.remove();
      locationSubscription.current = null;
    }
  }, [navigationStarted, locationPermission, currentPlant]);
  
  // Calculate distance between two coordinates in meters
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    // Haversine formula
    const R = 6371e3; // Earth radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;
    
    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    
    return distance; // in meters
  };
  
  // Handle water plant
  const handleWaterPlant = async () => {
    if (!currentPlant || isWatering) return;
    
    setIsWatering(true);
    
    try {
      // Get current coordinates
      const coordinates = currentLocation
        ? {
            latitude: currentLocation.latitude,
            longitude: currentLocation.longitude,
          }
        : null;
      
      // Mark plant as watered with GPS method
      await markPlantAsWatered(currentPlant.id, 'gps', coordinates);
      
      // Update completed plants
      setCompletedPlants([...completedPlants, currentPlant.id]);
      
      // Notify parent component if callback provided
      if (onPlantWatered) {
        onPlantWatered(currentPlant.id);
      }
      
      // Show success message
      Alert.alert(
        'Success! 💦',
        `${currentPlant.name} has been watered.`,
        [
          {
            text: 'Continue Navigation',
            onPress: () => moveToNextPlant(),
          },
        ]
      );
    } catch (error) {
      console.error('Error watering plant:', error);
      Alert.alert('Error', 'Failed to mark plant as watered');
    } finally {
      setIsWatering(false);
    }
  };
  
  // Move to next plant in route
  const moveToNextPlant = () => {
    if (!plantsRoute || currentStep >= plantsRoute.length - 1) {
      // End of route
      Alert.alert(
        'Route Completed! 🎉',
        'You have completed all plants in this route.',
        [
          {
            text: 'Finish',
            onPress: () => navigation.goBack(),
          },
        ]
      );
      
      return;
    }
    
    // Move to next plant
    const nextStep = currentStep + 1;
    setCurrentStep(nextStep);
    setCurrentPlant(plantsRoute[nextStep]);
    setDistanceToTarget(null);
    
    // Update progress
    setRouteProgress((nextStep / (plantsRoute.length - 1)) * 100);
  };
  
  // Move to previous plant in route
  const moveToPreviousPlant = () => {
    if (currentStep <= 0) return;
    
    const prevStep = currentStep - 1;
    setCurrentStep(prevStep);
    setCurrentPlant(plantsRoute[prevStep]);
    setDistanceToTarget(null);
    
    // Update progress
    setRouteProgress((prevStep / (plantsRoute.length - 1)) * 100);
  };
  
  // Start or pause navigation
  const toggleNavigation = () => {
    setNavigationStarted(!navigationStarted);
  };
  
  // Format distance for display
  const formatDistance = (distance) => {
    if (distance === null) return 'Calculating...';
    
    if (distance < 1000) {
      return `${Math.round(distance)} m`;
    } else {
      return `${(distance / 1000).toFixed(2)} km`;
    }
  };
  
  // Render loading state
  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#4CAF50" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text style={styles.loadingText}>Initializing GPS navigation...</Text>
        </View>
      </SafeAreaView>
    );
  }
  
  // Check if route exists
  if (!plantsRoute || plantsRoute.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#4CAF50" />
        <View style={styles.errorContainer}>
          <MaterialIcons name="error-outline" size={64} color="#f44336" />
          <Text style={styles.errorText}>No route available</Text>
          <TouchableOpacity 
            style={styles.errorButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.errorButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }
  
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#4CAF50" />
      
      {/* Header */}
      <Animated.View 
        style={[
          styles.header,
          { opacity: fadeAnim }
        ]}
      >
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => {
            if (navigationStarted) {
              Alert.alert(
                'Stop Navigation?',
                'Are you sure you want to stop navigation?',
                [
                  {
                    text: 'Cancel',
                    style: 'cancel',
                  },
                  {
                    text: 'Stop Navigation',
                    onPress: () => navigation.goBack(),
                    style: 'destructive',
                  },
                ]
              );
            } else {
              navigation.goBack();
            }
          }}
        >
          <MaterialIcons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Watering Navigation</Text>
          <Text style={styles.headerSubtitle}>
            {currentStep + 1} of {plantsRoute.length} plants
          </Text>
        </View>
        
        <TouchableOpacity 
          style={[
            styles.navigationButton,
            navigationStarted ? styles.activeNavigationButton : null,
          ]}
          onPress={toggleNavigation}
        >
          <MaterialIcons 
            name={navigationStarted ? "pause" : "play-arrow"} 
            size={24} 
            color="#fff" 
          />
        </TouchableOpacity>
      </Animated.View>
      
      {/* Progress Bar */}
      <View style={styles.progressBarContainer}>
        <View style={styles.progressBar}>
          <View 
            style={[
              styles.progressFill,
              { width: `${routeProgress}%` }
            ]}
          />
        </View>
      </View>
      
      {/* Current Plant Info */}
      <Animated.View 
        style={[
          styles.plantInfoCard,
          { 
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }] 
          }
        ]}
      >
        <View style={styles.plantHeader}>
          <View style={styles.plantIconContainer}>
            <MaterialCommunityIcons name="leaf" size={32} color="#fff" />
          </View>
          
          <View style={styles.plantInfo}>
            <Text style={styles.plantName}>{currentPlant?.name || 'Unknown Plant'}</Text>
            
            {currentPlant?.location && (
              <Text style={styles.plantLocation}>
                {[
                  currentPlant.location.section && `Section ${currentPlant.location.section}`,
                  currentPlant.location.aisle && `Aisle ${currentPlant.location.aisle}`,
                  currentPlant.location.shelfNumber && `Shelf ${currentPlant.location.shelfNumber}`
                ].filter(Boolean).join(', ')}
              </Text>
            )}
          </View>
          
          <View style={styles.distanceContainer}>
            <MaterialIcons name="place" size={16} color="#4CAF50" />
            <Text style={styles.distanceText}>
              {distanceToTarget ? formatDistance(distanceToTarget) : 'Calculating...'}
            </Text>
          </View>
        </View>
        
        <View style={styles.navigationControls}>
          <TouchableOpacity 
            style={[styles.navControl, currentStep === 0 && styles.disabledControl]}
            onPress={moveToPreviousPlant}
            disabled={currentStep === 0}
          >
            <MaterialIcons 
              name="navigate-before" 
              size={24} 
              color={currentStep === 0 ? '#bdbdbd' : '#4CAF50'} 
            />
            <Text 
              style={[
                styles.navControlText,
                currentStep === 0 && styles.disabledText
              ]}
            >
              Previous
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[
              styles.waterButton,
              completedPlants.includes(currentPlant?.id) && styles.completedButton,
              isWatering && styles.disabledButton
            ]}
            onPress={handleWaterPlant}
            disabled={isWatering || completedPlants.includes(currentPlant?.id)}
          >
            {isWatering ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <MaterialCommunityIcons 
                  name={completedPlants.includes(currentPlant?.id) ? "check" : "water"} 
                  size={20} 
                  color="#fff" 
                />
                <Text style={styles.waterButtonText}>
                  {completedPlants.includes(currentPlant?.id) ? 'Watered' : 'Water Now'}
                </Text>
              </>
            )}
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[
              styles.navControl, 
              currentStep === plantsRoute.length - 1 && styles.disabledControl
            ]}
            onPress={moveToNextPlant}
            disabled={currentStep === plantsRoute.length - 1}
          >
            <Text 
              style={[
                styles.navControlText,
                currentStep === plantsRoute.length - 1 && styles.disabledText
              ]}
            >
              Next
            </Text>
            <MaterialIcons 
              name="navigate-next" 
              size={24} 
              color={currentStep === plantsRoute.length - 1 ? '#bdbdbd' : '#4CAF50'} 
            />
          </TouchableOpacity>
        </View>
      </Animated.View>
      
      {/* Route Overview */}
      <Animated.View 
        style={[
          styles.routeContainer,
          { 
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }] 
          }
        ]}
      >
        <Text style={styles.routeTitle}>Route Overview</Text>
        
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.routeScroll}
        >
          {plantsRoute.map((plant, index) => (
            <TouchableOpacity 
              key={plant.id}
              style={[
                styles.routeStep,
                index === currentStep && styles.currentRouteStep,
                completedPlants.includes(plant.id) && styles.completedRouteStep
              ]}
              onPress={() => {
                setCurrentStep(index);
                setCurrentPlant(plant);
                setDistanceToTarget(null);
                setRouteProgress((index / (plantsRoute.length - 1)) * 100);
              }}
            >
              <View style={styles.routeStepNumber}>
                <Text style={styles.routeStepNumberText}>{index + 1}</Text>
              </View>
              
              <View style={styles.routeStepInfo}>
                <Text 
                  style={[
                    styles.routeStepName,
                    index === currentStep && styles.currentRouteStepText
                  ]}
                  numberOfLines={1}
                >
                  {plant.name}
                </Text>
                
                {completedPlants.includes(plant.id) && (
                  <View style={styles.completedBadge}>
                    <MaterialIcons name="check" size={12} color="#fff" />
                    <Text style={styles.completedText}>Watered</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </Animated.View>
      
      {/* Navigation Status */}
      <Animated.View 
        style={[
          styles.statusContainer,
          { opacity: fadeAnim }
        ]}
      >
        <View style={styles.statusInfo}>
          <Text style={styles.statusTitle}>
            {navigationStarted ? 'Navigation Active' : 'Navigation Paused'}
          </Text>
          <Text style={styles.statusSubtitle}>
            {navigationStarted 
              ? 'Moving toward next plant...' 
              : 'Press play to start navigation'}
          </Text>
        </View>
        
        <TouchableOpacity 
          style={styles.startButton}
          onPress={toggleNavigation}
        >
          <MaterialIcons 
            name={navigationStarted ? "pause" : "play-arrow"} 
            size={24} 
            color="#fff" 
          />
          <Text style={styles.startButtonText}>
            {navigationStarted ? 'Pause' : 'Start'}
          </Text>
        </TouchableOpacity>
      </Animated.View>
      
      {/* Current Location Indicator */}
      {navigationStarted && currentLocation && (
        <Animated.View 
          style={[
            styles.locationIndicator,
            { transform: [{ scale: pulseAnim }] }
          ]}
        >
          <View style={styles.locationDot} />
          <View style={styles.locationRing} />
        </Animated.View>
      )}
    </SafeAreaView>
  );
}

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
    fontSize: 18,
    color: '#f44336',
    marginTop: 16,
    marginBottom: 24,
  },
  errorButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  errorButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  header: {
    backgroundColor: '#4CAF50',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  backButton: {
    padding: 8,
  },
  headerContent: {
    flex: 1,
    marginLeft: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  navigationButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    padding: 8,
    borderRadius: 8,
  },
  activeNavigationButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
  },
  progressBarContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  progressBar: {
    height: 4,
    backgroundColor: '#e0e0e0',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#4CAF50',
    borderRadius: 2,
  },
  plantInfoCard: {
    backgroundColor: '#fff',
    margin: 16,
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  plantHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  plantIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  plantInfo: {
    flex: 1,
  },
  plantName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  plantLocation: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  distanceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f9f3',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  distanceText: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '600',
    marginLeft: 4,
  },
  navigationControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  navControl: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
  },
  disabledControl: {
    opacity: 0.5,
  },
  navControlText: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '600',
  },
  disabledText: {
    color: '#bdbdbd',
  },
  waterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4CAF50',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  waterButtonText: {
    color: '#fff',
    fontWeight: '600',
    marginLeft: 4,
  },
  completedButton: {
    backgroundColor: '#8BC34A',
  },
  disabledButton: {
    backgroundColor: '#bdbdbd',
  },
  routeContainer: {
    margin: 16,
    marginTop: 0,
  },
  routeTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  routeScroll: {
    flexDirection: 'row',
  },
  routeStep: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginRight: 12,
    borderRadius: 8,
    padding: 12,
    minWidth: 160,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 1,
  },
  currentRouteStep: {
    borderColor: '#4CAF50',
    borderWidth: 2,
  },
  completedRouteStep: {
    backgroundColor: '#f0f9f3',
  },
  routeStepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  routeStepNumberText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#666',
  },
  routeStepInfo: {
    flex: 1,
  },
  routeStepName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  currentRouteStepText: {
    color: '#4CAF50',
  },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#8BC34A',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  completedText: {
    fontSize: 10,
    color: '#fff',
    marginLeft: 2,
  },
  statusContainer: {
    margin: 16,
    marginTop: 0,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  statusInfo: {
    flex: 1,
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  statusSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4CAF50',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  startButtonText: {
    color: '#fff',
    fontWeight: '600',
    marginLeft: 4,
  },
  locationIndicator: {
    position: 'absolute',
    bottom: 30,
    right: 30,
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  locationDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#4CAF50',
  },
  locationRing: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: 'rgba(76, 175, 80, 0.5)',
  },
});