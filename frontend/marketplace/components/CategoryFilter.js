import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

/**
 * Plant categories filter component
 * @param {Object} props - Component props
 * @param {Array} props.categories - Array of category objects
 * @param {string} props.selectedCategory - Currently selected category
 * @param {Function} props.onSelect - Handler function when category is selected
 */
const CategoryFilter = ({
  categories = defaultCategories,
  selectedCategory = 'All',
  onSelect
}) => {
  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Categories</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {categories.map((category) => (
          <TouchableOpacity
            key={category.id}
            style={[
              styles.categoryButton,
              selectedCategory === category.id && styles.selectedButton
            ]}
            onPress={() => onSelect(category.id)}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons
              name={category.icon}
              size={20}
              color={selectedCategory === category.id ? '#fff' : '#4CAF50'}
            />
            <Text
              style={[
                styles.categoryText,
                selectedCategory === category.id && styles.selectedText
              ]}
            >
              {category.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

// Default categories with icons
const defaultCategories = [
  { id: 'All', label: 'All Plants', icon: 'flower-outline' },
  { id: 'indoor', label: 'Indoor', icon: 'home' },
  { id: 'outdoor', label: 'Outdoor', icon: 'tree' },
  { id: 'succulent', label: 'Succulents', icon: 'cactus' },
  { id: 'herb', label: 'Herbs', icon: 'leaf' },
  { id: 'tropical', label: 'Tropical', icon: 'palm-tree' },
  { id: 'flowering', label: 'Flowering', icon: 'flower' },
];

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    paddingVertical: 16,
  },
  heading: {
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 16,
    marginBottom: 12,
    color: '#333',
  },
  scrollContent: {
    paddingHorizontal: 12,
  },
  categoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f9f0',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  selectedButton: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },
  categoryText: {
    marginLeft: 8,
    fontWeight: '500',
    color: '#4CAF50',
  },
  selectedText: {
    color: '#fff',
  },
});

export default CategoryFilter;
