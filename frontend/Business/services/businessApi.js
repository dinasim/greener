// Business/services/businessApi.js - FIXED VERSION
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
    
    console.log('🔗 API Headers:', { ...headers, 'Authorization': authToken ? '[REDACTED]' : 'None' });
    return headers;
  } catch (error) {
    console.error('❌ Error getting headers:', error);
    return { 'Content-Type': 'application/json' };
  }
};

// Enhanced response handler with detailed error reporting
const handleApiResponse = async (response, context = 'API Request') => {
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
 * Enhanced Business Dashboard API
 * Gets comprehensive dashboard data with caching
 */
export const getBusinessDashboard = async () => {
  try {
    console.log('📊 Loading enhanced business dashboard...');
    const headers = await getEnhancedHeaders();
    
    const url = `${API_BASE_URL}/business/dashboard`;
    const response = await apiRequest(url, {
      method: 'GET',
      headers,
    }, 3, 'Business Dashboard');
    
    // Cache the response for offline access
    try {
      await AsyncStorage.setItem('cached_dashboard', JSON.stringify({
        data: response,
        timestamp: Date.now()
      }));
    } catch (cacheError) {
      console.warn('⚠️ Failed to cache dashboard data:', cacheError);
    }
    
    return response;
  } catch (error) {
    console.error('❌ Enhanced dashboard error:', error);
    
    // Try to return cached data
    try {
      const cached = await AsyncStorage.getItem('cached_dashboard');
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        const isStale = Date.now() - timestamp > 300000; // 5 minutes
        
        if (!isStale) {
          console.log('📱 Returning cached dashboard data');
          return { ...data, fromCache: true };
        }
      }
    } catch (cacheError) {
      console.warn('⚠️ Failed to load cached data:', cacheError);
    }
    
    throw error;
  }
};

/**
 * FIXED: Enhanced Inventory Management - Using correct route
 */
export const getBusinessInventory = async (businessId, filters = {}) => {
  try {
    console.log('📦 Loading enhanced inventory for business:', businessId);
    const headers = await getEnhancedHeaders();
    
    // FIXED: Use the correct route pattern from backend
    const url = `${API_BASE_URL}/business/inventory/${encodeURIComponent(businessId)}`;
    console.log('📦 Calling inventory URL:', url);
    
    const response = await apiRequest(url, {
      method: 'GET',
      headers,
    }, 3, 'Enhanced Inventory');
    
    // Process and enhance the inventory data
    const inventory = response.inventory || response.items || response.data || [];
    
    return {
      inventory: inventory.map(item => ({
        ...item,
        isLowStock: (item.quantity || 0) <= (item.minThreshold || 5),
        finalPrice: item.finalPrice || (item.price - (item.price * (item.discount || 0) / 100)),
        lastUpdated: item.updatedAt || item.dateAdded || new Date().toISOString()
      })),
      summary: response.summary || {
        totalItems: inventory.length,
        activeItems: inventory.filter(i => i.status === 'active').length,
        lowStockItems: inventory.filter(i => (i.quantity || 0) <= (i.minThreshold || 5)).length,
        totalValue: inventory.reduce((sum, i) => sum + ((i.price || 0) * (i.quantity || 0)), 0)
      },
      filters: response.filters || {},
      lastRefreshed: new Date().toISOString()
    };
  } catch (error) {
    console.error('❌ Enhanced inventory error:', error);
    
    // Return empty data structure on error instead of throwing
    return {
      inventory: [],
      summary: {
        totalItems: 0,
        activeItems: 0,
        lowStockItems: 0,
        totalValue: 0
      },
      filters: {},
      lastRefreshed: new Date().toISOString(),
      error: error.message
    };
  }
};

/**
 * FIXED: Enhanced Plant Search with correct route
 */
export const searchPlants = async (query, options = {}) => {
  if (!query || query.length < 2) {
    throw new ApiError('Search query must be at least 2 characters');
  }
  
  try {
    console.log('🔍 Enhanced plant search:', query, options);
    const headers = await getEnhancedHeaders();
    
    // FIXED: Use the correct route pattern
    const queryParams = new URLSearchParams();
    queryParams.append('q', query);
    if (options.limit) queryParams.append('limit', options.limit);
    if (options.category) queryParams.append('category', options.category);
    if (options.difficulty) queryParams.append('difficulty', options.difficulty);
    
    const url = `${API_BASE_URL}/business/plants/search?${queryParams.toString()}`;
    const response = await apiRequest(url, {
      method: 'GET',
      headers,
    }, 3, 'Enhanced Plant Search');
    
    // Save search to history
    try {
      const searchHistory = await AsyncStorage.getItem('plantSearchHistory');
      const history = searchHistory ? JSON.parse(searchHistory) : [];
      const newHistory = [query, ...history.filter(h => h !== query)].slice(0, 10);
      await AsyncStorage.setItem('plantSearchHistory', JSON.stringify(newHistory));
    } catch (historyError) {
      console.warn('⚠️ Failed to save search history:', historyError);
    }
    
    const plants = response.plants || response.data || [];
    
    return {
      plants: plants.map(plant => ({
        ...plant,
        searchScore: plant.searchScore || 1,
        popularityScore: plant.popularityScore || 0,
        careComplexity: plant.difficulty ? (plant.difficulty > 7 ? 'Advanced' : plant.difficulty > 4 ? 'Intermediate' : 'Beginner') : 'Unknown'
      })),
      suggestions: response.suggestions || [],
      totalCount: response.totalCount || plants.length,
      searchTime: response.searchTime || Date.now()
    };
  } catch (error) {
    console.error('❌ Enhanced plant search error:', error);
    throw error;
  }
};

/**
 * FIXED: Enhanced Inventory Item Creation with correct route
 */
export const createInventoryItem = async (inventoryData) => {
  try {
    console.log('➕ Creating enhanced inventory item:', inventoryData);
    
    // Client-side validation
    const errors = [];
    if (!inventoryData.plantData?.common_name) errors.push('Plant name is required');
    if (!inventoryData.quantity || inventoryData.quantity <= 0) errors.push('Valid quantity is required');
    if (!inventoryData.price || inventoryData.price <= 0) errors.push('Valid price is required');
    
    if (errors.length > 0) {
      throw new ApiError(`Validation failed: ${errors.join(', ')}`);
    }
    
    const headers = await getEnhancedHeaders();
    
    // Enhance the data before sending
    const enhancedData = {
      ...inventoryData,
      dateAdded: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      status: inventoryData.status || 'active',
      minThreshold: inventoryData.minThreshold || 5,
      discount: inventoryData.discount || 0,
      finalPrice: inventoryData.price - (inventoryData.price * (inventoryData.discount || 0) / 100)
    };
    
    // FIXED: Use correct route pattern
    const url = `${API_BASE_URL}/business/inventory/create`;
    const response = await apiRequest(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(enhancedData),
    }, 3, 'Create Enhanced Inventory');
    
    console.log('✅ Inventory item created successfully');
    return response;
  } catch (error) {
    console.error('❌ Enhanced inventory creation error:', error);
    throw error;
  }
};

/**
 * FIXED: Update inventory item with correct route
 */
export const updateInventoryItem = async (inventoryId, updateData) => {
  try {
    console.log('🔄 Updating inventory item:', inventoryId);
    const headers = await getEnhancedHeaders();
    
    const enhancedUpdateData = {
      ...updateData,
      lastUpdated: new Date().toISOString(),
      finalPrice: updateData.price ? 
        updateData.price - (updateData.price * (updateData.discount || 0) / 100) : 
        undefined
    };
    
    // FIXED: Use correct route pattern with inventoryId in path
    const url = `${API_BASE_URL}/business/inventory/${encodeURIComponent(inventoryId)}`;
    const response = await apiRequest(url, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(enhancedUpdateData),
    }, 3, 'Update Inventory Item');
    
    console.log('✅ Inventory item updated successfully');
    return response;
  } catch (error) {
    console.error('❌ Inventory update error:', error);
    throw error;
  }
};

/**
 * FIXED: Enhanced Orders Management with correct route
 */
export const getBusinessOrders = async (businessId, options = {}) => {
  try {
    console.log('📋 Loading enhanced orders...', options);
    const headers = await getEnhancedHeaders();
    
    // FIXED: Use correct route pattern
    const queryParams = new URLSearchParams();
    if (businessId) queryParams.append('businessId', businessId);
    if (options.status) queryParams.append('status', options.status);
    if (options.limit) queryParams.append('limit', options.limit);
    if (options.offset) queryParams.append('offset', options.offset);
    if (options.startDate) queryParams.append('startDate', options.startDate);
    if (options.endDate) queryParams.append('endDate', options.endDate);
    
    const url = `${API_BASE_URL}/business/orders?${queryParams.toString()}`;
    const response = await apiRequest(url, {
      method: 'GET',
      headers,
    }, 3, 'Enhanced Orders');
    
    const orders = response.orders || [];
    
    // Calculate enhanced metrics
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    const enhancedSummary = {
      totalOrders: orders.length,
      pendingCount: orders.filter(o => o.status === 'pending').length,
      readyCount: orders.filter(o => o.status === 'ready').length,
      completedCount: orders.filter(o => o.status === 'completed').length,
      todayOrders: orders.filter(o => new Date(o.orderDate) >= todayStart).length,
      todayRevenue: orders
        .filter(o => new Date(o.orderDate) >= todayStart && o.status === 'completed')
        .reduce((sum, o) => sum + (o.total || 0), 0),
      avgOrderValue: orders.length > 0 ? orders.reduce((sum, o) => sum + (o.total || 0), 0) / orders.length : 0,
      statusCounts: orders.reduce((counts, order) => {
        counts[order.status] = (counts[order.status] || 0) + 1;
        return counts;
      }, {}),
      communicationInfo: {
        messagesEnabled: true,
        emailEnabled: true,
        smsEnabled: true
      }
    };
    
    return {
      success: true,
      orders: orders.map(order => ({
        ...order,
        isUrgent: order.status === 'pending' && 
          (Date.now() - new Date(order.orderDate)) > 24 * 60 * 60 * 1000, // 24+ hours old
        timeAgo: getTimeAgo(order.orderDate),
        totalQuantity: order.items?.reduce((sum, item) => sum + (item.quantity || 0), 0) || 0
      })),
      summary: enhancedSummary,
      pagination: response.pagination || {},
      filters: response.filters || {}
    };
  } catch (error) {
    console.error('❌ Enhanced orders error:', error);
    
    // Return empty data structure on error
    return {
      success: false,
      orders: [],
      summary: {
        totalOrders: 0,
        pendingCount: 0,
        readyCount: 0,
        completedCount: 0,
        todayOrders: 0,
        todayRevenue: 0,
        avgOrderValue: 0,
        statusCounts: {},
        communicationInfo: { messagesEnabled: true, emailEnabled: true, smsEnabled: true }
      },
      error: error.message
    };
  }
};

/**
 * FIXED: Enhanced Order Creation with correct route
 */
export const createOrder = async (orderData) => {
  try {
    console.log('🛒 Creating enhanced order:', orderData);
    
    // Enhanced validation
    const errors = [];
    if (!orderData.businessId) errors.push('Business ID is required');
    if (!orderData.customerEmail) errors.push('Customer email is required');
    if (!orderData.customerName) errors.push('Customer name is required');
    if (!orderData.items || orderData.items.length === 0) errors.push('Order must contain items');
    
    if (errors.length > 0) {
      throw new ApiError(`Validation failed: ${errors.join(', ')}`);
    }
    
    const headers = await getEnhancedHeaders();
    
    // Generate confirmation number
    const confirmationNumber = 'ORD-' + Date.now().toString().slice(-8) + 
      Math.random().toString(36).substring(2, 5).toUpperCase();
    
    const enhancedOrder = {
      ...orderData,
      confirmationNumber,
      orderDate: new Date().toISOString(),
      status: 'pending',
      fulfillmentType: 'pickup',
      communication: {
        preferredMethod: orderData.communicationPreference || 'messages',
        messagesEnabled: true,
        emailEnabled: true,
        lastContactDate: null
      }
    };
    
    // FIXED: Use correct route pattern
    const url = `${API_BASE_URL}/business/orders/create`;
    const response = await apiRequest(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(enhancedOrder),
    }, 3, 'Create Enhanced Order');
    
    console.log('✅ Order created successfully:', response.order?.confirmationNumber);
    return response;
  } catch (error) {
    console.error('❌ Enhanced order creation error:', error);
    throw error;
  }
};

/**
 * FIXED: Real-time order status updates with correct route
 */
export const updateOrderStatus = async (orderId, newStatus, notes = '') => {
  try {
    console.log('🔄 Updating order status:', orderId, newStatus);
    const headers = await getEnhancedHeaders();
    
    const updateData = {
      orderId,
      status: newStatus,
      notes,
      updatedAt: new Date().toISOString(),
      staffAssigned: headers['X-User-Email'] || 'system'
    };
    
    // FIXED: Use correct route pattern
    const url = `${API_BASE_URL}/business/orders`;
    const response = await apiRequest(url, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(updateData),
    }, 3, 'Update Order Status');
    
    console.log('✅ Order status updated successfully');
    return response;
  } catch (error) {
    console.error('❌ Order status update error:', error);
    throw error;
  }
};

/**
 * Get business customers
 */
export const getBusinessCustomers = async (businessId) => {
  try {
    console.log('👥 Getting business customers for:', businessId);
    const headers = await getEnhancedHeaders();
    
    const url = `${API_BASE_URL}/business/customers`;
    const response = await apiRequest(url, {
      method: 'GET',
      headers,
    }, 3, 'Get Business Customers');
    
    const customers = Array.isArray(response) ? response : (response.customers || []);
    
    console.log(`Business customers loaded: ${customers.length} customers`);
    return customers;
  } catch (error) {
    console.error('❌ Get business customers error:', error);
    
    // Return empty array instead of throwing for customer listing
    if (error.message.includes('404') || error.message.includes('not found')) {
      console.log('No customers found, returning empty array');
      return [];
    }
    
    throw error;
  }
};

/**
 * FIXED: Create or update business profile with correct route
 */
export const createBusinessProfile = async (businessData) => {
  try {
    console.log('👤 Creating/updating business profile');
    const headers = await getEnhancedHeaders();
    
    const enhancedBusinessData = {
      ...businessData,
      lastUpdated: new Date().toISOString(),
      id: businessData.email || headers['X-User-Email']
    };
    
    const url = `${API_BASE_URL}/business/profile`;
    const response = await apiRequest(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(enhancedBusinessData),
    }, 3, 'Create Business Profile');
    
    console.log('✅ Business profile created/updated successfully');
    return response;
  } catch (error) {
    console.error('❌ Business profile error:', error);
    throw error;
  }
};

/**
 * FIXED: Get business profile with correct route
 */
export const getBusinessProfile = async (businessId) => {
  try {
    console.log('👤 Getting business profile for:', businessId);
    const headers = await getEnhancedHeaders();
    
    const url = `${API_BASE_URL}/business/profile?businessId=${encodeURIComponent(businessId)}`;
    const response = await apiRequest(url, {
      method: 'GET',
      headers,
    }, 3, 'Get Business Profile');
    
    return response;
  } catch (error) {
    console.error('❌ Get business profile error:', error);
    throw error;
  }
};

// Utility Functions
const getTimeAgo = (dateString) => {
  const now = new Date();
  const date = new Date(dateString);
  const diffMs = now - date;
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
};

/**
 * Connection Health Check
 */
export const checkApiHealth = async () => {
  try {
    console.log('🏥 Checking API health...');
    const headers = await getEnhancedHeaders();
    
    const url = `${API_BASE_URL}/health`;
    const response = await apiRequest(url, {
      method: 'GET',
      headers,
    }, 1, 'Health Check');
    
    return { healthy: true, ...response };
  } catch (error) {
    console.error('❌ API health check failed:', error);
    return { healthy: false, error: error.message };
  }
};

/**
 * Delete inventory item - NEW
 */
export const deleteInventoryItem = async (inventoryId) => {
  try {
    console.log('🗑️ Deleting inventory item:', inventoryId);
    const headers = await getEnhancedHeaders();
    
    const url = `${API_BASE_URL}/business/inventory/${encodeURIComponent(inventoryId)}`;
    const response = await apiRequest(url, {
      method: 'DELETE',
      headers,
    }, 3, 'Delete Inventory Item');
    
    console.log('✅ Inventory item deleted successfully');
    return response;
  } catch (error) {
    console.error('❌ Inventory delete error:', error);
    throw error;
  }
};

/**
 * Get low stock items
 */
export const getLowStockItems = async (businessId) => {
  try {
    console.log('⚠️ Getting low stock items for:', businessId);
    const inventoryResponse = await getBusinessInventory(businessId);
    
    const lowStockItems = inventoryResponse.inventory.filter(item => 
      item.isLowStock && item.status === 'active'
    );
    
    return lowStockItems;
  } catch (error) {
    console.error('❌ Low stock items error:', error);
    return [];
  }
};

/**
 * Test API connection
 */
export const testConnection = async () => {
  try {
    return await checkApiHealth();
  } catch (error) {
    console.error('❌ Connection test failed:', error);
    return { healthy: false, error: error.message };
  }
};

// Export all API functions
export default {
  getBusinessDashboard,
  getBusinessInventory,
  searchPlants,
  createInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
  getLowStockItems,
  createBusinessProfile,
  getBusinessProfile,
  getBusinessOrders,
  createOrder,
  updateOrderStatus,
  getBusinessCustomers,
  checkApiHealth,
  testConnection
};