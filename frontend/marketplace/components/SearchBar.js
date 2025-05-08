import React from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

/**
 * SearchBar component for the marketplace
 * @param {Object} props - Component props
 * @param {string} props.value - Current search query
 * @param {Function} props.onChangeText - Function called when text changes
 * @param {Function} props.onSubmit - Function called when search is submitted (optional)
 * @param {Object} props.style - Additional style for the container (optional)
 */
const SearchBar = ({ value, onChangeText, onSubmit, style }) => {
  const handleClear = () => {
    if (onChangeText) {
      onChangeText('');
    }
  };

  const handleSubmit = () => {
    if (onSubmit) {
      onSubmit();
    }
  };

  return (
    <View style={[styles.container, style]}>
      <View style={styles.searchContainer}>
        <MaterialIcons 
          name="search" 
          size={24} 
          color="#999" 
          style={styles.searchIcon} 
        />
        
        <TextInput
          style={styles.input}
          placeholder="Search plants..."
          placeholderTextColor="#999"
          value={value}
          onChangeText={onChangeText}
          onSubmitEditing={handleSubmit}
          returnKeyType="search"
          clearButtonMode="while-editing" // iOS only
        />
        
        {value ? (
          <TouchableOpacity 
            onPress={handleClear} 
            style={styles.clearButton}
          >
            <MaterialIcons name="clear" size={20} color="#999" />
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    // Center the search bar container on web
    ...Platform.select({
      web: {
        display: 'flex',
        alignItems: 'center',
      },
    }),
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    paddingHorizontal: 8,
    width: '50%', // 50% of the screen width
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 1,
      },
      android: {
        elevation: 1,
      },
      web: {
        boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
      },
    }),
  },
  searchIcon: {
    marginRight: 8,
    marginLeft: 4,
  },
  input: {
    flex: 1,
    height: 40,
    fontSize: 16,
    color: '#333',
    ...Platform.select({
      web: {
        outlineStyle: 'none',
      },
    }),
  },
  clearButton: {
    padding: 8,
  },
});

export default SearchBar;
