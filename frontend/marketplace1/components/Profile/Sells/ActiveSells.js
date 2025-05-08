import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, ActivityIndicator, StyleSheet } from 'react-native';
import ProductCard from '../../ProductCard/ProductCard';
import { getUserActiveSells } from '../../../services/userData';

const ActiveSells = ({ params }) => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (params._id) {
      getUserActiveSells(params._id)
        .then(res => {
          setProducts(res.sells || []);
          setLoading(false);
        })
        .catch(err => {
          console.log(err);
          setLoading(false);
        });
    }
  }, [params._id]);

  if (loading) {
    return <ActivityIndicator size="large" style={styles.loader} />;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Active Sells</Text>
      {products.length > 0 ? (
        <FlatList
          data={products}
          numColumns={2}
          keyExtractor={item => item._id}
          renderItem={({ item }) => (
            <View style={styles.cardWrapper}>
              <ProductCard params={item} />
            </View>
          )}
        />
      ) : (
        <Text style={styles.emptyText}>Nothing to show</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16
  },
  heading: {
    fontSize: 22,
    fontWeight: '600',
    textAlign: 'center',
    marginVertical: 16,
    fontFamily: 'serif'
  },
  cardWrapper: {
    flex: 1,
    padding: 8
  },
  loader: {
    flex: 1,
    justifyContent: 'center'
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 16,
    color: '#888',
    marginTop: 20
  }
});

export default ActiveSells;
