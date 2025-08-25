import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  FlatList,
  RefreshControl,
  TextInput,
  Alert
} from 'react-native';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import BusinessLayout from '../components/BusinessLayout';

export default function BusinessCustomersScreen({ navigation, route }) {
  const { businessId } = route.params || {};
  const [customers, setCustomers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredCustomers, setFilteredCustomers] = useState([]);
  const [stats, setStats] = useState({
    totalCustomers: 0,
    totalRevenue: 0,
    averageOrderValue: 0
  });

  useEffect(() => {
    loadCustomers();
  }, []);

  useEffect(() => {
    // Filter customers based on search query
    if (searchQuery.trim()) {
      const filtered = customers.filter(customer =>
        customer.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        customer.email?.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredCustomers(filtered);
    } else {
      setFilteredCustomers(customers);
    }
  }, [searchQuery, customers]);

  const loadCustomers = async () => {
    try {
      setError(null);

      const userEmail = await AsyncStorage.getItem('userEmail');
      const authToken = await AsyncStorage.getItem('googleAuthToken');

      if (!userEmail) {
        setError('Business authentication required');
        return;
      }

      const headers = {
        'Content-Type': 'application/json',
        'X-User-Email': userEmail,
      };

      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }

      console.log('👥 Fetching customers data for business:', userEmail);

      const response = await fetch(
        'https://usersfunctions.azurewebsites.net/api/business/customers',
        {
          method: 'GET',
          headers,
        }
      );

      if (!response.ok) {
        if (response.status === 404) {
          setError('No customers found.');
          setIsLoading(false);
          return;
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('✅ Customers data loaded:', data);

      if (data.success) {
        setCustomers(data.customers || []);
        setFilteredCustomers(data.customers || []);
        setStats({
          totalCustomers: data.totalCustomers || 0,
          totalRevenue: data.totalRevenue || 0,
          averageOrderValue: data.averageOrderValue || 0
        });
      } else {
        throw new Error(data.error || 'Failed to load customers');
      }
    } catch (err) {
      console.error('❌ Customers error:', err);
      setError(`Failed to load customers: ${err.message}`);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadCustomers();
  };

  // Build a deterministic room id between business and customer (lowercase + sorted)
  const makeRoomId = (a, b) => {
    const norm = (s) => String(s || '').trim().toLowerCase();
    const [x, y] = [norm(a), norm(b)].sort();
    return `${encodeURIComponent(x)}__${encodeURIComponent(y)}`;
  };

  // Best-effort route name resolver (works with different navigator setups)
  const resolveMessagesRoute = () => {
    const candidates = [
      'MessagesScreen',          // common
      'Messages',                // alt
      'BusinessMessagesScreen',  // business-specific
      'ChatScreen',
      'Chat',
    ];
    const state = navigation?.getState?.();
    const routeNames = state?.routeNames || [];
    return candidates.find((r) => routeNames.includes(r)) || candidates[0];
  };

  // Open Messages inbox (header button)
  const openMessagesInbox = () => {
    const route = resolveMessagesRoute();
    navigation.navigate(route, { via: 'business-customers' });
  };

  // Open Messages with preselected peer + room id (kept for long-press on a row)
  const openMessages = async (customer) => {
    try {
      const businessEmail = (await AsyncStorage.getItem('userEmail')) || businessId;
      if (!businessEmail) {
        Alert.alert('Chat unavailable', 'Business authentication required.');
        return;
      }

      const roomId = makeRoomId(businessEmail, customer?.email);
      const route = resolveMessagesRoute();

      navigation.navigate(route, {
        isBusiness: true,
        via: 'business-customers',
        roomId,
        peer: {
          email: customer?.email,
          name: customer?.name || customer?.email || 'Customer',
          avatar: customer?.avatarUrl,
        },
        business: { email: businessEmail },
      });
    } catch (e) {
      Alert.alert('Chat unavailable', e?.message || 'Could not open messages.');
    }
  };

  const renderCustomerItem = ({ item }) => (
    <TouchableOpacity
      style={styles.customerItem}
      onLongPress={() => openMessages(item)}
      delayLongPress={250}
      accessibilityHint="Long-press to open chat with this customer"
    >
      <View style={styles.customerAvatar}>
        <Text style={styles.customerInitial}>
          {(item.name || item.email || 'C').charAt(0).toUpperCase()}
        </Text>
      </View>
      <View style={styles.customerInfo}>
        <Text style={styles.customerName}>{item.name || 'Customer'}</Text>
        <Text style={styles.customerEmail}>{item.email}</Text>
        <View style={styles.customerStats}>
          <Text style={styles.customerStat}>
            {item.orderCount || 0} orders
          </Text>
          <Text style={styles.customerStat}>
            ₪{item.totalSpent || 0} spent
          </Text>
        </View>
        <View style={styles.customerDates}>
          <Text style={styles.customerDate}>
            First order: {item.firstOrderDate ? new Date(item.firstOrderDate).toLocaleDateString() : 'N/A'}
          </Text>
          <Text style={styles.customerDate}>
            Last order: {item.lastOrderDate ? new Date(item.lastOrderDate).toLocaleDateString() : 'N/A'}
          </Text>
        </View>
      </View>
      {/* Per-card message button removed per request */}
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <MaterialIcons name="people-outline" size={64} color="#e0e0e0" />
      <Text style={styles.emptyTitle}>No Customers Yet</Text>
      <Text style={styles.emptyText}>
        When customers place orders, they'll appear here
      </Text>
    </View>
  );

  if (isLoading) {
    return (
      <BusinessLayout navigation={navigation} businessId={businessId} currentTab="customers">
        <SafeAreaView style={styles.container}>
          <StatusBar barStyle="dark-content" backgroundColor="#fff" />
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
              <MaterialIcons name="arrow-back" size={24} color="#216a94" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Customers</Text>
            <View style={styles.headerRight}>
              <TouchableOpacity
                style={styles.iconButton}
                onPress={onRefresh}
                accessibilityLabel="Refresh"
              >
                <MaterialIcons name="refresh" size={24} color="#216a94" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.iconButton}
                onPress={openMessagesInbox}
                accessibilityLabel="Open Messages"
              >
                <MaterialIcons name="chat" size={24} color="#216a94" />
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.centered}>
            <ActivityIndicator size="large" color="#216a94" />
            <Text style={styles.loadingText}>Loading customers...</Text>
          </View>
        </SafeAreaView>
      </BusinessLayout>
    );
  }

  if (error && !isLoading && customers.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <MaterialIcons name="arrow-back" size={24} color="#216a94" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Customers</Text>
          <View style={styles.headerRight}>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={onRefresh}
              accessibilityLabel="Refresh"
            >
              <MaterialIcons name="refresh" size={24} color="#216a94" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={openMessagesInbox}
              accessibilityLabel="Open Messages"
            >
              <MaterialIcons name="chat" size={24} color="#216a94" />
            </TouchableOpacity>
          </View>
        </View>
        <View className={styles.centered}>
          <MaterialIcons name="error-outline" size={48} color="#f44336" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadCustomers}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <BusinessLayout
      navigation={navigation}
      businessId={businessId}
      currentTab="customers"
      badges={{}} // or e.g. { customers: stats.totalCustomers }
    >
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />

        {/* Header with Back, Refresh, Messages */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <MaterialIcons name="arrow-back" size={24} color="#216a94" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Customers</Text>
          <View style={styles.headerRight}>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={onRefresh}
              accessibilityLabel="Refresh"
            >
              <MaterialIcons name="refresh" size={24} color="#216a94" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={openMessagesInbox}
              accessibilityLabel="Open Messages"
            >
              <MaterialIcons name="chat" size={24} color="#216a94" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <MaterialIcons name="search" size={20} color="#666" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search customers..."
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <MaterialIcons name="close" size={20} color="#666" />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Customer Stats */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <MaterialIcons name="people" size={24} color="#216a94" />
            <Text style={styles.statNumber}>{stats.totalCustomers}</Text>
            <Text style={styles.statLabel}>Total Customers</Text>
          </View>
          <View style={styles.statCard}>
            <MaterialIcons name="monetization-on" size={24} color="#4CAF50" />
            <Text style={styles.statNumber}>₪{stats.totalRevenue}</Text>
            <Text style={styles.statLabel}>Total Revenue</Text>
          </View>
          <View style={styles.statCard}>
            <MaterialIcons name="shopping-cart" size={24} color="#FF9800" />
            <Text style={styles.statNumber}>₪{stats.averageOrderValue}</Text>
            <Text style={styles.statLabel}>Avg Order Value</Text>
          </View>
        </View>

        {/* Error Message */}
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Customer List */}
        <FlatList
          data={filteredCustomers}
          renderItem={renderCustomerItem}
          keyExtractor={(item) => item.id || item.email}
          style={styles.customerList}
          ListEmptyComponent={renderEmptyState}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          showsVerticalScrollIndicator={false}
        />
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
  headerRight: {
    flexDirection: 'row',
    gap: 8,
  },
  iconButton: {
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
  errorText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 16,
    backgroundColor: '#216a94',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '600',
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
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 11,
    color: '#666',
    marginTop: 4,
    textAlign: 'center',
  },
  customerList: {
    flex: 1,
    paddingHorizontal: 16,
  },
  customerItem: {
    flexDirection: 'row',
    alignItems: 'center',
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
  customerAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#216a94',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  customerInitial: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  customerInfo: {
    flex: 1,
  },
  customerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  customerEmail: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  customerStats: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 4,
  },
  customerStat: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: '500',
  },
  customerDates: {
    marginTop: 4,
  },
  customerDate: {
    fontSize: 10,
    color: '#999',
    marginBottom: 2,
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
  errorContainer: {
    backgroundColor: '#fff3f3',
    borderLeftWidth: 4,
    borderLeftColor: '#f44336',
    padding: 16,
    margin: 16,
    borderRadius: 8,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
});
