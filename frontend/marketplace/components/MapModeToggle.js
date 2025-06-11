// components/MapModeToggle.js
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';

/**
 * Toggle component for switching between plants and businesses on map
 * 
 * @param {Object} props
 * @param {string} props.mapMode - Current map mode ('plants' or 'businesses')
 * @param {Function} props.onMapModeChange - Callback when map mode changes
 * @param {Object} props.counts - Counts of plants and businesses
 */
const MapModeToggle = ({ 
  mapMode = 'plants', 
  onMapModeChange,
  counts = { plants: 0, businesses: 0 }
}) => {
  
  return (
    <View style={styles.container}>
      <View style={styles.toggleContainer}>
        <TouchableOpacity 
          style={[
            styles.toggleButton, 
            mapMode === 'plants' && styles.activeButton
          ]} 
          onPress={() => onMapModeChange('plants')}
          accessibilityRole="button"
          accessibilityLabel="Show plants on map"
          accessibilityState={{ selected: mapMode === 'plants' }}
        >
          <MaterialIcons 
            name="eco" 
            size={20} 
            color={mapMode === 'plants' ? '#ffffff' : '#4CAF50'} 
          />
          <Text style={[
            styles.toggleText,
            mapMode === 'plants' && styles.activeText
          ]}>
            Plants ({counts.plants})
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[
            styles.toggleButton, 
            mapMode === 'businesses' && styles.activeButton
          ]} 
          onPress={() => onMapModeChange('businesses')}
          accessibilityRole="button"
          accessibilityLabel="Show businesses on map"
          accessibilityState={{ selected: mapMode === 'businesses' }}
        >
          <MaterialCommunityIcons 
            name="store" 
            size={20} 
            color={mapMode === 'businesses' ? '#ffffff' : '#FF9800'} 
          />
          <Text style={[
            styles.toggleText,
            mapMode === 'businesses' && styles.activeText
          ]}>
            Businesses ({counts.businesses})
          </Text>
        </TouchableOpacity>
      </View>
      
      <View style={styles.infoContainer}>
        <MaterialIcons name="info-outline" size={14} color="#666" />
        <Text style={styles.infoText}>
          {mapMode === 'plants' 
            ? 'Showing individual plant listings' 
            : 'Showing plant businesses and nurseries'
          }
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: '#f5f5f5',
    borderRadius: 25,
    padding: 4,
  },
  toggleButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: 'transparent',
  },
  activeButton: {
    backgroundColor: '#4CAF50',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  toggleText: {
    marginLeft: 6,
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '600',
  },
  activeText: {
    color: '#ffffff',
  },
  infoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    justifyContent: 'center',
  },
  infoText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
});

export default MapModeToggle;