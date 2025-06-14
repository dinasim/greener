// components/MarketplaceFilterToggle.js - FIXED VERSION with proper refresh
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

const MarketplaceFilterToggle = ({ 
  sellerType, 
  onSellerTypeChange, 
  counts = { all: 0, individual: 0, business: 0 },
  style 
}) => {
  
  const handlePress = (type) => {
    console.log('🔄 MarketplaceFilterToggle: Changing from', sellerType, 'to', type);
    
    // Only trigger change if it's actually different
    if (type !== sellerType) {
      onSellerTypeChange(type);
    }
  };

  const formatCount = (count) => {
    if (count === undefined || count === null) return '0';
    if (count > 999) return `${Math.floor(count / 1000)}k+`;
    return count.toString();
  };

  const getButtonStyle = (type) => [
    styles.filterButton,
    sellerType === type && styles.activeFilterButton
  ];

  const getTextStyle = (type) => [
    styles.filterButtonText,
    sellerType === type && styles.activeFilterButtonText
  ];

  const getCountStyle = (type) => [
    styles.countText,
    sellerType === type && styles.activeCountText
  ];

  return (
    <View style={[styles.container, style]}>
      <View style={styles.filterRow}>
        
        {/* All Products */}
        <TouchableOpacity
          style={getButtonStyle('all')}
          onPress={() => handlePress('all')}
          activeOpacity={0.7}
        >
          <View style={styles.buttonContent}>
            <MaterialIcons 
              name="apps" 
              size={16} 
              color={sellerType === 'all' ? '#fff' : '#666'} 
            />
            <Text style={getTextStyle('all')}>All</Text>
            <Text style={getCountStyle('all')}>({formatCount(counts.all)})</Text>
          </View>
        </TouchableOpacity>

        {/* Individual Sellers */}
        <TouchableOpacity
          style={getButtonStyle('individual')}
          onPress={() => handlePress('individual')}
          activeOpacity={0.7}
        >
          <View style={styles.buttonContent}>
            <MaterialIcons 
              name="person" 
              size={16} 
              color={sellerType === 'individual' ? '#fff' : '#666'} 
            />
            <Text style={getTextStyle('individual')}>Individual</Text>
            <Text style={getCountStyle('individual')}>({formatCount(counts.individual)})</Text>
          </View>
        </TouchableOpacity>

        {/* Business Sellers */}
        <TouchableOpacity
          style={getButtonStyle('business')}
          onPress={() => handlePress('business')}
          activeOpacity={0.7}
        >
          <View style={styles.buttonContent}>
            <MaterialIcons 
              name="store" 
              size={16} 
              color={sellerType === 'business' ? '#fff' : '#666'} 
            />
            <Text style={getTextStyle('business')}>Business</Text>
            <Text style={getCountStyle('business')}>({formatCount(counts.business)})</Text>
          </View>
        </TouchableOpacity>
        
      </View>
      
      {/* Debug info in development - DISABLED */}
      {__DEV__ && false && (
        <View style={styles.debugInfo}>
          <Text style={styles.debugText}>
            Current: {sellerType} | Counts: A:{counts.all} I:{counts.individual} B:{counts.business}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  filterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  filterButton: {
    flex: 1,
    marginHorizontal: 4,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#f8f9fa',
    alignItems: 'center',
  },
  activeFilterButton: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginLeft: 6,
    marginRight: 4,
  },
  activeFilterButtonText: {
    color: '#fff',
  },
  countText: {
    fontSize: 12,
    color: '#999',
    fontWeight: '500',
  },
  activeCountText: {
    color: '#e8f5e8',
  },
  debugInfo: {
    marginTop: 8,
    padding: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 4,
  },
  debugText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
});

export default MarketplaceFilterToggle;