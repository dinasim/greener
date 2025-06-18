// FIXED LocationPicker - Real GPS + Better Logic
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  Modal,
  Dimensions,
  Linking
} from 'react-native';
import * as Location from 'expo-location';
import { MaterialIcons } from '@expo/vector-icons';
import { colors } from '../services/theme';
import { getAzureMapsKey, geocodeAddress, reverseGeocode } from '../services/azureMapsService';
import CrossPlatformAzureMapView from './CrossPlatformAzureMapView';
import ToastMessage from './ToastMessage';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

const LocationPicker = ({ 
  value, 
  onChange, 
  placeholder = "Enter your business address",
  autoCloseOnConfirm = true,
  showToastFeedback = true,
  alwaysShowMap = true
}) => {
  // FIXED: Simplified state management
  const [showMap, setShowMap] = useState(false);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [loading, setLoading] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  
  // FIXED: Single source of truth for location
  const [selectedLocation, setSelectedLocation] = useState(value || null);
  const [liveGpsLocation, setLiveGpsLocation] = useState(null); // Real-time GPS
  const [mapRegion, setMapRegion] = useState({
    latitude: 32.0853, // Default to Tel Aviv
    longitude: 34.7818,
    zoom: 10,
  });
  
  // Map and service refs
  const mapRef = useRef(null);
  const searchTimeoutRef = useRef(null);
  const gpsWatchRef = useRef(null);
  
  // Manual address entry fields
  const [manualAddress, setManualAddress] = useState({
    city: '',
    street: '',
    streetNumber: '',
    postalCode: ''
  });
  const [citySuggestions, setCitySuggestions] = useState([]);
  const [showCitySuggestions, setShowCitySuggestions] = useState(false);
  const [streetSuggestions, setStreetSuggestions] = useState([]);
  const [showStreetSuggestions, setShowStreetSuggestions] = useState(false);
  const [streetNumberSuggestions, setStreetNumberSuggestions] = useState([]);
  const [showStreetNumberSuggestions, setShowStreetNumberSuggestions] = useState(false);
  
  // Azure Maps integration
  const [azureMapsKey, setAzureMapsKey] = useState(null);
  const [isKeyLoading, setIsKeyLoading] = useState(true);
  
  // Toast feedback
  const [toast, setToast] = useState({
    visible: false,
    message: '',
    type: 'info'
  });

  // FIXED: Cleanup on unmount
  useEffect(() => {
    return () => {
      // Cleanup timeouts
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
      
      // Stop GPS watching if active
      if (gpsWatchRef.current) {
        gpsWatchRef.current.remove();
      }
    };
  }, []);

  // Load Azure Maps key
  useEffect(() => {
    const loadAzureMapsKey = async () => {
      try {
        const key = await getAzureMapsKey();
        setAzureMapsKey(key);
        console.log('✅ Azure Maps key loaded successfully');
      } catch (err) {
        console.warn('⚠️ Azure Maps key failed to load:', err);
      } finally {
        setIsKeyLoading(false);
      }
    };
    
    loadAzureMapsKey();
  }, []);

  // FIXED: Initialize from value prop
  useEffect(() => {
    if (value) {
      console.log('📍 LocationPicker initialized with value:', value);
      setSelectedLocation(value);
      setSearchText(value.formattedAddress || '');
      
      if (value.latitude && value.longitude) {
        setMapRegion({
          latitude: value.latitude,
          longitude: value.longitude,
          zoom: 14,
        });
      }
    }
  }, [value]);

  // Show toast message
  const showToast = (message, type = 'info') => {
    if (showToastFeedback) {
      setToast({
        visible: true,
        message,
        type
      });
    }
  };

  // Hide toast message
  const hideToast = () => {
    setToast(prev => ({
      ...prev,
      visible: false
    }));
  };

  // FIXED: Comprehensive GPS location handler
  const getCurrentLocation = async () => {
    console.log('🛰️ Getting REAL GPS location...');
    setGpsLoading(true);
    showToast('Getting your current location...', 'info');

    try {
      // FIXED: Request permissions with proper handling
      console.log('🔐 Requesting location permissions...');
      const { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status !== 'granted') {
        console.log('❌ Location permission denied');
        Alert.alert(
          'Location Permission Required',
          'To use your current location, please allow location access in your device settings.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() }
          ]
        );
        setGpsLoading(false);
        return;
      }

      console.log('✅ Location permission granted');
      showToast('Permission granted, getting GPS coordinates...', 'info');

      // FIXED: High accuracy GPS with proper options
      const locationOptions = {
        accuracy: Platform.OS === 'web' 
          ? Location.Accuracy.BestForNavigation 
          : Location.Accuracy.BestForNavigation,
        timeout: 15000, // 15 seconds timeout
        maximumAge: 0, // Force fresh location
        ...(Platform.OS !== 'web' && {
          enableHighAccuracy: true,
          distanceFilter: 1, // Update every meter
        })
      };

      console.log('📡 Getting GPS coordinates with options:', locationOptions);
      
      let location;
      if (Platform.OS === 'web') {
        // FIXED: Web geolocation with proper promise handling
        location = await new Promise((resolve, reject) => {
          if (!navigator.geolocation) {
            reject(new Error('Geolocation not supported by this browser'));
            return;
          }

          navigator.geolocation.getCurrentPosition(
            (position) => {
              resolve({
                coords: {
                  latitude: position.coords.latitude,
                  longitude: position.coords.longitude,
                  accuracy: position.coords.accuracy,
                  altitude: position.coords.altitude,
                  altitudeAccuracy: position.coords.altitudeAccuracy,
                  heading: position.coords.heading,
                  speed: position.coords.speed,
                },
                timestamp: position.timestamp,
              });
            },
            reject,
            {
              enableHighAccuracy: true,
              timeout: 15000,
              maximumAge: 0,
            }
          );
        });
      } else {
        // Mobile GPS
        location = await Location.getCurrentPositionAsync(locationOptions);
      }

      const { latitude, longitude, accuracy } = location.coords;
      const timestamp = location.timestamp || Date.now();

      // FIXED: Validate GPS coordinates
      if (!latitude || !longitude || isNaN(latitude) || isNaN(longitude)) {
        throw new Error('Invalid GPS coordinates received');
      }

      if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
        throw new Error('GPS coordinates are out of valid range');
      }

      console.log(`🎯 GPS Success!`);
      console.log(`📍 Coordinates: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
      console.log(`🔍 Accuracy: ±${accuracy ? accuracy.toFixed(1) : 'Unknown'}m`);
      console.log(`⏰ Timestamp: ${new Date(timestamp).toLocaleString()}`);

      // FIXED: Set live GPS location immediately
      const gpsLocationData = {
        latitude,
        longitude,
        accuracy,
        timestamp,
        isGPS: true,
        isLive: true,
        source: Platform.OS === 'web' ? 'browser' : 'mobile'
      };

      setLiveGpsLocation(gpsLocationData);
      
      // Update map region to GPS location
      setMapRegion({
        latitude,
        longitude,
        zoom: 16, // Close zoom for GPS accuracy
      });

      showToast('GPS location acquired!', 'success');
      console.log('🗺️ Map region updated to GPS coordinates');

      // FIXED: Try reverse geocoding but don't fail if it doesn't work
      try {
        console.log('🔍 Converting GPS coordinates to address...');
        showToast('Converting coordinates to address...', 'info');
        
        const addressData = await reverseGeocode(latitude, longitude);
        
        if (addressData && addressData.formattedAddress) {
          console.log('✅ Address resolved from GPS:', addressData.formattedAddress);
          
          // FIXED: Merge GPS data with address data
          const enhancedLocationData = {
            ...addressData,
            // Preserve GPS metadata
            isGPS: true,
            isLive: true,
            gpsAccuracy: accuracy,
            gpsTimestamp: timestamp,
            gpsSource: Platform.OS === 'web' ? 'browser' : 'mobile',
            // Keep original GPS coordinates (reverse geocoding might adjust slightly)
            originalGPSLatitude: latitude,
            originalGPSLongitude: longitude,
          };
          
          setSelectedLocation(enhancedLocationData);
          setSearchText(addressData.formattedAddress);
          onChange(enhancedLocationData);
          
          showToast('GPS location set with address!', 'success');
          console.log('🏠 Location set with address from GPS');
          
        } else {
          throw new Error('No address found for GPS coordinates');
        }
        
      } catch (reverseGeocodeError) {
        console.warn('⚠️ Reverse geocoding failed:', reverseGeocodeError);
        
        // FIXED: Use GPS coordinates only as fallback
        const fallbackLocationData = {
          latitude,
          longitude,
          formattedAddress: `GPS: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
          city: 'GPS Location',
          country: 'Current Location',
          isGPS: true,
          isLive: true,
          gpsAccuracy: accuracy,
          gpsTimestamp: timestamp,
          gpsSource: Platform.OS === 'web' ? 'browser' : 'mobile',
          geocodingFailed: true,
        };
        
        setSelectedLocation(fallbackLocationData);
        setSearchText(fallbackLocationData.formattedAddress);
        onChange(fallbackLocationData);
        
        showToast('GPS coordinates set (address lookup failed)', 'warning');
        console.log('📍 Location set with GPS coordinates only');
      }
      
    } catch (error) {
      console.error('❌ GPS location error:', error);
      
      let errorMessage = 'Failed to get your current location.';
      
      if (error.code === 1 || error.code === 'PERMISSION_DENIED') {
        errorMessage = 'Location access denied. Please allow location access and try again.';
      } else if (error.code === 2 || error.code === 'POSITION_UNAVAILABLE') {
        errorMessage = 'Location unavailable. Please check your GPS settings.';
      } else if (error.code === 3 || error.code === 'TIMEOUT') {
        errorMessage = 'Location request timed out. Please try again.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      showToast(errorMessage, 'error');
      Alert.alert('GPS Error', errorMessage);
      
    } finally {
      setGpsLoading(false);
    }
  };

  // FIXED: Start continuous GPS tracking (optional feature)
  const startGPSTracking = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      console.log('🛰️ Starting continuous GPS tracking...');
      
      gpsWatchRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 5000, // Update every 5 seconds
          distanceInterval: 10, // Update every 10 meters
        },
        (location) => {
          const { latitude, longitude, accuracy } = location.coords;
          
          console.log(`📍 GPS Update: ${latitude.toFixed(6)}, ${longitude.toFixed(6)} (±${accuracy}m)`);
          
          setLiveGpsLocation({
            latitude,
            longitude,
            accuracy,
            timestamp: location.timestamp,
            isGPS: true,
            isLive: true,
            isTracking: true,
            source: Platform.OS === 'web' ? 'browser' : 'mobile'
          });
          
          // Update map region to follow user
          setMapRegion(prev => ({
            ...prev,
            latitude,
            longitude,
          }));
        }
      );
      
      showToast('GPS tracking started', 'success');
      
    } catch (error) {
      console.error('❌ GPS tracking error:', error);
      showToast('Failed to start GPS tracking', 'error');
    }
  };

  // Stop GPS tracking
  const stopGPSTracking = () => {
    if (gpsWatchRef.current) {
      gpsWatchRef.current.remove();
      gpsWatchRef.current = null;
      showToast('GPS tracking stopped', 'info');
      console.log('🛑 GPS tracking stopped');
    }
  };

  // Search for locations with Azure Maps suggestions
  const searchLocation = async (text) => {
    if (!text || text.length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    try {
      setLoading(true);
      console.log('🔍 Searching locations:', text);
      
      if (!azureMapsKey) {
        console.log('🔄 Using backend geocoding...');
        const result = await geocodeAddress(text);
        if (result) {
          setSuggestions([{
            latitude: result.latitude,
            longitude: result.longitude,
            formattedAddress: result.formattedAddress,
            city: result.city,
            street: result.street,
            country: result.country || 'Israel'
          }]);
          setShowSuggestions(true);
        }
        return;
      }

      // Use Azure Maps Search API
      const searchQuery = text.toLowerCase().includes('israel') ? text : `${text}, Israel`;
      const response = await fetch(
        `https://atlas.microsoft.com/search/address/json?` +
        `api-version=1.0&subscription-key=${azureMapsKey}` +
        `&typeahead=true&limit=5&countrySet=IL&language=en-US` +
        `&query=${encodeURIComponent(searchQuery)}`
      );

      if (response.ok) {
        const data = await response.json();
        const locations = data.results?.map(result => ({
          latitude: result.position?.lat,
          longitude: result.position?.lon,
          formattedAddress: result.address?.freeformAddress,
          city: result.address?.municipality || result.address?.localName,
          street: result.address?.streetName,
          country: result.address?.country || 'Israel'
        })).filter(loc => loc.latitude && loc.longitude) || [];

        setSuggestions(locations);
        setShowSuggestions(locations.length > 0);
        console.log(`✅ Found ${locations.length} suggestions`);
      } else {
        // Fallback to backend
        const result = await geocodeAddress(text);
        if (result) {
          setSuggestions([result]);
          setShowSuggestions(true);
        }
      }
      
    } catch (error) {
      console.warn('⚠️ Location search failed:', error);
      setSuggestions([]);
      setShowSuggestions(false);
    } finally {
      setLoading(false);
    }
  };

  // Debounced search for automated suggestions
  const handleSearchTextChange = (text) => {
    setSearchText(text);
    
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    searchTimeoutRef.current = setTimeout(() => {
      searchLocation(text);
    }, 500);
  };

  // Select a suggestion from dropdown
  const selectSuggestion = (suggestion) => {
    const locationData = {
      latitude: suggestion.latitude,
      longitude: suggestion.longitude,
      city: suggestion.city || '',
      street: suggestion.street || '',
      formattedAddress: suggestion.formattedAddress,
      country: suggestion.country || 'Israel',
      isGPS: false,
      isSearchResult: true,
    };
    
    setSelectedLocation(locationData);
    setSearchText(suggestion.formattedAddress);
    setShowSuggestions(false);
    setSuggestions([]);
    onChange(locationData);
    
    // Update map region
    setMapRegion({
      latitude: suggestion.latitude,
      longitude: suggestion.longitude,
      zoom: 14,
    });
    
    console.log('📍 Location selected from search:', suggestion.formattedAddress);
  };

  // Handle map location selection
  const handleLocationSelect = async (location) => {
    try {
      setLoading(true);
      console.log('🗺️ Map location selected:', location);
      
      const addressData = await reverseGeocode(location.latitude, location.longitude);
      
      // Ensure city is always a string
      const cityString = typeof addressData.city === 'string'
        ? addressData.city
        : (addressData.city?.name || addressData.city?.label || 'Selected Location');
      const locationData = {
        ...addressData,
        latitude: location.latitude,
        longitude: location.longitude,
        city: cityString,
        formattedAddress: addressData.formattedAddress || `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`,
        isGPS: false,
        isMapSelection: true,
      };
      
      setSelectedLocation(locationData);
      setSearchText(locationData.formattedAddress);
      onChange(locationData);
      console.log('✅ Map location set with address');
    } catch (error) {
      // Fallback if reverse geocoding fails
      const fallbackData = {
        latitude: location.latitude,
        longitude: location.longitude,
        city: 'Selected Location',
        formattedAddress: `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`,
        isGPS: false,
        isMapSelection: true,
      };
      setSelectedLocation(fallbackData);
      setSearchText(fallbackData.formattedAddress);
      onChange(fallbackData);
      console.log('📍 Map location set with coordinates');
    } finally {
      setLoading(false);
    }
  };

  // FIXED: Manual address submission with better validation
  const handleManualAddressSubmit = async () => {
    const { city, street, streetNumber } = manualAddress;
    
    if (!city.trim()) {
      Alert.alert('Missing Information', 'Please enter a city');
      return;
    }
    
    try {
      setLoading(true);
      
      let fullAddress = city.trim();
      if (street.trim()) {
        fullAddress += `, ${street.trim()}`;
        if (streetNumber.trim()) {
          fullAddress += ` ${streetNumber.trim()}`;
        }
      }
      fullAddress += ', Israel';
      
      console.log('🏠 Geocoding manual address:', fullAddress);
      
      const result = await geocodeAddress(fullAddress);
      
      if (result) {
        const locationData = {
          ...result,
          isGPS: false,
          isManualEntry: true,
          manualAddress: { ...manualAddress },
        };
        
        setSelectedLocation(locationData);
        setSearchText(result.formattedAddress);
        onChange(locationData);
        setShowManualEntry(false);
        
        setMapRegion({
          latitude: result.latitude,
          longitude: result.longitude,
          zoom: 15,
        });
        
        // Clear manual form
        setManualAddress({
          city: '',
          street: '',
          streetNumber: '',
          postalCode: ''
        });
        
        console.log('✅ Manual address geocoded successfully');
        showToast('Address found and set!', 'success');
      } else {
        Alert.alert('Address Not Found', 'Could not find this address. Please check the details and try again.');
      }
      
    } catch (error) {
      console.error('❌ Manual address error:', error);
      Alert.alert('Geocoding Error', 'Unable to find this address. Please check the spelling and try again.');
    } finally {
      setLoading(false);
    }
  };

  // Get current markers for map display
  const getCurrentMarkers = () => {
    const markers = [];
    
    // Add selected location marker
    if (selectedLocation && selectedLocation.latitude && selectedLocation.longitude) {
      markers.push({
        id: 'selected',
        latitude: selectedLocation.latitude,
        longitude: selectedLocation.longitude,
        title: selectedLocation.isGPS ? 'Your Location (GPS)' : 'Selected Location',
        description: selectedLocation.formattedAddress,
        type: selectedLocation.isGPS ? 'user' : 'selected'
      });
    }
    
    // Add live GPS marker if different from selected
    if (liveGpsLocation && liveGpsLocation.latitude && liveGpsLocation.longitude) {
      const isDifferent = !selectedLocation || 
        Math.abs(selectedLocation.latitude - liveGpsLocation.latitude) > 0.0001 ||
        Math.abs(selectedLocation.longitude - liveGpsLocation.longitude) > 0.0001;
        
      if (isDifferent) {
        markers.push({
          id: 'live-gps',
          latitude: liveGpsLocation.latitude,
          longitude: liveGpsLocation.longitude,
          title: 'Live GPS Location',
          description: `Accuracy: ±${liveGpsLocation.accuracy?.toFixed(1) || 'Unknown'}m`,
          type: 'gps'
        });
      }
    }
    
    return markers;
  };

  // Render loading if key is loading
  if (isKeyLoading) {
    return (
      <View style={styles.container}>
        <Text style={styles.label}>Location</Text>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#4CAF50" />
          <Text style={styles.loadingText}>Loading location service...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Search Input */}
      <View style={styles.searchContainer}>
        <MaterialIcons name="search" size={20} color="#666" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          value={searchText}
          onChangeText={handleSearchTextChange}
          placeholder={placeholder}
          placeholderTextColor="#999"
          onFocus={() => {
            if (suggestions.length > 0) {
              setShowSuggestions(true);
            }
          }}
          onBlur={() => {
            setTimeout(() => setShowSuggestions(false), 200);
          }}
        />
        {loading && (
          <ActivityIndicator size="small" color="#216a94" style={styles.loadingIcon} />
        )}
      </View>

      {/* Action Buttons */}
      <View style={styles.actionButtonsContainer}>
        <TouchableOpacity
          style={[styles.actionButton, styles.currentLocationButton]}
          onPress={getCurrentLocation}
          disabled={gpsLoading}
        >
          {gpsLoading ? (
            <ActivityIndicator size="small" color="#216a94" />
          ) : (
            <>
              <MaterialIcons name="my-location" size={16} color="#216a94" />
              <Text style={styles.actionButtonText}>GPS</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.manualEntryButton]}
          onPress={() => setShowManualEntry(true)}
        >
          <MaterialIcons name="edit-location" size={16} color="#FF6B35" />
          <Text style={[styles.actionButtonText, { color: '#FF6B35' }]}>Manual</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.mapButton]}
          onPress={() => setShowMap(true)}
        >
          <MaterialIcons name="map" size={16} color="#4CAF50" />
          <Text style={[styles.actionButtonText, { color: '#4CAF50' }]}>Map</Text>
        </TouchableOpacity>
      </View>

      {/* Search Suggestions */}
      {showSuggestions && suggestions.length > 0 && (
        <View style={styles.suggestionsContainer}>
          <ScrollView style={styles.suggestionsList} keyboardShouldPersistTaps="handled">
            {suggestions.map((suggestion, index) => (
              <TouchableOpacity
                key={index}
                style={styles.suggestionItem}
                onPress={() => selectSuggestion(suggestion)}
              >
                <MaterialIcons name="location-on" size={20} color="#666" />
                <View style={styles.suggestionTextContainer}>
                  <Text style={styles.suggestionText}>{suggestion.formattedAddress}</Text>
                  {suggestion.city && (
                    <Text style={styles.suggestionSubtext}>{suggestion.city}</Text>
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Selected Location Display */}
      {selectedLocation && (
        <View style={styles.selectedLocationContainer}>
          <MaterialIcons 
            name={selectedLocation.isGPS ? "gps-fixed" : "location-on"} 
            size={16} 
            color={selectedLocation.isGPS ? "#2196F3" : "#4CAF50"} 
          />
          <View style={styles.selectedLocationTextContainer}>
            <Text style={styles.selectedLocationText} numberOfLines={2}>
              {selectedLocation.formattedAddress}
            </Text>
            {selectedLocation.latitude && selectedLocation.longitude && (
              <Text style={styles.coordinatesText}>
                {selectedLocation.latitude.toFixed(6)}, {selectedLocation.longitude.toFixed(6)}
              </Text>
            )}
            
            {/* FIXED: Better status indicators */}
            {selectedLocation.isGPS && (
              <View style={styles.statusBadgeContainer}>
                <Text style={styles.gpsLocationBadge}>
                  📍 GPS Location
                  {selectedLocation.gpsAccuracy && ` (±${selectedLocation.gpsAccuracy.toFixed(1)}m)`}
                </Text>
                {selectedLocation.gpsTimestamp && (
                  <Text style={styles.timestampText}>
                    {new Date(selectedLocation.gpsTimestamp).toLocaleTimeString()}
                  </Text>
                )}
              </View>
            )}
            
            {selectedLocation.isLive && (
              <Text style={styles.liveLocationBadge}>🔴 Live Location</Text>
            )}
            
            {selectedLocation.isManualEntry && (
              <Text style={styles.manualEntryBadge}>✏️ Manual Entry</Text>
            )}
            
            {selectedLocation.isSearchResult && (
              <Text style={styles.searchResultBadge}>🔍 Search Result</Text>
            )}
            
            {selectedLocation.isMapSelection && (
              <Text style={styles.mapSelectionBadge}>🗺️ Map Selection</Text>
            )}
          </View>
        </View>
      )}

      {/* Integrated Map */}
      {alwaysShowMap && azureMapsKey && (
        <View style={styles.integratedMapContainer}>
          <View style={styles.integratedMapHeader}>
            <MaterialIcons name="map" size={20} color="#4CAF50" />
            <Text style={styles.integratedMapTitle}>Location Preview</Text>
            <TouchableOpacity
              style={styles.fullScreenMapButton}
              onPress={() => setShowMap(true)}
            >
              <MaterialIcons name="fullscreen" size={20} color="#4CAF50" />
            </TouchableOpacity>
          </View>
          
          <View style={styles.integratedMapWrapper}>
            <CrossPlatformAzureMapView
              ref={mapRef}
              region={mapRegion}
              initialRegion={mapRegion}
              markers={getCurrentMarkers()}
              onMarkerPress={(marker) => {
                console.log('Integrated map marker pressed:', marker);
              }}
              onLocationSelect={handleLocationSelect}
              onMapPress={handleLocationSelect}
              style={styles.integratedMap}
              interactive={true}
              azureMapsKey={azureMapsKey}
              showMyLocation={!!liveGpsLocation}
              myLocation={liveGpsLocation}
            />

            {/* Map Controls */}
            <View style={styles.integratedMapControls}>
              <TouchableOpacity
                style={styles.integratedMapControlButton}
                onPress={getCurrentLocation}
                disabled={gpsLoading}
              >
                {gpsLoading ? (
                  <ActivityIndicator size="small" color="#4CAF50" />
                ) : (
                  <MaterialIcons name="my-location" size={20} color="#4CAF50" />
                )}
              </TouchableOpacity>
              
              {/* GPS Tracking Toggle */}
              {liveGpsLocation && (
                <TouchableOpacity
                  style={styles.integratedMapControlButton}
                  onPress={gpsWatchRef.current ? stopGPSTracking : startGPSTracking}
                >
                  <MaterialIcons 
                    name={gpsWatchRef.current ? "gps-off" : "gps-fixed"} 
                    size={20} 
                    color={gpsWatchRef.current ? "#FF5722" : "#2196F3"} 
                  />
                </TouchableOpacity>
              )}
            </View>
          </View>
          
          <Text style={styles.integratedMapHint}>
            📍 Tap on the map to select a location, or use GPS for your current position
          </Text>
        </View>
      )}
{/* Manual Address Entry Modal */}
<Modal
       visible={showManualEntry}
       animationType="slide"
       onRequestClose={() => setShowManualEntry(false)}
     >
       <View style={styles.modalContainer}>
         <View style={styles.modalHeader}>
           <Text style={styles.modalTitle}>Enter Address Manually</Text>
           <TouchableOpacity
             style={styles.closeButton}
             onPress={() => setShowManualEntry(false)}
           >
             <MaterialIcons name="close" size={24} color="#333" />
           </TouchableOpacity>
         </View>

         <ScrollView style={styles.modalContent} keyboardShouldPersistTaps="handled">
           {/* City Input */}
           <View style={styles.inputGroup}>
             <Text style={styles.inputLabel}>
               City <Text style={styles.requiredText}>*</Text>
             </Text>
             <View style={styles.inputContainer}>
               <TextInput
                 style={styles.textInput}
                 value={manualAddress.city}
                 onChangeText={(text) => {
                   setManualAddress({ ...manualAddress, city: text });
                 }}
                 placeholder="Enter Israeli city name..."
                 placeholderTextColor="#999"
               />
             </View>
           </View>

           {/* Street Input */}
           <View style={styles.inputGroup}>
             <Text style={styles.inputLabel}>Street Name</Text>
             <View style={styles.inputContainer}>
               <TextInput
                 style={styles.textInput}
                 value={manualAddress.street}
                 onChangeText={(text) => {
                   setManualAddress({ ...manualAddress, street: text });
                 }}
                 placeholder="Enter street name..."
                 placeholderTextColor="#999"
               />
             </View>
           </View>

           {/* Street Number Input */}
           <View style={styles.inputGroup}>
             <Text style={styles.inputLabel}>
               House Number <Text style={styles.optionalText}>(Optional)</Text>
             </Text>
             <View style={styles.inputContainer}>
               <TextInput
                 style={styles.textInput}
                 value={manualAddress.streetNumber}
                 onChangeText={(text) => {
                   setManualAddress({ ...manualAddress, streetNumber: text });
                 }}
                 placeholder="Enter house number..."
                 placeholderTextColor="#999"
                 keyboardType="default"
               />
             </View>
           </View>

           {/* Postal Code Input */}
           <View style={styles.inputGroup}>
             <Text style={styles.inputLabel}>Postal Code</Text>
             <View style={styles.inputContainer}>
               <TextInput
                 style={styles.textInput}
                 value={manualAddress.postalCode}
                 onChangeText={(text) => setManualAddress({ ...manualAddress, postalCode: text })}
                 placeholder="Enter postal code (optional)"
                 placeholderTextColor="#999"
                 keyboardType="numeric"
               />
             </View>
           </View>

           <Text style={styles.helperText}>
             <Text style={styles.requiredText}>*</Text> Required field. We'll verify this address to ensure it's a real location.
           </Text>
         </ScrollView>

         {/* Submit Button */}
         <View style={styles.modalFooter}>
           <TouchableOpacity
             style={[styles.submitButton, (!manualAddress.city.trim()) && styles.submitButtonDisabled]}
             onPress={handleManualAddressSubmit}
             disabled={!manualAddress.city.trim() || loading}
           >
             {loading ? (
               <ActivityIndicator size="small" color="#fff" />
             ) : (
               <>
                 <MaterialIcons name="check" size={20} color="#fff" />
                 <Text style={styles.submitButtonText}>Find & Set Address</Text>
               </>
             )}
           </TouchableOpacity>
         </View>
       </View>
     </Modal>

     {/* Full Screen Map Modal */}
     <Modal
       visible={showMap}
       animationType="slide"
       onRequestClose={() => setShowMap(false)}
     >
       <View style={styles.modalContainer}>
         <View style={styles.modalHeader}>
           <Text style={styles.modalTitle}>Select Location</Text>
           <TouchableOpacity
             style={styles.closeButton}
             onPress={() => setShowMap(false)}
           >
             <MaterialIcons name="close" size={24} color="#333" />
           </TouchableOpacity>
         </View>

         {/* User instruction message */}
         <View style={{padding: 12, backgroundColor: '#f8f9fa'}}>
           <Text style={{color: '#666', fontSize: 13, textAlign: 'center'}}>
             Double tap on the map to pin your location, then press Confirm.
           </Text>
         </View>

         <CrossPlatformAzureMapView
           ref={mapRef}
           region={mapRegion}
           initialRegion={mapRegion}
           markers={getCurrentMarkers()}
           onMarkerPress={(marker) => {
             console.log('Full screen map marker pressed:', marker);
           }}
           onLocationSelect={handleLocationSelect}
           onMapPress={handleLocationSelect}
           style={styles.map}
           interactive={true}
           azureMapsKey={azureMapsKey}
           showMyLocation={!!liveGpsLocation}
           myLocation={liveGpsLocation}
         />

         {/* Map Controls */}
         <View style={styles.mapControls}>
           <TouchableOpacity
             style={styles.mapControlButton}
             onPress={getCurrentLocation}
             disabled={gpsLoading}
           >
             {gpsLoading ? (
               <ActivityIndicator size="small" color="#216a94" />
             ) : (
               <MaterialIcons name="my-location" size={24} color="#216a94" />
             )}
           </TouchableOpacity>
           
           {/* GPS Tracking Control */}
           {liveGpsLocation && (
             <TouchableOpacity
               style={styles.mapControlButton}
               onPress={gpsWatchRef.current ? stopGPSTracking : startGPSTracking}
             >
               <MaterialIcons 
                 name={gpsWatchRef.current ? "gps-off" : "gps-fixed"} 
                 size={24} 
                 color={gpsWatchRef.current ? "#FF5722" : "#2196F3"} 
               />
             </TouchableOpacity>
           )}
         </View>

         {/* Confirm Button */}
         {selectedLocation && (
           <TouchableOpacity
             style={styles.confirmButton}
             onPress={() => {
               showToast('Location confirmed successfully!', 'success');
               
               if (autoCloseOnConfirm) {
                 setTimeout(() => {
                   setShowMap(false);
                 }, 1500);
               } else {
                 setShowMap(false);
               }
             }}
           >
             <MaterialIcons name="check" size={20} color="#fff" style={{ marginRight: 8 }} />
             <Text style={styles.confirmButtonText}>Confirm Location</Text>
           </TouchableOpacity>
         )}
       </View>
     </Modal>

     {/* Toast Message */}
     {toast.visible && (
       <ToastMessage
         message={toast.message}
         type={toast.type}
         onClose={hideToast}
       />
     )}
   </View>
 );
};

const styles = StyleSheet.create({
 container: {
   marginBottom: 20,
 },
 label: {
   fontSize: 17,
   fontWeight: '600',
   marginBottom: 8,
   color: '#333',
 },
 loadingContainer: {
   flexDirection: 'row',
   alignItems: 'center',
   justifyContent: 'center',
   padding: 16,
   backgroundColor: '#f5f5f5',
   borderRadius: 8,
 },
 loadingText: {
   marginLeft: 8,
   color: '#666',
   fontSize: 14,
 },
 searchContainer: {
   flexDirection: 'row',
   alignItems: 'center',
   backgroundColor: '#f8f9fa',
   borderRadius: 12,
   paddingHorizontal: 12,
   paddingVertical: 8,
   margin: 16,
   ...Platform.select({
     web: { boxShadow: '0px 1px 3px rgba(0, 0, 0, 0.1)' },
     default: {
       shadowColor: '#000',
       shadowOffset: { width: 0, height: 1 },
       shadowOpacity: 0.1,
       shadowRadius: 2,
       elevation: 2,
     }
   })
 },
 searchIcon: {
   marginRight: 8,
 },
 searchInput: {
   flex: 1,
   paddingVertical: Platform.OS === 'web' ? 12 : 10,
   fontSize: 16,
   color: '#333',
   ...Platform.select({
     web: { 
       outlineWidth: 0,
       outlineStyle: 'none',
       outlineColor: 'transparent'
     },
     default: {}
   })
 },
 loadingIcon: {
   marginLeft: 8,
 },
 actionButtonsContainer: {
   flexDirection: 'row',
   justifyContent: 'space-between',
   marginBottom: 16,
   gap: 8,
 },
 actionButton: {
   flex: 1,
   flexDirection: 'row',
   alignItems: 'center',
   justifyContent: 'center',
   paddingVertical: 10,
   paddingHorizontal: 12,
   borderRadius: 8,
   borderWidth: 1,
   minHeight: 44,
 },
 currentLocationButton: {
   backgroundColor: '#e3f2fd',
   borderColor: '#2196F3',
 },
 manualEntryButton: {
   backgroundColor: '#fff5f0',
   borderColor: '#FF6B35',
 },
 mapButton: {
   backgroundColor: '#f0f9f0',
   borderColor: '#4CAF50',
 },
 actionButtonText: {
   fontSize: 13,
   fontWeight: '500',
   marginLeft: 6,
   color: '#216a94',
 },
 suggestionsContainer: {
   backgroundColor: '#fff',
   borderWidth: 1,
   borderColor: '#ddd',
   borderRadius: 8,
   marginTop: -8,
   marginBottom: 8,
   overflow: 'hidden',
   position: 'relative',
   zIndex: 1000,
   ...Platform.select({
     web: {
       boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
     },
     default: {
       shadowColor: '#000',
       shadowOffset: { width: 0, height: 2 },
       shadowOpacity: 0.1,
       shadowRadius: 4,
       elevation: 3,
     }
   }),
 },
 suggestionsList: {
   maxHeight: 200,
 },
 suggestionItem: {
   flexDirection: 'row',
   alignItems: 'center',
   padding: 12,
   borderBottomWidth: 1,
   borderBottomColor: '#f0f0f0',
 },
 suggestionTextContainer: {
   flex: 1,
   marginLeft: 8,
 },
 suggestionText: {
   fontSize: 14,
   color: '#333',
   fontWeight: '500',
 },
 suggestionSubtext: {
   fontSize: 12,
   color: '#666',
   marginTop: 2,
 },
 selectedLocationContainer: {
   flexDirection: 'row',
   alignItems: 'flex-start',
   backgroundColor: '#f0f9f0',
   borderRadius: 8,
   padding: 12,
   marginTop: 8,
   borderWidth: 1,
   borderColor: '#4CAF50',
 },
 selectedLocationTextContainer: {
   flex: 1,
   marginLeft: 8,
 },
 selectedLocationText: {
   fontSize: 14,
   color: '#333',
   fontWeight: '500',
 },
 coordinatesText: {
   fontSize: 12,
   color: '#666',
   marginTop: 4,
   fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
 },
 statusBadgeContainer: {
   marginTop: 4,
 },
 gpsLocationBadge: {
   fontSize: 11,
   color: '#2196F3',
   fontWeight: '600',
 },
 timestampText: {
   fontSize: 10,
   color: '#999',
   marginTop: 2,
 },
 liveLocationBadge: {
   fontSize: 11,
   color: '#FF5722',
   marginTop: 4,
   fontWeight: '600',
 },
 manualEntryBadge: {
   fontSize: 11,
   color: '#FF6B35',
   marginTop: 4,
   fontWeight: '600',
 },
 searchResultBadge: {
   fontSize: 11,
   color: '#9C27B0',
   marginTop: 4,
   fontWeight: '600',
 },
 mapSelectionBadge: {
   fontSize: 11,
   color: '#4CAF50',
   marginTop: 4,
   fontWeight: '600',
 },
 integratedMapContainer: {
   backgroundColor: '#fff',
   borderRadius: 8,
   margin: 16,
   overflow: 'hidden',
   borderWidth: 1,
   borderColor: '#ddd',
   ...Platform.select({
     web: { boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.1)' },
     default: {
       shadowColor: '#000',
       shadowOffset: { width: 0, height: 2 },
       shadowOpacity: 0.1,
       shadowRadius: 4,
       elevation: 3,
     }
   }),
 },
 integratedMapHeader: {
   flexDirection: 'row',
   alignItems: 'center',
   justifyContent: 'space-between',
   padding: 12,
   borderBottomWidth: 1,
   borderBottomColor: '#e0e0e0',
   backgroundColor: '#f8f9fa',
 },
 integratedMapTitle: {
   fontSize: 16,
   fontWeight: '500',
   color: '#333',
 },
 fullScreenMapButton: {
   padding: 8,
   borderRadius: 20,
   backgroundColor: '#f0f0f0',
 },
 integratedMapWrapper: {
   position: 'relative',
   width: '100%',
   height: 200,
 },
 integratedMap: {
   flex: 1,
 },
 integratedMapControls: {
   position: 'absolute',
   top: 8,
   right: 8,
   flexDirection: 'column',
   alignItems: 'center',
   zIndex: 10,
 },
 integratedMapControlButton: {
   backgroundColor: '#fff',
   borderRadius: 25,
   padding: 10,
   marginBottom: 8,
   ...Platform.select({
     web: {
       boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
     },
     default: {
       shadowColor: '#000',
       shadowOffset: { width: 0, height: 2 },
       shadowOpacity: 0.3,
       shadowRadius: 4,
       elevation: 5,
     },
   }),
 },
 integratedMapHint: {
   fontSize: 12,
   color: '#666',
   margin: 12,
   textAlign: 'center',
   fontStyle: 'italic',
 },
 modalContainer: {
   flex: 1,
   backgroundColor: '#fff',
 },
 modalHeader: {
   flexDirection: 'row',
   alignItems: 'center',
   justifyContent: 'space-between',
   paddingHorizontal: 16,
   paddingVertical: 12,
   borderBottomWidth: 1,
   borderBottomColor: '#e0e0e0',
   backgroundColor: '#f8f9fa',
 },
 modalTitle: {
   fontSize: 18,
   fontWeight: '600',
   color: '#333',
 },
 closeButton: {
   padding: 8,
   borderRadius: 20,
   backgroundColor: '#f0f0f0',
 },
 modalContent: {
   flex: 1,
   padding: 16,
 },
 inputGroup: {
   marginBottom: 20,
 },
 inputLabel: {
   fontSize: 16,
   fontWeight: '600',
   marginBottom: 8,
   color: '#333',
 },
 inputContainer: {
   borderWidth: 1,
   borderColor: '#ddd',
   borderRadius: 8,
   backgroundColor: '#f9f9f9',
 },
 textInput: {
   paddingHorizontal: 12,
   paddingVertical: Platform.OS === 'web' ? 12 : 10,
   fontSize: 16,
   color: '#333',
   ...Platform.select({
     web: { 
       outlineWidth: 0,
       outlineStyle: 'none',
       outlineColor: 'transparent'
     },
     default: {}
   })
 },
 helperText: {
   fontSize: 13,
   color: '#666',
   fontStyle: 'italic',
   marginTop: 8,
   lineHeight: 18,
 },
 modalFooter: {
   padding: 16,
   borderTopWidth: 1,
   borderTopColor: '#e0e0e0',
   backgroundColor: '#f8f9fa',
 },
 submitButton: {
   backgroundColor: '#4CAF50',
   borderRadius: 8,
   paddingVertical: 14,
   flexDirection: 'row',
   alignItems: 'center',
   justifyContent: 'center',
   ...Platform.select({
     web: { boxShadow: '0px 2px 8px rgba(76, 175, 80, 0.3)' },
     default: {
       shadowColor: '#000',
       shadowOffset: { width: 0, height: 2 },
       shadowOpacity: 0.2,
       shadowRadius: 4,
       elevation: 4,
     }
   })
 },
 submitButtonDisabled: {
   backgroundColor: '#cccccc',
 },
 submitButtonText: {
   color: '#fff',
   fontWeight: '600',
   fontSize: 16,
   marginLeft: 8,
 },
 map: {
   flex: 1,
   margin: 16,
   borderRadius: 8,
   overflow: 'hidden',
 },
 mapControls: {
   position: 'absolute',
   top: 80,
   right: 26,
   flexDirection: 'column',
   alignItems: 'center',
   zIndex: 10,
 },
 mapControlButton: {
   backgroundColor: '#fff',
   borderRadius: 25,
   padding: 12,
   marginBottom: 8,
   ...Platform.select({
     web: {
       boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
     },
     default: {
       shadowColor: '#000',
       shadowOffset: { width: 0, height: 2 },
       shadowOpacity: 0.3,
       shadowRadius: 4,
       elevation: 5,
     },
   }),
 },
 confirmButton: {
   backgroundColor: '#4CAF50',
   marginHorizontal: 16,
   marginBottom: 16,
   borderRadius: 8,
   paddingVertical: 14,
   alignItems: 'center',
   flexDirection: 'row',
   justifyContent: 'center',
 },
 confirmButtonText: {
   color: '#fff',
   fontWeight: '600',
   fontSize: 16,
 },
 requiredText: {
   color: '#FF3B30',
   fontWeight: '600',
 },
 optionalText: {
   fontSize: 12,
   color: '#666',
   fontStyle: 'italic',
   fontWeight: '400',
 },
});

export default LocationPicker;
