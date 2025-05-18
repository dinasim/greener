// frontend/components/PriceRange.js
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput } from 'react-native';
import Slider from '@react-native-community/slider';

const PriceRange = ({ 
  initialMin = 0, 
  initialMax = 1000, 
  onPriceChange, 
  style,
  hideTitle = false,
  max = 1000
}) => {
  const [minValue, setMinValue] = useState(initialMin !== undefined ? initialMin : 0);
  const [maxValue, setMaxValue] = useState(initialMax !== undefined ? initialMax : max);
  
  // Update local state when props change - with safety checks
  useEffect(() => {
    const safeMin = initialMin !== undefined && !isNaN(initialMin) ? Number(initialMin) : 0;
    const safeMax = initialMax !== undefined && !isNaN(initialMax) ? Number(initialMax) : max;
    
    setMinValue(safeMin);
    setMaxValue(safeMax);
  }, [initialMin, initialMax, max]);
  
  // Handle min input change
  const handleMinChange = (text) => {
    // Remove non-numeric characters
    text = text.replace(/[^0-9]/g, '');
    
    let value = parseInt(text);
    
    if (isNaN(value)) {
      value = 0;
    }
    
    // Ensure min is not greater than max
    value = Math.min(value, maxValue);
    
    setMinValue(value);
    
    if (onPriceChange) {
      onPriceChange([value, maxValue]);
    }
  };
  
  // Handle max input change
  const handleMaxChange = (text) => {
    // Remove non-numeric characters
    text = text.replace(/[^0-9]/g, '');
    
    let value = parseInt(text);
    
    if (isNaN(value)) {
      value = max;
    }
    
    // Ensure max is not less than min and not greater than the maximum allowed
    value = Math.max(value, minValue);
    value = Math.min(value, max);
    
    setMaxValue(value);
    
    if (onPriceChange) {
      onPriceChange([minValue, value]);
    }
  };
  
  // Handle slider change
  const handleSliderChange = (values) => {
    if (!Array.isArray(values) || values.length !== 2) {
      return;
    }
    
    const [min, max] = values.map(Math.round);
    
    setMinValue(min);
    setMaxValue(max);
  };
  
  const handleSliderComplete = () => {
    if (onPriceChange) {
      onPriceChange([minValue, maxValue]);
    }
  };
  
  return (
    <View style={[styles.container, style]}>
      {!hideTitle && <Text style={styles.title}>Price Range</Text>}
      
      <View style={styles.sliderContainer}>
        <Slider
          style={styles.slider}
          minimumValue={0}
          maximumValue={max}
          step={1}
          minimumTrackTintColor="#4CAF50"
          maximumTrackTintColor="#E0E0E0"
          thumbTintColor="#4CAF50"
          value={[minValue, maxValue]}
          onValueChange={handleSliderChange}
          onSlidingComplete={handleSliderComplete}
        />
      </View>
      
      <View style={styles.inputsContainer}>
        <View style={styles.inputWrapper}>
          <Text style={styles.inputLabel}>Min</Text>
          <View style={styles.inputContainer}>
            <Text style={styles.currencySymbol}>$</Text>
            <TextInput
              style={styles.input}
              value={String(minValue)}
              onChangeText={handleMinChange}
              keyboardType="numeric"
              maxLength={5}
            />
          </View>
        </View>
        
        <View style={styles.separator} />
        
        <View style={styles.inputWrapper}>
          <Text style={styles.inputLabel}>Max</Text>
          <View style={styles.inputContainer}>
            <Text style={styles.currencySymbol}>$</Text>
            <TextInput
              style={styles.input}
              value={String(maxValue)}
              onChangeText={handleMaxChange}
              keyboardType="numeric"
              maxLength={5}
            />
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
    color: '#333',
  },
  sliderContainer: {
    marginBottom: 20,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  inputsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  inputWrapper: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 12,
    color: '#888',
    marginBottom: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 4,
    paddingHorizontal: 8,
    height: 40,
  },
  currencySymbol: {
    color: '#4CAF50',
    fontWeight: '600',
    fontSize: 16,
    marginRight: 4,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  separator: {
    width: 16,
  },
});

export default PriceRange;