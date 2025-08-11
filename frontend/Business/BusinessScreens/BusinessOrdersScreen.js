// Business/BusinessScreens/BusinessOrdersScreen.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  Alert,
  ActivityIndicator,
  StatusBar,
  ScrollView,
} from 'react-native';
import BusinessLayout from '../components/BusinessLayout';
import { MaterialIcons } from '@expo/vector-icons';
import { getBusinessOrders, updateOrderStatus } from '../services/businessApi'; // Fixed: Corrected import path from api to services
import OrderDetailModal from '../components/OrderDetailModal';
import * as Linking from 'expo-linking';

export default function BusinessOrdersScreen({ navigation, route }) {
  const { businessId } = route.params || {};
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all');

  // NEW: Modal state
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  useEffect(() => {
    loadOrders();
  }, []);

  useEffect(() => {
    // Filter orders based on search query and status
    let filtered = orders;

    if (statusFilter !== 'all') {
      filtered = filtered.filter(order => order.status === statusFilter);
    }

    if (searchQuery.trim()) {
      filtered = filtered.filter(order =>
        order.orderId?.toString().includes(searchQuery) ||
        order.customerName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        order.items?.some(item =>
          item.name?.toLowerCase().includes(searchQuery.toLowerCase())
        )
      );
    }

    setFilteredOrders(filtered);
  }, [searchQuery, orders, statusFilter]);

  const loadOrders = async () => {
    try {
      setError(null);
      const orderData = await getBusinessOrders();
      const orderList = orderData?.orders || [];
      setOrders(orderList);
      setFilteredOrders(orderList);
    } catch (err) {
      setError('Failed to load orders');
      console.error('Orders error:', err);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadOrders();
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return '#4CAF50';
      case 'pending': return '#FF9800';
      case 'confirmed': return '#2196F3';
      case 'ready': return '#9C27B0';
      case 'cancelled': return '#F44336';
      default: return '#9E9E9E';
    }
  };

  const handleOrderPress = (order) => {
    Alert.alert(
      `Order #${order.orderId}`,
      `Customer: ${order.customerName}\nStatus: ${order.status}\nTotal: ₪${order.totalAmount}`,
      [
        { text: 'Close', style: 'cancel' },
        { text: 'View Details', onPress: () => console.log('View order details') }
      ]
    );
  };

  const handleUpdateStatus = async (orderId, newStatus) => {
    setIsUpdatingStatus(true);
    try {
      await updateOrderStatus(orderId, newStatus);
      Alert.alert('Success', 'Order status updated successfully');
      loadOrders();
    } catch (err) {
      Alert.alert('Error', 'Failed to update order status');
      console.error('Update status error:', err);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const renderStatusFilters = () => {
    const statuses = [
      { key: 'all', label: 'All', count: orders.length },
      { key: 'pending', label: 'Pending', count: orders.filter(o => o.status === 'pending').length },
      { key: 'confirmed', label: 'Confirmed', count: orders.filter(o => o.status === 'confirmed').length },
      { key: 'ready', label: 'Ready', count: orders.filter(o => o.status === 'ready').length },
      { key: 'completed', label: 'Completed', count: orders.filter(o => o.status === 'completed').length },
    ];

    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.statusFilters}
        contentContainerStyle={styles.statusFiltersContent}
      >
        {statuses.map((status) => (
          <TouchableOpacity
            key={status.key}
            style={[
              styles.statusFilter,
              statusFilter === status.key && styles.activeStatusFilter
            ]}
            onPress={() => setStatusFilter(status.key)}
          >
            <Text style={[
              styles.statusFilterText,
              statusFilter === status.key && styles.activeStatusFilterText
            ]}>
              {status.label}
            </Text>
            <Text style={[
              styles.statusFilterCount,
              statusFilter === status.key && styles.activeStatusFilterCount
            ]}>
              {status.count}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    );
  };

  const handleQuickStatusUpdate = async (orderId, newStatus) => {
    setIsUpdatingStatus(true);
    try {
      await updateOrderStatus(orderId, newStatus);
      Alert.alert('Success', `Order status updated to ${newStatus}`);
      loadOrders();
    } catch (err) {
      Alert.alert('Error', 'Failed to update order status');
      console.error('Update status error:', err);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleContactCustomer = (order) => {
    Alert.alert(
      'Contact Customer',
      `Choose how to contact ${order.customerName}`,
      [
        {
          text: 'Call',
          onPress: () => {
            if (order.customerPhone) {
              Linking.openURL(`tel:${order.customerPhone}`);
            } else {
              Alert.alert('No Phone', 'Customer phone number not available');
            }
          }
        },
        {
          text: 'Email',
          onPress: () => {
            if (order.customerEmail) {
              Linking.openURL(`mailto:${order.customerEmail}`);
            } else {
              Alert.alert('No Email', 'Customer email not available');
            }
          }
        },
        {
          text: 'Message',
          onPress: () => {
            // Navigate to chat/messaging screen
            navigation.navigate('CustomerChat', {
              orderId: order.id,
              customerName: order.customerName
            });
          }
        },
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  };

  const handlePrintReceipt = (order) => {
    Alert.alert('Print Receipt', `Printing receipt for order #${order.orderId}...`);
    // Implement receipt printing logic here
  };

  const renderOrderItem = ({ item }) => (
    <TouchableOpacity
      style={styles.orderItem}
      onPress={() => {
        setSelectedOrder(item);
        setShowOrderModal(true);
      }}
    >
      <View style={styles.orderHeader}>
        <View style={styles.orderInfo}>
          <Text style={styles.orderNumber}>Order #{item.orderId || item.id}</Text>
          <Text style={styles.orderDate}>
            {new Date(item.orderDate).toLocaleDateString()}
          </Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
          <Text style={styles.statusText}>{item.status}</Text>
        </View>
      </View>

      <View style={styles.orderDetails}>
        <View style={styles.customerInfo}>
          <MaterialIcons name="person" size={16} color="#666" />
          <Text style={styles.customerName}>{item.customerName || 'Unknown Customer'}</Text>
        </View>

        <View style={styles.orderValue}>
          <MaterialIcons name="monetization-on" size={16} color="#4CAF50" />
          <Text style={styles.orderAmount}>₪{item.totalAmount || 0}</Text>
        </View>
      </View>

      {item.items && item.items.length > 0 && (
        <View style={styles.orderItems}>
          <Text style={styles.itemsLabel}>Items:</Text>
          <Text style={styles.itemsList}>
            {item.items.slice(0, 2).map(i => i.name).join(', ')}
            {item.items.length > 2 && ` +${item.items.length - 2} more`}
          </Text>
        </View>
      )}

      {/* NEW: Quick Action Buttons */}
      <View style={styles.orderActions}>
        <TouchableOpacity
          style={[styles.actionButton, styles.viewButton]}
          onPress={(e) => {
            e.stopPropagation();
            setSelectedOrder(item);
            setShowOrderModal(true);
          }}
        >
          <MaterialIcons name="visibility" size={16} color="#2196F3" />
          <Text style={[styles.actionText, { color: '#2196F3' }]}>View</Text>
        </TouchableOpacity>

        {item.status === 'pending' && (
          <TouchableOpacity
            style={[styles.actionButton, styles.confirmButton]}
            onPress={(e) => {
              e.stopPropagation();
              handleQuickStatusUpdate(item.id, 'confirmed');
            }}
          >
            <MaterialIcons name="check-circle" size={16} color="#4CAF50" />
            <Text style={[styles.actionText, { color: '#4CAF50' }]}>Confirm</Text>
          </TouchableOpacity>
        )}

        {item.status === 'confirmed' && (
          <TouchableOpacity
            style={[styles.actionButton, styles.readyButton]}
            onPress={(e) => {
              e.stopPropagation();
              handleQuickStatusUpdate(item.id, 'ready');
            }}
          >
            <MaterialIcons name="local-shipping" size={16} color="#FF9800" />
            <Text style={[styles.actionText, { color: '#FF9800' }]}>Ready</Text>
          </TouchableOpacity>
        )}

        {item.status === 'ready' && (
          <TouchableOpacity
            style={[styles.actionButton, styles.completeButton]}
            onPress={(e) => {
              e.stopPropagation();
              handleQuickStatusUpdate(item.id, 'completed');
            }}
          >
            <MaterialIcons name="check-circle" size={16} color="#4CAF50" />
            <Text style={[styles.actionText, { color: '#4CAF50' }]}>Complete</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.actionButton, styles.contactButton]}
          onPress={(e) => {
            e.stopPropagation();
            handleContactCustomer(item);
          }}
        >
          <MaterialIcons name="message" size={16} color="#9C27B0" />
          <Text style={[styles.actionText, { color: '#9C27B0' }]}>Contact</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <MaterialIcons name="assignment" size={64} color="#e0e0e0" />
      <Text style={styles.emptyTitle}>No Orders Yet</Text>
      <Text style={styles.emptyText}>
        When customers place orders, they'll appear here
      </Text>
      <TouchableOpacity
        style={styles.createFirstOrderButton}
        onPress={() => navigation.navigate('CreateOrderScreen', { businessId })}
      >
        <MaterialIcons name="add" size={20} color="#fff" />
        <Text style={styles.createFirstOrderText}>Create First Order</Text>
      </TouchableOpacity>
    </View>
  );

  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
        <MaterialIcons name="arrow-back" size={24} color="#216a94" />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>Orders</Text>
      <TouchableOpacity
        style={styles.createOrderButton}
        onPress={() => navigation.navigate('CreateOrderScreen', { businessId })}
      >
        <MaterialIcons name="add" size={24} color="#216a94" />
      </TouchableOpacity>
    </View>
  );

  if (isLoading) {
    return (
      <BusinessLayout navigation={navigation} businessId={businessId} currentTab="orders">
        <SafeAreaView style={styles.container}>
          <StatusBar barStyle="dark-content" backgroundColor="#fff" />
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
              <MaterialIcons name="arrow-back" size={24} color="#216a94" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Orders</Text>
            <View style={styles.placeholder} />
          </View>
          <View style={styles.centered}>
            <ActivityIndicator size="large" color="#216a94" />
            <Text style={styles.loadingText}>Loading orders...</Text>
          </View>
        </SafeAreaView>
      </BusinessLayout>

    );
  }

  return (
    <BusinessLayout
      navigation={navigation}
      businessId={businessId}
      currentTab="orders"
      badges={{ orders: orders.filter(o => o.status === 'pending').length }} // optional badge
    >
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />

        {/* Header with Create Order Button */}
        {renderHeader()}

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <MaterialIcons name="search" size={20} color="#666" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search orders..."
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <MaterialIcons name="close" size={20} color="#666" />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Status Filters */}
        {renderStatusFilters()}

        {/* Order Stats */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{orders.length}</Text>
            <Text style={styles.statLabel}>Total Orders</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>
              {orders.filter(o => o.status === 'pending').length}
            </Text>
            <Text style={styles.statLabel}>Pending</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>
              ₪{orders.filter(o => o.status === 'completed').reduce((sum, o) => sum + (o.totalAmount || 0), 0)}
            </Text>
            <Text style={styles.statLabel}>Revenue</Text>
          </View>
        </View>

        {/* Orders List */}
        <FlatList
          data={filteredOrders}
          renderItem={renderOrderItem}
          keyExtractor={(item) => item.id || item.orderId}
          style={styles.ordersList}
          ListEmptyComponent={renderEmptyState}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          showsVerticalScrollIndicator={false}
        />

        {/* Order Detail Modal */}
        {selectedOrder && (
          <OrderDetailModal
            visible={showOrderModal}
            order={selectedOrder}
            onClose={() => setShowOrderModal(false)}
            onUpdateStatus={handleUpdateStatus}
            onContactCustomer={handleContactCustomer}
            onPrintReceipt={() => handlePrintReceipt(selectedOrder)}
            isLoading={isUpdatingStatus}
            businessInfo={{ businessName: 'Your Plant Store', address: 'Store Location' }}
          />
        )}
      </SafeAreaView>
    </BusinessLayout >
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
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  backButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#f8f9fa',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#216a94',
    flex: 1,
    textAlign: 'center',
  },
  createOrderButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#f8f9fa',
  },
  placeholder: {
    width: 40,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    margin: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  searchInput: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    color: '#333',
  },
  statusFilters: {
    maxHeight: 60,
    marginBottom: 16,
  },
  statusFiltersContent: {
    paddingHorizontal: 16,
  },
  statusFilter: {
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    alignItems: 'center',
  },
  activeStatusFilter: {
    backgroundColor: '#216a94',
    borderColor: '#216a94',
  },
  statusFilterText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  activeStatusFilterText: {
    color: '#fff',
  },
  statusFilterCount: {
    fontSize: 10,
    color: '#999',
    marginTop: 2,
  },
  activeStatusFilterCount: {
    color: '#fff',
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 16,
    marginHorizontal: 4,
    borderRadius: 12,
    alignItems: 'center',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#216a94',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    textAlign: 'center',
  },
  ordersList: {
    flex: 1,
    paddingHorizontal: 16,
  },
  orderItem: {
    backgroundColor: '#fff',
    padding: 16,
    marginBottom: 8,
    borderRadius: 12,
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
    marginBottom: 12,
  },
  orderInfo: {
    flex: 1,
  },
  orderNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  orderDate: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
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
  orderDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  customerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  customerName: {
    fontSize: 14,
    color: '#666',
    marginLeft: 6,
  },
  orderValue: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  orderAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginLeft: 4,
  },
  orderItems: {
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 8,
    marginTop: 8,
  },
  itemsLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
    marginBottom: 4,
  },
  itemsList: {
    fontSize: 12,
    color: '#999',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#666',
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  createFirstOrderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#216a94',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginTop: 16,
  },
  createFirstOrderText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  orderActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    gap: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e9ecef',
    flex: 1,
    justifyContent: 'center',
    minHeight: 32,
  },
  viewButton: {
    backgroundColor: '#e3f2fd',
    borderColor: '#2196F3',
  },
  confirmButton: {
    backgroundColor: '#e8f5e9',
    borderColor: '#4CAF50',
  },
  readyButton: {
    backgroundColor: '#fff3e0',
    borderColor: '#FF9800',
  },
  completeButton: {
    backgroundColor: '#e8f5e9',
    borderColor: '#4CAF50',
  },
  contactButton: {
    backgroundColor: '#f3e5f5',
    borderColor: '#9C27B0',
  },
  actionText: {
    marginLeft: 4,
    fontSize: 12,
    fontWeight: '600',
  },
});
