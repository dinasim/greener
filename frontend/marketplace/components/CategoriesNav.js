import React from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  TextInput 
} from 'react-native';
import { MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { PLANT_CATEGORIES } from '../services/categories';

const CategoriesNav = ({ onSelectCategory, searchQuery, onSearchChange }) => {
  return (
    <View style={styles.container}>
      {/* Search Bar */}
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

      {/* Categories */}
      <View style={styles.categoriesWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesContainer}
        >
          {PLANT_CATEGORIES.map((category) => (
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
  categoriesWrapper: {
    alignItems: 'center',  // Centers the categories horizontally
  },
  categoriesContainer: {
    paddingHorizontal: 5,
    alignItems: 'center',  // Ensure the categories are centered within the ScrollView
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