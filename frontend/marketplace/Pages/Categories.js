import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ActivityIndicator,
  FlatList,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { getAll } from '../services/productData';
import ProductCard from '../components/ProductCard';

export default function MarketplaceScreen({ route }) {
  const currentCategory = route?.params?.category || null;
  const [products, setProducts] = useState([]);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState('oldest');

  useEffect(() => {
    setPage(1);
    setLoading(true);
    setQuery('');
    getAll(1, currentCategory)
      .then(res => {
        setProducts(res.products || []);
        setPage(2);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, [currentCategory]);

  useEffect(() => {
    setPage(1);
    setLoading(true);
    getAll(1, currentCategory, query)
      .then(res => {
        setProducts(res.products || []);
        setPage(2);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, [query]);

  const fetchMore = () => {
    getAll(page, currentCategory, query)
      .then(res => {
        setProducts(prev => [...prev, ...(res.products || [])]);
        setPage(prev => prev + 1);
      })
      .catch(err => console.error(err));
  };

  const sortProducts = (a, b) => {
    if (sort === 'oldest') return a.addedAt.localeCompare(b.addedAt);
    if (sort === 'newest') return b.addedAt.localeCompare(a.addedAt);
    if (sort === 'lowerPrice') return a.price - b.price;
    if (sort === 'biggerPrice') return b.price - a.price;
    return 0;
  };

  return (
    <View style={styles.container}>
      <TextInput
        placeholder="Search..."
        value={query}
        onChangeText={setQuery}
        style={styles.searchBar}
      />

      <View style={styles.sortButtons}>
        {['oldest', 'newest', 'lowerPrice', 'biggerPrice'].map(option => (
          <TouchableOpacity key={option} onPress={() => setSort(option)} style={styles.sortButton}>
            <Text style={styles.sortText}>{option}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator size="large" />
      ) : (
        <FlatList
          data={[...products].sort(sortProducts)}
          keyExtractor={item => item._id}
          renderItem={({ item }) => <ProductCard product={item} />}
          onEndReached={fetchMore}
          onEndReachedThreshold={0.5}
          numColumns={2}
          contentContainerStyle={styles.list}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 10, backgroundColor: '#fff' },
  searchBar: {
    borderWidth: 1,
    borderColor: '#aaa',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  sortButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 10,
  },
  sortButton: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: '#e0e0e0',
  },
  sortText: {
    fontWeight: 'bold',
    textTransform: 'capitalize',
  },
  list: {
    gap: 10,
  },
});
