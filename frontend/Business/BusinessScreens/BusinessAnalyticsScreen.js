// Business/BusinessScreens/BusinessAnalyticsScreen.js
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Animated,
  Platform,
} from 'react-native';
import { 
  MaterialCommunityIcons, 
  MaterialIcons 
} from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';

// Import components
import BusinessDashboardCharts from '../components/BusinessDashboardCharts';
import { getBusinessAnalytics } from '../services/businessApi';

export default function BusinessAnalyticsScreen({ navigation, route }) {
  const { businessId: routeBusinessId } = route.params || {};
  
  // Core state
  const [businessId, setBusinessId] = useState(routeBusinessId);
  const [analytics, setAnalytics] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState('30d');
  const [error, setError] = useState(null);
  
  // Animation refs
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  
  // Initialize
  useEffect(() => {
    const initScreen = async () => {
      try {
        let id = businessId;
        if (!id) {
          const email = await AsyncStorage.getItem('userEmail');
          const storedBusinessId = await AsyncStorage.getItem('businessId');
          id = storedBusinessId || email;
          setBusinessId(id);
        }
        
        if (id) {
          await loadAnalytics(id);
        }
        
        // Entrance animation
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
        console.error('Error initializing analytics screen:', error);
        setError('Failed to load analytics');
        setIsLoading(false);
      }
    };
    
    initScreen();
  }, [businessId]);

  // Auto-refresh when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      if (businessId) {
        loadAnalytics(businessId, true); // Silent refresh
      }
    }, [businessId, selectedPeriod])
  );

  // Load analytics data
  const loadAnalytics = async (id = businessId, silent = false) => {
    if (!id) return;
    
    try {
      if (!silent) {
        setIsLoading(true);
        setRefreshing(true);
      }
      
      console.log('Loading analytics for period:', selectedPeriod);
      const analyticsData = await getBusinessAnalytics(id, selectedPeriod);
      
      setAnalytics(analyticsData);
      setError(null);
      console.log('Analytics loaded successfully');
      
    } catch (error) {
      console.error('Error loading analytics:', error);
      if (!silent) {
        setError(`Failed to load analytics: ${error.message}`);
      }
    } finally {
      if (!silent) {
        setIsLoading(false);
        setRefreshing(false);
      }
    }
  };

  // Handle period change
  const handlePeriodChange = (period) => {
    setSelectedPeriod(period);
    loadAnalytics(businessId);
  };

  // Handle refresh
  const onRefresh = () => {
    loadAnalytics();
  };

  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount || 0);
  };

  // Format percentage
  const formatPercentage = (value) => {
    const percent = ((value || 0) * 100).toFixed(1);
    return `${percent >= 0 ? '+' : ''}${percent}%`;
  };

  // Get growth color
  const getGrowthColor = (value) => {
    return (value || 0) >= 0 ? '#4CAF50' : '#f44336';
  };

  // Render metric card
  const renderMetricCard = (title, value, growth, icon, color) => (
    <Animated.View 
      style={[
        styles.metricCard,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        }
      ]}
    >
      <View style={styles.metricHeader}>
        <View style={[styles.metricIcon, { backgroundColor: color }]}>
          <MaterialIcons name={icon} size={24} color="#fff" />
        </View>
        <View style={styles.metricGrowth}>
          <Text style={[
            styles.growthText, 
            { color: getGrowthColor(growth) }
          ]}>
            <MaterialIcons 
              name={growth >= 0 ? "trending-up" : "trending-down"} 
              size={14} 
            />
            {' '}{formatPercentage(growth)}
          </Text>
        </View>
      </View>
      
      <Text style={styles.metricTitle}>{title}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </Animated.View>
  );

  // Render top products
  const renderTopProducts = () => (
    <Animated.View 
      style={[
        styles.section,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        }
      ]}
    >
      <Text style={styles.sectionTitle}>
        <MaterialIcons name="star" size={20} color="#4CAF50" />
        {' '}Top Selling Products
      </Text>
      
      <View style={styles.topProductsList}>
        {analytics?.inventory?.topSelling?.slice(0, 5).map((product, index) => (
          <View key={product.id || index} style={styles.topProductItem}>
            <View style={styles.topProductRank}>
              <Text style={styles.rankNumber}>{index + 1}</Text>
            </View>
            
            <View style={styles.topProductInfo}>
              <Text style={styles.topProductName} numberOfLines={1}>
                {product.name || product.common_name}
              </Text>
              <Text style={styles.topProductStats}>
                {product.soldCount || 0} sold • {formatCurrency(product.revenue || 0)}
              </Text>
            </View>
            
            <View style={styles.topProductBadge}>
              <MaterialCommunityIcons name="trophy" size={16} color="#FF9800" />
            </View>
          </View>
        )) || (
          <View style={styles.emptyTopProducts}>
            <MaterialCommunityIcons name="chart-line" size={48} color="#e0e0e0" />
            <Text style={styles.emptyText}>No sales data available</Text>
          </View>
        )}
      </View>
    </Animated.View>
  );

  // Render customer insights
  const renderCustomerInsights = () => (
    <Animated.View 
      style={[
        styles.section,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        }
      ]}
    >
      <Text style={styles.sectionTitle}>
        <MaterialIcons name="people" size={20} color="#4CAF50" />
        {' '}Customer Insights
      </Text>
      
      <View style={styles.customerMetrics}>
        <View style={styles.customerMetricItem}>
          <Text style={styles.customerMetricValue}>
            {analytics?.customers?.total || 0}
          </Text>
          <Text style={styles.customerMetricLabel}>Total Customers</Text>
        </View>
        
        <View style={styles.customerMetricItem}>
          <Text style={styles.customerMetricValue}>
            {analytics?.customers?.new || 0}
          </Text>
          <Text style={styles.customerMetricLabel}>New This Period</Text>
        </View>
        
        <View style={styles.customerMetricItem}>
          <Text style={styles.customerMetricValue}>
            {((analytics?.customers?.returning || 0) / Math.max(analytics?.customers?.total || 1, 1) * 100).toFixed(0)}%
          </Text>
          <Text style={styles.customerMetricLabel}>Returning Rate</Text>
        </View>
      </View>
    </Animated.View>
  );

  if (isLoading && !analytics) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text style={styles.loadingText}>Loading analytics...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error && !analytics) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <MaterialIcons name="error-outline" size={64} color="#f44336" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => loadAnalytics()}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <Animated.View 
        style={[
          styles.header,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          }
        ]}
      >
        <TouchableOpacity 
          onPress={() => navigation.goBack()}
          style={styles.headerButton}
        >
          <MaterialIcons name="arrow-back" size={24} color="#4CAF50" />
        </TouchableOpacity>
        
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Business Analytics</Text>
          <Text style={styles.headerSubtitle}>
            {selectedPeriod === '7d' && 'Last 7 days'}
            {selectedPeriod === '30d' && 'Last 30 days'}
            {selectedPeriod === '3m' && 'Last 3 months'}
            {selectedPeriod === '1y' && 'Last year'}
          </Text>
        </View>
        
        <TouchableOpacity 
          style={styles.headerButton}
          onPress={() => Alert.alert('Export', 'Analytics export feature coming soon!')}
        >
          <MaterialIcons name="file-download" size={24} color="#4CAF50" />
        </TouchableOpacity>
      </Animated.View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#4CAF50']}
            tintColor="#4CAF50"
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Key Metrics */}
        <View style={styles.metricsContainer}>
          {renderMetricCard(
            'Total Revenue',
            formatCurrency(analytics?.revenue?.total),
            analytics?.revenue?.growth,
            'attach-money',
            '#4CAF50'
          )}
          
          {renderMetricCard(
            'Total Orders',
            analytics?.orders?.total?.toString() || '0',
            analytics?.orders?.growth,
            'shopping-cart',
            '#2196F3'
          )}
          
          {renderMetricCard(
            'Inventory Value',
            formatCurrency(analytics?.inventory?.totalValue),
            analytics?.inventory?.growth,
            'inventory',
            '#FF9800'
          )}
          
          {renderMetricCard(
            'Low Stock Items',
            analytics?.inventory?.lowStock?.toString() || '0',
            analytics?.inventory?.lowStockGrowth,
            'warning',
            '#f44336'
          )}
        </View>

        {/* Charts */}
        <BusinessDashboardCharts
          salesData={analytics?.orders?.byDay || []}
          revenueData={analytics?.revenue?.byDay || []}
          inventoryData={analytics?.inventory?.byCategory || []}
          onPeriodChange={handlePeriodChange}
          selectedPeriod={selectedPeriod}
        />

        {/* Top Products */}
        {renderTopProducts()}

        {/* Customer Insights */}
        {renderCustomerInsights()}

        {/* Additional Insights */}
        <View style={styles.insightsSection}>
          <Text style={styles.sectionTitle}>
            <MaterialIcons name="lightbulb-outline" size={20} color="#4CAF50" />
            {' '}Business Insights
          </Text>
          
          <View style={styles.insightsList}>
            {analytics?.insights?.map((insight, index) => (
              <View key={index} style={styles.insightItem}>
                <MaterialIcons 
                  name={insight.type === 'positive' ? 'trending-up' : 'info'} 
                  size={16} 
                  color={insight.type === 'positive' ? '#4CAF50' : '#2196F3'} 
                />
                <Text style={styles.insightText}>{insight.message}</Text>
              </View>
            )) || (
              <Text style={styles.noInsightsText}>
                Keep selling to generate business insights!
              </Text>
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
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
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#f44336',
    textAlign: 'center',
    marginVertical: 16,
  },
  retryButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  header: {
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  headerButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#f0f9f3',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#4CAF50',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  metricsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  metricCard: {
    flex: 0.48,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  metricHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  metricIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  metricGrowth: {
    alignItems: 'flex-end',
  },
  growthText: {
    fontSize: 12,
    fontWeight: '600',
  },
  metricTitle: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  topProductsList: {
    gap: 12,
  },
  topProductItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  topProductRank: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  rankNumber: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  topProductInfo: {
    flex: 1,
  },
  topProductName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  topProductStats: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  topProductBadge: {
    marginLeft: 8,
  },
  emptyTopProducts: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 14,
    color: '#666',
    marginTop: 12,
  },
  customerMetrics: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  customerMetricItem: {
    alignItems: 'center',
  },
  customerMetricValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#4CAF50',
  },
  customerMetricLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    textAlign: 'center',
  },
  insightsSection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  insightsList: {
    gap: 12,
  },
  insightItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 8,
  },
  insightText: {
    fontSize: 14,
    color: '#333',
    marginLeft: 12,
    flex: 1,
    lineHeight: 20,
  },
  noInsightsText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    fontStyle: 'italic',
    paddingVertical: 20,
  },
});