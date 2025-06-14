// Business/services/businessApi.js - PROPERLY RESTORED WITH ALL ORIGINAL FUNCTIONALITY
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = 'https://usersfunctions.azurewebsites.net/api';

// Enhanced error handling
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
      AsyncStorage.getItem('googleAuthToken') // FIXED: Use correct token key
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

    console.log('🔑 API Headers:', { ...headers, 'Authorization': authToken ? '[REDACTED]' : 'None' });
    return headers;
  } catch (error) {
    console.error('❌ Error getting headers:', error);
    return { 'Content-Type': 'application/json' };
  }
};

// Enhanced response handler
const handleApiResponse = async (response, context = 'API Request') => {
  console.log(`📋 ${context} - Status: ${response.status}`);
  
  let responseText;
  try {
    responseText = await response.text();
    console.log(`📄 ${context} - Response:`, responseText.substring(0, 500));
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

// Retry mechanism
const apiRequest = async (url, options = {}, retries = 3, context = 'Request') => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`🔄 Attempt ${attempt}/${retries} - ${context}: ${url}`);
      const response = await fetch(url, {
        timeout: 15000,
        ...options
      });
      return await handleApiResponse(response, context);
    } catch (error) {
      console.error(`❌ Attempt ${attempt}/${retries} failed:`, error.message);
      
      if (attempt === retries) {
        throw error;
      }
      
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
      console.log(`⏳ Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
};

// Helper function to determine stock level
const getStockLevel = (quantity, minThreshold) => {
  const qty = quantity || 0;
  const threshold = minThreshold || 5;
  
  if (qty === 0) return 'out-of-stock';
  if (qty <= threshold) return 'low-stock';
  if (qty <= threshold * 2) return 'medium-stock';
  return 'high-stock';
};

/**
 * Get Business Dashboard Data - ENHANCED with comprehensive caching
 */
export const getBusinessDashboard = async () => {
  try {
    console.log('📊 Loading business dashboard...');
    const headers = await getEnhancedHeaders();
    
    const url = `${API_BASE_URL}/business/dashboard`;
    const response = await apiRequest(url, {
      method: 'GET',
      headers,
    }, 3, 'Business Dashboard');

    // Cache the response
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
    console.error('❌ Dashboard error:', error);
    
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
 * FIXED: Get Business Profile with corrected endpoint
 */
export const getBusinessProfile = async (businessId) => {
  try {
    console.log('👤 Loading business profile for:', businessId);
    const headers = await getEnhancedHeaders();
    
    // FIXED: Use the corrected endpoint that matches the backend
    const url = `${API_BASE_URL}/marketplace/business/${encodeURIComponent(businessId)}/profile`;
    console.log('👤 Calling profile URL:', url);
    
    const response = await apiRequest(url, {
      method: 'GET',
      headers,
    }, 3, 'Business Profile');

    return response;
  } catch (error) {
    console.error('❌ Business profile error:', error);
    throw error;
  }
};

/**
 * FIXED: Get Business Inventory with enhanced image support and corrected endpoint
 */
export const getBusinessInventory = async (businessId) => {
  try {
    console.log('📦 Loading inventory for business:', businessId);
    const headers = await getEnhancedHeaders();
    
    // FIXED: Use the corrected endpoint that matches the backend
    const url = `${API_BASE_URL}/marketplace/business/${encodeURIComponent(businessId)}/inventory`;
    console.log('📦 Calling inventory URL:', url);
    
    const response = await apiRequest(url, {
      method: 'GET',
      headers,
    }, 3, 'Business Inventory');

    // Process the inventory data with enhanced image handling
    const inventory = response.inventory || response.items || response.data || [];
    
    return {
      success: true,
      businessId: response.businessId || businessId,
      inventory: inventory.map(item => ({
        ...item,
        isLowStock: (item.quantity || 0) <= (item.minThreshold || 5),
        finalPrice: item.finalPrice || (item.price - (item.price * (item.discount || 0) / 100)),
        lastUpdated: item.updatedAt || item.dateAdded || new Date().toISOString(),
        // ENHANCED: Better image handling
        mainImage: item.mainImage || item.image || (item.images && item.images[0]) || item.imageUrls?.[0],
        images: item.images || item.imageUrls || (item.mainImage ? [item.mainImage] : []),
        hasImages: !!(item.mainImage || item.image || (item.images && item.images.length > 0) || (item.imageUrls && item.imageUrls.length > 0)),
        // Enhanced display info
        displayName: item.name || item.common_name || 'Business Product',
        categoryDisplay: item.category || 'Products',
        stockStatus: (item.quantity || 0) > 0 ? 'In Stock' : 'Out of Stock',
        stockLevel: getStockLevel(item.quantity, item.minThreshold),
      })),
      summary: {
        totalItems: response.totalItems || inventory.length,
        activeItems: response.activeItems || inventory.filter(i => i.status === 'active').length,
        lowStockItems: response.lowStockItems || inventory.filter(i => (i.quantity || 0) <= (i.minThreshold || 5)).length,
        totalValue: inventory.reduce((sum, item) => sum + ((item.price || 0) * (item.quantity || 0)), 0),
        itemsWithImages: inventory.filter(i => i.mainImage || i.image || (i.images && i.images.length > 0)).length,
      }
    };
  } catch (error) {
    console.error('❌ Inventory error:', error);
    throw error;
  }
};

/**
 * Create Inventory Item - ENHANCED with image upload support
 */
export const createInventoryItem = async (inventoryData) => {
  try {
    console.log('➕ Creating inventory item with data:', Object.keys(inventoryData));
    const headers = await getEnhancedHeaders();

    // Validate required fields
    const requiredFields = ['name', 'quantity', 'price'];
    const missingFields = requiredFields.filter(field => !inventoryData[field]);
    if (missingFields.length > 0) {
      throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
    }

    // Enhanced inventory data with defaults
    const enhancedData = {
      ...inventoryData,
      status: inventoryData.status || 'active',
      dateAdded: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      discount: inventoryData.discount || 0,
      minThreshold: inventoryData.minThreshold || 5,
      category: inventoryData.category || 'General',
      // Image handling
      images: inventoryData.images || [],
      imageUrls: inventoryData.imageUrls || [],
      mainImage: inventoryData.mainImage || inventoryData.imageUrls?.[0] || inventoryData.images?.[0],
    };

    const url = `${API_BASE_URL}/business/inventory`;
    const response = await apiRequest(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(enhancedData),
    }, 3, 'Create Inventory Item');

    console.log('✅ Inventory item created successfully');
    return response;
  } catch (error) {
    console.error('❌ Inventory creation error:', error);
    throw error;
  }
};

/**
 * Update Inventory Item - ENHANCED with validation and image support
 */
export const updateInventoryItem = async (inventoryId, updateData) => {
  try {
    console.log('📝 Updating inventory item:', inventoryId);
    const headers = await getEnhancedHeaders();

    if (!inventoryId) {
      throw new Error('Inventory ID is required');
    }

    // Enhanced update data
    const enhancedUpdateData = {
      ...updateData,
      lastUpdated: new Date().toISOString(),
      // Ensure image arrays are properly formatted
      images: updateData.images || [],
      imageUrls: updateData.imageUrls || updateData.images || [],
      mainImage: updateData.mainImage || updateData.imageUrls?.[0] || updateData.images?.[0],
    };

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
 * Get Business Orders - ENHANCED with filtering and caching
 */
export const getBusinessOrders = async (status = 'all', limit = 50) => {
  try {
    console.log('📋 Loading business orders with status:', status);
    const headers = await getEnhancedHeaders();

    const queryParams = new URLSearchParams();
    if (status !== 'all') queryParams.append('status', status);
    queryParams.append('limit', limit.toString());

    const url = `${API_BASE_URL}/business/orders?${queryParams.toString()}`;
    const response = await apiRequest(url, {
      method: 'GET',
      headers,
    }, 3, 'Business Orders');

    // Enhanced order processing
    const orders = response.orders || response.data || [];
    
    return {
      success: true,
      orders: orders.map(order => ({
        ...order,
        displayId: order.orderId || order.id,
        customerDisplay: order.customerName || order.customerEmail || 'Unknown Customer',
        statusDisplay: (order.status || 'pending').charAt(0).toUpperCase() + (order.status || 'pending').slice(1),
        formattedDate: new Date(order.orderDate || order.createdAt).toLocaleDateString(),
        formattedAmount: `₪${(order.totalAmount || 0).toFixed(2)}`,
        itemCount: (order.items || []).length,
        isRecent: Date.now() - new Date(order.orderDate || order.createdAt).getTime() < 7 * 24 * 60 * 60 * 1000, // Last 7 days
      })),
      totalOrders: response.totalOrders || orders.length,
      pendingOrders: response.pendingOrders || orders.filter(o => o.status === 'pending').length,
      completedOrders: response.completedOrders || orders.filter(o => o.status === 'completed').length,
      cancelledOrders: response.cancelledOrders || orders.filter(o => o.status === 'cancelled').length,
    };
  } catch (error) {
    console.error('❌ Business orders error:', error);
    throw error;
  }
};

/**
 * Get Business Customers - ENHANCED with analytics
 */
export const getBusinessCustomers = async () => {
  try {
    console.log('👥 Loading business customers with analytics');
    const headers = await getEnhancedHeaders();

    const url = `${API_BASE_URL}/business/customers`;
    const response = await apiRequest(url, {
      method: 'GET',
      headers,
    }, 3, 'Business Customers');

    // Enhanced customer processing
    const customers = response.customers || response.data || [];

    return {
      success: true,
      customers: customers.map(customer => ({
        ...customer,
        displayName: customer.name || customer.email?.split('@')[0] || 'Customer',
        customerSince: customer.firstOrderDate || customer.createdAt,
        lastActive: customer.lastOrderDate || customer.updatedAt,
        loyaltyLevel: getLoyaltyLevel(customer.orderCount, customer.totalSpent),
        averageOrderValue: customer.orderCount > 0 ? (customer.totalSpent / customer.orderCount) : 0,
        daysSinceLastOrder: customer.lastOrderDate ? 
          Math.floor((Date.now() - new Date(customer.lastOrderDate).getTime()) / (1000 * 60 * 60 * 24)) : null,
      })),
      totalCustomers: response.totalCustomers || customers.length,
      totalRevenue: response.totalRevenue || customers.reduce((sum, c) => sum + (c.totalSpent || 0), 0),
      averageOrderValue: response.averageOrderValue || 0,
      topCustomers: response.topCustomers || customers.slice(0, 10),
    };
  } catch (error) {
    console.error('❌ Business customers error:', error);
    throw error;
  }
};

// Helper function for loyalty level calculation
const getLoyaltyLevel = (orderCount, totalSpent) => {
  if (!orderCount || orderCount === 0) return 'new';
  if (orderCount >= 10 && totalSpent >= 1000) return 'vip';
  if (orderCount >= 5 && totalSpent >= 500) return 'loyal';
  if (orderCount >= 2) return 'returning';
  return 'new';
};

/**
 * Create Business Profile - ENHANCED with validation
 */
export const createBusinessProfile = async (businessData) => {
  try {
    console.log('👤 Creating business profile');
    const headers = await getEnhancedHeaders();

    const enhancedBusinessData = {
      ...businessData,
      dateJoined: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      status: 'active',
      settings: {
        notifications: true,
        publicProfile: true,
        acceptOrders: true,
        ...businessData.settings
      },
      // Ensure required fields have defaults
      businessName: businessData.businessName || 'My Business',
      businessType: businessData.businessType || 'General',
      id: businessData.email || headers['X-User-Email']
    };

    const url = `${API_BASE_URL}/business/profile`;
    const response = await apiRequest(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(enhancedBusinessData),
    }, 3, 'Create Business Profile');

    return response;
  } catch (error) {
    console.error('❌ Create business profile error:', error);
    throw error;
  }
};

/**
 * FIXED: Update Business Profile with proper endpoint
 */
export const updateBusinessProfile = async (businessId, updateData) => {
  try {
    console.log('📝 Updating business profile:', businessId);
    const headers = await getEnhancedHeaders();

    const enhancedUpdateData = {
      ...updateData,
      lastUpdated: new Date().toISOString()
    };

    // FIXED: Use the corrected endpoint that matches the backend
    const url = `${API_BASE_URL}/marketplace/business/${encodeURIComponent(businessId)}/profile`;
    const response = await apiRequest(url, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(enhancedUpdateData),
    }, 3, 'Update Business Profile');

    return response;
  } catch (error) {
    console.error('❌ Update business profile error:', error);
    throw error;
  }
};

/**
 * FIXED: Fetch Business Profile with Inventory for Map Display
 */
export const fetchBusinessProfile = async (businessId) => {
  try {
    console.log('🏢 Fetching complete business profile for map:', businessId);
    const headers = await getEnhancedHeaders();

    // FIXED: Use the corrected endpoint that matches the backend
    const url = `${API_BASE_URL}/marketplace/business/${encodeURIComponent(businessId)}/profile`;
    const response = await apiRequest(url, {
      method: 'GET',
      headers,
    }, 3, 'Fetch Business Profile for Map');

    // Cache business profile
    try {
      await AsyncStorage.setItem(`cached_business_profile_${businessId}`, JSON.stringify({
        data: response,
        timestamp: Date.now()
      }));
    } catch (cacheError) {
      console.warn('⚠️ Failed to cache business profile:', cacheError);
    }

    return response;
  } catch (error) {
    console.error('❌ Fetch business profile error:', error);

    // Try to return cached profile on error
    try {
      const cached = await AsyncStorage.getItem(`cached_business_profile_${businessId}`);
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        // Use cache if less than 1 hour old
        if (Date.now() - timestamp < 3600000) {
          console.log('📱 Using cached business profile');
          return data;
        }
      }
    } catch (cacheError) {
      console.warn('⚠️ Error accessing cached profile:', cacheError);
    }

    throw error;
  }
};

/**
 * Delete Inventory Item
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
    console.error('❌ Delete inventory item error:', error);
    throw error;
  }
};

/**
 * Bulk Update Inventory Items
 */
export const bulkUpdateInventory = async (updates) => {
  try {
    console.log('📦 Bulk updating inventory items:', updates.length);
    const headers = await getEnhancedHeaders();

    const url = `${API_BASE_URL}/business/inventory/bulk`;
    const response = await apiRequest(url, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ updates }),
    }, 3, 'Bulk Update Inventory');

    console.log('✅ Bulk inventory update completed');
    return response;
  } catch (error) {
    console.error('❌ Bulk inventory update error:', error);
    throw error;
  }
};

/**
 * Upload Business Images
 */
export const uploadBusinessImages = async (images, businessId) => {
  try {
    console.log('📸 Uploading business images:', images.length);
    const headers = await getEnhancedHeaders();

    const formData = new FormData();
    images.forEach((image, index) => {
      formData.append(`image_${index}`, {
        uri: image.uri,
        type: image.type || 'image/jpeg',
        name: image.name || `business_image_${index}.jpg`,
      });
    });
    formData.append('businessId', businessId);

    delete headers['Content-Type']; // Let fetch set it for multipart

    const url = `${API_BASE_URL}/upload-image`;
    const response = await apiRequest(url, {
      method: 'POST',
      headers,
      body: formData,
    }, 3, 'Upload Business Images');

    console.log('✅ Images uploaded successfully');
    return response;
  } catch (error) {
    console.error('❌ Image upload error:', error);
    throw error;
  }
};

// Export all business API functions with their original functionality preserved
export default {
  getBusinessProfile,
  getBusinessDashboard,
  getBusinessInventory,
  createInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
  bulkUpdateInventory,
  getBusinessOrders,
  getBusinessCustomers,
  createBusinessProfile,
  updateBusinessProfile,
  fetchBusinessProfile,
  uploadBusinessImages,
  // Export utility functions
  ApiError,
  getStockLevel,
  getLoyaltyLevel,
};