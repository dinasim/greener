import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';

const MapToggle = ({ viewMode, onViewModeChange }) => {
  const handleViewChange = (mode) => {
    if (viewMode !== mode) {
      onViewModeChange(mode);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.viewToggle}>
        <TouchableOpacity
          style={[styles.button, viewMode === 'grid' && styles.active]}
          onPress={() => handleViewChange('grid')}
        >
          <Feather name="grid" size={20} color={viewMode === 'grid' ? '#4CAF50' : '#999'} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, viewMode === 'list' && styles.active]}
          onPress={() => handleViewChange('list')}
        >
          <Feather name="list" size={20} color={viewMode === 'list' ? '#4CAF50' : '#999'} />
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[styles.button, styles.mapButton, viewMode === 'map' && styles.active]}
        onPress={() => handleViewChange('map')}
      >
        <Feather name="map" size={20} color={viewMode === 'map' ? '#4CAF50' : '#999'} />
      </TouchableOpacity>
    </View>
  );
};

export default MapToggle;

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 10,
  },
  viewToggle: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 4,
    overflow: 'hidden',
    marginRight: 8,
  },
  button: {
    padding: 8,
    backgroundColor: '#f5f5f5',
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapButton: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 4,
  },
  active: {
    backgroundColor: '#e6f7e6',
  },
});
