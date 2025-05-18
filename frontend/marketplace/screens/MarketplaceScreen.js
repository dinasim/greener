// screens/MarketplaceScreen.js
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, FlatList, ActivityIndicator, StyleSheet, Text, TouchableOpacity,
  SafeAreaView, RefreshControl, Alert, Platform
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MarketplaceHeader from '../components/MarketplaceHeader';
import PlantCard from '../components/PlantCard';
import SearchBar from '../components/SearchBar';
import CategoryFilter from '../components/CategoryFilter';
import FilterSection from '../components/FilterSection';
import { getAll, getNearbyProducts, geocodeAddress } from '../services/marketplaceApi';
import syncService from '../services/SyncService';
import { checkForUpdate, clearUpdate, UPDATE_TYPES, addUpdateListener, removeUpdateListener } from '../services/MarketplaceUpdates';

const useMarketplaceUpdates = (callback) => {
  useEffect(() => {
    const listenerId = 'marketplace-screen-' + Date.now();
    addUpdateListener(listenerId, callback);
    return () => {
      removeUpdateListener(listenerId);
    };
  }, [callback]);
};

const MarketplaceScreen = ({ navigation, route }) => {
  const [plants, setPlants] = useState([]);
  const [filteredPlants, setFilteredPlants] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [priceRange, setPriceRange] = useState({ min: 0, max: 1000 });
  const [sortOption, setSortOption] = useState('recent');
  const [viewMode, setViewMode] = useState('grid');
  const [page, setPage] = useState(1);
  const [hasMorePages, setHasMorePages] = useState(true);
  const [error, setError] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [activeFilters, setActiveFilters] = useState([]);
  const [isOnline, setIsOnline] = useState(true);
  const [lastRefreshTime, setLastRefreshTime] = useState(Date.now());
  const [showFilters, setShowFilters] = useState(false);
  const plantsRef = useRef(plants);
  const loadPlantsRef = useRef(null);

  const handleBackPress = () => {
    navigation.navigate('Home');
  };

  const navigateToMessages = useCallback((params = {}) => {
    try {
      // Find the appropriate navigation path
      if (navigation.canNavigate('MainTabs')) {
        navigation.navigate('MainTabs', {
          screen: 'Messages',
          params: params
        });
      } else if (navigation.canNavigate('MarketplaceTabs')) {
        navigation.navigate('MarketplaceTabs', {
          screen: 'Messages',
          params: params
        });
      } else if (navigation.canNavigate('Messages')) {
        navigation.navigate('Messages', params);
      } else {
        console.warn('Messages screen not found in navigation');
        Alert.alert('Navigation Error', 'Messages screen is not available. Please check app configuration.',
          [{ text: 'OK' }]);
      }
    } catch (error) {
      console.error('Navigation error:', error);
      Alert.alert('Error', 'Could not navigate to messages. Please try again later.',
        [{ text: 'OK' }]);
    }
  }, [navigation]);

  const normalizePlantSellerInfo = (plantsArray) => {
    return plantsArray.map(plant => {
      if (plant.seller && plant.seller.name && plant.seller.name !== 'Unknown Seller') {
        return plant;
      }
      return {
        ...plant,
        seller: {
          name: plant.sellerName || (plant.seller?.name && plant.seller.name !== 'Unknown Seller' ? plant.seller.name : 'Plant Enthusiast'),
          _id: plant.sellerId || plant.seller?._id || 'unknown',
          ...(plant.seller || {})
        }
      };
    });
  };

  const formatLocation = (locationData) => {
    if (!locationData) return 'Location unavailable';
    let formattedLocation = '';
    if (locationData.city) {
      formattedLocation = locationData.city;
    }
    if (locationData.region && locationData.region !== locationData.city) {
      if (formattedLocation) {
        formattedLocation += `, ${locationData.region}`;
      } else {
        formattedLocation = locationData.region;
      }
    }
    if (locationData.country && !formattedLocation.includes(locationData.country) && 
        locationData.country !== locationData.city && locationData.country !== locationData.region) {
      if (formattedLocation) {
        formattedLocation += `, ${locationData.country}`;
      } else {
        formattedLocation = locationData.country;
      }
    }
    if (!formattedLocation && locationData.latitude && locationData.longitude) {
      formattedLocation = `Near ${locationData.latitude.toFixed(2)}, ${locationData.longitude.toFixed(2)}`;
    }
    return formattedLocation;
  };

  const loadPlants = useCallback(async (pageNum = 1, resetData = false) => {
    if (!hasMorePages && pageNum > 1 && !resetData) return;
    try {
      setError(null);
      if (pageNum === 1) {
        setIsLoading(true);
      }
      if (!isOnline) {
        const cachedData = await syncService.getCachedData('marketplace_plants');
        if (cachedData) {
          const normalizedData = normalizePlantSellerInfo(cachedData);
          if (resetData) {
            setPlants(normalizedData);
          } else {
            setPlants(prevPlants => [...prevPlants, ...normalizedData]);
          }
          setIsLoading(false);
          setIsRefreshing(false);
          return;
        } else {
          setError('You are offline. Please check your connection and try again.');
          setIsLoading(false);
          setIsRefreshing(false);
          return;
        }
      }
      const data = await getAll(
        pageNum,
        selectedCategory === 'All' ? null : selectedCategory,
        searchQuery,
        { 
          minPrice: priceRange.min, 
          maxPrice: priceRange.max,
          sortBy: sortOption 
        }
      );
      if (data && data.products) {
        const normalizedProducts = normalizePlantSellerInfo(data.products);
        if (resetData) {
          setPlants(normalizedProducts);
        } else {
          setPlants(prevPlants => [...prevPlants, ...normalizedProducts]);
        }
        setPage(pageNum);
        setHasMorePages(data.pages > pageNum);
        await syncService.cacheData('marketplace_plants', normalizedProducts);
      }
      setIsLoading(false);
      setIsRefreshing(false);
    } catch (err) {
      console.error('Error loading plants:', err);
      setError('Failed to load plants. Please try again.');
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [hasMorePages, isOnline, searchQuery, selectedCategory, priceRange, sortOption]);

  useEffect(() => {
    plantsRef.current = plants;
  }, [plants]);

  useEffect(() => {
    loadPlantsRef.current = loadPlants;
  }, [loadPlants]);

  useEffect(() => {
    const unsubscribe = syncService.registerSyncListener((event) => {
      if (event.type === 'CONNECTION_CHANGE') {
        setIsOnline(event.isOnline);
      }
    });
    const status = syncService.getSyncStatus();
    setIsOnline(status.isOnline);
    return unsubscribe;
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadPlants(1, true);
      
      // Check if we should refresh additional data
      const checkUpdates = async () => {
        try {
          // Check various update flags
          const wishlistUpdated = await AsyncStorage.getItem('WISHLIST_UPDATED');
          const favoritesUpdated = await AsyncStorage.getItem('FAVORITES_UPDATED');
          const profileUpdated = await AsyncStorage.getItem('PROFILE_UPDATED');
          const reviewUpdated = await AsyncStorage.getItem('REVIEW_UPDATED');
          const productUpdated = await AsyncStorage.getItem('PRODUCT_UPDATED');
          
          const needsRefresh = wishlistUpdated || favoritesUpdated || 
                               profileUpdated || reviewUpdated || 
                               productUpdated || route.params?.refresh;
          
          if (needsRefresh) {
            // Clear all update flags
            await Promise.all([
              AsyncStorage.removeItem('WISHLIST_UPDATED'),
              AsyncStorage.removeItem('FAVORITES_UPDATED'),
              AsyncStorage.removeItem('PROFILE_UPDATED'),
              AsyncStorage.removeItem('REVIEW_UPDATED'),
              AsyncStorage.removeItem('PRODUCT_UPDATED')
            ]);
            
            // Reload plants
            loadPlants(1, true);
            setLastRefreshTime(Date.now());
            
            // Clear refresh param if present
            if (route.params?.refresh) {
              navigation.setParams({ refresh: undefined });
            }
          }
        } catch (error) {
          console.error('[MarketplaceScreen] Error checking for updates:', error);
        }
      };
      
      checkUpdates();
      
      // Get location if available
      (async () => {
        try {
          const cachedLocation = await AsyncStorage.getItem('@UserLocation');
          if (cachedLocation) {
            setUserLocation(JSON.parse(cachedLocation));
          }
        } catch (e) {
          console.warn('Error loading cached location:', e);
        }
      })();
      
      // Return cleanup function
      return () => {
        // Any cleanup needed
      };
    }, [navigation, route.params?.refresh])
  );
  
  useEffect(() => {
    applyFilters();
  }, [searchQuery, selectedCategory, priceRange, plants, sortOption]);

  useEffect(() => {
    try {
      AsyncStorage.setItem('@ViewModePreference', viewMode);
    } catch (e) {
      console.warn('Error saving view mode preference:', e);
    }
  }, [viewMode]);

  useEffect(() => {
    (async () => {
      try {
        const savedViewMode = await AsyncStorage.getItem('@ViewModePreference');
        if (savedViewMode) {
          setViewMode(savedViewMode);
        }
      } catch (e) {
        console.warn('Error loading view mode preference:', e);
      }
    })();
  }, []);

  useEffect(() => {
    const checkWishlistUpdates = async () => {
      try {
        const wishlistUpdated = await AsyncStorage.getItem('WISHLIST_UPDATED');
        if (wishlistUpdated) {
          await AsyncStorage.removeItem('WISHLIST_UPDATED');
          loadPlants(1, true);
        }
      } catch (error) {
        console.warn('Error checking wishlist updates:', error);
      }
    };
    checkWishlistUpdates();
  }, []);

  useEffect(() => {
    const checkFavoritesUpdates = async () => {
      try {
        const favoritesUpdated = await AsyncStorage.getItem('FAVORITES_UPDATED') 
                            || await AsyncStorage.getItem('WISHLIST_UPDATED');
        if (favoritesUpdated) {
          await AsyncStorage.removeItem('FAVORITES_UPDATED');
          await AsyncStorage.removeItem('WISHLIST_UPDATED');
          loadPlants(1, true);
        }
      } catch (error) {
        console.warn('Error checking favorites updates:', error);
      }
    };
    checkFavoritesUpdates();
  }, []);

  const handleMarketplaceUpdate = useCallback((updateType, data) => {
    console.log(`[MarketplaceScreen] Received update: ${updateType}`, data);
    const currentPlants = plantsRef.current;
    const currentLoadPlants = loadPlantsRef.current;
    if (updateType === UPDATE_TYPES.WISHLIST) {
      if (data && data.plantId) {
        setPlants(prevPlants => {
          const updatedPlants = [...prevPlants];
          const plantIndex = updatedPlants.findIndex(
            p => p.id === data.plantId || p._id === data.plantId
          );
          if (plantIndex >= 0) {
            updatedPlants[plantIndex] = {
              ...updatedPlants[plantIndex],
              isFavorite: data.isFavorite,
              isWished: data.isFavorite,
              seller: updatedPlants[plantIndex].seller || { 
                name: updatedPlants[plantIndex].sellerName || 'Plant Enthusiast',
                _id: updatedPlants[plantIndex].sellerId 
              }
            };
          }
          return updatedPlants;
        });
      } else {
        if (currentLoadPlants) currentLoadPlants(1, true);
      }
    } else if (updateType === UPDATE_TYPES.PRODUCT || updateType === UPDATE_TYPES.REVIEW) {
      if (currentLoadPlants) currentLoadPlants(1, true);
    }
    setLastRefreshTime(Date.now());
  }, []);

  useMarketplaceUpdates(handleMarketplaceUpdate);

  const onRefresh = async () => {
    setIsRefreshing(true);
    await loadPlants(1, true);
  };

  const applyFilters = () => {
    if (!plants.length) return;
    let results = normalizePlantSellerInfo([...plants]);
    if (selectedCategory !== 'All') {
      results = results.filter(plant =>
        plant.category?.toLowerCase() === selectedCategory.toLowerCase()
      );
    }
    results = results.filter(
      plant => {
        const price = parseFloat(plant.price);
        return !isNaN(price) && price >= priceRange.min && price <= priceRange.max;
      }
    );
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      results = results.filter(
        plant =>
          plant.name?.toLowerCase().includes(query) ||
          plant.title?.toLowerCase().includes(query) ||
          plant.description?.toLowerCase().includes(query) ||
          plant.city?.toLowerCase().includes(query) ||
          (typeof plant.location === 'string' && plant.location.toLowerCase().includes(query)) ||
          (plant.location?.city && plant.location.city.toLowerCase().includes(query)) ||
          plant.category?.toLowerCase().includes(query)
      );
    }
    activeFilters.forEach(filter => {
      if (filter.type === 'seller' && filter.value) {
        results = results.filter(plant => 
          plant.sellerId === filter.value || 
          plant.seller?.name?.toLowerCase() === filter.value.toLowerCase()
        );
      }
    });
    results = sortPlants(results, sortOption);
    setFilteredPlants(results);
  };

  const sortPlants = (plantsToSort, option) => {
    switch (option) {
      case 'recent':
        return [...plantsToSort].sort((a, b) => {
          const dateA = new Date(a.addedAt || a.listedDate || 0);
          const dateB = new Date(b.addedAt || b.listedDate || 0);
          return dateB - dateA;
        });
      case 'oldest':
        return [...plantsToSort].sort((a, b) => {
          const dateA = new Date(a.addedAt || a.listedDate || 0);
          const dateB = new Date(b.addedAt || b.listedDate || 0);
          return dateA - dateB;
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

  const handleSearch = (query) => {
    setSearchQuery(query);
    if (query !== searchQuery) {
      loadPlants(1, true);
    }
  };

  const handleCategorySelect = (categoryId) => {
    setSelectedCategory(categoryId);
    if (categoryId !== selectedCategory) {
      loadPlants(1, true);
    }
  };

  const handlePriceRangeChange = (range) => {
    setPriceRange(range);
  };

  const handleSortChange = (option) => {
    setSortOption(option);
  };

  const handleViewModeChange = (mode) => {
    if (mode === 'map') {
      // Navigate to map screen instead of changing view mode locally
      navigation.navigate('MapView', { 
        products: filteredPlants,
        initialLocation: userLocation
      });
    } else {
      setViewMode(mode);
    }
  };

  const handleLoadMore = () => {
    if (!isLoading && hasMorePages) {
      loadPlants(page + 1);
    }
  };

  const handleRemoveFilter = (filterId) => {
    setActiveFilters(activeFilters.filter(f => f.id !== filterId));
  };

  const handleResetFilters = () => {
    setActiveFilters([]);
    setPriceRange({ min: 0, max: 1000 });
    setSelectedCategory('All');
    setSearchQuery('');
    loadPlants(1, true);
  };

  const toggleFilters = () => {
    setShowFilters(!showFilters);
  };

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
    if (!isOnline) {
      return (
        <View style={styles.centerContainer}>
          <MaterialIcons name="cloud-off" size={48} color="#aaa" />
          <Text style={styles.noResultsText}>You're offline</Text>
          <Text style={styles.subText}>Connect to the internet to browse plants</Text>
        </View>
      );
    }
    return (
      <View style={styles.centerContainer}>
        <MaterialIcons name="eco" size={48} color="#aaa" />
        <Text style={styles.noResultsText}>No plants found matching your criteria</Text>
        <TouchableOpacity style={styles.resetButton} onPress={handleResetFilters}>
          <Text style={styles.resetButtonText}>Reset Filters</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderFooter = () => {
    if (!isLoading || !hasMorePages) return null;
    return (
      <View style={styles.footerContainer}>
        <ActivityIndicator size="small" color="#4CAF50" />
        <Text style={styles.footerText}>Loading more plants...</Text>
      </View>
    );
  };

  if (isLoading && plants.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <MarketplaceHeader
          title="Plant Marketplace"
          showBackButton={true}
          onBackPress={handleBackPress}
          onNotificationsPress={() => navigateToMessages({})}
        />
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text style={styles.loadingText}>Loading plants...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error && plants.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <MarketplaceHeader
          title="Plant Marketplace"
          showBackButton={true}
          onBackPress={handleBackPress}
          onNotificationsPress={() => navigateToMessages({})}
        />
        <View style={styles.centerContainer}>
          <MaterialIcons name="error-outline" size={48} color="#f44336" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => loadPlants(1, true)}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <MarketplaceHeader
        title="Plant Marketplace"
        showBackButton={true}
        onBackPress={handleBackPress}
        onNotificationsPress={() => navigateToMessages({})}
      />
      <SearchBar
        value={searchQuery}
        onChangeText={handleSearch}
        onSubmit={() => loadPlants(1, true)}
        style={styles.searchBarContainer}
      />
      <CategoryFilter
        selectedCategory={selectedCategory}
        onSelect={handleCategorySelect}
      />
      <FilterSection
        sortOption={sortOption}
        onSortChange={handleSortChange}
        priceRange={priceRange}
        onPriceChange={handlePriceRangeChange}
        viewMode={viewMode}
        onViewModeChange={handleViewModeChange}
        activeFilters={activeFilters}
        onRemoveFilter={handleRemoveFilter}
        onResetFilters={handleResetFilters}
      />
      <FlatList
        data={filteredPlants}
        renderItem={({ item }) => (
          <PlantCard plant={item} showActions={true} layout={viewMode} />
        )}
        numColumns={viewMode === 'grid' ? (Platform.OS === 'web' ? 3 : 2) : 1}
        key={`${viewMode}-${Platform.OS}`}
        keyExtractor={(item) => (item.id?.toString() || item._id?.toString() || Math.random().toString())}
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
      <TouchableOpacity 
        style={styles.addButton} 
        onPress={() => navigation.navigate('AddPlant')}
        accessible={true}
        accessibilityLabel="Add a new plant"
        accessibilityRole="button"
      >
        <MaterialIcons name="add" size={30} color="#fff" />
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#f5f5f5' 
  },
  searchBarContainer: { 
    alignItems: 'center', 
    paddingVertical: 12 
  },
  listContainer: { 
    paddingHorizontal: 8, 
    paddingBottom: 80 
  },
  emptyListContainer: { 
    flexGrow: 1 
  },
  listViewContainer: { 
    paddingHorizontal: 16 
  },
  centerContainer: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    padding: 20, 
    minHeight: 300 
  },
  loadingText: { 
    marginTop: 10, 
    fontSize: 16, 
    color: '#666' 
  },
  errorText: { 
    marginTop: 10, 
    fontSize: 16, 
    color: '#f44336', 
    textAlign: 'center', 
    marginBottom: 16 
  },
  noResultsText: { 
    marginTop: 10, 
    fontSize: 18, 
    color: '#666', 
    textAlign: 'center' 
  },
  subText: { 
    marginTop: 8, 
    fontSize: 14, 
    color: '#999', 
    textAlign: 'center' 
  },
  retryButton: { 
    marginTop: 16, 
    backgroundColor: '#4CAF50', 
    paddingVertical: 8, 
    paddingHorizontal: 16, 
    borderRadius: 6 
  },
  retryText: { 
    color: '#fff', 
    fontWeight: '600' 
  },
  resetButton: { 
    marginTop: 16, 
    backgroundColor: '#4CAF50', 
    paddingVertical: 8, 
    paddingHorizontal: 16, 
    borderRadius: 6 
  },
  resetButtonText: { 
    color: '#fff', 
    fontWeight: '600' 
  },
  footerContainer: { 
    flexDirection: 'row', 
    justifyContent: 'center', 
    alignItems: 'center', 
    padding: 16 
  },
  footerText: { 
    marginLeft: 8, 
    color: '#666' 
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
  filterButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 8,
    alignSelf: 'flex-start',
    marginLeft: 16,
  },
  filterButtonText: {
    color: '#fff',
    fontWeight: '600',
    marginLeft: 8,
  },
});

export default MarketplaceScreen;