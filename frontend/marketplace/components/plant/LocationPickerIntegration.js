// components/plant/LocationPickerIntegration.js - SYNCED WITH ENHANCED AZURE MAPS
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import LocationPicker from '../LocationPicker';
// FIXED: Use the enhanced Azure Maps service
import { reverseGeocode } from '../../services/azureMapsService';

/**
 * Enhanced location picker component with GPS integration
 * SYNCED: Now uses the enhanced Azure Maps service with proper fallbacks
 * 
 * @param {Object} value Current location value
 * @param {Function} onChange Called when location changes
 * @param {Object} formErrors Validation errors
 */
const LocationPickerIntegration = ({ value, onChange, formErrors }) => {
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [locationData, setLocationData] = useState(value || {});
  const [locationFetchError, setLocationFetchError] = useState(null);
  
  // Update internal state when value changes
  useEffect(() => {
    if (value) {
      setLocationData(value);
    }
  }, [value]);
  
  // Handle location confirmation from LocationPicker
  const handleLocationChange = (location) => {
    console.log("Location changed:", location);
    setLocationData(location);
    onChange(location);
  };

  // ENHANCED: Handle getting current location from GPS with Azure Maps integration
  const useCurrentLocation = async () => {
    try {
      setIsLoadingLocation(true);
      setLocationFetchError(null);
      
      // Request location permission
      const { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert(
          'Permission Denied',
          'We need location access to use your current location. You can still enter your location manually.',
          [{ text: 'OK' }]
        );
        setIsLoadingLocation(false);
        return;
      }
      
      // ENHANCED: Get current position with higher accuracy
      const locationOptions = Platform.OS === 'web' 
        ? {
            accuracy: Location.Accuracy.BestForNavigation,
            timeout: 20000,
            maximumAge: 10000,
            enableHighAccuracy: true
          }
        : {
            accuracy: Location.Accuracy.Highest,
            timeout: 15000,
            maximumAge: 10000
          };

      const position = await Location.getCurrentPositionAsync(locationOptions);
      
      const { latitude, longitude } = position.coords;
      console.log("GPS location obtained:", latitude, longitude);
      
      try {
        // FIXED: Use the enhanced Azure Maps reverse geocode service
        const locationInfo = await reverseGeocode(latitude, longitude);
        console.log("Azure Maps reverse geocode result:", locationInfo);
        
        if (locationInfo) {
          // Create complete location object with all required fields
          const location = {
            latitude: locationInfo.latitude,
            longitude: locationInfo.longitude,
            city: locationInfo.city || '',
            country: locationInfo.country || 'Israel',
            street: locationInfo.street || '',
            houseNumber: locationInfo.houseNumber || '',
            formattedAddress: locationInfo.formattedAddress || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`
          };
          
          // Only update forms if we're in Israel
          if (locationInfo.country === 'Israel' || !locationInfo.country) {
            setLocationData(location);
            onChange(location);
            setLocationFetchError(null);
          } else {
            Alert.alert(
              'Location Notice', 
              'We only support locations in Israel. Please enter an Israeli address manually.', 
              [{ text: 'OK' }]
            );
          }
        }
      } catch (azureError) {
        console.warn('Azure Maps reverse geocoding failed:', azureError);
        setLocationFetchError('Could not determine your address. Please enter it manually.');
        
        // Fallback to Expo's geocoder
        try {
          const addresses = await Location.reverseGeocodeAsync({
            latitude,
            longitude
          });
          
          if (addresses && addresses.length > 0) {
            const address = addresses[0];
            const isIsrael = address.country === 'Israel';
            
            const location = {
              latitude,
              longitude,
              city: address.city || '',
              country: address.country || '',
              street: address.street || '',
              houseNumber: address.name || '',
              formattedAddress: `${address.street || ''} ${address.name || ''}, ${address.city || ''}, ${address.country || ''}`
            };
            
            if (isIsrael) {
              console.log("Setting location from Expo geocoder:", location);
              setLocationData(location);
              onChange(location);
              setLocationFetchError(null);
            } else {
              Alert.alert(
                'Location Notice', 
                'We only support locations in Israel. Please enter an Israeli address manually.', 
                [{ text: 'OK' }]
              );
            }
          }
        } catch (error) {
          console.error('Expo geocoding error:', error);
          setLocationFetchError('Could not determine your address. Please enter it manually.');
        }
      }
    } catch (error) {
      console.error('Error getting location:', error);
      setLocationFetchError('Could not get your current location. Please try again later.');
      Alert.alert(
        'Location Error', 
        'Could not get your current location. Please try again later.', 
        [{ text: 'OK' }]
      );
    } finally {
      setIsLoadingLocation(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>
        Location <Text style={styles.requiredField}>*</Text>
      </Text>
      
      <View style={styles.locationActionRow}>
        <TouchableOpacity 
          style={styles.currentLocationButton} 
          onPress={useCurrentLocation}
          disabled={isLoadingLocation}
        >
          {isLoadingLocation ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <MaterialIcons name="my-location" size={16} color="#fff" />
              <Text style={styles.currentLocationText}>Use Current Location</Text>
            </>
          )}
        </TouchableOpacity>
        
        <Text style={styles.locationNoteText}>Israel locations only</Text>
      </View>
      
      {locationFetchError && (
        <Text style={styles.errorText}>{locationFetchError}</Text>
      )}
      
      {/* SYNCED: Use the enhanced LocationPicker component */}
      <LocationPicker
        value={locationData}
        onChange={handleLocationChange}
        required={true}
        showConfirmButton={true}
        placeholder="Enter your location in Israel"
      />
      
      {formErrors?.city ? (
        <Text style={styles.errorText}>{formErrors.city}</Text>
      ) : null}
      
      {/* ENHANCED: Show coordinates with proper formatting */}
      {locationData?.latitude && locationData?.longitude ? (
        <View style={styles.coordsContainer}>
          <MaterialIcons name="place" size={16} color="#4CAF50" />
          <Text style={styles.coordsText}>
            {locationData.formattedAddress || `${locationData.latitude.toFixed(4)}, ${locationData.longitude.toFixed(4)}`}
          </Text>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 28,
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 14,
    color: '#2E7D32',
  },
  requiredField: {
    color: '#D32F2F',
    fontWeight: 'bold',
  },
  locationActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  currentLocationButton: {
    backgroundColor: '#4CAF50',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  currentLocationText: {
    color: '#fff',
    fontSize: 14,
    marginLeft: 6,
    fontWeight: '500',
  },
  locationNoteText: {
    color: '#757575',
    fontSize: 12,
    fontStyle: 'italic',
  },
  errorText: {
    color: '#D32F2F',
    fontSize: 13,
    marginTop: 4,
    marginBottom: 8,
  },
  coordsContainer: {
    backgroundColor: '#f0f9f0',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  coordsText: {
    fontSize: 14,
    color: '#333',
    marginLeft: 8,
    flex: 1,
  },
});

export default LocationPickerIntegration;