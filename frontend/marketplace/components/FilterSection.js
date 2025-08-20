// components/FilterSection.js - Compact controls (final, color-consistent Filters)
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView, Pressable, Animated, Dimensions,
} from 'react-native';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import MapToggle from './MapToggle';
import PriceRange from './PriceRange';
import SortOptions from './SortOptions';
import MarketplaceFilterToggle from './MarketplaceFilterToggle';

const GREEN = '#4CAF50';
const CHIP_H = 32;

const FilterSection = ({
  sortOption = 'recent',
  onSortChange,
  priceRange = { min: 0, max: 1000 },
  onPriceChange,
  viewMode = 'grid',
  onViewModeChange,
  category,
  onCategoryChange,
  sellerType = 'all',
  onSellerTypeChange,
  activeFilters = [],
  onRemoveFilter,
  onResetFilters,
  businessCounts = { all: 0, individual: 0, business: 0 },
}) => {
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [modalAnimation] = useState(new Animated.Value(0));
  const [localPriceRange, setLocalPriceRange] = useState({
    min: typeof priceRange.min === 'number' ? priceRange.min : 0,
    max: typeof priceRange.max === 'number' ? priceRange.max : 1000,
  });

  // Hide text labels in Grid/List/Map on very narrow devices
  const { width } = Dimensions.get('window');
  const hideViewLabels = width < 360;

  const safeMinPrice = typeof priceRange.min === 'number' ? priceRange.min : 0;
  const safeMaxPrice = typeof priceRange.max === 'number' ? priceRange.max : 1000;
  const safePriceRange = { min: safeMinPrice, max: safeMaxPrice };

  useEffect(() => {
    setLocalPriceRange({ min: safePriceRange.min, max: safePriceRange.max });
  }, [safePriceRange.min, safePriceRange.max]);

  const handlePriceRangeChange = (range) => {
    if (Array.isArray(range) && range.length === 2) {
      setLocalPriceRange({
        min: typeof range[0] === 'number' ? range[0] : 0,
        max: typeof range[1] === 'number' ? range[1] : 1000,
      });
    }
  };

  const applyFilters = () => {
    onPriceChange && onPriceChange(localPriceRange);
    hideFilterModal();
  };

  const showFilterModal = () => {
    setFilterModalVisible(true);
    Animated.timing(modalAnimation, { toValue: 1, duration: 300, useNativeDriver: true }).start();
  };
  const hideFilterModal = () => {
    Animated.timing(modalAnimation, { toValue: 0, duration: 200, useNativeDriver: true }).start(() =>
      setFilterModalVisible(false)
    );
  };

  const activeFilterCount =
    activeFilters.length +
    (safePriceRange.min > 0 || safePriceRange.max < 1000 ? 1 : 0) +
    (sellerType !== 'all' ? 1 : 0);

  const slideAnimation = {
    transform: [
      { scale: modalAnimation.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) },
      { translateY: modalAnimation.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) },
    ],
    opacity: modalAnimation,
  };
  const backdropAnimation = { opacity: modalAnimation };

  const handleResetAllFilters = () => {
    setLocalPriceRange({ min: 0, max: 1000 });
    onPriceChange && onPriceChange({ min: 0, max: 1000 });
    onSellerTypeChange && onSellerTypeChange('all');
    onResetFilters && onResetFilters();
    hideFilterModal();
  };

  return (
    <View style={styles.mainContainer}>
      <MarketplaceFilterToggle
        sellerType={sellerType}
        onSellerTypeChange={onSellerTypeChange}
        counts={businessCounts}
      />

      {activeFilterCount > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.activeFiltersContainer}
          contentContainerStyle={styles.activeFiltersContent}
        >
          {sellerType !== 'all' && (
            <View style={styles.filterPill}>
              <MaterialCommunityIcons
                name={sellerType === 'business' ? 'store' : 'account'}
                size={14}
                color={sellerType === 'business' ? '#FF9800' : '#2196F3'}
              />
              <Text
                style={[
                  styles.filterPillText,
                  { color: sellerType === 'business' ? '#FF9800' : '#2196F3' },
                ]}
              >
                {sellerType === 'business' ? 'Business Only' : 'Individual Only'}
              </Text>
              <TouchableOpacity
                onPress={() => onSellerTypeChange && onSellerTypeChange('all')}
                hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
              >
                <MaterialIcons name="close" size={16} color="#777" />
              </TouchableOpacity>
            </View>
          )}

          {(safePriceRange.min > 0 || safePriceRange.max < 1000) && (
            <View style={styles.filterPill}>
              <MaterialIcons name="attach-money" size={14} color={GREEN} />
              <Text style={styles.filterPillText}>
                ${safePriceRange.min} - ${safePriceRange.max}
              </Text>
              <TouchableOpacity
                onPress={() => onPriceChange && onPriceChange({ min: 0, max: 1000 })}
                hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
              >
                <MaterialIcons name="close" size={16} color="#777" />
              </TouchableOpacity>
            </View>
          )}

          {activeFilters.map((f, i) => (
            <View key={`filter-${i}-${f.id || 'x'}`} style={styles.filterPill}>
              <Text style={styles.filterPillText}>{f.label}</Text>
              <TouchableOpacity
                onPress={() => onRemoveFilter && onRemoveFilter(f.id)}
                hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
              >
                <MaterialIcons name="close" size={16} color="#777" />
              </TouchableOpacity>
            </View>
          ))}

          {activeFilterCount > 1 && (
            <TouchableOpacity style={styles.clearAllButton} onPress={handleResetAllFilters}>
              <Text style={styles.clearAllText}>Clear All</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      )}

      {/* Single compact row (scrollable) */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.controlsRowInner}
        style={styles.controlsRowScroll}
      >
        <View style={styles.sortContainer}>
          <SortOptions
            selectedOption={sortOption}
            onSelectOption={onSortChange}
            compact
            hideLeadingIcon
            labelMode="short"
            buttonMaxWidth={76}
          />
        </View>

        {/* Filters chip: neutral by default, green only when active */}
        <TouchableOpacity
          style={[styles.filterButton, activeFilterCount > 0 && styles.filterButtonActive]}
          onPress={showFilterModal}
        >
          <Text
            style={[styles.filterButtonText, activeFilterCount > 0 && styles.filterButtonActiveText]}
            numberOfLines={1}
          >
            Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
          </Text>
        </TouchableOpacity>

        <View style={styles.mapToggleCompact}>
          <MapToggle
            viewMode={viewMode}
            onViewModeChange={onViewModeChange}
            variant="compact"
            showLabels={!hideViewLabels}
          />
        </View>
      </ScrollView>

      {/* Modal */}
      {filterModalVisible && (
        <Modal transparent visible={filterModalVisible} animationType="none" onRequestClose={hideFilterModal}>
          <Animated.View style={[styles.modalOverlay, backdropAnimation]}>
            <Pressable style={styles.modalBackdrop} onPress={hideFilterModal}>
              <Animated.View style={[styles.modalContent, slideAnimation]}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Filters</Text>
                  <TouchableOpacity onPress={hideFilterModal} style={styles.closeButton}>
                    <MaterialIcons name="close" size={24} color="#333" />
                  </TouchableOpacity>
                </View>

                <ScrollView>
                  <View style={styles.modalSection}>
                    <Text style={styles.sectionTitle}>Seller Type</Text>
                    <View style={styles.sellerTypeButtons}>
                      <TouchableOpacity
                        style={[styles.sellerTypeButton, sellerType === 'all' && styles.selectedSellerType]}
                        onPress={() => onSellerTypeChange && onSellerTypeChange('all')}
                      >
                        <MaterialIcons name="people" size={20} color={sellerType === 'all' ? '#fff' : GREEN} />
                        <Text style={[styles.sellerTypeText, sellerType === 'all' && styles.selectedSellerTypeText]}>
                          All ({businessCounts.all})
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.sellerTypeButton, sellerType === 'individual' && styles.selectedSellerType]}
                        onPress={() => onSellerTypeChange && onSellerTypeChange('individual')}
                      >
                        <MaterialCommunityIcons name="account" size={20} color={sellerType === 'individual' ? '#fff' : '#2196F3'} />
                        <Text style={[styles.sellerTypeText, sellerType === 'individual' && styles.selectedSellerTypeText]}>
                          Individual ({businessCounts.individual})
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.sellerTypeButton, sellerType === 'business' && styles.selectedSellerType]}
                        onPress={() => onSellerTypeChange && onSellerTypeChange('business')}
                      >
                        <MaterialCommunityIcons name="store" size={20} color={sellerType === 'business' ? '#fff' : '#FF9800'} />
                        <Text style={[styles.sellerTypeText, sellerType === 'business' && styles.selectedSellerTypeText]}>
                          Business ({businessCounts.business})
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={styles.modalSection}>
                    <Text style={styles.sectionTitle}>Price Range</Text>
                    <PriceRange
                      onPriceChange={handlePriceRangeChange}
                      initialMin={localPriceRange.min}
                      initialMax={localPriceRange.max}
                      style={styles.priceRange}
                      hideTitle
                      max={1000}
                    />
                  </View>

                  <View style={styles.modalActions}>
                    <TouchableOpacity style={styles.resetButton} onPress={handleResetAllFilters}>
                      <Text style={styles.resetButtonText}>Reset All</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.applyButton} onPress={applyFilters}>
                      <Text style={styles.applyButtonText}>Apply Filters</Text>
                    </TouchableOpacity>
                  </View>
                </ScrollView>
              </Animated.View>
            </Pressable>
          </Animated.View>
        </Modal>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  mainContainer: { backgroundColor: '#fff' },

  activeFiltersContainer: { paddingVertical: 5 },
  activeFiltersContent: { paddingHorizontal: 16 },
  filterPill: {
    backgroundColor: '#f0f9f0',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 8,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0f0e0',
  },
  filterPillText: { fontSize: 12, color: '#4CAF50', marginHorizontal: 6, fontWeight: '500' },
  clearAllButton: { paddingVertical: 6, paddingHorizontal: 10 },
  clearAllText: { fontSize: 12, color: '#f44336', fontWeight: '600' },

  controlsRowScroll: {
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: 6,
    overflow: 'hidden',
    borderBottomWidth: 0,
  },
  controlsRowInner: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sortContainer: { marginRight: 8, flexShrink: 0 },

  // Filters chip — neutral by default
  filterButton: {
    height: CHIP_H,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 70,
    maxWidth: 120,
    marginRight: 8,
  },
  filterButtonText: { fontSize: 13.5, color: '#333', fontWeight: '600' },
  // Active state when any filter is applied
  filterButtonActive: {
    backgroundColor: '#e6f7e6',
    borderColor: '#cfead0',
  },
  filterButtonActiveText: {
    color: '#2e7d32',
    fontWeight: '700',
  },

  mapToggleCompact: {
    alignSelf: 'center',
    flexShrink: 0,
  },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalBackdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center' },
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
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#eee' },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  closeButton: { padding: 6, borderRadius: 20, backgroundColor: '#f5f5f5' },
  modalSection: { padding: 20, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  sectionTitle: { fontSize: 17, fontWeight: '600', marginBottom: 16, color: '#333', textAlign: 'center' },
  sellerTypeButtons: { flexDirection: 'column', gap: 12 },
  sellerTypeButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 8, borderWidth: 1, borderColor: '#ddd', backgroundColor: '#f9f9f9' },
  selectedSellerType: { backgroundColor: GREEN, borderColor: GREEN },
  sellerTypeText: { fontSize: 14, color: '#333', marginLeft: 8, fontWeight: '500' },
  selectedSellerTypeText: { color: '#fff' },
  priceRange: { marginTop: 8 },
  modalActions: { flexDirection: 'row', justifyContent: 'space-between', padding: 20 },
  resetButton: { paddingVertical: 12, paddingHorizontal: 18, borderRadius: 8, borderWidth: 1, borderColor: '#ddd' },
  resetButtonText: { fontSize: 15, color: '#666', fontWeight: '500' },
  applyButton: { backgroundColor: GREEN, paddingVertical: 12, paddingHorizontal: 26, borderRadius: 8 },
  applyButtonText: { fontSize: 15, color: '#fff', fontWeight: '600' },
});

export default FilterSection;
