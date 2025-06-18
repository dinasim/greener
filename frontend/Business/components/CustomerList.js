// Business/components/CustomerList.js - Production-Optimized Version
import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Animated,
  Platform,
} from 'react-native';
import { 
  MaterialCommunityIcons, 
  MaterialIcons 
} from '@expo/vector-icons';
import PropTypes from 'prop-types';

// Import components
import CustomerDetailModal from './CustomerDetailModal';
import CustomerSearchBar from './CustomerSearchBar';

const CustomerList = React.memo(({
  customers = [],
  isLoading = false,
  refreshing = false,
  onRefresh = () => {},
  onCustomerPress = () => {},
  onContactCustomer = () => {},
  onViewOrders = () => {},
  businessId
}) => {
  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('lastOrder');
  const [sortOrder, setSortOrder] = useState('desc');
  const [filterBy, setFilterBy] = useState('all');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  
  // Animation refs
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  
  // Memoize expensive calculations
  const customerAnalytics = useMemo(() => {
    const analytics = {
      total: customers.length,
      recent: 0,
      regular: 0,
      vip: 0,
      inactive: 0
    };

    const now = new Date();
    
    customers.forEach(customer => {
      const lastOrderDate = customer.lastOrderDate ? new Date(customer.lastOrderDate) : null;
      const daysSinceLastOrder = lastOrderDate ? 
        Math.floor((now - lastOrderDate) / (1000 * 60 * 60 * 24)) : Infinity;
      
      if (daysSinceLastOrder <= 30) analytics.recent++;
      if ((customer.orderCount || 0) >= 3) analytics.regular++;
      if ((customer.totalSpent || 0) >= 200) analytics.vip++;
      if (daysSinceLastOrder > 90) analytics.inactive++;
    });

    return analytics;
  }, [customers]);

  // Memoize filtered and sorted customers
  const filteredCustomers = useMemo(() => {
    return customers
      .filter(customer => {
        // Search filter
        if (searchQuery) {
          const query = searchQuery.toLowerCase();
          const name = (customer.name || '').toLowerCase();
          const email = (customer.email || '').toLowerCase();
          const phone = (customer.phone || '').toLowerCase();
          
          if (!name.includes(query) && !email.includes(query) && !phone.includes(query)) {
            return false;
          }
        }
        
        // Activity filter
        const now = new Date();
        const lastOrderDate = customer.lastOrderDate ? new Date(customer.lastOrderDate) : null;
        const daysSinceLastOrder = lastOrderDate ? 
          Math.floor((now - lastOrderDate) / (1000 * 60 * 60 * 24)) : Infinity;
        
        switch (filterBy) {
          case 'recent':
            return daysSinceLastOrder <= 30;
          case 'regular':
            return customer.orderCount >= 3;
          case 'vip':
            return customer.totalSpent >= 200;
          case 'inactive':
            return daysSinceLastOrder > 90;
          default:
            return true;
        }
      })
      .sort((a, b) => {
        let valueA, valueB;
        
        switch (sortBy) {
          case 'name':
            valueA = (a.name || '').toLowerCase();
            valueB = (b.name || '').toLowerCase();
            break;
          case 'orderCount':
            valueA = a.orderCount || 0;
            valueB = b.orderCount || 0;
            break;
          case 'totalSpent':
            valueA = a.totalSpent || 0;
            valueB = b.totalSpent || 0;
            break;
          case 'lastOrder':
            valueA = a.lastOrderDate ? new Date(a.lastOrderDate) : new Date(0);
            valueB = b.lastOrderDate ? new Date(b.lastOrderDate) : new Date(0);
            break;
          default:
            return 0;
        }
        
        if (valueA < valueB) return sortOrder === 'asc' ? -1 : 1;
        if (valueA > valueB) return sortOrder === 'asc' ? 1 : -1;
        return 0;
      });
  }, [customers, searchQuery, filterBy, sortBy, sortOrder]);

  // Memoize utility functions
  const getCustomerTier = useCallback((customer) => {
    const totalSpent = customer.totalSpent || 0;
    const orderCount = customer.orderCount || 0;
    
    if (totalSpent >= 500 || orderCount >= 10) return 'vip';
    if (totalSpent >= 200 || orderCount >= 5) return 'premium';
    if (orderCount >= 2) return 'regular';
    return 'new';
  }, []);

  const getTierColor = useCallback((tier) => {
    switch (tier) {
      case 'vip': return '#9C27B0';
      case 'premium': return '#FF9800';
      case 'regular': return '#4CAF50';
      case 'new': return '#2196F3';
      default: return '#757575';
    }
  }, []);

  const getTierIcon = useCallback((tier) => {
    switch (tier) {
      case 'vip': return 'star';
      case 'premium': return 'diamond';
      case 'regular': return 'account-check';
      case 'new': return 'account-plus';
      default: return 'account';
    }
  }, []);

  const formatLastOrder = useCallback((dateString) => {
    if (!dateString) return 'Never';
    
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return `${Math.floor(diffDays / 365)} years ago`;
  }, []);

  // Handle sort with animation
  const handleSort = useCallback((field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
    
    // Animate sort change
    Animated.sequence([
      Animated.timing(fadeAnim, {
        toValue: 0.7,
        duration: 100,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start();
  }, [sortBy, sortOrder, fadeAnim]);

  // Handle customer detail view
  const handleCustomerPress = useCallback((customer) => {
    setSelectedCustomer(customer);
    setDetailModalVisible(true);
    onCustomerPress(customer);
  }, [onCustomerPress]);

  // Handle contact customer with enhanced options
  const handleContactCustomer = useCallback((customer, method = 'auto') => {
    if (method === 'auto') {
      const options = [];
      
      if (customer.phone) {
        options.push({
          text: '📱 Call',
          onPress: () => onContactCustomer(customer, 'call')
        });
        options.push({
          text: '💬 SMS',
          onPress: () => onContactCustomer(customer, 'sms')
        });
      }
      
      if (customer.email) {
        options.push({
          text: '📧 Email',
          onPress: () => onContactCustomer(customer, 'email')
        });
      }
      
      options.push({
        text: '💬 Message',
        onPress: () => onContactCustomer(customer, 'message')
      });
      
      options.push({ text: 'Cancel', style: 'cancel' });
      
      Alert.alert(
        `Contact ${customer.name}`,
        'Choose contact method',
        options
      );
    } else {
      onContactCustomer(customer, method);
    }
  }, [onContactCustomer]);

  const getSortIcon = useCallback((field) => {
    if (sortBy !== field) return 'sort';
    return sortOrder === 'asc' ? 'keyboard-arrow-up' : 'keyboard-arrow-down';
  }, [sortBy, sortOrder]);

  // Optimized customer item renderer with React.memo
  const CustomerItem = React.memo(({ item, onPress, onContact, onViewOrders }) => {
    const tier = getCustomerTier(item);
    const tierColor = getTierColor(tier);
    
    return (
      <Animated.View
        style={[
          styles.customerCard,
          {
            opacity: fadeAnim,
            transform: [{ translateX: slideAnim }],
          }
        ]}
      >
        <TouchableOpacity 
          style={styles.customerContent}
          onPress={() => onPress(item)}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={`View details for ${item.name}`}
        >
          {/* Customer Avatar */}
          <View style={[styles.customerAvatar, { borderColor: tierColor }]}>
            <MaterialIcons name="person" size={28} color={tierColor} />
            <View style={[styles.tierBadge, { backgroundColor: tierColor }]}>
              <MaterialCommunityIcons 
                name={getTierIcon(tier)} 
                size={10} 
                color="#fff" 
              />
            </View>
          </View>
          
          {/* Customer Info */}
          <View style={styles.customerInfo}>
            <View style={styles.customerHeader}>
              <Text style={styles.customerName} numberOfLines={1}>
                {item.name || 'Unknown Customer'}
              </Text>
              <View style={[styles.tierLabel, { backgroundColor: tierColor }]}>
                <Text style={styles.tierText}>
                  {tier.toUpperCase()}
                </Text>
              </View>
            </View>
            
            <Text style={styles.customerEmail} numberOfLines={1}>
              {item.email}
            </Text>
            
            {item.phone && (
              <Text style={styles.customerPhone} numberOfLines={1}>
                {item.phone}
              </Text>
            )}
            
            <View style={styles.customerStats}>
              <View style={styles.statItem}>
                <MaterialIcons name="shopping-cart" size={14} color="#666" />
                <Text style={styles.statText}>
                  {item.orderCount || 0} orders
                </Text>
              </View>
              
              <View style={styles.statItem}>
                <MaterialIcons name="attach-money" size={14} color="#666" />
                <Text style={styles.statText}>
                  ${(item.totalSpent || 0).toFixed(0)} spent
                </Text>
              </View>
              
              <View style={styles.statItem}>
                <MaterialIcons name="schedule" size={14} color="#666" />
                <Text style={styles.statText}>
                  {formatLastOrder(item.lastOrderDate)}
                </Text>
              </View>
            </View>
          </View>
          
          {/* Actions */}
          <View style={styles.customerActions}>
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => onContact(item)}
              accessibilityRole="button"
              accessibilityLabel="Contact customer"
            >
              <MaterialIcons name="phone" size={18} color="#4CAF50" />
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => onViewOrders(item)}
              accessibilityRole="button"
              accessibilityLabel="View customer orders"
            >
              <MaterialIcons name="receipt" size={18} color="#2196F3" />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  });

  // Render customer item with optimization
  const renderCustomerItem = useCallback(({ item }) => (
    <CustomerItem
      item={item}
      onPress={handleCustomerPress}
      onContact={handleContactCustomer}
      onViewOrders={onViewOrders}
    />
  ), [handleCustomerPress, handleContactCustomer, onViewOrders]);

  // Memoized filter tabs
  const filterTabs = useMemo(() => [
    { key: 'all', label: 'All', count: customerAnalytics.total },
    { key: 'recent', label: 'Recent', count: customerAnalytics.recent },
    { key: 'regular', label: 'Regular', count: customerAnalytics.regular },
    { key: 'vip', label: 'VIP', count: customerAnalytics.vip },
  ], [customerAnalytics]);

  // Memoized sort options
  const sortOptions = useMemo(() => [
    { key: 'lastOrder', label: 'Last Order' },
    { key: 'totalSpent', label: 'Total Spent' },
    { key: 'orderCount', label: 'Order Count' },
    { key: 'name', label: 'Name' },
  ], []);

  // Clear filters handler
  const handleClearFilters = useCallback(() => {
    setSearchQuery('');
    setFilterBy('all');
  }, []);

  // Render header with memoization
  const renderHeader = useCallback(() => (
    <View style={styles.header}>
      {/* Search Bar */}
      <CustomerSearchBar
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholder="Search customers by name, email, or phone..."
      />
      
      {/* Filter Tabs */}
      <View style={styles.filterTabs}>
        {filterTabs.map(filter => (
          <TouchableOpacity
            key={filter.key}
            style={[
              styles.filterTab,
              filterBy === filter.key && styles.activeFilterTab
            ]}
            onPress={() => setFilterBy(filter.key)}
            accessibilityRole="button"
            accessibilityLabel={`Filter by ${filter.label}`}
          >
            <Text style={[
              styles.filterTabText,
              filterBy === filter.key && styles.activeFilterTabText
            ]}>
              {filter.label} ({filter.count})
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      
      {/* Sort Options */}
      <View style={styles.sortContainer}>
        <Text style={styles.sortLabel}>Sort by:</Text>
        <View style={styles.sortOptions}>
          {sortOptions.map(sort => (
            <TouchableOpacity
              key={sort.key}
              style={[
                styles.sortOption,
                sortBy === sort.key && styles.activeSortOption
              ]}
              onPress={() => handleSort(sort.key)}
              accessibilityRole="button"
              accessibilityLabel={`Sort by ${sort.label}`}
            >
              <Text style={[
                styles.sortOptionText,
                sortBy === sort.key && styles.activeSortOptionText
              ]}>
                {sort.label}
              </Text>
              {sortBy === sort.key && (
                <MaterialIcons 
                  name={getSortIcon(sort.key)} 
                  size={14} 
                  color="#4CAF50" 
                />
              )}
            </TouchableOpacity>
          ))}
        </View>
      </View>
      
      {/* Results Count */}
      <View style={styles.resultsContainer}>
        <Text style={styles.resultsText}>
          {filteredCustomers.length} of {customers.length} customers
        </Text>
      </View>
    </View>
  ), [searchQuery, filterTabs, filterBy, sortOptions, sortBy, handleSort, getSortIcon, filteredCustomers.length, customers.length]);

  // Render empty state with memoization
  const renderEmptyState = useCallback(() => (
    <View style={styles.emptyContainer}>
      <MaterialCommunityIcons name="account-group-outline" size={64} color="#e0e0e0" />
      <Text style={styles.emptyTitle}>
        {searchQuery || filterBy !== 'all' 
          ? 'No customers match your filters' 
          : 'No customers yet'
        }
      </Text>
      <Text style={styles.emptyText}>
        {searchQuery || filterBy !== 'all'
          ? 'Try adjusting your search or filters'
          : 'Customers will appear here after their first order'
        }
      </Text>
      {(searchQuery || filterBy !== 'all') && (
        <TouchableOpacity 
          style={styles.clearFiltersButton}
          onPress={handleClearFilters}
          accessibilityRole="button"
          accessibilityLabel="Clear all filters"
        >
          <Text style={styles.clearFiltersText}>Clear Filters</Text>
        </TouchableOpacity>
      )}
    </View>
  ), [searchQuery, filterBy, handleClearFilters]);

  // Get item layout for better performance
  const getItemLayout = useCallback((data, index) => ({
    length: 120, // Approximate height of customer card
    offset: 120 * index,
    index,
  }), []);

  // Key extractor
  const keyExtractor = useCallback((item) => item.id || item.email, []);

  if (isLoading && customers.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text style={styles.loadingText}>Loading customers...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={filteredCustomers}
        renderItem={renderCustomerItem}
        keyExtractor={keyExtractor}
        getItemLayout={getItemLayout}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmptyState}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#4CAF50']}
            tintColor="#4CAF50"
          />
        }
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        removeClippedSubviews={true}
        maxToRenderPerBatch={10}
        initialNumToRender={10}
        windowSize={10}
      />
      
      {/* Customer Detail Modal */}
      <CustomerDetailModal
        visible={detailModalVisible}
        customer={selectedCustomer}
        onClose={() => {
          setDetailModalVisible(false);
          setSelectedCustomer(null);
        }}
        onContactCustomer={handleContactCustomer}
        onViewOrders={onViewOrders}
        businessId={businessId}
      />
    </View>
  );
});

// Enhanced styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  header: {
    backgroundColor: '#fff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  filterTabs: {
    flexDirection: 'row',
    marginBottom: 16,
    flexWrap: 'wrap',
    gap: 8,
  },
  filterTab: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  activeFilterTab: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },
  filterTabText: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
  },
  activeFilterTabText: {
    color: '#fff',
    fontWeight: '700',
  },
  sortContainer: {
    marginBottom: 16,
  },
  sortLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    fontWeight: '600',
  },
  sortOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sortOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  activeSortOption: {
    backgroundColor: '#f0f9f3',
    borderColor: '#4CAF50',
  },
  sortOptionText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  activeSortOptionText: {
    color: '#4CAF50',
    fontWeight: '700',
  },
  resultsContainer: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  resultsText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  listContent: {
    paddingBottom: 20,
  },
  customerCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginVertical: 6,
    borderRadius: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  customerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  customerAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#f8f9fa',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    borderWidth: 2.5,
    position: 'relative',
  },
  tierBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  customerInfo: {
    flex: 1,
  },
  customerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  customerName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#2d3436',
    flex: 1,
  },
  tierLabel: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  tierText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#fff',
  },
  customerEmail: {
    fontSize: 14,
    color: '#636e72',
    marginBottom: 2,
  },
  customerPhone: {
    fontSize: 14,
    color: '#636e72',
    marginBottom: 8,
  },
  customerStats: {
    flexDirection: 'row',
    gap: 16,
    flexWrap: 'wrap',
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statText: {
    fontSize: 12,
    color: '#636e72',
    marginLeft: 4,
    fontWeight: '500',
  },
  customerActions: {
    flexDirection: 'row',
    gap: 10,
  },
  actionButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 4,
    flex: 1,
    ...Platform.select({
      web: { boxShadow: '0px 2px 4px rgba(76, 175, 80, 0.3)' },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 3,
        elevation: 3,
      }
    })
  },
  separator: {
    height: 1,
    backgroundColor: 'transparent',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#636e72',
    marginTop: 20,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#b2bec3',
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 24,
  },
  clearFiltersButton: {
    marginTop: 24,
    backgroundColor: '#4CAF50',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 24,
    ...Platform.select({
      ios: {
        shadowColor: '#4CAF50',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  clearFiltersText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
});

CustomerList.propTypes = {
  customers: PropTypes.array,
  isLoading: PropTypes.bool,
  refreshing: PropTypes.bool,
  onRefresh: PropTypes.func,
  onCustomerPress: PropTypes.func,
  onContactCustomer: PropTypes.func,
  onViewOrders: PropTypes.func,
  businessId: PropTypes.string,
};

CustomerList.defaultProps = {
  customers: [],
  isLoading: false,
  refreshing: false,
  onRefresh: () => {},
  onCustomerPress: () => {},
  onContactCustomer: () => {},
  onViewOrders: () => {},
  businessId: null,
};

export default CustomerList;