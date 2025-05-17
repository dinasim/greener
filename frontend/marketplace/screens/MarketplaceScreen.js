// screens/MarketplaceScreen.js
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  SafeAreaView,
  RefreshControl,
  Alert,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Import components
import MarketplaceHeader from '../components/MarketplaceHeader';
import PlantCard from '../components/PlantCard';
import SearchBar from '../components/SearchBar';
import CategoryFilter from '../components/CategoryFilter';
import FilterSection from '../components/FilterSection';
import AzureMapView from '../components/AzureMapView';

// Import services
import { getAll, getNearbyProducts, geocodeAddress } from '../services/marketplaceApi';
import syncService from '../services/SyncService';
import { checkForUpdate, clearUpdate, UPDATE_TYPES, addUpdateListener, removeUpdateListener } from '../services/MarketplaceUpdates';


/**
 * Custom hook to listen for marketplace updates
 * @param {Function} callback - Function to call when an update occurs
 */
const useMarketplaceUpdates = (callback) => {
  useEffect(() => {
    // Generate a unique ID for this listener
    const listenerId = 'marketplace-screen-' + Date.now();
    
    // Add the event listener
    addUpdateListener(listenerId, callback);
    
    // Clean up listener on unmount
    return () => {
      removeUpdateListener(listenerId);
    };
  }, [callback]);
};

/**
 * Enhanced MarketplaceScreen with map integration and improved filtering
 */
const MarketplaceScreen = ({ navigation, route }) => {
  // State
  const [plants, setPlants] = useState([]);
  const [filteredPlants, setFilteredPlants] = useState([]);
  const [mapProducts, setMapProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isMapLoading, setIsMapLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [priceRange, setPriceRange] = useState({ min: 0, max: 1000 });
  const [sortOption, setSortOption] = useState('recent');
  const [viewMode, setViewMode] = useState('grid'); // 'grid', 'list', or 'map'
  const [page, setPage] = useState(1);
  const [hasMorePages, setHasMorePages] = useState(true);
  const [error, setError] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [activeFilters, setActiveFilters] = useState([]);
  const [isOnline, setIsOnline] = useState(true);
  const [lastRefreshTime, setLastRefreshTime] = useState(Date.now());

  // Refs to avoid circular dependencies
  const plantsRef = useRef(plants);
  const loadPlantsRef = useRef(null);

  // Handler for back button press - navigate to Home screen
  const handleBackPress = () => {
    navigation.navigate('Home');
  };

  /**
   * Handle navigation to Messages screen
   * Safely navigates to Messages or shows a fallback
   * @param {Object} params - Parameters for the Messages screen
   */
  const navigateToMessages = (params) => {
    try {
      // Check if we can navigate to MainTabs first
      if (navigation.canNavigate('MainTabs')) {
        // If MainTabs exists, try to navigate there and then to Messages
        navigation.navigate('MainTabs', {
          screen: 'Messages',
          params: params
        });
      } else if (navigation.canNavigate('Messages')) {
        // Direct navigation if Messages screen exists
        navigation.navigate('Messages', params);
      } else {
        // Fallback if Messages screen doesn't exist
        console.warn('Messages screen not found in navigation');
        Alert.alert(
          'Navigation Error',
          'Messages screen is not available. Please check app configuration.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Navigation error:', error);
      Alert.alert(
        'Error',
        'Could not navigate to messages. Please try again later.',
        [{ text: 'OK' }]
      );
    }
  };

  /**
   * Ensure all plants have proper seller information
   * @param {Array} plantsArray - Array of plant objects
   * @returns {Array} - Array with normalized seller information
   */
  const normalizePlantSellerInfo = (plantsArray) => {
    return plantsArray.map(plant => {
      // If plant already has proper seller object, return it unchanged
      if (plant.seller && plant.seller.name && plant.seller.name !== 'Unknown Seller') {
        return plant;
      }
      
      // Otherwise, create a seller object from available data
      return {
        ...plant,
        seller: {
          name: plant.sellerName || (plant.seller?.name && plant.seller.name !== 'Unknown Seller' ? plant.seller.name : 'Plant Enthusiast'),
          _id: plant.sellerId || plant.seller?._id || 'unknown',
          // Include any other seller properties that might be used
          ...(plant.seller || {})
        }
      };
    });
  };
/**
 * Format location for display
 * @param {Object} locationData - The location data
 * @returns {string} - Formatted location string
 */
const formatLocation = (locationData) => {
  if (!locationData) return 'Location unavailable';
  
  let formattedLocation = '';
  
  // Use city if available
  if (locationData.city) {
    formattedLocation = locationData.city;
  }
  
  // Add state/region if available
  if (locationData.region && locationData.region !== locationData.city) {
    if (formattedLocation) {
      formattedLocation += `, ${locationData.region}`;
    } else {
      formattedLocation = locationData.region;
    }
  }
  
  // Add country if available and not already included
  if (locationData.country && !formattedLocation.includes(locationData.country) && 
      locationData.country !== locationData.city && locationData.country !== locationData.region) {
    if (formattedLocation) {
      formattedLocation += `, ${locationData.country}`;
    } else {
      formattedLocation = locationData.country;
    }
  }
  
  // If formatted location is still empty, use coordinates as last resort
  if (!formattedLocation && locationData.latitude && locationData.longitude) {
    formattedLocation = `Near ${locationData.latitude.toFixed(2)}, ${locationData.longitude.toFixed(2)}`;
  }
  
  return formattedLocation;
};



  /**
   * Load plants from API
   * @param {number} pageNum Page number to load
   * @param {boolean} resetData Whether to reset existing data
   */
  const loadPlants = useCallback(async (pageNum = 1, resetData = false) => {
    if (!hasMorePages && pageNum > 1 && !resetData) return;
  
    try {
      setError(null);
  
      if (pageNum === 1) {
        setIsLoading(true);
      }
  
      // Check if we're online
      if (!isOnline) {
        // Try to get cached data from SyncService
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
  
      // Get plants from API
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
  
      // Update state with new data
      if (data && data.products) {
        const normalizedProducts = normalizePlantSellerInfo(data.products);
        
        if (resetData) {
          setPlants(normalizedProducts);
        } else {
          setPlants(prevPlants => [...prevPlants, ...normalizedProducts]);
        }
  
        setPage(pageNum);
        setHasMorePages(data.pages > pageNum);
        
        // Cache data for offline access
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

  // Keep refs updated with latest values
  useEffect(() => {
    plantsRef.current = plants;
  }, [plants]);

  useEffect(() => {
    loadPlantsRef.current = loadPlants;
  }, [loadPlants]);

  // Subscribe to sync service for online status
  useEffect(() => {
    const unsubscribe = syncService.registerSyncListener((event) => {
      if (event.type === 'CONNECTION_CHANGE') {
        setIsOnline(event.isOnline);
      }
    });
    
    // Get initial status
    const status = syncService.getSyncStatus();
    setIsOnline(status.isOnline);
    
    return unsubscribe;
  }, []);

  // Load plants when the screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadPlants(1, true);
      
      // Try to load user location from cache
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
      
      // Check for updates from AsyncStorage
      const checkUpdates = async () => {
        try {
          // Check each update type
          const updateTypes = Object.values(UPDATE_TYPES);
          let needsRefresh = false;
          
          for (const updateType of updateTypes) {
            const hasUpdate = await checkForUpdate(updateType, lastRefreshTime);
            if (hasUpdate) {
              needsRefresh = true;
              // Clear the update flag
              await clearUpdate(updateType);
            }
          }
          
          // Also check route params for refresh flag
          if (needsRefresh || route.params?.refresh) {
            loadPlants(1, true);
            setLastRefreshTime(Date.now());
            
            // Clear route params
            if (route.params?.refresh) {
              navigation.setParams({ refresh: undefined });
            }
          }
        } catch (error) {
          console.error('Error checking for updates:', error);
        }
      };
      
      checkUpdates();
    }, [lastRefreshTime, route.params?.refresh, navigation])
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

  // Persist view mode preference
  useEffect(() => {
    try {
      AsyncStorage.setItem('@ViewModePreference', viewMode);
    } catch (e) {
      console.warn('Error saving view mode preference:', e);
    }
  }, [viewMode]);

  // Load saved view mode preference
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
    // Check if wishlist was updated
    const checkWishlistUpdates = async () => {
      try {
        const wishlistUpdated = await AsyncStorage.getItem('WISHLIST_UPDATED');
        if (wishlistUpdated) {
          // Clear the flag
          await AsyncStorage.removeItem('WISHLIST_UPDATED');
          // Refresh data
          loadPlants(1, true);
        }
      } catch (error) {
        console.warn('Error checking wishlist updates:', error);
      }
    };
    
    checkWishlistUpdates();
  }, []);

  useEffect(() => {
    // Check if favorites were updated
    const checkFavoritesUpdates = async () => {
      try {
        // Check both old and new keys for backward compatibility
        const favoritesUpdated = await AsyncStorage.getItem('FAVORITES_UPDATED') 
                            || await AsyncStorage.getItem('WISHLIST_UPDATED');
                            
        if (favoritesUpdated) {
          // Clear both flags
          await AsyncStorage.removeItem('FAVORITES_UPDATED');
          await AsyncStorage.removeItem('WISHLIST_UPDATED');
          // Refresh data
          loadPlants(1, true);
        }
      } catch (error) {
        console.warn('Error checking favorites updates:', error);
      }
    };
    
    checkFavoritesUpdates();
  }, []);

  // Handler for marketplace updates that avoids circular dependencies
  const handleMarketplaceUpdate = useCallback((updateType, data) => {
    console.log(`[MarketplaceScreen] Received update: ${updateType}`, data);
    
    // Use the current plants from the ref
    const currentPlants = plantsRef.current;
    const currentLoadPlants = loadPlantsRef.current;
    
    // Refresh data based on update type
    if (updateType === UPDATE_TYPES.WISHLIST) {
      // Update a specific item if we can identify it
      if (data && data.plantId) {
        setPlants(prevPlants => {
          const updatedPlants = [...prevPlants];
          const plantIndex = updatedPlants.findIndex(
            p => p.id === data.plantId || p._id === data.plantId
          );
          
          if (plantIndex >= 0) {
            // Make sure we fully preserve the seller object
            updatedPlants[plantIndex] = {
              ...updatedPlants[plantIndex],
              isFavorite: data.isFavorite,
              isWished: data.isFavorite,
              // Ensure seller info is preserved explicitly
              seller: updatedPlants[plantIndex].seller || { 
                name: updatedPlants[plantIndex].sellerName || 'Plant Enthusiast',
                _id: updatedPlants[plantIndex].sellerId 
              }
            };
          }
          
          return updatedPlants;
        });
      } else {
        // If we can't identify the specific plant, reload all
        if (currentLoadPlants) currentLoadPlants(1, true);
      }
    } else if (updateType === UPDATE_TYPES.PRODUCT || updateType === UPDATE_TYPES.REVIEW) {
      // Full reload for product or review updates
      if (currentLoadPlants) currentLoadPlants(1, true);
    }
    
    setLastRefreshTime(Date.now());
  }, []);

  // Use our custom hook to listen for updates
  useMarketplaceUpdates(handleMarketplaceUpdate);

  /**
   * Load products with location data for map view
   */
  const loadMapProducts = async () => {
    try {
      setIsMapLoading(true);
      
      // If we have a user location, try to get nearby plants first
      if (userLocation && userLocation.latitude && userLocation.longitude) {
        try {
          const nearbyData = await getNearbyProducts(
            userLocation.latitude,
            userLocation.longitude,
            25, // 25km radius
            selectedCategory === 'All' ? null : selectedCategory
          );
          
          if (nearbyData && nearbyData.products && nearbyData.products.length > 0) {
            const normalizedData = normalizePlantSellerInfo(nearbyData.products);
            setMapProducts(normalizedData);
            setIsMapLoading(false);
            return;
          }
        } catch (err) {
          console.warn('Error getting nearby products:', err);
          // Fall back to using filtered plants
        }
      }
      
      // If nearby products API fails or returns no results, use filtered plants
      // Add location data to plants that don't have it
      const productsWithLocation = [];
      
      for (const plant of filteredPlants) {
        // Skip if no city data
        if (!plant.city && (!plant.location || typeof plant.location === 'object' && !plant.location.city)) {
          continue;
        }
        
        // Check if already has coordinates
        if (plant.location && 
            typeof plant.location === 'object' && 
            plant.location.latitude && 
            plant.location.longitude) {
          productsWithLocation.push(plant);
          continue;
        }
        
        // Try to geocode the city
        const cityToGeocode = plant.city || 
          (typeof plant.location === 'string' ? plant.location : plant.location?.city);
        
        if (cityToGeocode) {
          try {
            // Check if we have this location cached
            const cacheKey = `geocode_${cityToGeocode.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
            const cachedLocation = await AsyncStorage.getItem(cacheKey);
            
            if (cachedLocation) {
              // Use cached geocode result
              const locationData = JSON.parse(cachedLocation);
              productsWithLocation.push({
                ...plant,
                location: {
                  ...plant.location,
                  latitude: locationData.latitude,
                  longitude: locationData.longitude,
                  city: cityToGeocode
                }
              });
            } else if (isOnline) {
              // Geocode the city if online
              // Try to geocode the city if online
              const locationData = await geocodeAddress(cityToGeocode);
                            
              if (locationData && locationData.latitude && locationData.longitude) {
                // Cache the result
                await AsyncStorage.setItem(cacheKey, JSON.stringify(locationData));
                
                // Format the location string for display
              const locationData = JSON.parse(cachedLocation);
              const formattedLocation = formatLocation(locationData);

              productsWithLocation.push({
                ...plant,
                location: {
                  ...plant.location,
                  latitude: locationData.latitude,
                  longitude: locationData.longitude,
                  city: formattedLocation
                }
              });
              }
            }
          } catch (geocodeErr) {
            console.warn(`Error geocoding "${cityToGeocode}":`, geocodeErr);
          }
        }
      }
      
      setMapProducts(productsWithLocation);
      setIsMapLoading(false);
    } catch (err) {
      console.error('Error preparing map products:', err);
      setIsMapLoading(false);
    }
  };

  /**
   * Handle pull-to-refresh
   */
  const onRefresh = async () => {
    setIsRefreshing(true);
    await loadPlants(1, true);
  };

  /**
   * Apply all filters to the plants data
   */
  const applyFilters = () => {
    if (!plants.length) return;

    // First normalize seller information to ensure consistency
    let results = normalizePlantSellerInfo([...plants]);

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
          (typeof plant.location === 'string' && plant.location.toLowerCase().includes(query)) ||
          (plant.location?.city && plant.location.city.toLowerCase().includes(query)) ||
          plant.category?.toLowerCase().includes(query)
      );
    }

    // Apply custom active filters
    activeFilters.forEach(filter => {
      // Implement custom filter logic based on filter type
      if (filter.type === 'seller' && filter.value) {
        results = results.filter(plant => 
          plant.sellerId === filter.value || 
          plant.seller?.name?.toLowerCase() === filter.value.toLowerCase()
        );
      }
    });

    // Apply sorting
    results = sortPlants(results, sortOption);

    // Update filtered plants
    setFilteredPlants(results);
  };

  /**
   * Sort plants based on selected option
   * @param {Array} plantsToSort Plants array to sort
   * @param {string} option Sort option
   * @returns {Array} Sorted plants array
   */
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

  /**
   * Handle search
   * @param {string} query Search query
   */
  const handleSearch = (query) => {
    setSearchQuery(query);
    // Reset to page 1 when search changes
    if (query !== searchQuery) {
      loadPlants(1, true);
    }
  };

  /**
   * Handle category selection
   * @param {string} categoryId Selected category ID
   */
  const handleCategorySelect = (categoryId) => {
    setSelectedCategory(categoryId);
    // Reset to page 1 when category changes
    if (categoryId !== selectedCategory) {
      loadPlants(1, true);
    }
  };

  /**
   * Handle price range change
   * @param {Object} range Price range {min, max}
   */
  const handlePriceRangeChange = (range) => {
    setPriceRange(range);
  };

  /**
   * Handle sort option change
   * @param {string} option Sort option
   */
  const handleSortChange = (option) => {
    setSortOption(option);
  };

  /**
   * Handle view mode change
   * @param {string} mode View mode
   */
  const handleViewModeChange = (mode) => {
    setViewMode(mode);
  };

  /**
   * Handle load more
   */
  const handleLoadMore = () => {
    if (!isLoading && hasMorePages) {
      loadPlants(page + 1);
    }
  };

  /**
   * Handle plant selection from map
   * @param {string} productId Selected product ID
   */
  const handleMapProductSelect = (productId) => {
    navigation.navigate('PlantDetail', { plantId: productId });
  };

  

  /**
   * Handle removing a filter
   * @param {string} filterId Filter ID to remove
   */
  const handleRemoveFilter = (filterId) => {
    setActiveFilters(activeFilters.filter(f => f.id !== filterId));
  };

  /**
   * Handle resetting all filters
   */
  const handleResetFilters = () => {
    setActiveFilters([]);
    setPriceRange({ min: 0, max: 1000 });
    setSelectedCategory('All');
    setSearchQuery('');
    loadPlants(1, true);
  };

  /**
   * Render list empty component
   */
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

    // No network connection
    if (!isOnline) {
      return (
        <View style={styles.centerContainer}>
          <MaterialIcons name="cloud-off" size={48} color="#aaa" />
          <Text style={styles.noResultsText}>You're offline</Text>
          <Text style={styles.subText}>Connect to the internet to browse plants</Text>
        </View>
      );
    }

    // No results with filters applied
    return (
      <View style={styles.centerContainer}>
        <MaterialIcons name="eco" size={48} color="#aaa" />
        <Text style={styles.noResultsText}>No plants found matching your criteria</Text>
        <TouchableOpacity
          style={styles.resetButton}
          onPress={handleResetFilters}
        >
          <Text style={styles.resetButtonText}>Reset Filters</Text>
        </TouchableOpacity>
      </View>
    );
  };

  /**
   * Render footer for infinite scrolling
   */
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

  // Main error state - show if there's an error loading initial data
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
      {/* Custom Header with back button enabled */}
      <MarketplaceHeader
        title="Plant Marketplace"
        showBackButton={true}
        onBackPress={handleBackPress}
        onNotificationsPress={() => navigateToMessages({})}
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
        activeFilters={activeFilters}
        onRemoveFilter={handleRemoveFilter}
        onResetFilters={handleResetFilters}
      />

      {/* Conditional rendering based on view mode */}
{viewMode === 'map' ? (
  // Map View - Using Cross-Platform Azure Map View
  <View style={styles.mapContainer}>
    {isMapLoading ? (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text style={styles.loadingText}>Preparing map view...</Text>
      </View>
    ) : mapProducts.length > 0 ? (
          <AzureMapView
      products={mapProducts}
      onSelectProduct={handleMapProductSelect}
      initialRegion={
        userLocation
          ? { latitude: userLocation.latitude, longitude: userLocation.longitude, zoom: 10 }
          : undefined
      }
    />

    ) : (
      <View style={styles.centerContainer}>
        <MaterialIcons name="map" size={48} color="#aaa" />
        <Text style={styles.noResultsText}>No plants with location data found</Text>
        <TouchableOpacity
          style={styles.resetButton}
          onPress={handleResetFilters}
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
          numColumns={viewMode === 'grid' ? (Platform.OS === 'web' ? 3 : 2) : 1}
          key={`${viewMode}-${Platform.OS}`} // Forces remount when view mode or platform changes
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
      )}

      {/* Add Plant FAB */}
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
    fontSize: 18,
    color: '#666',
    textAlign: 'center',
  },
  subText: {
    marginTop: 8,
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 16,
    backgroundColor: '#4CAF50',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
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
    borderRadius: 6,
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
  mapContainer: {
    flex: 1,
    backgroundColor: '#f0f0f0',
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
});

export default MarketplaceScreen;