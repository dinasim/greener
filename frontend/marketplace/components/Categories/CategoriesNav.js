import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import FontAwesome5 from 'react-native-vector-icons/FontAwesome5';
import Entypo from 'react-native-vector-icons/Entypo';
import Ionicons from 'react-native-vector-icons/Ionicons';

const CategoriesNav = () => {
  const navigation = useNavigation();

  const categories = [
    {
      id: 'all',
      label: 'All',
      icon: <Entypo name="list" size={16} color="#333" />,
      color: '#333'
    },
    {
      id: 'indoor',
      label: 'Indoor Plants',
      icon: <MaterialCommunityIcons name="home-outline" size={16} color="orange" />,
      color: 'orange'
    },
    {
      id: 'succulents',
      label: 'Succulents',
      icon: <MaterialCommunityIcons name="flower" size={16} color="#4a88f9" />,
      color: '#4a88f9'
    },
    {
      id: 'outdoor',
      label: 'Outdoor Plants',
      icon: <MaterialCommunityIcons name="home-variant" size={16} color="#f95a5a" />,
      color: '#f95a5a'
    },
    {
      id: 'tools',
      label: 'Tools & Tech',
      icon: <Ionicons name="hardware-chip-outline" size={16} color="#444" />,
      color: '#444'
    },
    {
      id: 'cactus',
      label: 'Cactus',
      icon: <FontAwesome5 name="seedling" size={16} color="#f0f342" />,
      color: '#f0f342'
    },
    {
      id: 'seeds',
      label: 'Seeds',
      icon: <FontAwesome5 name="leaf" size={16} color="#f57ecb" />,
      color: '#f57ecb'
    },
    {
      id: 'garden',
      label: 'Garden',
      icon: <MaterialCommunityIcons name="shovel" size={16} color="#5aeb5a" />,
      color: '#5aeb5a'
    }
  ];

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.header}>Categories</Text>
      <View style={styles.buttonContainer}>
        {categories.map(cat => (
          <TouchableOpacity
            key={cat.id}
            style={[styles.button, { borderColor: cat.color }]}
            onPress={() => navigation.navigate('Category', { category: cat.id })}
          >
            {cat.icon}
            <Text style={styles.label}>{cat.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: '5%',
    alignItems: 'center'
  },
  header: {
    fontSize: 24,
    fontFamily: 'serif',
    marginBottom: '3%'
  },
  buttonContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center'
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    margin: 5
  },
  label: {
    fontSize: 16,
    marginLeft: 6
  }
});

export default CategoriesNav;
