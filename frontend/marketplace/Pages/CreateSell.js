import React, { useEffect, useState } from 'react';
import { View, ScrollView, ActivityIndicator, StyleSheet } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { getSpecific } from '../services/productData';
import Breadcrumb from '../components/Details/Breadcrumb';
import ProductInfo from '../components/Details/ProductInfo/ProductInfo';
import Aside from '../components/Details/Aside/Aside';

export default function ProductDetailsScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { id: productId } = route.params;

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSpecific(productId)
      .then(res => {
        setProduct(res);
        setLoading(false);
      })
      .catch(err => {
        console.error('Error fetching product:', err);
        setLoading(false);
      });
  }, [productId]);

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Breadcrumb params={product} />
      <ProductInfo params={product} />
      <Aside params={product} navigation={navigation} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#fff',
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
