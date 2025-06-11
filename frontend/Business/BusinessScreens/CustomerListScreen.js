// Business/BusinessScreens/CustomerListScreen.js - ANDROID OPTIMIZED & REAL BACKEND
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Animated,
  Platform,
  Dimensions,
  StatusBar,
  Linking,
  BackHandler,
} from 'react-native';
import { 
  MaterialCommunityIcons, 
  MaterialIcons 
} from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';

// Import REAL Components - NO MOCK DATA
import CustomerList from '../components/CustomerList';
import CustomerSearchBar from '../components/CustomerSearchBar';
import CustomerDetailModal from '../components/CustomerDetailModal';
import KPIWidget from '../components/KPIWidget';

// Import REAL API services - NO MOCK DATA  
import { 
  getBusinessCustomers,
  checkApiHealth 
} from '../services/businessApi';
import { 
  getBusinessOrders,
  createOrUpdateCustomer 
} from '../services/businessOrderApi';

const { width, height } = Dimensions.get('window');

export default function CustomerListScreen({ navigation, route }) {
  // ===== STATE MANAGEMENT - ANDROID OPTIMIZED =====
  const [customers, setCustomers] = useState([]);
  const [filteredCustomers, setFilteredCustomers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [businessId, setBusinessId] = useState(null);
  const [userEmail, setUserEmail] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [customerStats, setCustomerStats] = useState(null);
  const [networkConnected, setNetworkConnected] = useState(true);
  const [lastRefreshTime, setLastRefreshTime] = useState(null);
  
  // ===== ANIMATION REFS - ANDROID OPTIMIZED =====
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const refreshAnim = useRef(new Animated.Value(0)).current;
  
  // ===== AUTO-REFRESH TIMER =====
  const refreshTimer = useRef(null);
  const autoRefreshInterval = 45000; // 45 seconds for customers

  // ===== ANDROID BACK HANDLER =====
  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        navigation.goBack();
        return true;
      };

      BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => BackHandler.removeEventListener('hardwareBackPress', onBackPress);
    }, [navigation])
  );

  // ===== FOCUS EFFECT FOR AUTO-REFRESH =====
  useFocusEffect(
    useCallback(() => {
      console.log('👥 CustomerListScreen focused - loading customers...');
      initializeScreen();
      setupAutoRefresh();
      startEntranceAnimation();
      
      return () => {
        console.log('👥 CustomerListScreen unfocused - cleanup...');
        if (refreshTimer.current) {
          clearInterval(refreshTimer.current);
        }
      };
    }, [])
  );

  // ===== ENTRANCE ANIMATIONS - ANDROID OPTIMIZED =====
  const startEntranceAnimation = useCallback(() => {
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
  }, []);

  // ===== INITIALIZE SCREEN =====
  const initializeScreen = useCallback(async () => {
    try {
      console.log('📱 Initializing customer list screen...');
      
      // Get business info
      const [email, storedBusinessId] = await Promise.all([
        AsyncStorage.getItem('userEmail'),
        AsyncStorage.getItem('businessId')
      ]);
      
      console.log('📊 Business data loaded:', { email, storedBusinessId });
      
      if (!email) {
        console.warn('⚠️ No user email found');
        navigation.replace('Login');
        return;
      }
      
      setUserEmail(email);
      const currentBusinessId = route.params?.businessId || storedBusinessId || email;
      setBusinessId(currentBusinessId);
      
      // Load customers
      await loadCustomers(currentBusinessId);
      
    } catch (error) {
      console.error('❌ Error initializing customer screen:', error);
      setError('Failed to initialize customer data');
    }
  }, [route.params]);

  // ===== AUTO-REFRESH SETUP =====
  const setupAutoRefresh = useCallback(() => {
    if (refreshTimer.current) {
      clearInterval(refreshTimer.current);
    }
    
    refreshTimer.current = setInterval(() => {
      if (!refreshing && networkConnected && businessId) {
        console.log('🔄 Auto-refreshing customer data...');
        loadCustomers(businessId, true); // Silent refresh
      }
    }, autoRefreshInterval);
    
    console.log(`⏰ Customer auto-refresh set up for every ${autoRefreshInterval/1000} seconds`);
  }, [refreshing, networkConnected, businessId]);

  // ===== LOAD CUSTOMERS - REAL BACKEND ONLY =====
  const loadCustomers = useCallback(async (currentBusinessId, silentRefresh = false) => {
    if (!currentBusinessId) {
      console.log('⏳ Business ID not ready yet...');
      return;
    }
    
    if (refreshing && !silentRefresh) return; // Prevent duplicate calls
    
    if (!silentRefresh) {
      setIsLoading(!customers.length); // Only show loading on first load
      setRefreshing(true);
    }
    setError(null);
    
    try {
      console.log('📡 Loading REAL customers for business:', currentBusinessId);
      
      // Check API health first
      const healthCheck = await checkApiHealth();
      if (!healthCheck.healthy) {
        throw new Error('Customer services are currently unavailable');
      }
      setNetworkConnected(true);
      
      // Load REAL customer data from backend
      const customerData = await getBusinessCustomers(currentBusinessId);
      console.log('✅ REAL Customer data loaded:', customerData.length, 'customers');
      
      // Calculate customer statistics
      const stats = calculateCustomerStats(customerData);
      setCustomerStats(stats);
      
      setCustomers(customerData);
      setFilteredCustomers(filterCustomers(customerData, searchQuery, selectedFilter));
      setLastRefreshTime(new Date());
      
      // Success feedback animation
      if (!silentRefresh) {
        Animated.sequence([
          Animated.timing(refreshAnim, {
            toValue: 1,
            duration: 200,
            useNativeDriver: Platform.OS !== 'web',
          }),
          Animated.timing(refreshAnim, {
            toValue: 0,
            duration: 200,
            useNativeDriver: Platform.OS !== 'web',
          }),
        ]).start();
      }
      
    } catch (err) {
      console.error('❌ Error loading REAL customer data:', err);
      setNetworkConnected(false);
      
      const errorMessage = err.message.includes('network') || err.message.includes('fetch') 
        ? 'Network connection failed. Please check your internet connection.'
        : err.message.includes('401') || err.message.includes('403')
        ? 'Authentication failed. Please log in again.'
        : err.message || 'Unable to load customer data';
      
      setError(errorMessage);
      
      // If first load fails, show empty array
      if (!customers.length && !silentRefresh) {
        setCustomers([]);
        setFilteredCustomers([]);
        setCustomerStats(null);
      }
      
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [businessId, refreshing, customers.length, searchQuery, selectedFilter]);

  // ===== CALCULATE CUSTOMER STATISTICS =====
  const calculateCustomerStats = useCallback((customerData) => {
    if (!customerData.length) return null;
    
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    
    const stats = {
      totalCustomers: customerData.length,
      newCustomers: customerData.filter(c => 
        c.firstPurchaseDate && new Date(c.firstPurchaseDate) >= thirtyDaysAgo
      ).length,
      regularCustomers: customerData.filter(c => (c.orderCount || 0) >= 3).length,
      vipCustomers: customerData.filter(c => (c.totalSpent || 0) >= 200).length,
      inactiveCustomers: customerData.filter(c => 
        !c.lastOrderDate || new Date(c.lastOrderDate) < ninetyDaysAgo
      ).length,
      totalRevenue: customerData.reduce((sum, c) => sum + (c.totalSpent || 0), 0),
      averageOrderValue: customerData.length > 0 ? 
        customerData.reduce((sum, c) => sum + (c.totalSpent || 0), 0) / 
        customerData.reduce((sum, c) => sum + (c.orderCount || 0), 0) : 0,
      topCustomer: customerData.reduce((top, c) => 
        (c.totalSpent || 0) > (top.totalSpent || 0) ? c : top, customerData[0] || {}
      )
    };
    
    console.log('📊 Customer statistics calculated:', stats);
    return stats;
  }, []);

  // ===== FILTER CUSTOMERS =====
  const filterCustomers = useCallback((customerData, query, filter) => {
    let filtered = [...customerData];
    
    // Search filter
    if (query) {
      const searchLower = query.toLowerCase();
      filtered = filtered.filter(customer => 
        (customer.name || '').toLowerCase().includes(searchLower) ||
        (customer.email || '').toLowerCase().includes(searchLower) ||
        (customer.phone || '').includes(query)
      );
    }
    
    // Category filter
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    
    switch (filter) {
      case 'recent':
        filtered = filtered.filter(c => 
          c.firstPurchaseDate && new Date(c.firstPurchaseDate) >= thirtyDaysAgo
        );
        break;
      case 'regular':
        filtered = filtered.filter(c => (c.orderCount || 0) >= 3);
        break;
      case 'vip':
        filtered = filtered.filter(c => (c.totalSpent || 0) >= 200);
        break;
      case 'inactive':
        filtered = filtered.filter(c => 
          !c.lastOrderDate || new Date(c.lastOrderDate) < ninetyDaysAgo
        );
        break;
      default:
        // 'all' - no additional filtering
        break;
    }
    
    return filtered;
  }, []);

  // ===== HANDLE SEARCH =====
  const handleSearch = useCallback((query) => {
    setSearchQuery(query);
    setFilteredCustomers(filterCustomers(customers, query, selectedFilter));
  }, [customers, selectedFilter, filterCustomers]);

  // ===== HANDLE FILTER CHANGE =====
  const handleFilterChange = useCallback((filter) => {
    setSelectedFilter(filter);
    setFilteredCustomers(filterCustomers(customers, searchQuery, filter));
  }, [customers, searchQuery, filterCustomers]);

  // ===== REFRESH HANDLER =====
  const onRefresh = useCallback(() => {
    console.log('🔄 Manual refresh triggered...');
    if (businessId) {
      loadCustomers(businessId);
    }
  }, [businessId, loadCustomers]);

  // ===== CUSTOMER INTERACTION HANDLERS =====
  const handleCustomerPress = useCallback((customer) => {
    console.log('👤 Customer pressed:', customer.id);
    setSelectedCustomer(customer);
    setDetailModalVisible(true);
  }, []);

  const handleContactCustomer = useCallback((customer, method = 'auto') => {
    console.log('📞 Contacting customer:', customer.id, 'via', method);
    
    switch (method) {
      case 'call':
        if (customer.phone) {
          Linking.openURL(`tel:${customer.phone}`);
        } else {
          Alert.alert('No Phone', 'Customer phone number not available');
        }
        break;
        
      case 'sms':
        if (customer.phone) {
          const message = `Hi ${customer.name}, thank you for being a valued customer!`;
          Linking.openURL(`sms:${customer.phone}?body=${encodeURIComponent(message)}`);
        } else {
          Alert.alert('No Phone', 'Customer phone number not available');
        }
        break;
        
      case 'email':
        if (customer.email) {
          const subject = 'Thank you for your business!';
          const body = `Hi ${customer.name},\n\nThank you for being a valued customer.\n\nBest regards,\nYour Plant Store Team`;
          Linking.openURL(`mailto:${customer.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
        } else {
          Alert.alert('No Email', 'Customer email not available');
        }
        break;
        
      case 'message':
      case 'auto':
      default:
        // Navigate to marketplace messaging system
        Alert.alert(
          'Contact Customer',
          'Open marketplace messaging to chat with this customer?',
          [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: 'Open Chat', 
              onPress: () => {
                // Navigate to marketplace messaging with customer
                navigation.navigate('MainTabs', {
                  screen: 'MessagesTab',
                  params: {
                    screen: 'ConversationScreen',
                    params: {
                      recipientId: customer.id,
                      recipientName: customer.name,
                      recipientEmail: customer.email
                    }
                  }
                });
              }
            }
          ]
        );
        break;
    }
  }, [navigation]);

  const handleViewOrders = useCallback((customer) => {
    console.log('📋 Viewing orders for customer:', customer.id);
    navigation.navigate('BusinessOrdersScreen', { 
      businessId,
      customerId: customer.id,
      customerName: customer.name
    });
  }, [businessId, navigation]);

  const handleAddNote = useCallback((customer) => {
    console.log('📝 Adding note for customer:', customer.id);
    Alert.alert(
      'Add Customer Note',
      'Customer notes feature coming soon!',
      [{ text: 'OK' }]
    );
  }, []);

  // ===== LOADING STATE - ANDROID OPTIMIZED =====
  if (isLoading && !customers.length) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar backgroundColor="#f5f7fa" barStyle="dark-content" />
        <View style={styles.loadingContainer}>
          <Animated.View style={{ transform: [{ rotate: refreshAnim.interpolate({
            inputRange: [0, 1],
            outputRange: ['0deg', '360deg'],
          }) }] }}>
            <MaterialCommunityIcons name="account-group" size={60} color="#4CAF50" />
          </Animated.View>
          <Text style={styles.loadingText}>Loading your customers...</Text>
          <Text style={styles.loadingSubtext}>Getting customer data from marketplace</Text>
        </View>
      </SafeAreaView>
    );
  }
  
  // ===== ERROR STATE - ANDROID OPTIMIZED =====
  if (error && !customers.length) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar backgroundColor="#f5f7fa" barStyle="dark-content" />
        <View style={styles.errorContainer}>
          <MaterialIcons name="cloud-off" size={48} color="#f44336" />
          <Text style={styles.errorTitle}>Connection Failed</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => loadCustomers(businessId)}>
            <MaterialIcons name="refresh" size={20} color="#fff" />
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
          {!networkConnected && (
            <Text style={styles.offlineText}>
              You appear to be offline. Please check your internet connection.
            </Text>
          )}
        </View>
      </SafeAreaView>
    );
  }

  // ===== MAIN RENDER - REAL DATA ONLY =====
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar backgroundColor="#fff" barStyle="dark-content" />
      
      {/* ===== HEADER ===== */}
      <Animated.View 
        style={[
          styles.header,
          { 
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }] 
          }
        ]}
      >
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <MaterialIcons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Customers</Text>
          <Text style={styles.headerSubtitle}>
            {customers.length} total customers
            {lastRefreshTime && ` • Updated ${lastRefreshTime.toLocaleTimeString()}`}
          </Text>
        </View>
        
        <View style={styles.headerActions}>
          {refreshing && (
            <Animated.View style={[styles.headerButton, { opacity: refreshAnim }]}>
              <MaterialIcons name="sync" size={20} color="#4CAF50" />
            </Animated.View>
          )}
          <TouchableOpacity 
            style={styles.headerButton} 
            onPress={() => Alert.alert('Export', 'Customer export coming soon!')}
          >
            <MaterialIcons name="file-download" size={20} color="#4CAF50" />
          </TouchableOpacity>
        </View>
      </Animated.View>
      
      {/* ===== NETWORK STATUS INDICATOR ===== */}
      {!networkConnected && (
        <View style={styles.networkBanner}>
          <MaterialIcons name="cloud-off" size={16} color="#fff" />
          <Text style={styles.networkBannerText}>Offline - Data may be outdated</Text>
        </View>
      )}

      {/* ===== CUSTOMER STATISTICS - REAL DATA ===== */}
      {customerStats && (
        <Animated.View 
          style={[
            styles.statsContainer,
            { 
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }] 
            }
          ]}
        >
          <KPIWidget
            title="Total"
            value={customerStats.totalCustomers}
            icon="account-group"
            color="#4CAF50"
            autoRefresh={true}
          />
          
          <KPIWidget
            title="New (30d)"
            value={customerStats.newCustomers}
            icon="account-plus"
            color="#2196F3"
            autoRefresh={true}
          />
          
          <KPIWidget
            title="VIP"
            value={customerStats.vipCustomers}
            icon="star"
            color="#9C27B0"
            subtitle="$200+ spent"
            autoRefresh={true}
          />
          
          <KPIWidget
            title="Revenue"
            value={customerStats.totalRevenue}
            format="currency"
            icon="cash"
            color="#FF5722"
            autoRefresh={true}
          />
        </Animated.View>
      )}

      {/* ===== CUSTOMER LIST - REAL DATA ===== */}
      <Animated.View 
        style={[
          styles.listContainer,
          { opacity: fadeAnim }
        ]}
      >
        <CustomerList
          customers={filteredCustomers}
          isLoading={isLoading}
          refreshing={refreshing}
          onRefresh={onRefresh}
          onCustomerPress={handleCustomerPress}
          onContactCustomer={handleContactCustomer}
          onViewOrders={handleViewOrders}
          businessId={businessId}
          searchQuery={searchQuery}
          onSearchChange={handleSearch}
          selectedFilter={selectedFilter}
          onFilterChange={handleFilterChange}
        />
      </Animated.View>

      {/* ===== CUSTOMER DETAIL MODAL - REAL DATA ===== */}
      <CustomerDetailModal
        visible={detailModalVisible}
        customer={selectedCustomer}
        onClose={() => {
          setDetailModalVisible(false);
          setSelectedCustomer(null);
        }}
        onContactCustomer={handleContactCustomer}
        onViewOrders={handleViewOrders}
        onAddNote={handleAddNote}
        businessId={businessId}
      />
    </SafeAreaView>
  );
}

// ===== ANDROID OPTIMIZED STYLES =====
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f5f7fa',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  loadingText: {
    marginTop: 20,
    color: '#333',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  loadingSubtext: {
    marginTop: 8,
    color: '#666',
    fontSize: 14,
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#f44336',
    marginTop: 16,
    marginBottom: 8,
  },
  errorText: {
    color: '#666',
    textAlign: 'center',
    fontSize: 14,
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
    marginBottom: 16,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '600',
    marginLeft: 8,
  },
  offlineText: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  header: {
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
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
    marginRight: 8,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  headerButton: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: '#f0f9f3',
  },
  networkBanner: {
    backgroundColor: '#f44336',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  networkBannerText: {
    color: '#fff',
    fontSize: 12,
    marginLeft: 6,
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  listContainer: {
    flex: 1,
  },
});