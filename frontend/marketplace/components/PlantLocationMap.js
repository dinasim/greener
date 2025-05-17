// components/PlantLocationMap.js
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import CrossPlatformAzureMapView from './CrossPlatformAzureMapView';

const { width } = Dimensions.get('window');

/**
 * Component for displaying plant location on a map in the detail screen
 * Now using the cross-platform map component
 * 
 * @param {Object} props Component props
 * @param {Object} props.plant The plant object with location data
 * @param {Function} props.onGetDirections Callback when user wants directions
 * @param {Function} props.onExpandMap Callback to expand the map to full screen
 * @param {boolean} props.expanded Whether the map is in expanded mode
 */
const PlantLocationMap = ({ 
  plant, 
  onGetDirections, 
  onExpandMap,
  expanded = false
}) => {
  const [isMapReady, setIsMapReady] = useState(false);
  
  // Check if plant has valid location data
  const hasLocation = !!(
    plant.location && 
    typeof plant.location === 'object' && 
    plant.location.latitude && 
    plant.location.longitude
  );
  
  // Extract location info
  const locationText = plant.city || 
    (typeof plant.location === 'string' ? plant.location : plant.location?.city) || 
    'Location unavailable';
  
  // Format coordinates for display
  const formatCoord = (coord) => {
    if (!coord) return '';
    return parseFloat(coord).toFixed(6);
  };

  // Create a single-item array for the map
  const mapProducts = hasLocation ? [plant] : [];

  // Empty state if no location data
  if (!hasLocation) {
    return (
      <View style={[styles.container, { height: 120 }]}>
        <View style={styles.noLocationContainer}>
          <MaterialIcons name="location-off" size={24} color="#aaa" />
          <Text style={styles.noLocationText}>No location data available</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[
      styles.container, 
      expanded ? styles.expandedContainer : { height: 200 }
    ]}>
      <View style={styles.mapContainer}>
        <CrossPlatformAzureMapView
          products={mapProducts}
          initialRegion={{
            latitude: plant.location.latitude,
            longitude: plant.location.longitude,
            zoom: 14
          }}
          showControls={expanded}
          onMapReady={() => setIsMapReady(true)}
        />
        
        {/* Location overlay */}
        <View style={styles.locationOverlay}>
          <MaterialIcons name="place" size={16} color="#4CAF50" />
          <Text style={styles.locationText}>{locationText}</Text>
          
          {!expanded && (
            <TouchableOpacity 
              style={styles.expandButton}
              onPress={onExpandMap}
            >
              <MaterialIcons name="fullscreen" size={20} color="#666" />
            </TouchableOpacity>
          )}
        </View>
        
        {/* Coordinates overlay (only in expanded view) */}
        {expanded && isMapReady && (
          <View style={styles.coordsOverlay}>
            <Text style={styles.coordsText}>
              Lat: {formatCoord(plant.location.latitude)}, 
              Lon: {formatCoord(plant.location.longitude)}
            </Text>
          </View>
        )}
        
        {/* Get directions button */}
        {isMapReady && (
          <TouchableOpacity 
            style={styles.directionsButton}
            onPress={onGetDirections}
          >
            <MaterialIcons name="directions" size={18} color="#fff" />
            <Text style={styles.directionsText}>Get Directions</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    borderRadius: 8,
    overflow: 'hidden',
    marginVertical: 10,
  },
  expandedContainer: {
    flex: 1,
    height: undefined,
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  noLocationContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f5f5f5',
    padding: 20,
  },
  noLocationText: {
    marginTop: 8,
    color: '#666',
    fontSize: 14,
  },
  locationOverlay: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 4,
    padding: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationText: {
    flex: 1,
    marginLeft: 6,
    fontSize: 14,
    color: '#333',
  },
  expandButton: {
    padding: 4,
  },
  coordsOverlay: {
    position: 'absolute',
    bottom: 60,
    left: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 4,
    padding: 6,
  },
  coordsText: {
    fontSize: 12,
    color: '#666',
  },
  directionsButton: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: '#4CAF50',
    borderRadius: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  directionsText: {
    color: '#fff',
    marginLeft: 6,
    fontWeight: '600',
    fontSize: 14,
  },
});

export default PlantLocationMap;