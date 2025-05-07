import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, ActivityIndicator, StyleSheet } from 'react-native';
import ProductCard from '../../ProductCard/ProductCard';
import { getUserWishlist } from '../../../services/userData';

const Wishlist = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getUserWishlist()
      .then(res => {
        const activeItems = (res.wishlist || []).filter(x => x.active === true);
        setProducts(activeItems);
        setLoading(false);
      })
      .catch(err => {
        console.log(err);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return <ActivityIndicator size="large" style={styles.loader} />;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Wishlist</Text>
      {products.length > 0 ? (
        <FlatList
          data={products}
          keyExtractor={item => item._id}
          numColumns={2}
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
  loader: {
    flex: 1,
    justifyContent: 'center'
  },
  cardWrapper: {
    flex: 1,
    padding: 8
  },
  emptyText: {
    textAlign: 'center',
    fontFamily: 'serif',
    fontSize: 20
  }
});

export default Wishlist;
