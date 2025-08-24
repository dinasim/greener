// screens/MarketplaceScreen.js — OPTIMIZED
import React, {
  useState, useEffect, useCallback, useRef, useMemo
} from 'react';
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

import { getAll } from '../services/marketplaceApi';
import * as WishlistService from '../services/WishlistService';
import syncService from '../services/SyncService';
import { UPDATE_TYPES, addUpdateListener, removeUpdateListener } from '../services/MarketplaceUpdates';

const { width } = Dimensions.get('window');
const H_PADDING = 8;
const COL_GAP   = 8;
const CARD_W    = (width - H_PADDING * 2 - COL_GAP) / 2;

// ---- Debounce hook (for search) --------------------------------------------
function useDebounced(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

const MarketplaceScreen = ({ navigation, route }) => {
  // Raw list from server (already normalized & wishlisted)
  const [plants, setPlants] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [userType, setUserType] = useState('individual');
  const [isOnline, setIsOnline] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMorePages, setHasMorePages] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedQuery = useDebounced(searchQuery, 320);              // ⬅ debounce
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [sellerType, setSellerType] = useState('all');
  const [priceRange, setPriceRange] = useState({ min: 0, max: 1000 });
  const [sortOption, setSortOption] = useState('recent');
  const [viewMode, setViewMode] = useState('grid');
  const [activeFilters, setActiveFilters] = useState([]);
  const [sellerTypeCounts, setSellerTypeCounts] = useState({ all: 0, individual: 0, business: 0 });

  // Refs for guards
  const loadingPagesRef = useRef(new Set());                          // ⬅ prevent duplicate loads per page
  const hasLoadedOnceRef = useRef(false);
  const onEndMomentumLock = useRef(false);

  // One-time: user type + connectivity
  useEffect(() => {
    (async () => {
      try {
        const storedUserType = await AsyncStorage.getItem('userType');
        setUserType(storedUserType || 'individual');
      } catch {}
    })();
    const unsubscribe = syncService.registerSyncListener((event) => {
      if (event.type === 'CONNECTION_CHANGE') setIsOnline(event.isOnline);
    });
    const status = syncService.getSyncStatus();
    setIsOnline(status.isOnline);
    return unsubscribe;
  }, []);

  // Centralized loader (server-side filtering to cut client work)
  const normalize = useCallback((arr) => {
    return arr.map((plant) => {
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
  }, []);

  const calculateSellerTypeCounts = useCallback((plantsArray) => {
    const counts = plantsArray.reduce((acc, p) => {
      acc.all += 1;
      if (p.seller?.isBusiness || p.sellerType === 'business') acc.business += 1;
      else acc.individual += 1;
      return acc;
    }, { all: 0, individual: 0, business: 0 });
    setSellerTypeCounts(counts);
  }, []);

  const loadPlants = useCallback(async (pageNum = 1, reset = false) => {
    if (!isOnline) {
      // Offline path: show cache quickly
      setError(null);
      if (pageNum === 1) setIsLoading(true);
      try {
        const cached = await syncService.getCachedData('marketplace_plants');
        if (cached) {
          setPlants(reset ? cached : (prev) => (pageNum === 1 ? cached : [...prev, ...cached]));
          calculateSellerTypeCounts(cached);
          setHasMorePages(false);
        } else {
          setError('You are offline. Please check your connection.');
        }
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
      return;
    }

    // Guard duplicate calls for the same page
    if (loadingPagesRef.current.has(pageNum)) return;
    loadingPagesRef.current.add(pageNum);

    try {
      setError(null);
      if (pageNum === 1) setIsLoading(true);

      // Server-side filtering reduces client work
      const data = await getAll(
        pageNum,
        selectedCategory === 'All' ? null : selectedCategory,
        debouncedQuery,
        {
          minPrice: priceRange.min,
          maxPrice: priceRange.max,
          sortBy: sortOption,
          sellerType: sellerType === 'all' ? null : sellerType,
        }
      );

      if (data?.products) {
        const normalized = normalize(data.products);
        // If your WishlistService can return a Set of wished IDs, prefer that over annotate() for O(1) tagging.
        const annotated = await WishlistService.annotate(normalized);
        if (reset || pageNum === 1) setPlants(annotated);
        else setPlants((prev) => [...prev, ...annotated]);

        setPage(pageNum);
        setHasMorePages(Boolean(data.pages > pageNum));
        if (data.sellerTypeCounts) setSellerTypeCounts(data.sellerTypeCounts);
        else calculateSellerTypeCounts(annotated);

        // Do not block UI on cache save
        syncService.cacheData('marketplace_plants', annotated).catch(() => {});
      }
    } catch (err) {
      console.error('Error loading plants:', err);
      setError('Failed to load plants. Please try again.');
    } finally {
      loadingPagesRef.current.delete(pageNum);
      setIsLoading(false);
      setIsRefreshing(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline, selectedCategory, debouncedQuery, priceRange.min, priceRange.max, sortOption, sellerType, normalize, calculateSellerTypeCounts]);

  // Initial + filter-driven loads (single source of truth)
  useEffect(() => {
    // Avoid firing twice on first focus + this effect
    if (!hasLoadedOnceRef.current) {
      hasLoadedOnceRef.current = true;
      loadPlants(1, true);
      return;
    }
    // On any filter change, reload page 1
    loadPlants(1, true);
  }, [loadPlants]);

  // Listen to cross-screen updates (wishlist, product changes, etc.)
  useEffect(() => {
    const id = 'marketplace-screen-' + Date.now();
    const onUpdate = (type, data) => {
      if (type === UPDATE_TYPES.WISHLIST) {
        if (data?.plantId) {
          setPlants((prev) => {
            const idx = prev.findIndex(p => (p.id || p._id) === data.plantId);
            if (idx < 0) return prev;
            const next = [...prev];
            next[idx] = { ...next[idx], isFavorite: data.isFavorite, isWished: data.isFavorite };
            return next;
          });
        } else {
          loadPlants(1, true);
        }
      } else if ([UPDATE_TYPES.PRODUCT, UPDATE_TYPES.REVIEW, UPDATE_TYPES.INVENTORY].includes(type)) {
        loadPlants(1, true);
      }
    };
    addUpdateListener(id, [UPDATE_TYPES.WISHLIST, UPDATE_TYPES.PRODUCT, UPDATE_TYPES.REVIEW, UPDATE_TYPES.INVENTORY], onUpdate);
    return () => removeUpdateListener(id);
  }, [loadPlants]);

  // Optional: If another screen sets route.params?.refresh
  useFocusEffect(useCallback(() => {
    if (route.params?.refresh) {
      navigation.setParams({ refresh: undefined });
      loadPlants(1, true);
    }
  }, [navigation, route.params?.refresh, loadPlants]));

  // ===== Derived list (cheap & memoized) ====================================
  const filteredPlants = useMemo(() => {
    if (!plants.length) return [];
    let results = plants;

    // Active “seller” chips that aren’t covered server-side
    activeFilters.forEach((filter) => {
      if (filter.type === 'seller' && filter.value) {
        results = results.filter((p) =>
          p.sellerId === filter.value ||
          p.seller?.name?.toLowerCase() === String(filter.value).toLowerCase()
        );
      }
    });

    return results;
  }, [plants, activeFilters]);

  // ===== Handlers (memoized) ================================================
  const handleBackPress = useCallback(() => navigation.navigate('Home'), [navigation]);

  const handleSearch = useCallback((q) => {
    // We only set state; debounced effect triggers the load.
    setSearchQuery(q);
  }, []);

  const handleSubmitSearch = useCallback(() => {
    // Force immediate load ignoring debounce
    loadPlants(1, true);
  }, [loadPlants]);

  const handleCategorySelect = useCallback((categoryId) => {
    setSelectedCategory(categoryId);
  }, []);

  const handleSellerTypeChange = useCallback((newType) => {
    setSellerType(newType);
    setPage(1);
    setHasMorePages(true);
    setPlants([]);
  }, []);

  const handlePriceRangeChange = useCallback((range) => {
    setPriceRange(range);
  }, []);

  const handleSortChange = useCallback((option) => {
    setSortOption(option);
  }, []);

  const handleViewModeChange = useCallback((mode) => {
    if (mode === 'map') {
      navigation.navigate('MapView', { products: filteredPlants });
    } else {
      setViewMode(mode);
    }
  }, [filteredPlants, navigation]);

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadPlants(1, true);
  }, [loadPlants]);

  const handleLoadMore = useCallback(() => {
    if (isLoading || !hasMorePages) return;
    if (onEndMomentumLock.current) return;
    onEndMomentumLock.current = true;
    loadPlants(page + 1);
  }, [isLoading, hasMorePages, loadPlants, page]);

  const onMomentumScrollBegin = useCallback(() => {
    onEndMomentumLock.current = false;
  }, []);

  const keyExtractor = useCallback((item, index) => (item.id ?? item._id ?? index).toString(), []);

  const handleContactSeller = useCallback((plant) => {
    const isBusiness = plant.seller?.isBusiness || plant.sellerType === 'business';
    const sellerId = plant.sellerId || plant.seller?._id;
    const sellerName = plant.seller?.name || plant.sellerName;
    if (!sellerId) { Alert.alert('Error', 'Seller information is not available.'); return; }
    navigation.navigate('Messages', {
      sellerId,
      plantId: plant.id || plant._id,
      plantName: plant.title || plant.name,
      sellerName,
      isBusiness,
      autoMessage: `Hi, I'm interested in your ${plant.title || plant.name}. Is it still available?`,
      forceChat: true,
    });
  }, [navigation]);

  const handleOrderPlant = useCallback((plant) => {
    const sellerId = plant.sellerId || plant.seller?._id;
    const sellerName = plant.seller?.name || plant.sellerName;
    if (!sellerId) { Alert.alert('Error', 'Seller information is not available.'); return; }
    navigation.navigate('Messages', {
      sellerId,
      plantId: plant.id || plant._id,
      plantName: plant.title || plant.name,
      sellerName,
      isBusiness: true,
      autoMessage: `Hi, I'd like to order ${plant.title || plant.name}. What is the pickup process?`,
      forceChat: true,
    });
  }, [navigation]);

  const renderPlantItem = useCallback(({ item }) => (
    <View style={viewMode === 'grid' ? styles.gridItemWrapper : styles.listItemWrapper}>
      <PlantCard
        plant={item}
        showActions
        layout={viewMode}
        onContactPress={() => handleContactSeller(item)}
        onOrderPress={() => handleOrderPlant(item)}
      />
    </View>
  ), [viewMode, handleContactSeller, handleOrderPlant]);

  const renderFooter = useCallback(() => {
    if (!isLoading || !hasMorePages) return null;
    return (
      <View style={styles.footerContainer}>
        <ActivityIndicator size="small" color="#4CAF50" />
        <Text style={styles.footerText}>Loading more plants...</Text>
      </View>
    );
  }, [isLoading, hasMorePages]);

  const renderEmptyList = useCallback(() => {
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
        <TouchableOpacity style={styles.resetButton} onPress={() => {
          setSellerType('all');
          setSelectedCategory('All');
          setSearchQuery('');
          setPriceRange({ min: 0, max: 1000 });
          setActiveFilters([]);
        }}>
          <Text style={styles.resetButtonText}>Reset Filters</Text>
        </TouchableOpacity>
      </View>
    );
  }, [isLoading, error, isOnline]);

  // ===== Render ==============================================================
  if (isLoading && plants.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <MarketplaceHeader
          title="Plant Marketplace"
          showBackButton
          onBackPress={handleBackPress}
          onNotificationsPress={() => navigation.navigate('Messages')}
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
          onNotificationsPress={() => navigation.navigate('Messages')}
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
        showBackButton
        onBackPress={handleBackPress}
        onNotificationsPress={() => navigation.navigate('Messages')}
      />
      <View style={styles.topSections}>
        <SearchBar
          value={searchQuery}
          onChangeText={handleSearch}             // ⬅ no immediate network call
          onSubmit={handleSubmitSearch}          // ⬅ user hits enter → force reload now
          sellerType={sellerType}
          style={styles.searchBarContainer}
        />
        <CategoryFilter selectedCategory={selectedCategory} onSelect={handleCategorySelect} />
        <FilterSection
          sortOption={sortOption} onSortChange={handleSortChange}
          priceRange={priceRange} onPriceChange={handlePriceRangeChange}
          viewMode={viewMode} onViewModeChange={handleViewModeChange}
          category={selectedCategory} onCategoryChange={handleCategorySelect}
          sellerType={sellerType} onSellerTypeChange={handleSellerTypeChange}
          activeFilters={activeFilters}
          onRemoveFilter={(id) => setActiveFilters((prev) => prev.filter(f => f.id !== id))}
          onResetFilters={() => {
            setSellerType('all'); setSelectedCategory('All'); setSearchQuery('');
            setPriceRange({ min: 0, max: 1000 }); setActiveFilters([]);
          }}
          businessCounts={sellerTypeCounts}
          showActiveChips
        />
      </View>

      <View style={styles.listSection}>
        <FlatList
          data={filteredPlants}
          renderItem={renderPlantItem}
          numColumns={viewMode === 'grid' ? 2 : 1}
          key={`${viewMode}-${Platform.OS}`}
          keyExtractor={keyExtractor}
          contentContainerStyle={[
            styles.listContainer,
            filteredPlants.length === 0 && styles.emptyListContainer,
          ]}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.4}
          onMomentumScrollBegin={onMomentumScrollBegin}
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
          initialNumToRender={6}                 // ⬅ smaller for faster first paint
          windowSize={10}                        // ⬅ show more offscreen for smooth scroll
          maxToRenderPerBatch={8}
          updateCellsBatchingPeriod={50}
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

  gridRow: { paddingHorizontal: H_PADDING, justifyContent: 'space-between' },
  gridItemWrapper: { width: CARD_W, marginVertical: 4 },

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
