// components/SearchBar.js - Enhanced with Business Integration
import React, { useState } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Text,
  Platform,
} from 'react-native';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import SpeechToTextComponent from './SpeechToTextComponent';

/**
 * Enhanced SearchBar component with business-aware search capabilities
 * Provides different search hints based on current filter context
 * 
 * @param {Object} props Component props
 * @param {string} props.value Current search text value
 * @param {Function} props.onChangeText Callback when text changes
 * @param {Function} props.onSubmit Callback when search is submitted
 * @param {string} props.sellerType Current seller type filter ('all', 'individual', 'business')
 * @param {Object} props.style Additional styles for the container
 * @param {string} props.placeholder Custom placeholder text
 */
const SearchBar = ({ 
  value, 
  onChangeText, 
  onSubmit, 
  sellerType = 'all',
  style,
  placeholder
}) => {
  // Generate context-aware placeholder text
  const getPlaceholder = () => {
    if (placeholder) return placeholder;
    
    switch (sellerType) {
      case 'business':
        return 'Search business plants, tools, accessories...';
      case 'individual':
        return 'Search individual plant listings...';
      default:
        return 'Search plants, accessories, tools...';
    }
  };

  // Get search suggestions based on current context
  const getSearchSuggestions = () => {
    const commonSuggestions = ['Monstera', 'Snake Plant', 'Pothos', 'Succulent'];
    const businessSuggestions = ['Plant Tools', 'Fertilizer', 'Pots', 'Seeds'];
    const individualSuggestions = ['Cutting', 'Houseplant', 'Outdoor Plant'];

    switch (sellerType) {
      case 'business':
        return [...commonSuggestions, ...businessSuggestions];
      case 'individual':
        return [...commonSuggestions, ...individualSuggestions];
      default:
        return [...commonSuggestions, ...businessSuggestions, ...individualSuggestions];
    }
  };

  // Handle clearing the search input
  const handleClear = () => {
    onChangeText?.('');
  };

  // Handle search form submission
  const handleSubmit = () => {
    onSubmit?.();
  };

  // Handle quick search suggestions
  const handleQuickSearch = (searchTerm) => {
    onChangeText?.(searchTerm);
    setTimeout(() => {
      onSubmit?.();
    }, 100);
  };

  // Handle speech transcription results with business context
  const handleTranscriptionResult = (transcribedText) => {
    if (transcribedText) {
      // Add business context to voice search if needed
      let contextualText = transcribedText;
      
      // If user is searching in business mode and says generic terms, 
      // we can keep it as is since businesses sell various items
      onChangeText?.(contextualText);
      
      // Automatically submit after a short delay
      setTimeout(() => {
        onSubmit?.();
      }, 500);
    }
  };

  // Get icon for current search context
  const getContextIcon = () => {
    switch (sellerType) {
      case 'business':
        return <MaterialCommunityIcons name="store" size={16} color="#FF9800" />;
      case 'individual':
        return <MaterialCommunityIcons name="account" size={16} color="#2196F3" />;
      default:
        return <MaterialIcons name="search" size={16} color="#4CAF50" />;
    }
  };

  // Show quick suggestions only when search is empty and there's focus
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestions = getSearchSuggestions().slice(0, 4); // Show top 4

  return (
    <View style={[styles.container, style]}>
      <View style={styles.searchContainer}>
        {/* Context icon */}
        <View style={styles.contextIcon}>
          {getContextIcon()}
        </View>

        {/* Search input */}
        <TextInput
          style={styles.input}
          placeholder={getPlaceholder()}
          placeholderTextColor="#999"
          value={value}
          onChangeText={onChangeText}
          onSubmitEditing={handleSubmit}
          onFocus={() => setShowSuggestions(!value)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />

        {/* Clear button (visible when there's text) */}
        {value ? (
          <TouchableOpacity onPress={handleClear} style={styles.clearButton}>
            <MaterialIcons name="clear" size={20} color="#999" />
          </TouchableOpacity>
        ) : null}

        {/* Voice search button */}
        <SpeechToTextComponent 
          onTranscriptionResult={handleTranscriptionResult}
          style={styles.micButton}
        />
      </View>

      {/* Search context indicator */}
      {sellerType !== 'all' && (
        <View style={styles.contextIndicator}>
          <Text style={styles.contextText}>
            Searching in: {sellerType === 'business' ? 'Business sellers' : 'Individual sellers'}
          </Text>
        </View>
      )}

      {/* Quick search suggestions */}
      {showSuggestions && !value && (
        <View style={styles.suggestionsContainer}>
          <Text style={styles.suggestionsTitle}>Popular searches:</Text>
          <View style={styles.suggestionsList}>
            {suggestions.map((suggestion, index) => (
              <TouchableOpacity
                key={index}
                style={styles.suggestionChip}
                onPress={() => handleQuickSearch(suggestion)}
              >
                <Text style={styles.suggestionText}>{suggestion}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    paddingHorizontal: 8,
    marginHorizontal: 4,
    marginTop: 4,
    marginBottom: 2,
  },
  contextIcon: {
    marginRight: 4,
    width: 18,
    alignItems: 'center',
  },
  input: {
    flex: 1,
    height: 32,
    fontSize: 14,
    color: '#333',
  },
  clearButton: {
    padding: 6,
    marginRight: 4,
  },
  micButton: {
    padding: 6,
  },
  contextIndicator: {
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  contextText: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  suggestionsContainer: {
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  suggestionsTitle: {
    fontSize: 12,
    color: '#888',
    marginBottom: 8,
  },
  suggestionsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  suggestionChip: {
    backgroundColor: '#f0f9f0',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#e0f0e0',
  },
  suggestionText: {
    fontSize: 13,
    color: '#4CAF50',
    fontWeight: '500',
  },
});

export default SearchBar;