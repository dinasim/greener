// screens/MapScreen.js
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  StyleSheet,
  ActivityIndicator,
  Text,
  SafeAreaView,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRoute, useNavigation, useFocusEffect } from '@react-navigation/native';
import * as Location from 'expo-location';

import MarketplaceHeader from '../components/MarketplaceHeader';
import CrossPlatformAzureMapView from '../components/CrossPlatformAzureMapView';
import MapSearchBox from '../components/MapSearchBox';
import RadiusControl from '../components/RadiusControl';
import { getNearbyProducts, getAzureMapsKey, reverseGeocode } from '../services/marketplaceApi';

/**
 * Fixed MapScreen component with:
 * 1. Radius controls remaining visible when using "My Location"
 * 2. Integrated product list in the radius control
 * 3. Better error handling and state management
 */
const MapScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { products = [], initialLocation } = route.params || {};

  // State variables
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
  const [searchingLocation, setSearchingLocation] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [radiusVisible, setRadiusVisible] = useState(true);
  
  // Refs
  const mapRef = useRef(null);
  const listRef = useRef(null);

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
  useFocusEffect(
    useCallback(() => {
      if (products.length > 0) {
        setMapProducts(products);
        // If we have products but no selected location, try to calculate center
        if (products.length > 0 && !selectedLocation) {
          const locationsWithCoords = products.filter(
            p => p.location?.latitude && p.location?.longitude
          );
          
          if (locationsWithCoords.length > 0) {
            // Use first product's location
            setSelectedLocation({
              latitude: locationsWithCoords[0].location.latitude,
              longitude: locationsWithCoords[0].location.longitude,
              city: locationsWithCoords[0].location?.city || locationsWithCoords[0].city || 'Unknown location'
            });
          }
        }
      }
      
      // If initial location is provided, set it and search nearby products
      if (initialLocation?.latitude && initialLocation?.longitude) {
        setSelectedLocation(initialLocation);
        if (products.length === 0) {
          // Only load nearby products if no products were passed in
          loadNearbyProducts(initialLocation, searchRadius);
        }
      }
    }, [products, initialLocation])
  );

  // Handle location selection
  const handleLocationSelect = (location) => {
    setSelectedLocation(location);
    if (location?.latitude && location?.longitude) {
      // Make sure radius controls stay visible
      setRadiusVisible(true);
      loadNearbyProducts(location, searchRadius);
    }
  };

  // Handle radius change
  const handleRadiusChange = (radius) => {
    setSearchRadius(radius);
  };
  
  // Apply radius change and reload products
  const handleApplyRadius = (radius) => {
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
      setSearchingLocation(true);
      
      // IMPORTANT: Make sure radius control stays visible during search
      setRadiusVisible(true);

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
    } catch (err) {
      console.error('Error loading nearby products:', err);
      setError('Failed to load products. Please try again.');
    } finally {
      // Always reset these states, even if there's an error
      setIsLoading(false);
      setSearchingLocation(false);
    }
  };

  // Handle product selection
  const handleProductSelect = (productId) => {
    // Find selected product
    const product = mapProducts.find(p => p.id === productId || p._id === productId);
    
    if (product) {
      // Set selected product for highlighting
      setSelectedProduct(product);
      
      // Navigate to plant detail
      navigation.navigate('PlantDetail', { plantId: productId });
    }
  };

  // FIXED: Get current location - Now properly preserves radius control visibility
  const handleGetCurrentLocation = async () => {
    try {
      setIsLoading(true);
      setSearchingLocation(true);
      
      // IMPORTANT: Make sure radius control stays visible
      setRadiusVisible(true);

      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required to use this feature.');
        setIsLoading(false);
        setSearchingLocation(false);
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
          city: addressData.city || 'Current Location',
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
      // CRITICAL FIX: Always reset these states, even if there's an error
      setIsLoading(false);
      setSearchingLocation(false);
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

  // Handle map click
  const handleMapPress = (coordinates) => {
    if (coordinates?.latitude && coordinates?.longitude) {
      setSelectedLocation({
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
        formattedAddress: `${coordinates.latitude.toFixed(6)}, ${coordinates.longitude.toFixed(6)}`,
        city: 'Selected Location',
      });
      
      // IMPORTANT: Make sure radius control stays visible when clicking on map
      setRadiusVisible(true);
      
      // Load nearby products with the new location
      loadNearbyProducts(coordinates, searchRadius);
    }
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
        title={selectedLocation?.city ? `Plants near ${selectedLocation.city}` : "Map View"}
        showBackButton={true}
        onBackPress={() => navigation.goBack()}
        onNotificationsPress={() => navigation.navigate('Messages')}
      />

      <View style={styles.mapContainer}>
        {/* Map View */}
        {viewMode === 'map' && (
          <>
            {isLoading && searchingLocation ? (
              <View style={styles.searchingOverlay}>
                <ActivityIndicator size="large" color="#4CAF50" />
                <Text style={styles.searchingText}>Finding plants nearby...</Text>
              </View>
            ) : error ? (
              <View style={styles.errorOverlay}>
                <MaterialIcons name="error-outline" size={48} color="#f44336" />
                <Text style={styles.errorText}>{error}</Text>
                <TouchableOpacity 
                  style={styles.retryButton}
                  onPress={() => selectedLocation && loadNearbyProducts(selectedLocation, searchRadius)}
                >
                  <Text style={styles.retryButtonText}>Retry</Text>
                </TouchableOpacity>
              </View>
            ) : null}
            
            <CrossPlatformAzureMapView
              ref={mapRef}
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
              searchRadius={searchRadius}
              onMapPress={handleMapPress}
            />
          </>
        )}

        {/* Search Box */}
        <MapSearchBox 
          onLocationSelect={handleLocationSelect} 
          azureMapsKey={azureMapsKey}
        />

        {/* Current Location Button */}
        <TouchableOpacity
          style={styles.currentLocationButton}
          onPress={handleGetCurrentLocation}
          disabled={isLoading}
        >
          {isLoading && !searchingLocation ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <MaterialIcons name="my-location" size={24} color="#fff" />
          )}
        </TouchableOpacity>

        {/* Enhanced Radius Control with Integrated Product List */}
        {selectedLocation && viewMode === 'map' && radiusVisible && (
          <RadiusControl
            radius={searchRadius}
            onRadiusChange={handleRadiusChange}
            onApply={handleApplyRadius}
            products={nearbyProducts}
            isLoading={isLoading}
            error={error}
            onProductSelect={handleProductSelect}
            onToggleViewMode={toggleViewMode}
          />
        )}
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
    marginTop: 12,
    fontSize: 16,
    color: '#555',
  },
  searchingOverlay: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(255,255,255,0.9)',
    padding: 16,
    alignItems: 'center',
    zIndex: 5,
    borderRadius: 8,
    margin: 16,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  searchingText: {
    marginLeft: 12,
    fontSize: 16,
    color: '#555',
  },
  errorOverlay: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(255,255,255,0.9)',
    padding: 16,
    alignItems: 'center',
    zIndex: 5,
    borderRadius: 8,
    margin: 16,
  },
  errorText: {
    color: '#f44336',
    textAlign: 'center',
    padding: 12,
    fontSize: 16,
  },
  retryButton: {
    marginTop: 8,
    backgroundColor: '#4CAF50',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 4,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  currentLocationButton: {
    position: 'absolute',
    right: 10,
    bottom: Platform.OS === 'ios' ? 450 : 420, // Position above the radius control
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
});

export default MapScreen;