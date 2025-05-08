import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import Slider from '@react-native-community/slider';

/**
 * Price range component for filtering plants based on price
 * @param {Object} props - Component props
 * @param {number} props.minValue - Minimum possible value for the price
 * @param {number} props.maxValue - Maximum possible value for the price
 * @param {number} props.initialMin - Initial minimum value for the price
 * @param {number} props.initialMax - Initial maximum value for the price
 * @param {Function} props.onPriceChange - Function to call when price values change
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

  // Handle changes in min price
  const handleMinChange = (value) => {
    const newMinPrice = Math.min(value, maxPrice);
    setMinPrice(newMinPrice);
    if (onPriceChange) onPriceChange([newMinPrice, maxPrice]);
  };

  // Handle changes in max price
  const handleMaxChange = (value) => {
    const newMaxPrice = Math.max(value, minPrice);
    setMaxPrice(newMaxPrice);
    if (onPriceChange) onPriceChange([minPrice, newMaxPrice]);
  };

  return (
    <View style={[styles.container, style]}>
      <Text style={styles.title}>Price Range</Text>
      <View style={styles.rangeRow}>
        <Text style={styles.priceValue}>${minPrice.toFixed(0)}</Text>
        <Text style={styles.priceValue}>${maxPrice.toFixed(0)}</Text>
      </View>
      <Slider
        value={minPrice}
        minimumValue={minValue}
        maximumValue={maxValue}
        onValueChange={handleMinChange}
        style={styles.slider}
      />
      <Slider
        value={maxPrice}
        minimumValue={minValue}
        maximumValue={maxValue}
        onValueChange={handleMaxChange}
        style={styles.slider}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '30%', // Set to 80% to occupy less space
    marginBottom: 16,
    padding: 10,
    borderWidth: 1,
    borderRadius: 10,
    backgroundColor: '#fff',
    alignSelf: 'center', // Center it horizontally
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#4CAF50',
    marginBottom: 12,
  },
  priceValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4CAF50',
  },
  slider: {
    width: '100%',
    height: 40,
    marginTop: 8,
  },
  rangeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
});

export default PriceRange;
