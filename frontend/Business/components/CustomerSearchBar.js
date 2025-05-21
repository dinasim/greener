// Business/components/CustomerSearchBar.js
import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Animated,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

export default function CustomerSearchBar({
  value = '',
  onChangeText = () => {},
  placeholder = 'Search customers...',
  autoFocus = false,
  showFilters = false,
  onFilterPress = () => {},
  style = {}
}) {
  const [isFocused, setIsFocused] = useState(false);
  
  // Animation refs
  const focusAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  
  // Handle focus
  const handleFocus = () => {
    setIsFocused(true);
    
    Animated.parallel([
      Animated.timing(focusAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: false,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1.02,
        tension: 300,
        friction: 10,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start();
  };

  // Handle blur
  const handleBlur = () => {
    setIsFocused(false);
    
    Animated.parallel([
      Animated.timing(focusAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: false,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 300,
        friction: 10,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start();
  };

  // Handle clear
  const handleClear = () => {
    onChangeText('');
    
    // Bounce animation for clear action
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start();
  };

  return (
    <Animated.View 
      style={[
        styles.container,
        {
          borderColor: focusAnim.interpolate({
            inputRange: [0, 1],
            outputRange: ['#e0e0e0', '#4CAF50'],
          }),
          borderWidth: focusAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [1, 2],
          }),
          transform: [{ scale: scaleAnim }],
        },
        style
      ]}
    >
      {/* Search Icon */}
      <Animated.View
        style={[
          styles.searchIcon,
          {
            opacity: focusAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [0.6, 1],
            }),
          }
        ]}
      >
        <MaterialIcons 
          name="search" 
          size={20} 
          color={isFocused ? '#4CAF50' : '#999'} 
        />
      </Animated.View>
      
      {/* Text Input */}
      <TextInput
        style={styles.textInput}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#999"
        onFocus={handleFocus}
        onBlur={handleBlur}
        autoFocus={autoFocus}
        returnKeyType="search"
        autoCapitalize="none"
        autoCorrect={false}
      />
      
      {/* Clear Button */}
      {value.length > 0 && (
        <Animated.View
          style={[
            styles.clearButton,
            {
              opacity: focusAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0.7, 1],
              }),
            }
          ]}
        >
          <TouchableOpacity 
            onPress={handleClear}
            style={styles.clearTouchable}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <MaterialIcons name="clear" size={18} color="#999" />
          </TouchableOpacity>
        </Animated.View>
      )}
      
      {/* Filter Button */}
      {showFilters && (
        <TouchableOpacity 
          style={styles.filterButton}
          onPress={onFilterPress}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <MaterialIcons name="filter-list" size={20} color="#999" />
        </TouchableOpacity>
      )}
      
      {/* Focus indicator */}
      {isFocused && (
        <Animated.View
          style={[
            styles.focusIndicator,
            {
              opacity: focusAnim,
              transform: [{
                scaleX: focusAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 1],
                })
              }],
            }
          ]}
        />
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    position: 'relative',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  searchIcon: {
    marginRight: 8,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    paddingVertical: 0, // Remove default padding on Android
  },
  clearButton: {
    marginLeft: 8,
  },
  clearTouchable: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterButton: {
    marginLeft: 8,
    padding: 4,
  },
  focusIndicator: {
    position: 'absolute',
    bottom: -1,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: '#4CAF50',
    borderRadius: 1,
  },
});