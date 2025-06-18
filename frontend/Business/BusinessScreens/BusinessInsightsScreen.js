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

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Replace with your real API call for analytics/reports
      // Example fallback data for high-level UI
      setData({
        kpis: [
          { title: 'Total Revenue', value: 12000, icon: 'cash', color: '#4CAF50', format: 'currency' },
          { title: 'Total Orders', value: 320, icon: 'shopping-cart', color: '#2196F3', format: 'number' },
          { title: 'Avg Order Value', value: 37.5, icon: 'attach-money', color: '#FF9800', format: 'currency' },
          { title: 'Customers', value: 210, icon: 'people', color: '#9C27B0', format: 'number' },
        ],
        chartData: {
          sales: { labels: ['W1', 'W2', 'W3', 'W4'], values: [3000, 3500, 2800, 2700], total: 12000, average: 3000 },
          orders: { pending: 12, confirmed: 20, ready: 8, completed: 280, total: 320 },
          inventory: { inStock: 120, lowStock: 10, outOfStock: 5 },
        },
        topProducts: [
          { name: 'Ficus', sales: 80, revenue: 1200 },
          { name: 'Monstera', sales: 60, revenue: 900 },
        ],
        topCustomers: [
          { name: 'Alice', orders: 12, spent: 400 },
          { name: 'Bob', orders: 10, spent: 350 },
        ],
      });
    } catch (e) {
      setError('Failed to load data');
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
            {data.kpis.map((kpi, idx) => (
              <KPIWidget key={idx} {...kpi} />
            ))}
          </View>
          <BusinessDashboardCharts
            salesData={data.chartData.sales}
            ordersData={data.chartData.orders}
            inventoryData={data.chartData.inventory}
            onRefresh={loadData}
            autoRefresh={false}
          />
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Top Products</Text>
            {data.topProducts.map((p, i) => (
              <Text key={i} style={styles.listItem}>{i + 1}. {p.name} - {p.sales} sales (${p.revenue})</Text>
            ))}
          </View>
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Top Customers</Text>
            {data.topCustomers.map((c, i) => (
              <Text key={i} style={styles.listItem}>{i + 1}. {c.name} - {c.orders} orders (${c.spent})</Text>
            ))}
          </View>
        </View>
      );
    }
    // For other tabs, just show a high-level chart and summary
    if (activeTab === 'sales') {
      return (
        <View>
          <BusinessDashboardCharts
            salesData={data.chartData.sales}
            onRefresh={loadData}
            autoRefresh={false}
          />
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Top Products</Text>
            {data.topProducts.map((p, i) => (
              <Text key={i} style={styles.listItem}>{i + 1}. {p.name} - {p.sales} sales (${p.revenue})</Text>
            ))}
          </View>
        </View>
      );
    }
    if (activeTab === 'inventory') {
      return (
        <View>
          <BusinessDashboardCharts
            inventoryData={data.chartData.inventory}
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
          {data.topCustomers.map((c, i) => (
            <Text key={i} style={styles.listItem}>{i + 1}. {c.name} - {c.orders} orders (${c.spent})</Text>
          ))}
        </View>
      );
    }
    return null;
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text style={styles.loadingText}>Loading insights...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
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
        <Animated.View style={{ opacity: fadeAnim, padding: 16 }}>{renderTabContent()}</Animated.View>
      </ScrollView>
    </SafeAreaView>
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
});