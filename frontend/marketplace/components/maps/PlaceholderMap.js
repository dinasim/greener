import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

/**
 * PlaceholderMap - Temporary component to replace react-native-maps
 * This resolves the error with native module imports on web
 */
const PlaceholderMap = ({ 
  style, 
  initialRegion, 
  region,
  onRegionChange,
  onRegionChangeComplete,
  showsUserLocation,
  onPress,
  children,
  ...props
}) => {
  // Handle map press event with a fake coordinate
  const handlePress = () => {
    if (onPress) {
      const fakeEvent = {
        nativeEvent: {
          coordinate: initialRegion || region || {
            latitude: 32.0853,
            longitude: 34.8461,
          }
        }
      };
      onPress(fakeEvent);
    }
  };
  
  return (
    <View 
      style={[styles.container, style]}
      onTouchEnd={handlePress}
    >
      <Text style={styles.text}>
        Map will be implemented with Azure Maps later
      </Text>
      <Text style={styles.subText}>
        Tap anywhere to select location
      </Text>
    </View>
  );
};

// Create a placeholder Marker component
const Marker = ({ coordinate, title, description, ...props }) => null;

// Assign the Marker as a property of the PlaceholderMap
PlaceholderMap.Marker = Marker;

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#e8f5e9', // Light green background
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 200,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#81c784',
    borderStyle: 'dashed',
  },
  text: {
    color: '#2e7d32', // Dark green text
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
    padding: 10,
  },
  subText: {
    color: '#388e3c', // Medium green text
    fontSize: 14,
    textAlign: 'center',
    fontStyle: 'italic',
  }
});

export default PlaceholderMap;