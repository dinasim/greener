// Business/BusinessScreens/BusinessProfileScreen.js - FIXED FOR REAL BACKEND
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
  ActivityIndicator
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { 
  MaterialIcons, 
  FontAwesome5, 
  Ionicons, 
  MaterialCommunityIcons 
} from '@expo/vector-icons';

// Import common components (fix relative paths)
// Note: Adjust these paths based on your actual file structure
// import LoadingError from '../../marketplace/screens/ProfileScreen-parts/LoadingError';
// import EmptyState from '../../marketplace/screens/ProfileScreen-parts/EmptyState';

// For now, let's create simple inline components to avoid import errors
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

const BusinessProfileScreen = ({ navigation }) => {
  // State variables
  const [profile, setProfile] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [orders, setOrders] = useState([]);
  const [soldItems, setSoldItems] = useState([]);
  const [lowStockItems, setLowStockItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('inventory');
  const [businessId, setBusinessId] = useState(null);

  // Load profile data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      initializeScreen();
    }, [])
  );

  // Initialize screen with business ID and load data
  const initializeScreen = async () => {
    try {
      const storedBusinessId = await AsyncStorage.getItem('businessId');
      const userEmail = await AsyncStorage.getItem('userEmail');
      
      if (!storedBusinessId && !userEmail) {
        setError('Business ID not found. Please sign in again.');
        return;
      }
      
      const businessIdToUse = storedBusinessId || userEmail;
      setBusinessId(businessIdToUse);
      
      console.log('📱 Business Profile Screen initialized with ID:', businessIdToUse);
      loadAllData(businessIdToUse);
    } catch (err) {
      console.error('❌ Error initializing business profile screen:', err);
      setError('Failed to initialize. Please try again.');
      setIsLoading(false);
    }
  };

  // API call functions using real backend
  const callAPI = async (endpoint, businessId = null) => {
    try {
      const userEmail = await AsyncStorage.getItem('userEmail');
      const userType = await AsyncStorage.getItem('userType');
      const storedBusinessId = await AsyncStorage.getItem('businessId');
      
      const headers = {
        'Content-Type': 'application/json',
        'X-User-Email': userEmail || '',
        'X-User-Type': userType || 'business',
        'X-Business-ID': storedBusinessId || businessId || ''
      };
      
      let url = `https://usersfunctions.azurewebsites.net/api/${endpoint}`;
      if (businessId && endpoint.includes('?')) {
        url += `&businessId=${businessId}`;
      } else if (businessId && !endpoint.includes('?')) {
        url += `?businessId=${businessId}`;
      }
      
      console.log(`🔗 Calling API: ${url}`);
      
      const response = await fetch(url, {
        method: 'GET',
        headers
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log(`✅ API Response from ${endpoint}:`, data);
      return data;
    } catch (error) {
      console.error(`❌ API Error for ${endpoint}:`, error);
      throw error;
    }
  };

  // Function to load all profile data from real backend
  const loadAllData = async (businessIdParam) => {
    if (refreshing) return; // Prevent multiple simultaneous loads
    
    const currentBusinessId = businessIdParam || businessId;
    if (!currentBusinessId) {
      setError('Business ID is required');
      setIsLoading(false);
      return;
    }
    
    setIsLoading(!profile); // Only show loading indicator on first load
    setError(null);
    setRefreshing(true);
    
    try {
      console.log('📊 Loading business data for:', currentBusinessId);
      
      // 1. Load Business Profile
      try {
        const profileData = await callAPI(`business/profile?businessId=${currentBusinessId}`);
        if (profileData && profileData.business) {
          console.log('✅ Profile loaded:', profileData.business);
          setProfile(profileData.business);
        } else {
          // Create basic profile if API doesn't return proper data
          const userEmail = await AsyncStorage.getItem('userEmail');
          setProfile({
            id: currentBusinessId,
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
          id: currentBusinessId,
          email: userEmail,
          businessName: 'My Business',
          businessType: 'Business',
          joinDate: new Date().toISOString()
        });
      }
      
      // 2. Load Customers (from business-dashboard or business-customers)
      try {
        const customerData = await callAPI('business/dashboard');
        if (Array.isArray(customerData)) {
          console.log('✅ Customers loaded from dashboard:', customerData.length);
          setCustomers(customerData);
          
          // Extract sold orders from customer data
          const allSoldOrders = [];
          customerData.forEach(customer => {
            if (customer.orders && Array.isArray(customer.orders)) {
              customer.orders.forEach(order => {
                if (order.status === 'completed' || order.status === 'processed') {
                  allSoldOrders.push({
                    id: order.orderId,
                    title: 'Order Items',
                    price: order.total || 0,
                    image: 'https://images.unsplash.com/photo-1518335935020-cfd19de7c04a?ixlib=rb-4.0.3',
                    soldAt: order.date,
                    buyer: customer.name || 'Customer'
                  });
                }
              });
            }
          });
          setSoldItems(allSoldOrders.slice(0, 10));
        }
      } catch (customerError) {
        console.warn('⚠️ Customer data loading failed:', customerError.message);
        setCustomers([]);
      }
      
      // 3. Load Inventory
      try {
        const inventoryData = await callAPI(`business/inventory/${currentBusinessId}`);
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
        const orderData = await callAPI(`business/orders?businessId=${currentBusinessId}`);
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
      
    } catch (err) {
      console.error('❌ Error loading business data:', err);
      setError(`Failed to load business data: ${err.message}`);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  // Handle refreshing the profile
  const onRefresh = () => {
    loadAllData();
  };

  // Handle edit profile button press
  const handleEditProfile = () => {
    Alert.alert(
      'Edit Profile',
      'Profile editing feature will be available soon.',
      [{ text: 'OK' }]
    );
  };

  // Handle adding a new product
  const handleAddProduct = () => {
    navigation.navigate('AddInventoryScreen', { businessId });
  };

  // Handle viewing all inventory
  const handleViewInventory = () => {
    navigation.navigate('BusinessInventoryScreen', { businessId });
  };

  // Handle viewing an individual product
  const handleProductPress = (productId) => {
    navigation.navigate('EditProductScreen', { productId, businessId });
  };

  // Handle viewing all orders
  const handleViewOrders = () => {
    navigation.navigate('BusinessOrdersScreen', { businessId });
  };

  // Handle viewing customers
  const handleViewCustomers = () => {
    navigation.navigate('CustomerListScreen', { businessId });
  };

  // Handle signing out
  const handleSignOut = () => {
    Alert.alert(
      "Sign Out",
      "Are you sure you want to sign out?",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        { 
          text: "Sign Out", 
          onPress: async () => {
            try {
              await AsyncStorage.multiRemove([
                'userEmail',
                'userType', 
                'businessId',
                'authToken'
              ]);
              
              // Navigate to login screen
              navigation.reset({
                index: 0,
                routes: [{ name: 'Login' }]
              });
            } catch (e) {
              console.error('Error signing out:', e);
            }
          },
          style: "destructive"
        }
      ]
    );
  };

  // Get business stats from real data
  const getBusinessStats = () => {
    const totalRevenue = customers.reduce((sum, customer) => sum + (customer.totalSpent || 0), 0);
    const totalOrders = customers.reduce((sum, customer) => sum + (customer.orderCount || 0), 0);
    
    return {
      inventory: inventory.length,
      sold: totalOrders,
      revenue: totalRevenue,
      customers: customers.length,
      rating: profile?.rating || 0,
      reviewCount: profile?.reviewCount || 0
    };
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

  // Render loading and error states
  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" />
        <LoadingError isLoading={true} loadingText="Loading business profile..." />
      </SafeAreaView>
    );
  }

  if (error && !profile) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" />
        <LoadingError error={error} onRetry={() => loadAllData()} />
      </SafeAreaView>
    );
  }

  const stats = getBusinessStats();

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      {/* Header with business name and settings button */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>
            {profile?.businessName || 'Business Profile'}
          </Text>
          <TouchableOpacity 
            style={styles.settingsButton}
            onPress={() => Alert.alert('Settings', 'Settings feature coming soon!')}
          >
            <MaterialIcons name="settings" size={24} color="#216a94" />
          </TouchableOpacity>
        </View>
      </View>
      
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh}
            colors={['#216a94']}
            tintColor="#216a94"
          />
        }
      >
        {/* Business Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.profileHeader}>
            {/* Business Logo */}
            <View style={styles.logoContainer}>
              {profile?.logo ? (
                <Image 
                  source={{ uri: profile.logo }}
                  style={styles.businessLogo}
                />
              ) : (
                <View style={styles.placeholderLogo}>
                  <MaterialCommunityIcons name="store" size={32} color="#216a94" />
                </View>
              )}
            </View>
            
            {/* Business Info */}
            <View style={styles.businessInfo}>
              <Text style={styles.businessName}>
                {profile?.businessName || profile?.name || 'My Business'}
              </Text>
              <Text style={styles.businessType}>
                {profile?.businessType || 'Business'}
              </Text>
              <View style={styles.ratingContainer}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <MaterialIcons 
                    key={star}
                    name={star <= Math.round(stats.rating) ? "star" : "star-border"}
                    size={16}
                    color="#FFC107"
                  />
                ))}
                <Text style={styles.ratingText}>
                  {stats.rating > 0 ? `${stats.rating.toFixed(1)} (${stats.reviewCount})` : 'No reviews yet'}
                </Text>
              </View>
            </View>
            
            {/* Edit Profile Button */}
            <TouchableOpacity 
              style={styles.editButton}
              onPress={handleEditProfile}
            >
              <MaterialIcons name="edit" size={18} color="#216a94" />
              <Text style={styles.editButtonText}>Edit</Text>
            </TouchableOpacity>
          </View>
          
          {/* Business Description */}
          {profile?.description && (
            <Text style={styles.description}>
              {profile.description}
            </Text>
          )}
          
          {/* Business Contact & Location */}
          <View style={styles.contactSection}>
            {profile?.contactPhone && (
              <View style={styles.contactItem}>
                <MaterialIcons name="phone" size={16} color="#555" />
                <Text style={styles.contactText}>{profile.contactPhone}</Text>
              </View>
            )}
            {profile?.email && (
              <View style={styles.contactItem}>
                <MaterialIcons name="email" size={16} color="#555" />
                <Text style={styles.contactText}>{profile.email}</Text>
              </View>
            )}
            {profile?.address?.city && (
              <View style={styles.contactItem}>
                <MaterialIcons name="location-on" size={16} color="#555" />
                <Text style={styles.contactText}>
                  {profile.address.city}{profile.address.country ? `, ${profile.address.country}` : ''}
                </Text>
              </View>
            )}
          </View>
          
          {/* Join Date */}
          {profile?.joinDate && (
            <Text style={styles.joinedText}>
              Business since {new Date(profile.joinDate).toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'long' 
              })}
            </Text>
          )}
        </View>
        
        {/* Stats Cards */}
        <View style={styles.statsContainer}>
          <TouchableOpacity style={styles.statCard} onPress={handleViewInventory}>
            <View style={[styles.statIconContainer, { backgroundColor: '#4CAF50' }]}>
              <MaterialIcons name="inventory" size={20} color="#fff" />
            </View>
            <Text style={styles.statValue}>{stats.inventory}</Text>
            <Text style={styles.statLabel}>Inventory</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.statCard} onPress={handleViewOrders}>
            <View style={[styles.statIconContainer, { backgroundColor: '#2196F3' }]}>
              <FontAwesome5 name="shopping-bag" size={18} color="#fff" />
            </View>
            <Text style={styles.statValue}>{stats.sold}</Text>
            <Text style={styles.statLabel}>Orders</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.statCard} onPress={handleViewCustomers}>
            <View style={[styles.statIconContainer, { backgroundColor: '#FF9800' }]}>
              <MaterialIcons name="people" size={18} color="#fff" />
            </View>
            <Text style={styles.statValue}>{stats.customers}</Text>
            <Text style={styles.statLabel}>Customers</Text>
          </TouchableOpacity>
        </View>
        
        {/* Low Stock Alert */}
        {lowStockItems.length > 0 && (
          <View style={styles.alertCard}>
            <View style={styles.alertHeader}>
              <MaterialIcons name="warning" size={20} color="#ff9800" />
              <Text style={styles.alertTitle}>Low Stock Alert</Text>
            </View>
            {lowStockItems.slice(0, 3).map(item => (
              <View key={item.id} style={styles.alertItem}>
                <Text style={styles.alertItemText}>
                  {item.name || item.common_name || item.title}
                </Text>
                <Text style={styles.alertItemCount}>
                  {item.quantity} left of {item.minThreshold || 5} minimum
                </Text>
              </View>
            ))}
            <TouchableOpacity 
              style={styles.alertButton}
              onPress={handleViewInventory}
            >
              <Text style={styles.alertButtonText}>Manage Inventory</Text>
            </TouchableOpacity>
          </View>
        )}
        
        {/* Tabs */}
        <View style={styles.tabsContainer}>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'inventory' && styles.activeTab]} 
            onPress={() => setActiveTab('inventory')}
          >
            <MaterialIcons 
              name="inventory" 
              size={22} 
              color={activeTab === 'inventory' ? '#216a94' : '#888'} 
            />
            <Text style={[styles.tabText, activeTab === 'inventory' && styles.activeTabText]}>
              Inventory
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'sold' && styles.activeTab]} 
            onPress={() => setActiveTab('sold')}
          >
            <MaterialIcons 
              name="local-offer" 
              size={22} 
              color={activeTab === 'sold' ? '#216a94' : '#888'} 
            />
            <Text style={[styles.tabText, activeTab === 'sold' && styles.activeTabText]}>
              Recent Orders
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'customers' && styles.activeTab]} 
            onPress={() => setActiveTab('customers')}
          >
            <MaterialIcons 
              name="people" 
              size={22} 
              color={activeTab === 'customers' ? '#216a94' : '#888'} 
            />
            <Text style={[styles.tabText, activeTab === 'customers' && styles.activeTabText]}>
              Customers
            </Text>
          </TouchableOpacity>
        </View>
        
        {/* Tab Content */}
        <View style={styles.tabContent}>
          {/* Inventory Tab */}
          {activeTab === 'inventory' && (
            <>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Current Inventory</Text>
                <TouchableOpacity onPress={handleViewInventory}>
                  <Text style={styles.sectionAction}>View All</Text>
                </TouchableOpacity>
              </View>
              
              {inventory.length > 0 ? (
                <>
                  {inventory.slice(0, 3).map(item => (
                    <TouchableOpacity 
                      key={item.id} 
                      style={styles.productCard}
                      onPress={() => handleProductPress(item.id)}
                    >
                      <View style={styles.productImageContainer}>
                        {item.mainImage || item.image ? (
                          <Image 
                            source={{ uri: item.mainImage || item.image }} 
                            style={styles.productImage} 
                          />
                        ) : (
                          <View style={styles.placeholderImage}>
                            <MaterialCommunityIcons 
                              name={item.productType === 'plant' ? 'leaf' : 'cube-outline'} 
                              size={24} 
                              color="#4CAF50" 
                            />
                          </View>
                        )}
                      </View>
                      <View style={styles.productInfo}>
                        <Text style={styles.productTitle}>
                          {item.name || item.common_name || item.title || 'Product'}
                        </Text>
                        <Text style={styles.productCategory}>
                          {item.category || item.productType || 'General'}
                        </Text>
                        <Text style={styles.productPrice}>
                          ${(item.finalPrice || item.price || 0).toFixed(2)}
                        </Text>
                      </View>
                      <View style={styles.productQuantity}>
                        <Text style={styles.quantityLabel}>Qty</Text>
                        <Text style={[
                          styles.quantityValue,
                          (item.quantity || 0) <= (item.minThreshold || 5) && styles.lowStockText
                        ]}>
                          {item.quantity || 0}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                  
                  <TouchableOpacity 
                    style={styles.addButton}
                    onPress={handleAddProduct}
                  >
                    <MaterialIcons name="add" size={20} color="#fff" />
                    <Text style={styles.addButtonText}>Add New Product</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <EmptyState 
                  icon="inventory" 
                  message="You don't have any products in your inventory yet." 
                  buttonText="Add Product" 
                  onButtonPress={handleAddProduct} 
                />
              )}
            </>
          )}
          
          {/* Recent Orders Tab */}
          {activeTab === 'sold' && (
            <>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Recent Orders</Text>
                <TouchableOpacity onPress={handleViewOrders}>
                  <Text style={styles.sectionAction}>View All</Text>
                </TouchableOpacity>
              </View>
              
              {soldItems.length > 0 ? (
                soldItems.map(item => (
                  <View key={item.id} style={styles.soldItemCard}>
                    <View style={styles.productImageContainer}>
                      <Image 
                        source={{ uri: item.image }} 
                        style={styles.productImage} 
                      />
                    </View>
                    <View style={styles.productInfo}>
                      <Text style={styles.productTitle}>{item.title}</Text>
                      <Text style={styles.soldDate}>
                        {new Date(item.soldAt).toLocaleDateString()}
                      </Text>
                      <Text style={styles.soldBuyer}>Customer: {item.buyer}</Text>
                    </View>
                    <View style={styles.productPrice}>
                      <Text style={styles.soldPriceValue}>${item.price.toFixed(2)}</Text>
                    </View>
                  </View>
                ))
              ) : (
                <EmptyState 
                  icon="local-offer" 
                  message="No recent orders found." 
                  buttonText="View All Orders" 
                  onButtonPress={handleViewOrders} 
                />
              )}
            </>
          )}
          
          {/* Customers Tab */}
          {activeTab === 'customers' && (
            <>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Recent Customers</Text>
                <TouchableOpacity onPress={handleViewCustomers}>
                  <Text style={styles.sectionAction}>View All</Text>
                </TouchableOpacity>
              </View>
              
              {customers.length > 0 ? (
                customers.slice(0, 5).map(customer => (
                  <View key={customer.id} style={styles.customerCard}>
                    <View style={styles.customerIcon}>
                      <MaterialIcons name="person" size={32} color="#4CAF50" />
                    </View>
                    <View style={styles.customerInfo}>
                      <Text style={styles.customerName}>{customer.name || 'Customer'}</Text>
                      <Text style={styles.customerEmail}>{customer.email}</Text>
                      <Text style={styles.customerStats}>
                        {customer.orderCount || 0} orders • ${(customer.totalSpent || 0).toFixed(2)} spent
                      </Text>
                    </View>
                    <View style={styles.customerDate}>
                      <Text style={styles.customerLastOrder}>
                        {customer.lastOrderDate 
                          ? new Date(customer.lastOrderDate).toLocaleDateString()
                          : 'No orders'
                        }
                      </Text>
                    </View>
                  </View>
                ))
              ) : (
                <EmptyState 
                  icon="people" 
                  message="No customers yet. Customers will appear here after their first order." 
                />
              )}
            </>
          )}
        </View>
        
        {/* Quick Action Buttons */}
        <View style={styles.quickActions}>
          <TouchableOpacity 
            style={styles.quickActionButton}
            onPress={handleViewInventory}
          >
            <MaterialIcons name="inventory" size={20} color="#216a94" />
            <Text style={styles.quickActionText}>Manage Inventory</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.quickActionButton}
            onPress={handleViewOrders}
          >
            <MaterialIcons name="receipt" size={20} color="#216a94" />
            <Text style={styles.quickActionText}>View Orders</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.quickActionButton}
            onPress={handleViewCustomers}
          >
            <MaterialIcons name="people" size={20} color="#216a94" />
            <Text style={styles.quickActionText}>Customers</Text>
          </TouchableOpacity>
        </View>
        
        {/* Sign Out Button */}
        <TouchableOpacity 
          style={styles.signOutButton}
          onPress={handleSignOut}
        >
          <MaterialIcons name="logout" size={18} color="#666" />
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
        
        {/* Error display */}
        {error && (
          <View style={styles.errorBanner}>
            <MaterialIcons name="error-outline" size={16} color="#f44336" />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity onPress={() => setError(null)}>
              <MaterialIcons name="close" size={16} color="#f44336" />
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  header: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#216a94',
  },
  settingsButton: {
    padding: 6,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  profileCard: {
    backgroundColor: '#fff',
    margin: 16,
    marginBottom: 20,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  logoContainer: {
    marginRight: 16,
  },
  businessLogo: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#eee',
  },
  placeholderLogo: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#f0f8ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  businessInfo: {
    flex: 1,
  },
  businessName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  businessType: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f8ff',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#216a94',
  },
  editButtonText: {
    fontSize: 12,
    color: '#216a94',
    marginLeft: 4,
  },
  description: {
    fontSize: 14,
    color: '#555',
    lineHeight: 20,
    marginBottom: 16,
  },
  contactSection: {
    marginBottom: 12,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
  },
  contactText: {
    fontSize: 14,
    color: '#555',
    marginLeft: 8,
  },
  joinedText: {
    fontSize: 12,
    color: '#888',
    textAlign: 'center',
    marginTop: 8,
  },
  statsContainer: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 4,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  statIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
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
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 8,
    marginHorizontal: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#216a94',
  },
  tabText: {
    fontSize: 14,
    color: '#888',
    marginLeft: 6,
  },
  activeTabText: {
    color: '#216a94',
    fontWeight: '600',
  },
  tabContent: {
    flex: 1,
    marginHorizontal: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  sectionAction: {
    fontSize: 14,
    color: '#216a94',
  },
  productCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 10,
    marginBottom: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  productImageContainer: {
    marginRight: 12,
  },
  productImage: {
    width: 60,
    height: 60,
    borderRadius: 6,
    backgroundColor: '#eee',
  },
  placeholderImage: {
    width: 60,
    height: 60,
    borderRadius: 6,
    backgroundColor: '#f0f9f3',
    justifyContent: 'center',
    alignItems: 'center',
  },
  productInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  productTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  productCategory: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  productPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginTop: 2,
  },
  productQuantity: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 12,
  },
  quantityLabel: {
    fontSize: 12,
    color: '#888',
  },
  quantityValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  lowStockText: {
    color: '#ff9800',
  },
  addButton: {
    backgroundColor: '#216a94',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 8,
    marginBottom: 20,
  },
  addButtonText: {
    color: '#fff',
    fontWeight: '600',
    marginLeft: 8,
  },
  soldItemCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 10,
    marginBottom: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  soldDate: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  soldBuyer: {
    fontSize: 12,
    color: '#4CAF50',
    marginTop: 2,
  },
  soldPriceValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  customerCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 10,
    marginBottom: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  customerIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f0f9f3',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  customerInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  customerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  customerEmail: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  customerStats: {
    fontSize: 12,
    color: '#4CAF50',
    marginTop: 4,
  },
  customerDate: {
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  customerLastOrder: {
    fontSize: 12,
    color: '#888',
  },
  quickActions: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 20,
    marginBottom: 20,
    gap: 12,
  },
  quickActionButton: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  quickActionText: {
    fontSize: 12,
    color: '#216a94',
    marginTop: 4,
    fontWeight: '600',
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    marginTop: 20,
    marginBottom: 40,
  },
  signOutText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffebee',
    margin: 16,
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#f44336',
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    color: '#f44336',
    marginHorizontal: 8,
  },
});

export default BusinessProfileScreen;