import React, { useState } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Text,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import SpeechToTextComponent from './SpeechToTextComponent';

/**
 * Enhanced SearchBar component that uses SpeechToTextComponent for voice input
 * 
 * @param {Object} props Component props
 * @param {string} props.value Current search text value
 * @param {Function} props.onChangeText Callback when text changes
 * @param {Function} props.onSubmit Callback when search is submitted
 * @param {Object} props.style Additional styles for the container
 */
const SearchBar = ({ value, onChangeText, onSubmit, style }) => {
  // Handle clearing the search input
  const handleClear = () => {
    onChangeText?.('');
  };

  // Handle search form submission
  const handleSubmit = () => {
    onSubmit?.();
  };

  // Handle speech transcription results
  const handleTranscriptionResult = (transcribedText) => {
    if (transcribedText) {
      // Update the search text with transcription result
      onChangeText?.(transcribedText);
      
      // Automatically submit after a short delay to give user a chance to see what was transcribed
      setTimeout(() => {
        onSubmit?.();
      }, 500);
    }
  };

  return (
    <View style={[styles.container, style]}>
      <View style={styles.searchContainer}>
        {/* Search icon */}
        <MaterialIcons name="search" size={20} color="#999" style={styles.searchIcon} />

        {/* Search input */}
        <TextInput
          style={styles.input}
          placeholder="Search plants..."
          placeholderTextColor="#999"
          value={value}
          onChangeText={onChangeText}
          onSubmitEditing={handleSubmit}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />

        {/* Clear button (visible when there's text) */}
        {value ? (
          <TouchableOpacity onPress={handleClear} style={styles.clearButton}>
            <MaterialIcons name="clear" size={20} color="#999" />
          </TouchableOpacity>
        ) : null}

        {/* Voice search button - now using SpeechToTextComponent */}
        <SpeechToTextComponent 
          onTranscriptionResult={handleTranscriptionResult}
          style={styles.micButton}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    alignItems: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    paddingHorizontal: 12,
    width: '90%',
  },
  searchIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    height: 40,
    fontSize: 16,
    color: '#333',
  },
  clearButton: {
    padding: 6,
    marginRight: 4,
  },
  micButton: {
    padding: 6,
  },
});

export default SearchBar;