// components/MapSearchBox.js
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Platform,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { geocodeAddress } from '../services/azureMapsService';

/**
 * Enhanced MapSearchBox component for searching locations on the map
 * 
 * @param {Object} props Component props
 * @param {Function} props.onLocationSelect Callback when a location is selected
 * @param {Object} props.style Additional styles for the container
 * @param {string} props.azureMapsKey Azure Maps API key
 */
const MapSearchBox = ({ onLocationSelect, style, azureMapsKey }) => {
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Animation value for expanding/collapsing
  const animation = useRef(new Animated.Value(0)).current;
  const inputRef = useRef(null);

  // Fetch address suggestions
  useEffect(() => {
    if (!query || query.length < 3 || !expanded || !azureMapsKey) {
      setSuggestions([]);
      return;
    }

    const searchAddress = async () => {
      try {
        setIsLoading(true);
        setError('');
        
        // Ensure query is limited to Israel
        const searchQuery = query.toLowerCase().includes('israel') ? query : `${query}, Israel`;
        
        // Use Azure Maps Search API
        const response = await fetch(
          `https://atlas.microsoft.com/search/address/json?` +
          `api-version=1.0&subscription-key=${azureMapsKey}` +
          `&typeahead=true&limit=5&countrySet=IL&language=en-US` +
          `&query=${encodeURIComponent(searchQuery)}`
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
      } catch (err) {
        console.error('Error fetching address suggestions:', err);
        setError('Failed to get suggestions');
        setSuggestions([]);
      } finally {
        setIsLoading(false);
      }
    };
    
    // Debounce search
    const timer = setTimeout(searchAddress, 300);
    return () => clearTimeout(timer);
  }, [query, expanded, azureMapsKey]);

  // Toggle expanded state with animation
  const toggleExpanded = () => {
    const toValue = expanded ? 0 : 1;
    setExpanded(!expanded);
    
    Animated.timing(animation, {
      toValue,
      duration: 200,
      useNativeDriver: false,
    }).start(() => {
      if (!expanded) {
        // Focus input when expanding
        if (inputRef.current) {
          inputRef.current.focus();
        }
      } else {
        // Clear text when collapsing
        setQuery('');
      }
    });
  };

  // Calculate animated width for the search box
  const boxWidth = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [50, 280],
  });

  // Handle suggestion selection
  const handleSelectSuggestion = (item) => {
    if (!item.position?.lat || !item.position?.lon) {
      setError('Location coordinates not available');
      return;
    }
    
    const location = {
      latitude: item.position.lat,
      longitude: item.position.lon,
      address: item.address?.freeformAddress || 'Selected location',
      city: item.address?.municipality || 'Unknown city',
      formattedAddress: item.address?.freeformAddress || 'Selected location',
      country: 'Israel',
    };
    
    // Call the callback with location data
    onLocationSelect(location);
    
    // Collapse the search box
    toggleExpanded();
  };

  // Handle manual search submission
  const handleSearch = async () => {
    if (!query.trim()) {
      setError('Please enter a location');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // Ensure query is for Israel
      const searchQuery = query.toLowerCase().includes('israel') ? query : `${query}, Israel`;
      
      // Geocode the address
      const result = await geocodeAddress(searchQuery);
      
      if (result && result.latitude && result.longitude) {
        const location = {
          latitude: result.latitude,
          longitude: result.longitude,
          address: result.formattedAddress || searchQuery,
          city: result.city || 'Unknown city',
          formattedAddress: result.formattedAddress || searchQuery,
          country: 'Israel',
        };
        
        // Call the callback with location data
        onLocationSelect(location);
        
        // Collapse the search box
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
          
          <View style={styles.searchInputContainer}>
            <MaterialIcons name="search" size={20} color="#4CAF50" style={styles.searchIcon} />
            <TextInput
              ref={inputRef}
              style={styles.searchInput}
              value={query}
              onChangeText={setQuery}
              placeholder="Search city or address in Israel"
              placeholderTextColor="#999"
              autoFocus={Platform.OS !== 'web'}
              onSubmitEditing={handleSearch}
            />
            {query ? (
              <TouchableOpacity onPress={() => setQuery('')} style={styles.clearButton}>
                <MaterialIcons name="close" size={20} color="#999" />
              </TouchableOpacity>
            ) : null}
          </View>
          
          {error ? (
            <Text style={styles.errorText}>{error}</Text>
          ) : null}
          
          {/* Suggestions list */}
          {suggestions.length > 0 ? (
            <FlatList
              data={suggestions}
              keyExtractor={(item, index) => `suggestion-${index}-${item.id || ''}`}
              style={styles.suggestionsList}
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
            />
          ) : !isLoading && query.length >= 3 ? (
            <Text style={styles.noResultsText}>No results found</Text>
          ) : null}
          
          {isLoading ? (
            <ActivityIndicator 
              size="small" 
              color="#4CAF50" 
              style={styles.loadingIndicator} 
            />
          ) : null}
          
          <TouchableOpacity
            style={[
              styles.searchButton,
              (!query.trim() || isLoading) && styles.disabledButton
            ]}
            onPress={handleSearch}
            disabled={!query.trim() || isLoading}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.searchButtonText}>Search</Text>
            )}
          </TouchableOpacity>
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
    elevation: 8, // Increased elevation
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    zIndex: 100, // High z-index but lower than RadiusControl
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
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    paddingHorizontal: 8,
    backgroundColor: '#f9f9f9',
    height: 40,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  clearButton: {
    padding: 4,
  },
  errorText: {
    color: '#f44336',
    fontSize: 12,
    marginTop: 4,
    marginBottom: 4,
  },
  suggestionsList: {
    maxHeight: 180,
    marginTop: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 6,
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
  noResultsText: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 8,
  },
  loadingIndicator: {
    marginTop: 8,
    marginBottom: 8,
    alignSelf: 'center',
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
  disabledButton: {
    backgroundColor: '#bdbdbd',
  },
});

export default MapSearchBox;