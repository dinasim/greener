// components/FilterSection.js - Compact controls (no-dup chips, prettier, ₪ symbol)
import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView, Pressable,
  Animated, Dimensions, TextInput,
} from 'react-native';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import MapToggle from './MapToggle';
import PriceRange from './PriceRange';
import SortOptions from './SortOptions';
import MarketplaceFilterToggle from './MarketplaceFilterToggle';

const GREEN = '#4CAF50';
const CHIP_H = 32;

const onlyDigits = (s) => (s || '').replace(/[^\d]/g, '');
const toNum = (s, fallback = 0) => {
  const n = Number(s);
  return Number.isFinite(n) ? n : fallback;
};

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

  /** NEW: avoid double bars – off by default */
  showActiveChips = false,
  /** Optional: include a category chip in our bar when not "All" */
  includeCategoryChip = true,
}) => {
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [modalAnimation] = useState(new Animated.Value(0));

  const safeMinPrice = typeof priceRange.min === 'number' ? priceRange.min : 0;
  const safeMaxPrice = typeof priceRange.max === 'number' ? priceRange.max : 1000;
  const safePriceRange = { min: safeMinPrice, max: safeMaxPrice };

  // Local state (numbers + input strings for better UX)
  const [localPriceRange, setLocalPriceRange] = useState({ min: safeMinPrice, max: safeMaxPrice });
  const [minStr, setMinStr] = useState(String(safeMinPrice));
  const [maxStr, setMaxStr] = useState(String(safeMaxPrice));

  // Hide labels on very narrow devices
  const { width } = Dimensions.get('window');
  const hideViewLabels = width < 360;

  useEffect(() => {
    setLocalPriceRange({ min: safePriceRange.min, max: safePriceRange.max });
    setMinStr(String(safePriceRange.min));
    setMaxStr(String(safePriceRange.max));
  }, [safePriceRange.min, safePriceRange.max]);

  const handlePriceRangeChange = (range) => {
    if (Array.isArray(range) && range.length === 2) {
      const min = typeof range[0] === 'number' ? range[0] : 0;
      const max = typeof range[1] === 'number' ? range[1] : 1000;
      setLocalPriceRange({ min, max });
      setMinStr(String(min));
      setMaxStr(String(max));
    }
  };

  const applyFilters = () => {
    const minNum = toNum(minStr, 0);
    const maxNum = toNum(maxStr, 1000);
    const normalized = {
      min: Math.min(minNum, maxNum),
      max: Math.max(minNum, maxNum),
    };
    setLocalPriceRange(normalized);
    onPriceChange && onPriceChange(normalized);
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

  const handleResetAllFilters = () => {
    setLocalPriceRange({ min: 0, max: 1000 });
    setMinStr('0');
    setMaxStr('1000');
    onPriceChange && onPriceChange({ min: 0, max: 1000 });
    onSellerTypeChange && onSellerTypeChange('all');
    onResetFilters && onResetFilters();
    hideFilterModal();
  };

  const baseActiveFilterCount =
    (safePriceRange.min > 0 || safePriceRange.max < 1000 ? 1 : 0) +
    (sellerType !== 'all' ? 1 : 0) +
    (includeCategoryChip && category && category !== 'All' ? 1 : 0);

  // Build our pretty chip list (and de-dupe by label)
  const chips = useMemo(() => {
    const list = [];

    if (includeCategoryChip && category && category !== 'All') {
      list.push({
        key: 'category',
        label: String(category),
        color: '#6A5ACD',
        leftIcon: { lib: 'mc', name: 'tag' },
        onClose: () => onCategoryChange && onCategoryChange('All'),
      });
    }

    if (sellerType !== 'all') {
      const isBiz = sellerType === 'business';
      list.push({
        key: 'sellerType',
        label: isBiz ? 'Business Only' : 'Individual Only',
        color: isBiz ? '#FF9800' : '#2196F3',
        leftIcon: { lib: 'mc', name: isBiz ? 'store' : 'account' },
        onClose: () => onSellerTypeChange && onSellerTypeChange('all'),
      });
    }

    if (safePriceRange.min > 0 || safePriceRange.max < 1000) {
      list.push({
        key: 'price',
        label: `₪${safePriceRange.min} - ₪${safePriceRange.max}`,
        color: GREEN,
        leftIcon: { lib: 'mc', name: 'currency-ils' },
        onClose: () => onPriceChange && onPriceChange({ min: 0, max: 1000 }),
      });
    }

    // Bring in external activeFilters but avoid duplicate labels
    const seen = new Set(list.map(c => c.label.toLowerCase()));
    (activeFilters || []).forEach((f) => {
      const label = String(f.label || f.value || '').trim();
      if (!label) return;
      const key = `af-${f.id || label}`;
      const norm = label.toLowerCase();
      if (seen.has(norm)) return;
      seen.add(norm);
      list.push({
        key,
        label,
        color: '#4CAF50',
        leftIcon: null,
        onClose: () => onRemoveFilter && onRemoveFilter(f.id),
      });
    });

    return list;
  }, [
    activeFilters,
    category,
    includeCategoryChip,
    onCategoryChange,
    onPriceChange,
    onRemoveFilter,
    onSellerTypeChange,
    safePriceRange.max,
    safePriceRange.min,
    sellerType,
  ]);

  const activeFilterCount = chips.length || baseActiveFilterCount;

  const slideAnimation = {
    transform: [
      { scale: modalAnimation.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) },
      { translateY: modalAnimation.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) },
    ],
    opacity: modalAnimation,
  };
  const backdropAnimation = { opacity: modalAnimation };

  return (
    <View style={styles.mainContainer}>
      <MarketplaceFilterToggle
        sellerType={sellerType}
        onSellerTypeChange={onSellerTypeChange}
        counts={businessCounts}
      />

      {/* Pretty, de-duped chips — hidden by default to prevent double bars */}
      {showActiveChips && chips.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.activeFiltersContainer}
          contentContainerStyle={styles.activeFiltersContent}
        >
          {chips.map((c) => (
            <View key={c.key} style={[styles.filterPill, { borderColor: '#e6efe6', backgroundColor: '#f5fbf5' }]}>
              {c.leftIcon ? (
                c.leftIcon.lib === 'mc' ? (
                  <MaterialCommunityIcons name={c.leftIcon.name} size={14} color={c.color} />
                ) : (
                  <MaterialIcons name={c.leftIcon.name} size={14} color={c.color} />
                )
              ) : null}
              <Text style={[styles.filterPillText, { color: c.color }]} numberOfLines={1}>
                {c.label}
              </Text>
              <TouchableOpacity onPress={c.onClose} hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}>
                <MaterialIcons name="close" size={16} color="#777" />
              </TouchableOpacity>
            </View>
          ))}

          {chips.length > 1 && (
            <TouchableOpacity style={styles.clearAllButton} onPress={handleResetAllFilters}>
              <Text style={styles.clearAllText}>Clear All</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      )}

      {/* Controls row */}
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

        {/* Filters chip: neutral by default, green when active */}
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

                  {/* PRICE — compact row + tight slider */}
                  <View style={styles.modalSection}>
                    <Text style={styles.sectionTitle}>Price (₪)</Text>

                    <View style={styles.priceRow}>
                      <View style={styles.priceInput}>
                        <Text style={styles.currency}>₪</Text>
                        <TextInput
                          value={minStr}
                          onChangeText={(t) => setMinStr(onlyDigits(t))}
                          onBlur={() => setMinStr(String(toNum(minStr, 0)))}
                          placeholder="Min"
                          keyboardType="numeric"
                          returnKeyType="done"
                          style={styles.priceTextInput}
                          maxLength={6}
                        />
                      </View>

                      <View style={styles.midDivider} />

                      <View style={styles.priceInput}>
                        <Text style={styles.currency}>₪</Text>
                        <TextInput
                          value={maxStr}
                          onChangeText={(t) => setMaxStr(onlyDigits(t))}
                          onBlur={() => setMaxStr(String(toNum(maxStr, 1000)))}
                          placeholder="Max"
                          keyboardType="numeric"
                          returnKeyType="done"
                          style={styles.priceTextInput}
                          maxLength={6}
                        />
                      </View>
                    </View>

                    <PriceRange
                      onPriceChange={handlePriceRangeChange}
                      initialMin={localPriceRange.min}
                      initialMax={localPriceRange.max}
                      style={styles.priceRangeSlider}
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

  // Pretty chips row
  activeFiltersContainer: { paddingVertical: 6 },
  activeFiltersContent: { paddingHorizontal: 12, alignItems: 'center' },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 8,
    borderWidth: 1,
  },
  filterPillText: { fontSize: 12.5, marginHorizontal: 6, fontWeight: '600' },
  clearAllButton: { paddingVertical: 6, paddingHorizontal: 10 },
  clearAllText: { fontSize: 12, color: '#f44336', fontWeight: '700' },

  controlsRowScroll: {
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: 6,
    overflow: 'hidden',
    borderBottomWidth: 0,
  },
  controlsRowInner: { flexDirection: 'row', alignItems: 'center' },
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
  filterButtonActive: { backgroundColor: '#e6f7e6', borderColor: '#cfead0' },
  filterButtonActiveText: { color: '#2e7d32', fontWeight: '700' },

  mapToggleCompact: { alignSelf: 'center', flexShrink: 0 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalBackdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center' },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingBottom: 18,
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
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 14, borderBottomWidth: 1, borderBottomColor: '#eee',
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: '#333' },
  closeButton: { padding: 6, borderRadius: 20, backgroundColor: '#f5f5f5' },

  modalSection: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  sectionTitle: { fontSize: 15.5, fontWeight: '600', marginBottom: 10, color: '#333', textAlign: 'center' },

  sellerTypeButtons: { flexDirection: 'column', gap: 10 },
  sellerTypeButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 10, paddingHorizontal: 14, borderRadius: 8,
    borderWidth: 1, borderColor: '#ddd', backgroundColor: '#f9f9f9',
  },
  selectedSellerType: { backgroundColor: GREEN, borderColor: GREEN },
  sellerTypeText: { fontSize: 13.5, color: '#333', marginLeft: 8, fontWeight: '500' },
  selectedSellerTypeText: { color: '#fff' },

  // PRICE — tighter row + slider
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 6,
  },
  priceInput: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 36,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#fafafa',
    minWidth: 110,
    flexShrink: 1,
  },
  currency: { fontSize: 14, color: '#444', marginRight: 4 },
  priceTextInput: {
    flex: 1,
    fontSize: 14,
    color: '#333',
    paddingVertical: 0,
    includeFontPadding: false,
  },
  midDivider: { width: 10 },

  priceRangeSlider: { marginTop: 4, paddingVertical: 0 },

  modalActions: { flexDirection: 'row', justifyContent: 'space-between', padding: 16 },
  resetButton: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, borderWidth: 1, borderColor: '#ddd' },
  resetButtonText: { fontSize: 14, color: '#666', fontWeight: '500' },
  applyButton: { backgroundColor: GREEN, paddingVertical: 10, paddingHorizontal: 22, borderRadius: 8 },
  applyButtonText: { fontSize: 14.5, color: '#fff', fontWeight: '700' },
});

export default FilterSection;
