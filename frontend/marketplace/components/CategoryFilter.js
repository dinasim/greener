// Improved CategoryFilter component with better data handling
// Replace relevant parts of components/CategoryFilter.js

import React, { useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

/**
 * Default categories with icons that will be used if none are provided
 */
const DEFAULT_CATEGORIES = [
  { id: 'All', label: 'All Plants', icon: 'flower-outline' },
  { id: 'indoor', label: 'Indoor', icon: 'home' },
  { id: 'outdoor', label: 'Outdoor', icon: 'tree' },
  { id: 'succulent', label: 'Succulents', icon: 'cactus' },
  { id: 'herb', label: 'Herbs', icon: 'leaf' },
  { id: 'tropical', label: 'Tropical', icon: 'palm-tree' },
  { id: 'flowering', label: 'Flowering', icon: 'flower' },
  { id: 'seeds', label: 'Seeds', icon: 'seed-outline' },
  { id: 'accessories', label: 'Accessories', icon: 'pot-mix-outline' },
];

/**
 * Responsive plant categories filter component
 * @param {Object} props Component props
 * @param {Array} props.categories Categories array (optional)
 * @param {string} props.selectedCategory Currently selected category ID
 * @param {Function} props.onSelect Callback when category is selected
 * @param {string} props.heading Section heading (optional)
 */
const CategoryFilter = ({
  categories,
  selectedCategory = 'All',
  onSelect,
  heading = 'Categories'
}) => {
  // Use provided categories or fall back to defaults
  const categoryList = useMemo(() => {
    // Handle cases where categories is null, undefined or not an array
    if (!categories || !Array.isArray(categories) || categories.length === 0) {
      return DEFAULT_CATEGORIES;
    }
    
    // Ensure all categories have required properties
    return categories.map(category => {
      // Handle if category is just a string
      if (typeof category === 'string') {
        return {
          id: category,
          label: category,
          icon: 'tag'
        };
      }
      
      // Ensure ID is available and unique
      const id = category.id || category.value || category.name || category;
      
      // Return normalized category object
      return {
        id,
        label: category.label || category.name || id,
        icon: category.icon || 'tag'
      };
    });
  }, [categories]);

  // Determine if button text should be shown based on screen size
  const showText = width > 500;

  return (
    <View style={styles.container}>
      {heading ? <Text style={styles.heading}>{heading}</Text> : null}
      <View style={styles.scrollViewWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[
            styles.scrollContent,
            categoryList.length < 5 && styles.centeredContent
          ]}
        >
          {categoryList.map((category) => (
            <TouchableOpacity
              key={category.id}
              style={[
                styles.categoryButton,
                selectedCategory === category.id && styles.selectedButton
              ]}
              onPress={() => onSelect(category.id)}
              activeOpacity={0.7}
              accessible={true}
              accessibilityLabel={category.label}
              accessibilityRole="button"
              accessibilityState={{ selected: selectedCategory === category.id }}
            >
              <MaterialCommunityIcons
                name={category.icon}
                size={20}
                color={selectedCategory === category.id ? '#fff' : '#4CAF50'}
              />
              {showText && (
                <Text
                  style={[
                    styles.categoryText,
                    selectedCategory === category.id && styles.selectedText
                  ]}
                  numberOfLines={1}
                >
                  {category.label}
                </Text>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    paddingVertical: 12,
    paddingHorizontal: 8,
    width: '100%',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  heading: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    color: '#333',
    textAlign: 'center', // Center the heading
  },
  scrollViewWrapper: {
    alignItems: 'center', // Center the ScrollView
    width: '100%',
  },
  scrollContent: {
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  centeredContent: {
    justifyContent: 'center', // Center items if few categories
  },
  categoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f9f0',
    paddingVertical: 8,
    paddingHorizontal: width > 600 ? 16 : 12,
    borderRadius: 20,
    marginHorizontal: 4,
    marginVertical: 2,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  selectedButton: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },
  categoryText: {
    marginLeft: 6,
    fontWeight: '500',
    color: '#4CAF50',
    fontSize: width > 800 ? 14 : 12,
  },
  selectedText: {
    color: '#fff',
  },
});

export default CategoryFilter;