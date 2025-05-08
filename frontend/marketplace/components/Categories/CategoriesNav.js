import React from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity } from 'react-native';
import { 
  MaterialCommunityIcons, 
  FontAwesome5, 
  Feather 
} from '@expo/vector-icons';

const categories = [
  { id: 'all', label: 'All', icon: 'leaf' },
  { id: 'indoor', label: 'Indoor', icon: 'home' },
  { id: 'outdoor', label: 'Outdoor', icon: 'tree' },
  { id: 'succulent', label: 'Succulents', icon: 'sprout' },
  { id: 'flowers', label: 'Flowers', icon: 'flower' },
];

const CategoriesNav = ({ onSelectCategory, searchQuery, onSearchChange }) => {
  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search plants..."
          placeholderTextColor="#888"
          value={searchQuery}
          onChangeText={onSearchChange}
        />
        <Feather name="search" size={20} color="#888" style={styles.searchIcon} />
      </View>

      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoriesContainer}
      >
        {categories.map((category) => (
          <TouchableOpacity
            key={category.id}
            style={styles.categoryButton}
            onPress={() => onSelectCategory(category.id)}
          >
            <MaterialCommunityIcons 
              name={category.icon} 
              size={20} 
              color="#4CAF50" 
            />
            <Text style={styles.categoryText}>{category.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  searchContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  searchInput: {
    backgroundColor: '#f5f5f5',
    borderRadius: 25,
    paddingVertical: 10,
    paddingHorizontal: 45,
    fontSize: 16,
  },
  searchIcon: {
    position: 'absolute',
    left: 15,
    top: 12,
  },
  categoriesContainer: {
    paddingHorizontal: 5,
  },
  categoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f9f0',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 15,
    marginRight: 10,
  },
  categoryText: {
    marginLeft: 8,
    color: '#2E7D32',
    fontWeight: '500',
  },
});

export default CategoriesNav;