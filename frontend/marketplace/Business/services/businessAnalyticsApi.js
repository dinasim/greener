// Business/services/businessAnalyticsApi.js - Enhanced with Auto-Refresh
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = 'https://usersfunctions.azurewebsites.net/api';

// Enhanced error handling and logging
class ApiError extends Error {
  constructor(message, status, response) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.response = response;
  }
}

// Get enhanced headers with all business context
const getEnhancedHeaders = async () => {
  try {
    const [userEmail, userType, businessId, authToken] = await Promise.all([
      AsyncStorage.getItem('userEmail'),
      AsyncStorage.getItem('userType'),
      AsyncStorage.getItem('businessId'),
      AsyncStorage.getItem('authToken')
    ]);
    
    const headers = {
      'Content-Type': 'application/json',
      'X-API-Version': '1.0',
      'X-Client': 'greener-mobile'
    };
    
    if (userEmail) headers['X-User-Email'] = userEmail;
    if (userType) headers['X-User-Type'] = userType;
    if (businessId) headers['X-Business-ID'] = businessId;
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
    
    console.log('🔗 Analytics API Headers:', { ...headers, 'Authorization': authToken ? '[REDACTED]' : 'None' });
    return headers;
  } catch (error) {
    console.error('❌ Error getting headers:', error);
    return { 'Content-Type': 'application/json' };
  }
};

// Enhanced response handler with detailed error reporting
const handleApiResponse = async (response, context = 'Analytics API Request') => {
  const startTime = Date.now();
  console.log(`📡 ${context} - Status: ${response.status} (${Date.now() - startTime}ms)`);
  
  let responseText;
  try {
    responseText = await response.text();
    console.log(`📝 ${context} - Response: ${responseText.substring(0, 500)}${responseText.length > 500 ? '...' : ''}`);
  } catch (textError) {
    console.error(`❌ ${context} - Error reading response:`, textError);
    throw new ApiError(`Failed to read response: ${textError.message}`, response.status);
  }
  
  if (!response.ok) {
    let errorMessage = `HTTP ${response.status}`;
    let errorDetails = null;
    
    try {
      errorDetails = JSON.parse(responseText);
      errorMessage = errorDetails.error || errorDetails.message || errorMessage;
      console.error(`❌ ${context} - Error Details:`, errorDetails);
    } catch (parseError) {
      console.error(`❌ ${context} - Raw error response:`, responseText);
      errorMessage = responseText || errorMessage;
    }
    
    throw new ApiError(errorMessage, response.status, errorDetails);
  }
  
  try {
    const jsonData = JSON.parse(responseText);
    console.log(`✅ ${context} - Success:`, Object.keys(jsonData));
    return jsonData;
  } catch (parseError) {
    console.log(`ℹ️ ${context} - Non-JSON response, returning as text`);
    return { success: true, data: responseText };
  }
};

// Retry mechanism for failed requests
const apiRequest = async (url, options = {}, retries = 3, context = 'Request') => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`🚀 Attempt ${attempt}/${retries} - ${context}: ${url}`);
      const response = await fetch(url, {
        timeout: 15000, // 15 second timeout
        ...options
      });
      return await handleApiResponse(response, context);
    } catch (error) {
      console.error(`❌ Attempt ${attempt}/${retries} failed:`, error.message);
      
      if (attempt === retries) {
        throw error;
      }
      
      // Wait before retry (exponential backoff)
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
      console.log(`⏱️ Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
};

/**
 * Enhanced Business Analytics API
 * Gets comprehensive analytics data with caching and auto-refresh
 */
export const getBusinessAnalytics = async (timeframe = 'month', metrics = 'all', enableCache = true) => {
  try {
    console.log('📊 Loading enhanced business analytics...', { timeframe, metrics });
    const headers = await getEnhancedHeaders();
    
    const queryParams = new URLSearchParams();
    queryParams.append('timeframe', timeframe);
    queryParams.append('metrics', metrics);
    
    const url = `${API_BASE_URL}/business-analytics?${queryParams.toString()}`;
    const response = await apiRequest(url, {
      method: 'GET',
      headers,
    }, 3, 'Enhanced Business Analytics');
    
    // Cache the response for offline access
    if (enableCache) {
      try {
        await AsyncStorage.setItem('cached_analytics', JSON.stringify({
          data: response,
          timeframe,
          metrics,
          timestamp: Date.now()
        }));
      } catch (cacheError) {
        console.warn('⚠️ Failed to cache analytics data:', cacheError);
      }
    }
    
    return response;
  } catch (error) {
    console.error('❌ Enhanced analytics error:', error);
    
    // Try to return cached data
    if (enableCache) {
      try {
        const cached = await AsyncStorage.getItem('cached_analytics');
        if (cached) {
          const { data, timestamp } = JSON.parse(cached);
          const isStale = Date.now() - timestamp > 300000; // 5 minutes
          
          if (!isStale) {
            console.log('📱 Returning cached analytics data');
            return { ...data, fromCache: true };
          }
        }
      } catch (cacheError) {
        console.warn('⚠️ Failed to load cached analytics:', cacheError);
      }
    }
    
    throw error;
  }
};

/**
 * Enhanced Bulk Inventory Operations with Progress Tracking
 */
export const bulkInventoryOperation = async (action, items, onProgress = null) => {
  try {
    console.log('🔄 Starting bulk inventory operation:', { action, itemCount: items.length });
    const headers = await getEnhancedHeaders();
    
    // Validate input
    if (!action || !Array.isArray(items) || items.length === 0) {
      throw new ApiError('Invalid bulk operation parameters');
    }
    
    // For large operations, break into chunks
    const CHUNK_SIZE = 10;
    const chunks = [];
    for (let i = 0; i < items.length; i += CHUNK_SIZE) {
      chunks.push(items.slice(i, i + CHUNK_SIZE));
    }
    
    let allResults = [];
    let allErrors = [];
    
    // Process chunks with progress reporting
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      
      if (onProgress) {
        onProgress({
          processed: i * CHUNK_SIZE,
          total: items.length,
          percentage: Math.round((i / chunks.length) * 100),
          currentChunk: i + 1,
          totalChunks: chunks.length
        });
      }
      
      const url = `${API_BASE_URL}/business-inventory-bulk`;
      const response = await apiRequest(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ action, items: chunk }),
      }, 3, `Bulk Operation Chunk ${i + 1}`);
      
      if (response.success) {
        allResults = allResults.concat(response.results || []);
        allErrors = allErrors.concat(response.errors || []);
      }
    }
    
    // Final progress update
    if (onProgress) {
      onProgress({
        processed: items.length,
        total: items.length,
        percentage: 100,
        currentChunk: chunks.length,
        totalChunks: chunks.length,
        completed: true
      });
    }
    
    console.log('✅ Bulk operation completed successfully');
    return {
      success: true,
      action,
      processed: allResults.length,
      errors: allErrors.length,
      results: allResults,
      errors: allErrors
    };
  } catch (error) {
    console.error('❌ Bulk operation error:', error);
    throw error;
  }
};

/**
 * Enhanced Business Reports with Export Options
 */
export const generateBusinessReport = async (type = 'summary', startDate = null, endDate = null, format = 'json') => {
  try {
    console.log('📊 Generating enhanced business report:', { type, startDate, endDate, format });
    const headers = await getEnhancedHeaders();
    
    const queryParams = new URLSearchParams();
    queryParams.append('type', type);
    if (startDate) queryParams.append('startDate', startDate);
    if (endDate) queryParams.append('endDate', endDate);
    if (format) queryParams.append('format', format);
    
    const url = `${API_BASE_URL}/business-reports?${queryParams.toString()}`;
    const response = await apiRequest(url, {
      method: 'GET',
      headers,
    }, 3, 'Enhanced Business Report');
    
    // Cache recent reports
    try {
      const reportKey = `cached_report_${type}_${Date.now()}`;
      await AsyncStorage.setItem(reportKey, JSON.stringify({
        report: response,
        type,
        generatedAt: new Date().toISOString()
      }));
      
      // Clean up old cached reports (keep only last 5)
      const allKeys = await AsyncStorage.getAllKeys();
      const reportKeys = allKeys.filter(key => key.startsWith('cached_report_')).sort();
      if (reportKeys.length > 5) {
        const keysToRemove = reportKeys.slice(0, reportKeys.length - 5);
        await AsyncStorage.multiRemove(keysToRemove);
      }
    } catch (cacheError) {
      console.warn('⚠️ Failed to cache report:', cacheError);
    }
    
    console.log('✅ Report generated successfully');
    return response;
  } catch (error) {
    console.error('❌ Report generation error:', error);
    throw error;
  }
};

/**
 * Real-time Analytics Stream (Auto-refresh)
 */
export const createAnalyticsStream = (timeframe, onUpdate, onError, refreshInterval = 30000) => {
  let intervalId = null;
  let isActive = true;
  
  const fetchAndUpdate = async () => {
    if (!isActive) return;
    
    try {
      const data = await getBusinessAnalytics(timeframe, 'all', false);
      if (isActive && onUpdate) {
        onUpdate(data);
      }
    } catch (error) {
      if (isActive && onError) {
        onError(error);
      }
    }
  };
  
  // Initial fetch
  fetchAndUpdate();
  
  // Set up periodic refresh
  intervalId = setInterval(fetchAndUpdate, refreshInterval);
  
  // Return cleanup function
  return () => {
    isActive = false;
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
  };
};

/**
 * Get Analytics Summary for Dashboard Widgets
 */
export const getAnalyticsSummary = async (businessId) => {
  try {
    console.log('📈 Getting analytics summary for dashboard...');
    
    // Get quick summary data
    const summaryData = await getBusinessAnalytics('month', 'all', true);
    
    // Transform for dashboard widgets
    const widgets = {
      totalRevenue: {
        value: summaryData.data?.sales?.totalRevenue || 0,
        change: calculateGrowth(summaryData.data?.sales?.previousRevenue, summaryData.data?.sales?.totalRevenue),
        trend: 'up'
      },
      totalOrders: {
        value: summaryData.data?.sales?.totalOrders || 0,
        change: calculateGrowth(summaryData.data?.sales?.previousOrders, summaryData.data?.sales?.totalOrders),
        trend: 'up'
      },
      averageOrderValue: {
        value: summaryData.data?.sales?.averageOrderValue || 0,
        change: calculateGrowth(summaryData.data?.sales?.previousAOV, summaryData.data?.sales?.averageOrderValue),
        trend: 'neutral'
      },
      lowStockItems: {
        value: summaryData.data?.inventory?.lowStockItems || 0,
        change: 0,
        trend: summaryData.data?.inventory?.lowStockItems > 0 ? 'down' : 'neutral'
      }
    };
    
    return {
      success: true,
      widgets,
      lastUpdated: new Date().toISOString(),
      fromCache: summaryData.fromCache || false
    };
  } catch (error) {
    console.error('❌ Analytics summary error:', error);
    throw error;
  }
};

/**
 * Trigger Auto-Refresh After Actions
 */
export const triggerAutoRefresh = async (eventType, data = {}) => {
  try {
    console.log('🔄 Triggering auto-refresh after:', eventType);
    
    // Clear relevant caches
    const cachesToClear = [];
    
    switch (eventType) {
      case 'inventory_updated':
      case 'product_added':
      case 'product_deleted':
        cachesToClear.push('cached_dashboard', 'cached_analytics');
        break;
      case 'order_created':
      case 'order_updated':
        cachesToClear.push('cached_dashboard', 'cached_analytics');
        break;
      case 'settings_updated':
        cachesToClear.push('cached_dashboard');
        break;
      default:
        cachesToClear.push('cached_dashboard');
    }
    
    // Clear caches
    await AsyncStorage.multiRemove(cachesToClear);
    
    // Trigger immediate refresh
    const refreshData = await getBusinessAnalytics('month', 'all', true);
    
    console.log('✅ Auto-refresh completed');
    return refreshData;
  } catch (error) {
    console.error('❌ Auto-refresh error:', error);
    // Don't throw error for auto-refresh failures
    return null;
  }
};

// Helper function to calculate growth percentage
const calculateGrowth = (previous, current) => {
  if (!previous || previous === 0) return 0;
  return ((current - previous) / previous) * 100;
};

/**
 * Connection Health Check
 */
export const checkAnalyticsApiHealth = async () => {
  try {
    console.log('🏥 Checking analytics API health...');
    const headers = await getEnhancedHeaders();
    
    const url = `${API_BASE_URL}/business-analytics?timeframe=week&metrics=sales`;
    const response = await apiRequest(url, {
      method: 'GET',
      headers,
    }, 1, 'Health Check');
    
    return { healthy: true, ...response };
  } catch (error) {
    console.error('❌ Analytics API health check failed:', error);
    return { healthy: false, error: error.message };
  }
};

// Export all functions
export default {
  getBusinessAnalytics,
  bulkInventoryOperation,
  generateBusinessReport,
  createAnalyticsStream,
  getAnalyticsSummary,
  triggerAutoRefresh,
  checkAnalyticsApiHealth
};