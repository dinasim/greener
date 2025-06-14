// Business/BusinessScreens/BusinessHomeScreen.js - FIXED VERSION
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
  Linking,
} from 'react-native';
import { 
  MaterialCommunityIcons, 
  MaterialIcons, 
  FontAwesome,
  Ionicons 
} from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';

// Import Business Components
import KPIWidget from '../components/KPIWidget';
import BusinessDashboardCharts from '../components/BusinessDashboardCharts';
import LowStockBanner from '../components/LowStockBanner';
import TopSellingProductsList from '../components/TopSellingProductsList';
import OrderDetailModal from '../components/OrderDetailModal';
import NotificationBell from '../components/NotificationBell';
import { useNotificationManager } from '../components/NotificationManager';
import SmartPlantCareAssistant from '../../components/ai/SmartPlantCareAssistant';
import { smartNotifications } from '../components/SmartNotifications';

// Import API services
import { getBusinessDashboard } from '../services/businessApi';

export default function BusinessHomeScreen({ navigation }) {
  const [dashboardData, setDashboardData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [businessId, setBusinessId] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [showAIAssistant, setShowAIAssistant] = useState(false);
  const [selectedPlantForAI, setSelectedPlantForAI] = useState(null);

  // Notification manager
  const {
    hasNewNotifications,
    notifications,
    clearAllNotifications
  } = useNotificationManager(businessId, navigation);
  
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
    lowStockDetails: [],
    chartData: {
      sales: { labels: [], values: [], total: 0, average: 0 },
      orders: { pending: 0, confirmed: 0, ready: 0, completed: 0, total: 0 },
      inventory: { inStock: 0, lowStock: 0, outOfStock: 0 }
    }
  });
  
  const onRefresh = () => {
    loadDashboardData();
  };
  
  // Navigation handlers
  const handleAddProduct = () => {
    navigation.navigate('AddInventoryScreen', { businessId });
  };
  
  const handleInventory = () => {
    navigation.navigate('AddInventoryScreen', { 
      businessId,
      showInventory: true
    });
  };
  
  const handleOrders = () => {
    navigation.navigate('BusinessOrdersScreen', { businessId });
  };
  
  const handleCustomers = () => {
    navigation.navigate('BusinessCustomersScreen', { businessId });
  };
  
  const handleMarketplace = () => {
    navigation.navigate('MainTabs', { screen: 'Home' });
  };

  const handleSettings = () => {
    navigation.navigate('BusinessSettingsScreen', { businessId });
  };

  const handleProfile = () => {
    navigation.navigate('BusinessProfileScreen', { businessId });
  };

  const handleAnalytics = () => {
    navigation.navigate('BusinessAnalyticsScreen', { businessId });
  };

  const handleWateringChecklist = () => {
    navigation.navigate('WateringChecklistScreen', { businessId });
  };

  const handleDiseaseChecker = () => {
    navigation.navigate('DiseaseCheckerScreen');
  };

  const handleForum = () => {
    navigation.navigate('PlantCareForumScreen');
  };

  // Order management handlers
  const handleOrderPress = (order) => {
    setSelectedOrder(order);
    setShowOrderModal(true);
  };

  const handleUpdateOrderStatus = async (orderId, newStatus) => {
    try {
      // Update order status logic here
      console.log('Updating order status:', orderId, newStatus);
      // Refresh data after update
      await loadDashboardData();
      setShowOrderModal(false);
    } catch (error) {
      Alert.alert('Error', 'Failed to update order status');
    }
  };

  const handleContactCustomer = (order) => {
    const options = [];
    
    if (order.customerPhone) {
      options.push({
        text: '📱 Call Customer',
        onPress: () => Linking.openURL(`tel:${order.customerPhone}`)
      });
      
      options.push({
        text: '💬 Send SMS', 
        onPress: () => Linking.openURL(`sms:${order.customerPhone}?body=Hi ${order.customerName}, your order ${order.confirmationNumber} is ready!`)
      });
    }
    
    options.push({
      text: '📧 Send Email',
      onPress: () => Linking.openURL(`mailto:${order.customerEmail}?subject=Order ${order.confirmationNumber}&body=Hi ${order.customerName}, regarding your order...`)
    });
    
    options.push({ text: 'Cancel', style: 'cancel' });
    
    Alert.alert(`Contact ${order.customerName}`, `Order: ${order.confirmationNumber}`, options);
  };

  // Low stock management
  const handleManageStock = () => {
    navigation.navigate('AddInventoryScreen', { 
      businessId,
      showInventory: true,
      filter: 'lowStock' 
    });
  };

  const handleRestock = (item) => {
    navigation.navigate('ProductEditScreen', { 
      productId: item.id,
      businessId,
      focusField: 'quantity'
    });
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
      {/* Enhanced Header with Back Button */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <MaterialIcons name="arrow-back" size={24} color="#216a94" />
        </TouchableOpacity>
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
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerButton} onPress={handleSettings}>
            <MaterialIcons name="settings" size={24} color="#216a94" />
          </TouchableOpacity>
        </View>
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
        {/* Low Stock Banner */}
        <LowStockBanner
          lowStockItems={data.lowStockDetails || []}
          onManageStock={handleManageStock}
          onRestock={handleRestock}
          autoRefresh={true}
        />

        {/* Enhanced KPI Widgets */}
        <View style={styles.kpiContainer}>
          <KPIWidget
            title="Total Revenue"
            value={data.metrics.totalSales}
            change={data.metrics.revenueGrowth}
            icon="cash"
            format="currency"
            color="#216a94"
            onPress={handleAnalytics}
          />
          
          <KPIWidget
            title="Today's Sales"
            value={data.metrics.salesToday}
            change={data.metrics.dailyGrowth}
            icon="trending-up"
            format="currency"
            color="#4CAF50"
            onPress={handleAnalytics}
          />
          
          <KPIWidget
            title="New Orders"
            value={data.metrics.newOrders}
            change={data.metrics.orderGrowth}
            icon="cart"
            format="number"
            color="#FF9800"
            onPress={handleOrders}
            trend={data.metrics.newOrders > 0 ? 'up' : 'neutral'}
          />
          
          <KPIWidget
            title="Low Stock"
            value={data.metrics.lowStockItems}
            change={data.metrics.stockChange}
            icon="alert-circle"
            format="number"
            color={data.metrics.lowStockItems > 0 ? "#F44336" : "#9E9E9E"}
            onPress={handleInventory}
            trend={data.metrics.lowStockItems > 0 ? 'down' : 'neutral'}
          />
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
        
        {/* Charts Dashboard */}
        <BusinessDashboardCharts
          salesData={data.chartData?.sales || { labels: [], values: [], total: 0, average: 0 }}
          ordersData={data.chartData?.orders || { pending: 0, confirmed: 0, ready: 0, completed: 0, total: 0 }}
          inventoryData={data.chartData?.inventory || { inStock: 0, lowStock: 0, outOfStock: 0 }}
          onRefresh={loadDashboardData}
          autoRefresh={true}
        />
        
        {/* Expanded Quick Actions */}
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.quickActionsGrid}>
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
            onPress={handleWateringChecklist}
          >
            <View style={[styles.actionIconContainer, { backgroundColor: '#9C27B0' }]}>
              <MaterialCommunityIcons name="water" size={24} color="#fff" />
            </View>
            <Text style={styles.actionText}>Watering</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.actionButton}
            onPress={handleDiseaseChecker}
          >
            <View style={[styles.actionIconContainer, { backgroundColor: '#F44336' }]}>
              <Ionicons name="medkit" size={24} color="#fff" />
            </View>
            <Text style={styles.actionText}>Disease Check</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.actionButton}
            onPress={handleForum}
          >
            <View style={[styles.actionIconContainer, { backgroundColor: '#8BC34A' }]}>
              <MaterialCommunityIcons name="forum" size={24} color="#fff" />
            </View>
            <Text style={styles.actionText}>Forum</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.actionButton}
            onPress={handleCustomers}
          >
            <View style={[styles.actionIconContainer, { backgroundColor: '#3F51B5' }]}>
              <MaterialIcons name="people" size={24} color="#fff" />
            </View>
            <Text style={styles.actionText}>Customers</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.actionButton}
            onPress={handleAnalytics}
          >
            <View style={[styles.actionIconContainer, { backgroundColor: '#795548' }]}>
              <MaterialIcons name="analytics" size={24} color="#fff" />
            </View>
            <Text style={styles.actionText}>Analytics</Text>
          </TouchableOpacity>
        </View>

        {/* Enhanced Marketplace Button */}
        <TouchableOpacity 
          style={styles.marketplaceButton}
          onPress={handleMarketplace}
        >
          <MaterialCommunityIcons name="storefront" size={24} color="#fff" />
          <Text style={styles.marketplaceButtonText}>Browse Marketplace</Text>
          <MaterialIcons name="arrow-forward" size={20} color="#fff" />
        </TouchableOpacity>

        {/* Top Selling Products */}
        <TopSellingProductsList
          businessId={businessId}
          timeframe="month"
          onProductPress={(product) => navigation.navigate('BusinessProductDetailScreen', { 
            productId: product.id, 
            businessId 
          })}
          limit={5}
        />
        
        {/* Recent Orders */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Orders</Text>
          <TouchableOpacity style={styles.viewAllButton} onPress={handleOrders}>
            <Text style={styles.viewAllText}>View All</Text>
            <MaterialIcons name="arrow-forward" size={16} color="#216a94" />
          </TouchableOpacity>
        </View>
        
        <View style={styles.ordersContainer}>
          {data.recentOrders && data.recentOrders.length > 0 ? (
            data.recentOrders.slice(0, 3).map((order) => (
              <TouchableOpacity 
                key={order.id} 
                style={styles.orderItem}
                onPress={() => handleOrderPress(order)}
              >
                <View style={styles.orderHeader}>
                  <Text style={styles.orderConfirmation}>#{order.confirmationNumber}</Text>
                  <View style={[styles.statusPill, { backgroundColor: getStatusColor(order.status) }]}>
                    <Text style={styles.statusText}>{order.status}</Text>
                  </View>
                </View>
                <View style={styles.orderDetails}>
                  <Text style={styles.orderCustomer}>{order.customerName}</Text>
                  <Text style={styles.orderDate}>
                    {order.date ? new Date(order.date).toLocaleDateString() : 'Recent'}
                  </Text>
                </View>
                <View style={styles.orderInfo}>
                  <Text style={styles.orderTotal}>${order.total.toFixed(2)}</Text>
                  <Text style={styles.orderItems}>
                    {order.items?.length || 0} items
                  </Text>
                </View>
              </TouchableOpacity>
            ))
          ) : (
            <View style={styles.emptyState}>
              <MaterialIcons name="receipt" size={48} color="#e0e0e0" />
              <Text style={styles.emptyStateText}>No recent orders</Text>
              <Text style={styles.emptyStateSubtext}>Orders will appear here when customers place them</Text>
              <TouchableOpacity style={styles.createOrderButton} onPress={() => navigation.navigate('CreateOrderScreen', { businessId })}>
                <MaterialIcons name="add" size={16} color="#216a94" />
                <Text style={styles.createOrderText}>Create Order</Text>
              </TouchableOpacity>
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

      {/* Order Detail Modal */}
      <OrderDetailModal
        visible={showOrderModal}
        order={selectedOrder}
        onClose={() => setShowOrderModal(false)}
        onUpdateStatus={handleUpdateOrderStatus}
        onContactCustomer={handleContactCustomer}
        businessInfo={data.businessInfo}
      />

      {/* AI Plant Care Assistant Modal */}
      <SmartPlantCareAssistant
        visible={showAIAssistant}
        onClose={() => setShowAIAssistant(false)}
        plant={selectedPlantForAI}
      />
    </SafeAreaView>
  );

  // Helper function for status colors
  function getStatusColor(status) {
    switch (status) {
      case 'pending': return '#FFA000';
      case 'confirmed': return '#2196F3';
      case 'ready': return '#9C27B0';
      case 'completed': return '#4CAF50';
      case 'cancelled': return '#F44336';
      default: return '#757575';
    }
  }
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
  backButton: {
    padding: 8,
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
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  headerButton: {
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
    gap: 12,
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
    marginTop: 8,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  actionButton: {
    alignItems: 'center',
    width: '48%',
    marginBottom: 16,
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
  enhancedFeaturesContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  enhancedFeatureButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f8ff',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  enhancedFeatureText: {
    color: '#333',
    fontWeight: '500',
    fontSize: 14,
    marginLeft: 8,
  },
  marketplaceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4CAF50',
    marginHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 12,
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
    marginRight: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 12,
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 4,
  },
  viewAllText: {
    color: '#216a94',
    fontSize: 14,
    marginRight: 4,
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
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  orderConfirmation: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
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
  orderDetails: {
    marginBottom: 8,
  },
  orderCustomer: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  orderDate: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  orderInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderTotal: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  orderItems: {
    fontSize: 12,
    color: '#666',
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
  createOrderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f8ff',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#216a94',
  },
  createOrderText: {
    color: '#216a94',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
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
  mainTabsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    paddingVertical: 6,
    paddingHorizontal: 4,
    margin: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  mainTab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderRadius: 8,
  },
  activeMainTab: {
    backgroundColor: '#e0f7fa',
  },
  mainTabLabel: {
    fontSize: 10,
    color: '#333',
    marginTop: 2,
    fontWeight: '500',
    textAlign: 'center',
  },
  activeMainTabLabel: {
    color: '#216a94',
    fontWeight: 'bold',
  },
  tabContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  tabContentButton: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 30,
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    width: '100%',
    maxWidth: 300,
  },
  tabContentTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 15,
    marginBottom: 8,
  },
  tabContentDesc: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
});