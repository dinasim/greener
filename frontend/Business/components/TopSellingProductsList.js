// Business/components/TopSellingProductsList.js - FIXED IMPORTS
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

// FIXED: Import from existing API files
import { getBusinessOrders } from '../services/businessOrderApi';
import { getBusinessInventory } from '../services/businessApi'; // Use existing businessApi.js

const TopSellingProductsList = ({ 
  businessId, 
  sortBy = 'totalSold', 
  limit = 10, 
  onProductPress,
  refreshTrigger 
}) => {
  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  /**
   * Load REAL sales data from orders and inventory
   */
  const loadTopSellingProducts = async (silent = false) => {
    try {
      if (!silent) {
        setIsLoading(true);
      }
      setError(null);

      const currentBusinessId = businessId || await AsyncStorage.getItem('businessId');
      if (!currentBusinessId) {
        throw new Error('Business ID not available');
      }

      console.log('📊 Loading REAL top selling products for business:', currentBusinessId);

      // Load REAL orders and inventory data in parallel
      const [ordersResponse, inventoryResponse] = await Promise.all([
        getBusinessOrders(currentBusinessId),
        getBusinessInventory(currentBusinessId)
      ]);

      // FIXED: Handle different response formats from your APIs
      const ordersData = ordersResponse?.orders || ordersResponse || [];
      const inventoryData = inventoryResponse?.inventory || inventoryResponse?.data || [];

      console.log('✅ Loaded orders:', ordersData?.length || 0, 'inventory:', inventoryData?.length || 0);

      let productData = [];

      // Process REAL order data to calculate sales statistics
      if (ordersData && ordersData.length > 0) {
        const salesMap = new Map();
        
        ordersData.forEach(order => {
          if (order.status === 'completed' && order.items) {
            order.items.forEach(item => {
              const productId = item.productId || item.id;
              const quantity = item.quantity || 1;
              const price = item.price || 0;
              
              if (salesMap.has(productId)) {
                const existing = salesMap.get(productId);
                existing.totalSold += quantity;
                existing.totalRevenue += (price * quantity);
              } else {
                salesMap.set(productId, {
                  id: productId,
                  name: item.name || item.title || 'Unknown Product',
                  scientific_name: item.scientific_name || '',
                  productType: item.productType || 'plant',
                  category: item.category || 'houseplants',
                  totalSold: quantity,
                  totalRevenue: price * quantity,
                  lastSaleDate: order.completedAt || order.createdAt
                });
              }
            });
          }
        });

        // Convert sales map to array and calculate metrics
        productData = Array.from(salesMap.values()).map(product => {
          const averagePrice = product.totalSold > 0 ? product.totalRevenue / product.totalSold : 0;
          
          // Calculate growth rate based on recent sales vs older sales
          const recentSales = ordersData.filter(order => {
            const orderDate = new Date(order.createdAt);
            const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
            return orderDate >= thirtyDaysAgo && 
                   order.items?.some(item => (item.productId || item.id) === product.id);
          }).reduce((sum, order) => {
            return sum + (order.items?.find(item => (item.productId || item.id) === product.id)?.quantity || 0);
          }, 0);

          const oldSales = product.totalSold - recentSales;
          const growthRate = oldSales > 0 ? ((recentSales - oldSales) / oldSales) * 100 : (recentSales > 0 ? 100 : 0);

          return {
            ...product,
            averagePrice: Math.round(averagePrice * 100) / 100,
            growthRate: Math.round(growthRate),
            recentSales,
            oldSales
          };
        });

        console.log('📈 Calculated sales data for', productData.length, 'products');
      }

      // If no sales data available, show empty state instead of mock data
      if (productData.length === 0) {
        console.log('ℹ️ No sales data available - showing empty state');
        setProducts([]);
        if (!silent) {
          setIsLoading(false);
        }
        return;
      }

      // Sort products based on sortBy parameter
      let sortedProducts = [...productData];
      switch (sortBy) {
        case 'totalRevenue':
          sortedProducts.sort((a, b) => b.totalRevenue - a.totalRevenue);
          break;
        case 'averagePrice':
          sortedProducts.sort((a, b) => b.averagePrice - a.averagePrice);
          break;
        case 'growthRate':
          sortedProducts.sort((a, b) => b.growthRate - a.growthRate);
          break;
        case 'recentSales':
          sortedProducts.sort((a, b) => b.recentSales - a.recentSales);
          break;
        default: // totalSold
          sortedProducts.sort((a, b) => b.totalSold - a.totalSold);
          break;
      }

      // Limit results
      const limitedProducts = sortedProducts.slice(0, limit);
      
      setProducts(limitedProducts);
      console.log('✅ Top selling products loaded:', limitedProducts.length);

    } catch (err) {
      console.error('❌ Error loading top selling products:', err);
      setError(err.message);
      setProducts([]);
    } finally {
      if (!silent) {
        setIsLoading(false);
      }
      setRefreshing(false);
    }
  };

  // Load data on component mount and when refresh is triggered
  useEffect(() => {
    loadTopSellingProducts();
  }, [businessId, sortBy, limit, refreshTrigger]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadTopSellingProducts(true);
  };

  const renderProduct = ({ item, index }) => {
    return (
      <TouchableOpacity 
        style={styles.productItem}
        onPress={() => onProductPress && onProductPress(item)}
        activeOpacity={0.7}
      >
        <View style={styles.rankContainer}>
          <Text style={styles.rankText}>#{index + 1}</Text>
        </View>
        
        <View style={styles.productInfo}>
          <Text style={styles.productName} numberOfLines={1}>
            {item.name}
          </Text>
          
          {item.scientific_name ? (
            <Text style={styles.scientificName} numberOfLines={1}>
              {item.scientific_name}
            </Text>
          ) : null}
          
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <MaterialCommunityIcons name="cart" size={16} color="#666" />
              <Text style={styles.statText}>{item.totalSold} sold</Text>
            </View>
            
            <View style={styles.statItem}>
              <MaterialCommunityIcons name="currency-ils" size={16} color="#666" />
              <Text style={styles.statText}>₪{item.totalRevenue?.toFixed(2) || '0.00'}</Text>
            </View>
          </View>
        </View>
        
        <View style={styles.rightSection}>
          <View style={styles.growthContainer}>
            <MaterialCommunityIcons 
              name={item.growthRate > 0 ? 'trending-up' : item.growthRate < 0 ? 'trending-down' : 'trending-neutral'} 
              size={20} 
              color={item.growthRate > 0 ? '#4CAF50' : item.growthRate < 0 ? '#F44336' : '#9E9E9E'} 
            />
            <Text style={[styles.growthText, { 
              color: item.growthRate > 0 ? '#4CAF50' : item.growthRate < 0 ? '#F44336' : '#9E9E9E'
            }]}>
              {item.growthRate > 0 ? '+' : ''}{item.growthRate}%
            </Text>
          </View>
          
          <Text style={styles.avgPriceText}>
            Avg: ₪{item.averagePrice?.toFixed(2) || '0.00'}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <MaterialCommunityIcons name="chart-line-variant" size={64} color="#E0E0E0" />
      <Text style={styles.emptyTitle}>No Sales Data Available</Text>
      <Text style={styles.emptyText}>
        Start selling products to see your top performers here
      </Text>
    </View>
  );

  if (isLoading) {
  return (
    <View style={styles.cardWrap}>
      <View style={styles.card}>
        <ActivityIndicator size="large" color="#216a94" />
        <Text style={styles.loadingText}>Loading sales data...</Text>
      </View>
    </View>
  );
  }

  if (error) {
    return (
      <View style={styles.cardWrap}>
        <View style={styles.card}>
          <MaterialCommunityIcons name="alert-circle-outline" size={48} color="#F44336" />
          <Text style={styles.emptyTitle}>Unable to load</Text>
          <Text style={styles.emptyText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => loadTopSellingProducts()}>
            <Text style={styles.retryText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (products.length === 0) {
    return (
      <View style={styles.cardWrap}>
        <View style={styles.card}>
          <MaterialCommunityIcons name="chart-line-variant" size={48} color="#E0E0E0" />
          <Text style={styles.emptyTitle}>No Sales Data Available</Text>
          <Text style={styles.emptyText}>
            Start selling products to see your top performers here
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.listWrap}>
      <FlatList
        data={products}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.productCard}
            activeOpacity={0.8}
            onPress={() => onProductPress && onProductPress(item)}
          >
            {/* header row: name + pill */}
            <View style={styles.cardHeader}>
              <Text style={styles.productName} numberOfLines={1}>{item.name}</Text>
              <View style={[styles.pill, { backgroundColor: '#2196F3' }]}>
                <Text style={styles.pillText}>{item.totalSold} sold</Text>
              </View>
            </View>

            {/* details row */}
            <View style={styles.cardDetails}>
              <Text style={styles.detailLeft} numberOfLines={1}>
                Last sale: {item.lastSaleDate ? new Date(item.lastSaleDate).toLocaleDateString() : '—'}
              </Text>
            </View>

            {/* footer row */}
            <View style={styles.cardFooter}>
              <Text style={styles.totalText}>₪{(item.totalRevenue || 0).toFixed(2)}</Text>
              <Text style={styles.itemsText}>Avg ₪{(item.averagePrice || 0).toFixed(2)}</Text>
            </View>
          </TouchableOpacity>
        )}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={['#216a94']}
            tintColor="#216a94"
          />
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  // Keep a base container if you need it elsewhere
  container: {
    flex: 1,
  },

  // Match Recent Orders spacing
  listWrap: {
    marginHorizontal: 16,
    marginBottom: 24,
  },
  cardWrap: {
    marginHorizontal: 16,
    marginBottom: 24,
  },

  // Generic card (used for empty/loading/error)
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },

  // Loading state
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#216a94',
    fontSize: 16,
  },

  // Product item styled like an order card
  productCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },

  // Header row: name + small pill (like status)
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  productName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
    marginRight: 8,
  },
  pill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#2196F3',
  },
  pillText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },

  // Middle row: small details
  cardDetails: {
    marginBottom: 8,
  },
  detailLeft: {
    fontSize: 12,
    color: '#666',
  },

  // Footer row: totals
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  totalText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#216a94',
  },
  itemsText: {
    fontSize: 12,
    color: '#666',
  },

  // Optional separator (not used when each row is a card)
  separator: {
    height: 1,
    backgroundColor: '#F0F0F0',
    marginHorizontal: 16,
  },

  // Empty / error UI in a card
  emptyTitle: {
    fontSize: 16,
    color: '#666',
    marginTop: 12,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
    textAlign: 'center',
  },

  // Retry button styled like your "Create Order" button
  retryButton: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#216a94',
    backgroundColor: '#f0f8ff',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  retryText: {
    color: '#216a94',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default TopSellingProductsList;