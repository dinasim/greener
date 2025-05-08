import React, { useState, useEffect } from 'react';
import { View, FlatList, ActivityIndicator, StyleSheet, Text } from 'react-native';
import CategoriesNav from '../components/Categories/CategoriesNav';
import ProductCard from '../components/ProductCard/ProductCard';
import { getAll } from '../services/productData';

const Categories = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [query, setQuery] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    loadProducts();
  }, [selectedCategory, query]);

  const loadProducts = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const res = await getAll(selectedCategory, query);
      
      // Ensure we have an array and filter out any items without an id
      const validProducts = (res || []).filter(item => item && item.id);
      
      setProducts(validProducts);
    } catch (err) {
      console.error("Error loading products:", err);
      setError("Failed to load products. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleCategorySelect = (categoryId) => {
    setSelectedCategory(categoryId);
  };

  // Safe key extractor function
  const keyExtractor = (item) => {
    // Make sure item and item.id exist before calling toString()
    return item && item.id ? item.id.toString() : Math.random().toString();
  };

  return (
    <View style={styles.container}>
      <CategoriesNav
        onSelectCategory={handleCategorySelect}
        searchQuery={query}
        onSearchChange={setQuery}
      />

      {loading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color="#4CAF50" />
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : products.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No products found</Text>
        </View>
      ) : (
        <FlatList
          data={products}
          renderItem={({ item }) => item ? <ProductCard product={item} /> : null}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9f9f9',
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    color: 'red',
    fontSize: 16,
    textAlign: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    color: '#666',
    fontSize: 16,
    textAlign: 'center',
  },
  listContainer: {
    padding: 10,
  },
});

export default Categories;