// screens/MapScreen.js
import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ActivityIndicator,
  Text,
  SafeAreaView,
  TouchableOpacity,
  Alert,
  FlatList,
  Dimensions,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';
import * as Location from 'expo-location';

import MarketplaceHeader from '../components/MarketplaceHeader';
import CrossPlatformAzureMapView from '../components/CrossPlatformAzureMapView';
import MapSearchBox from '../components/MapSearchBox';
import RadiusControl from '../components/RadiusControl';
import PlantCard from '../components/PlantCard';
import { getNearbyProducts, getAzureMapsKey, reverseGeocode } from '../services/marketplaceApi';

const { width, height } = Dimensions.get('window');

const MapScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { products = [], initialLocation } = route.params || {};

  const [mapProducts, setMapProducts] = useState(products);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedLocation, setSelectedLocation] = useState(initialLocation);
  const [searchRadius, setSearchRadius] = useState(10);
  const [azureMapsKey, setAzureMapsKey] = useState(null);
  const [isKeyLoading, setIsKeyLoading] = useState(true);
  const [nearbyProducts, setNearbyProducts] = useState([]);
  const [sortOrder, setSortOrder] = useState('nearest'); // 'nearest' or 'farthest'
  const [viewMode, setViewMode] = useState('map'); // 'map' or 'list'
  const [showResults, setShowResults] = useState(false);

  // Load Azure Maps key when component mounts
  useEffect(() => {
    const loadMapsKey = async () => {
      try {
        setIsKeyLoading(true);
        const key = await getAzureMapsKey();
        setAzureMapsKey(key);
        setIsKeyLoading(false);
      } catch (err) {
        console.error('Error fetching Azure Maps key:', err);
        setError('Failed to load map configuration. Please try again later.');
        setIsKeyLoading(false);
      }
    };

    loadMapsKey();
  }, []);

  // Initialize map with products if provided
  useEffect(() => {
    if (products.length > 0) {
      setMapProducts(products);
      if (initialLocation) {
        setSelectedLocation(initialLocation);
      }
    }
  }, [products, initialLocation]);

  // Handle location selection
  const handleLocationSelect = (location) => {
    setSelectedLocation(location);
    if (location?.latitude && location?.longitude) {
      loadNearbyProducts(location, searchRadius);
    }
  };

  // Handle radius change
  const handleRadiusChange = (radius) => {
    setSearchRadius(radius);
    if (selectedLocation?.latitude && selectedLocation?.longitude) {
      loadNearbyProducts(selectedLocation, radius);
    }
  };

  // Load nearby products based on location and radius
  const loadNearbyProducts = async (location, radius) => {
    if (!location?.latitude || !location?.longitude) return;

    try {
      setIsLoading(true);
      setError(null);

      const result = await getNearbyProducts(
        location.latitude,
        location.longitude,
        radius
      );

      if (result && result.products) {
        const products = result.products.map(product => ({
          ...product,
          distance: product.distance || 0
        }));
        
        // Sort products by distance
        const sortedProducts = sortProductsByDistance(products, sortOrder === 'nearest');
        
        setMapProducts(sortedProducts);
        setNearbyProducts(sortedProducts);
        setShowResults(true);
      } else {
        setMapProducts([]);
        setNearbyProducts([]);
        setShowResults(true);
      }

      setIsLoading(false);
    } catch (err) {
      console.error('Error loading nearby products:', err);
      setError('Failed to load products. Please try again.');
      setIsLoading(false);
    }
  };

  // Handle product selection
  const handleProductSelect = (productId) => {
    navigation.navigate('PlantDetail', { plantId: productId });
  };

  // Get current location
  const handleGetCurrentLocation = async () => {
    try {
      setIsLoading(true);

      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required to use this feature.');
        setIsLoading(false);
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced
      });

      const { latitude, longitude } = location.coords;

      try {
        // Reverse geocode to get address details
        const addressData = await reverseGeocode(latitude, longitude);

        const locationData = {
          latitude,
          longitude,
          formattedAddress: addressData.formattedAddress,
          city: addressData.city || 'Unknown Location',
        };

        setSelectedLocation(locationData);
        loadNearbyProducts(locationData, searchRadius);
      } catch (geocodeError) {
        console.error('Geocoding error:', geocodeError);
        // If geocoding fails, still use the coordinates
        const locationData = {
          latitude,
          longitude,
          formattedAddress: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
          city: 'Current Location',
        };

        setSelectedLocation(locationData);
        loadNearbyProducts(locationData, searchRadius);
      }
    } catch (err) {
      console.error('Error getting current location:', err);
      Alert.alert('Location Error', 'Could not get your current location. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  };

  // Toggle sort order
  const toggleSortOrder = () => {
    const newOrder = sortOrder === 'nearest' ? 'farthest' : 'nearest';
    setSortOrder(newOrder);
    
    // Re-sort products
    const sorted = sortProductsByDistance(nearbyProducts, newOrder === 'nearest');
    setMapProducts(sorted);
    setNearbyProducts(sorted);
  };

  // Toggle view mode between map and list
  const toggleViewMode = () => {
    setViewMode(viewMode === 'map' ? 'list' : 'map');
  };

  // Sort products by distance
  const sortProductsByDistance = (productList, ascending = true) => {
    return [...productList].sort((a, b) => {
      const distA = a.distance || 0;
      const distB = b.distance || 0;
      return ascending ? distA - distB : distB - distA;
    });
  };

  // Get current location button styles based on view mode
  const getCurrentLocationButtonStyle = () => {
    return [
      styles.currentLocationButton,
      { bottom: viewMode === 'map' ? 120 : 20 }
    ];
  };

  // Get view toggle button styles based on view mode
  const getViewToggleButtonStyle = () => {
    return [
      styles.viewToggleButton,
      { bottom: viewMode === 'map' ? 120 : 20 }
    ];
  };

  // Render loading state
  if (isKeyLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <MarketplaceHeader
          title="Map View"
          showBackButton={true}
          onBackPress={() => navigation.goBack()}
          onNotificationsPress={() => navigation.navigate('Messages')}
        />
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text style={styles.loadingText}>Loading map configuration...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <MarketplaceHeader
        title="Map View"
        showBackButton={true}
        onBackPress={() => navigation.goBack()}
        onNotificationsPress={() => navigation.navigate('Messages')}
      />

      <View style={styles.mapContainer}>
        {/* Map View */}
        {viewMode === 'map' && (
          <>
            {isLoading ? (
              <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color="#4CAF50" />
                <Text style={styles.loadingText}>Loading...</Text>
              </View>
            ) : error ? (
              <View style={styles.centerContainer}>
                <MaterialIcons name="error-outline" size={48} color="#f44336" />
                <Text style={styles.errorText}>{error}</Text>
                <TouchableOpacity 
                  style={styles.retryButton}
                  onPress={() => selectedLocation && loadNearbyProducts(selectedLocation, searchRadius)}
                >
                  <Text style={styles.retryButtonText}>Retry</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <CrossPlatformAzureMapView
                products={mapProducts}
                onSelectProduct={handleProductSelect}
                initialRegion={
                  selectedLocation
                    ? {
                        latitude: selectedLocation.latitude,
                        longitude: selectedLocation.longitude,
                        zoom: 12,
                      }
                    : undefined
                }
                showControls={true}
                azureMapsKey={azureMapsKey}
              />
            )}
          </>
        )}

        {/* List View */}
        {viewMode === 'list' && (
          <FlatList
            data={nearbyProducts}
            renderItem={({ item }) => (
              <PlantCard 
                plant={item} 
                showActions={true} 
                layout="list"
              />
            )}
            keyExtractor={(item) => item.id || item._id}
            contentContainerStyle={styles.listContainer}
            ListEmptyComponent={
              <View style={styles.emptyListContainer}>
                <MaterialIcons name="eco" size={48} color="#ccc" />
                <Text style={styles.emptyListText}>
                  No plants found in this area
                </Text>
              </View>
            }
          />
        )}

        {/* Search Box */}
        <MapSearchBox onLocationSelect={handleLocationSelect} />

        {/* View Toggle */}
        {showResults && nearbyProducts.length > 0 && (
          <TouchableOpacity
            style={getViewToggleButtonStyle()}
            onPress={toggleViewMode}
          >
            <MaterialIcons 
              name={viewMode === 'map' ? 'view-list' : 'map'} 
              size={22} 
              color="#fff" 
            />
            <Text style={styles.viewToggleText}>
              {viewMode === 'map' ? 'List View' : 'Map View'}
            </Text>
          </TouchableOpacity>
        )}

        {/* Radius Control */}
        {selectedLocation && viewMode === 'map' && (
          <View style={styles.radiusControlContainer}>
            <RadiusControl
              radius={searchRadius}
              onRadiusChange={handleRadiusChange}
              onApply={(radius) => handleRadiusChange(radius)}
            />

            {/* Sorting and Results Count */}
            {nearbyProducts.length > 0 && (
              <View style={styles.resultsContainer}>
                <Text style={styles.resultsText}>
                  Found {nearbyProducts.length} plants within {searchRadius} km
                </Text>
                <TouchableOpacity
                  style={styles.sortButton}
                  onPress={toggleSortOrder}
                >
                  <MaterialIcons 
                    name={sortOrder === 'nearest' ? 'arrow-upward' : 'arrow-downward'} 
                    size={16} 
                    color="#fff" 
                  />
                  <Text style={styles.sortButtonText}>
                    {sortOrder === 'nearest' ? 'Nearest First' : 'Farthest First'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* Use Current Location button */}
        <TouchableOpacity
          style={getCurrentLocationButtonStyle()}
          onPress={handleGetCurrentLocation}
        >
          <MaterialIcons name="my-location" size={24} color="#fff" />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#555',
  },
  errorText: {
    color: '#f44336',
    textAlign: 'center',
    padding: 20,
    fontSize: 16,
  },
  retryButton: {
    marginTop: 16,
    backgroundColor: '#4CAF50',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 4,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  radiusControlContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'white',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 8,
    paddingBottom: 16,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    maxHeight: height * 0.5, // Maximum 50% of screen height
  },
  resultsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    marginTop: 8,
  },
  resultsText: {
    fontSize: 14,
    color: '#666',
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  sortButtonText: {
    color: '#fff',
    fontSize: 14,
    marginLeft: 4,
  },
  currentLocationButton: {
    position: 'absolute',
    right: 10,
    backgroundColor: '#4CAF50',
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  viewToggleButton: {
    position: 'absolute',
    right: 70,
    backgroundColor: '#4CAF50',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 25,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  viewToggleText: {
    color: '#fff',
    marginLeft: 4,
    fontWeight: '500',
  },
  listContainer: {
    padding: 16,
    paddingBottom: 80,
  },
  emptyListContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    minHeight: 300,
  },
  emptyListText: {
    fontSize: 16,
    color: '#666',
    marginTop: 16,
    textAlign: 'center',
  },
});

export default MapScreen;