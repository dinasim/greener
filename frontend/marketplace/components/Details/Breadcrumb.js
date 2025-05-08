import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';

const BreadcrumbNav = ({ params }) => {
  const navigation = useNavigation();

  return (
    <View style={styles.breadcrumbContainer}>
      <TouchableOpacity onPress={() => navigation.navigate('Home')}>
        <Text style={styles.breadcrumbItem}>Home</Text>
      </TouchableOpacity>

      <Text style={styles.separator}>›</Text>

      <TouchableOpacity onPress={() => navigation.navigate('Marketplace', { category: params.category })}>
        <Text style={styles.breadcrumbItem}>{params.category}</Text>
      </TouchableOpacity>

      <Text style={styles.separator}>›</Text>

      <TouchableOpacity onPress={() => navigation.navigate('ProductDetails', { plantId: params._id, category: params.category })}>
        <Text style={styles.breadcrumbItem}>{params.title}</Text>
      </TouchableOpacity>
    </View>
  );
};

export default BreadcrumbNav;

const styles = StyleSheet.create({
  breadcrumbContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  breadcrumbItem: {
    color: '#2e7d32',
    fontWeight: 'bold',
    fontSize: 16,
    textDecorationLine: 'underline',
  },
  separator: {
    marginHorizontal: 5,
    fontSize: 16,
    color: '#444',
  },
});
