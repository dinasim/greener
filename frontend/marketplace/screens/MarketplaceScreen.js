// File: screens/MarketplaceScreen.js
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
  Dimensions,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

// Import components
import MarketplaceHeader from '../components/MarketplaceHeader';
import PlantCard from '../components/PlantCard';
import SearchBar from '../components/SearchBar';
import CategoryFilter from '../components/CategoryFilter';
import FilterSection from '../components/FilterSection';
import AzureMapView from '../components/AzureMapView';

// Import consolidated API service
import { getAll } from '../services/marketplaceApi';

const MarketplaceScreen = ({ navigation }) => {
  // State
  const [plants, setPlants] = useState([]);
  const [filteredPlants, setFilteredPlants] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [priceRange, setPriceRange] = useState({ min: 0, max: 1000 });
  const [sortOption, setSortOption] = useState('recent');
  const [viewMode, setViewMode] = useState('grid'); // 'grid', 'list', or 'map'
  const [page, setPage] = useState(1);
  const [hasMorePages, setHasMorePages] = useState(true);
  const [error, setError] = useState(null);
  const [mapProducts, setMapProducts] = useState([]);

  // Load plants when the screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadPlants(1, true);
    }, [])
  );

  // Apply filters when any filter criteria changes
  useEffect(() => {
    applyFilters();
  }, [searchQuery, selectedCategory, priceRange, plants, sortOption]);

  // Load map products if map view is active
  useEffect(() => {
    if (viewMode === 'map') {
      loadMapProducts();
    }
  }, [viewMode, filteredPlants]);

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
        searchQuery,
        { minPrice: priceRange.min, maxPrice: priceRange.max }
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

  // Load products with location data for map view
  const loadMapProducts = async () => {
    try {
      setIsLoading(true);
      
      // For development, we'll just add mock coordinates to filteredPlants
      const productsWithLocation = filteredPlants.map(plant => {
        if (plant.location && plant.location.latitude && plant.location.longitude) {
          return plant;
        }
        
        // Generate pseudo-random coordinates based on plant ID or name
        const idString = (plant.id || plant._id || plant.name || plant.title || '').toString();
        const hash = idString.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        
        return {
          ...plant,
          location: {
            latitude: 47.6062 + (hash % 20 - 10) / 100,
            longitude: -122.3321 + (hash % 20 - 10) / 100,
            city: plant.city || 'Unknown location'
          }
        };
      });
      
      setMapProducts(productsWithLocation);
      setIsLoading(false);
    } catch (err) {
      console.error('Error loading map products:', err);
      setError('Failed to load map data. Please try again.');
      setIsLoading(false);
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
      plant => {
        const price = parseFloat(plant.price);
        return !isNaN(price) && price >= priceRange.min && price <= priceRange.max;
      }
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

    // Apply sorting
    results = sortPlants(results, sortOption);

    // Update filtered plants
    setFilteredPlants(results);
  };

  // Sort plants based on selected option
  const sortPlants = (plantsToSort, option) => {
    switch (option) {
      case 'recent': // New to Old
        return [...plantsToSort].sort((a, b) => {
          const dateA = new Date(a.addedAt || a.listedDate || 0);
          const dateB = new Date(b.addedAt || b.listedDate || 0);
          return dateB - dateA; // Most recent first
        });
      case 'oldest': // Old to New
        return [...plantsToSort].sort((a, b) => {
          const dateA = new Date(a.addedAt || a.listedDate || 0);
          const dateB = new Date(b.addedAt || b.listedDate || 0);
          return dateA - dateB; // Oldest first
        });
      case 'priceAsc':
        return [...plantsToSort].sort((a, b) => parseFloat(a.price) - parseFloat(b.price));
      case 'priceDesc':
        return [...plantsToSort].sort((a, b) => parseFloat(b.price) - parseFloat(a.price));
      case 'rating':
        return [...plantsToSort].sort((a, b) => (b.rating || 0) - (a.rating || 0));
      default:
        return plantsToSort;
    }
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
    setPriceRange(range);
  };

  // Handle sort option change
  const handleSortChange = (option) => {
    setSortOption(option);
  };

  // Handle view mode change
  const handleViewModeChange = (mode) => {
    setViewMode(mode);
  };

  // Handle load more
  const handleLoadMore = () => {
    if (!isLoading && hasMorePages) {
      loadPlants(page + 1);
    }
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

  // Main loading state - show while initial data is loading
  if (isLoading && plants.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <MarketplaceHeader
          title="Plant Marketplace"
          showBackButton={false}
          onNotificationsPress={() => navigation.navigate('Messages')}
        />
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text style={styles.loadingText}>Loading plants...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Main error state - show if there's an error loading initial data
  if (error && plants.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <MarketplaceHeader
          title="Plant Marketplace"
          showBackButton={false}
          onNotificationsPress={() => navigation.navigate('Messages')}
        />
        <View style={styles.centerContainer}>
          <MaterialIcons name="error-outline" size={48} color="#f44336" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity 
            style={styles.retryButton} 
            onPress={() => loadPlants(1, true)}
          >
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Custom Header - No back button needed on Marketplace home screen */}
      <MarketplaceHeader
        title="Plant Marketplace"
        showBackButton={false}
        onNotificationsPress={() => navigation.navigate('Messages')}
      />

      {/* Search Bar */}
      <SearchBar
        value={searchQuery}
        onChangeText={handleSearch}
        onSubmit={() => loadPlants(1, true)}
        style={styles.searchBarContainer}
      />

      {/* Category Filter */}
      <CategoryFilter
        selectedCategory={selectedCategory}
        onSelect={handleCategorySelect}
      />

      {/* Sort, Price Filter, and View Mode Toggle */}
      <FilterSection
        sortOption={sortOption}
        onSortChange={handleSortChange}
        priceRange={priceRange}
        onPriceChange={handlePriceRangeChange}
        viewMode={viewMode}
        onViewModeChange={handleViewModeChange}
      />

      {/* Conditional rendering based on view mode */}
      {viewMode === 'map' ? (
        // Map View
        <View style={styles.mapContainer}>
          {isLoading ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color="#4CAF50" />
              <Text style={styles.loadingText}>Preparing map view...</Text>
            </View>
          ) : mapProducts.length > 0 ? (
            <AzureMapView 
              products={mapProducts}
              onSelectProduct={(productId) => {
                navigation.navigate('PlantDetail', { plantId: productId });
              }}
            />
          ) : (
            <View style={styles.centerContainer}>
              <MaterialIcons name="map" size={48} color="#aaa" />
              <Text style={styles.noResultsText}>No plants with location data found</Text>
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
          )}
        </View>
      ) : (
        // List or Grid View
        <FlatList
          data={filteredPlants}
          renderItem={({ item }) => (
            <PlantCard 
              plant={item} 
              showActions={true}
              layout={viewMode}
            />
          )}
          numColumns={viewMode === 'grid' ? 2 : 1}
          key={viewMode} // Forces remount when view mode changes
          keyExtractor={(item) => (item.id?.toString() || item._id?.toString())}
          contentContainerStyle={[
            styles.listContainer,
            filteredPlants.length === 0 && styles.emptyListContainer,
            viewMode === 'list' && styles.listViewContainer
          ]}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={renderFooter}
          ListEmptyComponent={renderEmptyList}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} colors={['#4CAF50']} tintColor="#4CAF50" />
          }
        />
      )}

      {/* Add Plant FAB */}
      <TouchableOpacity style={styles.addButton} onPress={() => navigation.navigate('AddPlant')}>
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
  searchBarContainer: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  listContainer: {
    paddingHorizontal: 8,
    paddingBottom: 80,
  },
  emptyListContainer: {
    flexGrow: 1,
  },
  listViewContainer: {
    paddingHorizontal: 16,
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
  noResultsText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 10,
    backgroundColor: '#4CAF50',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 4,
  },
  retryText: {
    color: '#fff',
    fontWeight: '600',
  },
  resetButton: {
    marginTop: 16,
    backgroundColor: '#4CAF50',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 4,
  },
  resetButtonText: {
    color: '#fff',
    fontWeight: '600',
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
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  mapContainer: {
    flex: 1,
    backgroundColor: '#f0f0f0',
  },
});

export default MarketplaceScreen;