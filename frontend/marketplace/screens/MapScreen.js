// screens/MapScreen.js
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, StyleSheet, ActivityIndicator, Text, SafeAreaView, TouchableOpacity,
  Alert, Platform, BackHandler, Linking, useWindowDimensions,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRoute, useNavigation, useFocusEffect } from '@react-navigation/native';
import * as Location from 'expo-location';

import MarketplaceHeader from '../components/MarketplaceHeader';
import CrossPlatformWebMap from '../components/CrossPlatformWebMap';
import MapSearchBox from '../components/MapSearchBox';
import RadiusControl from '../components/RadiusControl';
import ProductListView from '../components/ProductListView';
import BusinessListView from '../components/BusinessListView';
import PlantDetailMiniCard from '../components/PlantDetailMiniCard';
import BusinessDetailMiniCard from '../components/BusinessDetailMiniCard';
import MapModeToggle from '../components/MapModeToggle';
import { getNearbyProducts } from '../services/marketplaceApi';
import { getNearbyBusinesses } from '../../Business/services/businessApi';
import { getMapTilerKey, reverseGeocode } from '../services/maptilerService';

const TLV = { latitude: 32.0853, longitude: 34.7818, city: 'Tel Aviv', formattedAddress: 'Tel Aviv, Israel' };
// Emulator default mock location (Googleplex)
const looksLikeEmulatorMock = (lat, lng) =>
  Math.abs(lat - 37.4220936) < 0.02 && Math.abs(lng + 122.083922) < 0.02;

const MapScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { height } = useWindowDimensions();
  const { products = [], initialLocation } = route.params || {};

  const FLOATING_BOTTOM = Math.max(24, Math.round(height * 0.16));
  const CARD_POPUP_BOTTOM = Math.max(200, Math.round(height * 0.22));

  const [mapMode, setMapMode] = useState('plants');
  const [mapProducts, setMapProducts] = useState(products);
  const [mapBusinesses, setMapBusinesses] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // ✅ start on TLV to avoid the emulator's Mountain View flash
  const [selectedLocation, setSelectedLocation] = useState(initialLocation || TLV);

  const [searchRadius, setSearchRadius] = useState(10);
  const [nearbyProducts, setNearbyProducts] = useState([]);
  const [nearbyBusinesses, setNearbyBusinesses] = useState([]);
  const [sortOrder, setSortOrder] = useState('nearest');
  const [viewMode, setViewMode] = useState('map');
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

  const mapRef = useRef(null);

  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        if (viewMode === 'list') {
          setViewMode('map');
          return true;
        }
        return false;
      };
      const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => sub.remove();
    }, [viewMode])
  );

  // Use products / initialLocation on focus
  useFocusEffect(
    useCallback(() => {
      if (products.length > 0) {
        const withCoords = products.filter(p => p?.location?.latitude && p?.location?.longitude);
        setMapProducts(withCoords);
        setCounts(prev => ({ ...prev, plants: withCoords.length }));
        if (withCoords.length > 0 && !initialLocation && !selectedLocation) {
          const first = withCoords[0];
          setSelectedLocation({
            latitude: first.location.latitude,
            longitude: first.location.longitude,
            city: first.location?.city || first.city || 'Location',
          });
        }
      }
      if (initialLocation?.latitude && initialLocation?.longitude) {
        setSelectedLocation(initialLocation);
        if (products.length === 0) loadNearbyData(initialLocation, Number(searchRadius) || 10);
      }
    }, [products, initialLocation])
  );

  // Smoothly recenter when selection changes
  useEffect(() => {
    if (selectedLocation?.latitude && selectedLocation?.longitude) {
      mapRef.current?.flyTo?.(selectedLocation.latitude, selectedLocation.longitude, 12);
    }
  }, [selectedLocation]);

  // Location initialization with emulator guard
  useEffect(() => {
    const initLocation = async () => {
      // 1) If screen was called with a location → use it.
      if (initialLocation?.latitude && initialLocation?.longitude) {
        setSelectedLocation(initialLocation);
        if (products.length === 0) loadNearbyData(initialLocation, Number(searchRadius) || 10);
        return;
      }

      try {
        let { status } = await Location.getForegroundPermissionsAsync();
        if (status !== 'granted') {
          const req = await Location.requestForegroundPermissionsAsync();
          status = req.status;
        }

        if (status === 'granted') {
          setLocationPermissionGranted(true);
          try {
            const location = await Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.Balanced,
              maximumAge: 30000,
              timeout: 15000,
            });

            let { latitude, longitude } = location.coords;

            // Emulator default → fall back to TLV
            if (looksLikeEmulatorMock(latitude, longitude)) {
              latitude = TLV.latitude;
              longitude = TLV.longitude;
            }

            setMyLocation({ latitude, longitude });
            setShowMyLocation(true);

            if (!selectedLocation) {
              try {
                const addr = await reverseGeocode(latitude, longitude);
                const locationData = {
                  latitude, longitude,
                  formattedAddress: addr.formattedAddress,
                  city: addr.city || 'Current Location',
                };
                setSelectedLocation(locationData);
                loadNearbyData(locationData, Number(searchRadius) || 10);
              } catch {
                const fallbackData = {
                  latitude, longitude,
                  formattedAddress: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
                  city: 'Current Location',
                };
                setSelectedLocation(fallbackData);
                loadNearbyData(fallbackData, Number(searchRadius) || 10);
              }
            }
          } catch {
            setLocationPermissionGranted(false);
            if (!selectedLocation && !initialLocation) {
              setSelectedLocation(TLV);
              loadNearbyData(TLV, Number(searchRadius) || 10);
            }
          }
        } else {
          setLocationPermissionGranted(false);
          if (!selectedLocation && !initialLocation) {
            setSelectedLocation(TLV);
            loadNearbyData(TLV, Number(searchRadius) || 10);
          }
        }
      } catch {
        setLocationPermissionGranted(false);
      }
    };

    initLocation();
  }, []); // once

  const handleLocationSelect = (loc) => {
    setSelectedLocation(loc);
    if (loc?.latitude && loc?.longitude) {
      setRadiusVisible(true);
      loadNearbyData(loc, Number(searchRadius) || 10);
    }
  };

  const handleRadiusChange = (r) => {
    const n = Number(r);
    setSearchRadius(Number.isFinite(n) ? n : 10);
  };
  const handleApplyRadius = (r) => {
    const n = Number(r);
    const safe = Number.isFinite(n) ? n : 10;
    if (selectedLocation?.latitude && selectedLocation?.longitude) {
      loadNearbyData(selectedLocation, safe);
    }
  };

  const handleMapModeChange = (mode) => {
    setMapMode(mode);
    setShowDetailCard(false);
    setSelectedProduct(null);
    setSelectedBusiness(null);
    setSelectedProductData(null);
    setSelectedBusinessData(null);
  };

  const loadNearbyData = async (loc, radius) => {
    if (!loc?.latitude || !loc?.longitude) return;
    const radNum = Number(radius);
    const radiusKm = Number.isFinite(radNum) ? radNum : 10;

    try {
      setIsLoading(true);
      setError(null);
      setSearchingLocation(true);
      setShowDetailCard(false);
      setRadiusVisible(true);

      if (mapMode === 'plants') {
        await loadNearbyProducts(loc, radiusKm);
      } else {
        await loadNearbyBusinesses(loc, radiusKm);
      }
    } catch {
      setError('Failed to load nearby data. Please try again.');
    } finally {
      setIsLoading(false);
      setSearchingLocation(false);
    }
  };

  const loadNearbyProducts = async (loc, radius) => {
    const res = await getNearbyProducts(loc.latitude, loc.longitude, radius);
    if (res?.products) {
      const items = res.products
        .filter(p => p?.location?.latitude && p?.location?.longitude)
        .map(p => ({ ...p, distance: p.distance || 0 }));
      const sorted = sortProductsByDistance(items, sortOrder === 'nearest');
      setMapProducts(sorted);
      setNearbyProducts(sorted);
      setCounts(prev => ({ ...prev, plants: sorted.length }));
    } else {
      setMapProducts([]); setNearbyProducts([]);
      setCounts(prev => ({ ...prev, plants: 0 }));
    }
  };

  const loadNearbyBusinesses = async (loc, radius) => {
    const res = await getNearbyBusinesses(loc.latitude, loc.longitude, radius);
    if (res?.businesses) {
      const items = res.businesses
        .filter(b => (b?.location?.latitude && b?.location?.longitude) || (b?.address?.latitude && b?.address?.longitude))
        .map(b => ({
          ...b,
          distance: b.distance || 0,
          location: b.location || {
            latitude: b.address?.latitude,
            longitude: b.address?.longitude,
            city: b.address?.city || 'Unknown location',
          },
        }));
      const sorted = sortBusinessesByDistance(items, sortOrder === 'nearest');
      setMapBusinesses(sorted);
      setNearbyBusinesses(sorted);
      setCounts(prev => ({ ...prev, businesses: sorted.length }));
    } else {
      setMapBusinesses([]); setNearbyBusinesses([]);
      setCounts(prev => ({ ...prev, businesses: 0 }));
    }
  };

  const handleProductSelect = (id) => {
    const p = mapProducts.find(x => x.id === id || x._id === id);
    if (p) {
      setSelectedProduct(p);
      setSelectedProductData(p);
      setSelectedBusiness(null);
      setSelectedBusinessData(null);
      setShowDetailCard(true);
    }
  };

  const handleBusinessSelect = (id) => {
    const b = mapBusinesses.find(x => x.id === id);
    if (b) {
      setSelectedBusiness(b);
      setSelectedBusinessData(b);
      setSelectedProduct(null);
      setSelectedProductData(null);
      setShowDetailCard(true);
    }
  };

  const handleViewProductDetails = () => {
    if (selectedProductData) {
      navigation.navigate('PlantDetail', { plantId: selectedProductData.id || selectedProductData._id });
    }
  };
  const handleViewBusinessDetails = () => {
    if (selectedBusinessData) {
      navigation.navigate('BusinessSellerProfile', { sellerId: selectedBusinessData.id, businessId: selectedBusinessData.id });
    }
  };

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
    const url =
      Platform.OS === 'ios'
        ? `maps://app?daddr=${lat},${lng}&ll=${lat},${lng}&q=${encodedLabel}`
        : `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&destination_place_id=${encodedLabel}`;
    Linking.openURL(url).catch(() => {
      Alert.alert('Error', 'Could not open maps application');
    });
  };

  const handleGetCurrentLocation = async () => {
    if (isGettingLocation) return;
    try {
      setIsGettingLocation(true);
      setIsLoading(true);
      setSearchingLocation(true);
      setShowDetailCard(false);
      setRadiusVisible(true);

      if (!locationPermissionGranted) {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Required', 'Location permission is required to show your position.');
          return;
        }
        setLocationPermissionGranted(true);
      }

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
        maximumAge: 10000,
        timeout: 15000,
      });
      let { latitude, longitude } = loc.coords;
      if (looksLikeEmulatorMock(latitude, longitude)) {
        latitude = TLV.latitude; longitude = TLV.longitude;
      }

      setMyLocation({ latitude, longitude });
      setShowMyLocation(true);

      try {
        const addr = await reverseGeocode(latitude, longitude);
        const data = {
          latitude, longitude,
          formattedAddress: addr.formattedAddress,
          city: addr.city || 'Current Location',
        };
        setSelectedLocation(data);
        loadNearbyData(data, Number(searchRadius) || 10);
      } catch {
        const data = {
          latitude, longitude,
          formattedAddress: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
          city: 'Current Location',
        };
        setSelectedLocation(data);
        loadNearbyData(data, Number(searchRadius) || 10);
      }
    } catch {
      Alert.alert('Location Error', 'Could not get your current location. Please try again.');
    } finally {
      setIsGettingLocation(false);
      setIsLoading(false);
      setSearchingLocation(false);
    }
  };

  const toggleSortOrder = () => {
    const next = sortOrder === 'nearest' ? 'farthest' : 'nearest';
    setSortOrder(next);
    if (mapMode === 'plants') {
      const sorted = sortProductsByDistance(nearbyProducts, next === 'nearest');
      setMapProducts(sorted);
      setNearbyProducts(sorted);
    } else {
      const sorted = sortBusinessesByDistance(nearbyBusinesses, next === 'nearest');
      setMapBusinesses(sorted);
      setNearbyBusinesses(sorted);
    }
  };

  const toggleViewMode = () => {
    if (showDetailCard) setShowDetailCard(false);
    setViewMode(viewMode === 'map' ? 'list' : 'map');
  };

  const sortProductsByDistance = (list, asc = true) =>
    [...list].sort((a, b) => (asc ? 1 : -1) * ((a.distance || 0) - (b.distance || 0)));

  const sortBusinessesByDistance = (list, asc = true) =>
    [...list].sort((a, b) => (asc ? 1 : -1) * ((a.distance || 0) - (b.distance || 0)));

  const handleMapPress = (coords) => {
    if (showDetailCard) { setShowDetailCard(false); return; }
    if (coords?.latitude && coords?.longitude) {
      setSelectedLocation({
        latitude: coords.latitude,
        longitude: coords.longitude,
        formattedAddress: `${coords.latitude.toFixed(6)}, ${coords.longitude.toFixed(6)}`,
        city: 'Selected Location',
      });
      setRadiusVisible(true);
      loadNearbyData(coords, Number(searchRadius) || 10);
    }
  };

  const handleRetry = () => {
    if (selectedLocation?.latitude && selectedLocation?.longitude) {
      loadNearbyData(selectedLocation, Number(searchRadius) || 10);
    } else {
      handleGetCurrentLocation();
    }
  };

  const headerTitle =
    viewMode === 'list'
      ? `${mapMode === 'plants' ? 'Plants' : 'Businesses'} near ${selectedLocation?.city || 'you'}`
      : selectedLocation?.city
        ? `${mapMode === 'plants' ? 'Plants' : 'Businesses'} near ${selectedLocation.city}`
        : 'Map View';

  const currentMapData = mapMode === 'plants' ? mapProducts : mapBusinesses;
  const maptilerKey = getMapTilerKey();

  return (
    <SafeAreaView style={styles.container}>
      <MarketplaceHeader
        title={headerTitle}
        showBackButton
        onBackPress={() => {
          if (viewMode === 'list') setViewMode('map');
          else navigation.goBack();
        }}
        onNotificationsPress={() => navigation.navigate('Messages')}
      />

      <View style={styles.mapContainer}>
        <MapModeToggle mapMode={mapMode} onMapModeChange={setMapMode} counts={counts} />

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
                <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
                  <Text style={styles.retryButtonText}>Retry</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            <CrossPlatformWebMap
              key={`${mapMode}:${selectedLocation?.latitude || myLocation?.latitude}:${selectedLocation?.longitude || myLocation?.longitude}:${searchRadius}`}
              ref={mapRef}
              products={mapMode === 'plants' ? mapProducts : []}
              businesses={mapMode === 'businesses' ? mapBusinesses : []}
              mapMode={mapMode}
              onSelectProduct={handleProductSelect}
              onSelectBusiness={handleBusinessSelect}
              initialRegion={
                selectedLocation
                  ? { latitude: selectedLocation.latitude, longitude: selectedLocation.longitude, zoom: 12 }
                  : myLocation
                    ? { latitude: myLocation.latitude, longitude: myLocation.longitude, zoom: 12 }
                    : { latitude: TLV.latitude, longitude: TLV.longitude, zoom: 10 }
              }
              searchRadius={searchRadius}
              onMapPress={handleMapPress}
              maptilerKey={maptilerKey}
            />

            {showDetailCard && selectedProductData && mapMode === 'plants' && (
              <View style={[styles.detailCardContainer, { bottom: CARD_POPUP_BOTTOM }]}>
                <PlantDetailMiniCard
                  plant={selectedProductData}
                  onClose={() => setShowDetailCard(false)}
                  onViewDetails={handleViewProductDetails}
                />
              </View>
            )}

            {showDetailCard && selectedBusinessData && mapMode === 'businesses' && (
              <View style={[styles.detailCardContainer, { bottom: CARD_POPUP_BOTTOM }]}>
                <BusinessDetailMiniCard
                  business={selectedBusinessData}
                  onClose={() => setShowDetailCard(false)}
                  onViewDetails={handleViewBusinessDetails}
                  onGetDirections={handleGetDirections}
                />
              </View>
            )}
          </>
        )}

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
                onBusinessSelect={(businessId) =>
                  navigation.navigate('BusinessSellerProfile', { sellerId: businessId, businessId })
                }
                sortOrder={sortOrder}
                onSortChange={toggleSortOrder}
              />
            )}

            <TouchableOpacity style={styles.backToMapButton} onPress={toggleViewMode}>
              <MaterialIcons name="map" size={24} color="#fff" />
              <Text style={styles.backToMapText}>Map View</Text>
            </TouchableOpacity>
          </View>
        )}

        <MapSearchBox onLocationSelect={handleLocationSelect} maptilerKey={maptilerKey} />

        <TouchableOpacity
          style={[
            styles.currentLocationButton,
            isGettingLocation && styles.disabledButton,
            { bottom: FLOATING_BOTTOM },
          ]}
          onPress={handleGetCurrentLocation}
          disabled={isGettingLocation}
        >
          {isGettingLocation ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <MaterialIcons name="my-location" size={24} color={showMyLocation ? '#C8E6C9' : '#fff'} />
          )}
        </TouchableOpacity>

        {viewMode === 'map' && currentMapData.length > 0 && (
          <TouchableOpacity
            style={[styles.viewToggleButton, { bottom: FLOATING_BOTTOM }]}
            onPress={() => setViewMode('list')}
          >
            <MaterialIcons name="view-list" size={22} color="#fff" />
            <Text style={styles.viewToggleText}>List</Text>
          </TouchableOpacity>
        )}

        {selectedLocation && viewMode === 'map' && radiusVisible && (
          <RadiusControl
            radius={searchRadius}
            onRadiusChange={handleRadiusChange}
            onApply={handleApplyRadius}
            products={mapMode === 'plants' ? nearbyProducts : nearbyBusinesses}
            isLoading={isLoading}
            error={error}
            onProductSelect={mapMode === 'plants' ? handleProductSelect : handleBusinessSelect}
            onViewModeChange={() => setViewMode('list')}
            dataType={mapMode}
          />
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7FAF7' },
  mapContainer: { flex: 1, position: 'relative' },
  listContainer: { flex: 1, position: 'relative' },

  searchingOverlay: {
    position: 'absolute', top: 64, left: 16, right: 16, backgroundColor: 'rgba(255,255,255,0.98)',
    paddingVertical: 14, paddingHorizontal: 16, alignItems: 'center', zIndex: 5, borderRadius: 14,
    flexDirection: 'row', justifyContent: 'center', elevation: 6, shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 8,
  },
  searchingText: { marginLeft: 10, fontSize: 16, color: '#2E7D32', fontWeight: '600' },

  errorOverlay: {
    position: 'absolute', top: 64, left: 16, right: 16, backgroundColor: '#fff',
    paddingVertical: 16, paddingHorizontal: 16, alignItems: 'center', zIndex: 5, borderRadius: 14,
    elevation: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 8,
  },
  errorText: { color: '#d32f2f', textAlign: 'center', padding: 8, fontSize: 15, marginBottom: 8 },
  retryButton: { backgroundColor: '#4CAF50', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 999, elevation: 2 },
  retryButtonText: { color: '#fff', fontWeight: '700', fontSize: 15, letterSpacing: 0.2 },

  currentLocationButton: {
    position: 'absolute', right: 16, backgroundColor: '#2E7D32', width: 56, height: 56, borderRadius: 28,
    justifyContent: 'center', alignItems: 'center', elevation: 8, shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.25, shadowRadius: 6, zIndex: 50,
  },
  disabledButton: { opacity: 0.7 },

  viewToggleButton: {
    position: 'absolute', right: 84, backgroundColor: '#1976D2', paddingHorizontal: 16, paddingVertical: 12,
    borderRadius: 26, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    elevation: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.18, shadowRadius: 6, zIndex: 50,
  },
  viewToggleText: { color: '#fff', fontWeight: '700', marginLeft: 6, fontSize: 14 },

  backToMapButton: {
    position: 'absolute', right: 16, bottom: 16, backgroundColor: '#2E7D32', flexDirection: 'row',
    alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 26,
    elevation: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.18, shadowRadius: 6, zIndex: 50,
  },
  backToMapText: { color: '#fff', fontWeight: '700', marginLeft: 8 },

  detailCardContainer: { position: 'absolute', left: 16, right: 16, zIndex: 500 },
});

export default MapScreen;
