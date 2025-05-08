import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { MaterialIcons, FontAwesome } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

// Components
import PlantCard from '../components/PlantCard';
import SearchBar from '../components/SearchBar';
import CategoryFilter from '../components/CategoryFilter';
import PriceRange from '../components/PriceRange';

// API Services
import { fetchPlants } from '../services/marketplaceApi';

const MarketplaceScreen = () => {
  const navigation = useNavigation();
  const [plants, setPlants] = useState([]);
  const [filteredPlants, setFilteredPlants] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [priceRange, setPriceRange] = useState({ min: 0, max: 1000 });
  const [error, setError] = useState(null);

  // Categories for filter
  const categories = [
    'All',
    'Indoor Plants',
    'Outdoor Plants',
    'Succulents',
    'Cacti',
    'Flowering Plants',
    'Air Plants',
    'Herbs',
    'Vegetable Plants',
  ];

  useEffect(() => {
    loadPlants();
  }, []);

  // Apply filters when any filter criteria changes
  useEffect(() => {
    applyFilters();
  }, [searchQuery, selectedCategory, priceRange, plants]);

  const loadPlants = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Call Azure Function to get plants
      const data = await fetchPlants();
      setPlants(data);
      
      setIsLoading(false);
    } catch (err) {
      setError('Failed to load plants. Please try again later.');
      setIsLoading(false);
      console.error('Error fetching plants:', err);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadPlants();
    setRefreshing(false);
  };

  const applyFilters = () => {
    let results = [...plants];

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      results = results.filter(
        (plant) =>
          plant.name.toLowerCase().includes(query) ||
          plant.description.toLowerCase().includes(query)
      );
    }

    // Apply category filter
    if (selectedCategory && selectedCategory !== 'All') {
      results = results.filter((plant) => plant.category === selectedCategory);
    }

    // Apply price range filter
    results = results.filter(
      (plant) => plant.price >= priceRange.min && plant.price <= priceRange.max
    );

    setFilteredPlants(results);
  };

  const handleSearch = (query) => {
    setSearchQuery(query);
  };

  const handleCategorySelect = (category) => {
    setSelectedCategory(category);
  };

  const handlePriceRangeChange = (min, max) => {
    setPriceRange({ min, max });
  };

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <MaterialIcons name="error-outline" size={48} color="#f44336" />
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <SearchBar value={searchQuery} onChangeText={handleSearch} />
      
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.filtersScrollView}
      >
        <CategoryFilter
          categories={categories}
          selectedCategory={selectedCategory}
          onSelect={handleCategorySelect}
        />
      </ScrollView>
      
      <PriceRange
        minValue={0}
        maxValue={1000}
        initialMin={priceRange.min}
        initialMax={priceRange.max}
        onValueChange={handlePriceRangeChange}
      />

      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text style={styles.loadingText}>Loading plants...</Text>
        </View>
      ) : filteredPlants.length === 0 ? (
        <View style={styles.centerContainer}>
          <MaterialIcons name="eco" size={48} color="#aaa" />
          <Text style={styles.noResultsText}>
            No plants found matching your criteria
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredPlants}
          renderItem={({ item }) => <PlantCard plant={item} />}
          keyExtractor={(item) => item.id.toString()}
          numColumns={2}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        />
      )}

      {/* Floating action button to add new plant */}
      <TouchableOpacity
        style={styles.fabButton}
        onPress={() => navigation.navigate('AddPlant')}
      >
        <MaterialIcons name="add" size={30} color="#fff" />
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  listContainer: {
    padding: 8,
  },
  filtersScrollView: {
    marginVertical: 10,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  errorText: {
    marginTop: 10,
    fontSize: 16,
    color: '#f44336',
    textAlign: 'center',
  },
  noResultsText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  fabButton: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
});

export default MarketplaceScreen;