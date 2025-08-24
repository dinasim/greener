// Business/components/BusinessDashboardCharts.js
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Platform,
  Dimensions,
  Pressable,
} from 'react-native';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';

// Conditional chart imports
let LineChart, BarChart, PieChart;
if (Platform.OS !== 'web') {
  try {
    const charts = require('react-native-chart-kit');
    LineChart = charts.LineChart;
    BarChart = charts.BarChart;
    PieChart = charts.PieChart;
  } catch (error) {
    console.warn('Chart kit not available:', error);
  }
}

const { width: screenWidth } = Dimensions.get('window');
const chartWidth = screenWidth - 32;

const WebSafeChart = ({ children, fallback, chartType = 'chart' }) => {
  const [hasError, setHasError] = useState(false);

  if (Platform.OS === 'web' || hasError || !LineChart) {
    return (
      fallback || (
        <View style={styles.chartFallback}>
          <MaterialIcons name="bar-chart" size={48} color="#e0e0e0" />
          <Text style={styles.chartFallbackText}>Chart display unavailable on web</Text>
          <Text style={styles.chartFallbackSubtext}>Data is being processed correctly</Text>
        </View>
      )
    );
  }

  try {
    return (
      <View style={{ minHeight: 220, justifyContent: 'center', alignItems: 'center' }}>
        {children}
      </View>
    );
  } catch (error) {
    console.warn(`Chart rendering failed for ${chartType}:`, error);
    setHasError(true);
    return (
      fallback || (
        <View style={styles.chartFallback}>
          <MaterialIcons name="error-outline" size={48} color="#f44336" />
          <Text style={styles.chartFallbackText}>Chart error occurred</Text>
          <Text style={styles.chartFallbackSubtext}>Please refresh to try again</Text>
        </View>
      )
    );
  }
};

// --- helpers ---
const sanitizeNumber = (v) => {
  if (typeof v === 'number' && isFinite(v)) return v;
  if (typeof v === 'string') {
    // remove currency symbols, spaces and thousands separators
    const cleaned = v.replace(/[^\d.,-]/g, '').replace(/,/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  }
  return 0;
};

const fmtMoney = (n, maxFrac = 0) =>
  `₪${(Number(n) || 0).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxFrac,
  })}`;

export default function BusinessDashboardCharts({
  salesData = {},
  inventoryData = {},
  ordersData = {},
  onRefresh = () => {},
  autoRefresh = true,
  refreshInterval = 60000,
}) {
  const [activeChart, setActiveChart] = useState('orders');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [chartError, setChartError] = useState(null);

  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const refreshAnim = useRef(new Animated.Value(0)).current;
  const refreshTimer = useRef(null);

  useEffect(() => {
    Animated.stagger(200, [
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(slideAnim, { toValue: 1, duration: 500, useNativeDriver: Platform.OS !== 'web' }),
    ]).start();

    if (autoRefresh) {
      refreshTimer.current = setInterval(() => handleAutoRefresh(), refreshInterval);
    }
    return () => refreshTimer.current && clearInterval(refreshTimer.current);
  }, [autoRefresh, refreshInterval]);

  const handleAutoRefresh = async () => {
    setIsRefreshing(true);
    setChartError(null);

    Animated.sequence([
      Animated.timing(refreshAnim, { toValue: 1, duration: 300, useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(refreshAnim, { toValue: 0, duration: 300, useNativeDriver: Platform.OS !== 'web' }),
    ]).start();

    try {
      await onRefresh();
    } catch (error) {
      console.error('Auto-refresh error:', error);
      setChartError('Failed to refresh data');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleChartChange = (chartType) => {
    if (chartType === activeChart) return;
    setChartError(null);
    Animated.sequence([
      Animated.timing(slideAnim, { toValue: 0, duration: 200, useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(slideAnim, { toValue: 1, duration: 200, useNativeDriver: Platform.OS !== 'web' }),
    ]).start();
    setActiveChart(chartType);
  };

  const chartConfig = {
    backgroundColor: '#ffffff',
    backgroundGradientFrom: '#ffffff',
    backgroundGradientTo: '#ffffff',
    decimalPlaces: 0,
    style: { borderRadius: 16 },
    strokeWidth: 2,
    useShadowColorFromDataset: false,
    color: (o = 1) => `rgba(76, 175, 80, ${o})`,
    labelColor: (o = 1) => `rgba(0,0,0,${o})`,
    ...(Platform.OS === 'web' && {
      // web falls back to solid color (no opacity fn)
      color: () => '#4CAF50',
      labelColor: () => '#000000',
      fillShadowGradient: '#4CAF50',
      fillShadowGradientOpacity: 0,
    }),
    propsForDots: Platform.OS === 'web' ? {} : { r: '6', strokeWidth: '2', stroke: '#4CAF50', fill: '#4CAF50' },
  };

  // --- sanitize sales values once ---
  const sanitizedSalesValues = Array.isArray(salesData.values)
    ? salesData.values.map((v) => Math.max(0, sanitizeNumber(v)))
    : [];

  const maxSales = sanitizedSalesValues.length ? Math.max(...sanitizedSalesValues) : 0;
  const showYAxisLabels = maxSales > 1; // hide noisy 0/1 labels

  const computedTotal =
    typeof salesData.total === 'number' && salesData.total > 0
      ? salesData.total
      : sanitizedSalesValues.reduce((s, v) => s + v, 0);

  const computedAvg =
    typeof salesData.average === 'number' && salesData.average > 0
      ? salesData.average
      : sanitizedSalesValues.length
      ? sanitizedSalesValues.reduce((s, v) => s + v, 0) / sanitizedSalesValues.length
      : 0;

  const getSalesChartData = () => ({
    labels: salesData.labels || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    datasets: [
      {
        data: sanitizedSalesValues.length ? sanitizedSalesValues : [0, 0, 0, 0, 0, 0, 0],
        ...(Platform.OS === 'web'
          ? { color: '#4CAF50', strokeWidth: 2 }
          : { color: (opacity = 1) => `rgba(76,175,80,${opacity})`, strokeWidth: 3 }),
      },
    ],
  });

  const getOrdersChartData = () => ({
    labels: ['Pending', 'Confirmed', 'Ready', 'Completed'],
    datasets: [
      {
        data: [
          Math.max(0, ordersData.pending || 0),
          Math.max(0, ordersData.confirmed || 0),
          Math.max(0, ordersData.ready || 0),
          Math.max(0, ordersData.completed || 0),
        ],
      },
    ],
  });

  const getInventoryPieData = () => [
    { name: 'In Stock', population: Math.max(0, inventoryData.inStock || 0), color: '#4CAF50', legendFontColor: '#333', legendFontSize: 12 },
    { name: 'Low Stock', population: Math.max(0, inventoryData.lowStock || 0), color: '#FF9800', legendFontColor: '#333', legendFontSize: 12 },
    { name: 'Out of Stock', population: Math.max(0, inventoryData.outOfStock || 0), color: '#F44336', legendFontColor: '#333', legendFontSize: 12 },
  ];

  const renderChart = () => {
    if (chartError) {
      return (
        <View style={styles.errorContainer}>
          <MaterialIcons name="error-outline" size={48} color="#F44336" />
          <Text style={styles.errorText}>{chartError}</Text>
          <Pressable style={styles.retryButton} onPress={handleAutoRefresh}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </Pressable>
        </View>
      );
    }

    switch (activeChart) {
      case 'orders':
        return (
          <View style={styles.chartContainer}>
            <Text style={styles.chartTitle}>Orders by Status</Text>
            <WebSafeChart
              chartType="bar"
              fallback={
                <View style={styles.chartFallback}>
                  <MaterialIcons name="receipt" size={48} color="#2196F3" />
                  <Text style={styles.chartFallbackText}>Total Orders: {ordersData.total || 0}</Text>
                  <Text style={styles.chartFallbackSubtext}>
                    Active: {(ordersData.pending || 0) + (ordersData.confirmed || 0)}
                  </Text>
                </View>
              }
            >
              {BarChart && (
                <BarChart
                  data={getOrdersChartData()}
                  width={chartWidth}
                  height={220}
                  chartConfig={chartConfig}
                  style={styles.chart}
                  verticalLabelRotation={0}
                  withHorizontalLabels
                  withVerticalLabels
                  yAxisLabel=""
                  yAxisSuffix=""
                  showValuesOnTopOfBars={Platform.OS !== 'web'}
                  withInnerLines={Platform.OS !== 'web'}
                />
              )}
            </WebSafeChart>
            <View style={styles.chartInsights}>
              <Text style={styles.insightText}>
                📦 Total: {ordersData.total || 0} orders | Active:{' '}
                {(ordersData.pending || 0) + (ordersData.confirmed || 0) + (ordersData.ready || 0)}
              </Text>
            </View>
          </View>
        );

      case 'inventory':
        return (
          <View style={styles.chartContainer}>
            <Text style={styles.chartTitle}>Inventory Status</Text>
            <WebSafeChart
              chartType="pie"
              fallback={
                <View style={styles.chartFallback}>
                  <MaterialIcons name="inventory" size={48} color="#9C27B0" />
                  <Text style={styles.chartFallbackText}>In Stock: {inventoryData.inStock || 0}</Text>
                  <Text style={styles.chartFallbackSubtext}>
                    Low: {inventoryData.lowStock || 0} | Out: {inventoryData.outOfStock || 0}
                  </Text>
                </View>
              }
            >
              {PieChart && (
                <PieChart
                  data={getInventoryPieData()}
                  width={chartWidth}
                  height={220}
                  chartConfig={chartConfig}
                  accessor="population"
                  backgroundColor="transparent"
                  paddingLeft="15"
                  style={styles.chart}
                  hasLegend
                  avoidFalseZero
                  absolute={Platform.OS !== 'web'}
                />
              )}
            </WebSafeChart>
            <View style={styles.chartInsights}>
              <Text style={styles.insightText}>
                📊 Total Items:{' '}
                {(inventoryData.inStock || 0) +
                  (inventoryData.lowStock || 0) +
                  (inventoryData.outOfStock || 0)}
              </Text>
            </View>
          </View>
        );

      default:
        return (
          <View style={styles.chartContainer}>
            <Text style={styles.chartTitle}>Select a Chart</Text>
            <View style={styles.chartInsights}>
              <Text style={styles.insightText}>Choose a chart type from the tabs above</Text>
            </View>
          </View>
        );
    }
  };

  return (
    <Animated.View
      style={[
        styles.container,
        { opacity: fadeAnim, transform: Platform.OS === 'web' ? [] : [{ scale: slideAnim }] },
      ]}
      accessible
      accessibilityLabel="Business dashboard charts"
    >
      {/* Tabs */}
      <View style={styles.chartTabs} accessible accessibilityRole="tablist">
        {[
          { key: 'orders', label: 'Orders', icon: 'receipt' },
          { key: 'inventory', label: 'Stock', icon: 'inventory' },
        ].map((tab) => (
          <Pressable
            key={tab.key}
            style={[styles.chartTab, activeChart === tab.key && styles.activeChartTab]}
            onPress={() => handleChartChange(tab.key)}
            accessible
            accessibilityRole="tab"
            accessibilityState={{ selected: activeChart === tab.key }}
            accessibilityLabel={`${tab.label} chart tab`}
          >
            <MaterialIcons name={tab.icon} size={20} color={activeChart === tab.key ? '#4CAF50' : '#999'} />
            <Text style={[styles.chartTabText, activeChart === tab.key && styles.activeChartTabText]}>
              {tab.label}
            </Text>
          </Pressable>
        ))}

        {/* Refresh */}
        <Pressable
          style={styles.refreshButton}
          onPress={handleAutoRefresh}
          disabled={isRefreshing}
          accessible
          accessibilityRole="button"
          accessibilityLabel={isRefreshing ? 'Refreshing data' : 'Refresh chart data'}
          accessibilityState={{ disabled: isRefreshing }}
        >
          <Animated.View
            style={
              Platform.OS === 'web'
                ? {}
                : {
                    transform: [
                      {
                        rotate: refreshAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: ['0deg', '360deg'],
                        }),
                      },
                    ],
                  }
            }
          >
            <MaterialIcons name="refresh" size={20} color={isRefreshing ? '#4CAF50' : '#999'} />
          </Animated.View>
        </Pressable>
      </View>

      {/* Content */}
      <Animated.View
        style={[
          styles.chartContent,
          Platform.OS === 'web'
            ? { opacity: slideAnim }
            : {
                opacity: slideAnim,
                transform: [
                  {
                    translateX: slideAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [50, 0],
                    }),
                  },
                ],
              },
        ]}
        accessible
        accessibilityLabel={`${activeChart} chart content`}
      >
        {renderChart()}
      </Animated.View>

      {/* Auto-refresh indicator */}
      {autoRefresh && (
        <View
          style={styles.autoRefreshIndicator}
          accessible
          accessibilityLiveRegion="polite"
          accessibilityLabel={`Auto-refreshing every ${Math.round(refreshInterval / 1000)} seconds`}
        >
          <MaterialCommunityIcons name="sync" size={12} color="#4CAF50" />
          <Text style={styles.autoRefreshText}>Auto-refreshing every {Math.round(refreshInterval / 1000)}s</Text>
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    margin: 16,
    borderRadius: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    ...(Platform.OS === 'web' && { boxShadow: '0 2px 4px rgba(0,0,0,0.1)', elevation: 0 }),
  },
  chartTabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    paddingHorizontal: 16,
  },
  chartTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    ...(Platform.OS === 'web' ? { gap: 6 } : {}),
  },
  activeChartTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#4CAF50',
  },
  chartTabText: { fontSize: 14, color: '#999', ...(Platform.OS === 'web' && { marginLeft: 6 }) },
  activeChartTabText: { color: '#4CAF50', fontWeight: '600' },
  refreshButton: { padding: 16, justifyContent: 'center', alignItems: 'center' },
  chartContent: { padding: 16 },
  chartContainer: { alignItems: 'center' },
  chartTitle: { fontSize: 18, fontWeight: '700', color: '#333', marginBottom: 16, textAlign: 'center' },
  chart: { borderRadius: 16 },
  chartInsights: { marginTop: 16, padding: 12, backgroundColor: '#f8f9fa', borderRadius: 8, width: '100%' },
  insightText: { fontSize: 14, color: '#333', textAlign: 'center' },
  autoRefreshIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    backgroundColor: '#f8f9fa',
  },
  autoRefreshText: { fontSize: 12, color: '#4CAF50', marginLeft: 4 },
  chartFallback: { alignItems: 'center', justifyContent: 'center', padding: 20 },
  chartFallbackText: { fontSize: 16, fontWeight: '600', color: '#555', marginTop: 8, textAlign: 'center' },
  chartFallbackSubtext: { fontSize: 12, color: '#777', marginTop: 4, textAlign: 'center' },
  errorContainer: { alignItems: 'center', justifyContent: 'center', padding: 20 },
  errorText: { fontSize: 16, fontWeight: '600', color: '#F44336', marginVertical: 8, textAlign: 'center' },
  retryButton: { backgroundColor: '#4CAF50', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, marginTop: 8 },
  retryButtonText: { color: '#fff', fontWeight: '600' },
});
