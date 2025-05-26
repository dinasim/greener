// screens/MapScreen.js (Enhanced Version)
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
import { getNearbyProducts, getAzureMapsKey, reverseGeocode } from '../services/marketplaceApi';
import { getNearbyBusinesses } from '../services/businessApi';

/**
 * Enhanced MapScreen with Plants/Businesses toggle
 */
const MapScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { products = [], initialLocation } = route.params || {};

  // State variables
  const [mapMode, setMapMode] = useState('plants'); // 'plants' or 'businesses'
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
  const [viewMode, setViewMode] = useState('map'); // 'map' or 'list'
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

      BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => BackHandler.removeEventListener('hardwareBackPress', onBackPress);
    }, [viewMode])
  );

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
        setCounts(prev => ({ ...prev, plants: products.length }));
        
        if (products.length > 0 && !selectedLocation) {
          const locationsWithCoords = products.filter(
            p => p.location?.latitude && p.location?.longitude
          );
          
          if (locationsWithCoords.length > 0) {
            setSelectedLocation({
              latitude: locationsWithCoords[0].location.latitude,
              longitude: locationsWithCoords[0].location.longitude,
              city: locationsWithCoords[0].location?.city || locationsWithCoords[0].city || 'Unknown location'
            });
          }
        }
      }
      
      if (initialLocation?.latitude && initialLocation?.longitude) {
        setSelectedLocation(initialLocation);
        if (products.length === 0) {
          loadNearbyData(initialLocation, searchRadius);
        }
      }
    }, [products, initialLocation])
  );

  // Handle location selection
  const handleLocationSelect = (location) => {
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
    if (!location?.latitude || !location?.longitude) return;

    try {
      setIsLoading(true);
      setError(null);
      setSearchingLocation(true);
      setShowDetailCard(false);
      setRadiusVisible(true);

      if (mapMode === 'plants') {
        await loadNearbyProducts(location, radius);
      } else {
        await loadNearbyBusinesses(location, radius);
      }
    } catch (err) {
      console.error('Error loading nearby data:', err);
      setError('Failed to load data. Please try again.');
    } finally {
      setIsLoading(false);
      setSearchingLocation(false);
    }
  };

  // Load nearby products
  const loadNearbyProducts = async (location, radius) => {
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
      
      const sortedProducts = sortProductsByDistance(products, sortOrder === 'nearest');
      
      setMapProducts(sortedProducts);
      setNearbyProducts(sortedProducts);
      setCounts(prev => ({ ...prev, plants: sortedProducts.length }));
      setShowResults(true);
    } else {
      setMapProducts([]);
      setNearbyProducts([]);
      setCounts(prev => ({ ...prev, plants: 0 }));
      setShowResults(true);
    }
  };

  // Load nearby businesses
  const loadNearbyBusinesses = async (location, radius) => {
    const result = await getNearbyBusinesses(
      location.latitude,
      location.longitude,
      radius
    );

    if (result && result.businesses) {
      const businesses = result.businesses.map(business => ({
        ...business,
        distance: business.distance || 0
      }));
      
      const sortedBusinesses = sortBusinessesByDistance(businesses, sortOrder === 'nearest');
      
      setMapBusinesses(sortedBusinesses);
      setNearbyBusinesses(sortedBusinesses);
      setCounts(prev => ({ ...prev, businesses: sortedBusinesses.length }));
      setShowResults(true);
    } else {
      setMapBusinesses([]);
      setNearbyBusinesses([]);
      setCounts(prev => ({ ...prev, businesses: 0 }));
      setShowResults(true);
    }
  };

  // Handle product selection from map
  const handleProductSelect = (productId) => {
    const product = mapProducts.find(p => p.id === productId || p._id === productId);
    
    if (product) {
      console.log("Product selected:", product.title || product.name);
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
      console.log("Business selected:", business.businessName || business.name);
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
      lat = selectedBusinessData.location?.latitude;
      lng = selectedBusinessData.location?.longitude;
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
      console.error('Error opening maps app:', err);
      Alert.alert('Error', 'Could not open maps application');
    });
  };

  // Get current location
  const handleGetCurrentLocation = async () => {
    try {
      setIsLoading(true);
      setSearchingLocation(true);
      setShowDetailCard(false);
      setRadiusVisible(true);

      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required to use this feature.');
        setIsLoading(false);
        setSearchingLocation(false);
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Highest,
        maximumAge: 10000,
        timeout: 15000
      });

      const { latitude, longitude } = location.coords;
      setMyLocation({ latitude, longitude });
      setShowMyLocation(true);

      try {
        const addressData = await reverseGeocode(latitude, longitude);
        const locationData = {
          latitude,
          longitude,
          formattedAddress: addressData.formattedAddress,
          city: addressData.city || 'Current Location',
        };

        setSelectedLocation(locationData);
        loadNearbyData(locationData, searchRadius);
      } catch (geocodeError) {
        console.error('Geocoding error:', geocodeError);
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
      console.error('Error getting current location:', err);
      Alert.alert('Location Error', 'Could not get your current location. Please try again later.');
    } finally {
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
          <Text style={styles.loadingText}>Loading map configuration...</Text>
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
                  : undefined
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
    bottom: Platform.OS === 'ios' ? 450 : 420,
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
    zIndex: 20,
  },
});

export default MapScreen;