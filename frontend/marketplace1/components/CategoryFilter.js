import React from 'react';
import { ScrollView, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

const CategoryFilter = ({ categories, selectedCategory, onSelect }) => {
  // Helper function to get icon name based on category
  const getCategoryIcon = (category) => {
    switch (category.toLowerCase()) {
      case 'indoor plants':
        return 'home';
      case 'outdoor plants':
        return 'nature';
      case 'succulents':
        return 'spa';
      case 'cacti':
        return 'filter-vintage';
      case 'flowering plants':
        return 'local-florist';
      case 'air plants':
        return 'air';
      case 'herbs':
        return 'eco';
      case 'vegetable plants':
        return 'grass';
      case 'all':
      default:
        return 'apps';
    }
  };

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {categories.map((category) => (
        <TouchableOpacity
          key={category}
          style={[
            styles.categoryButton,
            selectedCategory === category && styles.selectedCategoryButton,
          ]}
          onPress={() => onSelect(category)}
        >
          <MaterialIcons
            name={getCategoryIcon(category)}
            size={20}
            color={selectedCategory === category ? '#fff' : '#4CAF50'}
            style={styles.icon}
          />
          <Text
            style={[
              styles.categoryText,
              selectedCategory === category && styles.selectedCategoryText,
            ]}
          >
            {category}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  categoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f2f2f2',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginHorizontal: 6,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  selectedCategoryButton: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },
  icon: {
    marginRight: 6,
  },
  categoryText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  selectedCategoryText: {
    color: '#fff',
  },
});

export default CategoryFilter;