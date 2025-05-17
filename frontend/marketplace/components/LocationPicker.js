import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

// Replace with your actual Azure Maps key
const AZURE_MAPS_KEY = 'YOUR_AZURE_MAPS_KEY_HERE';

export default function LocationPicker({ value, onChange, style }) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState(value || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchSuggestions = async () => {
      if (!query || query.length < 3) {
        setSuggestions([]);
        return;
      }

      try {
        const res = await fetch(`https://atlas.microsoft.com/search/address/json?api-version=1.0&typeahead=true&countrySet=IL&language=en-US&subscription-key=${AZURE_MAPS_KEY}&query=${encodeURIComponent(query)}`);
        const data = await res.json();
        const validResults = data.results?.filter(r => r.address?.country === 'Israel') || [];
        setSuggestions(validResults);
      } catch (err) {
        console.error('Azure Maps error:', err);
        setSuggestions([]);
      }
    };

    const timeout = setTimeout(fetchSuggestions, 300); // debounce
    return () => clearTimeout(timeout);
  }, [query]);

  const handleSelect = (item) => {
    const addr = item.address || {};
    const locationData = {
      formattedAddress: item.address.freeformAddress,
      city: addr.municipality || '',
      street: addr.streetName || '',
      latitude: item.position.lat,
      longitude: item.position.lon,
      country: addr.country || 'Israel',
    };
    setSelectedLocation(locationData);
    setQuery(item.address.freeformAddress);
    setSuggestions([]);
    setError('');
    onChange(locationData);
  };

  const handleConfirm = () => {
    if (!selectedLocation) {
      setError('Please select a valid address from suggestions.');
      return;
    }
    onChange(selectedLocation);
  };

  return (
    <View style={[styles.container, style]}>
      <Text style={styles.label}>Address in Israel</Text>

      <View style={styles.inputContainer}>
        <MaterialIcons name="location-on" size={20} color="#4CAF50" />
        <TextInput
          style={styles.input}
          placeholder="Start typing city or street..."
          value={query}
          onChangeText={(text) => {
            setQuery(text);
            setSelectedLocation(null); // invalidate
          }}
          placeholderTextColor="#999"
        />
      </View>

      {suggestions.length > 0 && (
        <FlatList
          data={suggestions}
          keyExtractor={(item, idx) => item.id || idx.toString()}
          style={styles.suggestionsList}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.suggestionItem} onPress={() => handleSelect(item)}>
              <Text style={styles.suggestionText}>{item.address.freeformAddress}</Text>
            </TouchableOpacity>
          )}
        />
      )}

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <TouchableOpacity
        style={[styles.confirmButton, !selectedLocation && styles.disabledButton]}
        onPress={handleConfirm}
        disabled={!selectedLocation}
      >
        <Text style={styles.confirmButtonText}>Confirm Location</Text>
      </TouchableOpacity>

      {selectedLocation && (
        <Text style={styles.confirmationText}>
          📍 {selectedLocation.formattedAddress}
        </Text>
      )}
    </View>
  );
}

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
    borderColor: '#ddd',
    borderWidth: 1,
    borderRadius: 8,
    backgroundColor: '#f9f9f9',
    paddingHorizontal: 12,
    height: 50,
  },
  input: {
    flex: 1,
    fontSize: 16,
    marginLeft: 8,
    color: '#333',
  },
  suggestionsList: {
    backgroundColor: '#fff',
    maxHeight: 200,
    marginTop: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ccc',
  },
  suggestionItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  suggestionText: {
    fontSize: 15,
    color: '#333',
  },
  errorText: {
    color: '#f44336',
    fontSize: 14,
    marginTop: 6,
  },
  confirmButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
  confirmButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  disabledButton: {
    backgroundColor: '#ccc',
  },
  confirmationText: {
    marginTop: 10,
    fontSize: 14,
    color: '#4CAF50',
  },
});
