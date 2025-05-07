import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import dayjs from 'dayjs';
import localizedFormat from 'dayjs/plugin/localizedFormat';

dayjs.extend(localizedFormat);

const ProductCard = ({ product }) => {
  const navigation = useNavigation();

  return (
    <TouchableOpacity
      onPress={() =>
        navigation.navigate('ProductDetailsScreen', {
          category: product.category,
          id: product._id
        })
      }
    >
      <View style={styles.card}>
        <Image source={{ uri: product.image }} style={styles.image} resizeMode="cover" />
        <View style={styles.body}>
          <Text style={styles.title}>{product.title}</Text>
          <Text style={styles.price}>{parseFloat(product.price).toFixed(2)}€</Text>
        </View>
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            {dayjs(product.addedAt).format('D MMM YYYY (dddd) HH:mm')} –{' '}
            <Text style={{ fontWeight: 'bold' }}>{product.city}</Text>
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 30,
    elevation: 3
  },
  image: {
    height: 200,
    width: '100%'
  },
  body: {
    padding: 12
  },
  title: {
    fontSize: 16,
    fontWeight: '600'
  },
  price: {
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'right',
    marginTop: 4
  },
  footer: {
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: '#eee'
  },
  footerText: {
    fontSize: 12,
    textAlign: 'right',
    color: '#555'
  }
});

export default ProductCard;
