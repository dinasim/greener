// marketplace/pages/Categories.js

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Pressable
} from 'react-native';
import { getAll } from '../services/productData';
import ProductCard from '../components/ProductCard/ProductCard';
import CategoriesNav from '../components/Categories/CategoriesNav';
import { AntDesign, MaterialIcons, FontAwesome5 } from '@expo/vector-icons';

const Categories = ({ route }) => {
  const currentCategory = route?.params?.category || 'all';
  const [products, setProducts] = useState([]);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState('oldest');
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    setPage(1);
    setQuery('');
    setLoading(true);
    getAll(1, currentCategory)
      .then((res) => {
        setProducts(res || []);
        setLoading(false);
        setPage(2);
      })
      .catch((err) => console.log(err));
  }, [currentCategory]);

  useEffect(() => {
    setPage(1);
    setLoading(true);
    getAll(2, currentCategory, query)
      .then((res) => {
        if (query === '') {
          setProducts((prev) => [...prev, ...(res || [])]);
        } else {
          setProducts(res || []);
        }
        setLoading(false);
        setPage((prev) => prev + 1);
      })
      .catch((err) => console.log(err));
  }, [query]);

  const loadMore = () => {
    getAll(page, currentCategory).then((res) => {
      setProducts((prev) => [...prev, ...(res || [])]);
      setPage((prev) => prev + 1);
    });
  };

  const handleSort = (type) => {
    setSort(type);
    setModalVisible(false);
  };

  const sortedProducts = products.slice().sort((a, b) => {
    if (sort === 'oldest') return a.addedAt.localeCompare(b.addedAt);
    if (sort === 'newest') return b.addedAt.localeCompare(a.addedAt);
    if (sort === 'lowerPrice') return parseFloat(a.price) - parseFloat(b.price);
    if (sort === 'biggerPrice') return parseFloat(b.price) - parseFloat(a.price);
    return 0;
  });

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.searchInput}
        placeholder="Search..."
        value={query}
        onChangeText={setQuery}
      />

      <CategoriesNav />

      <View style={styles.sortButtonWrapper}>
        <TouchableOpacity onPress={() => setModalVisible(true)} style={styles.sortButton}>
          <Text style={styles.sortButtonText}>Sort</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Pressable onPress={() => handleSort('oldest')}><Text>⬇️ Oldest</Text></Pressable>
            <Pressable onPress={() => handleSort('newest')}><Text>⬆️ Newest</Text></Pressable>
            <Pressable onPress={() => handleSort('lowerPrice')}><Text>⬇️ Low Price</Text></Pressable>
            <Pressable onPress={() => handleSort('biggerPrice')}><Text>⬆️ High Price</Text></Pressable>
            <Pressable onPress={() => setModalVisible(false)}><Text style={{ marginTop: 10, color: 'red' }}>Close</Text></Pressable>
          </View>
        </View>
      </Modal>

      {loading ? (
        <ActivityIndicator size="large" color="#888" style={styles.loader} />
      ) : (
        <FlatList
          data={sortedProducts}
          keyExtractor={(item) => item._id}
          numColumns={2}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          renderItem={({ item }) => (
            <View style={styles.cardWrapper}>
              <ProductCard product={item} />
            </View>
          )}
          ListFooterComponent={<View style={{ height: 100 }} />}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 12,
    backgroundColor: '#fff',
  },
  searchInput: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
    fontSize: 16,
  },
  sortButtonWrapper: {
    alignItems: 'center',
    marginBottom: 10,
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderWidth: 1,
    borderRadius: 20,
    borderColor: '#aaa',
    backgroundColor: '#eee',
  },
  sortButtonText: {
    marginRight: 8,
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: 250,
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 10,
    gap: 10,
  },
  cardWrapper: {
    flex: 1,
    padding: 8,
  },
  loader: {
    marginTop: 50,
  },
});

export default Categories;
