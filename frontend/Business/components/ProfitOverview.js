// Business/components/ProfitOverview.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Animated,
  Platform,
  Dimensions,
  Alert,
} from 'react-native';
import { 
  MaterialCommunityIcons, 
  MaterialIcons,
  Ionicons 
} from '@expo/vector-icons';
import { LineChart, PieChart, BarChart } from 'react-native-chart-kit';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width } = Dimensions.get('window');

export default function ProfitOverview({
  businessId,
  refreshing = false,
  onRefresh = () => {},
  dateRange = 'month', // 'week', 'month', 'quarter', 'year'
  onDateRangeChange = () => {},
}) {
  // State
  const [profitData, setProfitData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMetric, setSelectedMetric] = useState('profit');
  const [trendData, setTrendData] = useState(null);
  const [categoryData, setCategoryData] = useState(null);
  const [error, setError] = useState(null);
  
  // Animation refs
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  
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

  // Load profit data from API
  const loadProfitData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      console.log('Loading profit data for business:', businessId, 'dateRange:', dateRange);
      
      const headers = await getHeaders();
      const response = await fetch(
        `https://usersfunctions.azurewebsites.net/api/business/analytics/profit?businessId=${businessId}&range=${dateRange}`, 
        {
          method: 'GET',
          headers,
        }
      );
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: Failed to load profit data`);
      }
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to load profit data');
      }
      
      // Extract data from API response
      const data = result.data;
      setProfitData(data.overview);
      setTrendData(data.trendData);
      setCategoryData(data.categoryBreakdown);
      
      console.log('Profit data loaded successfully:', data);
      
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
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 100,
          friction: 8,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]).start();
      
    } catch (error) {
      console.error('Error loading profit data:', error);
      setError(error.message);
      setProfitData(null);
      setTrendData(null);
      setCategoryData(null);
    } finally {
      setIsLoading(false);
    }
  }, [businessId, dateRange]);

  // Initial load
  useEffect(() => {
    if (businessId) {
      loadProfitData();
    }
  }, [loadProfitData]);

  // Handle refresh
  const handleRefresh = useCallback(() => {
    loadProfitData();
    onRefresh();
  }, [loadProfitData, onRefresh]);

  // Handle date range change
  const handleDateRangeChange = (newRange) => {
    onDateRangeChange(newRange);
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

  // Get trend color
  const getTrendColor = (growth) => {
    if (growth > 0) return '#4CAF50';
    if (growth < 0) return '#F44336';
    return '#FF9800';
  };

  // Get trend icon
  const getTrendIcon = (growth) => {
    if (growth > 0) return 'trending-up';
    if (growth < 0) return 'trending-down';
    return 'trending-flat';
  };

  // Render loading state
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text style={styles.loadingText}>Loading profit analytics...</Text>
      </View>
    );
  }

  // Render error state
  if (error) {
    return (
      <View style={styles.errorContainer}>
        <MaterialIcons name="error-outline" size={48} color="#f44336" />
        <Text style={styles.errorTitle}>Unable to Load Profit Data</Text>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={handleRefresh}>
          <MaterialIcons name="refresh" size={20} color="#fff" />
          <Text style={styles.retryButtonText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Render empty state
  if (!profitData) {
    return (
      <View style={styles.emptyContainer}>
        <MaterialCommunityIcons name="chart-line" size={64} color="#e0e0e0" />
        <Text style={styles.emptyTitle}>No Profit Data Available</Text>
        <Text style={styles.emptyText}>
          Complete some sales to see your profit analytics
        </Text>
        <TouchableOpacity style={styles.refreshButton} onPress={handleRefresh}>
          <MaterialIcons name="refresh" size={20} color="#4CAF50" />
          <Text style={styles.refreshButtonText}>Refresh</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <Animated.View 
      style={[
        styles.container,
        {
          opacity: fadeAnim,
          transform: [
            { translateY: slideAnim },
            { scale: scaleAnim },
          ],
        }
      ]}
    >
      {/* Header with Date Range Selector */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          <MaterialCommunityIcons name="chart-line" size={20} color="#4CAF50" />
          {' '}Profit Overview
        </Text>
        
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.dateRangeContainer}
        >
          {['week', 'month', 'quarter', 'year'].map((range) => (
            <TouchableOpacity
              key={range}
              style={[
                styles.dateRangeButton,
                dateRange === range && styles.activeDateRange
              ]}
              onPress={() => handleDateRangeChange(range)}
            >
              <Text style={[
                styles.dateRangeText,
                dateRange === range && styles.activeDateRangeText
              ]}>
                {range.charAt(0).toUpperCase() + range.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView 
        style={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={['#4CAF50']}
            tintColor="#4CAF50"
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Key Metrics Cards */}
        <View style={styles.metricsContainer}>
          <View style={styles.metricCard}>
            <View style={styles.metricHeader}>
              <MaterialCommunityIcons name="currency-usd" size={24} color="#4CAF50" />
              <Text style={styles.metricValue}>
                {formatCurrency(profitData.totalRevenue)}
              </Text>
            </View>
            <Text style={styles.metricLabel}>Total Revenue</Text>
            <View style={styles.metricTrend}>
              <MaterialIcons 
                name={getTrendIcon(profitData.revenueGrowth)} 
                size={16} 
                color={getTrendColor(profitData.revenueGrowth)} 
              />
              <Text style={[
                styles.trendText,
                { color: getTrendColor(profitData.revenueGrowth) }
              ]}>
                {formatPercentage(profitData.revenueGrowth)}
              </Text>
            </View>
          </View>

          <View style={styles.metricCard}>
            <View style={styles.metricHeader}>
              <MaterialCommunityIcons name="trending-up" size={24} color="#2196F3" />
              <Text style={styles.metricValue}>
                {formatCurrency(profitData.grossProfit)}
              </Text>
            </View>
            <Text style={styles.metricLabel}>Gross Profit</Text>
            <View style={styles.metricTrend}>
              <MaterialIcons 
                name={getTrendIcon(profitData.profitGrowth)} 
                size={16} 
                color={getTrendColor(profitData.profitGrowth)} 
              />
              <Text style={[
                styles.trendText,
                { color: getTrendColor(profitData.profitGrowth) }
              ]}>
                {formatPercentage(profitData.profitGrowth)}
              </Text>
            </View>
          </View>

          <View style={styles.metricCard}>
            <View style={styles.metricHeader}>
              <MaterialCommunityIcons name="percent" size={24} color="#FF9800" />
              <Text style={styles.metricValue}>
                {formatPercentage(profitData.profitMargin)}
              </Text>
            </View>
            <Text style={styles.metricLabel}>Profit Margin</Text>
            <View style={styles.metricTrend}>
              <MaterialIcons 
                name={getTrendIcon(profitData.marginGrowth)} 
                size={16} 
                color={getTrendColor(profitData.marginGrowth)} 
              />
              <Text style={[
                styles.trendText,
                { color: getTrendColor(profitData.marginGrowth) }
              ]}>
                {formatPercentage(profitData.marginGrowth)}
              </Text>
            </View>
          </View>

          <View style={styles.metricCard}>
            <View style={styles.metricHeader}>
              <MaterialCommunityIcons name="chart-bar" size={24} color="#9C27B0" />
              <Text style={styles.metricValue}>
                {formatCurrency(profitData.averageOrderProfit)}
              </Text>
            </View>
            <Text style={styles.metricLabel}>Avg Order Profit</Text>
            <View style={styles.metricTrend}>
              <MaterialIcons 
                name={getTrendIcon(profitData.avgOrderGrowth)} 
                size={16} 
                color={getTrendColor(profitData.avgOrderGrowth)} 
              />
              <Text style={[
                styles.trendText,
                { color: getTrendColor(profitData.avgOrderGrowth) }
              ]}>
                {formatPercentage(profitData.avgOrderGrowth)}
              </Text>
            </View>
          </View>
        </View>

        {/* Profit Trend Chart */}
        {trendData && (
          <View style={styles.chartSection}>
            <Text style={styles.chartTitle}>Profit Trend</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <LineChart
                data={trendData}
                width={Math.max(width - 40, 300)}
                height={220}
                yAxisLabel="$"
                yAxisSuffix=""
                yAxisInterval={1}
                chartConfig={{
                  backgroundColor: '#ffffff',
                  backgroundGradientFrom: '#ffffff',
                  backgroundGradientTo: '#ffffff',
                  decimalPlaces: 0,
                  color: (opacity = 1) => `rgba(76, 175, 80, ${opacity})`,
                  labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                  style: {
                    borderRadius: 16,
                  },
                  propsForDots: {
                    r: '6',
                    strokeWidth: '2',
                    stroke: '#4CAF50',
                  },
                }}
                bezier
                style={styles.chart}
              />
            </ScrollView>
          </View>
        )}

        {/* Category Breakdown */}
        {categoryData && categoryData.length > 0 && (
          <View style={styles.chartSection}>
            <Text style={styles.chartTitle}>Profit by Category</Text>
            
            {/* Pie Chart */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <PieChart
                data={categoryData.map(item => ({
                  name: item.name,
                  profit: item.profit,
                  color: item.color,
                  legendFontColor: '#333',
                  legendFontSize: 12,
                }))}
                width={Math.max(width - 40, 300)}
                height={220}
                chartConfig={{
                  color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                }}
                accessor="profit"
                backgroundColor="transparent"
                paddingLeft="15"
                style={styles.chart}
              />
            </ScrollView>
            
            {/* Category Details */}
            <View style={styles.categoryDetails}>
              {categoryData.map((category, index) => (
                <View key={index} style={styles.categoryItem}>
                  <View style={styles.categoryInfo}>
                    <View style={[styles.categoryDot, { backgroundColor: category.color }]} />
                    <Text style={styles.categoryName}>{category.name}</Text>
                  </View>
                  <View style={styles.categoryStats}>
                    <Text style={styles.categoryProfit}>
                      {formatCurrency(category.profit)}
                    </Text>
                    <Text style={styles.categoryPercentage}>
                      {formatPercentage(category.percentage)}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Top Profitable Products */}
        {profitData.topProfitableProducts && profitData.topProfitableProducts.length > 0 && (
          <View style={styles.topProductsSection}>
            <Text style={styles.sectionTitle}>Top Profitable Products</Text>
            
            {profitData.topProfitableProducts.map((product, index) => (
              <View key={product.id} style={styles.productItem}>
                <View style={styles.productRank}>
                  <Text style={styles.rankNumber}>{index + 1}</Text>
                </View>
                
                <View style={styles.productInfo}>
                  <Text style={styles.productName} numberOfLines={1}>
                    {product.name}
                  </Text>
                  <Text style={styles.productSold}>
                    {product.sold} sold • {formatPercentage(product.margin)} margin
                  </Text>
                </View>
                
                <View style={styles.productProfit}>
                  <Text style={styles.productProfitValue}>
                    {formatCurrency(product.profit)}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Expense Breakdown */}
        {profitData.expenses && (
          <View style={styles.expensesSection}>
            <Text style={styles.sectionTitle}>
              <MaterialCommunityIcons name="credit-card-outline" size={16} color="#F44336" />
              {' '}Expense Breakdown
            </Text>
            
            <View style={styles.expensesList}>
              {Object.entries(profitData.expenses).map(([category, amount]) => (
                <View key={category} style={styles.expenseItem}>
                  <View style={styles.expenseInfo}>
                    <MaterialCommunityIcons 
                      name={getExpenseIcon(category)} 
                      size={20} 
                      color="#666" 
                    />
                    <Text style={styles.expenseCategory}>
                      {category.charAt(0).toUpperCase() + category.slice(1)}
                    </Text>
                  </View>
                  <Text style={styles.expenseAmount}>
                    {formatCurrency(amount)}
                  </Text>
                </View>
              ))}
            </View>
            
            <View style={styles.totalExpenses}>
              <Text style={styles.totalExpensesLabel}>Total Expenses:</Text>
              <Text style={styles.totalExpensesValue}>
                {formatCurrency(Object.values(profitData.expenses).reduce((sum, val) => sum + val, 0))}
              </Text>
            </View>
          </View>
        )}
      </ScrollView>
    </Animated.View>
  );

  // Helper function to get expense category icon
  function getExpenseIcon(category) {
    switch (category.toLowerCase()) {
      case 'inventory': return 'package-variant';
      case 'utilities': return 'lightning-bolt';
      case 'marketing': return 'bullhorn';
      case 'rent': return 'home';
      case 'staff': return 'account-group';
      default: return 'receipt';
    }
  }
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
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateRangeContainer: {
    flexDirection: 'row',
  },
  dateRangeButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    marginRight: 8,
  },
  activeDateRange: {
    backgroundColor: '#4CAF50',
  },
  dateRangeText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  activeDateRangeText: {
    color: '#fff',
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  metricsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 16,
    gap: 12,
  },
  metricCard: {
    flex: 0.48,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  metricHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  metricValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
  },
  metricLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  metricTrend: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  trendText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  chartSection: {
    backgroundColor: '#fff',
    margin: 16,
    marginTop: 0,
    borderRadius: 12,
    padding: 16,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  chart: {
    borderRadius: 12,
  },
  categoryDetails: {
    marginTop: 16,
  },
  categoryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  categoryInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  categoryDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  categoryName: {
    fontSize: 14,
    color: '#333',
  },
  categoryStats: {
    alignItems: 'flex-end',
  },
  categoryProfit: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4CAF50',
  },
  categoryPercentage: {
    fontSize: 12,
    color: '#666',
  },
  topProductsSection: {
    backgroundColor: '#fff',
    margin: 16,
    marginTop: 0,
    borderRadius: 12,
    padding: 16,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  productItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  productRank: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  rankNumber: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  productSold: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  productProfit: {
    alignItems: 'flex-end',
  },
  productProfitValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#4CAF50',
  },
  expensesSection: {
    backgroundColor: '#fff',
    margin: 16,
    marginTop: 0,
    borderRadius: 12,
    padding: 16,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  expensesList: {
    marginBottom: 16,
  },
  expenseItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  expenseInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  expenseCategory: {
    fontSize: 14,
    color: '#333',
    marginLeft: 12,
  },
  expenseAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F44336',
  },
  totalExpenses: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  totalExpensesLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  totalExpensesValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F44336',
  },
});