// Business/BusinessScreens/BusinessOrdersScreen.js - ENHANCED with Components
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  RefreshControl,
  Alert,
  TextInput,
  Animated,
  Platform,
  Linking,
} from 'react-native';
import { 
  MaterialIcons, 
  MaterialCommunityIcons,
  Ionicons 
} from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { format } from 'date-fns';

// Import Components from memory
import OrderDetailModal from '../components/OrderDetailModal';
import CustomerDetailModal from '../components/CustomerDetailModal';

// Import API services
import { getBusinessOrders, updateOrderStatus, getBusinessCustomers } from '../services/businessOrderApi';

export default function BusinessOrdersScreen({ navigation, route }) {
  const { businessId: routeBusinessId } = route.params || {};
  
  // State variables
  const [orders, setOrders] = useState([]);
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [businessId, setBusinessId] = useState(routeBusinessId);
  const [currentFilter, setCurrentFilter] = useState('all');
  const [currentSort, setCurrentSort] = useState('date-desc');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modal states - ENHANCED with memory components
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [orderDetailModalVisible, setOrderDetailModalVisible] = useState(false);
  const [customerDetailModalVisible, setCustomerDetailModalVisible] = useState(false);
  
  const [summary, setSummary] = useState({});
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const [businessInfo, setBusinessInfo] = useState({});
  
  // Animation refs
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const refreshAnim = useRef(new Animated.Value(0)).current;
  
  // Auto-refresh interval
  const refreshInterval = useRef(null);

  // Initialize business ID and load data
  useEffect(() => {
    const initializeData = async () => {
      try {
        let id = businessId;
        if (!id) {
          const email = await AsyncStorage.getItem('userEmail');
          const storedBusinessId = await AsyncStorage.getItem('businessId');
          id = storedBusinessId || email;
          setBusinessId(id);
        }
        
        // Load business info from storage for modal
        const savedProfile = await AsyncStorage.getItem('businessProfile');
        if (savedProfile) {
          setBusinessInfo(JSON.parse(savedProfile));
        }
        
        if (id) {
          await Promise.all([
            fetchOrders(id),
            loadCustomers(id)
          ]);
          startAutoRefresh();
        }
        
        // Entrance animation
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: Platform.OS !== 'web',
          }),
          Animated.timing(slideAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: Platform.OS !== 'web',
          }),
        ]).start();
        
      } catch (error) {
        console.error('Error initializing:', error);
        Alert.alert('Error', 'Failed to load orders. Please try again.');
      }
    };
    
    initializeData();
    
    return () => {
      stopAutoRefresh();
    };
  }, [businessId]);

  // Auto-refresh when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      if (businessId) {
        fetchOrders(businessId, true); // Silent refresh
        loadCustomers(businessId);
        startAutoRefresh();
      }
      
      return () => {
        stopAutoRefresh();
      };
    }, [businessId])
  );

  // Load customers for modal integration
  const loadCustomers = async (id = businessId) => {
    if (!id) return;
    
    try {
      const customerData = await getBusinessCustomers(id);
      setCustomers(customerData || []);
      console.log(`Loaded ${customerData?.length || 0} customers`);
    } catch (error) {
      console.error('Error loading customers:', error);
    }
  };

  // Auto-refresh functionality
  const startAutoRefresh = () => {
    if (!autoRefreshEnabled) return;
    
    stopAutoRefresh(); // Clear any existing interval
    
    refreshInterval.current = setInterval(() => {
      if (autoRefreshEnabled && businessId && !loading && !refreshing) {
        console.log('Auto-refreshing orders...');
        fetchOrders(businessId, true); // Silent refresh
      }
    }, 30000); // Refresh every 30 seconds
  };

  const stopAutoRefresh = () => {
    if (refreshInterval.current) {
      clearInterval(refreshInterval.current);
      refreshInterval.current = null;
    }
  };

  // Toggle auto-refresh
  const toggleAutoRefresh = () => {
    setAutoRefreshEnabled(!autoRefreshEnabled);
    if (!autoRefreshEnabled) {
      startAutoRefresh();
    } else {
      stopAutoRefresh();
    }
  };

  // Filter and sort orders
  useEffect(() => {
    if (!orders.length) {
      setFilteredOrders([]);
      return;
    }

    let result = [...orders];

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        order => 
          order.customerName?.toLowerCase().includes(query) || 
          order.customerEmail?.toLowerCase().includes(query) ||
          order.confirmationNumber?.toLowerCase().includes(query) ||
          order.id?.toLowerCase().includes(query)
      );
    }

    // Apply status filter
    if (currentFilter !== 'all') {
      result = result.filter(order => order.status === currentFilter);
    }

    // Apply sort
    switch (currentSort) {
      case 'date-asc':
        result.sort((a, b) => new Date(a.orderDate) - new Date(b.orderDate));
        break;
      case 'date-desc':
        result.sort((a, b) => new Date(b.orderDate) - new Date(a.orderDate));
        break;
      case 'price-asc':
        result.sort((a, b) => a.total - b.total);
        break;
      case 'price-desc':
        result.sort((a, b) => b.total - a.total);
        break;
      case 'customer-asc':
        result.sort((a, b) => a.customerName?.localeCompare(b.customerName) || 0);
        break;
    }

    setFilteredOrders(result);
  }, [orders, searchQuery, currentFilter, currentSort]);

  // Fetch orders from API with enhanced error handling
  const fetchOrders = useCallback(async (id = businessId, silent = false) => {
    if (!id) return;
    
    try {
      if (!silent) {
        setLoading(true);
        
        // Refresh animation
        Animated.timing(refreshAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: Platform.OS !== 'web',
        }).start();
      }
      setRefreshing(true);
      
      console.log('Fetching orders for business:', id);
      const response = await getBusinessOrders(id, {
        status: currentFilter === 'all' ? undefined : currentFilter,
        limit: 100
      });
      
      setOrders(response.orders || []);
      setSummary(response.summary || {});
      setLastRefresh(new Date());
      
      console.log(`Loaded ${response.orders?.length || 0} orders`);
      
      // Success animation
      if (!silent) {
        Animated.timing(refreshAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: Platform.OS !== 'web',
        }).start();
      }
      
    } catch (error) {
      console.error('Error fetching orders:', error);
      if (!silent) {
        Alert.alert('Connection Error', 'Failed to load orders. Please check your connection and try again.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [businessId, currentFilter]);

  // Handle pull-to-refresh
  const handleRefresh = useCallback(() => {
    Promise.all([
      fetchOrders(),
      loadCustomers()
    ]);
  }, [fetchOrders]);

  // ENHANCED: Update order status with modal integration
  const handleUpdateOrderStatus = async (orderId, newStatus) => {
    try {
      setLoading(true);
      
      // Optimistic update
      setOrders(prev => prev.map(order => 
        order.id === orderId ? { ...order, status: newStatus } : order
      ));
      
      setSelectedOrder(prev => prev ? { ...prev, status: newStatus } : null);
      
      const response = await updateOrderStatus(orderId, newStatus);
      
      // Success animation
      Animated.sequence([
        Animated.timing(fadeAnim, {
          toValue: 0.7,
          duration: 150,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 150,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]).start();
      
      Alert.alert('✅ Success', `Order status updated to ${newStatus.toUpperCase()}`);
      
      // Refresh to get latest data
      await fetchOrders(businessId, true);
      
    } catch (error) {
      console.error('Error updating order status:', error);
      Alert.alert('Error', 'Failed to update order status. Please try again.');
      
      // Revert optimistic update
      await fetchOrders(businessId, true);
    } finally {
      setLoading(false);
      setOrderDetailModalVisible(false);
    }
  };

  // ENHANCED: Contact customer with modal integration
  const handleContactCustomer = (order, method = 'auto') => {
    if (method === 'auto') {
      const options = [];
      
      if (order.customerPhone) {
        options.push({
          text: '📱 Call Customer',
          onPress: () => Linking.openURL(`tel:${order.customerPhone}`)
        });
        
        options.push({
          text: '💬 Send SMS', 
          onPress: () => {
            const message = `Hi ${order.customerName}, your order ${order.confirmationNumber} is ready for pickup at ${businessInfo.businessName || 'our store'}!`;
            Linking.openURL(`sms:${order.customerPhone}?body=${encodeURIComponent(message)}`);
          }
        });
      }
      
      if (order.customerEmail) {
        options.push({
          text: '📧 Send Email',
          onPress: () => {
            const subject = `Order ${order.confirmationNumber} Update`;
            const body = `Hi ${order.customerName},\n\nYour order is ready for pickup!\n\nOrder: ${order.confirmationNumber}\nTotal: $${order.total.toFixed(2)}\n\nThank you,\n${businessInfo.businessName || 'Your Plant Store'}`;
            Linking.openURL(`mailto:${order.customerEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
          }
        });
      }
      
      if (order.communication?.messagesEnabled) {
        options.push({
          text: '💬 Message in App',
          onPress: () => navigateToMessages(order)
        });
      }
      
      options.push({ text: 'Cancel', style: 'cancel' });
      
      Alert.alert(
        `Contact ${order.customerName}`,
        `Order: ${order.confirmationNumber}`,
        options
      );
    } else {
      // Handle specific contact methods
      switch (method) {
        case 'call':
          if (order.customerPhone) {
            Linking.openURL(`tel:${order.customerPhone}`);
          }
          break;
        case 'sms':
          if (order.customerPhone) {
            const message = `Hi ${order.customerName}, regarding your order ${order.confirmationNumber}...`;
            Linking.openURL(`sms:${order.customerPhone}?body=${encodeURIComponent(message)}`);
          }
          break;
        case 'email':
          if (order.customerEmail) {
            const subject = `Order ${order.confirmationNumber}`;
            Linking.openURL(`mailto:${order.customerEmail}?subject=${encodeURIComponent(subject)}`);
          }
          break;
        case 'message':
          navigateToMessages(order);
          break;
      }
    }
  };

  // Navigate to messages
  const navigateToMessages = (order) => {
    // This would navigate to the existing messaging system
    navigation.navigate('MessagesScreen', {
      recipientId: order.customerEmail,
      recipientName: order.customerName,
      context: {
        type: 'order',
        orderId: order.id,
        confirmationNumber: order.confirmationNumber
      }
    });
  };

  // ENHANCED: View order details using OrderDetailModal
  const handleOrderPress = (order) => {
    setSelectedOrder(order);
    setOrderDetailModalVisible(true);
  };

  // ENHANCED: View customer details using CustomerDetailModal
  const handleCustomerPress = (order) => {
    // Find customer in customers array or create minimal customer object
    let customer = customers.find(c => c.email === order.customerEmail);
    
    if (!customer) {
      customer = {
        id: order.customerEmail,
        email: order.customerEmail,
        name: order.customerName,
        phone: order.customerPhone,
        orders: [order],
        totalSpent: order.total,
        orderCount: 1,
        lastOrderDate: order.orderDate,
        firstPurchaseDate: order.orderDate
      };
    }
    
    setSelectedCustomer(customer);
    setCustomerDetailModalVisible(true);
  };

  // Handle view all orders for customer
  const handleViewCustomerOrders = (customer) => {
    setCustomerDetailModalVisible(false);
    setCurrentFilter('all');
    setSearchQuery(customer.email);
  };

  // Handle add customer note
  const handleAddCustomerNote = (customer) => {
    Alert.alert(
      'Add Customer Note',
      'This feature will be available soon',
      [{ text: 'OK' }]
    );
  };

  // Print receipt functionality
  const handlePrintReceipt = (order) => {
    Alert.alert(
      'Print Receipt',
      'Receipt printing will be available soon',
      [{ text: 'OK' }]
    );
  };

  // Quick actions for orders
  const getQuickActions = (order) => {
    const actions = [];
    
    switch (order.status) {
      case 'pending':
        actions.push({
          label: 'Confirm',
          icon: 'check',
          color: '#2196F3',
          action: () => handleUpdateOrderStatus(order.id, 'confirmed')
        });
        break;
      case 'confirmed':
        actions.push({
          label: 'Ready',
          icon: 'shopping-bag',
          color: '#9C27B0',
          action: () => handleUpdateOrderStatus(order.id, 'ready')
        });
        break;
      case 'ready':
        actions.push({
          label: 'Complete',
          icon: 'check-circle',
          color: '#4CAF50',
          action: () => handleUpdateOrderStatus(order.id, 'completed')
        });
        break;
    }
    
    return actions;
  };

  // Get status color
  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return '#FFA000';
      case 'confirmed': return '#2196F3';
      case 'ready': return '#9C27B0';
      case 'completed': return '#4CAF50';
      case 'cancelled': return '#F44336';
      default: return '#757575';
    }
  };

  // Get status icon
  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending': return 'hourglass-empty';
      case 'confirmed': return 'check-circle-outline';
      case 'ready': return 'shopping-bag';
      case 'completed': return 'check-circle';
      case 'cancelled': return 'cancel';
      default: return 'help-outline';
    }
  };

  // Format date with better handling
  const formatDate = (dateString) => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffHours = (now - date) / (1000 * 60 * 60);
      
      if (diffHours < 24) {
        return format(date, 'h:mm a');
      } else if (diffHours < 48) {
        return 'Yesterday ' + format(date, 'h:mm a');
      } else {
        return format(date, 'MMM dd, h:mm a');
      }
    } catch (error) {
      return dateString;
    }
  };

  // Get priority badge
  const getPriorityInfo = (order) => {
    const hoursOld = (new Date() - new Date(order.orderDate)) / (1000 * 60 * 60);
    const isHighValue = order.total > 100;
    const isUrgent = hoursOld > 24 && order.status === 'pending';
    
    if (isUrgent) return { color: '#F44336', text: 'URGENT', icon: 'priority-high' };
    if (isHighValue) return { color: '#FF9800', text: 'HIGH VALUE', icon: 'star' };
    return null;
  };

  // ENHANCED: Render order item with better design and quick actions
  const renderOrderItem = ({ item, index }) => {
    const priority = getPriorityInfo(item);
    const quickActions = getQuickActions(item);
    
    return (
      <Animated.View
        style={[
          styles.orderCard,
          {
            opacity: fadeAnim,
            transform: [{
              translateY: slideAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [50, 0],
              }),
            }],
          }
        ]}
      >
        <TouchableOpacity 
          style={styles.orderCardContent}
          onPress={() => handleOrderPress(item)}
          activeOpacity={0.7}
        >
          {/* Priority Badge */}
          {priority && (
            <View style={[styles.priorityBadge, { backgroundColor: priority.color }]}>
              <MaterialIcons name={priority.icon} size={12} color="#fff" />
              <Text style={styles.priorityText}>{priority.text}</Text>
            </View>
          )}
          
          {/* Order Header */}
          <View style={styles.orderHeader}>
            <View style={styles.orderIdContainer}>
              <Text style={styles.orderId}>#{item.confirmationNumber}</Text>
              <Text style={styles.orderDate}>{formatDate(item.orderDate)}</Text>
            </View>
            
            <View style={[
              styles.statusBadge, 
              { backgroundColor: getStatusColor(item.status) }
            ]}>
              <MaterialIcons name={getStatusIcon(item.status)} size={14} color="#fff" />
              <Text style={styles.statusText}>
                {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
              </Text>
            </View>
          </View>
          
          {/* Customer Info with Press Handler */}
          <TouchableOpacity 
            style={styles.customerSection}
            onPress={() => handleCustomerPress(item)}
          >
            <View style={styles.customerInfo}>
              <MaterialIcons name="person" size={16} color="#757575" />
              <Text style={styles.customerName}>{item.customerName}</Text>
              <MaterialIcons name="arrow-forward-ios" size={12} color="#ccc" />
            </View>
            <TouchableOpacity 
              style={styles.contactButton}
              onPress={(e) => {
                e.stopPropagation();
                handleContactCustomer(item);
              }}
            >
              <MaterialIcons name="phone" size={16} color="#4CAF50" />
            </TouchableOpacity>
          </TouchableOpacity>
          
          {/* Order Items Preview */}
          <View style={styles.orderItemsPreview}>
            <Text style={styles.itemsHeader}>
              {item.totalQuantity || item.items?.reduce((sum, i) => sum + (i.quantity || 0), 0)} items
            </Text>
            <View style={styles.itemsList}>
              {item.items?.slice(0, 2).map((orderItem, idx) => (
                <Text key={idx} style={styles.itemPreview} numberOfLines={1}>
                  {orderItem.quantity}x {orderItem.name}
                </Text>
              ))}
              {item.items?.length > 2 && (
                <Text style={styles.moreItems}>
                  +{item.items.length - 2} more...
                </Text>
              )}
            </View>
          </View>
          
          {/* Order Footer with Quick Actions */}
          <View style={styles.orderFooter}>
            <View style={styles.orderActions}>
              {quickActions.map((action, idx) => (
                <TouchableOpacity 
                  key={idx}
                  style={[styles.actionButton, { backgroundColor: action.color }]}
                  onPress={(e) => {
                    e.stopPropagation();
                    action.action();
                  }}
                >
                  <MaterialIcons name={action.icon} size={16} color="#fff" />
                  <Text style={styles.actionButtonText}>{action.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            
            <Text style={styles.orderTotal}>${item.total?.toFixed(2)}</Text>
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  // Render filter options
  const renderFilterOptions = () => (
    <View style={styles.filterContainer}>
      <Text style={styles.filterTitle}>Filter Orders</Text>
      <View style={styles.filterOptions}>
        {[
          { key: 'all', label: 'All', count: orders.length },
          { key: 'pending', label: 'Pending', count: summary.pendingCount || 0 },
          { key: 'confirmed', label: 'Confirmed', count: summary.statusCounts?.confirmed || 0 },
          { key: 'ready', label: 'Ready', count: summary.readyCount || 0 },
          { key: 'completed', label: 'Completed', count: summary.completedCount || 0 }
        ].map((filter) => (
          <TouchableOpacity
            key={filter.key}
            style={[
              styles.filterOption,
              currentFilter === filter.key && styles.filterOptionActive,
              { backgroundColor: currentFilter === filter.key ? getStatusColor(filter.key) : '#f5f5f5' }
            ]}
            onPress={() => setCurrentFilter(filter.key)}
          >
            <Text style={[
              styles.filterOptionText,
              currentFilter === filter.key && styles.filterOptionTextActive
            ]}>
              {filter.label}
            </Text>
            <Text style={[
              styles.filterCount,
              currentFilter === filter.key && styles.filterCountActive
            ]}>
              {filter.count}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  if (loading && orders.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text style={styles.loadingText}>Loading orders...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Enhanced Header */}
      <Animated.View style={[styles.header, { opacity: fadeAnim }]}>
        <View style={styles.headerTop}>
          <TouchableOpacity 
            onPress={() => navigation.goBack()}
            style={styles.headerButton}
          >
            <MaterialIcons name="arrow-back" size={24} color="#4CAF50" />
          </TouchableOpacity>
          
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Orders</Text>
            <Text style={styles.headerSubtitle}>
              {filteredOrders.length} orders • Last updated {formatDate(lastRefresh.toISOString())}
            </Text>
          </View>
          
          <View style={styles.headerActions}>
            <TouchableOpacity 
              style={styles.headerButton}
              onPress={toggleAutoRefresh}
            >
              <MaterialIcons 
                name={autoRefreshEnabled ? "sync" : "sync-disabled"} 
                size={24} 
                color={autoRefreshEnabled ? "#4CAF50" : "#999"} 
              />
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.headerButton}
              onPress={() => navigation.navigate('CreateOrderScreen', { businessId })}
            >
              <MaterialIcons name="add" size={24} color="#4CAF50" />
            </TouchableOpacity>
          </View>
        </View>
        
        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <MaterialIcons name="search" size={20} color="#4CAF50" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search orders, customers, confirmation numbers..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#999"
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <MaterialIcons name="clear" size={20} color="#999" />
            </TouchableOpacity>
          ) : null}
        </View>
      </Animated.View>
      
      {/* Filter Options */}
      {renderFilterOptions()}
      
      {/* Orders List */}
      <FlatList
        data={filteredOrders}
        renderItem={renderOrderItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={['#4CAF50']}
            tintColor="#4CAF50"
          />
        }
        ListEmptyComponent={
          <Animated.View style={[styles.emptyContainer, { opacity: fadeAnim }]}>
            <MaterialCommunityIcons name="clipboard-list-outline" size={64} color="#e0e0e0" />
            <Text style={styles.emptyText}>
              {searchQuery || currentFilter !== 'all'
                ? "No orders match your filters"
                : "No orders yet"}
            </Text>
            <Text style={styles.emptySubtext}>
              {searchQuery || currentFilter !== 'all'
                ? "Try adjusting your search or filters"
                : "Orders will appear here when customers place them"}
            </Text>
            {(searchQuery || currentFilter !== 'all') && (
              <TouchableOpacity
                style={styles.resetFiltersButton}
                onPress={() => {
                  setCurrentFilter('all');
                  setSearchQuery('');
                }}
              >
                <Text style={styles.resetFiltersText}>Reset Filters</Text>
              </TouchableOpacity>
            )}
          </Animated.View>
        }
        showsVerticalScrollIndicator={false}
      />

      {/* ENHANCED: Order Detail Modal Integration */}
      <OrderDetailModal
        visible={orderDetailModalVisible}
        order={selectedOrder}
        onClose={() => setOrderDetailModalVisible(false)}
        onUpdateStatus={handleUpdateOrderStatus}
        onContactCustomer={handleContactCustomer}
        onPrintReceipt={handlePrintReceipt}
        businessInfo={businessInfo}
      />

      {/* ENHANCED: Customer Detail Modal Integration */}
      <CustomerDetailModal
        visible={customerDetailModalVisible}
        customer={selectedCustomer}
        onClose={() => setCustomerDetailModalVisible(false)}
        onContactCustomer={(customer, method) => {
          // Find the customer's latest order for contact context
          const latestOrder = orders
            .filter(order => order.customerEmail === customer.email)
            .sort((a, b) => new Date(b.orderDate) - new Date(a.orderDate))[0];
          
          if (latestOrder) {
            handleContactCustomer(latestOrder, method);
          }
        }}
        onViewOrders={handleViewCustomerOrders}
        onAddNote={handleAddCustomerNote}
        businessId={businessId}
      />
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
  header: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
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
    fontSize: 20,
    fontWeight: 'bold',
    color: '#4CAF50',
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
    color: '#333',
  },
  filterContainer: {
    backgroundColor: '#fff',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  filterTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  filterOptions: {
    flexDirection: 'row',
    gap: 8,
  },
  filterOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: '#f5f5f5',
  },
  filterOptionActive: {
    backgroundColor: '#4CAF50',
  },
  filterOptionText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  filterOptionTextActive: {
    color: '#fff',
  },
  filterCount: {
    fontSize: 11,
    color: '#999',
    marginLeft: 4,
  },
  filterCountActive: {
    color: '#fff',
  },
  listContainer: {
    padding: 16,
    paddingBottom: 100,
  },
  orderCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    overflow: 'hidden',
  },
  orderCardContent: {
    padding: 16,
  },
  priorityBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderBottomLeftRadius: 8,
  },
  priorityText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
    marginLeft: 2,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  orderIdContainer: {
    flex: 1,
  },
  orderId: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  orderDate: {
    fontSize: 12,
    color: '#757575',
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: '#fff',
    fontWeight: '500',
    fontSize: 12,
    marginLeft: 4,
  },
  customerSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#f9f9f9',
    paddingHorizontal: 8,
  },
  customerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  customerName: {
    color: '#424242',
    fontSize: 14,
    marginLeft: 8,
    marginRight: 8,
    fontWeight: '500',
    flex: 1,
  },
  contactButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#f0f9f3',
  },
  orderItemsPreview: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  itemsHeader: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
  },
  itemsList: {
    gap: 2,
  },
  itemPreview: {
    fontSize: 13,
    color: '#424242',
  },
  moreItems: {
    color: '#757575',
    fontSize: 12,
    fontStyle: 'italic',
  },
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  orderTotal: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
  resetFiltersButton: {
    marginTop: 24,
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 24,
  },
  resetFiltersText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
});
