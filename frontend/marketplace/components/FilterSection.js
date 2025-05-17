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
        scale: modalAnimation.interpolate({
          inputRange: [0, 1],
          outputRange: [0.9, 1],
        }),
      },
      {
        translateY: modalAnimation.interpolate({
          inputRange: [0, 1],
          outputRange: [20, 0],
        }),
      },
    ],
    opacity: modalAnimation,
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
        >
          <Pressable style={styles.modalBackdrop} onPress={hideFilterModal}>
            <Animated.View 
              style={[styles.modalContent, slideAnimation]}
            >
              <Pressable>
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
    hideTitle={true} // Hide the component title since we have a section title
    max={1000} // Set maximum price limit
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
              </Pressable>
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
    paddingVertical: 10,
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
    paddingVertical: 7,
    marginRight: 8,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0f0e0',
  },
  filterPillText: {
    fontSize: 13,
    color: '#4CAF50',
    marginRight: 6,
    fontWeight: '500',
  },
  clearAllButton: {
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  clearAllText: {
    fontSize: 13,
    color: '#f44336',
    fontWeight: '600',
  },
  controlsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
  },
  sortContainer: {
    // Styles for sort container
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginLeft: 8,
  },
  filterButtonText: {
    fontSize: 15,
    color: '#333',
    marginLeft: 6,
    fontWeight: '500',
  },
  spacer: {
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingBottom: 24,
    width: '90%',
    maxWidth: 360,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
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
    padding: 6,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
  },
  modalSection: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 16,
    color: '#333',
    textAlign: 'center',
  },
  priceRange: {
    marginTop: 8,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 20,
  },
  resetButton: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  resetButtonText: {
    fontSize: 15,
    color: '#666',
    fontWeight: '500',
  },
  applyButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    paddingHorizontal: 26,
    borderRadius: 8,
  },
  applyButtonText: {
    fontSize: 15,
    color: '#fff',
    fontWeight: '600',
  },
});

export default FilterSection;