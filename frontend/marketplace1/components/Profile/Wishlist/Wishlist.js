import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, FlatList, StyleSheet, Dimensions } from 'react-native';
import ProductCard from '../../ProductCard/ProductCard';
import { getUserWishlist } from '../../../services/userData';

const Wishlist = () => {
  const [products, setProduct] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getUserWishlist()
      .then(res => {
        const activeProducts = res.wishlist.filter(x => x.active === true);
        setProduct(activeProducts);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  const numColumns = Dimensions.get('window').width > 768 ? 2 : 1;

  return (
    <View style={styles.container}>
      {loading ? (
        <ActivityIndicator size="large" color="#2e7d32" />
      ) : (
        <>
          <Text style={styles.heading}>Wishlist</Text>
          {products.length > 0 ? (
            <FlatList
              data={products}
              keyExtractor={item => item._id.toString()}
              renderItem={({ item }) => (
                <View style={styles.cardWrapper}>
                  <ProductCard params={item} />
                </View>
              )}
              numColumns={numColumns}
              contentContainerStyle={styles.cardList}
            />
          ) : (
            <Text style={styles.nothing}>Nothing to show</Text>
          )}
        </>
      )}
    </View>
  );
};

export default Wishlist;

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#fff',
  },
  heading: {
    fontSize: 26,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
  },
  nothing: {
    textAlign: 'center',
    fontFamily: 'serif',
    fontSize: 20,
    marginTop: 30,
  },
  cardList: {
    gap: 16,
    paddingBottom: 40,
  },
  cardWrapper: {
    flex: 1,
    padding: 8,
  },
});
