import React, { useState, useEffect } from 'react';
import { 
  View, 
  FlatList, 
  ActivityIndicator, 
  StyleSheet, 
  Text,
  TouchableOpacity,
  Image
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import Header from '../components/Header/Header';
import CategoriesNav from '../components/Categories/CategoriesNav';
import { getAll } from '../services/productData';

// Sample product data (to be replaced with API call)
const sampleProducts = [
  {
    id: '1',
    name: 'Monstera Deliciosa',
    description: 'Beautiful Swiss Cheese Plant with large fenestrated leaves',
    price: 29.99,
    image: 'https://via.placeholder.com/150',
    seller: 'PlantLover123',
    rating: 4.5,
    category: 'indoor'
  },
  {
    id: '2',
    name: 'Snake Plant',
    description: 'Low maintenance indoor plant, perfect for beginners',
    price: 19.99,
    image: 'https://via.placeholder.com/150',
    seller: 'GreenThumb',
    rating: 4.8,
    category: 'indoor'
  },
  {
    id: '3',
    name: 'Fiddle Leaf Fig',
    description: 'Trendy houseplant with violin-shaped leaves',
    price: 34.99,
    image: 'https://via.placeholder.com/150',
    seller: 'PlantPro',
    rating: 4.2,
    category: 'indoor'
  },
  {
    id: '4',
    name: 'Cactus Collection',
    description: 'Set of 3 small decorative cacti',
    price: 18.99,
    image: 'https://via.placeholder.com/150',
    seller: 'DesertDreams',
    rating: 4.9,
    category: 'succulent'
  },
  {
    id: '5',
    name: 'Lavender Plant',
    description: 'Fragrant flowering plant perfect for outdoors',
    price: 15.99,
    image: 'https://via.placeholder.com/150',
    seller: 'GardenGuru',
    rating: 4.6,
    category: 'outdoor'
  },
  {
    id: '6',
    name: 'Rose Bush',
    description: 'Classic red rose bush for your garden',
    price: 22.99,
    image: 'https://via.placeholder.com/150',
    seller: 'FlowerPower',
    rating: 4.7,
    category: 'flowers'
  }
];

const Categories = () => {
  const navigation = useNavigation();
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  // Fetch products on component mount
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        // For now, use sample data instead of API call
        // const data = await getAll();
        const data = sampleProducts;
        setProducts(data);
        setFilteredProducts(data);
        setLoading(false);
      } catch (err) {
        setError('Failed to load products. Please try again later.');
        setLoading(false);
      }
    };

    fetchProducts();
  }, []);

  // Filter products when search query or category changes
  useEffect(() => {
    let result = [...products];
    
    // Filter by category if not 'all'
    if (selectedCategory !== 'all') {
      result = result.filter(product => product.category === selectedCategory);
    }
    
    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(product => 
        product.name.toLowerCase().includes(query) || 
        product.description.toLowerCase().includes(query)
      );
    }
    
    setFilteredProducts(result);
  }, [searchQuery, selectedCategory, products]);

  const handleCategorySelect = (category) => {
    setSelectedCategory(category);
  };

  const handleSearch = (text) => {
    setSearchQuery(text);
  };

  const handleProductPress = (product) => {
    navigation.navigate('ProductDetails', { product });
  };

  // Product card component
  const ProductCard = ({ item }) => (
    <TouchableOpacity 
      style={styles.productCard}
      onPress={() => handleProductPress(item)}
    >
      <Image source={{ uri: item.image }} style={styles.productImage} />
      <View style={styles.productContent}>
        <Text style={styles.productName}>{item.name}</Text>
        <Text style={styles.productPrice}>${item.price.toFixed(2)}</Text>
        <View style={styles.ratingContainer}>
          <MaterialCommunityIcons name="star" size={16} color="#FFD700" />
          <Text style={styles.ratingText}>{item.rating.toFixed(1)}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <Header title="Plant Marketplace" />
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color="#4CAF50" />
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Header title="Plant Marketplace" />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title="Plant Marketplace" />
      <CategoriesNav
        onSelectCategory={handleCategorySelect}
        searchQuery={searchQuery}
        onSearchChange={handleSearch}
      />
      
      {filteredProducts.length === 0 ? (
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons name="plant-off" size={50} color="#2E7D32" />
          <Text style={styles.emptyText}>No plants found</Text>
          <Text style={styles.emptySubtext}>Try a different search or category</Text>
        </View>
      ) : (
        <FlatList
          data={filteredProducts}
          renderItem={({ item }) => <ProductCard item={item} />}
          keyExtractor={(item) => item.id}
          numColumns={2}
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
    color: '#333',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 16,
  },
  emptySubtext: {
    color: '#666',
    fontSize: 14,
    marginTop: 8,
  },
  listContainer: {
    padding: 10,
  },
  productCard: {
    flex: 1,
    margin: 8,
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  productImage: {
    width: '100%',
    height: 150,
    resizeMode: 'cover',
  },
  productContent: {
    padding: 12,
  },
  productName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  productPrice: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginBottom: 4,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    marginLeft: 4,
    fontSize: 14,
    color: '#888',
  },
});

export default Categories;