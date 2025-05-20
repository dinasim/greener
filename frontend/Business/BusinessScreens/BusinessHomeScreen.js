// screens/BusinessHomeScreen.js
import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { 
  MaterialCommunityIcons, 
  MaterialIcons, 
  FontAwesome,
  Ionicons 
} from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function BusinessHomeScreen({ navigation }) {
  const [businessData, setBusinessData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  
  // Sample dashboard data (would be fetched from backend)
  const dashboardData = {
    totalSales: 5200,
    salesToday: 1200,
    newOrders: 5,
    lowStockItems: 3,
    businessName: 'Green Haven Nursery',
    businessLogo: null, // Will use placeholder
    topProducts: [
      { id: '1', name: 'Monstera Deliciosa', sold: 12, revenue: 600 },
      { id: '2', name: 'Fiddle Leaf Fig', sold: 8, revenue: 800 },
      { id: '3', name: 'Snake Plant', sold: 6, revenue: 300 },
    ],
    recentOrders: [
      { id: '1', customer: 'Sarah L.', date: '2024-03-15', total: 230, status: 'pending' },
      { id: '2', customer: 'David K.', date: '2024-03-14', total: 150, status: 'completed' },
      { id: '3', customer: 'Rachel M.', date: '2024-03-13', total: 80, status: 'completed' },
    ]
  };
  
  useEffect(() => {
    loadBusinessData();
  }, []);
  
  const loadBusinessData = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // In a real app, this would fetch data from the backend
      const businessId = await AsyncStorage.getItem('businessId');
      
      if (!businessId) {
        throw new Error('Business ID not found');
      }
      
      // Simulating API call delay
      setTimeout(() => {
        setBusinessData(dashboardData);
        setIsLoading(false);
        setRefreshing(false);
      }, 1000);
      
    } catch (err) {
      console.error('Error loading business data:', err);
      setError('Could not load business data. Please try again.');
      setIsLoading(false);
      setRefreshing(false);
    }
  };
  
  const onRefresh = () => {
    setRefreshing(true);
    loadBusinessData();
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
    navigation.navigate('AddInventoryScreen');
  };
  
  const handleInventory = () => {
    navigation.navigate('InventoryScreen');
  };
  
  const handleOrders = () => {
    navigation.navigate('OrdersScreen');
  };
  
  const handleCustomers = () => {
    navigation.navigate('CustomerListScreen');
  };
  
  const handleMarketplace = () => {
    navigation.navigate('MarketplaceHome');
  };
  
  if (isLoading && !businessData) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#216a94" />
          <Text style={styles.loadingText}>Loading dashboard...</Text>
        </View>
      </SafeAreaView>
    );
  }
  
  if (error && !businessData) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.errorContainer}>
          <MaterialIcons name="error-outline" size={48} color="#c62828" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity 
            style={styles.retryButton}
            onPress={loadBusinessData}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }
  
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <View style={styles.profileSection}>
          <Image 
            source={businessData.businessLogo ? 
              { uri: businessData.businessLogo } : 
              require('../../assets/business-placeholder.png')
            } 
            style={styles.logo}
          />
          <View style={styles.businessInfo}>
            <Text style={styles.businessName}>{businessData.businessName}</Text>
            <Text style={styles.welcomeText}>Welcome back</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.settingsButton}>
          <MaterialIcons name="settings" size={24} color="#216a94" />
        </TouchableOpacity>
      </View>
      
      <ScrollView 
        style={styles.scrollView} 
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* KPI Cards */}
        <View style={styles.kpiContainer}>
          <View style={styles.kpiCard}>
            <View style={styles.kpiIconContainer}>
              <FontAwesome name="dollar" size={20} color="#fff" />
            </View>
            <View style={styles.kpiContent}>
              <Text style={styles.kpiValue}>${businessData.totalSales}</Text>
              <Text style={styles.kpiLabel}>Total Sales</Text>
            </View>
          </View>
          
          <View style={styles.kpiCard}>
            <View style={[styles.kpiIconContainer, { backgroundColor: '#4CAF50' }]}>
              <FontAwesome name="line-chart" size={20} color="#fff" />
            </View>
            <View style={styles.kpiContent}>
              <Text style={styles.kpiValue}>${businessData.salesToday}</Text>
              <Text style={styles.kpiLabel}>Today's Sales</Text>
            </View>
          </View>
          
          <View style={styles.kpiCard}>
            <View style={[styles.kpiIconContainer, { backgroundColor: '#FF9800' }]}>
              <MaterialIcons name="shopping-cart" size={20} color="#fff" />
            </View>
            <View style={styles.kpiContent}>
              <Text style={styles.kpiValue}>{businessData.newOrders}</Text>
              <Text style={styles.kpiLabel}>New Orders</Text>
            </View>
          </View>
          
          <View style={styles.kpiCard}>
            <View style={[styles.kpiIconContainer, { backgroundColor: '#F44336' }]}>
              <MaterialIcons name="warning" size={20} color="#fff" />
            </View>
            <View style={styles.kpiContent}>
              <Text style={styles.kpiValue}>{businessData.lowStockItems}</Text>
              <Text style={styles.kpiLabel}>Low Stock</Text>
            </View>
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
          <Text style={styles.marketplaceButtonText}>Go to Marketplace</Text>
        </TouchableOpacity>
        
        {/* Recent Orders */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Orders</Text>
          <TouchableOpacity style={styles.viewAllButton} onPress={handleOrders}>
            <Text style={styles.viewAllText}>View All</Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.ordersContainer}>
          {businessData.recentOrders.map((order) => (
            <TouchableOpacity key={order.id} style={styles.orderItem}>
              <View style={styles.orderDetails}>
                <Text style={styles.orderCustomer}>{order.customer}</Text>
                <Text style={styles.orderDate}>{new Date(order.date).toLocaleDateString()}</Text>
              </View>
              <View style={styles.orderInfo}>
                <Text style={styles.orderTotal}>${order.total}</Text>
                <View style={[styles.statusPill, { backgroundColor: getStatusColor(order.status) }]}>
                  <Text style={styles.statusText}>{order.status}</Text>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </View>
        
        {/* Top Products */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Top Selling Products</Text>
          <TouchableOpacity style={styles.viewAllButton} onPress={handleInventory}>
            <Text style={styles.viewAllText}>View All</Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.topProductsContainer}>
          {businessData.topProducts.map((product) => (
            <TouchableOpacity key={product.id} style={styles.productItem}>
              <View style={styles.productIconContainer}>
                <MaterialIcons name="eco" size={24} color="#fff" />
              </View>
              <View style={styles.productDetails}>
                <Text style={styles.productName}>{product.name}</Text>
                <Text style={styles.productSold}>{product.sold} sold</Text>
              </View>
              <Text style={styles.productRevenue}>${product.revenue}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
      
      {/* Bottom Navigation */}
      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItem}>
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
        
        <TouchableOpacity style={styles.navItem}>
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
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logo: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ddd',
  },
  businessInfo: {
    marginLeft: 12,
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
  settingsButton: {
    padding: 8,
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
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  kpiLabel: {
    fontSize: 12,
    color: '#666',
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
  },
  marketplaceButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
    marginLeft: 8,
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
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
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