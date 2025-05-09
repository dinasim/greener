// File: components/MapToggle.js
import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

/**
 * MapToggle component for switching between list/grid view and map view
 */
const MapToggle = ({ viewMode, onViewModeChange }) => {
  return (
    <View style={styles.container}>
      {/* Grid/List toggle */}
      <View style={styles.viewToggle}>
        <TouchableOpacity 
          style={[styles.viewButton, viewMode === 'grid' && styles.activeViewButton]}
          onPress={() => onViewModeChange('grid')}
        >
          <MaterialIcons 
            name="grid-view" 
            size={22} 
            color={viewMode === 'grid' ? '#4CAF50' : '#999'} 
          />
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.viewButton, viewMode === 'list' && styles.activeViewButton]}
          onPress={() => onViewModeChange('list')}
        >
          <MaterialIcons 
            name="view-list" 
            size={22} 
            color={viewMode === 'list' ? '#4CAF50' : '#999'} 
          />
        </TouchableOpacity>
      </View>
      
      {/* Map view toggle */}
      <TouchableOpacity 
        style={[styles.mapButton, viewMode === 'map' && styles.activeViewButton]}
        onPress={() => onViewModeChange('map')}
      >
        <MaterialIcons 
          name="map" 
          size={22} 
          color={viewMode === 'map' ? '#4CAF50' : '#999'} 
        />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewToggle: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 4,
    overflow: 'hidden',
    marginRight: 8,
  },
  viewButton: {
    padding: 6,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    justifyContent: 'center',
    width: 36,
    height: 36,
  },
  mapButton: {
    padding: 6,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    justifyContent: 'center',
    width: 36,
    height: 36,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 4,
  },
  activeViewButton: {
    backgroundColor: '#e6f7e6',
  },
});

export default MapToggle;