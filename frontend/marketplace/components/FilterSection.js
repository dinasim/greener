import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Pressable,
  Animated,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import MapToggle from './MapToggle';
import PriceRange from './PriceRange';
import SortOptions from './SortOptions';

/**
 * Enhanced FilterSection component with improved UI and functionality
 * 
 * @param {Object} props Component props
 * @param {string} props.sortOption Current sort option
 * @param {Function} props.onSortChange Callback when sort option changes
 * @param {Object} props.priceRange Current price range {min, max}
 * @param {Function} props.onPriceChange Callback when price range changes
 * @param {string} props.viewMode Current view mode ('grid', 'list', or 'map')
 * @param {Function} props.onViewModeChange Callback when view mode changes
 * @param {string} props.category Current selected category
 * @param {Function} props.onCategoryChange Callback when category changes
 * @param {Array} props.activeFilters Array of active filter objects
 * @param {Function} props.onRemoveFilter Callback to remove a filter
 * @param {Function} props.onResetFilters Callback to reset all filters
 */
const FilterSection = ({
  sortOption = 'recent',
  onSortChange,
  priceRange = { min: 0, max: 1000 },
  onPriceChange,
  viewMode = 'grid',
  onViewModeChange,
  category,
  onCategoryChange,
  activeFilters = [],
  onRemoveFilter,
  onResetFilters,
}) => {
  // State
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [modalAnimation] = useState(new Animated.Value(0));
  
  // Handle price range change
  const handlePriceRangeChange = (range) => {
    if (onPriceChange) {
      onPriceChange({ min: range[0], max: range[1] });
    }
  };

  // Handle filter modal animation
  const showFilterModal = () => {
    setFilterModalVisible(true);
    Animated.timing(modalAnimation, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  const hideFilterModal = () => {
    Animated.timing(modalAnimation, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setFilterModalVisible(false);
    });
  };

  // Count active filters
  const activeFilterCount = activeFilters.length + (priceRange.min > 0 || priceRange.max < 1000 ? 1 : 0);

  // Modal slide-in animation
  const slideAnimation = {
    transform: [
      {
        translateY: modalAnimation.interpolate({
          inputRange: [0, 1],
          outputRange: [300, 0],
        }),
      },
    ],
  };

  // Modal background opacity animation
  const backdropAnimation = {
    opacity: modalAnimation,
  };

  return (
    <View style={styles.mainContainer}>
      {/* Active Filters Row (conditional) */}
      {activeFilterCount > 0 && (
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.activeFiltersContainer}
          contentContainerStyle={styles.activeFiltersContent}
        >
          {/* Price Range Filter Pill (if active) */}
          {(priceRange.min > 0 || priceRange.max < 1000) && (
            <View style={styles.filterPill}>
              <Text style={styles.filterPillText}>
                ${priceRange.min} - ${priceRange.max}
              </Text>
              <TouchableOpacity 
                onPress={() => onPriceChange({ min: 0, max: 1000 })}
                hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
              >
                <MaterialIcons name="close" size={16} color="#777" />
              </TouchableOpacity>
            </View>
          )}
          
          {/* Custom Active Filters */}
          {activeFilters.map((filter, index) => (
            <View key={index} style={styles.filterPill}>
              <Text style={styles.filterPillText}>
                {filter.label}
              </Text>
              <TouchableOpacity 
                onPress={() => onRemoveFilter && onRemoveFilter(filter.id)}
                hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
              >
                <MaterialIcons name="close" size={16} color="#777" />
              </TouchableOpacity>
            </View>
          ))}
          
          {/* Clear All Button */}
          {activeFilterCount > 1 && (
            <TouchableOpacity 
              style={styles.clearAllButton}
              onPress={onResetFilters}
            >
              <Text style={styles.clearAllText}>Clear All</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      )}
      
      {/* Main Filter Controls Row */}
      <View style={styles.controlsRow}>
        {/* Sort Options - Left side */}
        <View style={styles.sortContainer}>
          <SortOptions 
            selectedOption={sortOption}
            onSelectOption={onSortChange}
          />
        </View>
        
        {/* Filter Button */}
        <TouchableOpacity 
          style={styles.filterButton}
          onPress={showFilterModal}
        >
          <MaterialIcons name="filter-list" size={18} color="#4CAF50" />
          <Text style={styles.filterButtonText}>
            Filters {activeFilterCount > 0 ? `(${activeFilterCount})` : ''}
          </Text>
        </TouchableOpacity>
        
        {/* Empty middle space to push sort left and map toggle right */}
        <View style={styles.spacer} />
        
        {/* View Toggle - Right side */}
        <MapToggle 
          viewMode={viewMode} 
          onViewModeChange={onViewModeChange} 
        />
      </View>
      
      {/* Filter Modal */}
      <Modal
        visible={filterModalVisible}
        transparent={true}
        animationType="none"
        onRequestClose={hideFilterModal}
      >
        <Animated.View 
          style={[styles.modalOverlay, backdropAnimation]}
          onTouchEnd={hideFilterModal}
        >
          <Pressable>
            <Animated.View 
              style={[styles.modalContent, slideAnimation]}
            >
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Filters</Text>
                <TouchableOpacity 
                  onPress={hideFilterModal}
                  style={styles.closeButton}
                >
                  <MaterialIcons name="close" size={24} color="#333" />
                </TouchableOpacity>
              </View>
              
              <ScrollView>
                {/* Price Range in Modal */}
                <View style={styles.modalSection}>
                  <Text style={styles.sectionTitle}>Price Range</Text>
                  <PriceRange
                    onPriceChange={handlePriceRangeChange}
                    initialMin={priceRange.min}
                    initialMax={priceRange.max}
                    style={styles.priceRange}
                  />
                </View>
                
                {/* Action Buttons */}
                <View style={styles.modalActions}>
                  <TouchableOpacity 
                    style={styles.resetButton}
                    onPress={() => {
                      if (onResetFilters) onResetFilters();
                      hideFilterModal();
                    }}
                  >
                    <Text style={styles.resetButtonText}>Reset All</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={styles.applyButton}
                    onPress={hideFilterModal}
                  >
                    <Text style={styles.applyButtonText}>Apply Filters</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </Animated.View>
          </Pressable>
        </Animated.View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  mainContainer: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  activeFiltersContainer: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  activeFiltersContent: {
    paddingHorizontal: 16,
  },
  filterPill: {
    backgroundColor: '#f0f9f0',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  filterPillText: {
    fontSize: 12,
    color: '#4CAF50',
    marginRight: 6,
  },
  clearAllButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  clearAllText: {
    fontSize: 12,
    color: '#f44336',
    fontWeight: '600',
  },
  controlsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: 'center',
  },
  sortContainer: {
    // Styles for sort container
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginLeft: 8,
  },
  filterButtonText: {
    fontSize: 14,
    color: '#333',
    marginLeft: 4,
  },
  spacer: {
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 30, // Extra padding for bottom safe area
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    padding: 4,
  },
  modalSection: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
    color: '#333',
  },
  priceRange: {
    // Any specific styles for price range in modal
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  resetButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  resetButtonText: {
    fontSize: 14,
    color: '#666',
  },
  applyButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  applyButtonText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
  },
});

export default FilterSection;