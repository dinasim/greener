import React from 'react';
import {
  View,
  StyleSheet,
} from 'react-native';
import SortOptions from './SortOptions';
import PriceRange from './PriceRange';

/**
 * Combined filter section that matches web layout with sort on left and price on right
 */
const FilterSection = ({
  sortOption,
  onSortChange,
  priceRange = { min: 0, max: 1000 },
  onPriceChange,
}) => {
  const handlePriceRangeChange = (range) => {
    if (onPriceChange) {
      onPriceChange({ min: range[0], max: range[1] });
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.filterRow}>
        {/* Sort Options */}
        <SortOptions 
          selectedOption={sortOption}
          onSelectOption={onSortChange}
          style={styles.sortOptions} // Align Sort Options to the left
        />
        
        {/* Price Range Filter */}
        <PriceRange
          onPriceChange={handlePriceRangeChange}
          initialMin={priceRange.min}
          initialMax={priceRange.max}
          style={styles.priceRangeContainer} // Move Price Range to the left
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    alignItems: 'center', // Keep FilterSection centered
  },
  filterRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start', // Align everything to the left
    alignItems: 'center',
    width: '100%',
    maxWidth: 1000,
    paddingHorizontal: 16, // Padding to the left
  },
  priceRangeContainer: {
    marginLeft: 8, // Move Price Range slightly to the left
    width: '50%',
  },
  sortOptions: {
    marginRight: 16, // Provide space between Sort Options and Price Range
  }
});

export default FilterSection;
