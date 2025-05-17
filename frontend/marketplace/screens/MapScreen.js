import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ActivityIndicator,
  Text,
  SafeAreaView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';

import MarketplaceHeader from '../components/MarketplaceHeader';
import CrossPlatformAzureMapView from '../components/CrossPlatformAzureMapView';
import MapSearchBox from '../components/MapSearchBox';
import RadiusControl from '../components/RadiusControl';
import { getNearbyProducts } from '../services/marketplaceApi';
import { getAzureMapsKey, reverseGeocode } from '../services/azureMapsService';

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

  useEffect(() => {
    if (products.length > 0) {
      setMapProducts(products);
    }
  }, [products]);

  const handleLocationSelect = (location) => {
    setSelectedLocation(location);
    if (location?.latitude && location?.longitude) {
      loadNearbyProducts(location, searchRadius);
    }
  };

  const handleRadiusChange = (radius) => {
    setSearchRadius(radius);
    if (selectedLocation?.latitude && selectedLocation?.longitude) {
      loadNearbyProducts(selectedLocation, radius);
    }
  };

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
        setMapProducts(result.products);
      } else {
        setMapProducts([]);
      }

      setIsLoading(false);
    } catch (err) {
      console.error('Error loading nearby products:', err);
      setError('Failed to load products. Please try again.');
      setIsLoading(false);
    }
  };

  const handleProductSelect = (productId) => {
    navigation.navigate('PlantDetail', { plantId: productId });
  };

  const handleUseAzureCurrentLocation = async () => {
    try {
      if (!navigator.geolocation) {
        Alert.alert('Error', 'Geolocation is not supported on this device');
        return;
      }

      setIsLoading(true);

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;

          const result = await reverseGeocode(latitude, longitude);
          const isInIsrael = result?.country === 'Israel' || result?.formattedAddress?.includes('Israel');

          if (!isInIsrael) {
            Alert.alert('Error', 'This app only supports locations in Israel');
            setIsLoading(false);
            return;
          }

          const locationData = {
            latitude,
            longitude,
            formattedAddress: result.formattedAddress,
            city: result.city || '',
            country: 'Israel',
            street: result.street || '',
          };

          setSelectedLocation(locationData);
          loadNearbyProducts(locationData, searchRadius);
          setIsLoading(false);
        },
        (error) => {
          console.error('Geolocation error:', error);
          Alert.alert('Error', 'Could not determine your current location');
          setIsLoading(false);
        },
        { enableHighAccuracy: true }
      );
    } catch (error) {
      console.error('Azure geolocation error:', error);
      Alert.alert('Error', 'Something went wrong while getting your location');
      setIsLoading(false);
    }
  };

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
        {isLoading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#4CAF50" />
            <Text style={styles.loadingText}>Loading...</Text>
          </View>
        ) : error ? (
          <View style={styles.centerContainer}>
            <Text style={styles.errorText}>{error}</Text>
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

        <MapSearchBox onLocationSelect={handleLocationSelect} />

        {selectedLocation && (
          <View style={styles.radiusControlContainer}>
            <RadiusControl
              radius={searchRadius}
              onRadiusChange={handleRadiusChange}
              onApply={(radius) => handleRadiusChange(radius)}
            />
          </View>
        )}

        {/* Use Azure location button */}
        <TouchableOpacity
          style={styles.currentLocationButton}
          onPress={handleUseAzureCurrentLocation}
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
  },
  radiusControlContainer: {
    position: 'absolute',
    bottom: 20,
    left: 10,
    right: 10,
  },
  currentLocationButton: {
    position: 'absolute',
    right: 20,
    bottom: 80,
    backgroundColor: '#4CAF50',
    width: 56,
    height: 56,
    borderRadius: 28,
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
