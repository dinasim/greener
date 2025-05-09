import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

/**
 * Responsive plant categories filter component
 */
const CategoryFilter = ({
  categories = defaultCategories,
  selectedCategory = 'All',
  onSelect
}) => {
  // Determine if button text should be shown based on screen size
  const showText = width > 500;

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
            {showText && (
              <Text
                style={[
                  styles.categoryText,
                  selectedCategory === category.id && styles.selectedText
                ]}
              >
                {category.label}
              </Text>
            )}
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
    paddingHorizontal: 8,
    width: '100%',
  },
  heading: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333',
    textAlign: 'center',
  },
  scrollContent: {
    paddingHorizontal: 8,
    justifyContent: 'center',
    minWidth: '100%',
  },
  categoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f9f0',
    paddingVertical: 10,
    paddingHorizontal: width > 600 ? 16 : 12,
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
    fontSize: width > 800 ? 14 : 12,
  },
  selectedText: {
    color: '#fff',
  },
});

export default CategoryFilter;