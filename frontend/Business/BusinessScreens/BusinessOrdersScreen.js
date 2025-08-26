import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, FlatList, TouchableOpacity,
  TextInput, RefreshControl, Alert, ActivityIndicator, StatusBar, ScrollView,
} from 'react-native';
import BusinessLayout from '../components/BusinessLayout';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ✅ Use the order API (has getBusinessOrders + updateOrderStatus)
import { getBusinessOrders, updateOrderStatus } from '../services/businessOrderApi';

import OrderDetailModal from '../components/OrderDetailModal';
import * as Linking from 'expo-linking';

// ⬇️ NEW: realtime
import useOrdersSignalR from '../hooks/useOrdersSignalR';

const normalizeEmail = (e = '') => e.trim().toLowerCase();

export default function BusinessOrdersScreen({ navigation, route }) {
  const { businessId: routeBusinessId } = route.params || {};
  const [businessId, setBusinessId] = useState(routeBusinessId || null);

  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all');

  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  useEffect(() => {
    const ensureBusinessId = async () => {
      if (routeBusinessId) {
        setBusinessId(routeBusinessId);
        return;
      }
      const stored =
        (await AsyncStorage.getItem('businessId')) ||
        (await AsyncStorage.getItem('userEmail'));
      if (stored) setBusinessId(stored);
    };
    ensureBusinessId();
  }, [routeBusinessId]);

  const loadOrders = useCallback(async (bId = businessId) => {
    try {
      if (!bId) return;
      setError(null);
      setIsLoading(true);
      const orderData = await getBusinessOrders(bId);
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
  }, [businessId]);

  useEffect(() => {
    if (businessId) loadOrders(businessId);
  }, [businessId, loadOrders]);

  useEffect(() => {
    if (!orders?.length) {
      setFilteredOrders([]);
      return;
    }
    let filtered = orders;

    if (statusFilter !== 'all') {
      filtered = filtered.filter(o => (o.status || '').toLowerCase() === statusFilter);
    }

    const raw = (searchQuery || '').trim().toLowerCase();
    if (raw) {
      filtered = filtered.filter((o) => {
        const id = String(o.id || o.orderId || '').toLowerCase();
        const conf = String(o.confirmationNumber || '').toLowerCase();
        const name = String(o.customerName || '').toLowerCase();
        const email = String(o.customerEmail || '').toLowerCase();
        const status = String(o.status || '').toLowerCase();
        const total = String(o.total ?? o.totalAmount ?? '').toLowerCase();

        const items = Array.isArray(o.items) ? o.items : [];
        const itemNames = items.map(i => String(i?.name || '').toLowerCase()).join(' ');

        return (
          id.includes(raw) ||
          conf.includes(raw) ||
          name.includes(raw) ||
          email.includes(raw) ||
          status.includes(raw) ||
          total.includes(raw) ||
          itemNames.includes(raw)
        );
      });
    }

    setFilteredOrders(filtered);
  }, [searchQuery, orders, statusFilter]);

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
      `Order #${order.confirmationNumber || order.orderId || order.id}`,
      `Customer: ${order.customerName}\nStatus: ${order.status}\nTotal: ₪${order.total ?? order.totalAmount ?? 0}`,
      [
        { text: 'Close', style: 'cancel' },
        { text: 'View Details', onPress: () => console.log('View order details') }
      ]
    );
  };

  const handleUpdateStatus = async (orderId, newStatus, note = '') => {
    setIsUpdatingStatus(true);
    try {
      const res = await updateOrderStatus(orderId, newStatus, note);
      const updatedFromServer = res?.order || {};
      const idMatches = (o) => String(o.id || o.orderId) === String(orderId);

      setOrders(prev => prev.map(o => (idMatches(o) ? { ...o, status: newStatus, ...updatedFromServer } : o)));
      setFilteredOrders(prev => prev.map(o => (idMatches(o) ? { ...o, status: newStatus, ...updatedFromServer } : o)));
      setSelectedOrder(prev => (prev && idMatches(prev) ? { ...prev, status: newStatus, ...updatedFromServer } : prev));

      Alert.alert('Success', 'Order status updated successfully');
      loadOrders();
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to update order status');
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
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.statusFilters} contentContainerStyle={styles.statusFiltersContent}>
        {statuses.map((status) => (
          <TouchableOpacity key={status.key} style={[styles.statusFilter, statusFilter === status.key && styles.activeStatusFilter]} onPress={() => setStatusFilter(status.key)}>
            <Text style={[styles.statusFilterText, statusFilter === status.key && styles.activeStatusFilterText]}>{status.label}</Text>
            <Text style={[styles.statusFilterCount, statusFilter === status.key && styles.activeStatusFilterCount]}>{status.count}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    );
  };

  const handleQuickStatusUpdate = async (orderId, newStatus) => {
    setIsUpdatingStatus(true);
    try {
      const res = await updateOrderStatus(orderId, newStatus);
      const updatedFromServer = res?.order || {};
      const idMatches = (o) => String(o.id || o.orderId) === String(orderId);

      setOrders(prev => prev.map(o => (idMatches(o) ? { ...o, status: newStatus, ...updatedFromServer } : o)));
      setFilteredOrders(prev => prev.map(o => (idMatches(o) ? { ...o, status: newStatus, ...updatedFromServer } : o)));
      setSelectedOrder(prev => (prev && idMatches(prev) ? { ...prev, status: newStatus, ...updatedFromServer } : prev));

      Alert.alert('Success', `Order status updated to ${newStatus}`);
      loadOrders();
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to update order status');
      console.error('Update status error:', err);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleContactCustomer = (order) => {
    const rawEmail = order.customerEmail || '';
    const recipientEmailNorm = normalizeEmail(rawEmail);

    navigation.navigate('Messages', {
      recipientEmail: rawEmail,
      recipientEmailNorm,
      recipientName: order.customerName,
      isOrderChat: true,
      orderId: order.id || order.orderId,
      orderNumber: order.confirmationNumber,
      autoMessage: `Hi ${order.customerName}, I'm following up about order #${order.confirmationNumber}.`,
    });
  };

  // ---------- 🟢 Realtime: handle incoming events ----------
  const upsertOrder = useCallback((incoming) => {
    if (!incoming) return;
    const incId = String(incoming.id || incoming.orderId || '');
    if (!incId) return;

    setOrders(prev => {
      const without = prev.filter(o => String(o.id || o.orderId) !== incId);
      return [incoming, ...without]; // newest on top
    });
    setFilteredOrders(prev => {
      const without = prev.filter(o => String(o.id || o.orderId) !== incId);
      return [incoming, ...without];
    });
  }, []);

  const patchOrder = useCallback((partial) => {
    if (!partial) return;
    const incId = String(partial.id || partial.orderId || '');
    if (!incId) return;

    setOrders(prev => prev.map(o => (String(o.id || o.orderId) === incId ? { ...o, ...partial } : o)));
    setFilteredOrders(prev => prev.map(o => (String(o.id || o.orderId) === incId ? { ...o, ...partial } : o)));
    setSelectedOrder(prev => (prev && String(prev.id || prev.orderId) === incId ? { ...prev, ...partial } : prev));
  }, []);
const handleRealtimeCreated = (order) => {
  // nice toast/popup; Alert is fine for now
  Alert.alert('New order', `#${order.confirmationNumber} from ${order.customerName}`);
  setOrders(prev => [order, ...prev.filter(o => String(o.id||o.orderId)!==String(order.id))]);
  setFilteredOrders(prev => [order, ...prev.filter(o => String(o.id||o.orderId)!==String(order.id))]);
};

const handleRealtimeUpdated = (partial) => {
  const id = String(partial.id || partial.orderId || '');
  if (!id) return;
  setOrders(prev => prev.map(o => (String(o.id||o.orderId)===id ? { ...o, ...partial } : o)));
  setFilteredOrders(prev => prev.map(o => (String(o.id||o.orderId)===id ? { ...o, ...partial } : o)));
  setSelectedOrder(prev => (prev && String(prev.id||prev.orderId)===id ? { ...prev, ...partial } : prev));
};

useOrdersSignalR(businessId, {
  onOrderCreated: handleRealtimeCreated,
  onOrderUpdated: handleRealtimeUpdated,
  enabled: !!businessId,
});

  // --------------------------------------------------------

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
          <Text style={styles.orderNumber}>Order #{item.confirmationNumber || item.orderId || item.id}</Text>
          <Text style={styles.orderDate}>
            {item.orderDate ? new Date(item.orderDate).toLocaleDateString() : ''}
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
          <Text style={styles.orderAmount}>₪{item.total ?? item.totalAmount ?? 0}</Text>
        </View>
      </View>

      {Array.isArray(item.items) && item.items.length > 0 && (
        <View style={styles.orderItems}>
          <Text style={styles.itemsLabel}>Items:</Text>
          <Text style={styles.itemsList}>
            {item.items.slice(0, 2).map(i => i.name).join(', ')}
            {item.items.length > 2 && ` +${item.items.length - 2} more`}
          </Text>
        </View>
      )}

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
              handleQuickStatusUpdate(item.id || item.orderId, 'confirmed');
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
              handleQuickStatusUpdate(item.id || item.orderId, 'ready');
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
              handleQuickStatusUpdate(item.id || item.orderId, 'completed');
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
      <Text style={styles.emptyText}>When customers place orders, they'll appear here</Text>
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
      badges={{ orders: orders.filter(o => o.status === 'pending').length }}
    >
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />

        {renderHeader()}

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

        {renderStatusFilters()}

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
              ₪{orders.filter(o => o.status === 'completed').reduce((sum, o) => sum + (o.total ?? o.totalAmount ?? 0), 0)}
            </Text>
            <Text style={styles.statLabel}>Revenue</Text>
          </View>
        </View>

        <FlatList
          data={filteredOrders}
          renderItem={renderOrderItem}
          keyExtractor={(item) => String(item.id || item.orderId)}
          style={styles.ordersList}
          ListEmptyComponent={renderEmptyState}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          showsVerticalScrollIndicator={false}
        />

        {selectedOrder && (
          <OrderDetailModal
            visible={showOrderModal}
            order={selectedOrder}
            onClose={() => setShowOrderModal(false)}
            onUpdateStatus={handleUpdateStatus}
            onContactCustomer={handleContactCustomer}
            isLoading={isUpdatingStatus}
            businessInfo={{ businessName: 'Your Plant Store', address: 'Store Location' }}
          />
        )}
      </SafeAreaView>
    </BusinessLayout>
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
