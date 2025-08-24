// components/SearchBar.js - Enhanced with Business Integration and Recording State Management
import React, { useState, useRef } from 'react';
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
 * @param {Function} props.onRecordingStateChange Callback when recording state changes
 * @param {string} props.language Speech recognition language, e.g., 'en-US' or 'he-IL'
 */
const SearchBar = ({ 
  value, 
  onChangeText, 
  onSubmit, 
  sellerType = 'all',
  style,
  placeholder,
  onRecordingStateChange,
  language = 'en-US', // CHANGED: allow passing language down to mic
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  
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

  // CHANGED: only auto-submit when meta?.isFinal is true; still update text on partials
  const handleTranscriptionResult = (transcribedText, meta) => {
    if (!transcribedText) return;
    onChangeText?.(transcribedText);
    if (meta?.isFinal) {
      setTimeout(() => onSubmit?.(), 200);
    }
  };

  // Handle recording state changes
  const handleRecordingStateChange = (recordingState) => {
    setIsRecording(recordingState);
    onRecordingStateChange?.(recordingState);
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
          onFocus={() => setShowSuggestions(!value && !isRecording)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
          returnKeyType="search"
          clearButtonMode="while-editing"
          editable={!isRecording} // Disable input while recording
        />

        {/* Clear button (visible when there's text) */}
        {value && !isRecording ? (
          <TouchableOpacity onPress={handleClear} style={styles.clearButton}>
            <MaterialIcons name="clear" size={20} color="#999" />
          </TouchableOpacity>
        ) : null}

        {/* Voice search button (Azure SDK) */}
        <SpeechToTextComponent 
          onTranscriptionResult={handleTranscriptionResult}
          onRecordingStateChange={handleRecordingStateChange}
          style={styles.micButton}
          language={language} // CHANGED: forward language to mic
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
      {showSuggestions && !value && !isRecording && (
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
    borderBottomWidth: 0,
    borderBottomColor: '#eee',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
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
    fontSize: 11,
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
