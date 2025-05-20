// screens/BusinessHomeScreen.js
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  RefreshControl,
  Image,
  Alert,
} from 'react-native';
import { 
  MaterialCommunityIcons, 
  MaterialIcons, 
  FontAwesome,
  Ionicons 
} from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { getBusinessDashboard } from '../services/businessApi';

export default function BusinessHomeScreen({ navigation }) {
  const [dashboardData, setDashboardData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [businessId, setBusinessId] = useState(null);
  
  // Load dashboard data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadDashboardData();
    }, [])
  );

  // Initialize business ID
  useEffect(() => {
    const initializeBusinessId = async () => {
      try {
        const email = await AsyncStorage.getItem('userEmail');
        const storedBusinessId = await AsyncStorage.getItem('businessId');
        const id = storedBusinessId || email;
        setBusinessId(id);
      } catch (error) {
        console.error('Error getting business ID:', error);
      }
    };
    
    initializeBusinessId();
  }, []);
  
  const loadDashboardData = async () => {
    if (refreshing) return; // Prevent duplicate calls
    
    setIsLoading(!dashboardData); // Only show loading on first load
    setError(null);
    setRefreshing(true);
    
    try {
      console.log('Loading dashboard data...');
      const data = await getBusinessDashboard();
      console.log('Dashboard data loaded:', data);
      
      setDashboardData(data);
    } catch (err) {
      console.error('Error loading dashboard:', err);
      setError('Could not load dashboard data. Please try again.');
      
      // Show fallback data if first load fails
      if (!dashboardData) {
        setDashboardData(getFallbackData());
      }
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  // Fallback data when backend fails
  const getFallbackData = () => ({
    businessInfo: {
      businessName: 'Your Business',
      businessType: 'Plant Business',
      businessLogo: null,
      email: businessId || 'business@example.com',
      rating: 0,
      reviewCount: 0
    },
    metrics: {
      totalSales: 0,
      salesToday: 0,
      newOrders: 0,
      lowStockItems: 0,
      totalInventory: 0,
      activeInventory: 0,
      totalOrders: 0,
      inventoryValue: 0
    },
    topProducts: [],
    recentOrders: [],
    lowStockDetails: []
  });
  
  const onRefresh = () => {
    loadDashboardData();
  };
  
  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return '#FFA000';
      case 'processing': return '#2196F3';
      case 'completed': return '#4CAF50';
      case 'cancelled': return '#F44336';
      default: return '#757575';
    }
  };
  
  // Navigation handlers
  const handleAddProduct = () => {
    navigation.navigate('AddInventoryScreen', { businessId });
  };
  
  const handleInventory = () => {
    navigation.navigate('AddInventoryScreen', { 
      businessId,
      showInventory: true // Add this parameter to show inventory directly
    });
  };
  
  const handleOrders = () => {
    navigation.navigate('BusinessOrdersScreen', { businessId });
  };
  
  const handleCustomers = () => {
    navigation.navigate('CustomerListScreen', { businessId });
  };
  
  const handleMarketplace = () => {
    navigation.navigate('MarketplaceHome');
  };

  const handleSettings = () => {
    navigation.navigate('BusinessSettings');
  };

  const handleProfile = () => {
    navigation.navigate('BusinessProfileScreen');
  };
  
  if (isLoading && !dashboardData) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#216a94" />
          <Text style={styles.loadingText}>Loading your dashboard...</Text>
        </View>
      </SafeAreaView>
    );
  }
  
  if (error && !dashboardData) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.errorContainer}>
          <MaterialIcons name="error-outline" size={48} color="#c62828" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity 
            style={styles.retryButton}
            onPress={loadDashboardData}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Use fallback data if dashboardData is null
  const data = dashboardData || getFallbackData();
  
  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Enhanced Header */}
      <View style={styles.header}>
        <View style={styles.profileSection}>
          <Image 
            source={data.businessInfo.businessLogo ? 
              { uri: data.businessInfo.businessLogo } : 
              require('../../assets/business-placeholder.png')
            } 
            style={styles.logo}
          />
          <View style={styles.businessInfo}>
            <Text style={styles.businessName} numberOfLines={1}>
              {data.businessInfo.businessName}
            </Text>
            <Text style={styles.welcomeText}>Welcome back!</Text>
            <View style={styles.ratingContainer}>
              {data.businessInfo.rating > 0 && (
                <>
                  <MaterialIcons name="star" size={14} color="#FFC107" />
                  <Text style={styles.ratingText}>
                    {data.businessInfo.rating.toFixed(1)} ({data.businessInfo.reviewCount})
                  </Text>
                </>
              )}
            </View>
          </View>
        </View>
        <TouchableOpacity style={styles.settingsButton} onPress={handleSettings}>
          <MaterialIcons name="settings" size={24} color="#216a94" />
        </TouchableOpacity>
      </View>
      
      <ScrollView 
        style={styles.scrollView} 
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh}
            colors={['#216a94']}
            tintColor="#216a94"
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Enhanced KPI Cards */}
        <View style={styles.kpiContainer}>
          <View style={styles.kpiCard}>
            <View style={[styles.kpiIconContainer, { backgroundColor: '#216a94' }]}>
              <FontAwesome name="dollar" size={20} color="#fff" />
            </View>
            <View style={styles.kpiContent}>
              <Text style={styles.kpiValue}>${data.metrics.totalSales.toFixed(2)}</Text>
              <Text style={styles.kpiLabel}>Total Revenue</Text>
              <Text style={styles.kpiSubLabel}>Last 30 days</Text>
            </View>
          </View>
          
          <View style={styles.kpiCard}>
            <View style={[styles.kpiIconContainer, { backgroundColor: '#4CAF50' }]}>
              <FontAwesome name="line-chart" size={20} color="#fff" />
            </View>
            <View style={styles.kpiContent}>
              <Text style={styles.kpiValue}>${data.metrics.salesToday.toFixed(2)}</Text>
              <Text style={styles.kpiLabel}>Today's Sales</Text>
              <Text style={styles.kpiSubLabel}>Current day</Text>
            </View>
          </View>
          
          <View style={styles.kpiCard}>
            <View style={[styles.kpiIconContainer, { backgroundColor: '#FF9800' }]}>
              <MaterialIcons name="shopping-cart" size={20} color="#fff" />
            </View>
            <View style={styles.kpiContent}>
              <Text style={styles.kpiValue}>{data.metrics.newOrders}</Text>
              <Text style={styles.kpiLabel}>Pending Orders</Text>
              <Text style={styles.kpiSubLabel}>Need attention</Text>
            </View>
          </View>
          
          <View style={styles.kpiCard}>
            <View style={[styles.kpiIconContainer, { backgroundColor: data.metrics.lowStockItems > 0 ? '#F44336' : '#9E9E9E' }]}>
              <MaterialIcons name="warning" size={20} color="#fff" />
            </View>
            <View style={styles.kpiContent}>
              <Text style={styles.kpiValue}>{data.metrics.lowStockItems}</Text>
              <Text style={styles.kpiLabel}>Low Stock</Text>
              <Text style={styles.kpiSubLabel}>Items to restock</Text>
            </View>
          </View>
        </View>

        {/* Additional Metrics Row */}
        <View style={styles.additionalMetrics}>
          <View style={styles.metricItem}>
            <MaterialCommunityIcons name="package-variant" size={24} color="#2196F3" />
            <Text style={styles.metricValue}>{data.metrics.totalInventory}</Text>
            <Text style={styles.metricLabel}>Total Items</Text>
          </View>
          <View style={styles.metricItem}>
            <MaterialCommunityIcons name="check-circle" size={24} color="#4CAF50" />
            <Text style={styles.metricValue}>{data.metrics.activeInventory}</Text>
            <Text style={styles.metricLabel}>Active Items</Text>
          </View>
          <View style={styles.metricItem}>
            <MaterialCommunityIcons name="receipt" size={24} color="#9C27B0" />
            <Text style={styles.metricValue}>{data.metrics.totalOrders}</Text>
            <Text style={styles.metricLabel}>Total Orders</Text>
          </View>
          <View style={styles.metricItem}>
            <MaterialCommunityIcons name="cash" size={24} color="#FF5722" />
            <Text style={styles.metricValue}>${data.metrics.inventoryValue.toFixed(0)}</Text>
            <Text style={styles.metricLabel}>Inventory Value</Text>
          </View>
        </View>
        
        {/* Quick Actions */}
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.quickActionsContainer}>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={handleAddProduct}
          >
            <View style={[styles.actionIconContainer, { backgroundColor: '#4CAF50' }]}>
              <MaterialIcons name="add" size={24} color="#fff" />
            </View>
            <Text style={styles.actionText}>Add Product</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={handleInventory}
          >
            <View style={[styles.actionIconContainer, { backgroundColor: '#2196F3' }]}>
              <MaterialIcons name="inventory" size={24} color="#fff" />
            </View>
            <Text style={styles.actionText}>Inventory</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={handleOrders}
          >
            <View style={[styles.actionIconContainer, { backgroundColor: '#FF9800' }]}>
              <MaterialIcons name="receipt" size={24} color="#fff" />
            </View>
            <Text style={styles.actionText}>Orders</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={handleCustomers}
          >
            <View style={[styles.actionIconContainer, { backgroundColor: '#9C27B0' }]}>
              <MaterialIcons name="people" size={24} color="#fff" />
            </View>
            <Text style={styles.actionText}>Customers</Text>
          </TouchableOpacity>
        </View>
        
        {/* Marketplace Button */}
        <TouchableOpacity 
          style={styles.marketplaceButton}
          onPress={handleMarketplace}
        >
          <MaterialCommunityIcons name="storefront" size={24} color="#fff" />
          <Text style={styles.marketplaceButtonText}>Browse Marketplace</Text>
        </TouchableOpacity>

        {/* Low Stock Alert */}
        {data.lowStockDetails && data.lowStockDetails.length > 0 && (
          <View style={styles.alertCard}>
            <View style={styles.alertHeader}>
              <MaterialIcons name="warning" size={20} color="#ff9800" />
              <Text style={styles.alertTitle}>Low Stock Alert</Text>
            </View>
            {data.lowStockDetails.slice(0, 3).map(item => (
              <View key={item.id} style={styles.alertItem}>
                <Text style={styles.alertItemText}>{item.title}</Text>
                <Text style={styles.alertItemCount}>
                  {item.quantity} left (min: {item.minThreshold})
                </Text>
              </View>
            ))}
            <TouchableOpacity 
              style={styles.alertButton}
              onPress={handleInventory}
            >
              <Text style={styles.alertButtonText}>Manage Inventory</Text>
            </TouchableOpacity>
          </View>
        )}
        
        {/* Recent Orders */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Orders</Text>
          <TouchableOpacity style={styles.viewAllButton} onPress={handleOrders}>
            <Text style={styles.viewAllText}>View All</Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.ordersContainer}>
          {data.recentOrders && data.recentOrders.length > 0 ? (
            data.recentOrders.map((order) => (
              <TouchableOpacity key={order.id} style={styles.orderItem}>
                <View style={styles.orderDetails}>
                  <Text style={styles.orderCustomer}>{order.customer}</Text>
                  <Text style={styles.orderDate}>
                    {order.date ? new Date(order.date).toLocaleDateString() : 'Recent'}
                  </Text>
                </View>
                <View style={styles.orderInfo}>
                  <Text style={styles.orderTotal}>${order.total.toFixed(2)}</Text>
                  <View style={[styles.statusPill, { backgroundColor: getStatusColor(order.status) }]}>
                    <Text style={styles.statusText}>{order.status}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))
          ) : (
            <View style={styles.emptyState}>
              <MaterialIcons name="receipt" size={48} color="#e0e0e0" />
              <Text style={styles.emptyStateText}>No recent orders</Text>
              <Text style={styles.emptyStateSubtext}>Orders will appear here when customers place them</Text>
            </View>
          )}
        </View>
        
        {/* Top Products */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Top Selling Products</Text>
          <TouchableOpacity style={styles.viewAllButton} onPress={handleInventory}>
            <Text style={styles.viewAllText}>View All</Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.topProductsContainer}>
          {data.topProducts && data.topProducts.length > 0 ? (
            data.topProducts.map((product, index) => (
              <TouchableOpacity key={index} style={styles.productItem}>
                <View style={styles.productIconContainer}>
                  <MaterialIcons name="eco" size={24} color="#fff" />
                </View>
                <View style={styles.productDetails}>
                  <Text style={styles.productName}>{product.name}</Text>
                  <Text style={styles.productSold}>{product.sold} sold</Text>
                </View>
                <Text style={styles.productRevenue}>${product.revenue.toFixed(2)}</Text>
              </TouchableOpacity>
            ))
          ) : (
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="chart-line" size={48} color="#e0e0e0" />
              <Text style={styles.emptyStateText}>No sales data yet</Text>
              <Text style={styles.emptyStateSubtext}>Start selling to see your top products here</Text>
            </View>
          )}
        </View>

        {/* Business Info Card */}
        <View style={styles.businessCard}>
          <View style={styles.businessCardHeader}>
            <MaterialCommunityIcons name="store" size={24} color="#216a94" />
            <Text style={styles.businessCardTitle}>Business Information</Text>
          </View>
          <View style={styles.businessCardContent}>
            <Text style={styles.businessCardItem}>
              <Text style={styles.businessCardLabel}>Type: </Text>
              {data.businessInfo.businessType}
            </Text>
            <Text style={styles.businessCardItem}>
              <Text style={styles.businessCardLabel}>Email: </Text>
              {data.businessInfo.email}
            </Text>
            {data.businessInfo.joinDate && (
              <Text style={styles.businessCardItem}>
                <Text style={styles.businessCardLabel}>Member since: </Text>
                {new Date(data.businessInfo.joinDate).toLocaleDateString('en-US', { 
                  year: 'numeric', 
                  month: 'long' 
                })}
              </Text>
            )}
          </View>
          <TouchableOpacity style={styles.editBusinessButton} onPress={handleProfile}>
            <MaterialIcons name="edit" size={16} color="#216a94" />
            <Text style={styles.editBusinessText}>Edit Business Info</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
      
      {/* Bottom Navigation */}
      <View style={styles.bottomNav}>
        <TouchableOpacity style={[styles.navItem, styles.activeNavItem]}>
          <MaterialIcons name="dashboard" size={24} color="#216a94" />
          <Text style={[styles.navText, styles.activeNavText]}>Dashboard</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.navItem}
          onPress={handleInventory}
        >
          <MaterialIcons name="inventory" size={24} color="#757575" />
          <Text style={styles.navText}>Inventory</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.navItem}
          onPress={handleOrders}
        >
          <MaterialIcons name="receipt" size={24} color="#757575" />
          <Text style={styles.navText}>Orders</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.navItem}
          onPress={handleProfile}
        >
          <MaterialIcons name="person" size={24} color="#757575" />
          <Text style={styles.navText}>Profile</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#216a94',
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    color: '#c62828',
    textAlign: 'center',
    margin: 10,
    fontSize: 16,
  },
  retryButton: {
    backgroundColor: '#216a94',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginTop: 20,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  header: {
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  logo: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#eee',
  },
  businessInfo: {
    marginLeft: 12,
    flex: 1,
  },
  businessName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#216a94',
  },
  welcomeText: {
    fontSize: 12,
    color: '#757575',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  ratingText: {
    fontSize: 11,
    color: '#666',
    marginLeft: 2,
  },
  settingsButton: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: '#f0f8ff',
  },
  scrollView: {
    flex: 1,
  },
  kpiContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    padding: 16,
  },
  kpiCard: {
    backgroundColor: '#fff',
    width: '48%',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  kpiIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#216a94',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  kpiContent: {
    flex: 1,
  },
  kpiValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  kpiLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  kpiSubLabel: {
    fontSize: 10,
    color: '#999',
    marginTop: 1,
  },
  additionalMetrics: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    padding: 16,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  metricItem: {
    flex: 1,
    alignItems: 'center',
  },
  metricValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 4,
  },
  metricLabel: {
    fontSize: 10,
    color: '#666',
    marginTop: 2,
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginHorizontal: 16,
    marginBottom: 12,
  },
  quickActionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  actionButton: {
    alignItems: 'center',
  },
  actionIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  actionText: {
    fontSize: 12,
    color: '#333',
    textAlign: 'center',
  },
  marketplaceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4CAF50',
    marginHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 24,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  marketplaceButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
    marginLeft: 8,
  },
  alertCard: {
    backgroundColor: '#fff8e1',
    margin: 16,
    marginTop: 0,
    marginBottom: 20,
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#ff9800',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  alertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  alertTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#f57c00',
    marginLeft: 8,
  },
  alertItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  alertItemText: {
    fontSize: 14,
    color: '#555',
    flex: 1,
  },
  alertItemCount: {
    fontSize: 14,
    color: '#f57c00',
    fontWeight: '500',
  },
  alertButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ff9800',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  alertButtonText: {
    fontSize: 14,
    color: '#ff9800',
    fontWeight: '600',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 12,
  },
  viewAllButton: {
    padding: 4,
  },
  viewAllText: {
    color: '#216a94',
    fontSize: 14,
  },
  ordersContainer: {
    marginHorizontal: 16,
    marginBottom: 24,
  },
  orderItem: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  orderDetails: {
    flex: 1,
  },
  orderCustomer: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  orderDate: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  orderInfo: {
    alignItems: 'flex-end',
  },
  orderTotal: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  topProductsContainer: {
    marginHorizontal: 16,
    marginBottom: 24,
  },
  productItem: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  productIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  productDetails: {
    flex: 1,
  },
  productName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  productSold: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  productRevenue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 12,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#666',
    marginTop: 12,
  },
  emptyStateSubtext: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
    textAlign: 'center',
  },
  businessCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 24,
    borderRadius: 12,
    padding: 16,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  businessCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  businessCardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#216a94',
    marginLeft: 8,
  },
  businessCardContent: {
    marginBottom: 12,
  },
  businessCardItem: {
    fontSize: 14,
    color: '#555',
    marginBottom: 4,
  },
  businessCardLabel: {
    fontWeight: '600',
    color: '#333',
  },
  editBusinessButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#216a94',
    backgroundColor: '#f0f8ff',
  },
  editBusinessText: {
    fontSize: 12,
    color: '#216a94',
    marginLeft: 4,
    fontWeight: '600',
  },
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  activeNavItem: {
    borderTopWidth: 2,
    borderTopColor: '#216a94',
  },
  navText: {
    fontSize: 12,
    color: '#757575',
    marginTop: 4,
  },
  activeNavText: {
    color: '#216a94',
    fontWeight: 'bold',
  },
});