// screens/MapScreen.js - FIXED VERSION (Working User Location + Pins)
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
  BackHandler,
  Linking,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRoute, useNavigation, useFocusEffect } from '@react-navigation/native';
import * as Location from 'expo-location';

import MarketplaceHeader from '../components/MarketplaceHeader';
import CrossPlatformAzureMapView from '../components/CrossPlatformAzureMapView';
import MapSearchBox from '../components/MapSearchBox';
import RadiusControl from '../components/RadiusControl';
import ProductListView from '../components/ProductListView';
import BusinessListView from '../components/BusinessListView';
import PlantDetailMiniCard from '../components/PlantDetailMiniCard';
import BusinessDetailMiniCard from '../components/BusinessDetailMiniCard';
import MapModeToggle from '../components/MapModeToggle';
import { getNearbyProducts } from '../services/marketplaceApi';
import { getNearbyBusinesses } from '../../Business/services/businessApi';
import { getAzureMapsKey, reverseGeocode } from '../services/azureMapsService';

/**
 * Enhanced MapScreen with Plants/Businesses toggle and FIXED user location
 */
const MapScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { products = [], initialLocation } = route.params || {};

  // State variables
  const [mapMode, setMapMode] = useState('plants');
  const [mapProducts, setMapProducts] = useState(products);
  const [mapBusinesses, setMapBusinesses] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedLocation, setSelectedLocation] = useState(initialLocation);
  const [searchRadius, setSearchRadius] = useState(10);
  const [azureMapsKey, setAzureMapsKey] = useState(null);
  const [isKeyLoading, setIsKeyLoading] = useState(true);
  const [nearbyProducts, setNearbyProducts] = useState([]);
  const [nearbyBusinesses, setNearbyBusinesses] = useState([]);
  const [sortOrder, setSortOrder] = useState('nearest');
  const [viewMode, setViewMode] = useState('map');
  const [showResults, setShowResults] = useState(false);
  const [searchingLocation, setSearchingLocation] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedBusiness, setSelectedBusiness] = useState(null);
  const [radiusVisible, setRadiusVisible] = useState(true);
  const [myLocation, setMyLocation] = useState(null);
  const [showMyLocation, setShowMyLocation] = useState(false);
  const [showDetailCard, setShowDetailCard] = useState(false);
  const [selectedProductData, setSelectedProductData] = useState(null);
  const [selectedBusinessData, setSelectedBusinessData] = useState(null);
  const [counts, setCounts] = useState({ plants: 0, businesses: 0 });
  const [locationPermissionGranted, setLocationPermissionGranted] = useState(false);
  const [isGettingLocation, setIsGettingLocation] = useState(false);

  // Refs
  const mapRef = useRef(null);
  const listRef = useRef(null);

  // Handle Android back button
  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        if (viewMode === 'list') {
          setViewMode('map');
          return true;
        }
        return false;
      };

      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => subscription.remove();
    }, [viewMode])
  );

  // FIXED: Load Azure Maps key when component mounts
  useEffect(() => {
    const loadMapsKey = async () => {
      try {
        setIsKeyLoading(true);
        console.log('🗺️ Loading Azure Maps key...');
        const key = await getAzureMapsKey();
        console.log('✅ Azure Maps key loaded successfully');
        setAzureMapsKey(key);
        setIsKeyLoading(false);
      } catch (err) {
        console.error('❌ Error fetching Azure Maps key:', err);
        setError('Failed to load map configuration. Please check your internet connection.');
        setIsKeyLoading(false);
      }
    };

    loadMapsKey();
  }, []);

  // FIXED: Initialize user location on mount
  useEffect(() => {
    initializeUserLocation();
  }, []);

  // FIXED: Initialize map with products if provided
  useFocusEffect(
    useCallback(() => {
      if (products.length > 0) {
        console.log('📍 Processing', products.length, 'products for map');
        
        // Filter products with valid coordinates
        const productsWithCoords = products.filter(p => {
          const hasCoords = p.location?.latitude && p.location?.longitude;
          if (!hasCoords) {
            console.log('⚠️ Product missing coordinates:', p.id || p._id, p.title || p.name);
          }
          return hasCoords;
        });
        
        console.log('✅ Products with coordinates:', productsWithCoords.length);
        
        setMapProducts(productsWithCoords);
        setCounts(prev => ({ ...prev, plants: productsWithCoords.length }));
        
        // Set initial location from first product if no location set
        if (productsWithCoords.length > 0 && !selectedLocation) {
          const firstProduct = productsWithCoords[0];
          setSelectedLocation({
            latitude: firstProduct.location.latitude,
            longitude: firstProduct.location.longitude,
            city: firstProduct.location?.city || firstProduct.city || 'Location'
          });
          console.log('📍 Set initial location from product:', firstProduct.location);
        }
      }
      
      if (initialLocation?.latitude && initialLocation?.longitude) {
        console.log('📍 Using initial location:', initialLocation);
        setSelectedLocation(initialLocation);
        if (products.length === 0) {
          loadNearbyData(initialLocation, searchRadius);
        }
      }
    }, [products, initialLocation])
  );

  // FIXED: Initialize user location with better error handling
  const initializeUserLocation = async () => {
    try {
      console.log('📱 Checking location permissions...');
      
      // Check current permission status
      let { status } = await Location.getForegroundPermissionsAsync();
      console.log('📱 Current permission status:', status);
      
      if (status !== 'granted') {
        console.log('📱 Requesting location permission...');
        const { status: newStatus } = await Location.requestForegroundPermissionsAsync();
        status = newStatus;
        console.log('📱 New permission status:', status);
      }
      
      if (status === 'granted') {
        setLocationPermissionGranted(true);
        console.log('✅ Location permission granted');
        
        // Try to get current location
        try {
          console.log('📍 Getting current location...');
          const location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
            maximumAge: 30000, // 30 seconds
            timeout: 10000 // 10 seconds
          });
          
          const { latitude, longitude } = location.coords;
          console.log('✅ Got current location:', latitude, longitude);
          
          setMyLocation({ latitude, longitude });
          setShowMyLocation(true);
          
          // Set as selected location if none exists
          if (!selectedLocation) {
            try {
              const addressData = await reverseGeocode(latitude, longitude);
              const locationData = {
                latitude,
                longitude,
                formattedAddress: addressData.formattedAddress,
                city: addressData.city || 'Current Location',
              };
              setSelectedLocation(locationData);
              console.log('✅ Set current location as selected:', locationData);
            } catch (geocodeError) {
              console.warn('⚠️ Geocoding failed, using coordinates only:', geocodeError);
              setSelectedLocation({
                latitude,
                longitude,
                formattedAddress: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
                city: 'Current Location',
              });
            }
          }
        } catch (locationError) {
          console.warn('⚠️ Could not get current location:', locationError);
          // Don't show error to user, just continue without location
        }
      } else {
        console.log('⚠️ Location permission denied');
        setLocationPermissionGranted(false);
      }
    } catch (error) {
      console.error('❌ Error initializing user location:', error);
      setLocationPermissionGranted(false);
    }
  };

  // Handle location selection
  const handleLocationSelect = (location) => {
    console.log('📍 Location selected:', location);
    setSelectedLocation(location);
    if (location?.latitude && location?.longitude) {
      setRadiusVisible(true);
      loadNearbyData(location, searchRadius);
    }
  };

  // Handle radius change
  const handleRadiusChange = (radius) => {
    setSearchRadius(radius);
  };

  // Apply radius change and reload data
  const handleApplyRadius = (radius) => {
    if (selectedLocation?.latitude && selectedLocation?.longitude) {
      loadNearbyData(selectedLocation, radius);
    }
  };

  // Handle map mode change
  const handleMapModeChange = (newMode) => {
    setMapMode(newMode);
    setShowDetailCard(false);
    setSelectedProduct(null);
    setSelectedBusiness(null);
    setSelectedProductData(null);
    setSelectedBusinessData(null);
  };

  // Load nearby data based on current map mode
  const loadNearbyData = async (location, radius) => {
    if (!location?.latitude || !location?.longitude) {
      console.warn('⚠️ Invalid location for nearby data:', location);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      setSearchingLocation(true);
      setShowDetailCard(false);
      setRadiusVisible(true);

      console.log(`🔍 Loading nearby ${mapMode} for:`, location, 'radius:', radius);

      if (mapMode === 'plants') {
        await loadNearbyProducts(location, radius);
      } else {
        await loadNearbyBusinesses(location, radius);
      }
    } catch (err) {
      console.error('❌ Error loading nearby data:', err);
      setError('Failed to load nearby data. Please try again.');
    } finally {
      setIsLoading(false);
      setSearchingLocation(false);
    }
  };

  // Load nearby products
  const loadNearbyProducts = async (location, radius) => {
    try {
      const result = await getNearbyProducts(
        location.latitude,
        location.longitude,
        radius
      );

      if (result && result.products) {
        const products = result.products
          .filter(product => product.location?.latitude && product.location?.longitude)
          .map(product => ({
            ...product,
            distance: product.distance || 0
          }));

        console.log(`✅ Found ${products.length} nearby products`);
        
        const sortedProducts = sortProductsByDistance(products, sortOrder === 'nearest');
        
        setMapProducts(sortedProducts);
        setNearbyProducts(sortedProducts);
        setCounts(prev => ({ ...prev, plants: sortedProducts.length }));
        setShowResults(true);
      } else {
        console.log('📭 No nearby products found');
        setMapProducts([]);
        setNearbyProducts([]);
        setCounts(prev => ({ ...prev, plants: 0 }));
        setShowResults(true);
      }
    } catch (error) {
      console.error('❌ Error loading nearby products:', error);
      throw error;
    }
  };

  // Load nearby businesses
  const loadNearbyBusinesses = async (location, radius) => {
    try {
      const result = await getNearbyBusinesses(
        location.latitude,
        location.longitude,
        radius
      );

      if (result && result.businesses) {
        const businesses = result.businesses
          .filter(business => {
            const hasCoords = business.location?.latitude && business.location?.longitude ||
                              business.address?.latitude && business.address?.longitude;
            if (!hasCoords) {
              console.log('⚠️ Business missing coordinates:', business.id, business.businessName);
            }
            return hasCoords;
          })
          .map(business => ({
            ...business,
            distance: business.distance || 0,
            // Ensure location data is properly structured
            location: business.location || {
              latitude: business.address?.latitude,
              longitude: business.address?.longitude,
              city: business.address?.city || 'Unknown location'
            }
          }));

        console.log(`✅ Found ${businesses.length} nearby businesses`);
        
        const sortedBusinesses = sortBusinessesByDistance(businesses, sortOrder === 'nearest');
        
        setMapBusinesses(sortedBusinesses);
        setNearbyBusinesses(sortedBusinesses);
        setCounts(prev => ({ ...prev, businesses: sortedBusinesses.length }));
        setShowResults(true);
      } else {
        console.log('📭 No nearby businesses found');
        setMapBusinesses([]);
        setNearbyBusinesses([]);
        setCounts(prev => ({ ...prev, businesses: 0 }));
        setShowResults(true);
      }
    } catch (error) {
      console.error('❌ Error loading nearby businesses:', error);
      throw error;
    }
  };

  // Handle product selection from map
  const handleProductSelect = (productId) => {
    const product = mapProducts.find(p => p.id === productId || p._id === productId);
    
    if (product) {
      console.log("📦 Product selected:", product.title || product.name);
      setSelectedProduct(product);
      setSelectedProductData(product);
      setSelectedBusiness(null);
      setSelectedBusinessData(null);
      setShowDetailCard(true);
    }
  };

  // Handle business selection from map
  const handleBusinessSelect = (businessId) => {
    const business = mapBusinesses.find(b => b.id === businessId);
    
    if (business) {
      console.log("🏢 Business selected:", business.businessName || business.name);
      setSelectedBusiness(business);
      setSelectedBusinessData(business);
      setSelectedProduct(null);
      setSelectedProductData(null);
      setShowDetailCard(true);
    }
  };

  // Handle closing the detail card
  const handleCloseDetailCard = () => {
    setShowDetailCard(false);
  };

  // Handle view details button on mini cards
  const handleViewProductDetails = () => {
    if (selectedProductData) {
      navigation.navigate('PlantDetail', { 
        plantId: selectedProductData.id || selectedProductData._id 
      });
    }
  };

  const handleViewBusinessDetails = () => {
    if (selectedBusinessData) {
      navigation.navigate('BusinessSellerProfile', { 
        sellerId: selectedBusinessData.id,
        businessId: selectedBusinessData.id
      });
    }
  };

  // Handle get directions
  const handleGetDirections = () => {
    let lat, lng, label;
    
    if (mapMode === 'plants' && selectedProductData) {
      lat = selectedProductData.location?.latitude;
      lng = selectedProductData.location?.longitude;
      label = selectedProductData.title || selectedProductData.name;
    } else if (mapMode === 'businesses' && selectedBusinessData) {
      lat = selectedBusinessData.location?.latitude || selectedBusinessData.address?.latitude;
      lng = selectedBusinessData.location?.longitude || selectedBusinessData.address?.longitude;
      label = selectedBusinessData.businessName || selectedBusinessData.name;
    }
    
    if (!lat || !lng) {
      Alert.alert('Error', 'Location coordinates not available');
      return;
    }
    
    const encodedLabel = encodeURIComponent(label);
    let url;
    
    if (Platform.OS === 'ios') {
      url = `maps://app?daddr=${lat},${lng}&ll=${lat},${lng}&q=${encodedLabel}`;
    } else {
      url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&destination_place_id=${encodedLabel}`;
    }
    
    Linking.openURL(url).catch(err => {
      console.error('❌ Error opening maps app:', err);
      Alert.alert('Error', 'Could not open maps application');
    });
  };

  // FIXED: Get current location with better UX
  const handleGetCurrentLocation = async () => {
    if (isGettingLocation) return;

    try {
      setIsGettingLocation(true);
      setIsLoading(true);
      setSearchingLocation(true);
      setShowDetailCard(false);
      setRadiusVisible(true);

      console.log('📱 Getting current location...');

      if (!locationPermissionGranted) {
        console.log('📱 Requesting location permission...');
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Required', 'Location permission is required to show your current position on the map.');
          return;
        }
        setLocationPermissionGranted(true);
      }

      // Get high-accuracy location
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
        maximumAge: 10000, // 10 seconds
        timeout: 15000 // 15 seconds
      });

      const { latitude, longitude } = location.coords;
      console.log('✅ Got current location:', latitude, longitude);
      
      setMyLocation({ latitude, longitude });
      setShowMyLocation(true);

      // Try to get address information
      try {
        const addressData = await reverseGeocode(latitude, longitude);
        const locationData = {
          latitude,
          longitude,
          formattedAddress: addressData.formattedAddress,
          city: addressData.city || 'Current Location',
        };

        console.log('✅ Geocoded address:', addressData);
        setSelectedLocation(locationData);
        loadNearbyData(locationData, searchRadius);
      } catch (geocodeError) {
        console.warn('⚠️ Geocoding failed:', geocodeError);
        const locationData = {
          latitude,
          longitude,
          formattedAddress: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
          city: 'Current Location',
        };

        setSelectedLocation(locationData);
        loadNearbyData(locationData, searchRadius);
      }
    } catch (err) {
      console.error('❌ Error getting current location:', err);
      Alert.alert(
        'Location Error', 
        'Could not get your current location. Please make sure location services are enabled and try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsGettingLocation(false);
      setIsLoading(false);
      setSearchingLocation(false);
    }
  };

  // Toggle sort order
  const toggleSortOrder = () => {
    const newOrder = sortOrder === 'nearest' ? 'farthest' : 'nearest';
    setSortOrder(newOrder);
    
    if (mapMode === 'plants') {
      const sorted = sortProductsByDistance(nearbyProducts, newOrder === 'nearest');
      setMapProducts(sorted);
      setNearbyProducts(sorted);
    } else {
      const sorted = sortBusinessesByDistance(nearbyBusinesses, newOrder === 'nearest');
      setMapBusinesses(sorted);
      setNearbyBusinesses(sorted);
    }
  };

  // Toggle view mode between map and list
  const toggleViewMode = () => {
    if (showDetailCard) {
      setShowDetailCard(false);
    }
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

  // Sort businesses by distance
  const sortBusinessesByDistance = (businessList, ascending = true) => {
    return [...businessList].sort((a, b) => {
      const distA = a.distance || 0;
      const distB = b.distance || 0;
      return ascending ? distA - distB : distB - distA;
    });
  };

  // Handle map click
  const handleMapPress = (coordinates) => {
    if (showDetailCard) {
      setShowDetailCard(false);
      return;
    }
    
    if (coordinates?.latitude && coordinates?.longitude) {
      console.log('📍 Map clicked at:', coordinates);
      setSelectedLocation({
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
        formattedAddress: `${coordinates.latitude.toFixed(6)}, ${coordinates.longitude.toFixed(6)}`,
        city: 'Selected Location',
      });
      
      setRadiusVisible(true);
      loadNearbyData(coordinates, searchRadius);
    }
  };

  // Retry loading data
  const handleRetry = () => {
    if (selectedLocation?.latitude && selectedLocation?.longitude) {
      loadNearbyData(selectedLocation, searchRadius);
    } else {
      // Try to get current location again
      handleGetCurrentLocation();
    }
  };

  // Custom back handler
  const handleBackPress = () => {
    if (viewMode === 'list') {
      setViewMode('map');
    } else {
      navigation.goBack();
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
          <Text style={styles.loadingText}>Loading map...</Text>
          <Text style={styles.subText}>Please wait while we initialize the map</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Prepare header title
  const headerTitle = viewMode === 'list' 
    ? `${mapMode === 'plants' ? 'Plants' : 'Businesses'} near ${selectedLocation?.city || 'you'}`
    : (selectedLocation?.city ? `${mapMode === 'plants' ? 'Plants' : 'Businesses'} near ${selectedLocation.city}` : "Map View");

  // Get current map data based on mode
  const currentMapData = mapMode === 'plants' ? mapProducts : mapBusinesses;
  const currentNearbyData = mapMode === 'plants' ? nearbyProducts : nearbyBusinesses;

  return (
    <SafeAreaView style={styles.container}>
      <MarketplaceHeader
        title={headerTitle}
        showBackButton={true}
        onBackPress={handleBackPress}
        onNotificationsPress={() => navigation.navigate('Messages')}
      />

      <View style={styles.mapContainer}>
        {/* Map Mode Toggle */}
        <MapModeToggle 
          mapMode={mapMode}
          onMapModeChange={handleMapModeChange}
          counts={counts}
        />

        {/* Map View */}
        {viewMode === 'map' && (
          <>
            {/* Loading/Error Overlays */}
            {isLoading && searchingLocation ? (
              <View style={styles.searchingOverlay}>
                <ActivityIndicator size="large" color="#4CAF50" />
                <Text style={styles.searchingText}>
                  Finding {mapMode === 'plants' ? 'plants' : 'businesses'} nearby...
                </Text>
              </View>
            ) : error ? (
              <View style={styles.errorOverlay}>
                <MaterialIcons name="error-outline" size={48} color="#f44336" />
                <Text style={styles.errorText}>{error}</Text>
                <TouchableOpacity 
                  style={styles.retryButton}
                  onPress={handleRetry}
                >
                  <Text style={styles.retryButtonText}>Retry</Text>
                </TouchableOpacity>
              </View>
            ) : null}
            
            {/* Map Component */}
            <CrossPlatformAzureMapView
              ref={mapRef}
              products={mapMode === 'plants' ? mapProducts : []}
              businesses={mapMode === 'businesses' ? mapBusinesses : []}
              mapMode={mapMode}
              onSelectProduct={handleProductSelect}
              onSelectBusiness={handleBusinessSelect}
              initialRegion={
                selectedLocation
                  ? {
                      latitude: selectedLocation.latitude,
                      longitude: selectedLocation.longitude,
                      zoom: 12,
                    }
                  : myLocation
                  ? {
                      latitude: myLocation.latitude,
                      longitude: myLocation.longitude,
                      zoom: 12,
                    }
                  : {
                      latitude: 32.0853,
                      longitude: 34.7818,
                      zoom: 10,
                    }
              }
              showControls={true}
              azureMapsKey={azureMapsKey}
              searchRadius={searchRadius}
              onMapPress={handleMapPress}
              showMyLocation={showMyLocation}
              myLocation={myLocation}
              useCustomPin={true}
            />
            
            {/* Detail Mini Cards */}
            {showDetailCard && selectedProductData && mapMode === 'plants' && (
              <View style={styles.detailCardContainer}>
                <PlantDetailMiniCard
                  plant={selectedProductData}
                  onClose={handleCloseDetailCard}
                  onViewDetails={handleViewProductDetails}
                />
              </View>
            )}

            {showDetailCard && selectedBusinessData && mapMode === 'businesses' && (
              <View style={styles.detailCardContainer}>
                <BusinessDetailMiniCard
                  business={selectedBusinessData}
                  onClose={handleCloseDetailCard}
                  onViewDetails={handleViewBusinessDetails}
                  onGetDirections={handleGetDirections}
                />
              </View>
            )}
          </>
        )}

        {/* List View */}
        {viewMode === 'list' && (
          <View style={styles.listContainer}>
            {mapMode === 'plants' ? (
              <ProductListView
                products={nearbyProducts}
                isLoading={isLoading}
                error={error}
                onRetry={handleRetry}
                onProductSelect={(productId) => navigation.navigate('PlantDetail', { plantId: productId })}
                sortOrder={sortOrder}
                onSortChange={toggleSortOrder}
              />
            ) : (
              <BusinessListView
                businesses={nearbyBusinesses}
                isLoading={isLoading}
                error={error}
                onRetry={handleRetry}
                onBusinessSelect={(businessId) => navigation.navigate('BusinessSellerProfile', { 
                  sellerId: businessId,
                  businessId: businessId
                })}
                sortOrder={sortOrder}
                onSortChange={toggleSortOrder}
              />
            )}
            
            {/* Back to Map Button */}
            <TouchableOpacity
              style={styles.backToMapButton}
              onPress={toggleViewMode}
            >
              <MaterialIcons name="map" size={24} color="#fff" />
              <Text style={styles.backToMapText}>Map View</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Search Box */}
        <MapSearchBox 
          onLocationSelect={handleLocationSelect} 
          azureMapsKey={azureMapsKey}
        />

        {/* Current Location Button */}
        <TouchableOpacity
          style={[
            styles.currentLocationButton,
            isGettingLocation && styles.disabledButton
          ]}
          onPress={handleGetCurrentLocation}
          disabled={isGettingLocation}
        >
          {isGettingLocation ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <MaterialIcons 
              name="my-location" 
              size={24} 
              color={showMyLocation ? "#4CAF50" : "#fff"}
            />
          )}
        </TouchableOpacity>

        {/* Toggle View Button (only shown in map view) */}
        {viewMode === 'map' && currentMapData.length > 0 && (
          <TouchableOpacity
            style={styles.viewToggleButton}
            onPress={toggleViewMode}
          >
            <MaterialIcons name="view-list" size={22} color="#fff" />
            <Text style={styles.viewToggleText}>List</Text>
          </TouchableOpacity>
        )}

        {/* Enhanced Radius Control */}
        {selectedLocation && viewMode === 'map' && radiusVisible && (
          <RadiusControl
            radius={searchRadius}
            onRadiusChange={handleRadiusChange}
            onApply={handleApplyRadius}
            products={mapMode === 'plants' ? nearbyProducts : nearbyBusinesses}
            isLoading={isLoading}
            error={error}
            onProductSelect={mapMode === 'plants' ? handleProductSelect : handleBusinessSelect}
            onToggleViewMode={toggleViewMode}
            dataType={mapMode}
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
  listContainer: {
    flex: 1,
    position: 'relative',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 18,
    color: '#4CAF50',
    fontWeight: '600',
  },
  subText: {
    marginTop: 8,
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  searchingOverlay: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(255,255,255,0.95)',
    padding: 16,
    alignItems: 'center',
    zIndex: 5,
    borderRadius: 8,
    margin: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  searchingText: {
    marginLeft: 12,
    fontSize: 16,
    color: '#4CAF50',
    fontWeight: '500',
  },
  errorOverlay: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(255,255,255,0.95)',
    padding: 16,
    alignItems: 'center',
    zIndex: 5,
    borderRadius: 8,
    margin: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  errorText: {
    color: '#f44336',
    textAlign: 'center',
    padding: 12,
    fontSize: 16,
    marginBottom: 8,
  },
  retryButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 6,
    elevation: 2,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  currentLocationButton: {
    position: 'absolute',
    right: 16,
    bottom: Platform.OS === 'ios' ? 450 : 420,
    backgroundColor: '#4CAF50',
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    zIndex: 50, // Set appropriate z-index
  },
  disabledButton: {
    opacity: 0.7,
  },
  viewToggleButton: {
    position: 'absolute',
    right: 80,
    bottom: Platform.OS === 'ios' ? 450 : 420,
    backgroundColor: '#2196F3',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 25,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    zIndex: 50, // Set appropriate z-index
  },
  viewToggleText: {
    color: '#fff',
    fontWeight: '600',
    marginLeft: 6,
  },
  backToMapButton: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    backgroundColor: '#4CAF50',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 25,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    zIndex: 50, // Set appropriate z-index
  },
  backToMapText: {
    color: '#fff',
    fontWeight: '600',
    marginLeft: 8,
  },
  detailCardContainer: {
    position: 'absolute',
    bottom: 400,
    left: 16,
    right: 16,
    zIndex: 500, // High z-index for detail cards
  },
});

export default MapScreen;