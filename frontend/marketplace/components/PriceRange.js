import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, Platform } from 'react-native';
import Slider from '@react-native-community/slider';
import { MaterialIcons } from '@expo/vector-icons';

/**
 * PriceRange component with two sliders and draggable small thumbs
 */
const PriceRange = ({
  minValue = 0,
  maxValue = 1000,
  initialMin = 0,
  initialMax = 1000,
  onPriceChange,
  style
}) => {
  const [minPrice, setMinPrice] = useState(initialMin);
  const [maxPrice, setMaxPrice] = useState(initialMax);
  const [minInput, setMinInput] = useState(initialMin.toString());
  const [maxInput, setMaxInput] = useState(initialMax.toString());

  // Handle changes in min price from slider
  const handleMinChange = (value) => {
    const newMinPrice = Math.min(value, maxPrice - 5);
    setMinPrice(newMinPrice);
    setMinInput(newMinPrice.toFixed(0));
    if (onPriceChange) onPriceChange([newMinPrice, maxPrice]);
  };

  // Handle changes in max price from slider
  const handleMaxChange = (value) => {
    const newMaxPrice = Math.max(value, minPrice + 5);
    setMaxPrice(newMaxPrice);
    setMaxInput(newMaxPrice.toFixed(0));
    if (onPriceChange) onPriceChange([minPrice, newMaxPrice]);
  };

  // Handle changes from text inputs
  const handleMinInputChange = (text) => {
    setMinInput(text);
    const value = parseInt(text, 10);
    if (!isNaN(value) && value >= minValue && value <= maxPrice) {
      setMinPrice(value);
      if (onPriceChange) onPriceChange([value, maxPrice]);
    }
  };

  const handleMaxInputChange = (text) => {
    setMaxInput(text);
    const value = parseInt(text, 10);
    if (!isNaN(value) && value <= maxValue && value >= minPrice) {
      setMaxPrice(value);
      if (onPriceChange) onPriceChange([minPrice, value]);
    }
  };

  // Handle blur events (when user finishes editing)
  const handleMinInputBlur = () => {
    const value = parseInt(minInput, 10);
    
    if (isNaN(value)) {
      // If not a number, reset to min value
      setMinInput(minValue.toString());
      setMinPrice(minValue);
      if (onPriceChange) onPriceChange([minValue, maxPrice]);
    } else if (value < minValue) {
      // If less than minimum allowed, set to minimum
      setMinInput(minValue.toString());
      setMinPrice(minValue);
      if (onPriceChange) onPriceChange([minValue, maxPrice]);
    } else if (value > maxPrice - 5) {
      // If greater than max price - 5, set to max price - 5
      const newMinPrice = maxPrice - 5;
      setMinInput(newMinPrice.toString());
      setMinPrice(newMinPrice);
      if (onPriceChange) onPriceChange([newMinPrice, maxPrice]);
    } else {
      // Otherwise, keep the value and ensure it's formatted properly
      setMinInput(value.toString());
      setMinPrice(value);
      if (onPriceChange) onPriceChange([value, maxPrice]);
    }
  };
  
  const handleMaxInputBlur = () => {
    const value = parseInt(maxInput, 10);
    
    if (isNaN(value)) {
      // If not a number, reset to max value
      setMaxInput(maxValue.toString());
      setMaxPrice(maxValue);
      if (onPriceChange) onPriceChange([minPrice, maxValue]);
    } else if (value > maxValue) {
      // If greater than maximum allowed, set to maximum
      setMaxInput(maxValue.toString());
      setMaxPrice(maxValue);
      if (onPriceChange) onPriceChange([minPrice, maxValue]);
    } else if (value < minPrice + 5) {
      // If less than min price + 5, set to min price + 5
      const newMaxPrice = minPrice + 5;
      setMaxInput(newMaxPrice.toString());
      setMaxPrice(newMaxPrice);
      if (onPriceChange) onPriceChange([minPrice, newMaxPrice]);
    } else {
      // Otherwise, keep the value and ensure it's formatted properly
      setMaxInput(value.toString());
      setMaxPrice(value);
      if (onPriceChange) onPriceChange([minPrice, value]);
    }
  };

  return (
    <View style={[styles.container, style]}>
      {/* Header with title */}
      <View style={styles.headerRow}>
        <MaterialIcons name="attach-money" size={14} color="#4CAF50" />
        <Text style={styles.title}>Price Range</Text>
      </View>
      
      {/* Min/Max inputs */}
      <View style={styles.inputsRow}>
        <View style={styles.inputColumn}>
          <Text style={styles.inputLabel}>Min</Text>
          <TextInput
            style={styles.input}
            value={minInput}
            onChangeText={handleMinInputChange}
            onBlur={handleMinInputBlur}
            keyboardType="numeric"
            maxLength={5}
            selectTextOnFocus
          />
        </View>
        
        <Text style={styles.separator}>-</Text>
        
        <View style={styles.inputColumn}>
          <Text style={styles.inputLabel}>Max</Text>
          <TextInput
            style={styles.input}
            value={maxInput}
            onChangeText={handleMaxInputChange}
            onBlur={handleMaxInputBlur}
            keyboardType="numeric"
            maxLength={5}
            selectTextOnFocus
          />
        </View>
      </View>
      
      {/* Two sliders with small thumbs but maintaining drag functionality */}
      <View style={styles.slidersContainer}>
        {/* Min Price Slider */}
        <View style={styles.sliderContainer}>
          <Slider
            value={minPrice}
            minimumValue={minValue}
            maximumValue={maxValue}
            onValueChange={handleMinChange}
            minimumTrackTintColor="#cce7cc"
            maximumTrackTintColor="#4CAF50"
            thumbTintColor="#4CAF50"
            style={styles.slider}
            step={5}
            // These props will be used if platform supports them
            thumbSize={8}
            thumbStyle={{
              width: 8,
              height: 8,
              borderRadius: 4,
            }}
            trackHeight={3}
          />
        </View>
        
        {/* Max Price Slider */}
        <View style={styles.sliderContainer}>
          <Slider
            value={maxPrice}
            minimumValue={minPrice + 5}
            maximumValue={maxValue}
            onValueChange={handleMaxChange}
            minimumTrackTintColor="#4CAF50"
            maximumTrackTintColor="#e0e0e0"
            thumbTintColor="#4CAF50"
            style={styles.slider}
            step={5}
            // These props will be used if platform supports them
            thumbSize={8}
            thumbStyle={{
              width: 8,
              height: 8,
              borderRadius: 4,
            }}
            trackHeight={3}
          />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: 200, // Fixed width to match web version
    backgroundColor: '#fff',
    padding: 8,
    alignSelf: 'center', // Center in parent
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4CAF50',
    marginLeft: 4,
  },
  inputsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  inputColumn: {
    width: 60, // Width of text inputs on web
    alignItems: 'center',
  },
  inputLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
    textAlign: 'center',
  },
  input: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 3,
    fontSize: 12,
    padding: 4,
    height: 28,
    backgroundColor: '#f9f9f9',
    textAlign: 'center',
  },
  separator: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#666',
    marginHorizontal: 8,
  },
  slidersContainer: {
    marginBottom: 4,
  },
  sliderContainer: {
    height: 8, // Even more compact height
    justifyContent: 'center',
    marginVertical: 2,
  },
  slider: {
    width: '100%',
    height: 8, // Very compact slider
    // Platform-specific styles
    ...Platform.select({
      ios: {
        transform: [{ scaleY: 0.7 }] // Make the slider smaller on iOS
      },
      android: {
        // Android-specific adjustments if needed
      }
    })
  },
});

export default PriceRange;