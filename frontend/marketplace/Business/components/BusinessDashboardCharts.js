// Business/components/BusinessDashboardCharts.js
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
} from 'react-native';
import { 
  LineChart, 
  BarChart, 
  PieChart 
} from 'react-native-chart-kit';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';

const { width: screenWidth } = Dimensions.get('window');
const chartWidth = screenWidth - 32;

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
  
  // Animation refs
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const refreshAnim = useRef(new Animated.Value(0)).current;
  
  // Auto-refresh timer
  const refreshTimer = useRef(null);

  useEffect(() => {
    // Entrance animation
    Animated.stagger(200, [
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.timing(slideAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start();

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
  }, [autoRefresh]);

  const handleAutoRefresh = async () => {
    setIsRefreshing(true);
    
    // Refresh animation
    Animated.sequence([
      Animated.timing(refreshAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.timing(refreshAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start();
    
    try {
      await onRefresh();
    } catch (error) {
      console.error('Auto-refresh error:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleChartChange = (chartType) => {
    if (chartType === activeChart) return;
    
    // Slide animation for chart change
    Animated.sequence([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.timing(slideAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start();
    
    setActiveChart(chartType);
  };

  // Chart configurations
  const chartConfig = {
    backgroundColor: '#ffffff',
    backgroundGradientFrom: '#ffffff',
    backgroundGradientTo: '#ffffff',
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(76, 175, 80, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
    style: {
      borderRadius: 16,
    },
    propsForDots: {
      r: '6',
      strokeWidth: '2',
      stroke: '#4CAF50',
    },
    propsForLabels: {
      fontSize: 12,
    },
  };

  // Sales Chart Data - Add fallback values to prevent NaN or Infinity
  const salesChartData = {
    labels: salesData.labels || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    datasets: [
      {
        data: (salesData.values || [0, 0, 0, 0, 0, 0, 0]).map(value => 
          // Ensure we have valid numbers for the chart
          isNaN(value) || !isFinite(value) ? 0 : value
        ),
        color: (opacity = 1) => `rgba(76, 175, 80, ${opacity})`,
        strokeWidth: 3,
      },
    ],
  };

  // Orders Chart Data
  const ordersChartData = {
    labels: ['Pending', 'Confirmed', 'Ready', 'Completed'],
    datasets: [
      {
        data: [
          ordersData.pending || 0,
          ordersData.confirmed || 0,
          ordersData.ready || 0,
          ordersData.completed || 0,
        ],
      },
    ],
  };

  // Inventory Chart Data
  const inventoryPieData = [
    {
      name: 'In Stock',
      population: inventoryData.inStock || 0,
      color: '#4CAF50',
      legendFontColor: '#333',
      legendFontSize: 12,
    },
    {
      name: 'Low Stock',
      population: inventoryData.lowStock || 0,
      color: '#FF9800',
      legendFontColor: '#333',
      legendFontSize: 12,
    },
    {
      name: 'Out of Stock',
      population: inventoryData.outOfStock || 0,
      color: '#F44336',
      legendFontColor: '#333',
      legendFontSize: 12,
    },
  ];

  const renderChart = () => {
    switch (activeChart) {
      case 'sales':
        return (
          <View style={styles.chartContainer}>
            <Text style={styles.chartTitle}>Sales This Week</Text>
            <LineChart
              data={salesChartData}
              width={chartWidth}
              height={220}
              chartConfig={{
                ...chartConfig,
                propsForDots: {
                  r: "6",
                  strokeWidth: "2",
                  stroke: "#4CAF50",
                },
                // Use camelCase for web compatibility
                style: {
                  borderRadius: 16,
                }
              }}
              style={styles.chart}
              bezier
              withDots={true}
              withShadow={false}
              withInnerLines={true}
              withOuterLines={true}
              fromZero={true}
            />
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
            <BarChart
              data={ordersChartData}
              width={chartWidth}
              height={220}
              chartConfig={chartConfig}
              style={styles.chart}
              verticalLabelRotation={0}
            />
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
            <PieChart
              data={inventoryPieData}
              width={chartWidth}
              height={220}
              chartConfig={chartConfig}
              accessor="population"
              backgroundColor="transparent"
              paddingLeft="15"
              style={styles.chart}
            />
            <View style={styles.chartInsights}>
              <Text style={styles.insightText}>
                📊 Total Items: {(inventoryData.inStock || 0) + (inventoryData.lowStock || 0) + (inventoryData.outOfStock || 0)}
              </Text>
            </View>
          </View>
        );
        
      default:
        return null;
    }
  };

  return (
    <Animated.View 
      style={[
        styles.container,
        {
          opacity: fadeAnim,
          transform: [{ scale: slideAnim }],
        }
      ]}
    >
      {/* Chart Navigation */}
      <View style={styles.chartTabs}>
        {[
          { key: 'sales', label: 'Sales', icon: 'trending-up' },
          { key: 'orders', label: 'Orders', icon: 'receipt' },
          { key: 'inventory', label: 'Stock', icon: 'inventory' },
        ].map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[
              styles.chartTab,
              activeChart === tab.key && styles.activeChartTab,
            ]}
            onPress={() => handleChartChange(tab.key)}
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
          </TouchableOpacity>
        ))}
        
        {/* Refresh Indicator */}
        <TouchableOpacity 
          style={styles.refreshButton}
          onPress={handleAutoRefresh}
          disabled={isRefreshing}
        >
          <Animated.View
            style={{
              transform: [{
                rotate: refreshAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0deg', '360deg'],
                })
              }]
            }}
          >
            <MaterialIcons 
              name="refresh" 
              size={20} 
              color={isRefreshing ? '#4CAF50' : '#999'} 
            />
          </Animated.View>
        </TouchableOpacity>
      </View>

      {/* Chart Content */}
      <Animated.View
        style={[
          styles.chartContent,
          {
            opacity: slideAnim,
            transform: [{
              translateX: slideAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [50, 0],
              })
            }]
          }
        ]}
      >
        {renderChart()}
      </Animated.View>
      
      {/* Auto-refresh indicator */}
      {autoRefresh && (
        <View style={styles.autoRefreshIndicator}>
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
    gap: 6,
  },
  activeChartTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#4CAF50',
  },
  chartTabText: {
    fontSize: 14,
    color: '#999',
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
});