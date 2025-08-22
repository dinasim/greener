// screens/MapScreen.js
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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

// ⬇️ add getAll
import { getNearbyProducts, geocodeAddress, getAll } from '../services/marketplaceApi';
import { getNearbyBusinesses } from '../../Business/services/businessApi';
import { getMapTilerKey, reverseGeocode } from '../services/maptilerService';

const TLV = { latitude: 32.0853, longitude: 34.7818, city: 'Tel Aviv', formattedAddress: 'Tel Aviv, Israel' };
const looksLikeEmulatorMock = (lat, lng) =>
  Math.abs(lat - 37.4220936) < 0.02 && Math.abs(lng + 122.083922) < 0.02;

/* ---------- helpers ---------- */
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : undefined; };
const fromArr = (arr) => Array.isArray(arr) && arr.length >= 2 ? { lon: num(arr[0]), lat: num(arr[1]) } : {};

const normalizeCoords = (p = {}) => {
  const L = p.location || p.loc || p.address || p.geo || (p.business && (p.business.location || p.business.address)) || {};
  const candidates = [
    { lat: num(L.latitude), lon: num(L.longitude) },
    { lat: num(L.lat),      lon: num(L.lng ?? L.lon) },
    { lat: num(p.latitude), lon: num(p.longitude) },
    { lat: num(p.lat),      lon: num(p.lng ?? p.lon) },
    fromArr(L.coordinates),
    fromArr(p.coordinates),
    fromArr(p.geo?.coordinates),
  ];
  for (const c of candidates) {
    if (Number.isFinite(c.lat) && Number.isFinite(c.lon)) {
      p.location = { ...(p.location || {}), latitude: c.lat, longitude: c.lon };
      p.loc = { ...(p.loc || {}), latitude: c.lat, longitude: c.lon };
      break;
    }
  }
  return p;
};

const readCoords = (p = {}) => {
  const pick = (...vals) => { for (const v of vals) { const n = Number(v); if (Number.isFinite(n)) return n; } };
  const lat = pick(
    p?.location?.latitude, p?.loc?.latitude, p?.latitude, p?.lat,
    Array.isArray(p?.coordinates) ? p.coordinates[1] : undefined,
    Array.isArray(p?.geo?.coordinates) ? p.geo.coordinates[1] : undefined
  );
  const lon = pick(
    p?.location?.longitude, p?.loc?.longitude, p?.longitude, p?.lng, p?.lon,
    Array.isArray(p?.coordinates) ? p.coordinates[0] : undefined,
    Array.isArray(p?.geo?.coordinates) ? p.geo.coordinates[0] : undefined
  );
  return { lat, lon };
};

const hasCoords = (p) => {
  const { lat, lon } = readCoords(p);
  return Number.isFinite(lat) && Number.isFinite(lon);
};

const addressToString = (addr) => {
  if (!addr) return '';
  if (typeof addr === 'string') return addr;
  const parts = [
    addr.fullAddress, addr.formattedAddress, addr.street || addr.street1, addr.number,
    addr.neighborhood, addr.city || addr.town, addr.state || addr.region,
    addr.postalCode || addr.zipcode, addr.country,
  ].filter(Boolean);
  return parts.join(', ').replace(/\s+/g, ' ').trim();
};

const pickAnyAddressString = (obj = {}) =>
  obj.formattedAddress ||
  addressToString(obj.address) ||
  addressToString(obj.location) ||
  addressToString(obj.business?.address) ||
  [obj.title || obj.name, obj.city, obj.country].filter(Boolean).join(', ');

const haversineKm = (lat1, lon1, lat2, lon2) => {
  const R = 6371, toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
};

// 🔖 normalize seller flags once so the map/list can rely on them
const normalizeSellerFlags = (p = {}) => {
  const seller = p.seller || {};
  const isBiz =
    Boolean(p.isBusinessListing) ||
    Boolean(p.businessId) ||
    Boolean(seller.isBusiness) ||
    (typeof p.sellerType === 'string' && p.sellerType.toLowerCase() === 'business') ||
    (typeof p.source === 'string' && p.source.toLowerCase().includes('business'));
  return {
    ...p,
    isBusinessListing: !!isBiz,
    sellerType: isBiz ? 'business' : 'individual',
    pinType: isBiz ? 'bizProduct' : 'indProduct', // for CrossPlatformWebMap marker styling
  };
};

const isBusinessProduct = (p) => !!normalizeSellerFlags(p).isBusinessListing;

/* ---------- component ---------- */
const MapScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { height } = useWindowDimensions();
  const { products = [], initialLocation } = route.params || {};

  const FLOATING_BOTTOM = Math.max(24, Math.round(height * 0.16));
  const CARD_POPUP_BOTTOM = Math.max(200, Math.round(height * 0.22));
const [refreshToken, setRefreshToken] = useState(0);
  const [mapMode, setMapMode] = useState('plants'); // 'plants' | 'businesses'
  const [mapProducts, setMapProducts] = useState(products);
  const [mapBusinesses, setMapBusinesses] = useState([]);
  const [nearbyProducts, setNearbyProducts] = useState([]);
  const [nearbyBusinesses, setNearbyBusinesses] = useState([]);
  const [sortOrder, setSortOrder] = useState('nearest');
  const [viewMode, setViewMode] = useState('map');
  const [searchRadius, setSearchRadius] = useState(10);
  const [selectedLocation, setSelectedLocation] = useState(initialLocation || TLV);
  const [myLocation, setMyLocation] = useState(null);
  const [showMyLocation, setShowMyLocation] = useState(false);
  const [showDetailCard, setShowDetailCard] = useState(false);
  const [selectedProductData, setSelectedProductData] = useState(null);
  const [selectedBusinessData, setSelectedBusinessData] = useState(null);
  const [radiusVisible, setRadiusVisible] = useState(true);
  const [locationPermissionGranted, setLocationPermissionGranted] = useState(false);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [searchingLocation, setSearchingLocation] = useState(false);
  const [error, setError] = useState(null);

  const mapRef = useRef(null);
  const geoCache = useRef(new Map()).current;

  // robust geocoder
  const geocodeOnce = async (addrStr) => {
    const key = (addrStr || '').toLowerCase().trim();
    if (!key) return null;
    if (geoCache.has(key)) return geoCache.get(key);
    try {
      const g = await geocodeAddress(addrStr);
      let lat, lon;
      if (g && typeof g === 'object') {
        if (Number.isFinite(g.lat) && Number.isFinite(g.lng)) { lat = +g.lat; lon = +g.lng; }
        else if (Number.isFinite(g.lat) && Number.isFinite(g.lon)) { lat = +g.lat; lon = +g.lon; }
        else if (Number.isFinite(g.latitude) && Number.isFinite(g.longitude)) { lat = +g.latitude; lon = +g.longitude; }
        else if (Array.isArray(g.center) && g.center.length >= 2) { lon = +g.center[0]; lat = +g.center[1]; }
        else if (Array.isArray(g.geometry?.coordinates) && g.geometry.coordinates.length >= 2) { lon = +g.geometry.coordinates[0]; lat = +g.geometry.coordinates[1]; }
        else if (Number.isFinite(g.x) && Number.isFinite(g.y)) { lon = +g.x; lat = +g.y; }
      }
      if ((!Number.isFinite(lat) || !Number.isFinite(lon)) && Array.isArray(g) && g.length >= 2) {
        lon = +g[0]; lat = +g[1];
      }
      const result = (Number.isFinite(lat) && Number.isFinite(lon)) ? { lat, lon } : null;
      if (result) geoCache.set(key, result);
      return result;
    } catch {
      return null;
    }
  };

  const ensureProductCoords = async (p) => {
    const prod = normalizeCoords({ ...p });
    if (hasCoords(prod)) return prod;
    const addr = pickAnyAddressString(prod);
    if (!addr) return prod;
    const geo = await geocodeOnce(addr);
    if (geo) {
      prod.location = { ...(prod.location || {}), latitude: geo.lat, longitude: geo.lon };
      prod.loc = { ...(prod.loc || {}), latitude: geo.lat, longitude: geo.lon };
    }
    return prod;
  };

  const ensureBusinessCoords = async (b) => {
    const biz = normalizeCoords({ ...b });
    if (hasCoords(biz)) return biz;
    const dLat = b?.address?.latitude ?? b?.address?.lat;
    const dLon = b?.address?.longitude ?? b?.address?.lng ?? b?.address?.lon;
    if (Number.isFinite(+dLat) && Number.isFinite(+dLon)) {
      biz.location = { ...(biz.location || {}), latitude: +dLat, longitude: +dLon, city: b?.address?.city || biz.location?.city };
      biz.loc = { ...(biz.loc || {}), latitude: +dLat, longitude: +dLon };
      return biz;
    }
    const addr = pickAnyAddressString(biz);
    if (!addr) return biz;
    const geo = await geocodeOnce(addr);
    if (geo) {
      biz.location = { ...(biz.location || {}), latitude: geo.lat, longitude: geo.lon };
      biz.loc = { ...(biz.loc || {}), latitude: geo.lat, longitude: geo.lon };
    }
    return biz;
  };

  /* back button: list -> map */
  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        if (viewMode === 'list') { setViewMode('map'); return true; }
        return false;
      };
      const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => sub.remove();
    }, [viewMode])
  );

  /* seed from route products / initialLocation */
  useFocusEffect(
    useCallback(() => {
      if (products.length > 0) {
        const normalized = products.map(normalizeCoords).map(normalizeSellerFlags);
        setMapProducts(normalized);
        setNearbyProducts(normalized);
      }
      if (initialLocation?.latitude && initialLocation?.longitude) {
        setSelectedLocation(initialLocation);
        if (products.length === 0) loadNearbyData(initialLocation, Number(searchRadius) || 10);
      }
    }, [products, initialLocation])
  );

  /* recenter when selection changes */
  useEffect(() => {
    if (selectedLocation?.latitude && selectedLocation?.longitude) {
      mapRef.current?.flyTo?.(selectedLocation.latitude, selectedLocation.longitude, 12);
    }
  }, [selectedLocation]);

  /* refresh pins when returning from list */
  useEffect(() => {
    if (viewMode === 'map') {
      const id = setTimeout(() => mapRef.current?.forceRefresh?.(), 0);
      return () => clearTimeout(id);
    }
  }, [viewMode]);

  /* init location */
  useEffect(() => {
    const initLocation = async () => {
      if (initialLocation?.latitude && initialLocation?.longitude) {
        setSelectedLocation(initialLocation);
        if (products.length === 0) loadNearbyData(initialLocation, Number(searchRadius) || 10);
        return;
      }
      try {
        let { status } = await Location.getForegroundPermissionsAsync();
        if (status !== 'granted') status = (await Location.requestForegroundPermissionsAsync()).status;
        if (status === 'granted') {
          try {
            const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced, maximumAge: 30000, timeout: 15000 });
            let { latitude, longitude } = location.coords;
            if (looksLikeEmulatorMock(latitude, longitude)) { latitude = TLV.latitude; longitude = TLV.longitude; }
            setMyLocation({ latitude, longitude });
            setShowMyLocation(true);

            if (!selectedLocation) {
              try {
                const addr = await reverseGeocode(latitude, longitude);
                const locData = { latitude, longitude, formattedAddress: addr.formattedAddress, city: addr.city || 'Current Location' };
                setSelectedLocation(locData);
                loadNearbyData(locData, Number(searchRadius) || 10);
              } catch {
                const locData = { latitude, longitude, formattedAddress: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`, city: 'Current Location' };
                setSelectedLocation(locData);
                loadNearbyData(locData, Number(searchRadius) || 10);
              }
            }
          } catch {
            if (!selectedLocation && !initialLocation) { setSelectedLocation(TLV); loadNearbyData(TLV, Number(searchRadius) || 10); }
          }
        } else {
          if (!selectedLocation && !initialLocation) { setSelectedLocation(TLV); loadNearbyData(TLV, Number(searchRadius) || 10); }
        }
      } catch {}
    };
    initLocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ensure we fetch once center exists */
  useEffect(() => {
    if (!selectedLocation?.latitude || !selectedLocation?.longitude) return;
    const r = Number(searchRadius) || 10;
    if (mapMode === 'plants' && mapProducts.length === 0) loadNearbyData(selectedLocation, r);
    if (mapMode === 'businesses' && mapBusinesses.length === 0) loadNearbyData(selectedLocation, r);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLocation]);

  /* reload when mode changes */
  useEffect(() => {
    if (selectedLocation?.latitude && selectedLocation?.longitude) {
      loadNearbyData(selectedLocation, Number(searchRadius) || 10);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapMode]);

  // 🔁 Refetch nearby data when the radius changes (debounced)
useEffect(() => {
  if (!selectedLocation?.latitude || !selectedLocation?.longitude) return;
  const r = Number(searchRadius) || 10;
  const id = setTimeout(() => {
    loadNearbyData(selectedLocation, r);
  }, 350); // debounce to avoid spamming while dragging
  return () => clearTimeout(id);
}, [
  searchRadius,
  mapMode,
  selectedLocation?.latitude,
  selectedLocation?.longitude,
]);

  const handleLocationSelect = (loc) => {
    setSelectedLocation(loc);
    if (loc?.latitude && loc?.longitude) {
      setRadiusVisible(true);
      loadNearbyData(loc, Number(searchRadius) || 10);
    }
  };

  const handleApplyRadius = (r) => {
  const safe = Number.isFinite(Number(r)) ? Number(r) : 10;
  setSearchRadius(safe); // the debounced effect will call loadNearbyData
};


  const sortProductsByDistance = (list, asc = true) =>
    [...list].sort((a, b) => (asc ? 1 : -1) * ((a.distance || 0) - (b.distance || 0)));
  const sortBusinessesByDistance = (list, asc = true) =>
    [...list].sort((a, b) => (asc ? 1 : -1) * ((a.distance || 0) - (b.distance || 0)));

  const loadNearbyData = async (loc, radius) => {
    if (!loc?.latitude || !loc?.longitude) return;
    const r = Number.isFinite(Number(radius)) ? Number(radius) : 10;
    try {
      setIsLoading(true); setError(null); setSearchingLocation(true); setShowDetailCard(false); setRadiusVisible(true);
      if (mapMode === 'plants') await loadNearbyProducts(loc, r);
      else await loadNearbyBusinesses(loc, r);
    } catch {
      setError('Failed to load nearby data. Please try again.');
    } finally {
      setIsLoading(false); setSearchingLocation(false);
    }
  };

  // ⬇️ pull ALL business inventory via the aggregator; merge with nearby individuals
  const fetchAllBusinessProducts = async () => {
    const first = await getAll(1, null, null, { sellerType: 'business' });
    let all = first?.products || [];
    const pages = Math.max(1, Number(first?.pages || 1));

    // fetch remaining pages (cap to avoid absurd loads)
    const MAX_PAGES = 20;
    for (let p = 2; p <= pages && p <= MAX_PAGES; p++) {
      const pg = await getAll(p, null, null, { sellerType: 'business' });
      all = all.concat(pg?.products || []);
    }
    return all;
  };

  // *** BUSINESS PRODUCTS ALWAYS IN LIST + MAP ***
  const loadNearbyProducts = async (loc, radius) => {
    const [nearbyRes, allBizRaw] = await Promise.all([
      getNearbyProducts(loc.latitude, loc.longitude, radius),
      fetchAllBusinessProducts(),
    ]);

    // nearby (mixed) -> normalize + coords + distance
    const nearbyRaw = Array.isArray(nearbyRes?.products) ? nearbyRes.products : [];
    let nearbyEnriched = nearbyRaw.map(normalizeCoords).map(normalizeSellerFlags);
    nearbyEnriched = await Promise.all(nearbyEnriched.map(ensureProductCoords));

    const withDistNearby = nearbyEnriched.map((p) => {
      const { lat, lon } = readCoords(p);
      const d = (Number.isFinite(lat) && Number.isFinite(lon))
        ? haversineKm(loc.latitude, loc.longitude, lat, lon)
        : num(p.distance);
      return { ...p, distance: Number.isFinite(d) ? d : Infinity };
    });

    // all business inventory (from aggregator) -> normalize + coords + distance + flags
    let allBiz = (allBizRaw || []).map(normalizeCoords).map(normalizeSellerFlags);
    allBiz = await Promise.all(allBiz.map(ensureProductCoords));
    const withDistBiz = allBiz.map((p) => {
      const { lat, lon } = readCoords(p);
      const d = (Number.isFinite(lat) && Number.isFinite(lon))
        ? haversineKm(loc.latitude, loc.longitude, lat, lon)
        : Infinity;
      return { ...p, distance: d, isBusinessListing: true, sellerType: 'business', pinType: 'bizProduct' };
    });
const makeKey = (p) => {
  // Prefer stable explicit ids
  const id = p.id || p._id;
  if (id) return `id:${id}`;

  // Otherwise build a composite fallback
  const { lat, lon } = readCoords(p);
  const owner = p.businessId || p.ownerEmail || p.seller?.email || '';
  const name = p.title || p.name || '';
  // Keep precision modest so tiny jitter doesn't create new keys
  const latF = Number.isFinite(lat) ? lat.toFixed(5) : 'na';
  const lonF = Number.isFinite(lon) ? lon.toFixed(5) : 'na';
  return `v2:${owner}|${name}|${latF},${lonF}`;
};

    // de-dup (prefer biz version if duplicate id)
    const byId = new Map();
    [...withDistNearby, ...withDistBiz].forEach((p) => {
       const key = makeKey(p);
      const existing = byId.get(key);
      if (!existing) byId.set(key, p);
      else if (p.isBusinessListing && !existing.isBusinessListing) byId.set(key, p);
    });
    const union = Array.from(byId.values());

    // LIST RULE: include ALL business + any individual within radius
    const listItems =  myLocation
     ? union.filter((p) => p.isBusinessListing || p.distance <= Number(radius))
     : union; // if no user location, don't filter the list either

    // MAP RULE: show ALL (business + individuals)
    const sortedList = sortProductsByDistance(listItems, sortOrder === 'nearest');

    setNearbyProducts(sortedList);
    setMapProducts(union);
    setTimeout(() => mapRef.current?.forceRefresh?.(), 0);
  };

  const loadNearbyBusinesses = async (loc, radius) => {
    const res = await getNearbyBusinesses(loc.latitude, loc.longitude, radius);
    if (res?.businesses?.length) {
      let enriched = await Promise.all(res.businesses.map(ensureBusinessCoords));
      enriched = enriched.filter(hasCoords);
      const withDist = enriched.map((b) => {
        const { lat, lon } = readCoords(b);
        const d = (Number.isFinite(lat) && Number.isFinite(lon))
          ? haversineKm(loc.latitude, loc.longitude, lat, lon)
          : Infinity;
        return { ...b, distance: d };
      });
      const within = withDist.filter((b) => b.distance <= Number(radius));
      const sorted = sortBusinessesByDistance(within, sortOrder === 'nearest');

      setMapBusinesses(withDist);
      setNearbyBusinesses(sorted);
    } else {
      setMapBusinesses([]); setNearbyBusinesses([]);
    }
  };

  const handleProductSelect = (id) => {
    const p = nearbyProducts.find((x) => (x.id || x._id) === id) || mapProducts.find((x) => (x.id || x._id) === id);
    if (p) { setSelectedProductData(p); setSelectedBusinessData(null); setShowDetailCard(true); }
  };

  const handleBusinessSelect = (id) => {
    const b = nearbyBusinesses.find((x) => x.id === id) || mapBusinesses.find((x) => x.id === id);
    if (b) { setSelectedBusinessData(b); setSelectedProductData(null); setShowDetailCard(true); }
  };

  const handleViewProductDetails = () => {
    if (selectedProductData) {
      navigation.navigate('PlantDetail', {
        plantId: selectedProductData.id || selectedProductData._id,
        businessId: selectedProductData.businessId || selectedProductData.ownerEmail,
        type: (selectedProductData.businessId || selectedProductData.ownerEmail) ? 'business' : 'global',
      });
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
      const c = readCoords(selectedProductData); lat = c.lat; lng = c.lon;
      label = selectedProductData.title || selectedProductData.name;
    } else if (mapMode === 'businesses' && selectedBusinessData) {
      const c = readCoords(selectedBusinessData); lat = c.lat; lng = c.lon;
      label = selectedBusinessData.businessName || selectedBusinessData.name;
    }
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) { Alert.alert('Error', 'Location coordinates not available'); return; }
    const encodedLabel = encodeURIComponent(label || 'Destination');
    const url =
      Platform.OS === 'ios'
        ? `maps://app?daddr=${lat},${lng}&ll=${lat},${lng}&q=${encodedLabel}`
        : `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&destination_place_id=${encodedLabel}`;
    Linking.openURL(url).catch(() => Alert.alert('Error', 'Could not open maps application'));
  };

  const handleGetCurrentLocation = async () => {
    if (isGettingLocation) return;
    try {
      setIsGettingLocation(true); setIsLoading(true); setSearchingLocation(true);
      setShowDetailCard(false); setRadiusVisible(true);

      if (!locationPermissionGranted) {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') { Alert.alert('Permission Required', 'Location permission is required to show your position.'); return; }
      }

      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High, maximumAge: 10000, timeout: 15000 });
      let { latitude, longitude } = loc.coords;
      if (looksLikeEmulatorMock(latitude, longitude)) { latitude = TLV.latitude; longitude = TLV.longitude; }

      setMyLocation({ latitude, longitude });
      setShowMyLocation(true);

      try {
        const addr = await reverseGeocode(latitude, longitude);
        const data = { latitude, longitude, formattedAddress: addr.formattedAddress, city: addr.city || 'Current Location' };
        setSelectedLocation(data); loadNearbyData(data, Number(searchRadius) || 10);
      } catch {
        const data = { latitude, longitude, formattedAddress: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`, city: 'Current Location' };
        setSelectedLocation(data); loadNearbyData(data, Number(searchRadius) || 10);
      }
    } catch {
      Alert.alert('Location Error', 'Could not get your current location. Please try again.');
    } finally {
      setIsGettingLocation(false); setIsLoading(false); setSearchingLocation(false);
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
    if (selectedLocation?.latitude && selectedLocation?.longitude) loadNearbyData(selectedLocation, Number(searchRadius) || 10);
    else handleGetCurrentLocation();
  };

  const headerTitle =
    viewMode === 'list'
      ? `${mapMode === 'plants' ? 'Plants' : 'Businesses'} near ${selectedLocation?.city || 'you'}`
      : selectedLocation?.city
      ? `${mapMode === 'plants' ? 'Plants' : 'Businesses'} near ${selectedLocation.city}`
      : 'Map View';

  const displayProducts = useMemo(() => {
    // dedup for the map prop
    const byId = new Map();
    (mapProducts || []).forEach((p) => byId.set(String(p.id || p._id), p));
    (nearbyProducts || []).forEach((p) => byId.set(String(p.id || p._id), p));
    return Array.from(byId.values());
  }, [mapProducts, nearbyProducts]);

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
      />

      <View style={styles.mapContainer}>
        {viewMode === 'map' && (
          <>
            {isLoading && searchingLocation ? (
              <View style={styles.searchingOverlay}>
                <ActivityIndicator size="large" />
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
              myLocation={myLocation}
              showMyLocation={Boolean(myLocation)}
              refreshToken={refreshToken}   
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
                onProductSelect={(productId) => {
                  const p = nearbyProducts.find((x) => (x.id || x._id) === productId);
                  navigation.navigate('PlantDetail', {
                    plantId: productId,
                    businessId: p?.businessId || p?.ownerEmail,
                    type: p?.isBusinessListing ? 'business' : 'global',
                  });
                }}
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

            <TouchableOpacity style={styles.backToMapButton} onPress={() => setViewMode('map')}>
              <MaterialIcons name="map" size={24} color="#fff" />
              <Text style={styles.backToMapText}>Map View</Text>
            </TouchableOpacity>
          </View>
        )}

        <MapSearchBox onLocationSelect={handleLocationSelect} maptilerKey={maptilerKey} />

        <TouchableOpacity
          style={[styles.currentLocationButton, isGettingLocation && styles.disabledButton, { bottom: FLOATING_BOTTOM }]}
          onPress={handleGetCurrentLocation}
          disabled={isGettingLocation}
        >
          {isGettingLocation ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <MaterialIcons name="my-location" size={24} color={showMyLocation ? '#C8E6C9' : '#fff'} />
          )}
        </TouchableOpacity>

        {selectedLocation && viewMode === 'map' && radiusVisible && (
          <RadiusControl
            radius={searchRadius}
            onRadiusChange={setSearchRadius}
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

  backToMapButton: {
    position: 'absolute', right: 16, bottom: 16, backgroundColor: '#2E7D32', flexDirection: 'row',
    alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 26,
    elevation: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.18, shadowRadius: 6, zIndex: 50,
  },
  backToMapText: { color: '#fff', fontWeight: '700', marginLeft: 8 },

  detailCardContainer: { position: 'absolute', left: 16, right: 16, zIndex: 500 },
});

export default MapScreen;
