import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  SafeAreaView,
  RefreshControl,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';

// Import components
import PlantCard from '../components/PlantCard';
import SearchBar from '../components/SearchBar';
import CategoryFilter from '../components/CategoryFilter';
import PriceRange from '../components/PriceRange';

// Import services
import { getAll } from '../services/productData';

const MarketplaceScreen = () => {
  const navigation = useNavigation();
  
  // State
  const [plants, setPlants] = useState([]);
  const [filteredPlants, setFilteredPlants] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [priceRange, setPriceRange] = useState({ min: 0, max: 1000 });
  const [page, setPage] = useState(1);
  const [hasMorePages, setHasMorePages] = useState(true);
  const [error, setError] = useState(null);
  const [isMapView, setIsMapView] = useState(false);
  
  // Load plants when the screen comes into focus
  useFocusEffect(
    useCallback(() => {
      // Reset filters when navigating back to screen
      loadPlants(1, true);
    }, [])
  );

  // Apply filters when any filter criteria changes
  useEffect(() => {
    applyFilters();
  }, [searchQuery, selectedCategory, priceRange, plants]);

  // Function to load plants from API
  const loadPlants = async (pageNum = 1, resetData = false) => {
    if (!hasMorePages && pageNum > 1 && !resetData) return;
    
    try {
      setError(null);
      
      if (pageNum === 1) {
        setIsLoading(true);
      }
      
      // Get plants from API
      const data = await getAll(
        pageNum, 
        selectedCategory === 'All' ? null : selectedCategory, 
        searchQuery
      );
      
      // Update state with new data
      if (data && data.products) {
        if (resetData) {
          setPlants(data.products);
        } else {
          setPlants(prevPlants => [...prevPlants, ...data.products]);
        }
        
        setPage(pageNum);
        setHasMorePages(data.pages > pageNum);
      }
      
      setIsLoading(false);
      setIsRefreshing(false);
    } catch (err) {
      console.error('Error loading plants:', err);
      setError('Failed to load plants. Please try again.');
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  // Handle pull-to-refresh
  const onRefresh = async () => {
    setIsRefreshing(true);
    await loadPlants(1, true);
  };

  // Apply all filters to the plants data
  const applyFilters = () => {
    if (!plants.length) return;
    
    let results = [...plants];
    
    // Apply category filter if not "All"
    if (selectedCategory !== 'All') {
      results = results.filter(plant => 
        plant.category?.toLowerCase() === selectedCategory.toLowerCase()
      );
    }
    
    // Apply price range filter
    results = results.filter(
      plant => plant.price >= priceRange.min && plant.price <= priceRange.max
    );
    
    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      results = results.filter(
        plant =>
          plant.name?.toLowerCase().includes(query) ||
          plant.title?.toLowerCase().includes(query) ||
          plant.description?.toLowerCase().includes(query) ||
          plant.city?.toLowerCase().includes(query) ||
          plant.location?.toLowerCase?.().includes(query) ||
          plant.category?.toLowerCase().includes(query)
      );
    }
    
    // Update filtered plants
    setFilteredPlants(results);
  };

  // Handle search
  const handleSearch = (query) => {
    setSearchQuery(query);
    // Reset to page 1 when search changes
    if (query !== searchQuery) {
      loadPlants(1, true); 
    }
  };

  // Handle category selection
  const handleCategorySelect = (categoryId) => {
    setSelectedCategory(categoryId);
    // Reset to page 1 when category changes
    if (categoryId !== selectedCategory) {
      loadPlants(1, true);
    }
  };

  // Handle price range change
  const handlePriceRangeChange = (range) => {
    setPriceRange({ min: range[0], max: range[1] });
  };

  // Handle load more
  const handleLoadMore = () => {
    if (!isLoading && hasMorePages) {
      loadPlants(page + 1);
    }
  };

  // Toggle between list and map view
  const toggleMapView = () => {
    setIsMapView(!isMapView);
  };

  // Get locations for map view
  const getMapLocations = () => {
    // Simple geocoding for demonstration
    // In a real app, you would use proper geocoding via Azure Maps API
    return filteredPlants.map(plant => {
      // Generate approximate coordinates based on city
      const cityMap = {
        'Seattle': { latitude: 47.6062, longitude: -122.3321 },
        'Portland': { latitude: 45.5051, longitude: -122.6750 },
        'San Francisco': { latitude: 37.7749, longitude: -122.4194 },
        'Los Angeles': { latitude: 34.0522, longitude: -118.2437 },
        'Chicago': { latitude: 41.8781, longitude: -87.6298 },
        'Phoenix': { latitude: 33.4484, longitude: -112.0740 },
      };
      
      let location = cityMap[plant.city] || { 
        latitude: 37.78 + Math.random() * 0.1, 
        longitude: -122.43 + Math.random() * 0.1
      };
      
      return {
        id: plant.id || plant._id,
        title: plant.title || plant.name,
        price: plant.price,
        image: plant.image || plant.imageUrl,
        coordinate: location
      };
    });
  };

  // Render list empty component
  const renderEmptyList = () => {
    if (isLoading) {
      return (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text style={styles.loadingText}>Loading plants...</Text>
        </View>
      );
    }
    
    if (error) {
      return (
        <View style={styles.centerContainer}>
          <MaterialIcons name="error-outline" size={48} color="#f44336" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => loadPlants(1, true)}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }
    
    return (
      <View style={styles.centerContainer}>
        <MaterialIcons name="eco" size={48} color="#aaa" />
        <Text style={styles.noResultsText}>No plants found matching your criteria</Text>
        <TouchableOpacity 
          style={styles.resetButton}
          onPress={() => {
            setSearchQuery('');
            setSelectedCategory('All');
            setPriceRange({ min: 0, max: 1000 });
            loadPlants(1, true);
          }}
        >
          <Text style={styles.resetButtonText}>Reset Filters</Text>
        </TouchableOpacity>
      </View>
    );
  };

  // Render footer for infinite scrolling
  const renderFooter = () => {
    if (!isLoading || !hasMorePages) return null;
    
    return (
      <View style={styles.footerContainer}>
        <ActivityIndicator size="small" color="#4CAF50" />
        <Text style={styles.footerText}>Loading more plants...</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerText}>Marketplace</Text>
      </View>

      {/* Search Bar */}
      <SearchBar 
        value={searchQuery} 
        onChangeText={handleSearch}
        onSubmit={() => loadPlants(1, true)}
      />
      
      {/* Filter Section */}
      <View style={styles.filterContainer}>
        {/* Category Filter */}
        <CategoryFilter
          selectedCategory={selectedCategory}
          onSelect={handleCategorySelect}
        />
        
        {/* Price Range Filter */}
        <View style={styles.priceRangeContainer}>
          <PriceRange
            onPriceChange={handlePriceRangeChange}
            initialMin={priceRange.min}
            initialMax={priceRange.max}
          />
        </View>
      </View>

      {/* Plant List or Map View */}
      {isMapView ? (
        // Map View
        <View style={styles.mapContainer}>
          {/* Azure Map integration */}
        </View>
      ) : (
        // List View
        <FlatList
          data={filteredPlants}
          renderItem={({ item }) => <PlantCard plant={item} />}
          keyExtractor={(item) => item.id?.toString() || item._id?.toString()}
          numColumns={2}
          contentContainerStyle={styles.listContainer}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={renderFooter}
          ListEmptyComponent={renderEmptyList}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={onRefresh}
              colors={["#4CAF50"]}
              tintColor="#4CAF50"
            />
          }
        />
      )}
      
      {/* Add Plant Button */}
      <TouchableOpacity
        style={styles.addButton}
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
  header: {
    padding: 16,
    backgroundColor: '#4CAF50',
    alignItems: 'center',
  },
  headerText: {
    fontSize: 24,
    color: '#fff',
    fontWeight: 'bold',
  },
  filterContainer: {
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  priceRangeContainer: {
    marginTop: 16,
  },
  listContainer: {
    paddingHorizontal: 8,
    paddingBottom: 80,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    minHeight: 300,
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
    marginBottom: 16,
  },
  footerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  footerText: {
    marginLeft: 8,
    color: '#666',
  },
  addButton: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default MarketplaceScreen;
