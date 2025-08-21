// screens/MarketplaceScreen.js - FIXED GRID LAYOUT
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, FlatList, ActivityIndicator, StyleSheet, Text, TouchableOpacity,
  SafeAreaView, RefreshControl, Alert, Platform, Dimensions,
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
import { checkForUpdate, clearUpdate, UPDATE_TYPES, addUpdateListener, removeUpdateListener, triggerUpdate } from '../services/MarketplaceUpdates';

const { width } = Dimensions.get('window');
const H_PADDING = 8;    // matches listContainer/columnWrapperStyle
const COL_GAP   = 8;    // space between the two cards
const CARD_W    = (width - H_PADDING * 2 - COL_GAP) / 2;

const useMarketplaceUpdates = (callback) => {
  useEffect(() => {
    const listenerId = 'marketplace-screen-' + Date.now();
    addUpdateListener(listenerId, [
      UPDATE_TYPES.WISHLIST,
      UPDATE_TYPES.PRODUCT,
      UPDATE_TYPES.REVIEW,
      UPDATE_TYPES.INVENTORY,
    ], callback);
    return () => removeUpdateListener(listenerId);
  }, [callback]);
};

const MarketplaceScreen = ({ navigation, route }) => {
  const [plants, setPlants] = useState([]);
  const [filteredPlants, setFilteredPlants] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [sellerType, setSellerType] = useState('all');
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
  const [sellerTypeCounts, setSellerTypeCounts] = useState({
    all: 0, individual: 0, business: 0,
  });
  const [userType, setUserType] = useState('individual');
  const plantsRef = useRef(plants);
  const loadPlantsRef = useRef(null);

  useEffect(() => {
    const checkUserType = async () => {
      try {
        const storedUserType = await AsyncStorage.getItem('userType');
        setUserType(storedUserType || 'individual');
      } catch (error) {
        console.error('Error checking user type:', error);
      }
    };
    checkUserType();
  }, []);

  const handleBackPress = () => navigation.navigate('Home');

  const navigateToMessages = useCallback((params = {}) => {
    try {
      if (navigation.canNavigate?.('MainTabs')) {
        navigation.navigate('MainTabs', { screen: 'Messages', params });
      } else if (navigation.canNavigate?.('MarketplaceTabs')) {
        navigation.navigate('MarketplaceTabs', { screen: 'Messages', params });
      } else if (navigation.navigate) {
        navigation.navigate('Messages', params);
      }
    } catch (error) {
      console.error('Navigation error:', error);
      Alert.alert('Error', 'Could not navigate to messages. Please try again later.', [{ text: 'OK' }]);
    }
  }, [navigation]);

  const normalizePlantSellerInfo = (plantsArray) =>
    plantsArray.map((plant) => {
      const isBusiness = plant.seller?.isBusiness || plant.isBusinessListing || plant.sellerType === 'business';
      let sellerName = isBusiness
        ? (plant.seller?.businessName || plant.seller?.name || plant.sellerName || 'Business')
        : (plant.seller?.name || plant.sellerName || 'Plant Enthusiast');
      if (sellerName === 'Unknown Seller') sellerName = isBusiness ? 'Business' : 'Plant Enthusiast';

      return {
        ...plant,
        seller: {
          name: sellerName,
          _id: plant.sellerId || plant.seller?._id || 'unknown',
          isBusiness,
          businessName: isBusiness ? sellerName : undefined,
          avatar: plant.seller?.avatar || plant.seller?.logo,
          rating: plant.seller?.rating,
          totalReviews: plant.seller?.totalReviews,
          ...(plant.seller || {}),
        },
        sellerName,
        sellerType: isBusiness ? 'business' : 'individual',
        isBusinessListing: isBusiness,
      };
    });

  const loadPlants = useCallback(async (pageNum = 1, resetData = false, overrideSellerType = null) => {
    if (!hasMorePages && pageNum > 1 && !resetData) return;
    try {
      setError(null);
      if (pageNum === 1) setIsLoading(true);

      if (!isOnline) {
        const cachedData = await syncService.getCachedData('marketplace_plants');
        if (cachedData) {
          const normalizedData = normalizePlantSellerInfo(cachedData);
          resetData ? setPlants(normalizedData) : setPlants((prev) => [...prev, ...normalizedData]);
          calculateSellerTypeCounts(normalizedData);
          setIsLoading(false);
          setIsRefreshing(false);
          return;
        }
        setError('You are offline. Please check your connection and try again.');
        setIsLoading(false);
        setIsRefreshing(false);
        return;
      }

      const currentSellerType = overrideSellerType !== null ? overrideSellerType : sellerType;

      const data = await getAll(
        pageNum,
        selectedCategory === 'All' ? null : selectedCategory,
        searchQuery,
        {
          minPrice: priceRange.min,
          maxPrice: priceRange.max,
          sortBy: sortOption,
          sellerType: currentSellerType === 'all' ? null : currentSellerType,
        }
      );

      if (data?.products) {
        const normalizedProducts = normalizePlantSellerInfo(data.products);
        resetData ? setPlants(normalizedProducts) : setPlants((prev) => [...prev, ...normalizedProducts]);
        setPage(pageNum);
        setHasMorePages(data.pages > pageNum);
        if (data.sellerTypeCounts) setSellerTypeCounts(data.sellerTypeCounts);
        else calculateSellerTypeCounts(normalizedProducts);
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
  }, [hasMorePages, isOnline, searchQuery, selectedCategory, priceRange, sortOption, sellerType]);

  const calculateSellerTypeCounts = (plantsArray) => {
    const counts = plantsArray.reduce((acc, plant) => {
      acc.all += 1;
      if (plant.seller?.isBusiness || plant.sellerType === 'business') acc.business += 1;
      else acc.individual += 1;
      return acc;
    }, { all: 0, individual: 0, business: 0 });
    setSellerTypeCounts(counts);
  };

  useEffect(() => { plantsRef.current = plants; }, [plants]);
  useEffect(() => { loadPlantsRef.current = loadPlants; }, [loadPlants]);

  useEffect(() => {
    const unsubscribe = syncService.registerSyncListener((event) => {
      if (event.type === 'CONNECTION_CHANGE') setIsOnline(event.isOnline);
    });
    const status = syncService.getSyncStatus();
    setIsOnline(status.isOnline);
    return unsubscribe;
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadPlants(1, true);

      const checkUpdates = async () => {
        try {
          const keys = [
            'WISHLIST_UPDATED', 'FAVORITES_UPDATED', 'PROFILE_UPDATED',
            'REVIEW_UPDATED', 'PRODUCT_UPDATED', 'INVENTORY_UPDATED',
          ];
          const flags = await Promise.all(keys.map((k) => AsyncStorage.getItem(k)));
          const needsRefresh = flags.some(Boolean) || route.params?.refresh;

          if (needsRefresh) {
            await Promise.all(keys.map((k) => AsyncStorage.removeItem(k)));
            loadPlants(1, true);
            setLastRefreshTime(Date.now());
            if (route.params?.refresh) navigation.setParams({ refresh: undefined });
          }
        } catch (error) {
          console.error('[MarketplaceScreen] Error checking for updates:', error);
        }
      };

      checkUpdates();

      (async () => {
        try {
          const cachedLocation = await AsyncStorage.getItem('@UserLocation');
          if (cachedLocation) setUserLocation(JSON.parse(cachedLocation));
        } catch (e) {
          console.warn('Error loading cached location:', e);
        }
      })();
    }, [navigation, route.params?.refresh])
  );

  useEffect(() => { applyFilters(); }, [searchQuery, selectedCategory, priceRange, plants, sortOption, sellerType]);

  const handleMarketplaceUpdate = useCallback((updateType, data) => {
    const currentLoadPlants = loadPlantsRef.current;
    if (updateType === UPDATE_TYPES.WISHLIST) {
      if (data?.plantId) {
        setPlants((prev) => {
          const updated = [...prev];
          const idx = updated.findIndex((p) => p.id === data.plantId || p._id === data.plantId);
          if (idx >= 0) {
            updated[idx] = {
              ...updated[idx],
              isFavorite: data.isFavorite,
              isWished: data.isFavorite,
              seller: updated[idx].seller || {
                name: updated[idx].sellerName || 'Plant Enthusiast',
                _id: updated[idx].sellerId,
              },
            };
          }
          return updated;
        });
      } else {
        currentLoadPlants && currentLoadPlants(1, true);
      }
    } else if ([UPDATE_TYPES.PRODUCT, UPDATE_TYPES.REVIEW, UPDATE_TYPES.INVENTORY].includes(updateType)) {
      currentLoadPlants && currentLoadPlants(1, true);
    }
    setLastRefreshTime(Date.now());
  }, []);

  useMarketplaceUpdates(handleMarketplaceUpdate);

  const onRefresh = async () => {
    setIsRefreshing(true);
    await loadPlants(1, true, sellerType);
  };

  const applyFilters = () => {
    if (!plants.length) return;
    let results = normalizePlantSellerInfo([...plants]);

    if (sellerType !== 'all') {
      results = results.filter((plant) => {
        const isBusinessSeller = plant.seller?.isBusiness || plant.sellerType === 'business';
        return sellerType === 'business' ? isBusinessSeller : !isBusinessSeller;
      });
    }

    if (selectedCategory !== 'All') {
      results = results.filter((plant) =>
        plant.category?.toLowerCase() === selectedCategory.toLowerCase()
      );
    }

    results = results.filter((plant) => {
      const price = parseFloat(plant.price);
      return !isNaN(price) && price >= priceRange.min && price <= priceRange.max;
    });

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      results = results.filter((plant) =>
        plant.name?.toLowerCase().includes(q) ||
        plant.title?.toLowerCase().includes(q) ||
        plant.description?.toLowerCase().includes(q) ||
        plant.city?.toLowerCase().includes(q) ||
        (typeof plant.location === 'string' && plant.location.toLowerCase().includes(q)) ||
        (plant.location?.city && plant.location.city.toLowerCase().includes(q)) ||
        plant.category?.toLowerCase().includes(q)
      );
    }

    activeFilters.forEach((filter) => {
      if (filter.type === 'seller' && filter.value) {
        results = results.filter((plant) =>
          plant.sellerId === filter.value ||
          plant.seller?.name?.toLowerCase() === filter.value.toLowerCase()
        );
      }
    });

    results = sortPlants(results, sortOption);
    setFilteredPlants(results);
  };

  const sortPlants = (arr, option) => {
    switch (option) {
      case 'recent':
        return [...arr].sort((a, b) =>
          new Date(b.addedAt || b.listedDate || 0) - new Date(a.addedAt || a.listedDate || 0)
        );
      case 'oldest':
        return [...arr].sort((a, b) =>
          new Date(a.addedAt || a.listedDate || 0) - new Date(b.addedAt || b.listedDate || 0)
        );
      case 'priceAsc':  return [...arr].sort((a, b) => parseFloat(a.price) - parseFloat(b.price));
      case 'priceDesc': return [...arr].sort((a, b) => parseFloat(b.price) - parseFloat(a.price));
      case 'rating':    return [...arr].sort((a, b) => (b.rating || 0) - (a.rating || 0));
      default:          return arr;
    }
  };

  const handleSearch = (query) => {
    setSearchQuery(query);
    if (query !== searchQuery) loadPlants(1, true, sellerType);
  };

  const handleSubmitSearch = () => { loadPlants(1, true, sellerType); };

  const handleCategorySelect = (categoryId) => {
    setSelectedCategory(categoryId);
    if (categoryId !== selectedCategory) loadPlants(1, true, sellerType);
  };

  const handleSellerTypeChange = (newSellerType) => {
    setSellerType(newSellerType);
    setPage(1);
    setHasMorePages(true);
    setPlants([]);
    setFilteredPlants([]);
    loadPlants(1, true, newSellerType);
  };

  const handlePriceRangeChange = (range) => {
    setPriceRange(range);
    applyFilters();
  };

  const handleSortChange = (option) => setSortOption(option);

  const handleViewModeChange = (mode) => {
    if (mode === 'map') {
      navigation.navigate('MapView', {
        products: filteredPlants,                 
        initialRegion: userLocation && { latitude: userLocation.latitude, longitude: userLocation.longitude, zoom: 12 },
        myLocation: userLocation,                
        showMyLocation: true,
      });
    } else {
      setViewMode(mode);
    }
  };

  const handleLoadMore = () => { if (!isLoading && hasMorePages) loadPlants(page + 1); };

  const handleRemoveFilter = (filterId) => setActiveFilters((prev) => prev.filter((f) => f.id !== filterId));

  const handleResetFilters = () => {
    setSellerType('all');
    setSelectedCategory('All');
    setSearchQuery('');
    setPriceRange({ min: 0, max: 1000 });
    setActiveFilters([]);
    loadPlants(1, true, 'all');
  };

  const handleContactSeller = (plant) => {
    const isBusiness = plant.seller?.isBusiness || plant.sellerType === 'business';
    const sellerId = plant.sellerId || plant.seller?._id;
    const sellerName = plant.seller?.name || plant.sellerName;
    if (!sellerId) { Alert.alert('Error', 'Seller information is not available.'); return; }
    const messageParams = {
      sellerId,
      plantId: plant.id || plant._id,
      plantName: plant.title || plant.name,
      sellerName,
      isBusiness,
      ...(isBusiness ? { autoMessage: `Hello, I would like to buy ${plant.title || plant.name}. Is it still available?` } : {}),
    };
    navigateToMessages(messageParams);
  };

  const handleOrderPlant = (plant) => {
    const sellerId = plant.sellerId || plant.seller?._id;
    const sellerName = plant.seller?.name || plant.sellerName;
    if (!sellerId) { Alert.alert('Error', 'Seller information is not available.'); return; }
    const messageParams = {
      sellerId,
      plantId: plant.id || plant._id,
      plantName: plant.title || plant.name,
      sellerName,
      isBusiness: true,
      autoMessage: `Hello, I would like to order ${plant.title || plant.name}. What is the pickup process?`,
    };
    navigateToMessages(messageParams);
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
          <TouchableOpacity style={styles.retryButton} onPress={() => loadPlants(1, true, sellerType)}>
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

  const renderPlantItem = ({ item }) => (
    <View style={viewMode === 'grid' ? styles.gridItemWrapper : styles.listItemWrapper}>
      <PlantCard
        plant={item}
        showActions
        layout={viewMode}
        onContactPress={() => handleContactSeller(item)}
        onOrderPress={() => handleOrderPlant(item)}
      />
    </View>
  );

  if (isLoading && plants.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <MarketplaceHeader
          title="Plant Marketplace"
          showBackButton
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
          showBackButton
          onBackPress={handleBackPress}
          onNotificationsPress={() => navigateToMessages({})}
        />
        <View style={styles.centerContainer}>
          <MaterialIcons name="error-outline" size={48} color="#f44336" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => loadPlants(1, true, sellerType)}>
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
        showBackButton
        onBackPress={handleBackPress}
        onNotificationsPress={() => navigateToMessages({})}
      />
      <View style={styles.topSections}>
        <SearchBar
          value={searchQuery}
          onChangeText={handleSearch}
          onSubmit={handleSubmitSearch}
          sellerType={sellerType}
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
          category={selectedCategory}
          onCategoryChange={handleCategorySelect}
          sellerType={sellerType}
          onSellerTypeChange={handleSellerTypeChange}
          activeFilters={activeFilters}
          onRemoveFilter={handleRemoveFilter}
          onResetFilters={handleResetFilters}
          businessCounts={sellerTypeCounts}
        />
      </View>

      <View style={styles.listSection}>
        <FlatList
          data={filteredPlants}
          renderItem={renderPlantItem}
          numColumns={viewMode === 'grid' ? 2 : 1}
          key={`${viewMode}-${Platform.OS}`}
          keyExtractor={(item, index) => (item.id ?? item._id ?? index).toString()}
          contentContainerStyle={[
            styles.listContainer,
            filteredPlants.length === 0 && styles.emptyListContainer,
          ]}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={renderFooter}
          ListEmptyComponent={renderEmptyList}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={onRefresh}
              colors={['#4CAF50']}
              tintColor="#4CAF50"
            />
          }
          columnWrapperStyle={viewMode === 'grid' ? styles.gridRow : null}
          ItemSeparatorComponent={viewMode === 'list' ? () => <View style={styles.listSeparator} /> : null}
          keyboardShouldPersistTaps="handled"
          removeClippedSubviews
          initialNumToRender={8}
          windowSize={7}
          maxToRenderPerBatch={10}
        />
      </View>

      {userType !== 'business' && (
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => navigation.navigate('AddPlant')}
          accessible
          accessibilityLabel="Add a new plant"
          accessibilityRole="button"
        >
          <MaterialIcons name="add" size={30} color="#fff" />
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  searchBarContainer: { alignItems: 'center', paddingVertical: 12 },
  listContainer: { paddingHorizontal: 8, paddingBottom: 80 },
  emptyListContainer: { flexGrow: 1 },

  // Clean, even grid layout
  gridRow: {
    paddingHorizontal: H_PADDING,
    justifyContent: 'space-between',
  },
  gridItemWrapper: {
    width: CARD_W,
    marginVertical: 4,
  },

  listItemWrapper: { marginHorizontal: 8, marginVertical: 4 },
  listSeparator: { height: 8 },

  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, minHeight: 300 },
  loadingText: { marginTop: 10, fontSize: 16, color: '#666' },
  errorText: { marginTop: 10, fontSize: 16, color: '#f44336', textAlign: 'center', marginBottom: 16 },
  noResultsText: { marginTop: 10, fontSize: 18, color: '#666', textAlign: 'center' },
  subText: { marginTop: 8, fontSize: 14, color: '#999', textAlign: 'center' },
  retryButton: { marginTop: 16, backgroundColor: '#4CAF50', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 6 },
  retryText: { color: '#fff', fontWeight: '600' },
  resetButton: { marginTop: 16, backgroundColor: '#4CAF50', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 6 },
  resetButtonText: { color: '#fff', fontWeight: '600' },
  footerContainer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', padding: 16 },
  footerText: { marginLeft: 8, color: '#666' },

  addButton: {
    position: 'absolute', right: 20, bottom: 20, width: 60, height: 60, borderRadius: 30,
    backgroundColor: '#4CAF50', justifyContent: 'center', alignItems: 'center',
    elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4,
  },

  topSections: { paddingHorizontal: 8, paddingTop: 6, paddingBottom: 8, backgroundColor: '#fff' },
  listSection: { flex: 1, minHeight: 0 },
});

export default MarketplaceScreen;
