// Business/BusinessScreens/BusinessReportsScreen.js - Business reports and analytics
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Animated,
  Share,
  Platform,
} from 'react-native';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LineChart, BarChart, PieChart } from 'react-native-chart-kit';
import { Dimensions } from 'react-native';
import { getBusinessReports, getBusinessDashboard, getBusinessInventory, getBusinessOrders, getBusinessCustomers } from '../services/businessApi';

const { width: screenWidth } = Dimensions.get('window');

export default function BusinessReportsScreen({ navigation, route }) {
  const { businessId } = route.params || {};
  
  const [reportType, setReportType] = useState('sales');
  const [timeframe, setTimeframe] = useState('month');
  const [reportData, setReportData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(null);
  
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadReportData();
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [reportType, timeframe]);

  const loadReportData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Load real data from multiple API endpoints
      const [dashboardResponse, inventoryResponse, ordersResponse, customersResponse] = await Promise.allSettled([
        getBusinessDashboard(),
        getBusinessInventory(),
        getBusinessOrders('all', 100),
        getBusinessCustomers()
      ]);

      // Process dashboard data
      const dashboardData = dashboardResponse.status === 'fulfilled' ? dashboardResponse.value : null;
      const inventoryData = inventoryResponse.status === 'fulfilled' ? inventoryResponse.value : null;
      const ordersData = ordersResponse.status === 'fulfilled' ? ordersResponse.value : null;
      const customersData = customersResponse.status === 'fulfilled' ? customersResponse.value : null;

      // Transform real data into report format
      const realReportData = {
        sales: generateSalesReport(dashboardData, ordersData),
        inventory: generateInventoryReport(inventoryData),
        customers: generateCustomersReport(customersData, ordersData)
      };
      
      setReportData(realReportData);
    } catch (error) {
      console.error('Error loading report data:', error);
      setError(error.message);
      Alert.alert('Error', `Failed to load report data: ${error.message}`);
      
      // Fallback to basic structure if APIs fail
      setReportData({
        sales: { summary: { totalRevenue: 0, totalOrders: 0, averageOrderValue: 0, growth: 0 }, chartData: null, topProducts: [] },
        inventory: { summary: { totalItems: 0, activeItems: 0, lowStockItems: 0, outOfStockItems: 0 }, categoryBreakdown: [], stockLevels: null },
        customers: { summary: { totalCustomers: 0, newCustomers: 0, returningCustomers: 0, customerGrowth: 0 }, acquisitionData: null }
      });
    } finally {
      setIsLoading(false);
    }
  };

  const generateSalesReport = (dashboardData, ordersData) => {
    try {
      const orders = ordersData?.orders || [];
      const currentMonth = new Date().getMonth();
      const currentYear = new Date().getFullYear();
      
      // Filter orders for current period based on timeframe
      const filteredOrders = orders.filter(order => {
        const orderDate = new Date(order.orderDate || order.createdAt);
        if (timeframe === 'month') {
          return orderDate.getMonth() === currentMonth && orderDate.getFullYear() === currentYear;
        } else if (timeframe === 'week') {
          const oneWeekAgo = new Date();
          oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
          return orderDate >= oneWeekAgo;
        }
        return true;
      });

      const totalRevenue = filteredOrders.reduce((sum, order) => sum + (order.totalAmount || 0), 0);
      const totalOrders = filteredOrders.length;
      const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

      // Calculate growth (compare with previous period)
      const previousPeriodOrders = orders.filter(order => {
        const orderDate = new Date(order.orderDate || order.createdAt);
        if (timeframe === 'month') {
          const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
          const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
          return orderDate.getMonth() === prevMonth && orderDate.getFullYear() === prevYear;
        }
        return false;
      });
      
      const previousRevenue = previousPeriodOrders.reduce((sum, order) => sum + (order.totalAmount || 0), 0);
      const growth = previousRevenue > 0 ? ((totalRevenue - previousRevenue) / previousRevenue) * 100 : 0;

      // Generate chart data
      const chartData = generateSalesChartData(filteredOrders, timeframe);

      // Calculate top products
      const productSales = {};
      filteredOrders.forEach(order => {
        (order.items || []).forEach(item => {
          const productName = item.name || item.productName || 'Unknown Product';
          if (!productSales[productName]) {
            productSales[productName] = { sales: 0, revenue: 0 };
          }
          productSales[productName].sales += item.quantity || 1;
          productSales[productName].revenue += (item.price || 0) * (item.quantity || 1);
        });
      });

      const topProducts = Object.entries(productSales)
        .map(([name, data]) => ({ name, ...data }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5);

      return {
        summary: {
          totalRevenue: Math.round(totalRevenue),
          totalOrders,
          averageOrderValue: Math.round(averageOrderValue),
          growth: Math.round(growth * 10) / 10
        },
        chartData,
        topProducts
      };
    } catch (error) {
      console.error('Error generating sales report:', error);
      return {
        summary: { totalRevenue: 0, totalOrders: 0, averageOrderValue: 0, growth: 0 },
        chartData: null,
        topProducts: []
      };
    }
  };

  const generateInventoryReport = (inventoryData) => {
    try {
      const inventory = inventoryData?.inventory || [];
      const summary = inventoryData?.summary || {};

      // Category breakdown
      const categoryCount = {};
      inventory.forEach(item => {
        const category = item.category || 'Uncategorized';
        categoryCount[category] = (categoryCount[category] || 0) + 1;
      });

      const categoryBreakdown = Object.entries(categoryCount).map(([name, count], index) => ({
        name,
        count,
        color: ['#4CAF50', '#2196F3', '#FF9800', '#9C27B0', '#F44336', '#795548'][index % 6]
      }));

      // Stock levels for chart
      const highStock = inventory.filter(item => (item.quantity || 0) > (item.minThreshold || 5) * 2).length;
      const mediumStock = inventory.filter(item => {
        const qty = item.quantity || 0;
        const threshold = item.minThreshold || 5;
        return qty > threshold && qty <= threshold * 2;
      }).length;
      const lowStock = inventory.filter(item => {
        const qty = item.quantity || 0;
        const threshold = item.minThreshold || 5;
        return qty > 0 && qty <= threshold;
      }).length;
      const outOfStock = inventory.filter(item => (item.quantity || 0) === 0).length;

      return {
        summary: {
          totalItems: summary.totalItems || inventory.length,
          activeItems: summary.activeItems || inventory.filter(item => item.status === 'active').length,
          lowStockItems: summary.lowStockItems || lowStock,
          outOfStockItems: outOfStock
        },
        categoryBreakdown,
        stockLevels: {
          labels: ['High Stock', 'Medium Stock', 'Low Stock', 'Out of Stock'],
          datasets: [{
            data: [highStock, mediumStock, lowStock, outOfStock]
          }]
        }
      };
    } catch (error) {
      console.error('Error generating inventory report:', error);
      return {
        summary: { totalItems: 0, activeItems: 0, lowStockItems: 0, outOfStockItems: 0 },
        categoryBreakdown: [],
        stockLevels: null
      };
    }
  };

  const generateCustomersReport = (customersData, ordersData) => {
    try {
      const customers = customersData?.customers || [];
      const orders = ordersData?.orders || [];

      // Calculate new vs returning customers
      const currentMonth = new Date().getMonth();
      const newCustomers = customers.filter(customer => {
        const joinDate = new Date(customer.customerSince || customer.createdAt);
        return joinDate.getMonth() === currentMonth;
      }).length;

      const returningCustomers = customers.length - newCustomers;

      // Calculate growth
      const previousMonth = currentMonth === 0 ? 11 : currentMonth - 1;
      const previousMonthCustomers = customers.filter(customer => {
        const joinDate = new Date(customer.customerSince || customer.createdAt);
        return joinDate.getMonth() === previousMonth;
      }).length;

      const customerGrowth = previousMonthCustomers > 0 ? ((newCustomers - previousMonthCustomers) / previousMonthCustomers) * 100 : 0;

      // Generate acquisition chart data
      const acquisitionData = generateCustomerAcquisitionData(customers);

      return {
        summary: {
          totalCustomers: customers.length,
          newCustomers,
          returningCustomers,
          customerGrowth: Math.round(customerGrowth * 10) / 10
        },
        acquisitionData
      };
    } catch (error) {
      console.error('Error generating customers report:', error);
      return {
        summary: { totalCustomers: 0, newCustomers: 0, returningCustomers: 0, customerGrowth: 0 },
        acquisitionData: null
      };
    }
  };

  const generateSalesChartData = (orders, timeframe) => {
    try {
      if (timeframe === 'week') {
        const weekData = Array(7).fill(0);
        const weekLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        
        orders.forEach(order => {
          const orderDate = new Date(order.orderDate || order.createdAt);
          const dayOfWeek = (orderDate.getDay() + 6) % 7; // Convert Sunday=0 to Monday=0
          weekData[dayOfWeek] += order.totalAmount || 0;
        });

        return {
          labels: weekLabels,
          datasets: [{
            data: weekData,
            color: (opacity = 1) => `rgba(76, 175, 80, ${opacity})`,
            strokeWidth: 2
          }]
        };
      } else if (timeframe === 'month') {
        const weekData = Array(4).fill(0);
        const weekLabels = ['Week 1', 'Week 2', 'Week 3', 'Week 4'];
        
        orders.forEach(order => {
          const orderDate = new Date(order.orderDate || order.createdAt);
          const weekOfMonth = Math.floor((orderDate.getDate() - 1) / 7);
          if (weekOfMonth < 4) {
            weekData[weekOfMonth] += order.totalAmount || 0;
          }
        });

        return {
          labels: weekLabels,
          datasets: [{
            data: weekData,
            color: (opacity = 1) => `rgba(76, 175, 80, ${opacity})`,
            strokeWidth: 2
          }]
        };
      }
      
      return null;
    } catch (error) {
      console.error('Error generating sales chart data:', error);
      return null;
    }
  };

  const generateCustomerAcquisitionData = (customers) => {
    try {
      const monthlyData = Array(6).fill(0);
      const monthLabels = [];
      
      // Generate labels for last 6 months
      for (let i = 5; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        monthLabels.push(date.toLocaleDateString('en', { month: 'short' }));
      }

      // Count customers by month
      customers.forEach(customer => {
        const joinDate = new Date(customer.customerSince || customer.createdAt);
        const monthsAgo = Math.floor((Date.now() - joinDate.getTime()) / (1000 * 60 * 60 * 24 * 30));
        if (monthsAgo >= 0 && monthsAgo < 6) {
          monthlyData[5 - monthsAgo]++;
        }
      });

      return {
        labels: monthLabels,
        datasets: [{
          data: monthlyData,
          color: (opacity = 1) => `rgba(33, 150, 243, ${opacity})`,
          strokeWidth: 2
        }]
      };
    } catch (error) {
      console.error('Error generating customer acquisition data:', error);
      return null;
    }
  };

  const generateReport = async () => {
    setIsGenerating(true);
    try {
      // Simulate report generation
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const reportContent = createReportContent();
      
      // Share the report
      await Share.share({
        title: `${reportType.charAt(0).toUpperCase() + reportType.slice(1)} Report`,
        message: reportContent,
      });
      
    } catch (error) {
      Alert.alert('Error', 'Failed to generate report');
    } finally {
      setIsGenerating(false);
    }
  };

  const createReportContent = () => {
    const now = new Date();
    const data = reportData[reportType];
    
    let content = `📊 ${reportType.charAt(0).toUpperCase() + reportType.slice(1)} Report\n`;
    content += `Generated: ${now.toLocaleDateString()}\n`;
    content += `Period: ${timeframe}\n\n`;
    
    if (reportType === 'sales') {
      content += `💰 Revenue: $${data.summary.totalRevenue.toLocaleString()}\n`;
      content += `📦 Orders: ${data.summary.totalOrders}\n`;
      content += `💵 Avg Order: $${data.summary.averageOrderValue}\n`;
      content += `📈 Growth: ${data.summary.growth}%\n\n`;
      content += `🏆 Top Products:\n`;
      data.topProducts.forEach((product, index) => {
        content += `${index + 1}. ${product.name} - ${product.sales} units ($${product.revenue})\n`;
      });
    } else if (reportType === 'inventory') {
      content += `📋 Total Items: ${data.summary.totalItems}\n`;
      content += `✅ Active: ${data.summary.activeItems}\n`;
      content += `⚠️ Low Stock: ${data.summary.lowStockItems}\n`;
      content += `❌ Out of Stock: ${data.summary.outOfStockItems}\n`;
    } else if (reportType === 'customers') {
      content += `👥 Total Customers: ${data.summary.totalCustomers}\n`;
      content += `🆕 New Customers: ${data.summary.newCustomers}\n`;
      content += `🔄 Returning: ${data.summary.returningCustomers}\n`;
      content += `📈 Growth: ${data.summary.customerGrowth}%\n`;
    }
    
    return content;
  };

  const renderSalesReport = () => {
    const data = reportData.sales;
    
    return (
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Summary Cards */}
        <View style={styles.summaryGrid}>
          <View style={styles.summaryCard}>
            <MaterialIcons name="attach-money" size={24} color="#4CAF50" />
            <Text style={styles.summaryValue}>${data.summary.totalRevenue.toLocaleString()}</Text>
            <Text style={styles.summaryLabel}>Total Revenue</Text>
            <View style={styles.growthIndicator}>
              <MaterialIcons name="trending-up" size={16} color="#4CAF50" />
              <Text style={[styles.growthText, { color: '#4CAF50' }]}>+{data.summary.growth}%</Text>
            </View>
          </View>
          
          <View style={styles.summaryCard}>
            <MaterialIcons name="shopping-cart" size={24} color="#2196F3" />
            <Text style={styles.summaryValue}>{data.summary.totalOrders}</Text>
            <Text style={styles.summaryLabel}>Total Orders</Text>
          </View>
          
          <View style={styles.summaryCard}>
            <MaterialIcons name="payment" size={24} color="#FF9800" />
            <Text style={styles.summaryValue}>${data.summary.averageOrderValue}</Text>
            <Text style={styles.summaryLabel}>Avg Order Value</Text>
          </View>
        </View>

        {/* Revenue Chart */}
        <View style={styles.chartContainer}>
          <Text style={styles.chartTitle}>Revenue Trend</Text>
          <LineChart
            data={data.chartData}
            width={screenWidth - 32}
            height={220}
            chartConfig={{
              backgroundColor: '#ffffff',
              backgroundGradientFrom: '#ffffff',
              backgroundGradientTo: '#ffffff',
              decimalPlaces: 0,
              color: (opacity = 1) => `rgba(76, 175, 80, ${opacity})`,
              labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
              style: { borderRadius: 16 },
              propsForDots: { r: '6', strokeWidth: '2', stroke: '#4CAF50' }
            }}
            bezier
            style={styles.chart}
          />
        </View>

        {/* Top Products */}
        <View style={styles.topProductsContainer}>
          <Text style={styles.sectionTitle}>Top Selling Products</Text>
          {data.topProducts.map((product, index) => (
            <View key={index} style={styles.productItem}>
              <View style={styles.productRank}>
                <Text style={styles.rankNumber}>{index + 1}</Text>
              </View>
              <View style={styles.productInfo}>
                <Text style={styles.productName}>{product.name}</Text>
                <Text style={styles.productStats}>{product.sales} units • ${product.revenue}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    );
  };

  const renderInventoryReport = () => {
    const data = reportData.inventory;
    
    return (
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Summary Grid */}
        <View style={styles.summaryGrid}>
          <View style={styles.summaryCard}>
            <MaterialIcons name="inventory" size={24} color="#4CAF50" />
            <Text style={styles.summaryValue}>{data.summary.totalItems}</Text>
            <Text style={styles.summaryLabel}>Total Items</Text>
          </View>
          
          <View style={styles.summaryCard}>
            <MaterialIcons name="check-circle" size={24} color="#2196F3" />
            <Text style={styles.summaryValue}>{data.summary.activeItems}</Text>
            <Text style={styles.summaryLabel}>Active Items</Text>
          </View>
          
          <View style={styles.summaryCard}>
            <MaterialIcons name="warning" size={24} color="#FF9800" />
            <Text style={styles.summaryValue}>{data.summary.lowStockItems}</Text>
            <Text style={styles.summaryLabel}>Low Stock</Text>
          </View>
        </View>

        {/* Category Breakdown */}
        <View style={styles.chartContainer}>
          <Text style={styles.chartTitle}>Inventory by Category</Text>
          <PieChart
            data={data.categoryBreakdown.map(item => ({
              ...item,
              population: item.count,
              legendFontColor: '#333',
              legendFontSize: 12
            }))}
            width={screenWidth - 32}
            height={220}
            chartConfig={{
              color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
            }}
            accessor="population"
            backgroundColor="transparent"
            paddingLeft="15"
            style={styles.chart}
          />
        </View>
      </ScrollView>
    );
  };

  const renderCustomersReport = () => {
    const data = reportData.customers;
    
    return (
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Summary Grid */}
        <View style={styles.summaryGrid}>
          <View style={styles.summaryCard}>
            <MaterialIcons name="people" size={24} color="#4CAF50" />
            <Text style={styles.summaryValue}>{data.summary.totalCustomers}</Text>
            <Text style={styles.summaryLabel}>Total Customers</Text>
          </View>
          
          <View style={styles.summaryCard}>
            <MaterialIcons name="person-add" size={24} color="#2196F3" />
            <Text style={styles.summaryValue}>{data.summary.newCustomers}</Text>
            <Text style={styles.summaryLabel}>New Customers</Text>
            <View style={styles.growthIndicator}>
              <MaterialIcons name="trending-up" size={16} color="#4CAF50" />
              <Text style={[styles.growthText, { color: '#4CAF50' }]}>+{data.summary.customerGrowth}%</Text>
            </View>
          </View>
          
          <View style={styles.summaryCard}>
            <MaterialIcons name="replay" size={24} color="#FF9800" />
            <Text style={styles.summaryValue}>{data.summary.returningCustomers}</Text>
            <Text style={styles.summaryLabel}>Returning</Text>
          </View>
        </View>

        {/* Customer Acquisition Chart */}
        <View style={styles.chartContainer}>
          <Text style={styles.chartTitle}>Customer Acquisition</Text>
          <LineChart
            data={data.acquisitionData}
            width={screenWidth - 32}
            height={220}
            chartConfig={{
              backgroundColor: '#ffffff',
              backgroundGradientFrom: '#ffffff',
              backgroundGradientTo: '#ffffff',
              decimalPlaces: 0,
              color: (opacity = 1) => `rgba(33, 150, 243, ${opacity})`,
              labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
              style: { borderRadius: 16 },
              propsForDots: { r: '6', strokeWidth: '2', stroke: '#2196F3' }
            }}
            bezier
            style={styles.chart}
          />
        </View>
      </ScrollView>
    );
  };

  const renderReportContent = () => {
    if (!reportData) return null;
    
    switch (reportType) {
      case 'sales':
        return renderSalesReport();
      case 'inventory':
        return renderInventoryReport();
      case 'customers':
        return renderCustomersReport();
      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text style={styles.loadingText}>Loading reports...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color="#4CAF50" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Business Reports</Text>
        <TouchableOpacity onPress={generateReport} style={styles.shareButton} disabled={isGenerating}>
          {isGenerating ? (
            <ActivityIndicator size="small" color="#4CAF50" />
          ) : (
            <MaterialIcons name="share" size={24} color="#4CAF50" />
          )}
        </TouchableOpacity>
      </View>

      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        {/* Report Type Selector */}
        <View style={styles.selectorContainer}>
          <View style={styles.selectorRow}>
            {['sales', 'inventory', 'customers'].map((type) => (
              <TouchableOpacity
                key={type}
                style={[
                  styles.selectorButton,
                  reportType === type && styles.activeSelectorButton
                ]}
                onPress={() => setReportType(type)}
              >
                <Text style={[
                  styles.selectorText,
                  reportType === type && styles.activeSelectorText
                ]}>
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Timeframe Selector */}
          <View style={styles.selectorRow}>
            {['week', 'month', 'quarter', 'year'].map((period) => (
              <TouchableOpacity
                key={period}
                style={[
                  styles.timeframeButton,
                  timeframe === period && styles.activeTimeframeButton
                ]}
                onPress={() => setTimeframe(period)}
              >
                <Text style={[
                  styles.timeframeText,
                  timeframe === period && styles.activeTimeframeText
                ]}>
                  {period.charAt(0).toUpperCase() + period.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Report Content */}
        <View style={styles.reportContent}>
          {renderReportContent()}
        </View>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#f0f9f3',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  shareButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#f0f9f3',
  },
  content: {
    flex: 1,
  },
  selectorContainer: {
    backgroundColor: '#fff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  selectorRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  selectorButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    marginHorizontal: 4,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
  },
  activeSelectorButton: {
    backgroundColor: '#4CAF50',
  },
  selectorText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  activeSelectorText: {
    color: '#fff',
  },
  timeframeButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 4,
    marginHorizontal: 2,
    borderRadius: 6,
    backgroundColor: '#f8f9fa',
    alignItems: 'center',
  },
  activeTimeframeButton: {
    backgroundColor: '#e8f5e8',
  },
  timeframeText: {
    fontSize: 12,
    color: '#666',
  },
  activeTimeframeText: {
    color: '#4CAF50',
    fontWeight: '600',
  },
  reportContent: {
    flex: 1,
    padding: 16,
  },
  summaryGrid: {
    flexDirection: 'row',
    marginBottom: 20,
    gap: 12,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
    marginTop: 8,
  },
  summaryLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    textAlign: 'center',
  },
  growthIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  growthText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 2,
  },
  chartContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },
  chart: {
    borderRadius: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  topProductsContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  productItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  productRank: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  rankNumber: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  productStats: {
    fontSize: 12,
    color: '#666',
  },
});