// Business/BusinessScreens/BusinessOrdersScreen.js
import React, { useState, useEffect, useCallback } from 'react';
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
  TextInput
} from 'react-native';
import { 
  MaterialIcons, 
  MaterialCommunityIcons,
  Ionicons 
} from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { format } from 'date-fns';

// API base URL
const API_BASE_URL = 'https://usersfunctions.azurewebsites.net/api';

const BusinessOrdersScreen = ({ navigation }) => {
  // State variables
  const [orders, setOrders] = useState([]);
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [businessId, setBusinessId] = useState(null);
  const [currentFilter, setCurrentFilter] = useState('all');
  const [currentSort, setCurrentSort] = useState('date-desc');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [updateStatusModalVisible, setUpdateStatusModalVisible] = useState(false);
  const [noteModalVisible, setNoteModalVisible] = useState(false);
  const [orderNote, setOrderNote] = useState('');

  // Fetch business ID on component mount
  useEffect(() => {
    const getBusinessId = async () => {
      try {
        const id = await AsyncStorage.getItem('businessId');
        if (id) {
          setBusinessId(id);
        } else {
          Alert.alert('Error', 'Business ID not found. Please sign in again.');
          navigation.navigate('BusinessSignInScreen');
        }
      } catch (error) {
        console.error('Failed to get business ID:', error);
      }
    };
    
    getBusinessId();
  }, []);

  // Fetch orders when businessId is available
  useEffect(() => {
    if (businessId) {
      fetchOrders();
    }
  }, [businessId]);

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
          order.id?.toLowerCase().includes(query) ||
          order.items?.some(item => item.name?.toLowerCase().includes(query))
      );
    }

    // Apply status filter
    if (currentFilter !== 'all') {
      result = result.filter(order => order.status === currentFilter);
    }

    // Apply sort
    switch (currentSort) {
      case 'date-asc':
        result.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        break;
      case 'date-desc':
        result.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        break;
      case 'price-asc':
        result.sort((a, b) => a.total - b.total);
        break;
      case 'price-desc':
        result.sort((a, b) => b.total - a.total);
        break;
    }

    setFilteredOrders(result);
  }, [orders, searchQuery, currentFilter, currentSort]);

  // Fetch orders from API
  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      
      const response = await fetch(`${API_BASE_URL}/business-orders?businessId=${businessId}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch orders');
      }
      
      const data = await response.json();
      setOrders(data);
    } catch (error) {
      console.error('Error fetching orders:', error);
      Alert.alert('Error', 'Failed to load orders. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [businessId]);

  // Handle pull-to-refresh
  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchOrders();
  }, [fetchOrders]);

  // Update order status
  const updateOrderStatus = async (orderId, newStatus) => {
    try {
      setLoading(true);
      
      const response = await fetch(`${API_BASE_URL}/business-orders/${orderId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Email': businessId
        },
        body: JSON.stringify({ status: newStatus })
      });
      
      if (!response.ok) {
        throw new Error('Failed to update order status');
      }
      
      // Update order in state
      setOrders(prev => prev.map(order => 
        order.id === orderId ? { ...order, status: newStatus } : order
      ));
      
      setSelectedOrder(prev => prev ? { ...prev, status: newStatus } : null);
      Alert.alert('Success', 'Order status updated successfully');
    } catch (error) {
      console.error('Error updating order status:', error);
      Alert.alert('Error', 'Failed to update order status. Please try again.');
    } finally {
      setLoading(false);
      setUpdateStatusModalVisible(false);
    }
  };

  // Add note to order
  const addOrderNote = async () => {
    if (!selectedOrder || !orderNote.trim()) return;
    
    try {
      setLoading(true);
      
      const response = await fetch(`${API_BASE_URL}/business-orders/${selectedOrder.id}/notes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Email': businessId
        },
        body: JSON.stringify({ note: orderNote })
      });
      
      if (!response.ok) {
        throw new Error('Failed to add note');
      }
      
      // Update notes in state
      const updatedNotes = [...(selectedOrder.notes || []), {
        id: Date.now().toString(),
        text: orderNote,
        createdAt: new Date().toISOString(),
        createdBy: businessId
      }];
      
      setOrders(prev => prev.map(order => 
        order.id === selectedOrder.id ? { ...order, notes: updatedNotes } : order
      ));
      
      setSelectedOrder(prev => prev ? { ...prev, notes: updatedNotes } : null);
      setOrderNote('');
      Alert.alert('Success', 'Note added successfully');
    } catch (error) {
      console.error('Error adding note:', error);
      Alert.alert('Error', 'Failed to add note. Please try again.');
    } finally {
      setLoading(false);
      setNoteModalVisible(false);
    }
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

  // Show add note modal
  const showAddNoteModal = () => {
    setDetailModalVisible(false);
    setNoteModalVisible(true);
  };

  // Get status color
  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return '#FFA000';
      case 'processing': return '#2196F3';
      case 'shipped': return '#9C27B0';
      case 'delivered': return '#4CAF50';
      case 'cancelled': return '#F44336';
      default: return '#757575';
    }
  };

  // Get status icon
  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending': return 'hourglass-empty';
      case 'processing': return 'autorenew';
      case 'shipped': return 'local-shipping';
      case 'delivered': return 'check-circle';
      case 'cancelled': return 'cancel';
      default: return 'help-outline';
    }
  };

  // Format date
  const formatDate = (dateString) => {
    try {
      return format(new Date(dateString), 'MMM dd, yyyy • h:mm a');
    } catch (error) {
      return dateString;
    }
  };

  // Render order item
  const renderOrderItem = ({ item }) => (
    <TouchableOpacity 
      style={styles.orderCard}
      onPress={() => viewOrderDetails(item)}
    >
      <View style={styles.orderHeader}>
        <View style={styles.orderIdContainer}>
          <Text style={styles.orderId}>Order #{item.id.slice(-6)}</Text>
          <Text style={styles.orderDate}>{formatDate(item.createdAt)}</Text>
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
      
      <View style={styles.customerInfo}>
        <MaterialIcons name="person" size={16} color="#757575" />
        <Text style={styles.customerName}>{item.customerName}</Text>
      </View>
      
      <View style={styles.orderItemsPreview}>
        {item.items.slice(0, 2).map((orderItem, index) => (
          <View key={index} style={styles.orderItemRow}>
            <Text style={styles.itemQuantity}>{orderItem.quantity}x</Text>
            <Text style={styles.itemName} numberOfLines={1} ellipsizeMode="tail">
              {orderItem.name}
            </Text>
            <Text style={styles.itemPrice}>${orderItem.price.toFixed(2)}</Text>
          </View>
        ))}
        
        {item.items.length > 2 && (
          <Text style={styles.moreItems}>
            +{item.items.length - 2} more items...
          </Text>
        )}
      </View>
      
      <View style={styles.orderFooter}>
        <Text style={styles.totalItems}>
          {item.items.reduce((total, item) => total + item.quantity, 0)} items
        </Text>
        <Text style={styles.orderTotal}>Total: ${item.total.toFixed(2)}</Text>
      </View>
    </TouchableOpacity>
  );

  // Render order details modal
  const renderDetailModal = () => {
    if (!selectedOrder) return null;
    
    return (
      <Modal
        visible={detailModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setDetailModalVisible(false)}
      >
        <View style={styles.modalBackground}>
          <View style={styles.detailModalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Order Details</Text>
              <TouchableOpacity onPress={() => setDetailModalVisible(false)}>
                <MaterialIcons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.orderDetailHeader}>
              <Text style={styles.orderDetailId}>Order #{selectedOrder.id.slice(-6)}</Text>
              <View style={[
                styles.statusBadge, 
                { backgroundColor: getStatusColor(selectedOrder.status) }
              ]}>
                <MaterialIcons name={getStatusIcon(selectedOrder.status)} size={14} color="#fff" />
                <Text style={styles.statusText}>
                  {selectedOrder.status.charAt(0).toUpperCase() + selectedOrder.status.slice(1)}
                </Text>
              </View>
            </View>
            
            <Text style={styles.orderDetailDate}>
              Placed on {formatDate(selectedOrder.createdAt)}
            </Text>
            
            <View style={styles.sectionTitle}>
              <MaterialIcons name="person" size={18} color="#2e7d32" />
              <Text style={styles.sectionTitleText}>Customer Information</Text>
            </View>
            
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Name:</Text>
              <Text style={styles.infoValue}>{selectedOrder.customerName}</Text>
            </View>
            
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Email:</Text>
              <Text style={styles.infoValue}>{selectedOrder.customerEmail}</Text>
            </View>
            
            {selectedOrder.phone && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Phone:</Text>
                <Text style={styles.infoValue}>{selectedOrder.phone}</Text>
              </View>
            )}
            
            {selectedOrder.shippingAddress && (
              <>
                <View style={styles.sectionTitle}>
                  <MaterialIcons name="local-shipping" size={18} color="#2e7d32" />
                  <Text style={styles.sectionTitleText}>Shipping Address</Text>
                </View>
                
                <View style={styles.addressCard}>
                  <Text style={styles.addressText}>
                    {selectedOrder.shippingAddress.street}, {selectedOrder.shippingAddress.city}
                  </Text>
                  <Text style={styles.addressText}>
                    {selectedOrder.shippingAddress.state}, {selectedOrder.shippingAddress.postalCode}
                  </Text>
                  <Text style={styles.addressText}>
                    {selectedOrder.shippingAddress.country}
                  </Text>
                </View>
              </>
            )}
            
            <View style={styles.sectionTitle}>
              <MaterialIcons name="shopping-cart" size={18} color="#2e7d32" />
              <Text style={styles.sectionTitleText}>Order Items</Text>
            </View>
            
            {selectedOrder.items.map((item, index) => (
              <View key={index} style={styles.detailItemRow}>
                <View style={styles.itemImageContainer}>
                  {item.imageUrl ? (
                    <Image 
                      source={{ uri: item.imageUrl }} 
                      style={styles.itemImage} 
                    />
                  ) : (
                    <View style={styles.itemImagePlaceholder}>
                      <MaterialIcons name="image" size={20} color="#bdbdbd" />
                    </View>
                  )}
                </View>
                
                <View style={styles.itemDetails}>
                  <Text style={styles.detailItemName}>{item.name}</Text>
                  <View style={styles.itemMetaRow}>
                    <Text style={styles.detailItemQuantity}>Qty: {item.quantity}</Text>
                    <Text style={styles.detailItemPrice}>${item.price.toFixed(2)}</Text>
                  </View>
                </View>
              </View>
            ))}
            
            <View style={styles.orderSummary}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Subtotal:</Text>
                <Text style={styles.summaryValue}>
                  ${selectedOrder.subtotal?.toFixed(2) || selectedOrder.total.toFixed(2)}
                </Text>
              </View>
              
              {selectedOrder.shipping && (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Shipping:</Text>
                  <Text style={styles.summaryValue}>${selectedOrder.shipping.toFixed(2)}</Text>
                </View>
              )}
              
              {selectedOrder.tax && (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Tax:</Text>
                  <Text style={styles.summaryValue}>${selectedOrder.tax.toFixed(2)}</Text>
                </View>
              )}
              
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total:</Text>
                <Text style={styles.totalValue}>${selectedOrder.total.toFixed(2)}</Text>
              </View>
            </View>
            
            {selectedOrder.notes && selectedOrder.notes.length > 0 && (
              <>
                <View style={styles.sectionTitle}>
                  <MaterialIcons name="note" size={18} color="#2e7d32" />
                  <Text style={styles.sectionTitleText}>Notes</Text>
                </View>
                
                {selectedOrder.notes.map((note, index) => (
                  <View key={index} style={styles.noteCard}>
                    <Text style={styles.noteText}>{note.text}</Text>
                    <Text style={styles.noteDate}>{formatDate(note.createdAt)}</Text>
                  </View>
                ))}
              </>
            )}
            
            <View style={styles.actionButtons}>
              <TouchableOpacity 
                style={styles.actionButton}
                onPress={showUpdateStatusModal}
              >
                <MaterialIcons name="update" size={20} color="#2196F3" />
                <Text style={[styles.actionButtonText, { color: '#2196F3' }]}>
                  Update Status
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.actionButton}
                onPress={showAddNoteModal}
              >
                <MaterialIcons name="note-add" size={20} color="#4CAF50" />
                <Text style={[styles.actionButtonText, { color: '#4CAF50' }]}>
                  Add Note
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  // Render update status modal
  const renderUpdateStatusModal = () => {
    if (!selectedOrder) return null;
    
    const statuses = [
      { value: 'pending', label: 'Pending' },
      { value: 'processing', label: 'Processing' },
      { value: 'shipped', label: 'Shipped' },
      { value: 'delivered', label: 'Delivered' },
      { value: 'cancelled', label: 'Cancelled' }
    ];
    
    return (
      <Modal
        visible={updateStatusModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setUpdateStatusModalVisible(false)}
      >
        <View style={styles.modalBackground}>
          <View style={styles.statusModalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Update Order Status</Text>
              <TouchableOpacity onPress={() => setUpdateStatusModalVisible(false)}>
                <MaterialIcons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            
            <Text style={styles.modalSubtitle}>
              Order #{selectedOrder.id.slice(-6)}
            </Text>
            
            <Text style={styles.statusInstructions}>
              Select a new status for this order:
            </Text>
            
            <View style={styles.statusOptions}>
              {statuses.map((status) => (
                <TouchableOpacity
                  key={status.value}
                  style={[
                    styles.statusOption,
                    { 
                      backgroundColor: 
                        selectedOrder.status === status.value 
                          ? getStatusColor(status.value) 
                          : '#f5f5f5'
                    }
                  ]}
                  onPress={() => updateOrderStatus(selectedOrder.id, status.value)}
                >
                  <MaterialIcons 
                    name={getStatusIcon(status.value)} 
                    size={24} 
                    color={selectedOrder.status === status.value ? '#fff' : '#757575'} 
                  />
                  <Text 
                    style={[
                      styles.statusOptionText,
                      { 
                        color: 
                          selectedOrder.status === status.value 
                            ? '#fff' 
                            : '#757575'
                      }
                    ]}
                  >
                    {status.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setUpdateStatusModalVisible(false)}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  };

  // Render add note modal
  const renderAddNoteModal = () => {
    if (!selectedOrder) return null;
    
    return (
      <Modal
        visible={noteModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setNoteModalVisible(false)}
      >
        <View style={styles.modalBackground}>
          <View style={styles.noteModalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Note</Text>
              <TouchableOpacity onPress={() => setNoteModalVisible(false)}>
                <MaterialIcons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            
            <Text style={styles.modalSubtitle}>
              Order #{selectedOrder.id.slice(-6)}
            </Text>
            
            <TextInput
              style={styles.noteInput}
              placeholder="Enter note about this order..."
              value={orderNote}
              onChangeText={setOrderNote}
              multiline
              maxLength={500}
            />
            
            <View style={styles.characterCount}>
              <Text style={styles.characterCountText}>
                {orderNote.length}/500 characters
              </Text>
            </View>
            
            <View style={styles.noteModalButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setNoteModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.saveButton,
                  { opacity: orderNote.trim() ? 1 : 0.5 }
                ]}
                onPress={addOrderNote}
                disabled={!orderNote.trim()}
              >
                <Text style={styles.saveButtonText}>Add Note</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  // Handle filter change
  const handleFilterChange = (filter) => {
    setCurrentFilter(filter);
  };

  // Handle sort change
  const handleSortChange = (sort) => {
    setCurrentSort(sort);
  };

  // Render filter options
  const renderFilterOptions = () => (
    <View style={styles.filterContainer}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterOptionsContainer}
      >
        <TouchableOpacity
          style={[
            styles.filterOption,
            currentFilter === 'all' && styles.filterOptionActive
          ]}
          onPress={() => handleFilterChange('all')}
        >
          <MaterialIcons name="filter-list" size={16} color={currentFilter === 'all' ? '#fff' : '#757575'} />
          <Text style={[
            styles.filterOptionText,
            currentFilter === 'all' && styles.filterOptionTextActive
          ]}>
            All
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[
            styles.filterOption,
            currentFilter === 'pending' && styles.filterOptionActive,
            { backgroundColor: currentFilter === 'pending' ? '#FFA000' : '#f5f5f5' }
          ]}
          onPress={() => handleFilterChange('pending')}
        >
          <MaterialIcons name="hourglass-empty" size={16} color={currentFilter === 'pending' ? '#fff' : '#757575'} />
          <Text style={[
            styles.filterOptionText,
            currentFilter === 'pending' && styles.filterOptionTextActive
          ]}>
            Pending
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[
            styles.filterOption,
            currentFilter === 'processing' && styles.filterOptionActive,
            { backgroundColor: currentFilter === 'processing' ? '#2196F3' : '#f5f5f5' }
          ]}
          onPress={() => handleFilterChange('processing')}
        >
          <MaterialIcons name="autorenew" size={16} color={currentFilter === 'processing' ? '#fff' : '#757575'} />
          <Text style={[
            styles.filterOptionText,
            currentFilter === 'processing' && styles.filterOptionTextActive
          ]}>
            Processing
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[
            styles.filterOption,
            currentFilter === 'shipped' && styles.filterOptionActive,
            { backgroundColor: currentFilter === 'shipped' ? '#9C27B0' : '#f5f5f5' }
          ]}
          onPress={() => handleFilterChange('shipped')}
        >
          <MaterialIcons name="local-shipping" size={16} color={currentFilter === 'shipped' ? '#fff' : '#757575'} />
          <Text style={[
            styles.filterOptionText,
            currentFilter === 'shipped' && styles.filterOptionTextActive
          ]}>
            Shipped
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[
            styles.filterOption,
            currentFilter === 'delivered' && styles.filterOptionActive,
            { backgroundColor: currentFilter === 'delivered' ? '#4CAF50' : '#f5f5f5' }
          ]}
          onPress={() => handleFilterChange('delivered')}
        >
          <MaterialIcons name="check-circle" size={16} color={currentFilter === 'delivered' ? '#fff' : '#757575'} />
          <Text style={[
            styles.filterOptionText,
            currentFilter === 'delivered' && styles.filterOptionTextActive
          ]}>
            Delivered
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[
            styles.filterOption,
            currentFilter === 'cancelled' && styles.filterOptionActive,
            { backgroundColor: currentFilter === 'cancelled' ? '#F44336' : '#f5f5f5' }
          ]}
          onPress={() => handleFilterChange('cancelled')}
        >
          <MaterialIcons name="cancel" size={16} color={currentFilter === 'cancelled' ? '#fff' : '#757575'} />
          <Text style={[
            styles.filterOptionText,
            currentFilter === 'cancelled' && styles.filterOptionTextActive
          ]}>
            Cancelled
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );

  // Render sort options
  const renderSortOptions = () => (
    <View style={styles.sortContainer}>
      <TouchableOpacity
        style={[
          styles.sortOption,
          currentSort === 'date-desc' || currentSort === 'date-asc' ? styles.sortOptionActive : {}
        ]}
        onPress={() => handleSortChange(currentSort === 'date-desc' ? 'date-asc' : 'date-desc')}
      >
        <Text style={styles.sortOptionText}>Date</Text>
        <MaterialIcons 
          name={currentSort === 'date-asc' ? 'arrow-upward' : 'arrow-downward'} 
          size={16} 
          color={currentSort.startsWith('date') ? '#2e7d32' : '#757575'} 
        />
      </TouchableOpacity>
      
      <TouchableOpacity
        style={[
          styles.sortOption,
          currentSort === 'price-desc' || currentSort === 'price-asc' ? styles.sortOptionActive : {}
        ]}
        onPress={() => handleSortChange(currentSort === 'price-desc' ? 'price-asc' : 'price-desc')}
      >
        <Text style={styles.sortOptionText}>Amount</Text>
        <MaterialIcons 
          name={currentSort === 'price-asc' ? 'arrow-upward' : 'arrow-downward'} 
          size={16} 
          color={currentSort.startsWith('price') ? '#2e7d32' : '#757575'} 
        />
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Orders</Text>
        <View style={styles.searchContainer}>
          <MaterialIcons name="search" size={20} color="#757575" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search orders..."
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <MaterialIcons name="cancel" size={20} color="#757575" />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
      
      {renderFilterOptions()}
      {renderSortOptions()}
      
      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2e7d32" />
          <Text style={styles.loadingText}>Loading orders...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredOrders}
          renderItem={renderOrderItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={['#2e7d32']}
              tintColor="#2e7d32"
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons name="shopping" size={64} color="#e0e0e0" />
              <Text style={styles.emptyText}>
                {searchQuery || currentFilter !== 'all'
                  ? "No orders match your filters"
                  : "You haven't received any orders yet"}
              </Text>
              {currentFilter !== 'all' && (
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
            </View>
          }
        />
      )}
      
      {renderDetailModal()}
      {renderUpdateStatusModal()}
      {renderAddNoteModal()}
    </SafeAreaView>
  );
};

// Add this import at the top if it's not already there
import { ScrollView } from 'react-native';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  header: {
    backgroundColor: '#fff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2e7d32',
    marginBottom: 12,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
  },
  filterContainer: {
    backgroundColor: '#fff',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  filterOptionsContainer: {
    paddingHorizontal: 16,
  },
  filterOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
  },
  filterOptionActive: {
    backgroundColor: '#2e7d32',
  },
  filterOptionText: {
    color: '#757575',
    marginLeft: 4,
  },
  filterOptionTextActive: {
    color: '#fff',
    fontWeight: '500',
  },
  sortContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    backgroundColor: '#fff',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  sortOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 12,
    marginLeft: 12,
    borderRadius: 16,
    backgroundColor: '#f5f5f5',
  },
  sortOptionActive: {
    backgroundColor: '#e8f5e9',
  },
  sortOptionText: {
    color: '#757575',
    marginRight: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    color: '#757575',
    fontSize: 16,
  },
  listContainer: {
    padding: 16,
    paddingBottom: 80, // Extra padding for bottom tab bar
  },
  orderCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  orderIdContainer: {
    flexDirection: 'column',
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
  customerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  customerName: {
    color: '#424242',
    fontSize: 14,
    marginLeft: 8,
  },
  orderItemsPreview: {
    backgroundColor: '#f9f9f9',
    borderRadius: 4,
    padding: 12,
    marginBottom: 12,
  },
  orderItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  itemQuantity: {
    width: 30,
    color: '#757575',
    fontSize: 14,
  },
  itemName: {
    flex: 1,
    color: '#424242',
    fontSize: 14,
    marginRight: 8,
  },
  itemPrice: {
    color: '#2e7d32',
    fontSize: 14,
    fontWeight: '500',
  },
  moreItems: {
    color: '#757575',
    fontSize: 12,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 6,
  },
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  totalItems: {
    color: '#757575',
    fontSize: 14,
  },
  orderTotal: {
    color: '#2e7d32',
    fontSize: 16,
    fontWeight: 'bold',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: '#757575',
    textAlign: 'center',
    maxWidth: '80%',
  },
  resetFiltersButton: {
    marginTop: 24,
    backgroundColor: '#2e7d32',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
  },
  resetFiltersText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  // Modal Styles
  modalBackground: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailModalContent: {
    backgroundColor: '#fff',
    borderRadius: 8,
    width: '90%',
    maxHeight: '80%',
    padding: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  orderDetailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  orderDetailId: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  orderDetailDate: {
    fontSize: 14,
    color: '#757575',
    marginBottom: 16,
  },
  sectionTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 12,
  },
  sectionTitleText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 8,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  infoLabel: {
    width: 80,
    color: '#757575',
    fontSize: 14,
  },
  infoValue: {
    flex: 1,
    color: '#424242',
    fontSize: 14,
  },
  addressCard: {
    backgroundColor: '#f5f5f5',
    borderRadius: 4,
    padding: 12,
    marginBottom: 8,
  },
  addressText: {
    color: '#424242',
    fontSize: 14,
    marginBottom: 4,
  },
  detailItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    backgroundColor: '#f9f9f9',
    borderRadius: 4,
    marginBottom: 8,
  },
  itemImageContainer: {
    width: 40,
    height: 40,
    marginRight: 12,
  },
  itemImage: {
    width: '100%',
    height: '100%',
    borderRadius: 4,
  },
  itemImagePlaceholder: {
    width: '100%',
    height: '100%',
    borderRadius: 4,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemDetails: {
    flex: 1,
  },
  detailItemName: {
    fontSize: 14,
    color: '#424242',
  },
  itemMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  detailItemQuantity: {
    fontSize: 12,
    color: '#757575',
  },
  detailItemPrice: {
    fontSize: 14,
    color: '#2e7d32',
    fontWeight: '500',
  },
  orderSummary: {
    marginTop: 24,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryLabel: {
    color: '#757575',
    fontSize: 14,
  },
  summaryValue: {
    color: '#424242',
    fontSize: 14,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  totalLabel: {
    color: '#333',
    fontSize: 16,
    fontWeight: 'bold',
  },
  totalValue: {
    color: '#2e7d32',
    fontSize: 16,
    fontWeight: 'bold',
  },
  noteCard: {
    backgroundColor: '#f9f9f9',
    borderRadius: 4,
    padding: 12,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#2e7d32',
  },
  noteText: {
    color: '#424242',
    fontSize: 14,
  },
  noteDate: {
    color: '#757575',
    fontSize: 12,
    marginTop: 8,
    textAlign: 'right',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 24,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 16,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
  },
  actionButtonText: {
    marginLeft: 8,
    fontWeight: 'bold',
  },
  statusModalContent: {
    backgroundColor: '#fff',
    borderRadius: 8,
    width: '90%',
    padding: 16,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#757575',
    marginBottom: 16,
  },
  statusInstructions: {
    fontSize: 14,
    color: '#333',
    marginBottom: 16,
  },
  statusOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  statusOption: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f5f5f5',
    paddingVertical: 16,
    paddingHorizontal: 8,
    borderRadius: 8,
    marginBottom: 12,
  },
  statusOptionText: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
  },
  cancelButton: {
    backgroundColor: '#f5f5f5',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#757575',
    fontWeight: 'bold',
  },
  noteModalContent: {
    backgroundColor: '#fff',
    borderRadius: 8,
    width: '90%',
    padding: 16,
  },
  noteInput: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
    height: 120,
    textAlignVertical: 'top',
    marginBottom: 8,
  },
  characterCount: {
    alignItems: 'flex-end',
    marginBottom: 16,
  },
  characterCountText: {
    color: '#757575',
    fontSize: 12,
  },
  noteModalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  saveButton: {
    backgroundColor: '#2e7d32',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    flex: 1,
    alignItems: 'center',
    marginLeft: 8,
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});

export default BusinessOrdersScreen;