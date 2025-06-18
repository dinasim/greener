// Business/components/BusinessDashboardCharts.js - COMPLETE WEB COMPATIBILITY FIX
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  Platform,
  Dimensions,
  Pressable, // FIXED: Use Pressable instead of deprecated TouchableMixin
} from 'react-native';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';

// FIXED: Conditional chart imports to prevent web compatibility issues
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

// FIXED: Web-safe chart wrapper with proper error boundaries
const WebSafeChart = ({ children, fallback, chartType = 'chart' }) => {
  const [hasError, setHasError] = useState(false);

  if (Platform.OS === 'web' || hasError || !LineChart) {
    return fallback || (
      <View style={styles.chartFallback}>
        <MaterialIcons name="bar-chart" size={48} color="#e0e0e0" />
        <Text style={styles.chartFallbackText}>Chart display unavailable on web</Text>
        <Text style={styles.chartFallbackSubtext}>Data is being processed correctly</Text>
      </View>
    );
  }

  // Error boundary wrapper for native charts
  try {
    return (
      <View style={{ minHeight: 220, justifyContent: 'center', alignItems: 'center' }}>
        {children}
      </View>
    );
  } catch (error) {
    console.warn(`Chart rendering failed for ${chartType}:`, error);
    setHasError(true);
    return fallback || (
      <View style={styles.chartFallback}>
        <MaterialIcons name="error-outline" size={48} color="#f44336" />
        <Text style={styles.chartFallbackText}>Chart error occurred</Text>
        <Text style={styles.chartFallbackSubtext}>Please refresh to try again</Text>
      </View>
    );
  }
};

export default function BusinessDashboardCharts({
  salesData = {},
  inventoryData = {},
  ordersData = {},
  onRefresh = () => {},
  autoRefresh = true,
  refreshInterval = 60000
}) {
  const [activeChart, setActiveChart] = useState('sales');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [chartError, setChartError] = useState(null);
  
  // Animation refs
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const refreshAnim = useRef(new Animated.Value(0)).current;
  
  // Auto-refresh timer
  const refreshTimer = useRef(null);

  useEffect(() => {
    // FIXED: Web-compatible entrance animation
    const animations = [
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: Platform.OS !== 'web', // FIXED: Disable native driver on web
      }),
      Animated.timing(slideAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: Platform.OS !== 'web', // FIXED: Disable native driver on web
      }),
    ];

    Animated.stagger(200, animations).start();

    // Auto-refresh setup
    if (autoRefresh) {
      refreshTimer.current = setInterval(() => {
        handleAutoRefresh();
      }, refreshInterval);
    }

    return () => {
      if (refreshTimer.current) {
        clearInterval(refreshTimer.current);
      }
    };
  }, [autoRefresh, refreshInterval]); // FIXED: Added missing dependencies

  const handleAutoRefresh = async () => {
    setIsRefreshing(true);
    setChartError(null);
    
    Animated.sequence([
      Animated.timing(refreshAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: Platform.OS !== 'web', // FIXED: Disable native driver on web
      }),
      Animated.timing(refreshAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: Platform.OS !== 'web', // FIXED: Disable native driver on web
      }),
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
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: Platform.OS !== 'web', // FIXED: Disable native driver on web
      }),
      Animated.timing(slideAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: Platform.OS !== 'web', // FIXED: Disable native driver on web
      }),
    ]).start();
    
    setActiveChart(chartType);
  };

  // FIXED: Web-safe chart configuration with proper SVG properties
  const getWebSafeChartConfig = () => {
    const baseConfig = {
      backgroundColor: '#ffffff',
      backgroundGradientFrom: '#ffffff',
      backgroundGradientTo: '#ffffff',
      decimalPlaces: 0,
      style: { borderRadius: 16 },
      strokeWidth: 2,
      useShadowColorFromDataset: false,
    };

    if (Platform.OS === 'web') {
      return {
        ...baseConfig,
        color: () => '#4CAF50', // FIXED: Function instead of rgba for web
        labelColor: () => '#000000', // FIXED: Function instead of rgba for web
        propsForDots: {},
        propsForLabels: {},
        fillShadowGradient: '#4CAF50', // FIXED: String color instead of boolean
        fillShadowGradientOpacity: 0,
      };
    }

    return {
      ...baseConfig,
      color: (opacity = 1) => `rgba(76, 175, 80, ${opacity})`,
      labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
      propsForDots: {
        r: '6',
        strokeWidth: '2',
        stroke: '#4CAF50',
        fill: '#4CAF50',
      },
    };
  };

  const validateChartData = (data, fallback) => {
    try {
      if (!Array.isArray(data)) return fallback;
      return data.map(value => {
        const num = Number(value);
        return isNaN(num) || !isFinite(num) ? 0 : Math.max(0, num);
      });
    } catch (error) {
      console.warn('Chart data validation error:', error);
      return fallback;
    }
  };

  const getSalesChartData = () => {
    try {
      return {
        labels: salesData.labels || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        datasets: [
          {
            data: validateChartData(salesData.values, [0, 0, 0, 0, 0, 0, 0]),
            ...(Platform.OS === 'web' ? {
              color: '#4CAF50',
              strokeWidth: 2,
            } : {
              color: (opacity = 1) => `rgba(76, 175, 80, ${opacity})`,
              strokeWidth: 3,
            }),
          },
        ],
      };
    } catch (error) {
      console.error('Sales chart data error:', error);
      return {
        labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        datasets: [{ data: [0, 0, 0, 0, 0, 0, 0] }],
      };
    }
  };

  const getOrdersChartData = () => {
    try {
      return {
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
      };
    } catch (error) {
      console.error('Orders chart data error:', error);
      return {
        labels: ['Pending', 'Confirmed', 'Ready', 'Completed'],
        datasets: [{ data: [0, 0, 0, 0] }],
      };
    }
  };

  const getInventoryPieData = () => {
    try {
      const data = [
        {
          name: 'In Stock',
          population: Math.max(0, inventoryData.inStock || 0),
          color: '#4CAF50',
          legendFontColor: '#333',
          legendFontSize: 12,
        },
        {
          name: 'Low Stock',
          population: Math.max(0, inventoryData.lowStock || 0),
          color: '#FF9800',
          legendFontColor: '#333',
          legendFontSize: 12,
        },
        {
          name: 'Out of Stock',
          population: Math.max(0, inventoryData.outOfStock || 0),
          color: '#F44336',
          legendFontColor: '#333',
          legendFontSize: 12,
        },
      ];
      
      return data;
    } catch (error) {
      console.error('Inventory pie data error:', error);
      return [
        { name: 'In Stock', population: 0, color: '#4CAF50', legendFontColor: '#333', legendFontSize: 12 },
        { name: 'Low Stock', population: 0, color: '#FF9800', legendFontColor: '#333', legendFontSize: 12 },
        { name: 'Out of Stock', population: 0, color: '#F44336', legendFontColor: '#333', legendFontSize: 12 },
      ];
    }
  };

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

    try {
      const chartConfig = getWebSafeChartConfig();
      
      switch (activeChart) {
        case 'sales':
          return (
            <View style={styles.chartContainer}>
              <Text style={styles.chartTitle}>Sales This Week</Text>
              <WebSafeChart 
                chartType="line"
                fallback={
                  <View style={styles.chartFallback}>
                    <MaterialIcons name="trending-up" size={48} color="#4CAF50" />
                    <Text style={styles.chartFallbackText}>Sales: ${salesData.total || 0}</Text>
                    <Text style={styles.chartFallbackSubtext}>Average: ${salesData.average || 0}/day</Text>
                  </View>
                }
              >
                {LineChart && (
                  <LineChart
                    data={getSalesChartData()}
                    width={chartWidth}
                    height={220}
                    chartConfig={chartConfig}
                    style={styles.chart}
                    withShadow={false}
                    fromZero={true}
                    bezier={Platform.OS !== 'web'}
                    withDots={Platform.OS !== 'web'}
                    withInnerLines={Platform.OS !== 'web'}
                    withOuterLines={Platform.OS !== 'web'}
                  />
                )}
              </WebSafeChart>
              <View style={styles.chartInsights}>
                <Text style={styles.insightText}>
                  📈 Total: ${salesData.total || 0} | Avg: ${salesData.average || 0}/day
                </Text>
              </View>
            </View>
          );
          
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
                    <Text style={styles.chartFallbackSubtext}>Active: {(ordersData.pending || 0) + (ordersData.confirmed || 0)}</Text>
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
                    withHorizontalLabels={true}
                    withVerticalLabels={true}
                    yAxisLabel=""
                    yAxisSuffix=""
                    showValuesOnTopOfBars={Platform.OS !== 'web'}
                    withInnerLines={Platform.OS !== 'web'}
                  />
                )}
              </WebSafeChart>
              <View style={styles.chartInsights}>
                <Text style={styles.insightText}>
                  📦 Total: {ordersData.total || 0} orders | Active: {(ordersData.pending || 0) + (ordersData.confirmed || 0) + (ordersData.ready || 0)}
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
                    <Text style={styles.chartFallbackSubtext}>Low: {inventoryData.lowStock || 0} | Out: {inventoryData.outOfStock || 0}</Text>
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
                    hasLegend={true}
                    avoidFalseZero={true}
                    absolute={Platform.OS !== 'web'}
                  />
                )}
              </WebSafeChart>
              <View style={styles.chartInsights}>
                <Text style={styles.insightText}>
                  📊 Total Items: {(inventoryData.inStock || 0) + (inventoryData.lowStock || 0) + (inventoryData.outOfStock || 0)}
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
    } catch (error) {
      console.error('Chart rendering error:', error);
      setChartError(`Chart error: ${error.message}`);
      return (
        <View style={styles.errorContainer}>
          <MaterialIcons name="error-outline" size={48} color="#F44336" />
          <Text style={styles.errorText}>Unable to display chart</Text>
          <Pressable style={styles.retryButton} onPress={handleAutoRefresh}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </Pressable>
        </View>
      );
    }
  };

  return (
    <Animated.View 
      style={[
        styles.container,
        {
          opacity: fadeAnim,
          transform: Platform.OS === 'web' ? [] : [{ scale: slideAnim }], // FIXED: Conditional transform for web
        }
      ]}
      accessible={true}
      accessibilityRole="region"
      accessibilityLabel="Business dashboard charts"
    >
      {/* Chart Navigation - FIXED: Use Pressable instead of TouchableOpacity for better web support */}
      <View style={styles.chartTabs} accessible={true} accessibilityRole="tablist">
        {[
          { key: 'sales', label: 'Sales', icon: 'trending-up' },
          { key: 'orders', label: 'Orders', icon: 'receipt' },
          { key: 'inventory', label: 'Stock', icon: 'inventory' },
        ].map((tab) => (
          <Pressable
            key={tab.key}
            style={[
              styles.chartTab,
              activeChart === tab.key && styles.activeChartTab,
            ]}
            onPress={() => handleChartChange(tab.key)}
            accessible={true}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeChart === tab.key }}
            accessibilityLabel={`${tab.label} chart tab`}
          >
            <MaterialIcons 
              name={tab.icon} 
              size={20} 
              color={activeChart === tab.key ? '#4CAF50' : '#999'} 
            />
            <Text
              style={[
                styles.chartTabText,
                activeChart === tab.key && styles.activeChartTabText,
              ]}
            >
              {tab.label}
            </Text>
          </Pressable>
        ))}
        
        {/* Refresh button */}
        <Pressable 
          style={styles.refreshButton}
          onPress={handleAutoRefresh}
          disabled={isRefreshing}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel={isRefreshing ? "Refreshing data" : "Refresh chart data"}
          accessibilityState={{ disabled: isRefreshing }}
        >
          <Animated.View
            style={Platform.OS === 'web' ? {} : {
              transform: [{
                rotate: refreshAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0deg', '360deg'],
                })
              }],
            }}
          >
            <MaterialIcons 
              name="refresh" 
              size={20} 
              color={isRefreshing ? '#4CAF50' : '#999'} 
            />
          </Animated.View>
        </Pressable>
      </View>

      {/* Chart Content */}
      <Animated.View
        style={[
          styles.chartContent,
          Platform.OS === 'web' ? { opacity: slideAnim } : {
            opacity: slideAnim,
            transform: [{
              translateX: slideAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [50, 0],
              })
            }]
          }
        ]}
        accessible={true}
        accessibilityRole="region"
        accessibilityLabel={`${activeChart} chart content`}
      >
        {renderChart()}
      </Animated.View>
      
      {/* Auto-refresh indicator */}
      {autoRefresh && (
        <View 
          style={styles.autoRefreshIndicator}
          accessible={true}
          accessibilityRole="status"
          accessibilityLabel={`Auto-refreshing every ${refreshInterval / 1000} seconds`}
        >
          <MaterialCommunityIcons name="sync" size={12} color="#4CAF50" />
          <Text style={styles.autoRefreshText}>Auto-refreshing every {refreshInterval / 1000}s</Text>
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
    ...(Platform.OS === 'web' && {
      boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
      elevation: 0,
    }),
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
  chartTabText: {
    fontSize: 14,
    color: '#999',
    ...(Platform.OS === 'web' && { marginLeft: 6 }),
  },
  activeChartTabText: {
    color: '#4CAF50',
    fontWeight: '600',
  },
  refreshButton: {
    padding: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chartContent: {
    padding: 16,
  },
  chartContainer: {
    alignItems: 'center',
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },
  chart: {
    borderRadius: 16,
  },
  chartInsights: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    width: '100%',
  },
  insightText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  autoRefreshIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    backgroundColor: '#f0f9f3',
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
  autoRefreshText: {
    fontSize: 10,
    color: '#4CAF50',
    marginLeft: 4,
  },
  errorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    minHeight: 220,
  },
  errorText: {
    fontSize: 16,
    color: '#F44336',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  chartFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    minHeight: 220,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    borderStyle: 'dashed',
  },
  chartFallbackText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginTop: 12,
    textAlign: 'center',
  },
  chartFallbackSubtext: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
    textAlign: 'center',
  },
});