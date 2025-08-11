// Business/BusinessScreens/BusinessInsightsScreen.js - Unified Analytics & Reports (Web/Mobile High-Level UI)
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Platform,
  Alert,
  Animated,
  Share,
  Dimensions,
  RefreshControl,
} from 'react-native';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import BusinessDashboardCharts from '../components/BusinessDashboardCharts';
import KPIWidget from '../components/KPIWidget';
import { getBusinessAnalytics, createAnalyticsStream } from '../services/businessAnalyticsApi';
import AsyncStorage from '@react-native-async-storage/async-storage';
import BusinessLayout from '../components/BusinessLayout';

const { width: screenWidth } = Dimensions.get('window');

export default function BusinessInsightsScreen({ navigation, route }) {
  const { businessId } = route.params || {};
  const [activeTab, setActiveTab] = useState('overview');
  const [timeframe, setTimeframe] = useState('month');
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadData();
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [activeTab, timeframe]);

  // Set up real-time data stream for auto-refresh (every 60 seconds)
  useEffect(() => {
    // Only enable auto-refresh for overview tab
    if (activeTab !== 'overview') return;

    console.log('🔄 Setting up analytics auto-refresh stream...');
    const cleanupStream = createAnalyticsStream(
      timeframe,
      (newData) => {
        if (newData && newData.data) {
          console.log('📊 Auto-refreshed analytics data received');
          // Transform API data similar to loadData function
          // ...
          // If you want to update the UI automatically, uncomment:
          // loadData();
        }
      },
      (error) => {
        console.warn('⚠️ Analytics stream error:', error);
      },
      60000 // 60 seconds refresh interval
    );

    // Cleanup function
    return () => {
      console.log('🛑 Stopping analytics auto-refresh stream');
      cleanupStream();
    };
  }, [activeTab, timeframe]);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Get the business ID from AsyncStorage if not provided in route params
      let id = businessId;
      if (!id) {
        id = await AsyncStorage.getItem('businessId');
      }

      if (!id) {
        throw new Error('Business ID is required');
      }

      // Call the real API using the businessAnalyticsApi service
      const response = await getBusinessAnalytics(timeframe, 'all', false);

      if (!response || !response.data) {
        throw new Error('Invalid response from analytics API');
      }

      const apiData = response.data;

      // Transform API data to the format expected by UI components
      const formattedData = {
        kpis: [
          {
            title: 'Total Revenue',
            value: apiData.sales?.totalRevenue || 0,
            icon: 'cash',
            color: '#4CAF50',
            format: 'currency'
          },
          {
            title: 'Total Orders',
            value: apiData.sales?.totalOrders || 0,
            icon: 'shopping-cart',
            color: '#2196F3',
            format: 'number'
          },
          {
            title: 'Avg Order Value',
            value: apiData.sales?.averageOrderValue || 0,
            icon: 'attach-money',
            color: '#FF9800',
            format: 'currency'
          },
          {
            title: 'Customers',
            value: apiData.customers?.totalCustomers || 0,
            icon: 'people',
            color: '#9C27B0',
            format: 'number'
          },
        ],
        chartData: {
          sales: {
            labels: apiData.sales?.weeklyLabels || [],
            values: apiData.sales?.weeklyValues || [],
            total: apiData.sales?.totalRevenue || 0,
            average: apiData.sales?.averageWeeklyRevenue || 0
          },
          orders: {
            pending: apiData.sales?.pendingOrders || 0,
            confirmed: apiData.sales?.confirmedOrders || 0,
            ready: apiData.sales?.readyOrders || 0,
            completed: apiData.sales?.completedOrders || 0,
            total: apiData.sales?.totalOrders || 0
          },
          inventory: {
            inStock: apiData.inventory?.inStockItems || 0,
            lowStock: apiData.inventory?.lowStockItems || 0,
            outOfStock: apiData.inventory?.outOfStockItems || 0
          },
        },
        topProducts: apiData.sales?.topProducts || [],
        topCustomers: apiData.customers?.topCustomers || [],
        generatedAt: apiData.generatedAt || new Date().toISOString()
      };

      setData(formattedData);
      console.log('✅ Analytics data loaded successfully!');
    } catch (e) {
      console.error('❌ Failed to load analytics data:', e);
      setError(`Failed to load data: ${e.message}`);

      // Try to load cached data as fallback
      try {
        const cachedData = await AsyncStorage.getItem('cached_analytics');
        if (cachedData) {
          const { data: cachedApiData } = JSON.parse(cachedData);
          if (cachedApiData && cachedApiData.data) {
            console.log('📱 Using cached analytics data');
            // Transform cached data (similar to above)
            const formattedCachedData = {
              kpis: [
                {
                  title: 'Total Revenue',
                  value: cachedApiData.sales?.totalRevenue || 0,
                  icon: 'cash',
                  color: '#4CAF50',
                  format: 'currency'
                },
                {
                  title: 'Total Orders',
                  value: cachedApiData.sales?.totalOrders || 0,
                  icon: 'shopping-cart',
                  color: '#2196F3',
                  format: 'number'
                },
                {
                  title: 'Avg Order Value',
                  value: cachedApiData.sales?.averageOrderValue || 0,
                  icon: 'attach-money',
                  color: '#FF9800',
                  format: 'currency'
                },
                {
                  title: 'Customers',
                  value: cachedApiData.customers?.totalCustomers || 0,
                  icon: 'people',
                  color: '#9C27B0',
                  format: 'number'
                },
              ],
              chartData: {
                sales: {
                  labels: cachedApiData.sales?.weeklyLabels || [],
                  values: cachedApiData.sales?.weeklyValues || [],
                  total: cachedApiData.sales?.totalRevenue || 0,
                  average: cachedApiData.sales?.averageWeeklyRevenue || 0
                },
                orders: {
                  pending: cachedApiData.sales?.pendingOrders || 0,
                  confirmed: cachedApiData.sales?.confirmedOrders || 0,
                  ready: cachedApiData.sales?.readyOrders || 0,
                  completed: cachedApiData.sales?.completedOrders || 0,
                  total: cachedApiData.sales?.totalOrders || 0
                },
                inventory: {
                  inStock: cachedApiData.inventory?.inStockItems || 0,
                  lowStock: cachedApiData.inventory?.lowStockItems || 0,
                  outOfStock: cachedApiData.inventory?.outOfStockItems || 0
                },
              },
              topProducts: cachedApiData.sales?.topProducts || [],
              topCustomers: cachedApiData.customers?.topCustomers || [],
              generatedAt: cachedApiData.generatedAt || new Date().toISOString()
            };

            setData(formattedCachedData);
            setError(null); // Clear error since we are using cached data
            console.log('📂 Cached analytics data loaded successfully!');
          } else {
            throw new Error('Invalid cached data format');
          }
        } else {
          throw new Error('No cached data available');
        }
      } catch (cacheError) {
        console.warn('⚠️ Failed to load cached analytics:', cacheError);
        setError('Failed to load data and no cached data available');
      }
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  // High-level UI: Tabs
  const tabs = [
    { key: 'overview', label: 'Overview', icon: 'dashboard' },
    { key: 'sales', label: 'Sales', icon: 'trending-up' },
    { key: 'inventory', label: 'Inventory', icon: 'inventory' },
    { key: 'customers', label: 'Customers', icon: 'people' },
  ];

  // High-level UI: Timeframes
  const timeframes = ['week', 'month', 'quarter', 'year'];

  // High-level UI: Content per tab
  const renderTabContent = () => {
    if (!data) return null;
    if (activeTab === 'overview') {
      return (
        <View>
          <View style={styles.kpiGrid}>
            {Array.isArray(data.kpis) && data.kpis.map((kpi, idx) => (
              <KPIWidget key={idx} {...kpi} />
            ))}
          </View>
          <BusinessDashboardCharts
            salesData={data.chartData?.sales || {}}
            ordersData={data.chartData?.orders || {}}
            inventoryData={data.chartData?.inventory || {}}
            onRefresh={loadData}
            autoRefresh={false}
          />
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Top Products</Text>
            {Array.isArray(data.topProducts) && data.topProducts.length > 0 ? (
              data.topProducts.map((p, i) => (
                <Text key={i} style={styles.listItem}>
                  {`${i + 1}. ${p?.name || 'Unknown'} - ${p?.sales ?? 0} sales ($${p?.revenue ?? 0})`}
                </Text>
              ))
            ) : (
              <Text style={styles.listItem}>No products found.</Text>
            )}
          </View>
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Top Customers</Text>
            {Array.isArray(data.topCustomers) && data.topCustomers.length > 0 ? (
              data.topCustomers.map((c, i) => (
                <Text key={i} style={styles.listItem}>
                  {`${i + 1}. ${c?.name || 'Unknown'} - ${c?.orders ?? 0} orders ($${c?.spent ?? 0})`}
                </Text>
              ))
            ) : (
              <Text style={styles.listItem}>No customers found.</Text>
            )}
          </View>
        </View>
      );
    }
    // For other tabs, just show a high-level chart and summary
    if (activeTab === 'sales') {
      return (
        <View>
          <BusinessDashboardCharts
            salesData={data.chartData?.sales || {}}
            onRefresh={loadData}
            autoRefresh={false}
          />
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Top Products</Text>
            {Array.isArray(data.topProducts) && data.topProducts.length > 0 ? (
              data.topProducts.map((p, i) => (
                <Text key={i} style={styles.listItem}>
                  {`${i + 1}. ${p?.name || 'Unknown'} - ${p?.sales ?? 0} sales ($${p?.revenue ?? 0})`}
                </Text>
              ))
            ) : (
              <Text style={styles.listItem}>No products found.</Text>
            )}
          </View>
        </View>
      );
    }
    if (activeTab === 'inventory') {
      return (
        <View>
          <BusinessDashboardCharts
            inventoryData={data.chartData?.inventory || {}}
            onRefresh={loadData}
            autoRefresh={false}
          />
        </View>
      );
    }
    if (activeTab === 'customers') {
      return (
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Top Customers</Text>
          {Array.isArray(data.topCustomers) && data.topCustomers.length > 0 ? (
            data.topCustomers.map((c, i) => (
              <Text key={i} style={styles.listItem}>
                {`${i + 1}. ${c?.name || 'Unknown'} - ${c?.orders ?? 0} orders ($${c?.spent ?? 0})`}
              </Text>
            ))
          ) : (
            <Text style={styles.listItem}>No customers found.</Text>
          )}
        </View>
      );
    }
    return null;
  };

  if (isLoading) {
    return (
      <BusinessLayout navigation={navigation} businessId={businessId} currentTab="insights">

        <SafeAreaView style={styles.container}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#4CAF50" />
            <Text style={styles.loadingText}>Loading insights...</Text>
          </View>
        </SafeAreaView>
      </BusinessLayout>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <MaterialIcons name="error-outline" size={48} color="#f44336" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadData}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (!data) {
    return (
      <BusinessLayout navigation={navigation} businessId={businessId} currentTab="insights">

        <SafeAreaView style={styles.container}>
          <View style={styles.errorContainer}>
            <MaterialIcons name="info-outline" size={48} color="#2196F3" />
            <Text style={styles.noDataText}>No data available for this timeframe</Text>
          </View>
        </SafeAreaView>
      </BusinessLayout>
    );
  }

  return (
    <BusinessLayout
      navigation={navigation}
      businessId={businessId}
      currentTab="insights"
      badges={{}} // optional
    >
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <MaterialIcons name="arrow-back" size={24} color="#4CAF50" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Business Insights</Text>
          <View style={{ width: 32 }} />
        </View>
        <View style={styles.tabBar}>
          {tabs.map(tab => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, activeTab === tab.key && styles.activeTab]}
              onPress={() => setActiveTab(tab.key)}
            >
              <MaterialIcons name={tab.icon} size={20} color={activeTab === tab.key ? '#4CAF50' : '#999'} />
              <Text style={[styles.tabText, activeTab === tab.key && styles.activeTabText]}>{tab.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.timeframeBar}>
          {timeframes.map(tf => (
            <TouchableOpacity
              key={tf}
              style={[styles.timeframeBtn, timeframe === tf && styles.activeTimeframeBtn]}
              onPress={() => setTimeframe(tf)}
            >
              <Text style={[styles.timeframeText, timeframe === tf && styles.activeTimeframeText]}>{tf.charAt(0).toUpperCase() + tf.slice(1)}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <ScrollView
          style={styles.scrollView}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View style={{ opacity: fadeAnim, padding: 16 }}>
            {data.fromCache && (
              <View style={styles.cacheNotice}>
                <MaterialIcons name="info-outline" size={16} color="#FFC107" />
                <Text style={styles.cacheText}>Showing cached data from {new Date(data.generatedAt).toLocaleString()}</Text>
              </View>
            )}
            {renderTabContent()}
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </BusinessLayout >
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', padding: 16, borderBottomWidth: 1, borderBottomColor: '#e0e0e0' },
  backButton: { padding: 8, borderRadius: 8, backgroundColor: '#f0f9f3' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#4CAF50' },
  tabBar: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12 },
  activeTab: { borderBottomWidth: 2, borderBottomColor: '#4CAF50' },
  tabText: { fontSize: 12, color: '#999', marginLeft: 6 },
  activeTabText: { color: '#4CAF50', fontWeight: '600' },
  timeframeBar: { flexDirection: 'row', backgroundColor: '#fff', paddingHorizontal: 8, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  timeframeBtn: { flex: 1, alignItems: 'center', paddingVertical: 6, borderRadius: 12, backgroundColor: '#f5f5f5', marginHorizontal: 4 },
  activeTimeframeBtn: { backgroundColor: '#4CAF50' },
  timeframeText: { fontSize: 13, color: '#666' },
  activeTimeframeText: { color: '#fff', fontWeight: '600' },
  scrollView: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 16, fontSize: 16, color: '#666' },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 20 },
  sectionCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#333', marginBottom: 8 },
  listItem: { fontSize: 14, color: '#555', marginBottom: 4 },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  errorText: { color: '#f44336', fontSize: 16, marginVertical: 12, textAlign: 'center' },
  retryButton: { backgroundColor: '#4CAF50', paddingHorizontal: 24, paddingVertical: 10, borderRadius: 8, marginTop: 8 },
  retryButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  noDataText: { color: '#2196F3', fontSize: 16, marginVertical: 12, textAlign: 'center' },
  cacheNotice: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF8E1', padding: 8, borderRadius: 8, marginBottom: 12 },
  cacheText: { color: '#FFC107', marginLeft: 6, fontSize: 13 },
});