// components/MapSearchBox.js
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { geocodeAddress } from '../services/marketplaceApi';

/**
 * MapSearchBox component for searching locations on the map
 * 
 * @param {Object} props Component props
 * @param {Function} props.onLocationSelect Callback when a location is selected
 * @param {Object} props.style Additional styles for the container
 */
const MapSearchBox = ({ onLocationSelect, style }) => {
  const [expanded, setExpanded] = useState(false);
  const [city, setCity] = useState('');
  const [street, setStreet] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Animation value for expanding/collapsing
  const [animation] = useState(new Animated.Value(0));

  // Toggle expanded state with animation
  const toggleExpanded = () => {
    const toValue = expanded ? 0 : 1;
    Animated.timing(animation, {
      toValue,
      duration: 200,
      useNativeDriver: false,
    }).start();
    setExpanded(!expanded);
    
    // Reset fields when collapsing
    if (expanded) {
      setCity('');
      setStreet('');
      setError('');
    }
  };

  // Calculate animated width for the search box
  const boxWidth = animation.interpolate({
    inputRange: [0, 1],
    outputRange: ['50px', '280px'],
  });

  // Handle search submission
  const handleSearch = async () => {
    if (!city) {
      setError('Please enter a city');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // Combine city and street for geocoding
      const address = street ? `${street}, ${city}` : city;
      
      const result = await geocodeAddress(address);
      
      if (result && result.latitude && result.longitude) {
        onLocationSelect({
          latitude: result.latitude,
          longitude: result.longitude,
          address: result.formattedAddress || address,
          city: result.city || city,
        });
        
        // Collapse the search box after successful search
        toggleExpanded();
      } else {
        setError('Location not found');
      }
    } catch (err) {
      console.error('Geocoding error:', err);
      setError('Failed to search location');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Animated.View
      style={[
        styles.container,
        { width: boxWidth },
        style,
      ]}
    >
      {expanded ? (
        <View style={styles.expandedContent}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={toggleExpanded}
            accessibilityLabel="Close search"
          >
            <MaterialIcons name="arrow-back" size={24} color="#666" />
          </TouchableOpacity>
          
          <View style={styles.inputsContainer}>
            <Text style={styles.label}>City:</Text>
            <TextInput
              style={styles.input}
              value={city}
              onChangeText={setCity}
              placeholder="Enter city"
              placeholderTextColor="#999"
              autoFocus={Platform.OS !== 'web'}
            />
            
            <Text style={styles.label}>Street:</Text>
            <TextInput
              style={styles.input}
              value={street}
              onChangeText={setStreet}
              placeholder="Enter street (optional)"
              placeholderTextColor="#999"
            />
            
            {error ? (
              <Text style={styles.errorText}>{error}</Text>
            ) : null}
            
            <TouchableOpacity
              style={styles.searchButton}
              onPress={handleSearch}
              disabled={isLoading}
              accessibilityLabel="Search location"
            >
              {isLoading ? (
                <Text style={styles.searchButtonText}>Searching...</Text>
              ) : (
                <Text style={styles.searchButtonText}>Confirm</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <TouchableOpacity
          style={styles.iconButton}
          onPress={toggleExpanded}
          accessibilityLabel="Search location"
        >
          <MaterialIcons name="search" size={24} color="#fff" />
        </TouchableOpacity>
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: '#fff',
    borderRadius: 8,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    zIndex: 10,
    overflow: 'hidden',
  },
  iconButton: {
    width: 50,
    height: 50,
    borderRadius: 8,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
  },
  expandedContent: {
    padding: 12,
    width: '100%',
  },
  backButton: {
    alignSelf: 'flex-start',
    padding: 4,
    marginBottom: 8,
  },
  inputsContainer: {
    width: '100%',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  input: {
    height: 40,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    paddingHorizontal: 12,
    marginBottom: 12,
    backgroundColor: '#f9f9f9',
    color: '#333',
  },
  errorText: {
    color: '#f44336',
    fontSize: 12,
    marginBottom: 8,
    textAlign: 'center',
  },
  searchButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 6,
    padding: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  searchButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
});

export default MapSearchBox;