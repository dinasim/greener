// Business/services/businessReportsApi.js - NEW: Business Reports & Analytics
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getEnhancedHeaders, apiRequest, handleApiResponse, ApiError } from './businessApi';

const API_BASE_URL = 'https://usersfunctions.azurewebsites.net/api';

/**
 * Get Detailed Business Analytics with Charts Data
 */
export const getDetailedAnalytics = async (timeRange = '30d', includeCharts = true) => {
  try {
    console.log('📊 Loading detailed business analytics...');
    const headers = await getEnhancedHeaders();
    
    const url = `${API_BASE_URL}/business-analytics?timeRange=${timeRange}&includeCharts=${includeCharts}`;
    const response = await apiRequest(url, {
      method: 'GET',
      headers,
    }, 3, 'Detailed Analytics');

    return {
      success: true,
      timeRange,
      analytics: {
        revenue: {
          total: response.revenue?.total || 0,
          trend: response.revenue?.trend || 'stable',
          growth: response.revenue?.growth || 0,
          chartData: response.revenue?.chartData || []
        },
        orders: {
          total: response.orders?.total || 0,
          pending: response.orders?.pending || 0,
          completed: response.orders?.completed || 0,
          cancelled: response.orders?.cancelled || 0,
          chartData: response.orders?.chartData || []
        },
        customers: {
          total: response.customers?.total || 0,
          new: response.customers?.new || 0,
          returning: response.customers?.returning || 0,
          retention: response.customers?.retention || 0,
          chartData: response.customers?.chartData || []
        },
        inventory: {
          totalItems: response.inventory?.totalItems || 0,
          lowStock: response.inventory?.lowStock || 0,
          outOfStock: response.inventory?.outOfStock || 0,
          totalValue: response.inventory?.totalValue || 0,
          topProducts: response.inventory?.topProducts || []
        },
        insights: response.insights || []
      },
      lastUpdated: new Date().toISOString()
    };
  } catch (error) {
    console.error('❌ Detailed analytics error:', error);
    throw error;
  }
};

/**
 * Generate Business Report
 */
export const generateBusinessReport = async (reportConfig) => {
  try {
    console.log('📈 Generating business report:', reportConfig.type);
    const headers = await getEnhancedHeaders();
    
    const url = `${API_BASE_URL}/business-reports`;
    const response = await apiRequest(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(reportConfig),
    }, 3, 'Generate Report');

    return {
      success: true,
      reportId: response.reportId,
      report: {
        type: reportConfig.type,
        period: reportConfig.period,
        data: response.data || {},
        summary: response.summary || {},
        charts: response.charts || [],
        recommendations: response.recommendations || []
      },
      generatedAt: new Date().toISOString()
    };
  } catch (error) {
    console.error('❌ Generate report error:', error);
    throw error;
  }
};

/**
 * Export Business Data
 */
export const exportBusinessData = async (exportType, format = 'csv') => {
  try {
    console.log(`📤 Exporting business data: ${exportType} as ${format}`);
    const headers = await getEnhancedHeaders();
    
    const url = `${API_BASE_URL}/business-reports/export`;
    const response = await apiRequest(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ exportType, format }),
    }, 3, 'Export Data');

    return response;
  } catch (error) {
    console.error('❌ Export data error:', error);
    throw error;
  }
};

export default {
  getDetailedAnalytics,
  generateBusinessReport,
  exportBusinessData,
};