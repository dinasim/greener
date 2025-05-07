import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';

const BreadcrumbNav = ({ params }) => {
  const navigation = useNavigation();

  return (
    <View style={styles.breadcrumbContainer}>
      <TouchableOpacity onPress={() => navigation.navigate('Home')}>
        <Text style={styles.link}>Home</Text>
      </TouchableOpacity>
      <Text style={styles.separator}>{'>'}</Text>
      <TouchableOpacity onPress={() => navigation.navigate('Category', { category: params.category })}>
        <Text style={styles.link}>{params.category}</Text>
      </TouchableOpacity>
      <Text style={styles.separator}>{'>'}</Text>
      <Text style={styles.current}>{params.title}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  breadcrumbContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    flexWrap: 'wrap',
  },
  link: {
    color: '#007bff',
    textDecorationLine: 'underline',
    fontSize: 14,
    marginRight: 5
  },
  separator: {
    marginHorizontal: 5,
    fontSize: 14,
    color: '#555'
  },
  current: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    flexShrink: 1
  }
});

export default BreadcrumbNav;
