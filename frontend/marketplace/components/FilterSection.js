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
 * Map toggle is included but map functionality is temporarily disabled
 */
const FilterSection = ({
  sortOption,
  onSortChange,
  priceRange = { min: 0, max: 1000 },
  onPriceChange,
  viewMode = 'grid', // 'grid' or 'list' only for now
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
        
        {/* Empty middle space to push sort left and map toggle right */}
        <View style={styles.spacer} />
        
        {/* View Toggle - Right side */}
        <View style={styles.viewSwitchContainer}>
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
    alignItems: 'center',
  },
  sortContainer: {
    // Left aligned
  },
  spacer: {
    flex: 1, // Takes available space to push sort options left and view toggle right
  },
  viewSwitchContainer: {
    // Right aligned
  },
});

export default FilterSection;