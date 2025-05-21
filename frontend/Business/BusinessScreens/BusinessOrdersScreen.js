// Business/BusinessScreens/BusinessOrdersScreen.js - Enhanced Version
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
  Image,
  Alert,
  Modal,
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

// Import API services
import { getBusinessOrders, updateOrderStatus } from '../services/businessOrderApi';

export default function BusinessOrdersScreen({ navigation, route }) {
  const { businessId: routeBusinessId } = route.params || {};
  
  // State variables
  const [orders, setOrders] = useState([]);
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [businessId, setBusinessId] = useState(routeBusinessId);
  const [currentFilter, setCurrentFilter] = useState('all');
  const [currentSort, setCurrentSort] = useState('date-desc');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [updateStatusModalVisible, setUpdateStatusModalVisible] = useState(false);
  const [noteModalVisible, setNoteModalVisible] = useState(false);
  const [orderNote, setOrderNote] = useState('');
  const [summary, setSummary] = useState({});
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  
  // Animation refs
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const refreshAnim = useRef(new Animated.Value(0)).current;
  
  // Auto-refresh interval
  const refreshInterval = useRef(null);

  // Initialize business ID
  useEffect(() => {
    const initializeBusinessId = async () => {
      try {
        let id = businessId;
        if (!id) {
          const email = await AsyncStorage.getItem('userEmail');
          const storedBusinessId = await AsyncStorage.getItem('businessId');
          id = storedBusinessId || email;
          setBusinessId(id);
        }
        
        if (id) {
          await fetchOrders(id);
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
    
    initializeBusinessId();
    
    return () => {
      stopAutoRefresh();
    };
  }, [businessId]);

  // Auto-refresh when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      if (businessId) {
        fetchOrders(businessId, true); // Silent refresh
        startAutoRefresh();
      }
      
      return () => {
        stopAutoRefresh();
      };
    }, [businessId])
  );

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
    fetchOrders();
  }, [fetchOrders]);

  // Update order status with animation
  const updateOrderStatusWithAnimation = async (orderId, newStatus) => {
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
      setUpdateStatusModalVisible(false);
    }
  };

  // Contact customer
  const contactCustomer = (order) => {
    const options = [];
    
    if (order.customerPhone) {
      options.push({
        text: '📱 Call Customer',
        onPress: () => Linking.openURL(`tel:${order.customerPhone}`)
      });
      
      options.push({
        text: '💬 Send SMS', 
        onPress: () => Linking.openURL(`sms:${order.customerPhone}?body=Hi ${order.customerName}, your order ${order.confirmationNumber} is ready for pickup!`)
      });
    }
    
    options.push({
      text: '📧 Send Email',
      onPress: () => Linking.openURL(`mailto:${order.customerEmail}?subject=Order ${order.confirmationNumber}&body=Hi ${order.customerName}, regarding your order...`)
    });
    
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

  // View order details
  const viewOrderDetails = (order) => {
    setSelectedOrder(order);
    setDetailModalVisible(true);
  };

  // Show update status modal
  const showUpdateStatusModal = () => {
    setDetailModalVisible(false);
    setUpdateStatusModalVisible(true);
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

  // Render order item with enhanced design
  const renderOrderItem = ({ item, index }) => {
    const priority = getPriorityInfo(item);
    
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
          onPress={() => viewOrderDetails(item)}
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
          
          {/* Customer Info */}
          <View style={styles.customerSection}>
            <View style={styles.customerInfo}>
              <MaterialIcons name="person" size={16} color="#757575" />
              <Text style={styles.customerName}>{item.customerName}</Text>
            </View>
            {item.customerPhone && (
              <TouchableOpacity 
                style={styles.contactButton}
                onPress={() => contactCustomer(item)}
              >
                <MaterialIcons name="phone" size={16} color="#4CAF50" />
              </TouchableOpacity>
            )}
          </View>
          
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
          
          {/* Order Footer */}
          <View style={styles.orderFooter}>
            <View style={styles.orderActions}>
              {item.status === 'pending' && (
                <TouchableOpacity 
                  style={[styles.actionButton, styles.confirmButton]}
                  onPress={() => updateOrderStatusWithAnimation(item.id, 'confirmed')}
                >
                  <MaterialIcons name="check" size={16} color="#fff" />
                  <Text style={styles.actionButtonText}>Confirm</Text>
                </TouchableOpacity>
              )}
              
              {item.status === 'confirmed' && (
                <TouchableOpacity 
                  style={[styles.actionButton, styles.readyButton]}
                  onPress={() => updateOrderStatusWithAnimation(item.id, 'ready')}
                >
                  <MaterialIcons name="shopping-bag" size={16} color="#fff" />
                  <Text style={styles.actionButtonText}>Ready</Text>
                </TouchableOpacity>
              )}
              
              {item.status === 'ready' && (
                <TouchableOpacity 
                  style={[styles.actionButton, styles.completeButton]}
                  onPress={() => updateOrderStatusWithAnimation(item.id, 'completed')}
                >
                  <MaterialIcons name="check-circle" size={16} color="#fff" />
                  <Text style={styles.actionButtonText}>Complete</Text>
                </TouchableOpacity>
              )}
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
    fontWeight: '500',
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
  confirmButton: {
    backgroundColor: '#2196F3',
  },
  readyButton: {
    backgroundColor: '#9C27B0',
  },
  completeButton: {
    backgroundColor: '#4CAF50',
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
