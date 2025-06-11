// components/MarketplaceFilterToggle.js - FIXED VERSION
import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

const MarketplaceFilterToggle = ({ 
  sellerType = 'all', 
  onSellerTypeChange, 
  counts = { all: 0, individual: 0, business: 0 } 
}) => {
  const handlePress = (type) => {
    if (onSellerTypeChange) {
      onSellerTypeChange(type);
    }
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
    styles.countBadge,
    sellerType === type && styles.activeCountBadge
  ];

  return (
    <View style={styles.container}>
      <View style={styles.filterToggleContainer}>
        {/* All Products Button */}
        <TouchableOpacity
          style={getButtonStyle('all')}
          onPress={() => handlePress('all')}
          activeOpacity={0.7}
        >
          <View style={styles.buttonContent}>
            <MaterialIcons 
              name="apps" 
              size={18} 
              color={sellerType === 'all' ? '#fff' : '#4CAF50'} 
            />
            <Text style={getTextStyle('all')}>
              All
            </Text>
            <View style={getCountStyle('all')}>
              <Text style={[
                styles.countText,
                sellerType === 'all' && styles.activeCountText
              ]}>
                {counts.all}
              </Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* Individual Sellers Button */}
        <TouchableOpacity
          style={getButtonStyle('individual')}
          onPress={() => handlePress('individual')}
          activeOpacity={0.7}
        >
          <View style={styles.buttonContent}>
            <MaterialIcons 
              name="person" 
              size={18} 
              color={sellerType === 'individual' ? '#fff' : '#4CAF50'} 
            />
            <Text style={getTextStyle('individual')}>
              Individual
            </Text>
            <View style={getCountStyle('individual')}>
              <Text style={[
                styles.countText,
                sellerType === 'individual' && styles.activeCountText
              ]}>
                {counts.individual}
              </Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* Business Sellers Button */}
        <TouchableOpacity
          style={getButtonStyle('business')}
          onPress={() => handlePress('business')}
          activeOpacity={0.7}
        >
          <View style={styles.buttonContent}>
            <MaterialCommunityIcons 
              name="store" 
              size={18} 
              color={sellerType === 'business' ? '#fff' : '#4CAF50'} 
            />
            <Text style={getTextStyle('business')}>
              Business
            </Text>
            <View style={getCountStyle('business')}>
              <Text style={[
                styles.countText,
                sellerType === 'business' && styles.activeCountText
              ]}>
                {counts.business}
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      </View>

      {/* Filter Description */}
      <View style={styles.descriptionContainer}>
        <Text style={styles.descriptionText}>
          {sellerType === 'all' && `Showing all ${counts.all} products from individual sellers and businesses`}
          {sellerType === 'individual' && `Showing ${counts.individual} products from individual plant enthusiasts`}
          {sellerType === 'business' && `Showing ${counts.business} products from verified plant businesses`}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  filterToggleContainer: {
    flexDirection: 'row',
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 4,
    marginBottom: 8,
  },
  filterButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44, // Ensure touch target is large enough
  },
  activeFilterButton: {
    backgroundColor: '#4CAF50',
    shadowColor: '#4CAF50',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  buttonContent: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  filterButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4CAF50',
    marginTop: 2,
    textAlign: 'center',
  },
  activeFilterButtonText: {
    color: '#fff',
  },
  countBadge: {
    backgroundColor: '#e0e0e0',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 2,
    minWidth: 20,
    alignItems: 'center',
  },
  activeCountBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  countText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#666',
  },
  activeCountText: {
    color: '#fff',
  },
  descriptionContainer: {
    alignItems: 'center',
  },
  descriptionText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    lineHeight: 16,
  },
});

export default MarketplaceFilterToggle;