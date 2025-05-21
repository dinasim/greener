// Business/components/TopSellingProductsList.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Animated,
  Platform,
  Alert,
  Modal,
} from 'react-native';
import { 
  MaterialCommunityIcons, 
  MaterialIcons,
  Ionicons 
} from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function TopSellingProductsList({
  businessId,
  refreshing = false,
  onRefresh = () => {},
  timeframe = 'month', // 'week', 'month', 'quarter', 'year'
  onTimeframeChange = () => {},
  onProductPress = () => {},
  limit = 10,
}) {
  // State
  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [sortBy, setSortBy] = useState('quantity'); // 'quantity', 'revenue', 'profit'
  
  // Animation refs
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  
  // Get headers with authentication
  const getHeaders = async () => {
    try {
      const userEmail = await AsyncStorage.getItem('userEmail');
      const userType = await AsyncStorage.getItem('userType');
      const businessIdStored = await AsyncStorage.getItem('businessId');
      
      return {
        'Content-Type': 'application/json',
        'X-User-Email': userEmail || '',
        'X-User-Type': userType || 'business',
        'X-Business-ID': businessIdStored || businessId,
      };
    } catch (error) {
      console.error('Error getting headers:', error);
      return {
        'Content-Type': 'application/json',
      };
    }
  };

  // Load top selling products from API
  const loadTopSellingProducts = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      console.log('Loading top selling products for business:', businessId);
      
      const headers = await getHeaders();
      const response = await fetch(
        `https://usersfunctions.azurewebsites.net/api/business/analytics/top-products?businessId=${businessId}&timeframe=${timeframe}&sortBy=${sortBy}&limit=${limit}`, 
        {
          method: 'GET',
          headers,
        }
      );
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: Failed to load top selling products`);
      }
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to load top selling products');
      }
      
      setProducts(result.data.products || []);
      
      console.log('Top selling products loaded:', result.data.products?.length || 0);
      
      // Success animation
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 500,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]).start();
      
    } catch (error) {
      console.error('Error loading top selling products:', error);
      setError(error.message);
      setProducts([]);
    } finally {
      setIsLoading(false);
    }
  }, [businessId, timeframe, sortBy, limit]);

  // Initial load
  useEffect(() => {
    if (businessId) {
      loadTopSellingProducts();
    }
  }, [loadTopSellingProducts]);

  // Handle refresh
  const handleRefresh = useCallback(() => {
    loadTopSellingProducts();
    onRefresh();
  }, [loadTopSellingProducts, onRefresh]);

  // Handle timeframe change
  const handleTimeframeChange = (newTimeframe) => {
    onTimeframeChange(newTimeframe);
  };

  // Handle sort change
  const handleSortChange = (newSortBy) => {
    setSortBy(newSortBy);
  };

  // Handle product press
  const handleProductPress = (product) => {
    setSelectedProduct(product);
    setDetailModalVisible(true);
    onProductPress(product);
  };

  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount || 0);
  };

  // Format percentage
  const formatPercentage = (value) => {
    return `${(value || 0).toFixed(1)}%`;
  };

  // Get rank badge color
  const getRankBadgeColor = (rank) => {
    switch (rank) {
      case 1: return '#FFD700'; // Gold
      case 2: return '#C0C0C0'; // Silver
      case 3: return '#CD7F32'; // Bronze
      default: return '#4CAF50';
    }
  };

  // Get rank icon
  const getRankIcon = (rank) => {
    switch (rank) {
      case 1: return 'trophy';
      case 2: return 'medal';
      case 3: return 'medal-outline';
      default: return 'star';
    }
  };

  // Get sort display value
  const getSortDisplayValue = (product, sortType) => {
    switch (sortType) {
      case 'quantity':
        return `${product.totalSold || 0} sold`;
      case 'revenue':
        return formatCurrency(product.totalRevenue || 0);
      case 'profit':
        return formatCurrency(product.totalProfit || 0);
      default:
        return `${product.totalSold || 0} sold`;
    }
  };

  // Render product item
  const renderProductItem = ({ item, index }) => {
    const rank = index + 1;
    
    return (
      <Animated.View
        style={[
          styles.productCard,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          }
        ]}
      >
        <TouchableOpacity 
          style={styles.productContent}
          onPress={() => handleProductPress(item)}
          activeOpacity={0.7}
        >
          {/* Rank Badge */}
          <View style={[styles.rankBadge, { backgroundColor: getRankBadgeColor(rank) }]}>
            <MaterialCommunityIcons 
              name={getRankIcon(rank)} 
              size={16} 
              color="#fff" 
            />
            <Text style={styles.rankText}>#{rank}</Text>
          </View>
          
          {/* Product Info */}
          <View style={styles.productInfo}>
            <View style={styles.productHeader}>
              <Text style={styles.productName} numberOfLines={1}>
                {item.name || item.common_name || 'Unknown Product'}
              </Text>
              <View style={styles.productTypeIcon}>
                <MaterialCommunityIcons 
                  name={item.productType === 'plant' ? 'leaf' : 'cube-outline'} 
                  size={16} 
                  color="#4CAF50" 
                />
              </View>
            </View>
            
            {item.scientific_name && (
              <Text style={styles.productScientific} numberOfLines={1}>
                {item.scientific_name}
              </Text>
            )}
            
            <View style={styles.productStats}>
              <View style={styles.statItem}>
                <MaterialIcons name="shopping-cart" size={14} color="#666" />
                <Text style={styles.statText}>
                  {item.totalSold || 0} sold
                </Text>
              </View>
              
              <View style={styles.statItem}>
                <MaterialIcons name="attach-money" size={14} color="#666" />
                <Text style={styles.statText}>
                  {formatCurrency(item.totalRevenue || 0)}
                </Text>
              </View>
              
              {item.growthRate !== undefined && (
                <View style={styles.statItem}>
                  <MaterialIcons 
                    name={item.growthRate >= 0 ? "trending-up" : "trending-down"} 
                    size={14} 
                    color={item.growthRate >= 0 ? "#4CAF50" : "#F44336"} 
                  />
                  <Text style={[
                    styles.statText,
                    { color: item.growthRate >= 0 ? "#4CAF50" : "#F44336" }
                  ]}>
                    {formatPercentage(Math.abs(item.growthRate))}
                  </Text>
                </View>
              )}
            </View>
          </View>
          
          {/* Main Metric */}
          <View style={styles.primaryMetric}>
            <Text style={styles.primaryMetricValue}>
              {getSortDisplayValue(item, sortBy)}
            </Text>
            <Text style={styles.primaryMetricLabel}>
              {sortBy === 'quantity' ? 'Total Sold' : 
               sortBy === 'revenue' ? 'Revenue' : 'Profit'}
            </Text>
          </View>
          
          {/* Action Button */}
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => handleProductPress(item)}
          >
            <MaterialIcons name="arrow-forward" size={20} color="#4CAF50" />
          </TouchableOpacity>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  // Render loading state
  if (isLoading && products.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text style={styles.loadingText}>Loading top products...</Text>
      </View>
    );
  }

  // Render error state
  if (error && products.length === 0) {
    return (
      <View style={styles.errorContainer}>
        <MaterialIcons name="error-outline" size={48} color="#f44336" />
        <Text style={styles.errorTitle}>Unable to Load Top Products</Text>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={handleRefresh}>
          <MaterialIcons name="refresh" size={20} color="#fff" />
          <Text style={styles.retryButtonText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header with Controls */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          <MaterialCommunityIcons name="trophy" size={20} color="#4CAF50" />
          {' '}Top Selling Products
        </Text>
        
        {/* Timeframe Selector */}
        <View style={styles.controlsRow}>
          <Text style={styles.controlLabel}>Period:</Text>
          <View style={styles.timeframeContainer}>
            {['week', 'month', 'quarter', 'year'].map((period) => (
              <TouchableOpacity
                key={period}
                style={[
                  styles.timeframeButton,
                  timeframe === period && styles.activeTimeframe
                ]}
                onPress={() => handleTimeframeChange(period)}
              >
                <Text style={[
                  styles.timeframeText,
                  timeframe === period && styles.activeTimeframeText
                ]}>
                  {period.charAt(0).toUpperCase() + period.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        
        {/* Sort Selector */}
        <View style={styles.controlsRow}>
          <Text style={styles.controlLabel}>Sort by:</Text>
          <View style={styles.sortContainer}>
            {[
              { key: 'quantity', label: 'Quantity', icon: 'inventory' },
              { key: 'revenue', label: 'Revenue', icon: 'attach-money' },
              { key: 'profit', label: 'Profit', icon: 'trending-up' },
            ].map((sort) => (
              <TouchableOpacity
                key={sort.key}
                style={[
                  styles.sortButton,
                  sortBy === sort.key && styles.activeSortButton
                ]}
                onPress={() => handleSortChange(sort.key)}
              >
                <MaterialIcons 
                  name={sort.icon} 
                  size={16} 
                  color={sortBy === sort.key ? '#fff' : '#4CAF50'} 
                />
                <Text style={[
                  styles.sortText,
                  sortBy === sort.key && styles.activeSortText
                ]}>
                  {sort.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>

      {/* Products List */}
      <FlatList
        data={products}
        renderItem={renderProductItem}
        keyExtractor={item => item.id || item.productId}
        style={styles.productsList}
        contentContainerStyle={styles.productsListContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={['#4CAF50']}
            tintColor="#4CAF50"
          />
        }
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons name="chart-line" size={64} color="#e0e0e0" />
            <Text style={styles.emptyTitle}>No Sales Data</Text>
            <Text style={styles.emptyText}>
              Complete some sales to see your top selling products
            </Text>
            <TouchableOpacity style={styles.refreshButton} onPress={handleRefresh}>
              <MaterialIcons name="refresh" size={20} color="#4CAF50" />
              <Text style={styles.refreshButtonText}>Refresh</Text>
            </TouchableOpacity>
          </View>
        }
      />

      {/* Product Detail Modal */}
      <Modal
        visible={detailModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setDetailModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Product Details</Text>
              <TouchableOpacity onPress={() => setDetailModalVisible(false)}>
                <MaterialIcons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            
            {selectedProduct && (
              <View style={styles.modalContent}>
                <View style={styles.productDetailHeader}>
                  <View style={styles.productDetailIcon}>
                    <MaterialCommunityIcons 
                      name={selectedProduct.productType === 'plant' ? 'leaf' : 'cube-outline'} 
                      size={32} 
                      color="#4CAF50" 
                    />
                  </View>
                  <View style={styles.productDetailInfo}>
                    <Text style={styles.productDetailName}>
                      {selectedProduct.name || selectedProduct.common_name}
                    </Text>
                    {selectedProduct.scientific_name && (
                      <Text style={styles.productDetailScientific}>
                        {selectedProduct.scientific_name}
                      </Text>
                    )}
                  </View>
                </View>
                
                <View style={styles.detailMetrics}>
                  <View style={styles.detailMetric}>
                    <Text style={styles.detailMetricValue}>
                      {selectedProduct.totalSold || 0}
                    </Text>
                    <Text style={styles.detailMetricLabel}>Units Sold</Text>
                  </View>
                  
                  <View style={styles.detailMetric}>
                    <Text style={styles.detailMetricValue}>
                      {formatCurrency(selectedProduct.totalRevenue || 0)}
                    </Text>
                    <Text style={styles.detailMetricLabel}>Total Revenue</Text>
                  </View>
                  
                  <View style={styles.detailMetric}>
                    <Text style={styles.detailMetricValue}>
                      {formatCurrency(selectedProduct.averagePrice || 0)}
                    </Text>
                    <Text style={styles.detailMetricLabel}>Avg Price</Text>
                  </View>
                  
                  <View style={styles.detailMetric}>
                    <Text style={styles.detailMetricValue}>
                      {formatPercentage(selectedProduct.conversionRate || 0)}
                    </Text>
                    <Text style={styles.detailMetricLabel}>Conversion</Text>
                  </View>
                </View>
                
                {selectedProduct.monthlyData && (
                  <View style={styles.monthlyTrend}>
                    <Text style={styles.monthlyTrendTitle}>Monthly Performance</Text>
                    <View style={styles.monthlyBars}>
                      {selectedProduct.monthlyData.map((data, index) => (
                        <View key={index} style={styles.monthlyBar}>
                          <View 
                            style={[
                              styles.monthlyBarFill,
                              { 
                                height: `${(data.value / Math.max(...selectedProduct.monthlyData.map(d => d.value))) * 100}%`,
                                backgroundColor: '#4CAF50'
                              }
                            ]}
                          />
                          <Text style={styles.monthlyBarLabel}>{data.month}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}
                
                <TouchableOpacity 
                  style={styles.viewFullDetailsButton}
                  onPress={() => {
                    setDetailModalVisible(false);
                    // Navigate to full product details screen
                    onProductPress(selectedProduct);
                  }}
                >
                  <MaterialIcons name="open-in-new" size={20} color="#fff" />
                  <Text style={styles.viewFullDetailsText}>View Full Details</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f44336',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '600',
    marginLeft: 8,
  },
  header: {
    backgroundColor: '#fff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  controlsRow: {
    marginBottom: 12,
  },
  controlLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  timeframeContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  timeframeButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: '#f5f5f5',
  },
  activeTimeframe: {
    backgroundColor: '#4CAF50',
  },
  timeframeText: {
    fontSize: 12,
    color: '#666',
  },
  activeTimeframeText: {
    color: '#fff',
    fontWeight: '600',
  },
  sortContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  activeSortButton: {
    backgroundColor: '#4CAF50',
  },
  sortText: {
    fontSize: 12,
    color: '#4CAF50',
    marginLeft: 4,
  },
  activeSortText: {
    color: '#fff',
    fontWeight: '600',
  },
  productsList: {
    flex: 1,
  },
  productsListContent: {
    padding: 16,
  },
  productCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  productContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  rankBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 16,
    marginRight: 12,
  },
  rankText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 4,
  },
  productInfo: {
    flex: 1,
    marginRight: 12,
  },
  productHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  productName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  productTypeIcon: {
    marginLeft: 8,
  },
  productScientific: {
    fontSize: 14,
    fontStyle: 'italic',
    color: '#666',
    marginBottom: 8,
  },
  productStats: {
    flexDirection: 'row',
    gap: 12,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
  primaryMetric: {
    alignItems: 'center',
    marginRight: 12,
  },
  primaryMetricValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#4CAF50',
  },
  primaryMetricLabel: {
    fontSize: 10,
    color: '#666',
    marginTop: 2,
  },
  actionButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#f0f9f3',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  refreshButtonText: {
    color: '#fff',
    fontWeight: '600',
    marginLeft: 8,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    width: '90%',
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
  },
  modalContent: {
    padding: 20,
  },
  productDetailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  productDetailIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#f0f9f3',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  productDetailInfo: {
    flex: 1,
  },
  productDetailName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
  },
  productDetailScientific: {
    fontSize: 14,
    fontStyle: 'italic',
    color: '#666',
    marginTop: 4,
  },
  detailMetrics: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 20,
  },
  detailMetric: {
    flex: 0.48,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  detailMetricValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#4CAF50',
  },
  detailMetricLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  monthlyTrend: {
    marginBottom: 20,
  },
  monthlyTrendTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  monthlyBars: {
    flexDirection: 'row',
    height: 100,
    alignItems: 'flex-end',
    gap: 8,
  },
  monthlyBar: {
    flex: 1,
    alignItems: 'center',
  },
  monthlyBarFill: {
    width: '100%',
    backgroundColor: '#4CAF50',
    borderRadius: 4,
    minHeight: 4,
  },
  monthlyBarLabel: {
    fontSize: 10,
    color: '#666',
    marginTop: 4,
  },
  viewFullDetailsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4CAF50',
    paddingVertical: 14,
    borderRadius: 8,
  },
  viewFullDetailsText: {
    color: '#fff',
    fontWeight: '600',
    marginLeft: 8,
  },
});