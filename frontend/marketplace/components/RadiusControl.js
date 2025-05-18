
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Animated,
  TextInput,
  Dimensions,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import PlantCard from './PlantCard';

const { width } = Dimensions.get('window');

/**
 * Enhanced RadiusControl component with integrated product list
 * 
 * @param {Object} props Component props
 * @param {number} props.radius Current radius in km
 * @param {Function} props.onRadiusChange Callback when radius changes
 * @param {Function} props.onApply Callback when apply button is pressed
 * @param {Array} props.products Array of products to display in the list
 * @param {boolean} props.isLoading Loading state for product list
 * @param {string} props.error Error message if any
 * @param {Function} props.onProductSelect Callback when a product is selected
 * @param {Function} props.onToggleViewMode Callback to toggle between map and list view
 * @param {Object} props.style Additional styles for the container
 */
const RadiusControl = ({
  radius = 10,
  onRadiusChange,
  onApply,
  products = [],
  isLoading = false,
  error = null,
  onProductSelect,
  onToggleViewMode,
  style,
}) => {
  const [inputValue, setInputValue] = useState(radius?.toString() || '10');
  const [sliderValue, setSliderValue] = useState(radius || 10);
  const [validationError, setValidationError] = useState('');
  const [expanded, setExpanded] = useState(true);
  
  // Animation values
  const containerHeight = useRef(new Animated.Value(expanded ? 400 : 130)).current;
  const arrowRotation = useRef(new Animated.Value(expanded ? 0 : 1)).current;
  const circleSize = useRef(new Animated.Value(50)).current;
  const circleOpacity = useRef(new Animated.Value(0.7)).current;
  
  // Update input when radius prop changes
  useEffect(() => {
    setInputValue(radius?.toString() || '10');
    setSliderValue(radius || 10);
    
    // Animate circle size based on radius
    const size = Math.min(160, 50 + radius * 2);
    Animated.timing(circleSize, {
      toValue: size,
      duration: 300,
      useNativeDriver: false,
    }).start();
    
    // Briefly increase opacity when radius changes
    Animated.sequence([
      Animated.timing(circleOpacity, {
        toValue: 0.9,
        duration: 150,
        useNativeDriver: false,
      }),
      Animated.timing(circleOpacity, {
        toValue: 0.7,
        duration: 300,
        useNativeDriver: false,
      }),
    ]).start();
  }, [radius, circleSize, circleOpacity]);

  // Animate pulse effect on apply
  const animatePulse = () => {
    Animated.sequence([
      Animated.timing(circleOpacity, {
        toValue: 0.9,
        duration: 150,
        useNativeDriver: false
      }),
      Animated.timing(circleOpacity, {
        toValue: 0.7,
        duration: 150,
        useNativeDriver: false
      })
    ]).start();
  };

  // Handle apply button
  const handleApply = () => {
    const value = parseFloat(inputValue);
    
    if (isNaN(value) || value <= 0) {
      setValidationError('Please enter a valid radius');
      return;
    }
    
    if (value > 100) {
      setValidationError('Maximum radius is 100 km');
      return;
    }
    
    setValidationError('');
    
    // Animate circle
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
    setValidationError('');
    
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
    setValidationError('');
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

  // Toggle expanded state
  const toggleExpanded = () => {
    const newExpanded = !expanded;
    setExpanded(newExpanded);
    
    // Animate container height
    Animated.timing(containerHeight, {
      toValue: newExpanded ? 400 : 130,
      duration: 300,
      useNativeDriver: false,
    }).start();
    
    // Animate arrow rotation
    Animated.timing(arrowRotation, {
      toValue: newExpanded ? 0 : 1,
      duration: 300,
      useNativeDriver: false,
    }).start();
  };

  // Transform rotation for the arrow icon
  const arrowRotateStyle = {
    transform: [
      {
        rotate: arrowRotation.interpolate({
          inputRange: [0, 1],
          outputRange: ['0deg', '180deg'],
        }),
      },
    ],
  };

  // Render empty state for product list
  const renderEmptyState = () => {
    if (isLoading) {
      return (
        <View style={styles.emptyStateContainer}>
          <ActivityIndicator size="small" color="#4CAF50" />
          <Text style={styles.emptyStateText}>Looking for plants...</Text>
        </View>
      );
    }
    
    if (error) {
      return (
        <View style={styles.emptyStateContainer}>
          <MaterialIcons name="error-outline" size={24} color="#f44336" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      );
    }
    
    return (
      <View style={styles.emptyStateContainer}>
        <MaterialIcons name="eco" size={24} color="#ccc" />
        <Text style={styles.emptyStateText}>
          No plants found within {radius} km.
        </Text>
        <Text style={styles.emptyStateSubtext}>
          Try increasing the search radius
        </Text>
      </View>
    );
  };

  return (
    <Animated.View style={[styles.container, { height: containerHeight }, style]}>
      {/* Header with toggle */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <MaterialIcons name="radio-button-checked" size={22} color="#4CAF50" />
          <Text style={styles.headerTitle}>Search Radius</Text>
          <Text style={styles.radiusValue}>{radius} km</Text>
        </View>
        
        <TouchableOpacity style={styles.toggleButton} onPress={toggleExpanded}>
          <Animated.View style={arrowRotateStyle}>
            <MaterialIcons name="keyboard-arrow-up" size={24} color="#666" />
          </Animated.View>
        </TouchableOpacity>
      </View>

      {/* Radius controls section */}
      <View style={styles.controlsSection}>
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
          
          <TouchableOpacity
            style={styles.applyButton}
            onPress={handleApply}
          >
            <Text style={styles.applyButtonText}>Apply</Text>
          </TouchableOpacity>
        </View>
        
        {validationError ? (
          <Text style={styles.errorText}>{validationError}</Text>
        ) : null}

        <View style={styles.radiusVisual}>
          <View style={styles.centerDot} />
          <Animated.View 
            style={[
              styles.radiusCircle,
              {
                width: circleSize,
                height: circleSize,
                borderRadius: circleSize.interpolate({
                  inputRange: [0, 200],
                  outputRange: [0, 100],
                }),
                opacity: circleOpacity,
              }
            ]}
          />
        </View>
      </View>
      
      {/* Products list section - only shown when expanded */}
      {expanded && (
        <>
          <View style={styles.productsHeader}>
            <Text style={styles.productsTitle}>
              {products.length > 0 
                ? `${products.length} plants found within ${radius}km` 
                : 'No plants found in this area'}
            </Text>
            
            {products.length > 0 && (
              <TouchableOpacity 
                style={styles.viewToggleButton}
                onPress={onToggleViewMode}
              >
                <MaterialIcons name="view-list" size={18} color="#fff" />
                <Text style={styles.viewToggleText}>List View</Text>
              </TouchableOpacity>
            )}
          </View>
          
          <View style={styles.productListContainer}>
            {products.length > 0 ? (
              <FlatList
                data={products}
                renderItem={({ item }) => (
                  <TouchableOpacity 
                    style={styles.productItem}
                    onPress={() => onProductSelect(item.id || item._id)}
                  >
                    <View style={styles.productItemContent}>
                      <Text style={styles.productTitle} numberOfLines={1}>
                        {item.title || item.name || 'Plant'}
                      </Text>
                      <Text style={styles.productPrice}>
                        ${parseFloat(item.price || 0).toFixed(2)}
                      </Text>
                      <View style={styles.productLocation}>
                        <MaterialIcons name="place" size={12} color="#666" />
                        <Text style={styles.productLocationText} numberOfLines={1}>
                          {item.location?.city || item.city || 'Unknown location'}
                        </Text>
                      </View>
                      {item.distance && (
                        <Text style={styles.distanceText}>
                          {item.distance.toFixed(1)}km away
                        </Text>
                      )}
                    </View>
                    <MaterialIcons name="chevron-right" size={22} color="#ccc" />
                  </TouchableOpacity>
                )}
                keyExtractor={(item) => item.id || item._id || Math.random().toString()}
                ItemSeparatorComponent={() => <View style={styles.separator} />}
                ListEmptyComponent={renderEmptyState}
                style={styles.productList}
              />
            ) : renderEmptyState()}
          </View>
        </>
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'white',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 8,
    paddingBottom: 16,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginLeft: 8,
  },
  radiusValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#4CAF50',
    marginLeft: 8,
  },
  toggleButton: {
    padding: 4,
  },
  controlsSection: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  sliderContainer: {
    marginBottom: 12,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: -12,
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
    marginBottom: 10,
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
    marginBottom: 8,
  },
  radiusVisual: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 50,
    marginBottom: 8,
  },
  centerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4CAF50',
    zIndex: 2,
    position: 'absolute',
  },
  radiusCircle: {
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(76, 175, 80, 0.3)',
    position: 'absolute',
  },
  productsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  productsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  viewToggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  viewToggleText: {
    color: '#fff',
    fontSize: 13,
    marginLeft: 4,
  },
  productListContainer: {
    flex: 1,
  },
  productList: {
    flex: 1,
  },
  productItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  productItemContent: {
    flex: 1,
  },
  productTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  productPrice: {
    fontSize: 14,
    fontWeight: '700',
    color: '#4CAF50',
    marginBottom: 4,
  },
  productLocation: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  productLocationText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
  distanceText: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  separator: {
    height: 1,
    backgroundColor: '#f0f0f0',
    marginHorizontal: 16,
  },
  emptyStateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 30,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
  },
  emptyStateSubtext: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    marginTop: 4,
  },
});

export default RadiusControl;