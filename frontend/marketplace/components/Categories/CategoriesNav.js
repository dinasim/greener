import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/FontAwesome5';
import styles from '../styles/categories_nav_styles'; // ⬅️ external style file

const categories = [
  { id: 'all', label: 'All', icon: 'sort-alpha-down', color: '#fff' },
  { id: 'properties', label: 'Properties', icon: 'building', color: 'orange' },
  { id: 'auto', label: 'Auto', icon: 'car', color: '#4a88f9' },
  { id: 'home', label: 'Home', icon: 'home', color: '#f95a5a' },
  { id: 'electronics', label: 'Electronics', icon: 'mobile-alt', color: '#7f8c8d' },
  { id: 'clothes', label: 'Clothes', icon: 'tshirt', color: '#f0f342' },
  { id: 'toys', label: 'Toys', icon: 'puzzle-piece', color: '#f57ecb' },
  { id: 'garden', label: 'Garden', icon: 'leaf', color: '#5aeb5a' },
];

export default function CategoriesNav() {
  const navigation = useNavigation();

  const handlePress = (category) => {
    navigation.navigate('MarketplaceCategory', { category });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Categories</Text>
      <ScrollView contentContainerStyle={styles.grid}>
        {categories.map((cat) => (
          <TouchableOpacity key={cat.id} style={styles.button} onPress={() => handlePress(cat.id)}>
            <Icon name={cat.icon} size={18} color={cat.color} style={styles.icon} />
            <Text style={styles.label}>{cat.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}
