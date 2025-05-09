import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput } from 'react-native';
import Slider from '@react-native-community/slider';
import { MaterialIcons } from '@expo/vector-icons';

/**
 * Price range component that matches the web layout
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
    if (isNaN(value) || value < minValue) {
      setMinInput(minValue.toString());
      setMinPrice(minValue);
      if (onPriceChange) onPriceChange([minValue, maxPrice]);
    } else if (value > maxPrice) {
      setMinInput(maxPrice.toString());
      setMinPrice(maxPrice);
      if (onPriceChange) onPriceChange([maxPrice, maxPrice]);
    }
  };

  const handleMaxInputBlur = () => {
    const value = parseInt(maxInput, 10);
    if (isNaN(value) || value > maxValue) {
      setMaxInput(maxValue.toString());
      setMaxPrice(maxValue);
      if (onPriceChange) onPriceChange([minPrice, maxValue]);
    } else if (value < minPrice) {
      setMaxInput(minPrice.toString());
      setMaxPrice(minPrice);
      if (onPriceChange) onPriceChange([minPrice, minPrice]);
    }
  };

  return (
    <View style={[styles.container, style]}>
      <View style={styles.headerRow}>
        <MaterialIcons name="attach-money" size={18} color="#4CAF50" />
        <Text style={styles.title}>Price Range</Text>
      </View>
      
      <View style={styles.inputContainer}>
        <View style={styles.inputWrapper}>
          <Text style={styles.inputLabel}>Min</Text>
          <View style={styles.inputBox}>
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
        </View>
        
        <Text style={styles.separator}>-</Text>
        
        <View style={styles.inputWrapper}>
          <Text style={styles.inputLabel}>Max</Text>
          <View style={styles.inputBox}>
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
      </View>
      
      {/* Min Price Slider */}
      <View style={styles.sliderContainer}>
        <Slider
          value={minPrice}
          minimumValue={minValue}
          maximumValue={maxValue}
          onValueChange={handleMinChange}
          style={styles.slider}
          minimumTrackTintColor="#cce7cc"
          maximumTrackTintColor="#e0e0e0"
          thumbTintColor="#4CAF50"
          step={5}
        />
      </View>
      
      {/* Max Price Slider */}
      <View style={styles.sliderContainer}>
        <Slider
          value={maxPrice}
          minimumValue={minPrice + 5} // Ensure max price can't be less than min price
          maximumValue={maxValue}
          onValueChange={handleMaxChange}
          style={styles.slider}
          minimumTrackTintColor="#cce7cc"
          maximumTrackTintColor="#e0e0e0"
          thumbTintColor="#4CAF50"
          step={5}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '45%', // Reduced width to make it more compact
    backgroundColor: '#fff',
    padding: 8,
    alignItems: 'center', // Center everything horizontally
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center', // Center the header text
    marginBottom: 8,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4CAF50',
    marginLeft: 6,
    textAlign: 'center', // Ensure the text is centered
  },
  inputContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    width: '80%', // Use 80% of the container's width for inputs
  },
  inputWrapper: {
    flex: 1,
    width: '40%', // Adjust width of each input box
  },
  inputLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 4,
    paddingHorizontal: 8,
    height: 36,
    backgroundColor: '#f9f9f9',
  },
  input: {
    flex: 1,
    fontSize: 14,
    padding: 0,
    color: '#333',
  },
  separator: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#666',
    marginHorizontal: 8,
  },
  sliderContainer: {
    width: '80%', // Match slider width with inputs
    marginTop: 8,
  },
  slider: {
    width: '100%',
    height: 20,    // Reduced height for proportional sizing
  },
});

export default PriceRange;
