import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  Platform,
  Animated,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { getAzureMapsKey, geocodeAddress } from '../services/azureMapsService';

/**
 * Enhanced LocationPicker component with Azure Maps integration
 * Provides address suggestions as you type
 * 
 * @param {Object} props Component props
 * @param {Object} props.value Current location value
 * @param {Function} props.onChange Called when location changes
 * @param {Object} props.style Additional container styles
 * @param {boolean} props.required Whether location is required
 * @param {boolean} props.showConfirmButton Whether to show confirm button
 */
const LocationPicker = ({
  value,
  onChange,
  style,
  required = false,
  showConfirmButton = true,
}) => {
  // State for address input and suggestions
  const [address, setAddress] = useState(value?.formattedAddress || '');
  const [city, setCity] = useState(value?.city || '');
  const [street, setStreet] = useState(value?.street || '');
  const [houseNumber, setHouseNumber] = useState(value?.houseNumber || '');
  const [suggestions, setSuggestions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [azureMapsKey, setAzureMapsKey] = useState(null);
  const [isKeyLoading, setIsKeyLoading] = useState(true);
  const [isSuggestionsVisible, setIsSuggestionsVisible] = useState(false);
  
  // Animation values for suggestions panel
  const suggestionsHeight = useRef(new Animated.Value(0)).current;
  const suggestionsOpacity = useRef(new Animated.Value(0)).current;
  
  // Load Azure Maps key
  useEffect(() => {
    const loadAzureMapsKey = async () => {
      try {
        setIsKeyLoading(true);
        const key = await getAzureMapsKey();
        setAzureMapsKey(key);
        setIsKeyLoading(false);
      } catch (err) {
        console.error('Error loading Azure Maps key:', err);
        setError('Could not load location service');
        setIsKeyLoading(false);
      }
    };
    
    loadAzureMapsKey();
  }, []);
  
  // Update internal state when value prop changes
  useEffect(() => {
    if (value) {
      setCity(value.city || '');
      setStreet(value.street || '');
      setHouseNumber(value.houseNumber || '');
      setAddress(value.formattedAddress || '');
    }
  }, [value]);
  
  // Animate suggestions panel
  useEffect(() => {
    if (isSuggestionsVisible && suggestions.length > 0) {
      Animated.parallel([
        Animated.timing(suggestionsHeight, {
          toValue: Math.min(suggestions.length * 60, 250),
          duration: 200,
          useNativeDriver: false,
        }),
        Animated.timing(suggestionsOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: false,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(suggestionsHeight, {
          toValue: 0,
          duration: 150,
          useNativeDriver: false,
        }),
        Animated.timing(suggestionsOpacity, {
          toValue: 0,
          duration: 150,
          useNativeDriver: false,
        }),
      ]).start(() => {
        if (!isSuggestionsVisible) {
          setSuggestions([]);
        }
      });
    }
  }, [isSuggestionsVisible, suggestions.length, suggestionsHeight, suggestionsOpacity]);
  
  // Fetch address suggestions from Azure Maps
  const fetchSuggestions = async (text) => {
    if (!text || text.length < 3 || !azureMapsKey) {
      setSuggestions([]);
      setIsSuggestionsVisible(false);
      return;
    }
    
    try {
      setIsLoading(true);
      setError('');
      
      // Construct search query with Israel country filter
      const query = `${text}, Israel`;
      
      // Direct call to Azure Maps Search API
      const response = await fetch(
        `https://atlas.microsoft.com/search/address/json?` +
        `api-version=1.0&subscription-key=${azureMapsKey}` +
        `&typeahead=true&limit=7&countrySet=IL&language=en-US` +
        `&query=${encodeURIComponent(query)}`
      );
      
      if (!response.ok) {
        throw new Error(`Azure Maps API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Filter for Israel addresses only
      const validResults = data.results?.filter(
        r => r.address?.country === 'Israel' || 
             r.address?.countryCode === 'IL' ||
             r.address?.countrySubdivision === 'Israel'
      ) || [];
      
      setSuggestions(validResults);
      setIsSuggestionsVisible(validResults.length > 0);
    } catch (err) {
      console.error('Error fetching suggestions:', err);
      setError('Could not load suggestions');
      setSuggestions([]);
      setIsSuggestionsVisible(false);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Handle city input change with debounced suggestions
  const handleCityChange = (text) => {
    setCity(text);
    
    // Clear error when user starts typing
    if (error) setError('');
    
    // Debounce suggestions
    clearTimeout(handleCityChange.timer);
    handleCityChange.timer = setTimeout(() => {
      fetchSuggestions(text);
    }, 300);
  };
  
  // Handle street input change
  const handleStreetChange = (text) => {
    setStreet(text);
    
    // If we already have a city, try to get suggestions for street
    if (city) {
      clearTimeout(handleStreetChange.timer);
      handleStreetChange.timer = setTimeout(() => {
        fetchSuggestions(`${text}, ${city}`);
      }, 300);
    }
  };
  
  // Handle house number input
  const handleHouseNumberChange = (text) => {
    // Only allow numbers
    if (/^\d*$/.test(text) || text === '') {
      setHouseNumber(text);
    }
  };
  
  // Handle suggestion selection
  const handleSelectSuggestion = async (item) => {
    const addr = item.address || {};
    
    // Extract address components
    const selectedCity = addr.municipality || addr.localName || '';
    const selectedStreet = addr.streetName || '';
    const selectedHouseNumber = addr.streetNumber || '';
    
    // Update state with selected address
    setCity(selectedCity);
    setStreet(selectedStreet);
    setHouseNumber(selectedHouseNumber);
    setAddress(addr.freeformAddress || `${selectedStreet} ${selectedHouseNumber}, ${selectedCity}, Israel`);
    
    // Close suggestions
    setIsSuggestionsVisible(false);
    
    // Create location object
    const locationData = {
      formattedAddress: addr.freeformAddress || `${selectedStreet} ${selectedHouseNumber}, ${selectedCity}, Israel`,
      city: selectedCity,
      street: selectedStreet,
      houseNumber: selectedHouseNumber,
      latitude: item.position?.lat,
      longitude: item.position?.lon,
      country: 'Israel',
    };
    
    // Call onChange with the new location data
    onChange(locationData);
  };
  
  // Confirm the manually entered address 
  const handleConfirmAddress = async () => {
    if (!city) {
      setError('City is required');
      return;
    }
    
    try {
      setIsLoading(true);
      setError('');
      
      // Build address string
      const addressString = street 
        ? `${street} ${houseNumber}, ${city}, Israel` 
        : `${city}, Israel`;
        
      // Geocode the address
      const result = await geocodeAddress(addressString);
      
      if (result && result.latitude && result.longitude) {
        const locationData = {
          formattedAddress: result.formattedAddress || addressString,
          city: result.city || city,
          street: result.street || street,
          houseNumber: result.houseNumber || houseNumber,
          latitude: result.latitude,
          longitude: result.longitude,
          country: 'Israel',
        };
        
        setAddress(locationData.formattedAddress);
        onChange(locationData);
      } else {
        setError('Location could not be found');
      }
    } catch (err) {
      console.error('Error geocoding address:', err);
      setError('Failed to confirm location');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Render loading indicator while Azure Maps key is loading
  if (isKeyLoading) {
    return (
      <View style={[styles.container, style]}>
        <Text style={styles.label}>
          Location {required && <Text style={styles.requiredAsterisk}>*</Text>}
        </Text>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#4CAF50" />
          <Text style={styles.loadingText}>Loading location service...</Text>
        </View>
      </View>
    );
  }
  
  // If Azure Maps key failed to load, show error
  if (!azureMapsKey) {
    return (
      <View style={[styles.container, style]}>
        <Text style={styles.label}>
          Location {required && <Text style={styles.requiredAsterisk}>*</Text>}
        </Text>
        <View style={styles.errorContainer}>
          <MaterialIcons name="error-outline" size={24} color="#f44336" />
          <Text style={styles.errorText}>Location service unavailable</Text>
        </View>
      </View>
    );
  }
  
  return (
    <View style={[styles.container, style]}>
      <Text style={styles.label}>
        Location {required && <Text style={styles.requiredAsterisk}>*</Text>}
      </Text>
      
      {/* City Input */}
      <View style={styles.inputRow}>
        <Text style={styles.fieldLabel}>City <Text style={styles.requiredAsterisk}>*</Text></Text>
        <View style={styles.inputContainer}>
          <MaterialIcons name="location-city" size={20} color="#4CAF50" style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            value={city}
            onChangeText={handleCityChange}
            placeholder="Enter city in Israel"
            onFocus={() => {
              if (city.length >= 3) {
                fetchSuggestions(city);
              }
            }}
          />
          {isLoading && (
            <ActivityIndicator size="small" color="#4CAF50" style={styles.loadingIndicator} />
          )}
        </View>
      </View>
      
      {/* Street Input */}
      <View style={styles.inputRow}>
        <Text style={styles.fieldLabel}>Street</Text>
        <View style={styles.inputContainer}>
          <MaterialIcons name="edit-road" size={20} color="#4CAF50" style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            value={street}
            onChangeText={handleStreetChange}
            placeholder="Enter street name"
            onFocus={() => {
              if (street.length >= 3 && city) {
                fetchSuggestions(`${street}, ${city}`);
              }
            }}
          />
        </View>
      </View>
      
      {/* House Number Input */}
      <View style={styles.inputRow}>
        <Text style={styles.fieldLabel}>House Number (Optional)</Text>
        <View style={styles.inputContainer}>
          <MaterialIcons name="home" size={20} color="#4CAF50" style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            value={houseNumber}
            onChangeText={handleHouseNumberChange}
            placeholder="Enter house number"
            keyboardType="numeric"
          />
        </View>
      </View>
      
      {/* Suggestions Panel */}
      <Animated.View style={[
        styles.suggestionsContainer,
        {
          height: suggestionsHeight,
          opacity: suggestionsOpacity,
          display: isSuggestionsVisible ? 'flex' : 'none'
        }
      ]}>
        <FlatList
          data={suggestions}
          keyExtractor={(item, index) => `suggestion-${index}-${item.id || ''}`}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.suggestionItem}
              onPress={() => handleSelectSuggestion(item)}
            >
              <MaterialIcons name="place" size={20} color="#4CAF50" style={styles.suggestionIcon} />
              <View style={styles.suggestionTextContainer}>
                <Text style={styles.suggestionText} numberOfLines={1}>
                  {item.address?.freeformAddress || 'Address'}
                </Text>
                <Text style={styles.suggestionSubtext} numberOfLines={1}>
                  {item.address?.municipality}, {item.address?.country}
                </Text>
              </View>
            </TouchableOpacity>
          )}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No suggestions found</Text>
            </View>
          }
        />
      </Animated.View>
      
      {/* Error Message */}
      {error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : null}
      
      {/* Selected Location Display */}
      {address ? (
        <View style={styles.selectedLocationContainer}>
          <MaterialIcons name="check-circle" size={16} color="#4CAF50" />
          <Text style={styles.selectedLocationText} numberOfLines={2}>
            {address}
          </Text>
        </View>
      ) : null}
      
      {/* Confirm Button */}
      {showConfirmButton && (
        <TouchableOpacity
          style={[
            styles.confirmButton,
            (!city) && styles.disabledButton
          ]}
          onPress={handleConfirmAddress}
          disabled={!city || isLoading}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <MaterialIcons name="pin-drop" size={18} color="#fff" />
              <Text style={styles.confirmButtonText}>Confirm Location</Text>
            </>
          )}
        </TouchableOpacity>
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
  requiredAsterisk: {
    color: '#f44336',
    fontWeight: 'bold',
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
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    backgroundColor: '#fff3f0',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ffcdd2',
  },
  inputRow: {
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 14,
    color: '#555',
    marginBottom: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    backgroundColor: '#f9f9f9',
    paddingHorizontal: 12,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 16,
    color: '#333',
  },
  loadingIndicator: {
    marginLeft: 8,
  },
  suggestionsContainer: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    marginTop: 4,
    marginBottom: 8,
    overflow: 'hidden',
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  suggestionIcon: {
    marginRight: 12,
  },
  suggestionTextContainer: {
    flex: 1,
  },
  suggestionText: {
    fontSize: 14,
    color: '#333',
  },
  suggestionSubtext: {
    fontSize: 12,
    color: '#999',
  },
  separator: {
    height: 1,
    backgroundColor: '#f0f0f0',
    marginHorizontal: 12,
  },
  emptyContainer: {
    padding: 12,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
  },
  errorText: {
    color: '#f44336',
    fontSize: 13,
    marginTop: 4,
  },
  selectedLocationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f9f0',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  selectedLocationText: {
    flex: 1,
    fontSize: 14,
    color: '#333',
    marginLeft: 8,
  },
  confirmButton: {
    marginTop: 10,
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  confirmButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
    marginLeft: 8,
  },
  disabledButton: {
    backgroundColor: '#bdbdbd',
  },
});

export default LocationPicker;