import React from 'react';
import { View, TouchableOpacity, StyleSheet, Text } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

/**
 * Compact MapToggle
 * @param {string}  viewMode              'grid' | 'list' | 'map'
 * @param {Function}onViewModeChange
 * @param {Object}  style                 container extra styles
 * @param {boolean} showMapLabel          show "Map" next to the icon (default false)
 */
const MapToggle = ({ viewMode, onViewModeChange, style, showMapLabel = false }) => {
  const handleViewChange = (mode) => {
    if (viewMode !== mode) onViewModeChange(mode);
  };

  const ICON   = 16; // smaller icons
  const HEIGHT = 32; // compact height

  return (
    <View style={[styles.container, style]}>
      {/* Grid / List segmented */}
      <View style={[styles.segmentGroup, { height: HEIGHT }]}>
        <TouchableOpacity
          style={[styles.segmentBtn, { height: HEIGHT - 2 }, viewMode === 'grid' && styles.segmentActive]}
          onPress={() => handleViewChange('grid')}
          accessibilityLabel="Grid View"
          accessibilityRole="button"
          accessibilityState={{ selected: viewMode === 'grid' }}
        >
          <MaterialIcons name="grid-view" size={ICON} color="#2e7d32" />
          <Text style={styles.segmentText} numberOfLines={1}>Grid</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.segmentBtn, { height: HEIGHT - 2 }, viewMode === 'list' && styles.segmentActive]}
          onPress={() => handleViewChange('list')}
          accessibilityLabel="List View"
          accessibilityRole="button"
          accessibilityState={{ selected: viewMode === 'list' }}
        >
          <MaterialIcons name="view-list" size={ICON} color="#2e7d32" />
          <Text style={styles.segmentText} numberOfLines={1}>List</Text>
        </TouchableOpacity>
      </View>

      {/* Map chip (icon-only by default) */}
      <TouchableOpacity
        style={[styles.mapBtn, { width: HEIGHT, height: HEIGHT }, viewMode === 'map' && styles.mapActive]}
        onPress={() => handleViewChange('map')}
        accessibilityLabel="Map View"
        accessibilityRole="button"
        accessibilityState={{ selected: viewMode === 'map' }}
      >
        <MaterialIcons name="map" size={ICON} color="#2e7d32" />
        {showMapLabel && <Text style={styles.segmentText}>Map</Text>}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center' },

  segmentGroup: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#DDE7DD',
    borderRadius: 10,
    overflow: 'hidden',
  },
  segmentBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  segmentActive: {
    backgroundColor: '#E8F6ED',
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: '#CBE6CF',
  },
  segmentText: {
    marginLeft: 6,
    fontSize: 13,
    fontWeight: '700',
    color: '#2e7d32',
  },

  mapBtn: {
    marginLeft: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#DDE7DD',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    paddingHorizontal: 0, // icon-only by default
  },
  mapActive: { backgroundColor: '#E8F6ED', borderColor: '#CBE6CF' },
});

export default MapToggle;
