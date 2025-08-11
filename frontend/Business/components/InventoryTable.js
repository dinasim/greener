// Business/components/InventoryTable.js
import React, { useState, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Alert,
  Animated,
  Platform,
  RefreshControl,
  Modal,
  Linking,
} from 'react-native';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import PropTypes from 'prop-types';

import ProductEditModal from './ProductEditModal';
import LowStockBanner from './LowStockBanner';

const ROW_HEIGHT = 80;

const InventoryTable = React.memo(({
  // data + state
  inventory = [],
  isLoading = false,
  refreshing = false,
  error = null,

  // actions
  onRefresh = () => {},
  onEditProduct = () => {},
  onDeleteProduct = () => {},
  onUpdateStock = () => {},
  onProductPress = () => {},

  // ids / nav
  businessId,
  navigation,

  // NEW: external header/empty to compose a single scroll surface
  ListHeaderComponent = null,
  ListEmptyComponent = null,
}) => {
  // local UI state
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [quickEditModalVisible, setQuickEditModalVisible] = useState(false);
  const [quickEditStock, setQuickEditStock] = useState('');
  const [bulkActionMode, setBulkActionMode] = useState(false);
  const [selectedItems, setSelectedItems] = useState(new Set());

  // animations
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  // derived analytics
  const inventoryAnalytics = useMemo(() => {
    const a = { total: inventory.length, active: 0, inactive: 0, lowStock: 0, discontinued: 0 };
    inventory.forEach(item => {
      const status = item.status || 'active';
      a[status] = (a[status] || 0) + 1;
      if ((item.quantity || 0) <= (item.minThreshold || 5) && status === 'active') a.lowStock += 1;
    });
    return a;
  }, [inventory]);

  const lowStockItems = useMemo(
    () => inventory.filter(item => (item.quantity || 0) <= (item.minThreshold || 5) && item.status === 'active'),
    [inventory]
  );

  // filtering + sorting
  const filteredInventory = useMemo(() => {
    const filtered = inventory.filter(item => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const name = (item.name || item.common_name || '').toLowerCase();
        const scientific = (item.scientific_name || '').toLowerCase();
        if (!name.includes(q) && !scientific.includes(q)) return false;
      }
      if (filterStatus === 'low-stock') return (item.quantity || 0) <= (item.minThreshold || 5);
      if (filterStatus !== 'all') return item.status === filterStatus;
      return true;
    });

    const getVal = (it) => {
      switch (sortBy) {
        case 'name': return (it.name || it.common_name || '').toLowerCase();
        case 'quantity': return it.quantity || 0;
        case 'price': return it.finalPrice || it.price || 0;
        case 'status': return it.status || 'active';
        case 'updated': return new Date(it.lastUpdated || it.dateAdded || 0).getTime();
        default: return 0;
      }
    };

    return filtered.sort((a, b) => {
      const A = getVal(a); const B = getVal(b);
      if (A < B) return sortOrder === 'asc' ? -1 : 1;
      if (A > B) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [inventory, searchQuery, filterStatus, sortBy, sortOrder]);

  // helpers
  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return '#4CAF50';
      case 'inactive': return '#FF9800';
      case 'discontinued': return '#F44336';
      default: return '#757575';
    }
  };

  const getSortIcon = (field) => {
    if (sortBy !== field) return 'sort';
    return sortOrder === 'asc' ? 'keyboard-arrow-up' : 'keyboard-arrow-down';
  };

  const handleSort = (field) => {
    if (sortBy === field) setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    else { setSortBy(field); setSortOrder('asc'); }
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 0.7, duration: 100, useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 100, useNativeDriver: Platform.OS !== 'web' }),
    ]).start();
  };

  const handleEditPress = (product) => { setSelectedProduct(product); setEditModalVisible(true); };
  const handleQuickStockEdit = (product) => {
    setSelectedProduct(product);
    setQuickEditStock(String(product.quantity || 0));
    setQuickEditModalVisible(true);
  };

  const handleQuickStockUpdate = async () => {
    const newStock = parseInt(quickEditStock, 10);
    if (Number.isNaN(newStock) || newStock < 0) {
      Alert.alert('Invalid Stock', 'Please enter a valid stock quantity'); return;
    }
    try {
      await onUpdateStock(selectedProduct.id, newStock);
      setQuickEditModalVisible(false);
      setSelectedProduct(null);
      setQuickEditStock('');
      Animated.sequence([
        Animated.timing(slideAnim, { toValue: 10, duration: 100, useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(slideAnim, { toValue: -10, duration: 100, useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(slideAnim, { toValue: 0, duration: 100, useNativeDriver: Platform.OS !== 'web' }),
      ]).start();
    } catch (e) {
      Alert.alert('Error', `Failed to update stock: ${e.message}`);
    }
  };

  const handleDeletePress = (product) => {
    Alert.alert(
      'Delete Product',
      `Are you sure you want to delete "${product.name || product.common_name}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => onDeleteProduct(product.id) },
      ]
    );
  };

  const toggleBulkActionMode = () => { setBulkActionMode(v => !v); setSelectedItems(new Set()); };
  const toggleItemSelection = (id) => {
    const s = new Set(selectedItems);
    s.has(id) ? s.delete(id) : s.add(id);
    setSelectedItems(s);
  };

  const handleBulkAction = (action) => {
    if (selectedItems.size === 0) { Alert.alert('No Items Selected', 'Please select items first'); return; }
    const chosen = filteredInventory.filter(i => selectedItems.has(i.id));
    if (action === 'delete') {
      Alert.alert('Delete Selected Items', `Are you sure you want to delete ${selectedItems.size} items?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            chosen.forEach(p => onDeleteProduct(p.id));
            setBulkActionMode(false); setSelectedItems(new Set());
          }
        }
      ]);
      return;
    }
    const patch = action === 'activate' ? { status: 'active' } : { status: 'inactive' };
    chosen.forEach(p => onEditProduct(p.id, patch));
    setBulkActionMode(false); setSelectedItems(new Set());
  };

  const handleLocationPress = (item) => {
    if (!item.location?.coordinates) return;
    const { latitude, longitude } = item.location.coordinates;
    const url = Platform.select({
      ios: `maps:0,0?q=${latitude},${longitude}`,
      android: `geo:0,0?q=${latitude},${longitude}`,
      default: `https://www.google.com/maps?q=${latitude},${longitude}`,
    });
    Linking.openURL(url).catch(() => Alert.alert('Error', 'Could not open maps application'));
  };

  // row component
  const InventoryItem = React.memo(({ item, index, isSelected }) => (
    <Animated.View
      style={[
        styles.tableRow,
        { opacity: fadeAnim, transform: [{ translateX: slideAnim }] },
        index % 2 === 0 && styles.evenRow,
        isSelected && styles.selectedRow,
      ]}
    >
      {bulkActionMode && (
        <TouchableOpacity
          style={styles.tableCell}
          onPress={() => toggleItemSelection(item.id)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: isSelected }}
        >
          <MaterialIcons
            name={isSelected ? 'check-box' : 'check-box-outline-blank'}
            size={20}
            color="#4CAF50"
          />
        </TouchableOpacity>
      )}

      <TouchableOpacity
        style={[styles.tableCell, styles.nameCell]}
        onPress={() => onProductPress(item)}
        accessibilityRole="button"
        accessibilityLabel={`View details for ${item.name || item.common_name}`}
      >
        <View style={styles.productInfo}>
          <View style={styles.productIcon}>
            <MaterialCommunityIcons
              name={item.productType === 'plant' ? 'leaf' : 'cube-outline'}
              size={20}
              color="#4CAF50"
            />
          </View>
          <View style={styles.productDetails}>
            <Text style={styles.productName} numberOfLines={1}>
              {item.name || item.common_name || 'Unknown Product'}
            </Text>
            {item.scientific_name && (
              <Text style={styles.productScientific} numberOfLines={1}>
                {item.scientific_name}
              </Text>
            )}
            <View style={styles.productMetaInfo}>
              {item.location?.coordinates && (
                <TouchableOpacity
                  style={styles.metaInfoItem}
                  onPress={() => handleLocationPress(item)}
                  accessibilityRole="button"
                  accessibilityLabel="View location on map"
                >
                  <MaterialIcons name="location-on" size={12} color="#2196F3" />
                  <Text style={styles.metaInfoText}>GPS</Text>
                </TouchableOpacity>
              )}
              {item.lastWatered && (
                <View style={styles.metaInfoItem}>
                  <MaterialCommunityIcons name="water" size={12} color="#00BCD4" />
                  <Text style={styles.metaInfoText}>
                    {new Date(item.lastWatered).toLocaleDateString()}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.tableCell}
        onPress={() => handleQuickStockEdit(item)}
        accessibilityRole="button"
        accessibilityLabel="Edit stock quantity"
      >
        <View style={styles.stockContainer}>
          <Text
            style={[
              styles.stockText,
              (item.quantity || 0) <= (item.minThreshold || 5) && styles.lowStockText,
            ]}
          >
            {item.quantity || 0}
          </Text>
          {(item.quantity || 0) <= (item.minThreshold || 5) && (
            <MaterialIcons name="alert" size={14} color="#FF9800" />
          )}
        </View>
        <Text style={styles.thresholdText}>Min: {item.minThreshold || 5}</Text>
      </TouchableOpacity>

      <View style={styles.tableCell}>
        <Text style={styles.priceText}>${(item.finalPrice || item.price || 0).toFixed(2)}</Text>
        {item.discount > 0 && <Text style={styles.discountText}>-{item.discount}%</Text>}
      </View>

      <View style={styles.tableCell}>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
          <Text style={styles.statusText}>
            {(item.status || 'active').replace(/^./, c => c.toUpperCase())}
          </Text>
        </View>
      </View>

      <View style={styles.tableCell}>
        <View style={styles.actionsContainer}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleEditPress(item)}
            accessibilityRole="button"
            accessibilityLabel="Edit product"
          >
            <MaterialIcons name="edit" size={16} color="#2196F3" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleDeletePress(item)}
            accessibilityRole="button"
            accessibilityLabel="Delete product"
          >
            <MaterialIcons name="delete" size={16} color="#f44336" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() =>
              Alert.alert(
                'Product Details',
                `Name: ${item.name || item.common_name}\nStock: ${item.quantity}\nPrice: $${(item.price || 0).toFixed(2)}\nStatus: ${item.status}\n${
                  item.notes ? `Notes: ${item.notes}` : ''
                }`,
                [{ text: 'OK' }]
              )
            }
            accessibilityRole="button"
            accessibilityLabel="View product details"
          >
            <MaterialIcons name="info" size={16} color="#9C27B0" />
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  ));

  const renderInventoryItem = useCallback(
    ({ item, index }) => (
      <InventoryItem
        item={item}
        index={index}
        isSelected={selectedItems.has(item.id)}
      />
    ),
    [selectedItems]
  );

  const filterTabs = useMemo(
    () => [
      { key: 'all', label: 'All', count: inventoryAnalytics.total },
      { key: 'active', label: 'Active', count: inventoryAnalytics.active },
      { key: 'low-stock', label: 'Low Stock', count: inventoryAnalytics.lowStock },
      { key: 'inactive', label: 'Inactive', count: inventoryAnalytics.inactive },
    ],
    [inventoryAnalytics]
  );

  const handleClearFilters = () => { setSearchQuery(''); setFilterStatus('all'); };

  const TableHeader = useCallback(() => (
    <Animated.View
      style={[
        styles.tableHeader,
        { opacity: fadeAnim, transform: [{ translateX: slideAnim }] },
      ]}
    >
      {bulkActionMode && (
        <TouchableOpacity
          style={styles.headerCell}
          onPress={() => {
            if (selectedItems.size === filteredInventory.length) setSelectedItems(new Set());
            else setSelectedItems(new Set(filteredInventory.map(i => i.id)));
          }}
          accessibilityRole="checkbox"
          accessibilityLabel="Select all items"
        >
          <MaterialIcons
            name={selectedItems.size === filteredInventory.length ? 'check-box' : 'check-box-outline-blank'}
            size={20}
            color="#4CAF50"
          />
        </TouchableOpacity>
      )}

      <TouchableOpacity
        style={[styles.headerCell, styles.nameCell]}
        onPress={() => handleSort('name')}
        accessibilityRole="button"
        accessibilityLabel="Sort by product name"
      >
        <Text style={styles.headerText}>Product</Text>
        <MaterialIcons name={getSortIcon('name')} size={16} color="#666" />
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.headerCell}
        onPress={() => handleSort('quantity')}
        accessibilityRole="button"
        accessibilityLabel="Sort by stock quantity"
      >
        <Text style={styles.headerText}>Stock</Text>
        <MaterialIcons name={getSortIcon('quantity')} size={16} color="#666" />
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.headerCell}
        onPress={() => handleSort('price')}
        accessibilityRole="button"
        accessibilityLabel="Sort by price"
      >
        <Text style={styles.headerText}>Price</Text>
        <MaterialIcons name={getSortIcon('price')} size={16} color="#666" />
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.headerCell}
        onPress={() => handleSort('status')}
        accessibilityRole="button"
        accessibilityLabel="Sort by status"
      >
        <Text style={styles.headerText}>Status</Text>
        <MaterialIcons name={getSortIcon('status')} size={16} color="#666" />
      </TouchableOpacity>

      <View style={styles.headerCell}><Text style={styles.headerText}>Actions</Text></View>
    </Animated.View>
  ), [fadeAnim, slideAnim, bulkActionMode, selectedItems, filteredInventory, sortBy, sortOrder]);

  // Build one unified list header (external header + our controls + table header)
  const UnifiedHeader = useMemo(() => (
    <View>
      {/* external header from parent (e.g., KPI widgets) */}
      {ListHeaderComponent ? <View>{ListHeaderComponent}</View> : null}

      {/* low stock banner */}
      {lowStockItems.length > 0 && (
        <LowStockBanner
          lowStockItems={lowStockItems}
          onManageStock={() => {}}
        />
      )}

      {/* controls */}
      <View style={styles.controlsContainer}>
        <View style={styles.searchContainer}>
          <MaterialIcons name="search" size={20} color="#4CAF50" />
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search products..."
            placeholderTextColor="#999"
            returnKeyType="search"
            accessibilityLabel="Search products"
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <MaterialIcons name="clear" size={20} color="#999" />
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={styles.filterTabs}>
          {filterTabs.map(filter => (
            <TouchableOpacity
              key={filter.key}
              style={[styles.filterTab, filterStatus === filter.key && styles.activeFilterTab]}
              onPress={() => setFilterStatus(filter.key)}
              accessibilityRole="button"
              accessibilityLabel={`Filter by ${filter.label}`}
            >
              <Text style={[styles.filterTabText, filterStatus === filter.key && styles.activeFilterTabText]}>
                {filter.label} ({filter.count})
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.bulkActionsContainer}>
          <TouchableOpacity
            style={[styles.bulkActionButton, bulkActionMode && styles.activeBulkButton]}
            onPress={toggleBulkActionMode}
            accessibilityRole="button"
            accessibilityLabel={bulkActionMode ? 'Cancel bulk edit' : 'Enable bulk edit'}
          >
            <MaterialIcons name={bulkActionMode ? 'close' : 'checklist'} size={16} color={bulkActionMode ? '#fff' : '#4CAF50'} />
            <Text style={[styles.bulkActionText, bulkActionMode && styles.activeBulkText]}>
              {bulkActionMode ? 'Cancel' : 'Bulk Edit'}
            </Text>
          </TouchableOpacity>

          {bulkActionMode && selectedItems.size > 0 && (
            <View style={styles.bulkActions}>
              <TouchableOpacity style={styles.bulkAction} onPress={() => handleBulkAction('activate')}>
                <MaterialIcons name="visibility" size={16} color="#4CAF50" />
                <Text style={styles.bulkActionLabel}>Activate</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.bulkAction} onPress={() => handleBulkAction('deactivate')}>
                <MaterialIcons name="visibility-off" size={16} color="#FF9800" />
                <Text style={styles.bulkActionLabel}>Deactivate</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.bulkAction} onPress={() => handleBulkAction('delete')}>
                <MaterialIcons name="delete" size={16} color="#f44336" />
                <Text style={styles.bulkActionLabel}>Delete</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>

      {/* results count */}
      <View style={styles.resultsContainer}>
        <Text style={styles.resultsText}>
          Showing {filteredInventory.length} of {inventory.length} products
        </Text>
        {bulkActionMode && selectedItems.size > 0 && (
          <Text style={styles.selectedText}>{selectedItems.size} selected</Text>
        )}
      </View>

      {/* column header */}
      <TableHeader />
    </View>
  ), [ListHeaderComponent, lowStockItems, searchQuery, filterStatus, filterTabs, bulkActionMode, selectedItems, filteredInventory.length, inventory.length, TableHeader]);

  const getItemLayout = useCallback((_, index) => ({
    length: ROW_HEIGHT,
    offset: ROW_HEIGHT * index,
    index,
  }), []);

  const keyExtractor = useCallback((item) => item.id, []);

  if (error) {
    return (
      <View style={styles.emptyContainer} accessibilityRole="alert">
        <MaterialIcons name="error-outline" size={48} color="#f44336" />
        <Text style={styles.emptyText}>{error}</Text>
      </View>
    );
  }

  const DefaultEmpty = (
    <View style={styles.emptyContainer}>
      <MaterialCommunityIcons name="package-variant-closed" size={48} color="#e0e0e0" />
      <Text style={styles.emptyText}>
        {searchQuery || filterStatus !== 'all'
          ? 'No products match your filters'
          : 'No products in inventory yet'}
      </Text>
      {searchQuery || filterStatus !== 'all' ? (
        <TouchableOpacity onPress={handleClearFilters}>
          <Text style={styles.clearFiltersText}>Clear filters</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={filteredInventory}
        renderItem={renderInventoryItem}
        keyExtractor={keyExtractor}
        getItemLayout={getItemLayout}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#4CAF50']} tintColor="#4CAF50" />
        }
        ListHeaderComponent={UnifiedHeader}   // << single scrolling surface
        ListEmptyComponent={ListEmptyComponent || DefaultEmpty}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews
        maxToRenderPerBatch={15}
        initialNumToRender={15}
        windowSize={10}
        contentContainerStyle={{ paddingBottom: 16 }}
      />

      {/* Edit modal */}
      <ProductEditModal
        visible={editModalVisible}
        product={selectedProduct}
        onClose={() => { setEditModalVisible(false); setSelectedProduct(null); }}
        onSave={(updated) => { onEditProduct(selectedProduct.id, updated); setEditModalVisible(false); setSelectedProduct(null); }}
        businessId={businessId}
      />

      {/* Quick stock modal */}
      <Modal
        visible={quickEditModalVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setQuickEditModalVisible(false)}
      >
        <View style={styles.quickEditOverlay}>
          <View style={styles.quickEditModal}>
            <Text style={styles.quickEditTitle}>Update Stock</Text>
            <Text style={styles.quickEditProduct}>{selectedProduct?.name || selectedProduct?.common_name}</Text>
            <TextInput
              style={styles.quickEditInput}
              value={quickEditStock}
              onChangeText={setQuickEditStock}
              placeholder="Enter new stock quantity"
              keyboardType="numeric"
              autoFocus
            />
            <View style={styles.quickEditActions}>
              <TouchableOpacity style={styles.quickEditCancel} onPress={() => setQuickEditModalVisible(false)}>
                <Text style={styles.quickEditCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.quickEditSave} onPress={handleQuickStockUpdate}>
                <Text style={styles.quickEditSaveText}>Update</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
});

InventoryTable.propTypes = {
  inventory: PropTypes.array,
  isLoading: PropTypes.bool,
  refreshing: PropTypes.bool,
  error: PropTypes.string,
  onRefresh: PropTypes.func,
  onEditProduct: PropTypes.func,
  onDeleteProduct: PropTypes.func,
  onUpdateStock: PropTypes.func,
  onProductPress: PropTypes.func,
  businessId: PropTypes.string,
  navigation: PropTypes.object,
  ListHeaderComponent: PropTypes.any,
  ListEmptyComponent: PropTypes.any,
};

export default InventoryTable;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },

  controlsContainer: {
    backgroundColor: '#fff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2 },
      android: { elevation: 2 },
    }),
  },
  searchContainer: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#f5f5f5',
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, marginBottom: 16,
    borderWidth: 1, borderColor: '#e9ecef',
  },
  searchInput: { flex: 1, fontSize: 16, color: '#333', marginLeft: 12 },
  filterTabs: { flexDirection: 'row', marginBottom: 16, flexWrap: 'wrap', gap: 8 },
  filterTab: {
    paddingVertical: 10, paddingHorizontal: 16, borderRadius: 20,
    backgroundColor: '#f5f5f5', borderWidth: 1, borderColor: '#e0e0e0',
  },
  activeFilterTab: { backgroundColor: '#4CAF50', borderColor: '#4CAF50' },
  filterTabText: { fontSize: 13, color: '#666', fontWeight: '500' },
  activeFilterTabText: { color: '#fff', fontWeight: '700' },
  bulkActionsContainer: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  bulkActionButton: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 16,
    borderRadius: 20, borderWidth: 1.5, borderColor: '#4CAF50', backgroundColor: '#fff',
  },
  activeBulkButton: { backgroundColor: '#4CAF50' },
  bulkActionText: { fontSize: 13, color: '#4CAF50', marginLeft: 6, fontWeight: '600' },
  activeBulkText: { color: '#fff' },
  bulkActions: { flexDirection: 'row', gap: 8 },
  bulkAction: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 12,
    borderRadius: 16, backgroundColor: '#f5f5f5', borderWidth: 1, borderColor: '#e0e0e0',
  },
  bulkActionLabel: { fontSize: 11, color: '#666', marginLeft: 4, fontWeight: '500' },

  resultsContainer: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#f8f9fa',
    borderBottomWidth: 1, borderBottomColor: '#e0e0e0',
  },
  resultsText: { fontSize: 13, color: '#666', fontWeight: '500' },
  selectedText: { fontSize: 13, color: '#4CAF50', fontWeight: '700' },

  tableHeader: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 16,
    backgroundColor: '#f8f9fa', borderBottomWidth: 2, borderBottomColor: '#e0e0e0',
  },
  headerCell: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 6 },
  nameCell: { flex: 2.5 },
  headerText: { fontSize: 13, fontWeight: '700', color: '#2d3436' },

  tableRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 16, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
    minHeight: ROW_HEIGHT,
    backgroundColor: '#fff',
  },
  evenRow: { backgroundColor: '#fafafa' },
  selectedRow: { backgroundColor: '#e8f5e8' },

  tableCell: { paddingHorizontal: 6, justifyContent: 'center' },
  productInfo: { flexDirection: 'row', alignItems: 'center' },
  productIcon: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: '#f0f9f3',
    justifyContent: 'center', alignItems: 'center', marginRight: 12, borderWidth: 1, borderColor: '#e8f5e8',
  },
  productDetails: { flex: 1 },
  productName: { fontSize: 15, fontWeight: '700', color: '#2d3436', lineHeight: 20 },
  productScientific: { fontSize: 13, fontStyle: 'italic', color: '#636e72', marginTop: 2 },
  productMetaInfo: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  metaInfoItem: { flexDirection: 'row', alignItems: 'center', marginRight: 16 },
  metaInfoText: { fontSize: 12, color: '#2196F3', marginLeft: 4, fontWeight: '500' },

  stockContainer: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stockText: { fontSize: 15, fontWeight: '700', color: '#2d3436' },
  lowStockText: { color: '#FF9800' },
  thresholdText: { fontSize: 12, color: '#636e72', marginTop: 4, fontWeight: '500' },
  priceText: { fontSize: 15, fontWeight: '700', color: '#4CAF50' },
  discountText: { fontSize: 12, color: '#f44336', marginTop: 4, fontWeight: '600' },

  statusBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16 },
  statusText: { fontSize: 11, fontWeight: '700', color: '#fff' },

  actionsContainer: { flexDirection: 'row', gap: 8 },
  actionButton: {
    padding: 8, borderRadius: 8, backgroundColor: '#f8f9fa', borderWidth: 1, borderColor: '#e9ecef',
    ...Platform.select({
      web: { boxShadow: '0px 1px 2px rgba(0,0,0,0.05)' },
      default: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 }
    })
  },

  emptyContainer: { alignItems: 'center', paddingVertical: 80, paddingHorizontal: 32 },
  emptyText: { fontSize: 18, color: '#636e72', textAlign: 'center', marginTop: 20, fontWeight: '500' },
  clearFiltersText: { fontSize: 16, color: '#4CAF50', marginTop: 16, fontWeight: '600' },

  // quick edit modal
  quickEditOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  quickEditModal: {
    backgroundColor: '#fff', borderRadius: 20, padding: 28, width: '85%', maxWidth: 400,
    ...Platform.select({
      web: { boxShadow: '0px 10px 20px rgba(0,0,0,0.3)' },
      default: { shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 10 }
    })
  },
  quickEditTitle: { fontSize: 20, fontWeight: '700', color: '#2d3436', textAlign: 'center', marginBottom: 8 },
  quickEditProduct: { fontSize: 16, color: '#636e72', textAlign: 'center', marginBottom: 24, fontWeight: '500' },
  quickEditInput: {
    borderWidth: 2, borderColor: '#e0e0e0', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 16,
    fontSize: 18, marginBottom: 24, textAlign: 'center', fontWeight: '600',
  },
  quickEditActions: { flexDirection: 'row', gap: 16 },
  quickEditCancel: { flex: 1, paddingVertical: 16, borderRadius: 12, borderWidth: 1.5, borderColor: '#e0e0e0', alignItems: 'center' },
  quickEditCancelText: { fontSize: 16, color: '#636e72', fontWeight: '600' },
  quickEditSave: {
    flex: 1, paddingVertical: 16, borderRadius: 12, backgroundColor: '#4CAF50', alignItems: 'center',
    ...Platform.select({
      web: { boxShadow: '0px 2px 4px rgba(76,175,80,0.2)' },
      default: { shadowColor: '#4CAF50', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 3 }
    })
  },
  quickEditSaveText: { fontSize: 16, fontWeight: '700', color: '#fff' },
});
