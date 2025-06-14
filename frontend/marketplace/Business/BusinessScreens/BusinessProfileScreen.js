// Business/BusinessScreens/BusinessProfileScreen.js - PROPERLY FIXED WITH ORIGINAL FUNCTIONALITY PRESERVED
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  SafeAreaView,
  StatusBar,
  Image,
  Alert,
  Platform,
  ActivityIndicator,
  FlatList,
  Dimensions
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  MaterialIcons, 
  FontAwesome5,
  Ionicons,
  MaterialCommunityIcons
} from '@expo/vector-icons';

// FIXED: Import the corrected business API functions
import { 
  getBusinessDashboard, 
  getBusinessProfile, 
  getBusinessInventory, 
  getBusinessOrders, 
  getBusinessCustomers 
} from '../services/businessApi';

const { width } = Dimensions.get('window');

// Inline components to avoid import errors
const LoadingError = ({ isLoading, loadingText, error, onRetry }) => {
  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#216a94" />
        <Text style={{ marginTop: 16, fontSize: 16, color: '#666' }}>
          {loadingText || 'Loading...'}
        </Text>
      </View>
    );
  }
  if (error) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>  
        <MaterialIcons name="error-outline" size={48} color="#f44336" />
        <Text style={{ fontSize: 18, fontWeight: '600', color: '#333', marginTop: 16, textAlign: 'center' }}>
          Something went wrong
        </Text>
        <Text style={{ fontSize: 14, color: '#666', marginTop: 8, textAlign: 'center' }}>      
          {error}
        </Text>
        {onRetry && (
          <TouchableOpacity
            style={{
              backgroundColor: '#216a94',
              paddingVertical: 12,
              paddingHorizontal: 24,
              borderRadius: 8,
              marginTop: 20
            }}
            onPress={onRetry}
          >
            <Text style={{ color: '#fff', fontWeight: '600' }}>Try Again</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }
  return null;
};

const EmptyState = ({ icon, message, buttonText, onButtonPress }) => (
  <View style={{ alignItems: 'center', paddingVertical: 40, paddingHorizontal: 20 }}>
    <MaterialIcons name={icon} size={64} color="#e0e0e0" />
    <Text style={{
      fontSize: 16,
      color: '#666',
      textAlign: 'center',
      marginTop: 16,
      lineHeight: 22
    }}>
      {message}
    </Text>
    {buttonText && onButtonPress && (
      <TouchableOpacity
        style={{ 
          backgroundColor: '#216a94',
          paddingVertical: 12,
          paddingHorizontal: 24,
          borderRadius: 8,
          marginTop: 20
        }}
        onPress={onButtonPress}
      >
        <Text style={{ color: '#fff', fontWeight: '600' }}>{buttonText}</Text>
      </TouchableOpacity>
    )}
  </View>
);

export default function BusinessProfileScreen({ navigation, route }) {
  const [profile, setProfile] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [orders, setOrders] = useState([]);
  const [soldItems, setSoldItems] = useState([]);
  const [lowStockItems, setLowStockItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');

  // FIXED: Enhanced API calling function with better error handling
  const callAPI = async (endpoint, method = 'GET', data = null) => {
    try {
      console.log(`📞 Calling API: ${method} ${endpoint}`);
      
      // Map old endpoint patterns to new ones
      let correctedEndpoint = endpoint;
      
      if (endpoint.includes('business/profile?businessId=')) {
        const businessId = endpoint.split('businessId=')[1];
        return await getBusinessProfile(businessId);
      }
      
      if (endpoint.includes('business/dashboard')) {
        return await getBusinessDashboard();
      }
      
      if (endpoint.includes('business/inventory/')) {
        const businessId = endpoint.split('business/inventory/')[1];
        return await getBusinessInventory(businessId);
      }
      
      if (endpoint.includes('business/orders')) {
        return await getBusinessOrders();
      }
      
      if (endpoint.includes('business-customers') || endpoint.includes('business/customers')) {
        return await getBusinessCustomers();
      }
      
      // For other endpoints, use the original API call logic
      const userEmail = await AsyncStorage.getItem('userEmail');
      const userType = await AsyncStorage.getItem('userType');
      const businessId = await AsyncStorage.getItem('businessId');
      const authToken = await AsyncStorage.getItem('googleAuthToken');
      
      const headers = {
        'Content-Type': 'application/json',
      };
      
      if (userEmail) headers['X-User-Email'] = userEmail;
      if (userType) headers['X-User-Type'] = userType;
      if (businessId) headers['X-Business-ID'] = businessId;
      if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
      
      const response = await fetch(`https://usersfunctions.azurewebsites.net/api/${correctedEndpoint}`, {
        method,
        headers,
        body: data ? JSON.stringify(data) : null,
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error(`❌ API call failed for ${endpoint}:`, error);
      throw error;
    }
  };

  // FIXED: Load business data with proper error handling and fallbacks
  const loadBusinessData = useCallback(async () => {
    try {
      setError(null);
      console.log('🔄 Loading business profile data...');
      
      // Get business ID from storage
      const currentBusinessId = await AsyncStorage.getItem('businessId') || 
                               await AsyncStorage.getItem('userEmail');
      
      if (!currentBusinessId) {
        setError('Business ID not found. Please log in again.');
        setIsLoading(false);
        return;
      }

      console.log('🏢 Business ID:', currentBusinessId);

      // FIXED: Try dashboard first, then fallback to individual endpoints
      try {
        console.log('📊 Loading dashboard data...');
        const dashboardData = await getBusinessDashboard();
        
        if (dashboardData && dashboardData.success) {
          console.log('✅ Dashboard loaded successfully');
          
          // Extract all data from dashboard response
          if (dashboardData.businessProfile) {
            setProfile(dashboardData.businessProfile);
          }
          
          if (dashboardData.customers && dashboardData.customers.list) {
            setCustomers(dashboardData.customers.list);
          }
          
          if (dashboardData.inventory && dashboardData.inventory.items) {
            setInventory(dashboardData.inventory.items);
            setLowStockItems(dashboardData.inventory.items.filter(item => 
              (item.quantity || 0) <= (item.minThreshold || 5) && item.status === 'active'
            ));
          }
          
          if (dashboardData.orders && dashboardData.orders.recent) {
            setOrders(dashboardData.orders.recent);
            
            // Extract sold items from completed orders
            const completedOrders = dashboardData.orders.recent.filter(order => 
              order.status === 'completed'
            );
            
            const soldItemsList = completedOrders.slice(0, 10).map(order => ({
              id: order.orderId || order.id,
              title: `Order ${order.orderId || order.id}`,
              price: order.totalAmount || 0,
              image: 'https://images.unsplash.com/photo-1518335935020-cfd19de7c04a?ixlib=rb-4.0.3',
              soldAt: order.orderDate,
              buyer: order.customerName || 'Customer'
            }));
            
            setSoldItems(soldItemsList);
          }
        } else {
          console.warn('⚠️ Dashboard returned no data, loading individual endpoints...');
          await loadIndividualEndpoints(currentBusinessId);
        }
      } catch (dashboardError) {
        console.warn('⚠️ Dashboard API failed, falling back to individual endpoints:', dashboardError.message);
        await loadIndividualEndpoints(currentBusinessId);
      }

    } catch (err) {
      console.error('❌ Error loading business data:', err);
      setError(`Failed to load business data: ${err.message}`);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  // FIXED: Fallback function to load individual endpoints
  const loadIndividualEndpoints = async (businessId) => {
    try {
      // 1. Load Profile (using both old and new API patterns)
      try {
        console.log('👤 Loading business profile...');
        const profileData = await callAPI(`business/profile?businessId=${businessId}`);
        if (profileData && profileData.business) {
          console.log('✅ Profile loaded:', profileData.business);
          setProfile(profileData.business);
        } else {
          // Create basic profile if API doesn't return proper data
          const userEmail = await AsyncStorage.getItem('userEmail');
          setProfile({
            id: businessId,
            email: userEmail,
            businessName: 'My Business',
            businessType: 'Business',
            joinDate: new Date().toISOString()
          });
        }
      } catch (profileError) {
        console.warn('⚠️ Profile API failed, using basic profile:', profileError.message);
        const userEmail = await AsyncStorage.getItem('userEmail');
        setProfile({
          id: businessId,
          email: userEmail,
          businessName: 'My Business',
          businessType: 'Business',
          joinDate: new Date().toISOString()
        });
      }
      
      // 2. Load Customers (from business-dashboard or business-customers)
      try {
        console.log('👥 Loading customers...');
        const customerData = await callAPI(`business-customers`);
        if (customerData && customerData.customers) {
          console.log('✅ Customers loaded:', customerData.customers.length);
          setCustomers(customerData.customers);
        } else if (Array.isArray(customerData)) {
          console.log('✅ Customers loaded (array format):', customerData.length);
          setCustomers(customerData);
        }
      } catch (customerError) {
        console.warn('⚠️ Customer data loading failed:', customerError.message);
        setCustomers([]);
      }
      
      // 3. Load Inventory
      try {
        console.log('📦 Loading inventory...');
        const inventoryData = await callAPI(`business/inventory/${businessId}`);
        if (inventoryData && inventoryData.inventory) {
          console.log('✅ Inventory loaded:', inventoryData.inventory.length, 'items');
          setInventory(inventoryData.inventory);
          
          // Get low stock items
          const lowStock = inventoryData.inventory.filter(item => 
            (item.quantity || 0) <= (item.minThreshold || 5) && item.status === 'active'
          );
          setLowStockItems(lowStock);
        } else if (Array.isArray(inventoryData)) {
          console.log('✅ Inventory loaded (array format):', inventoryData.length, 'items');
          setInventory(inventoryData);
          
          const lowStock = inventoryData.filter(item => 
            (item.quantity || 0) <= (item.minThreshold || 5) && item.status === 'active'
          );
          setLowStockItems(lowStock);
        }
      } catch (inventoryError) {
        console.warn('⚠️ Inventory loading failed:', inventoryError.message);
        setInventory([]);
      }
      
      // 4. Load Orders
      try {
        console.log('📋 Loading orders...');
        const orderData = await callAPI(`business/orders?businessId=${businessId}`);
        if (orderData && orderData.orders) {
          console.log('✅ Orders loaded:', orderData.orders.length);
          setOrders(orderData.orders);
        } else if (Array.isArray(orderData)) {
          console.log('✅ Orders loaded (array format):', orderData.length);
          setOrders(orderData);
        }
      } catch (orderError) {
        console.warn('⚠️ Orders loading failed:', orderError.message);
        setOrders([]);
      }

    } catch (error) {
      console.error('❌ Error in loadIndividualEndpoints:', error);
      throw error;
    }
  };

  // Handle refreshing the profile
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadBusinessData();
  }, [loadBusinessData]);

  // Load data on component mount and when screen is focused
  useEffect(() => {
    loadBusinessData();
  }, [loadBusinessData]);

  useFocusEffect(
    useCallback(() => {
      // Reload data when screen comes into focus
      loadBusinessData();
    }, [loadBusinessData])
  );

  // Calculate stats from loaded data
  const stats = {
    totalRevenue: orders.filter(order => order.status === 'completed')
                       .reduce((sum, order) => sum + (order.totalAmount || 0), 0),
    totalOrders: orders.length,
    pendingOrders: orders.filter(order => order.status === 'pending').length,
    totalCustomers: customers.length,
    activeInventory: inventory.filter(item => item.status === 'active').length,
    lowStockCount: lowStockItems.length,
    inventoryValue: inventory.filter(item => item.status === 'active')
                             .reduce((sum, item) => sum + ((item.quantity || 0) * (item.price || 0)), 0)
  };

  // FIXED: Handle navigation with proper error handling
  const handleNavigation = (screen, params = {}) => {
    try {
      navigation.navigate(screen, params);
    } catch (navigationError) {
      console.error('❌ Navigation error:', navigationError);
      Alert.alert('Navigation Error', 'Unable to navigate to the requested screen.');
    }
  };

  // Render tab content based on active tab
  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return renderOverviewTab();
      case 'inventory':
        return renderInventoryTab();
      case 'orders':
        return renderOrdersTab();
      case 'customers':
        return renderCustomersTab();
      default:
        return renderOverviewTab();
    }
  };

  // ...existing rendering methods preserved...
  const renderOverviewTab = () => (
    <ScrollView style={styles.tabContent}>
      {/* Stats Cards */}
      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <View style={styles.statIcon}>
            <MaterialIcons name="monetization-on" size={24} color="#4CAF50" />
          </View>
          <Text style={styles.statValue}>₪{stats.totalRevenue.toFixed(0)}</Text>
          <Text style={styles.statLabel}>Total Revenue</Text>
        </View>
        
        <View style={styles.statCard}>
          <View style={styles.statIcon}>
            <MaterialIcons name="assignment" size={24} color="#2196F3" />
          </View>
          <Text style={styles.statValue}>{stats.totalOrders}</Text>
          <Text style={styles.statLabel}>Total Orders</Text>
        </View>
        
        <View style={styles.statCard}>
          <View style={styles.statIcon}>
            <MaterialIcons name="people" size={24} color="#FF9800" />
          </View>
          <Text style={styles.statValue}>{stats.totalCustomers}</Text>
          <Text style={styles.statLabel}>Customers</Text>
        </View>
        
        <View style={styles.statCard}>
          <View style={styles.statIcon}>
            <MaterialIcons name="inventory" size={24} color="#9C27B0" />
          </View>
          <Text style={styles.statValue}>{stats.activeInventory}</Text>
          <Text style={styles.statLabel}>Active Products</Text>
        </View>
      </View>

      {/* Quick Actions */}
      <View style={styles.quickActions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleNavigation('BusinessInventoryScreen')}
        >
          <MaterialIcons name="add-box" size={24} color="#4CAF50" />
          <Text style={styles.actionText}>Add Product</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleNavigation('BusinessOrdersScreen')}
        >
          <MaterialIcons name="assignment" size={24} color="#2196F3" />
          <Text style={styles.actionText}>View Orders</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleNavigation('BusinessAnalyticsScreen')}
        >
          <MaterialIcons name="analytics" size={24} color="#FF9800" />
          <Text style={styles.actionText}>Analytics</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleNavigation('BusinessSettingsScreen')}
        >
          <MaterialIcons name="settings" size={24} color="#9C27B0" />
          <Text style={styles.actionText}>Settings</Text>
        </TouchableOpacity>
      </View>

      {/* Low Stock Alert */}
      {stats.lowStockCount > 0 && (
        <View style={styles.alertCard}>
          <View style={styles.alertHeader}>
            <MaterialIcons name="warning" size={24} color="#FF5722" />
            <Text style={styles.alertTitle}>Low Stock Alert</Text>
          </View>
          <Text style={styles.alertText}>
            {stats.lowStockCount} product(s) are running low on stock
          </Text>
          <TouchableOpacity
            style={styles.alertButton}
            onPress={() => handleNavigation('BusinessInventoryScreen', { filter: 'lowStock' })}
          >
            <Text style={styles.alertButtonText}>View Low Stock Items</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Recent Activity */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Recent Activity</Text>
        {orders.length > 0 ? (
          <FlatList
            data={orders.slice(0, 5)}
            keyExtractor={(item) => item.id || item.orderId}
            renderItem={({ item }) => (
              <View style={styles.activityItem}>
                <View style={styles.activityIcon}>
                  <MaterialIcons name="shopping-cart" size={20} color="#4CAF50" />
                </View>
                <View style={styles.activityContent}>
                  <Text style={styles.activityTitle}>
                    Order from {item.customerName || 'Customer'}
                  </Text>
                  <Text style={styles.activitySubtitle}>
                    ₪{item.totalAmount || 0} • {new Date(item.orderDate).toLocaleDateString()}
                  </Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
                  <Text style={styles.statusText}>{item.status}</Text>
                </View>
              </View>
            )}
            scrollEnabled={false}
          />
        ) : (
          <EmptyState
            icon="assignment"
            message="No recent orders to display"
            buttonText="View All Orders"
            onButtonPress={() => handleNavigation('BusinessOrdersScreen')}
          />
        )}
      </View>
    </ScrollView>
  );

  const renderInventoryTab = () => (
    <ScrollView style={styles.tabContent}>
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Inventory Overview</Text>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => handleNavigation('BusinessInventoryScreen')}
          >
            <MaterialIcons name="add" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
        
        <View style={styles.inventoryStats}>
          <View style={styles.inventoryStat}>
            <Text style={styles.inventoryStatValue}>{stats.activeInventory}</Text>
            <Text style={styles.inventoryStatLabel}>Active Products</Text>
          </View>
          <View style={styles.inventoryStat}>
            <Text style={styles.inventoryStatValue}>₪{stats.inventoryValue.toFixed(0)}</Text>
            <Text style={styles.inventoryStatLabel}>Total Value</Text>
          </View>
          <View style={styles.inventoryStat}>
            <Text style={[styles.inventoryStatValue, { color: stats.lowStockCount > 0 ? '#FF5722' : '#4CAF50' }]}>
              {stats.lowStockCount}
            </Text>
            <Text style={styles.inventoryStatLabel}>Low Stock</Text>
          </View>
        </View>

        {inventory.length > 0 ? (
          <FlatList
            data={inventory.slice(0, 5)}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <View style={styles.inventoryItem}>
                <Image
                  source={{
                    uri: item.mainImage || item.image || 'https://images.unsplash.com/photo-1518335935020-cfd19de7c04a?ixlib=rb-4.0.3'
                  }}
                  style={styles.inventoryImage}
                />
                <View style={styles.inventoryContent}>
                  <Text style={styles.inventoryName}>{item.name || item.common_name}</Text>
                  <Text style={styles.inventoryPrice}>₪{item.price || 0}</Text>
                  <Text style={styles.inventoryQuantity}>
                    Qty: {item.quantity || 0}
                    {(item.quantity || 0) <= (item.minThreshold || 5) && (
                      <Text style={styles.lowStockText}> (Low Stock)</Text>
                    )}
                  </Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: item.status === 'active' ? '#4CAF50' : '#9E9E9E' }]}>
                  <Text style={styles.statusText}>{item.status}</Text>
                </View>
              </View>
            )}
            scrollEnabled={false}
          />
        ) : (
          <EmptyState
            icon="inventory"
            message="No products in your inventory yet"
            buttonText="Add Your First Product"
            onButtonPress={() => handleNavigation('BusinessInventoryScreen')}
          />
        )}
      </View>
    </ScrollView>
  );

  const renderOrdersTab = () => (
    <ScrollView style={styles.tabContent}>
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Order Management</Text>
        
        <View style={styles.orderStats}>
          <View style={styles.orderStat}>
            <Text style={styles.orderStatValue}>{stats.totalOrders}</Text>
            <Text style={styles.orderStatLabel}>Total Orders</Text>
          </View>
          <View style={styles.orderStat}>
            <Text style={styles.orderStatValue}>{stats.pendingOrders}</Text>
            <Text style={styles.orderStatLabel}>Pending</Text>
          </View>
          <View style={styles.orderStat}>
            <Text style={styles.orderStatValue}>₪{stats.totalRevenue.toFixed(0)}</Text>
            <Text style={styles.orderStatLabel}>Revenue</Text>
          </View>
        </View>

        {orders.length > 0 ? (
          <FlatList
            data={orders.slice(0, 10)}
            keyExtractor={(item) => item.id || item.orderId}
            renderItem={({ item }) => (
              <View style={styles.orderItem}>
                <View style={styles.orderHeader}>
                  <Text style={styles.orderTitle}>Order #{item.orderId || item.id}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
                    <Text style={styles.statusText}>{item.status}</Text>
                  </View>
                </View>
                <Text style={styles.orderCustomer}>Customer: {item.customerName || 'Unknown'}</Text>
                <Text style={styles.orderAmount}>Amount: ₪{item.totalAmount || 0}</Text>
                <Text style={styles.orderDate}>
                  {new Date(item.orderDate).toLocaleDateString()}
                </Text>
              </View>
            )}
            scrollEnabled={false}
          />
        ) : (
          <EmptyState
            icon="assignment"
            message="No orders received yet"
            buttonText="View All Orders"
            onButtonPress={() => handleNavigation('BusinessOrdersScreen')}
          />
        )}
      </View>
    </ScrollView>
  );

  const renderCustomersTab = () => (
    <ScrollView style={styles.tabContent}>
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Customer Management</Text>
        
        <View style={styles.customerStats}>
          <View style={styles.customerStat}>
            <Text style={styles.customerStatValue}>{stats.totalCustomers}</Text>
            <Text style={styles.customerStatLabel}>Total Customers</Text>
          </View>
          <View style={styles.customerStat}>
            <Text style={styles.customerStatValue}>
              ₪{stats.totalCustomers > 0 ? (stats.totalRevenue / stats.totalCustomers).toFixed(0) : 0}
            </Text>
            <Text style={styles.customerStatLabel}>Avg per Customer</Text>
          </View>
        </View>

        {customers.length > 0 ? (
          <FlatList
            data={customers.slice(0, 10)}
            keyExtractor={(item) => item.id || item.email}
            renderItem={({ item }) => (
              <View style={styles.customerItem}>
                <View style={styles.customerAvatar}>
                  <Text style={styles.customerInitial}>
                    {(item.name || item.email || 'C').charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.customerContent}>
                  <Text style={styles.customerName}>{item.name || 'Customer'}</Text>
                  <Text style={styles.customerEmail}>{item.email}</Text>
                  <Text style={styles.customerStats}>
                    {item.orderCount || 0} orders • ₪{item.totalSpent || 0}
                  </Text>
                </View>
              </View>
            )}
            scrollEnabled={false}
          />
        ) : (
          <EmptyState
            icon="people"
            message="No customers yet"
            buttonText="View Customer Management"
            onButtonPress={() => handleNavigation('BusinessCustomersScreen')}
          />
        )}
      </View>
    </ScrollView>
  );

  // Helper function to get status color
  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return '#4CAF50';
      case 'pending': return '#FF9800';
      case 'cancelled': return '#F44336';
      default: return '#9E9E9E';
    }
  };

  // Main render with loading and error states
  if (isLoading && !profile) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#f8f9fa" />
        <LoadingError 
          isLoading={true} 
          loadingText="Loading your business profile..." 
        />
      </SafeAreaView>
    );
  }

  if (error && !profile) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#f8f9fa" />
        <LoadingError 
          error={error} 
          onRetry={loadBusinessData} 
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8f9fa" />
      
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.businessInfo}>
          <Text style={styles.businessName}>
            {profile?.businessName || profile?.name || 'My Business'}
          </Text>
          <Text style={styles.businessType}>
            {profile?.businessType || 'Business'}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.settingsButton}
          onPress={() => handleNavigation('BusinessSettingsScreen')}
        >
          <MaterialIcons name="settings" size={24} color="#216a94" />
        </TouchableOpacity>
      </View>

      {/* Tab Navigation */}
      <View style={styles.tabNavigation}>
        {[
          { key: 'overview', label: 'Overview', icon: 'dashboard' },
          { key: 'inventory', label: 'Inventory', icon: 'inventory' },
          { key: 'orders', label: 'Orders', icon: 'assignment' },
          { key: 'customers', label: 'Customers', icon: 'people' }
        ].map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tabButton, activeTab === tab.key && styles.activeTabButton]}
            onPress={() => setActiveTab(tab.key)}
          >
            <MaterialIcons 
              name={tab.icon} 
              size={20} 
              color={activeTab === tab.key ? '#216a94' : '#9E9E9E'} 
            />
            <Text style={[styles.tabLabel, activeTab === tab.key && styles.activeTabLabel]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Tab Content */}
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {renderTabContent()}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  businessInfo: {
    flex: 1,
  },
  businessName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#216a94',
    marginBottom: 4,
  },
  businessType: {
    fontSize: 14,
    color: '#6c757d',
  },
  settingsButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#f8f9fa',
  },
  tabNavigation: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  activeTabButton: {
    borderBottomWidth: 2,
    borderBottomColor: '#216a94',
  },
  tabLabel: {
    fontSize: 12,
    color: '#9E9E9E',
    marginTop: 4,
    fontWeight: '500',
  },
  activeTabLabel: {
    color: '#216a94',
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  tabContent: {
    flex: 1,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 16,
    gap: 12,
  },
  statCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    flex: 1,
    minWidth: (width - 44) / 2,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  statIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f8f9fa',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#212529',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#6c757d',
    textAlign: 'center',
  },
  quickActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 12,
  },
  actionButton: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    flex: 1,
    minWidth: (width - 44) / 2,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  actionText: {
    fontSize: 12,
    color: '#216a94',
    marginTop: 8,
    fontWeight: '600',
    textAlign: 'center',
  },
  alertCard: {
    backgroundColor: '#fff3cd',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#FF5722',
  },
  alertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  alertTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#856404',
    marginLeft: 8,
  },
  alertText: {
    fontSize: 14,
    color: '#856404',
    marginBottom: 12,
  },
  alertButton: {
    backgroundColor: '#FF5722',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignSelf: 'flex-start',
  },
  alertButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  sectionCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    padding: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#212529',
  },
  addButton: {
    backgroundColor: '#216a94',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f8f9fa',
  },
  activityIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e8f5e8',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  activityContent: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#212529',
    marginBottom: 4,
  },
  activitySubtitle: {
    fontSize: 12,
    color: '#6c757d',
  },
  statusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  inventoryStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
    paddingVertical: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
  },
  inventoryStat: {
    alignItems: 'center',
  },
  inventoryStatValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#212529',
  },
  inventoryStatLabel: {
    fontSize: 12,
    color: '#6c757d',
    marginTop: 4,
  },
  inventoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f8f9fa',
  },
  inventoryImage: {
    width: 50,
    height: 50,
    borderRadius: 8,
    marginRight: 12,
    backgroundColor: '#f8f9fa',
  },
  inventoryContent: {
    flex: 1,
  },
  inventoryName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#212529',
    marginBottom: 4,
  },
  inventoryPrice: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#216a94',
    marginBottom: 2,
  },
  inventoryQuantity: {
    fontSize: 12,
    color: '#6c757d',
  },
  lowStockText: {
    color: '#FF5722',
    fontWeight: '600',
  },
  orderStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
    paddingVertical: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
  },
  orderStat: {
    alignItems: 'center',
  },
  orderStatValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#212529',
  },
  orderStatLabel: {
    fontSize: 12,
    color: '#6c757d',
    marginTop: 4,
  },
  orderItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f8f9fa',
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  orderTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#212529',
  },
  orderCustomer: {
    fontSize: 12,
    color: '#6c757d',
    marginBottom: 4,
  },
  orderAmount: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#216a94',
    marginBottom: 2,
  },
  orderDate: {
    fontSize: 12,
    color: '#6c757d',
  },
  customerStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
    paddingVertical: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
  },
  customerStat: {
    alignItems: 'center',
  },
  customerStatValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#212529',
  },
  customerStatLabel: {
    fontSize: 12,
    color: '#6c757d',
    marginTop: 4,
  },
  customerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f8f9fa',
  },
  customerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#216a94',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  customerInitial: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  customerContent: {
    flex: 1,
  },
  customerName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#212529',
    marginBottom: 4,
  },
  customerEmail: {
    fontSize: 12,
    color: '#6c757d',
    marginBottom: 2,
  },
  customerStatsText: {
    fontSize: 12,
    color: '#6c757d',
  },
});
