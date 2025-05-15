import React from 'react';
import { View, TouchableOpacity, StyleSheet, Text } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

/**
 * MapToggle component for switching between map and list views
 * 
 * @param {Object} props Component props
 * @param {string} props.viewMode Current view mode ('grid', 'list', or 'map')
 * @param {Function} props.onViewModeChange Callback when view mode changes
 * @param {Object} props.style Additional styles for the container
 */
const MapToggle = ({ viewMode, onViewModeChange, style }) => {
  // Function to handle view mode change
  const handleViewChange = (mode) => {
    if (viewMode !== mode) {
      onViewModeChange(mode);
    }
  };

  return (
    <View style={[styles.container, style]}>
      {/* List view toggle */}
      <View style={styles.viewToggles}>
        <TouchableOpacity
          style={[styles.toggleButton, viewMode === 'grid' && styles.activeToggle]}
          onPress={() => handleViewChange('grid')}
          accessibilityLabel="Grid View"
          accessibilityRole="button"
          accessibilityState={{ selected: viewMode === 'grid' }}
        >
          <MaterialIcons 
            name="grid-view" 
            size={20} 
            color={viewMode === 'grid' ? '#4CAF50' : '#999'} 
          />
          <Text style={[
            styles.toggleText, 
            viewMode === 'grid' && styles.activeToggleText
          ]}>
            Grid
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.toggleButton, viewMode === 'list' && styles.activeToggle]}
          onPress={() => handleViewChange('list')}
          accessibilityLabel="List View"
          accessibilityRole="button"
          accessibilityState={{ selected: viewMode === 'list' }}
        >
          <MaterialIcons 
            name="view-list" 
            size={20} 
            color={viewMode === 'list' ? '#4CAF50' : '#999'} 
          />
          <Text style={[
            styles.toggleText, 
            viewMode === 'list' && styles.activeToggleText
          ]}>
            List
          </Text>
        </TouchableOpacity>
      </View>

      {/* Map toggle */}
      <TouchableOpacity
        style={[styles.mapButton, viewMode === 'map' && styles.activeToggle]}
        onPress={() => handleViewChange('map')}
        accessibilityLabel="Map View"
        accessibilityRole="button"
        accessibilityState={{ selected: viewMode === 'map' }}
      >
        <MaterialIcons 
          name="map" 
          size={20} 
          color={viewMode === 'map' ? '#4CAF50' : '#999'} 
        />
        <Text style={[
          styles.toggleText, 
          viewMode === 'map' && styles.activeToggleText
        ]}>
          Map
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  viewToggles: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    overflow: 'hidden',
    marginRight: 12,
  },
  toggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f5f5f5',
  },
  mapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
  },
  activeToggle: {
    backgroundColor: '#e6f7e6',
  },
  toggleText: {
    fontSize: 14,
    color: '#999',
    marginLeft: 6,
  },
  activeToggleText: {
    color: '#4CAF50',
    fontWeight: '600',
  },
});

export default MapToggle;