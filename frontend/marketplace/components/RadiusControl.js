// components/RadiusControl.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Animated,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';

/**
 * Enhanced RadiusControl component for setting search radius
 * 
 * @param {Object} props Component props
 * @param {number} props.radius Current radius in km
 * @param {Function} props.onRadiusChange Callback when radius changes
 * @param {Function} props.onApply Callback when apply button is pressed
 * @param {Object} props.style Additional styles for the container
 */
const RadiusControl = ({ radius = 10, onRadiusChange, onApply, style }) => {
  const [inputValue, setInputValue] = useState(radius?.toString() || '10');
  const [sliderValue, setSliderValue] = useState(radius || 10);
  const [error, setError] = useState('');
  
  // Animation for pulse effect on apply
  const [scaleAnim] = useState(new Animated.Value(1));
  
  // Update input when radius prop changes
  useEffect(() => {
    setInputValue(radius?.toString() || '10');
    setSliderValue(radius || 10);
  }, [radius]);

  // Animate pulse effect
  const animatePulse = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 1.05,
        duration: 150,
        useNativeDriver: true
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true
      })
    ]).start();
  };

  // Handle apply button
  const handleApply = () => {
    const value = parseFloat(inputValue);
    
    if (isNaN(value) || value <= 0) {
      setError('Please enter a valid radius');
      return;
    }
    
    if (value > 100) {
      setError('Maximum radius is 100 km');
      return;
    }
    
    setError('');
    
    // Animate button
    animatePulse();
    
    // Call callback
    onRadiusChange(value);
    
    if (onApply) {
      onApply(value);
    }
  };

  // Handle input change
  const handleInputChange = (text) => {
    // Filter out non-numeric characters except decimal point
    const filteredText = text.replace(/[^0-9.]/g, '');
    setInputValue(filteredText);
    setError('');
    
    // Update slider if valid number
    const value = parseFloat(filteredText);
    if (!isNaN(value) && value > 0 && value <= 100) {
      setSliderValue(value);
    }
  };
  
  // Handle slider change
  const handleSliderChange = (value) => {
    // Round to 1 decimal place
    const roundedValue = Math.round(value * 10) / 10;
    setSliderValue(roundedValue);
    setInputValue(roundedValue.toString());
    setError('');
  };
  
  // Handle slider complete
  const handleSliderComplete = (value) => {
    // Round to 1 decimal place
    const roundedValue = Math.round(value * 10) / 10;
    
    // Call callback
    onRadiusChange(roundedValue);
    
    if (onApply) {
      onApply(roundedValue);
    }
  };

  return (
    <View style={[styles.container, style]}>
      <View style={styles.headerRow}>
        <MaterialIcons name="radio-button-checked" size={24} color="#4CAF50" style={styles.radiusIcon} />
        <Text style={styles.headerText}>Search Radius</Text>
      </View>
      
      <View style={styles.sliderContainer}>
        <Slider
          style={styles.slider}
          minimumValue={1}
          maximumValue={100}
          step={0.5}
          value={sliderValue}
          onValueChange={handleSliderChange}
          onSlidingComplete={handleSliderComplete}
          minimumTrackTintColor="#4CAF50"
          maximumTrackTintColor="#dddddd"
          thumbTintColor="#4CAF50"
        />
        <View style={styles.sliderLabels}>
          <Text style={styles.sliderMinLabel}>1km</Text>
          <Text style={styles.sliderMaxLabel}>100km</Text>
        </View>
      </View>
      
      <View style={styles.radiusInputContainer}>
        <View style={styles.inputWrapper}>
          <TextInput
            style={styles.input}
            value={inputValue}
            onChangeText={handleInputChange}
            placeholder="10"
            keyboardType="numeric"
            returnKeyType="done"
            maxLength={5}
            selectTextOnFocus={true}
          />
          <Text style={styles.unitText}>km</Text>
        </View>
        
        <Animated.View style={{
          transform: [{ scale: scaleAnim }]
        }}>
          <TouchableOpacity
            style={styles.applyButton}
            onPress={handleApply}
          >
            <Text style={styles.applyButtonText}>Apply</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
      
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      
      <View style={styles.radiusDisplay}>
        <View style={styles.radiusCircle}>
          <Text style={styles.radiusValue}>{sliderValue}</Text>
          <Text style={styles.radiusUnit}>km</Text>
        </View>
        <Text style={styles.helperText}>
          Set radius to find plants nearby
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  radiusIcon: {
    marginRight: 8,
  },
  headerText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  sliderContainer: {
    marginVertical: 8,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: -8,
  },
  sliderMinLabel: {
    fontSize: 12,
    color: '#666',
  },
  sliderMaxLabel: {
    fontSize: 12,
    color: '#666',
  },
  radiusInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 8,
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    marginRight: 12,
    paddingHorizontal: 12,
    backgroundColor: '#f9f9f9',
    height: 44,
  },
  input: {
    flex: 1,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    fontSize: 16,
    color: '#333',
  },
  unitText: {
    marginLeft: 4,
    fontSize: 16,
    color: '#666',
  },
  applyButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  applyButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
  errorText: {
    color: '#f44336',
    fontSize: 12,
    marginTop: 4,
    marginBottom: 8,
  },
  radiusDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  radiusCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#f0f9f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    borderWidth: 2,
    borderColor: '#4CAF50',
  },
  radiusValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  radiusUnit: {
    fontSize: 12,
    color: '#4CAF50',
  },
  helperText: {
    flex: 1,
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
});

export default RadiusControl;