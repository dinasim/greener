// Business/components/TopSellingProductsList.js - REAL SALES DATA ONLY
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

// Import REAL API services
import { getBusinessOrders } from '../services/businessOrderApi';
import { getBusinessInventory } from '../services/businessInventoryApi';

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
      const [ordersData, inventoryData] = await Promise.all([
        getBusinessOrders(currentBusinessId),
        getBusinessInventory(currentBusinessId)
      ]);

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
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text style={styles.loadingText}>Loading sales data...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.emptyContainer}>
        <MaterialCommunityIcons name="alert-circle-outline" size={64} color="#F44336" />
        <Text style={styles.emptyTitle}>Unable to Load Sales Data</Text>
        <Text style={styles.emptyText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => loadTopSellingProducts()}>
          <Text style={styles.retryButtonText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (products.length === 0) {
    return renderEmptyState();
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={products}
        renderItem={renderProduct}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={['#4CAF50']}
            tintColor="#4CAF50"
          />
        }
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
    fontSize: 16,
  },
  productItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
  },
  rankContainer: {
    width: 40,
    alignItems: 'center',
  },
  rankText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  productInfo: {
    flex: 1,
    marginHorizontal: 12,
  },
  productName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  scientificName: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
    marginBottom: 6,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 16,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: 12,
    color: '#666',
  },
  rightSection: {
    alignItems: 'flex-end',
  },
  growthContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  growthText: {
    fontSize: 14,
    fontWeight: '600',
  },
  avgPriceText: {
    fontSize: 12,
    color: '#666',
  },
  separator: {
    height: 1,
    backgroundColor: '#F0F0F0',
    marginHorizontal: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#4CAF50',
    borderRadius: 6,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default TopSellingProductsList;