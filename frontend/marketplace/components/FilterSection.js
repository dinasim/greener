// File: components/FilterSection.js
import React from 'react';
import {
  View,
  StyleSheet,
} from 'react-native';
import SortOptions from './SortOptions';
import PriceRange from './PriceRange';
import MapToggle from './MapToggle';

/**
 * FilterSection with Map Toggle integration
 */
const FilterSection = ({
  sortOption,
  onSortChange,
  priceRange = { min: 0, max: 1000 },
  onPriceChange,
  viewMode = 'grid', // 'grid', 'list', or 'map'
  onViewModeChange,
}) => {
  const handlePriceRangeChange = (range) => {
    if (onPriceChange) {
      onPriceChange({ min: range[0], max: range[1] });
    }
  };

  return (
    <View style={styles.mainContainer}>
      {/* Price Range - Centered with narrow width */}
      <View style={styles.priceRangeContainer}>
        <PriceRange
          onPriceChange={handlePriceRangeChange}
          initialMin={priceRange.min}
          initialMax={priceRange.max}
          style={styles.priceRange}
        />
      </View>
      
      {/* Sort and View Controls Row */}
      <View style={styles.controlsRow}>
        {/* Sort Options - Left side */}
        <View style={styles.sortContainer}>
          <SortOptions 
            selectedOption={sortOption}
            onSelectOption={onSortChange}
          />
        </View>
        
        {/* Empty middle space to push sort left and map toggle center */}
        <View style={styles.spacer} />
        
        {/* View Toggle - Centered */}
        <View style={styles.viewSwitchWrapper}>
          <MapToggle 
            viewMode={viewMode} 
            onViewModeChange={onViewModeChange} 
          />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  mainContainer: {
    backgroundColor: '#fff',
    paddingBottom: 2,
  },
  priceRangeContainer: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  priceRange: {
    // Any additional styles for the price range can go here
  },
  controlsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#eee',
    position: 'relative', // For absolute positioning of view switch
  },
  sortContainer: {
    // Left aligned
  },
  spacer: {
    flex: 1, // Takes available space to push sort options left
  },
  viewSwitchWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    // This container sits on top but won't interfere with touch on SortOptions
    // because it only contains items in the center
    zIndex: 1,
    pointerEvents: 'box-none',
  }
});

export default FilterSection;