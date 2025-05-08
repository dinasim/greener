import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';

// Import CustomSlider from the same directory
import CustomSlider from './CustomSlider';

const PriceRange = ({ minPrice = 0, maxPrice = 1000, onPriceChange }) => {
  const [range, setRange] = useState([minPrice, maxPrice]);
  
  // Update the range when props change
  useEffect(() => {
    setRange([minPrice, maxPrice]);
  }, [minPrice, maxPrice]);
  
  // Handle min price change
  const handleMinChange = (value) => {
    // Ensure min value doesn't exceed max value
    const newRange = [Math.min(value, range[1]), range[1]];
    setRange(newRange);
    if (onPriceChange) {
      onPriceChange(newRange);
    }
  };
  
  // Handle max price change
  const handleMaxChange = (value) => {
    // Ensure max value isn't less than min value
    const newRange = [range[0], Math.max(value, range[0])];
    setRange(newRange);
    if (onPriceChange) {
      onPriceChange(newRange);
    }
  };
  
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Price Range</Text>
      
      <View style={styles.rangeContainer}>
        <Text style={styles.priceLabel}>Min: ${range[0]}</Text>
        <Text style={styles.priceLabel}>Max: ${range[1]}</Text>
      </View>
      
      <View style={styles.sliderContainer}>
        <Text style={styles.sliderLabel}>Minimum Price</Text>
        <CustomSlider
          style={styles.slider}
          minimumValue={0}
          maximumValue={1000}
          step={10}
          value={range[0]}
          onValueChange={handleMinChange}
          minimumTrackTintColor="#81c784"
          maximumTrackTintColor="#ccc"
          thumbTintColor="#2e7d32"
        />
      </View>
      
      <View style={styles.sliderContainer}>
        <Text style={styles.sliderLabel}>Maximum Price</Text>
        <CustomSlider
          style={styles.slider}
          minimumValue={0}
          maximumValue={1000}
          step={10}
          value={range[1]}
          onValueChange={handleMaxChange}
          minimumTrackTintColor="#81c784"
          maximumTrackTintColor="#ccc"
          thumbTintColor="#2e7d32"
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 15,
    backgroundColor: 'white',
    borderRadius: 8,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#2e7d32',
  },
  rangeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  priceLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  sliderContainer: {
    marginBottom: 15,
  },
  sliderLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  slider: {
    width: '100%',
    height: 40,
  },
});

export default PriceRange;