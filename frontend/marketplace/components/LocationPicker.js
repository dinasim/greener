// components/LocationPicker.js
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { geocodeAddress, reverseGeocode } from '../services/azureMapsService';

/**
 * LocationPicker component
 * Allows user to enter an address or use current location
 */
const LocationPicker = ({ value, onChange, style }) => {
  const [address, setAddress] = useState(value?.formattedAddress || '');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Handle address change
  const handleAddressChange = (text) => {
    setAddress(text);
    setError('');
  };
  
  // Geocode entered address
  const handleGeocodeAddress = async () => {
    if (!address || address.trim().length < 3) {
      setError('Please enter a valid address');
      return;
    }
    
    setIsLoading(true);
    setError('');
    
    try {
      const result = await geocodeAddress(address);
      
      if (result && result.latitude && result.longitude) {
        // Create location object with coordinates and address parts
        const locationData = {
          latitude: result.latitude,
          longitude: result.longitude,
          formattedAddress: result.formattedAddress,
          city: result.city || '',
          country: result.country || '',
          street: result.street || '',
          houseNumber: result.houseNumber || '',
        };
        
        // Call the onChange callback
        onChange(locationData);
        
        // Update the displayed address
        setAddress(result.formattedAddress);
      } else {
        setError('Could not find coordinates for this address');
      }
    } catch (err) {
      console.error('Error geocoding address:', err);
      setError('Failed to find this location. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Use current location
  const handleUseCurrentLocation = async () => {
    setIsLoading(true);
    setError('');
    
    try {
      // Request permission to use location
      const { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status !== 'granted') {
        setError('Permission to access location was denied');
        setIsLoading(false);
        return;
      }
      
      // Get current location
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced
      });
      
      const { latitude, longitude } = location.coords;
      
      // Reverse geocode to get address
      try {
        const result = await reverseGeocode(latitude, longitude);
        
        if (result && result.formattedAddress) {
          // Create location object
          const locationData = {
            latitude,
            longitude,
            formattedAddress: result.formattedAddress,
            city: result.city || '',
            country: result.country || '',
            street: result.street || '',
            houseNumber: result.houseNumber || '',
          };
          
          // Call the onChange callback
          onChange(locationData);
          
          // Update the displayed address
          setAddress(result.formattedAddress);
        } else {
          // Just use coordinates if reverse geocoding fails
          onChange({
            latitude,
            longitude,
            formattedAddress: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
            city: 'Unknown location',
          });
          
          setAddress(`${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
        }
      } catch (reverseError) {
        console.error('Error reverse geocoding:', reverseError);
        
        // Use just coordinates if reverse geocoding fails
        onChange({
          latitude,
          longitude,
          formattedAddress: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
          city: 'Unknown location',
        });
        
        setAddress(`${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
      }
    } catch (err) {
      console.error('Error getting location:', err);
      setError('Could not get your current location. Please try entering an address instead.');
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <View style={[styles.container, style]}>
      <Text style={styles.label}>Location</Text>
      
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={address}
          onChangeText={handleAddressChange}
          placeholder="Enter city, street, house number"
          placeholderTextColor="#999"
          multiline={false}
        />
        
        <TouchableOpacity
          style={styles.searchButton}
          onPress={handleGeocodeAddress}
          disabled={isLoading}
        >
          <MaterialIcons name="search" size={24} color="#fff" />
        </TouchableOpacity>
      </View>
      
      <TouchableOpacity
        style={styles.currentLocationButton}
        onPress={handleUseCurrentLocation}
        disabled={isLoading}
      >
        <MaterialIcons name="my-location" size={18} color="#4CAF50" />
        <Text style={styles.currentLocationText}>Use my current location</Text>
      </TouchableOpacity>
      
      {isLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#4CAF50" />
          <Text style={styles.loadingText}>Finding location...</Text>
        </View>
      )}
      
      {error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : null}
      
      {value && value.latitude && value.longitude ? (
        <Text style={styles.locationFoundText}>
          Location set: {value.city || 'Unknown location'}
        </Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    height: 50,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f9f9f9',
    fontSize: 16,
    color: '#333',
  },
  searchButton: {
    backgroundColor: '#4CAF50',
    width: 50,
    height: 50,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  currentLocationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingVertical: 8,
  },
  currentLocationText: {
    marginLeft: 8,
    color: '#4CAF50',
    fontWeight: '500',
    fontSize: 14,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  loadingText: {
    marginLeft: 8,
    color: '#666',
    fontSize: 14,
  },
  errorText: {
    color: '#f44336',
    fontSize: 14,
    marginTop: 8,
  },
  locationFoundText: {
    color: '#4CAF50',
    fontSize: 14,
    fontWeight: '500',
    marginTop: 8,
  },
});

export default LocationPicker;