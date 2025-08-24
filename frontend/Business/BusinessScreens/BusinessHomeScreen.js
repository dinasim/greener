// screens/Business/BusinessScreens/BusinessHomeScreen.js
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  Image,
  Alert,
  Linking,
  Modal,
  Platform
} from 'react-native';
import {
  MaterialCommunityIcons,
  MaterialIcons,
  FontAwesome,
} from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { ensureChatFCMOnce } from '../../notifications/chatFCMSetup';
// ✅ Layout wrapper (ensures the bottom BusinessNavigationBar is shown)
import BusinessLayout from '../components/BusinessLayout';

// Import Business Components
import KPIWidget from '../components/KPIWidget';
import BusinessDashboardCharts from '../components/BusinessDashboardCharts';
import TopSellingProductsList from '../components/TopSellingProductsList';
import OrderDetailModal from '../components/OrderDetailModal';
import { getBusinessDashboard } from '../services/businessApi';

// ⤵️ Path to AI screen (we're inside screens/Business/BusinessScreens)
import AIPlantCareAssistant from '../../screens/AIPlantCareAssistant';

const DEFAULT_BUSINESS_IMAGE =
  'https://images.unsplash.com/photo-1441986300917-64674bd600d8?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D';

export default function BusinessHomeScreen({ navigation }) {
  const [dashboardData, setDashboardData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [businessId, setBusinessId] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [assistantVisible, setAssistantVisible] = useState(false);

  // Load dashboard data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadDashboardData();
    }, [])
  );

  // Initialize business ID
  useEffect(() => {
    const initializeBusinessId = async () => {
      try {
        const email = await AsyncStorage.getItem('userEmail');
        const storedBusinessId = await AsyncStorage.getItem('businessId');
        const id = storedBusinessId || email;
        setBusinessId(id);
      } catch (error) {
        console.error('Error getting business ID:', error);
      }
    };

    initializeBusinessId();
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    if (!businessId) return;               // wait until AsyncStorage loads it
    (async () => {
      const tok = await ensureChatFCMOnce(businessId);
      console.log('[FCM] Home(business) token', tok ? tok.slice(0, 16) + '...' : 'none');
    })();
  }, [businessId]);

  const loadDashboardData = async () => {
    if (refreshing) return;
    setIsLoading(!dashboardData);
    setError(null);
    setRefreshing(true);
    try {
      const data = await getBusinessDashboard(); // already normalized
      setDashboardData(data);
    } catch (err) {
      console.error('❌ Error loading dashboard:', err);
      setError(`Could not load dashboard data: ${err.message}`);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  // Fallback data when backend fails
  const getFallbackData = () => ({
    businessInfo: {
      businessName: 'Your Business',
      businessType: 'Plant Business',
      businessLogo: null,
      email: businessId || 'business@example.com',
      rating: 0,
      reviewCount: 0,
    },
    metrics: {
      totalSales: 0,
      salesToday: 0,
      newOrders: 0,
      lowStockItems: 0,
      totalInventory: 0,
      activeInventory: 0,
      totalOrders: 0,
      inventoryValue: 0,
    },
    topProducts: [],
    recentOrders: [],
    chartData: {
      sales: { labels: [], values: [], total: 0, average: 0 },
      orders: { pending: 0, confirmed: 0, ready: 0, completed: 0, total: 0 },
      inventory: { inStock: 0, lowStock: 0, outOfStock: 0 },
    },
  });

  const onRefresh = () => {
    loadDashboardData();
  };

  // Navigation handlers
  const handleAddProduct = () => {
    navigation.navigate('AddInventoryScreen', { businessId });
  };

  const handleInventory = () => {
    navigation.navigate('AddInventoryScreen', {
      businessId,
      showInventory: true,
    });
  };

  const handleOrders = () => {
    navigation.navigate('BusinessOrdersScreen', { businessId });
  };

  const handleCustomers = () => {
    navigation.navigate('BusinessCustomersScreen', { businessId });
  };

  const handleSettings = () => {
    navigation.navigate('BusinessSettingsScreen', { businessId, initialTab: 'details' });
  };

  const handleProfile = () => {
    navigation.navigate('BusinessProfileScreen', { businessId });
  };

  const handleInsights = () => {
    navigation.navigate('BusinessInsightsScreen', { businessId });
  };

  const handleWateringChecklist = () => {
    navigation.navigate('WateringChecklistScreen', { businessId });
  };

  const handleDiseaseChecker = () => {
    navigation.navigate('DiseaseChecker');
  };

  const handleForum = () => {
    navigation.navigate('PlantCareForumScreen');
  };

  // Order management handlers (kept, but Recent Orders are now non-pressable)
  const handleOrderPress = (order) => {
    setSelectedOrder(order);
    setShowOrderModal(true);
  };

  const handleUpdateOrderStatus = async (orderId, newStatus) => {
    try {
      await loadDashboardData();
      setShowOrderModal(false);
    } catch (error) {
      Alert.alert('Error', 'Failed to update order status');
    }
  };

  const handleContactCustomer = (order) => {
    const options = [];

    if (order.customerPhone) {
      options.push({
        text: '📱 Call Customer',
        onPress: () => Linking.openURL(`tel:${order.customerPhone}`),
      });

      options.push({
        text: '💬 Send SMS',
        onPress: () =>
          Linking.openURL(
            `sms:${order.customerPhone}?body=Hi ${order.customerName}, your order ${order.confirmationNumber} is ready!`
          ),
      });
    }

    options.push({
      text: '📧 Send Email',
      onPress: () =>
        Linking.openURL(
          `mailto:${order.customerEmail}?subject=Order ${order.confirmationNumber}&body=Hi ${order.customerName}, regarding your order...`
        ),
    });

    options.push({ text: 'Cancel', style: 'cancel' });

    Alert.alert(
      `Contact ${order.customerName}`,
      `Order: ${order.confirmationNumber}`,
      options
    );
  };

  // --- Loading / Error wrappers use BusinessLayout too ---
  if (isLoading && !dashboardData) {
    return (
      <BusinessLayout
        navigation={navigation}
        businessId={businessId}
        currentTab="home"
      >
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#216a94" />
            <Text style={styles.loadingText}>Loading your dashboard...</Text>
          </View>
        </SafeAreaView>
      </BusinessLayout>
    );
  }

  if (error && !dashboardData) {
    return (
      <BusinessLayout
        navigation={navigation}
        businessId={businessId}
        currentTab="home"
      >
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.errorContainer}>
            <MaterialIcons name="error-outline" size={48} color="#c62828" />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={loadDashboardData}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </BusinessLayout>
    );
  }

  // Use fallback data if dashboardData is null
  const data = dashboardData || getFallbackData();

  // Null safety
  const metrics = data?.metrics || {
    totalSales: 0,
    salesToday: 0,
    newOrders: 0,
    lowStockItems: 0,
    totalInventory: 0,
    activeInventory: 0,
    totalOrders: 0,
    inventoryValue: 0,
    revenueGrowth: 0,
    dailyGrowth: 0,
    orderGrowth: 0,
    stockChange: 0,
  };

  const chartData = data?.chartData || {
    sales: { labels: [], values: [], total: 0, average: 0 },
    orders: { pending: 0, confirmed: 0, ready: 0, completed: 0, total: 0 },
    inventory: { inStock: 0, lowStock: 0, outOfStock: 0 },
  };

  const recentOrders = data?.recentOrders || [];

  // ✅ Ensure sales average/total are always computed from current values
  const rawSalesValues = Array.isArray(chartData?.sales?.values)
    ? chartData.sales.values.map((v) => Number(v) || 0)
    : [];

  let computedSalesTotal =
    Number.isFinite(Number(chartData?.sales?.total))
      ? Number(chartData.sales.total)
      : rawSalesValues.reduce((sum, v) => sum + v, 0);

  if (computedSalesTotal === 0 && rawSalesValues.length > 0) {
    computedSalesTotal = rawSalesValues.reduce((sum, v) => sum + v, 0);
  }

  const computedSalesAvg =
    rawSalesValues.length > 0 ? computedSalesTotal / rawSalesValues.length : 0;

  const salesData = {
    ...(chartData.sales || {}),
    values: rawSalesValues,
    total: computedSalesTotal,
    average: computedSalesAvg,
  };

  const ordersData = chartData.orders || {
    pending: 0,
    confirmed: 0,
    ready: 0,
    completed: 0,
    total: 0,
  };

  const inventoryData = chartData.inventory || {
    inStock: 0,
    lowStock: 0,
    outOfStock: 0,
  };

  const businessInfo = {
    businessName:
      data?.businessInfo?.businessName ||
      data?.businessProfile?.businessName ||
      data?.business?.name ||
      data?.profile?.businessName ||
      'Your Business',
    businessType:
      data?.businessInfo?.businessType ||
      data?.businessProfile?.businessType ||
      data?.business?.businessType ||
      'Plant Business',
    logo:
      data?.businessProfile?.logo ||
      data?.businessInfo?.logo ||
      data?.business?.logo ||
      DEFAULT_BUSINESS_IMAGE,
    email:
      data?.businessInfo?.email ||
      data?.businessProfile?.email ||
      data?.business?.email ||
      businessId ||
      'business@example.com',
    rating:
      data?.businessInfo?.rating ||
      data?.businessProfile?.rating ||
      data?.business?.rating ||
      0,
    reviewCount:
      data?.businessInfo?.reviewCount ||
      data?.businessProfile?.reviewCount ||
      data?.business?.reviewCount ||
      0,
    joinDate:
      data?.businessInfo?.joinDate ||
      data?.businessProfile?.joinDate ||
      data?.business?.createdAt,
    address:
      data?.businessInfo?.address ||
      data?.businessProfile?.address ||
      data?.business?.address ||
      '',
    phone:
      data?.businessInfo?.phone ||
      data?.businessProfile?.phone ||
      data?.business?.phone ||
      '',
    website:
      data?.businessInfo?.website ||
      data?.businessProfile?.website ||
      data?.business?.website ||
      '',
    facebook:
      data?.businessInfo?.facebook ||
      data?.businessProfile?.facebook ||
      data?.business?.facebook ||
      '',
    instagram:
      data?.businessInfo?.instagram ||
      data?.businessProfile?.instagram ||
      data?.business?.instagram ||
      '',
    twitter:
      data?.businessInfo?.twitter ||
      data?.businessProfile?.twitter ||
      data?.business?.twitter ||
      '',
  };

  // ---------- header renderer for FlatList ----------
  const renderHomeHeader = () => (
    <>
      {/* KPI Widgets */}
      <View style={styles.kpiContainer}>
        <KPIWidget
          title="Total Revenue"
          value={metrics.totalSales}
          icon="cash"
          format="currency"
          color="#216a94"
        />

        <KPIWidget
          title="Today's Sales"
          value={metrics.salesToday}
          icon="trending-up"
          format="currency"
          color="#4CAF50"
        />

        <KPIWidget
          title="New Orders"
          value={metrics.newOrders}
          icon="cart"
          format="number"
          color="#FF9800"
          trend={metrics.newOrders > 0 ? 'up' : 'neutral'}
        />

        <KPIWidget
          title="Low Stock"
          value={metrics.lowStockItems}
          icon="alert-circle"
          format="number"
          color={metrics.lowStockItems > 0 ? '#F44336' : '#9E9E9E'}
          trend={metrics.lowStockItems > 0 ? 'down' : 'neutral'}
        />
      </View>

      {/* Additional Metrics Row */}
      <View style={styles.additionalMetrics}>
        <View style={styles.metricItem}>
          <MaterialCommunityIcons name="package-variant" size={24} color="#2196F3" />
          <Text style={styles.metricValue}>{metrics.totalInventory}</Text>
          <Text style={styles.metricLabel}>Total Items</Text>
        </View>
        <View style={styles.metricItem}>
          <MaterialCommunityIcons name="check-circle" size={24} color="#4CAF50" />
          <Text style={styles.metricValue}>{metrics.activeInventory}</Text>
          <Text style={styles.metricLabel}>Active Items</Text>
        </View>
        <View style={styles.metricItem}>
          <MaterialCommunityIcons name="receipt" size={24} color="#9C27B0" />
          <Text style={styles.metricValue}>{metrics.totalOrders}</Text>
          <Text style={styles.metricLabel}>Total Orders</Text>
        </View>
        <View style={styles.metricItem}>
          <MaterialCommunityIcons name="cash" size={24} color="#FF5722" />
          <Text style={styles.metricValue}>₪{(metrics.inventoryValue || 0).toFixed(0)}</Text>
          <Text style={styles.metricLabel}>Inventory Value</Text>
        </View>
      </View>

      {/* Charts Dashboard */}
      <BusinessDashboardCharts
        salesData={salesData}
        ordersData={ordersData}
        inventoryData={inventoryData}
        onRefresh={loadDashboardData}
        autoRefresh
      />

      {/* Top Selling Products (non-pressable) */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Top Products</Text>
      </View>
      <View pointerEvents="none" accessible={false}>
        <TopSellingProductsList
          businessId={businessId}
          timeframe="month"
          limit={5}
          // onProductPress omitted intentionally – items are disabled
        />
      </View>

      {/* Recent Orders (non-pressable) */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Recent Orders</Text>
        <TouchableOpacity style={styles.viewAllButton} onPress={handleOrders}>
          <Text style={styles.viewAllText}>View All</Text>
          <MaterialIcons name="arrow-forward" size={16} color="#216a94" />
        </TouchableOpacity>
      </View>

      <View style={styles.ordersContainer}>
        {recentOrders && recentOrders.length > 0 ? (
          recentOrders.slice(0, 3).map((order) => (
            <View
              key={order.id}
              style={styles.orderItem}
              // no onPress here – card is read-only
              accessible={false}
            >
              <View style={styles.orderHeader}>
                <Text style={styles.orderConfirmation}>#{order.confirmationNumber}</Text>
                <View
                  style={[
                    styles.statusPill,
                    { backgroundColor: getStatusColor(order.status) },
                  ]}
                >
                  <Text style={styles.statusText}>{order.status}</Text>
                </View>
              </View>
              <View style={styles.orderDetails}>
                <Text style={styles.orderCustomer}>{order.customerName}</Text>
                <Text style={styles.orderDate}>
                  {order.date ? new Date(order.date).toLocaleDateString() : 'Recent'}
                </Text>
              </View>
              <View style={styles.orderInfo}>
                <Text style={styles.orderTotal}>₪{(order.total || 0).toFixed(2)}</Text>
                <Text style={styles.orderItems}>{order.items?.length || 0} items</Text>
              </View>
            </View>
          ))
        ) : (
          <View style={styles.emptyState}>
            <MaterialIcons name="receipt" size={48} color="#e0e0e0" />
            <Text style={styles.emptyStateText}>No recent orders</Text>
            <Text style={styles.emptyStateSubtext}>
              Orders will appear here when customers place them
            </Text>
            <TouchableOpacity
              style={styles.createOrderButton}
              onPress={() =>
                navigation.navigate('CreateOrderScreen', { businessId })
              }
            >
              <MaterialIcons name="add" size={16} color="#216a94" />
              <Text style={styles.createOrderText}>Create Order</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Business Info Card */}
      <View style={styles.businessCard}>
        <View style={styles.businessCardHeader}>
          <MaterialCommunityIcons name="store" size={24} color="#216a94" />
          <Text style={styles.businessCardTitle}>Business Information</Text>
        </View>
        <View style={styles.businessCardContent}>
          <Text style={styles.businessCardItem}>
            <Text style={styles.businessCardLabel}>Type: </Text>
            {businessInfo.businessType}
          </Text>
          <Text style={styles.businessCardItem}>
            <Text style={styles.businessCardLabel}>Email: </Text>
            {businessInfo.email}
          </Text>
          {businessInfo.phone ? (
            <Text style={styles.businessCardItem}>
              <Text style={styles.businessCardLabel}>Phone: </Text>
              <Text
                style={{ color: '#216a94' }}
                onPress={() => Linking.openURL(`tel:${businessInfo.phone}`)}
              >
                {businessInfo.phone}
              </Text>
            </Text>
          ) : null}
          {businessInfo.address ? (
            <Text style={styles.businessCardItem}>
              <Text style={styles.businessCardLabel}>Address: </Text>
              {typeof businessInfo.address === 'string'
                ? businessInfo.address
                : `${businessInfo.address.street || ''} ${businessInfo.address.houseNumber || ''
                  }, ${businessInfo.address.city || ''}, ${businessInfo.address.country || ''
                  }`.replace(/^[,\s]+|[,\s]+$/g, '')}
            </Text>
          ) : null}
          {businessInfo.website ? (
            <Text style={styles.businessCardItem}>
              <MaterialCommunityIcons name="web" size={16} color="#216a94" />
              <Text style={styles.businessCardLabel}> Website: </Text>
              <Text
                style={{ color: '#216a94' }}
                onPress={() => Linking.openURL(businessInfo.website)}
              >
                {businessInfo.website.replace(/^https?:\/\//, '')}
              </Text>
            </Text>
          ) : null}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
            {businessInfo.facebook ? (
              <TouchableOpacity
                onPress={() => Linking.openURL(businessInfo.facebook)}
                style={{ marginRight: 8 }}
              >
                <FontAwesome name="facebook-square" size={20} color="#1877f3" />
              </TouchableOpacity>
            ) : null}
            {businessInfo.instagram ? (
              <TouchableOpacity
                onPress={() => Linking.openURL(businessInfo.instagram)}
                style={{ marginRight: 8 }}
              >
                <FontAwesome name="instagram" size={20} color="#C13584" />
              </TouchableOpacity>
            ) : null}
            {businessInfo.twitter ? (
              <TouchableOpacity
                onPress={() => Linking.openURL(businessInfo.twitter)}
                style={{ marginRight: 8 }}
              >
                <FontAwesome name="twitter" size={20} color="#1da1f2" />
              </TouchableOpacity>
            ) : null}
          </View>
          {businessInfo.joinDate && (
            <Text style={styles.businessCardItem}>
              <Text style={styles.businessCardLabel}>Member since: </Text>
              {new Date(businessInfo.joinDate).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
              })}
            </Text>
          )}
        </View>
        <TouchableOpacity style={styles.editBusinessButton} onPress={handleProfile}>
          <MaterialIcons name="edit" size={16} color="#216a94" />
          <Text style={styles.editBusinessText}>Edit Business Info</Text>
        </TouchableOpacity>
      </View>
    </>
  );

  // ---------- Main ----------
  return (
    <BusinessLayout
      navigation={navigation}
      businessId={businessId}
      currentTab="home"
      badges={{ orders: metrics.newOrders || 0 }}
    >
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <MaterialIcons name="arrow-back" size={24} color="#216a94" />
          </TouchableOpacity>
          <View style={styles.profileSection}>
            <TouchableOpacity
              onPress={handleProfile}
              style={styles.profileAvatarButton}
              accessibilityLabel="View Profile"
            >
              <Image
                source={
                  businessInfo.logo
                    ? { uri: businessInfo.logo }
                    : require('../../assets/business-placeholder.png')
                }
                style={styles.logo}
              />
            </TouchableOpacity>
            <View style={styles.businessInfoBox}>
              <Text style={styles.businessName} numberOfLines={1}>
                {businessInfo.businessName}
              </Text>
              <Text style={styles.businessType}>{businessInfo.businessType}</Text>
              <Text style={styles.welcomeText}>Welcome back!</Text>
              <View style={styles.ratingContainer}>
                {businessInfo.rating > 0 && (
                  <>
                    <MaterialIcons name="star" size={14} color="#FFC107" />
                    <Text style={styles.ratingText}>
                      {businessInfo.rating.toFixed(1)} ({businessInfo.reviewCount})
                    </Text>
                  </>
                )}
              </View>
            </View>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.headerButton}
              onPress={handleInsights}
              accessibilityLabel="Insights"
            >
              <MaterialIcons name="insights" size={24} color="#216a94" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.headerButton}
              onPress={handleSettings}
              accessibilityLabel="Settings"
            >
              <MaterialIcons name="settings" size={24} color="#216a94" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Use FlatList to avoid nesting VirtualizedList in ScrollView */}
        <FlatList
          data={[0]} // dummy single item, all content comes from the header
          keyExtractor={() => 'home'}
          ListHeaderComponent={renderHomeHeader}
          refreshing={refreshing}
          onRefresh={onRefresh}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 24 }}
        />

        {/* Order Detail Modal (will remain closed since Recent Orders are not pressable) */}
        <OrderDetailModal
          visible={showOrderModal}
          order={selectedOrder}
          onClose={() => setShowOrderModal(false)}
          onUpdateStatus={handleUpdateOrderStatus}
          onContactCustomer={handleContactCustomer}
          businessInfo={businessInfo}
        />

        {/* Floating AI button */}
        <TouchableOpacity
          style={styles.fab}
          activeOpacity={0.9}
          onPress={() => setAssistantVisible(true)}
          accessibilityLabel="Open AI Assistant"
          accessibilityRole="button"
        >
          <MaterialCommunityIcons name="robot" size={24} color="#fff" />
        </TouchableOpacity>

        {/* AI Assistant Modal */}
        <Modal
          visible={assistantVisible}
          transparent
          animationType="slide"
          onRequestClose={() => setAssistantVisible(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalSheet}>
              <AIPlantCareAssistant
                navigation={navigation}
                route={{ params: { business: true, embedded: true } }}
                embedded
                onClose={() => setAssistantVisible(false)}
              />
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </BusinessLayout>
  );
}

// Helper function for status colors
function getStatusColor(status) {
  switch (status) {
    case 'pending':
      return '#FFA000';
    case 'confirmed':
      return '#2196F3';
    case 'ready':
      return '#9C27B0';
    case 'completed':
      return '#4CAF50';
    case 'cancelled':
      return '#F44336';
    default:
      return '#757575';
  }
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#216a94',
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    color: '#c62828',
    textAlign: 'center',
    margin: 10,
    fontSize: 16,
  },
  retryButton: {
    backgroundColor: '#216a94',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginTop: 20,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  header: {
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  profileAvatarButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    overflow: 'hidden',
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#216a94',
    backgroundColor: '#f0f8ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#eee',
  },
  businessInfoBox: {
    marginLeft: 12,
    flex: 1,
  },
  businessName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#216a94',
  },
  businessType: {
    fontSize: 14,
    color: '#00796b',
    fontWeight: '500',
    marginTop: 2,
  },
  welcomeText: {
    fontSize: 12,
    color: '#757575',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  ratingText: {
    fontSize: 11,
    color: '#666',
    marginLeft: 2,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  headerButton: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: '#f0f8ff',
  },
  kpiContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    padding: 16,
    gap: 12,
  },
  additionalMetrics: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    padding: 16,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  metricItem: {
    flex: 1,
    alignItems: 'center',
  },
  metricValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 4,
  },
  metricLabel: {
    fontSize: 10,
    color: '#666',
    marginTop: 2,
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginHorizontal: 16,
    marginBottom: 12,
    marginTop: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 12,
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 4,
  },
  viewAllText: {
    color: '#216a94',
    fontSize: 14,
    marginRight: 4,
  },
  ordersContainer: {
    marginHorizontal: 16,
    marginBottom: 24,
  },
  orderItem: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
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
    marginBottom: 8,
  },
  orderConfirmation: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  orderDetails: {
    marginBottom: 8,
  },
  orderCustomer: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  orderDate: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  orderInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderTotal: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#216a94',
  },
  orderItems: {
    fontSize: 12,
    color: '#666',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 12,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#666',
    marginTop: 12,
  },
  emptyStateSubtext: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
    textAlign: 'center',
  },
  createOrderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f8ff',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#216a94',
  },
  createOrderText: {
    color: '#216a94',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
  businessCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 24,
    borderRadius: 12,
    padding: 16,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  businessCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  businessCardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#216a94',
    marginLeft: 8,
  },
  businessCardContent: {
    marginBottom: 12,
  },
  businessCardItem: {
    fontSize: 14,
    color: '#555',
    marginBottom: 4,
  },
  businessCardLabel: {
    fontWeight: '600',
    color: '#333',
  },
  editBusinessButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#216a94',
    backgroundColor: '#f0f8ff',
  },
  editBusinessText: {
    fontSize: 12,
    color: '#216a94',
    marginLeft: 4,
    fontWeight: '600',
  },

  // --- AI FAB & Modal ---
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#216a94',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    height: '85%',
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    overflow: 'hidden',
  },
});
