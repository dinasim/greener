// marketplace/components/Categories/CategoriesNav.js

import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons, FontAwesome5, Entypo, Feather } from '@expo/vector-icons';

const categories = [
  { id: 'all', label: 'All Plants', icon: (color) => <Feather name="list" size={16} color={color} /> },
  { id: 'indoor', label: 'Indoor', icon: (color) => <MaterialCommunityIcons name="pot-mix" size={16} color={color} /> },
  { id: 'outdoor', label: 'Outdoor', icon: (color) => <MaterialCommunityIcons name="tree" size={16} color={color} /> },
  { id: 'flowers', label: 'Flowers', icon: (color) => <MaterialCommunityIcons name="flower" size={16} color={color} /> },
  { id: 'succulents', label: 'Succulents', icon: (color) => <FontAwesome5 name="seedling" size={16} color={color} /> },
  { id: 'herbs', label: 'Herbs', icon: (color) => <MaterialCommunityIcons name="leaf" size={16} color={color} /> },
  { id: 'seeds', label: 'Seeds', icon: (color) => <Entypo name="drop" size={16} color={color} /> },
  { id: 'tools', label: 'Tools', icon: (color) => <MaterialCommunityIcons name="shovel" size={16} color={color} /> },
];

const CategoriesNav = ({ onSelectCategory }) => {
  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Plant Categories</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContainer}
      >
        {categories.map((cat) => (
          <TouchableOpacity
            key={cat.id}
            style={styles.categoryButton}
            onPress={() => onSelectCategory?.(cat.id)}
          >
            {cat.icon('#fff')}
            <Text style={styles.buttonText}>{cat.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginVertical: 16,
  },
  heading: {
    fontSize: 22,
    fontWeight: '600',
    marginBottom: 12,
    fontFamily: 'serif',
  },
  scrollContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  categoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 22,
    marginHorizontal: 6,
  },
  buttonText: {
    color: '#fff',
    marginLeft: 6,
    fontSize: 14,
  },
});

export default CategoriesNav;
