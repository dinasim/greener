// Business/services/businessApi.js - CONSOLIDATED & CLEANED VERSION
import AsyncStorage from '@react-native-async-storage/async-storage';
import { addBusinessProfileSync, addInventorySync, invalidateMarketplaceCache } from '../../marketplace/services/BusinessMarketplaceSyncBridge';

const API_BASE_URL = 'https://usersfunctions.azurewebsites.net/api';

// AUTO-REFRESH FUNCTIONALITY - Global refresh callbacks
const refreshCallbacks = new Set();

// Register callback for auto-refresh
export const onBusinessRefresh = (callback) => {
  refreshCallbacks.add(callback);
  return () => refreshCallbacks.delete(callback); // Return unsubscribe function
};

// Notify all registered callbacks
const notifyRefresh = (data) => {
  refreshCallbacks.forEach(callback => {
    try {
      callback(data);
    } catch (error) {
      console.error('Error in refresh callback:', error);
    }
  });
};

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
      AsyncStorage.getItem('googleAuthToken')
    ]);

    const headers = {
      'Content-Type': 'application/json',
      'X-API-Version': '1.0',
      'X-Client': 'greener-mobile'
    };

    if (userEmail) {
      headers['X-User-Email'] = userEmail;
      headers['X-Business-ID'] = userEmail; // Use email as business ID
    }
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
      
      if (context.includes('Get Business Profile') && error.message.includes('Business profile not found')) {
        console.log('🚫 Business profile not found - this is expected during signup, not retrying');
        throw error;
      }
      
      if (attempt === retries) {
        throw error;
      }
      
      const baseDelay = context.includes('Get Business Profile') ? 500 : 1000;
      const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), 5000);
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

// Helper function for loyalty level calculation
const getLoyaltyLevel = (orderCount, totalSpent) => {
  if (!orderCount || orderCount === 0) return 'new';
  if (orderCount >= 10 && totalSpent >= 1000) return 'vip';
  if (orderCount >= 5 && totalSpent >= 500) return 'loyal';
  if (orderCount >= 2) return 'returning';
  return 'new';
};

/**
 * Create business profile with sync bridge integration
 */
export const createBusinessProfile = async (businessData) => {
  try {
    console.log('🏢 Creating business profile');
    
    const requiredFields = ['businessName', 'description'];
    const missingFields = requiredFields.filter(field => !businessData[field]);
    
    if (missingFields.length > 0) {
      throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
    }

    const headers = await getEnhancedHeaders();
    const userEmail = await AsyncStorage.getItem('userEmail');
    
    if (!userEmail) {
      throw new Error('User email is required. Please login first.');
    }

    const enhancedBusinessData = {
      id: userEmail,
      email: userEmail,
      businessName: businessData.businessName || 'My Business',
      description: businessData.description || '',
      address: businessData.address || {},
      phone: businessData.phone || businessData.contactPhone || '',
      contactPhone: businessData.contactPhone || businessData.phone || '',
      website: businessData.website || '',
      category: businessData.category || businessData.businessType || 'Plant Nursery',
      businessType: businessData.businessType || businessData.category || 'Plant Nursery',
      logo: businessData.logo || '',
      location: businessData.location || businessData.address || {},
      openingHours: businessData.openingHours || {
        monday: '9:00-18:00',
        tuesday: '9:00-18:00',
        wednesday: '9:00-18:00',
        thursday: '9:00-18:00',
        friday: '9:00-18:00',
        saturday: '10:00-16:00',
        sunday: 'Closed'
      },
      businessHours: businessData.businessHours || [
        { day: 'monday', hours: '9:00-18:00', isOpen: true },
        { day: 'tuesday', hours: '9:00-18:00', isOpen: true },
        { day: 'wednesday', hours: '9:00-18:00', isOpen: true },
        { day: 'thursday', hours: '9:00-18:00', isOpen: true },
        { day: 'friday', hours: '9:00-18:00', isOpen: true },
        { day: 'saturday', hours: '10:00-16:00', isOpen: true },
        { day: 'sunday', hours: '10:00-16:00', isOpen: true }
      ],
      socialMedia: businessData.socialMedia || {
        facebook: '',
        instagram: '',
        twitter: '',
        website: ''
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      type: 'business',
      rating: 0.0,
      reviewCount: 0,
      name: businessData.name || businessData.contactName || 'Business Owner',
      contactEmail: userEmail
    };

    const url = `${API_BASE_URL}/business-profile`;
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(enhancedBusinessData),
      timeout: 15000
    });

    const responseText = await response.text();
    
    if (response.status === 409) {
      // Business already exists, try to get existing profile
      try {
        const existingProfileResponse = await fetch(url, {
          method: 'GET',
          headers,
          timeout: 10000
        });
        
        if (existingProfileResponse.ok) {
          const existingData = await existingProfileResponse.json();
          await AsyncStorage.setItem('businessProfile', JSON.stringify(existingData.profile || existingData.business));
          await AsyncStorage.setItem('isBusinessUser', 'true');
          
          notifyRefresh({ 
            type: 'created', 
            profile: existingData.profile || existingData.business,
            timestamp: new Date().toISOString()
          });
          
          return existingData;
        }
      } catch (getError) {
        console.warn('Could not retrieve existing profile:', getError.message);
      }
      
      return { 
        success: true, 
        businessId: userEmail,
        message: 'Business profile already exists',
        profile: { id: userEmail, email: userEmail, businessName: enhancedBusinessData.businessName }
      };
    }
    
    if (!response.ok) {
      throw new Error(`Business creation failed: ${response.status} - ${responseText}`);
    }

    const result = JSON.parse(responseText);
    
    await AsyncStorage.setItem('businessProfile', JSON.stringify(result.profile || result.business));
    await AsyncStorage.setItem('isBusinessUser', 'true');
    await AsyncStorage.setItem('businessCreatedAt', new Date().toISOString());

    notifyRefresh({ 
      type: 'created', 
      profile: result.profile || result.business,
      timestamp: new Date().toISOString()
    });

    await addBusinessProfileSync(result.business || enhancedBusinessData, 'business');

    return result;
  } catch (error) {
    console.error('❌ Create business profile error:', error);
    throw new Error(`Business creation failed: ${error.message}`);
  }
};

/**
 * Get Business Profile with Enhanced Caching
 */
export const getBusinessProfile = async (businessId = null) => {
  try {
    console.log('🏢 Getting business profile');
    const headers = await getEnhancedHeaders();

    if (!businessId) {
      businessId = await AsyncStorage.getItem('userEmail');
    }

    if (!businessId) {
      throw new Error('Business ID is required');
    }

    const currentUser = await AsyncStorage.getItem('userEmail');
    if (businessId !== currentUser) {
      headers['X-Business-ID'] = businessId;
    }

    const url = `${API_BASE_URL}/business-profile`;
    const response = await apiRequest(url, {
      method: 'GET',
      headers,
    }, 3, 'Get Business Profile');

    if (businessId === currentUser) {
      await AsyncStorage.setItem('businessProfile', JSON.stringify(response.profile || response.business));
      await AsyncStorage.setItem('profileLastFetched', new Date().toISOString());
    }

    notifyRefresh({ 
      type: 'fetched', 
      profile: response.profile || response.business,
      timestamp: new Date().toISOString()
    });

    return {
      success: true,
      business: response.business || response.profile || response,
      profile: response.business || response.profile || response
    };
  } catch (error) {
    console.error('❌ Get business profile error:', error);
    
    if (!businessId || businessId === await AsyncStorage.getItem('userEmail')) {
      try {
        const cachedProfile = await AsyncStorage.getItem('businessProfile');
        if (cachedProfile) {
          const profile = JSON.parse(cachedProfile);
          return { 
            success: true,
            profile: profile, 
            business: profile,
            fromCache: true 
          };
        }
      } catch (cacheError) {
        console.warn('Error accessing cached profile:', cacheError);
      }
    }
    
    return {
      success: false,
      error: error.message,
      business: null,
      profile: null
    };
  }
};

/**
 * Update Business Profile with Sync Bridge Integration
 */
export const updateBusinessProfile = async (updateData) => {
  try {
    console.log('🏢 Updating business profile');
    const headers = await getEnhancedHeaders();

    const enhancedUpdateData = {
      ...updateData,
      updatedAt: new Date().toISOString()
    };

    const url = `${API_BASE_URL}/business-profile`;
    const response = await apiRequest(url, {
      method: 'PUT',
      headers,
      body: JSON.stringify(enhancedUpdateData),
    }, 3, 'Update Business Profile');

    await AsyncStorage.setItem('businessProfile', JSON.stringify(response.profile || response.business));
    await AsyncStorage.setItem('profileLastUpdated', new Date().toISOString());

    await addBusinessProfileSync(response.profile || response.business, 'business');

    notifyRefresh({ 
      type: 'updated', 
      profile: response.profile || response.business,
      updateData: enhancedUpdateData,
      timestamp: new Date().toISOString()
    });

    return {
      success: true,
      business: response.business || response.profile || response,
      profile: response.business || response.profile || response
    };
  } catch (error) {
    console.error('❌ Update business profile error:', error);
    
    return {
      success: false,
      error: error.message,
      business: null,
      profile: null
    };
  }
};

/**
 * Fetch Business Profile for Map Display
 */
export const fetchBusinessProfile = async (businessId) => {
  try {
    console.log('🏢 Fetching business profile for map:', businessId);

    const shouldRefresh = await checkIfShouldRefresh();
    if (shouldRefresh) {
      console.log('🔄 Auto-refreshing stale profile data');
    }

    const headers = await getEnhancedHeaders();
    const url = `${API_BASE_URL}/business-profile`;
    const response = await apiRequest(url, {
      method: 'GET',
      headers,
    }, 3, 'Fetch Business Profile for Map');

    try {
      await AsyncStorage.setItem(`cached_business_profile_${businessId}`, JSON.stringify({
        data: response,
        timestamp: Date.now()
      }));
    } catch (cacheError) {
      console.warn('Failed to cache business profile:', cacheError);
    }

    notifyRefresh({ 
      type: 'fetched_for_map', 
      profile: response.profile,
      businessId: businessId,
      timestamp: new Date().toISOString()
    });

    return response;
  } catch (error) {
    console.error('❌ Fetch business profile error:', error);

    try {
      const cached = await AsyncStorage.getItem(`cached_business_profile_${businessId}`);
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < 3600000) { // 1 hour
          console.log('📱 Using cached business profile');
          return data;
        }
      }
    } catch (cacheError) {
      console.warn('Error accessing cached profile:', cacheError);
    }

    throw error;
  }
};

/**
 * Get Business Dashboard Data
 */
export const getBusinessDashboard = async () => {
  try {
    console.log('📊 Loading business dashboard');
    const headers = await getEnhancedHeaders();
    
    const url = `${API_BASE_URL}/business-dashboard`;
    const response = await apiRequest(url, {
      method: 'GET',
      headers,
    }, 3, 'Business Dashboard');

    if (!response || response.success === false) {
      throw new Error('Dashboard data not available');
    }

    try {
      await AsyncStorage.setItem('cached_dashboard', JSON.stringify({
        data: response,
        timestamp: Date.now()
      }));
    } catch (cacheError) {
      console.warn('Failed to cache dashboard data:', cacheError);
    }

    notifyRefresh({ 
      type: 'dashboard_loaded', 
      data: response,
      timestamp: new Date().toISOString()
    });

    return response;
  } catch (error) {
    console.error('❌ Dashboard error:', error);
    throw new Error(`Dashboard unavailable: ${error.message}`);
  }
};

/**
 * Get Business Inventory
 */
export const getBusinessInventory = async (businessId) => {
  try {
    console.log('📦 Loading inventory for business:', businessId);
    const headers = await getEnhancedHeaders();
    
    if (!businessId) {
      businessId = await AsyncStorage.getItem('userEmail') || await AsyncStorage.getItem('businessId');
    }
    
    if (!businessId) {
      throw new Error('Business ID is required for inventory fetch');
    }
    
    // Updated URL to match the actual Azure Function endpoint
    const url = `${API_BASE_URL}/marketplace/business/${encodeURIComponent(businessId)}/inventory`;
    let response;
    try {
      response = await apiRequest(url, {
        method: 'GET',
        headers,
      }, 3, 'Business Inventory');
    } catch (err) {
      // If backend returns 404, treat as business not found
      if (err && err.status === 404) {
        throw new Error('Business not found');
      }
      throw err;
    }

    // Defensive: always return an array for inventory
    const inventory = response.inventory || response.items || response.data || [];
    
    await AsyncStorage.setItem('businessInventory', JSON.stringify(response));
    await AsyncStorage.setItem('inventoryLastFetched', new Date().toISOString());

    notifyRefresh({ 
      type: 'inventory_loaded', 
      data: response,
      timestamp: new Date().toISOString()
    });
    
    return {
      success: true,
      businessId: response.businessId || businessId,
      inventory: inventory.map(item => ({
        ...item,
        isLowStock: (item.quantity || 0) <= (item.minThreshold || 5),
        finalPrice: item.finalPrice || (item.price - (item.price * (item.discount || 0) / 100)),
        lastUpdated: item.updatedAt || item.dateAdded || new Date().toISOString(),
        mainImage: item.mainImage || item.image || (item.images && item.images[0]) || item.imageUrls?.[0],
        images: item.images || item.imageUrls || (item.mainImage ? [item.mainImage] : []),
        hasImages: !!(item.mainImage || item.image || (item.images && item.images.length > 0) || (item.imageUrls && item.imageUrls.length > 0)),
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
 * Create Inventory Item
 */
export const createInventoryItem = async (inventoryData) => {
  try {
    console.log('➕ Creating inventory item');
    const headers = await getEnhancedHeaders();

    const requiredFields = ['name', 'quantity', 'price'];
    const missingFields = requiredFields.filter(field => !inventoryData[field]);
    if (missingFields.length > 0) {
      throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
    }

    const enhancedData = {
      ...inventoryData,
      status: inventoryData.status || 'active',
      dateAdded: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      discount: inventoryData.discount || 0,
      minThreshold: inventoryData.minThreshold || 5,
      category: inventoryData.category || 'General',
      images: inventoryData.images || [],
      imageUrls: inventoryData.imageUrls || [],
      mainImage: inventoryData.mainImage || inventoryData.imageUrls?.[0] || inventoryData.images?.[0],
    };

    const url = `${API_BASE_URL}/business-inventory-create`;
    const response = await apiRequest(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(enhancedData),
    }, 3, 'Create Inventory Item');

    notifyRefresh({ 
      type: 'inventory_item_created', 
      item: response,
      timestamp: new Date().toISOString()
    });

    return response;
  } catch (error) {
    console.error('❌ Inventory creation error:', error);
    throw error;
  }
};

/**
 * Update Inventory Item
 */
export const updateInventoryItem = async (inventoryId, updateData) => {
  try {
    console.log('📝 Updating inventory item:', inventoryId);
    const headers = await getEnhancedHeaders();

    if (!inventoryId) {
      throw new Error('Inventory ID is required');
    }

    const enhancedUpdateData = {
      ...updateData,
      lastUpdated: new Date().toISOString(),
      images: updateData.images || [],
      imageUrls: updateData.imageUrls || updateData.images || [],
      mainImage: updateData.mainImage || updateData.imageUrls?.[0] || updateData.images?.[0],
    };

    const url = `${API_BASE_URL}/business-inventory-update`;
    const response = await apiRequest(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ inventoryId, ...enhancedUpdateData }),
    }, 3, 'Update Inventory Item');

    notifyRefresh({ 
      type: 'inventory_item_updated', 
      itemId: inventoryId,
      item: response,
      timestamp: new Date().toISOString()
    });

    return response;
  } catch (error) {
    console.error('❌ Inventory update error:', error);
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

    const url = `${API_BASE_URL}/business-inventory-delete`;
    const response = await apiRequest(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ inventoryId }),
    }, 3, 'Delete Inventory Item');

    notifyRefresh({ 
      type: 'inventory_item_deleted', 
      itemId: inventoryId,
      timestamp: new Date().toISOString()
    });

    return response;
  } catch (error) {
    console.error('❌ Delete inventory item error:', error);
    throw error;
  }
};

/**
 * Get Business Orders
 */
export const getBusinessOrders = async (status = 'all', limit = 50) => {
  try {
    console.log('📋 Loading business orders with status:', status);
    const headers = await getEnhancedHeaders();

    const queryParams = new URLSearchParams();
    if (status !== 'all') queryParams.append('status', status);
    queryParams.append('limit', limit.toString());

    const url = `${API_BASE_URL}/business-orders-get?${queryParams.toString()}`;
    const response = await apiRequest(url, {
      method: 'GET',
      headers,
    }, 3, 'Business Orders');

    const orders = response.orders || response.data || [];
    
    notifyRefresh({ 
      type: 'orders_loaded', 
      orders: orders,
      timestamp: new Date().toISOString()
    });
    
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
        isRecent: Date.now() - new Date(order.orderDate || order.createdAt).getTime() < 7 * 24 * 60 * 60 * 1000,
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
 * Get Business Customers
 */
export const getBusinessCustomers = async () => {
  try {
    console.log('👥 Loading business customers');
    const headers = await getEnhancedHeaders();

    // FIXED: Use correct backend endpoint name
    const url = `${API_BASE_URL}/business/customers`;
    const response = await apiRequest(url, {
      method: 'GET',
      headers,
    }, 3, 'Business Customers');

    const customers = response.customers || response.data || [];

    notifyRefresh({ 
      type: 'customers_loaded', 
      customers: customers,
      timestamp: new Date().toISOString()
    });

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

/**
 * Get Business Notifications
 * Fetches all notifications for the current business
 */
export const getBusinessNotifications = async () => {
  try {
    console.log('🔔 Loading business notifications');
    const headers = await getEnhancedHeaders();

    const url = `${API_BASE_URL}/get_pending_notifications`;
    const response = await apiRequest(url, {
      method: 'GET',
      headers,
    }, 3, 'Business Notifications');

    const notifications = response.notifications || response.data || [];

    notifyRefresh({ 
      type: 'notifications_loaded', 
      notifications: notifications,
      timestamp: new Date().toISOString()
    });

    return {
      success: true,
      notifications: notifications.map(notification => ({
        ...notification,
        timestamp: new Date(notification.timestamp || notification.createdAt || Date.now()),
        priority: notification.priority || 'medium',
        read: notification.read || false,
      })),
      unreadCount: response.unreadCount || notifications.filter(n => !n.read).length,
    };
  } catch (error) {
    console.error('❌ Business notifications error:', error);
    // Return empty notifications array on error to prevent app crashes
    return {
      success: false,
      notifications: [],
      unreadCount: 0,
      error: error.message
    };
  }
};

/**
 * Mark Notification as Read
 */
export const markNotificationAsRead = async (notificationId) => {
  try {
    console.log('✓ Marking notification as read:', notificationId);
    const headers = await getEnhancedHeaders();

    const url = `${API_BASE_URL}/mark_notification_read`;
    const response = await apiRequest(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ id: notificationId }),
    }, 3, 'Mark Notification Read');

    notifyRefresh({ 
      type: 'notification_read', 
      notificationId: notificationId,
      timestamp: new Date().toISOString()
    });

    return response;
  } catch (error) {
    console.error('❌ Mark notification error:', error);
    // Return success anyway to allow optimistic UI updates
    return { 
      success: true, 
      notificationId: notificationId,
      error: error.message
    };
  }
};

/**
 * Get Business Reports - NEW FUNCTION FOR REAL REPORTS DATA
 */
export const getBusinessReports = async (reportType = 'sales', timeframe = 'month') => {
  try {
    console.log('📊 Loading business reports:', reportType, timeframe);
    const headers = await getEnhancedHeaders();

    const queryParams = new URLSearchParams();
    queryParams.append('type', reportType);
    queryParams.append('timeframe', timeframe);

    const url = `${API_BASE_URL}/business-reports?${queryParams.toString()}`;
    const response = await apiRequest(url, {
      method: 'GET',
      headers,
    }, 3, 'Business Reports');

    notifyRefresh({ 
      type: 'reports_loaded', 
      reportType: reportType,
      timeframe: timeframe,
      data: response,
      timestamp: new Date().toISOString()
    });

    return {
      success: true,
      reportType,
      timeframe,
      data: response.data || response,
      summary: response.summary || {},
      charts: response.charts || {},
      generatedAt: new Date().toISOString()
    };
  } catch (error) {
    console.error('❌ Business reports error:', error);
    // Return empty structure on error to prevent crashes
    return {
      success: false,
      reportType,
      timeframe,
      data: {},
      summary: {},
      charts: {},
      error: error.message,
      generatedAt: new Date().toISOString()
    };
  }
};

/**
 * Auto-refresh helper functions
 */

// Check if data should be refreshed based on timestamp
const checkIfShouldRefresh = async (cacheKey = 'profileLastFetched', maxAgeMs = 300000) => {
  try {
    const lastFetched = await AsyncStorage.getItem(cacheKey);
    if (!lastFetched) return true;
    
    const age = Date.now() - new Date(lastFetched).getTime();
    return age > maxAgeMs; // 5 minutes default
  } catch (error) {
    console.warn('Error checking refresh status:', error);
    return true; // Refresh on error
  }
};

// Auto-refresh business data if needed
export const autoRefreshIfNeeded = async () => {
  try {
    console.log('🔄 Checking if auto-refresh is needed');
    
    const shouldRefreshProfile = await checkIfShouldRefresh('profileLastFetched', 300000); // 5 minutes
    const shouldRefreshInventory = await checkIfShouldRefresh('inventoryLastFetched', 600000); // 10 minutes
    
    const refreshPromises = [];
    
    if (shouldRefreshProfile) {
      console.log('🔄 Auto-refreshing business profile');
      refreshPromises.push(getBusinessProfile().catch(err => {
        console.warn('Auto-refresh profile failed:', err.message);
        return null;
      }));
    }
    
    if (shouldRefreshInventory) {
      console.log('🔄 Auto-refreshing inventory');
      refreshPromises.push(getBusinessInventory().catch(err => {
        console.warn('Auto-refresh inventory failed:', err.message);
        return null;
      }));
    }
    
    if (refreshPromises.length > 0) {
      const results = await Promise.all(refreshPromises);
      console.log('✅ Auto-refresh completed');
      return results.filter(result => result !== null);
    }
    
    return [];
  } catch (error) {
    console.error('❌ Auto-refresh error:', error);
    return [];
  }
};

// Force refresh business profile
export const refreshBusinessProfile = async () => {
  try {
    console.log('🔄 Force refreshing business profile');
    await AsyncStorage.removeItem('profileLastFetched');
    return await getBusinessProfile();
  } catch (error) {
    console.error('❌ Force refresh error:', error);
    throw error;
  }
};

// Get cached business profile
export const getCachedBusinessProfile = async () => {
  try {
    const cached = await AsyncStorage.getItem('businessProfile');
    if (cached) {
      return JSON.parse(cached);
    }
    return null;
  } catch (error) {
    console.warn('Error getting cached profile:', error);
    return null;
  }
};

// Clear business profile cache
export const clearBusinessProfileCache = async () => {
  try {
    await Promise.all([
      AsyncStorage.removeItem('businessProfile'),
      AsyncStorage.removeItem('profileLastFetched'),
      AsyncStorage.removeItem('inventoryLastFetched'),
      AsyncStorage.removeItem('businessInventory')
    ]);
    console.log('🧹 Business cache cleared');
  } catch (error) {
    console.error('❌ Error clearing cache:', error);
  }
};

// Export utility functions and classes
export { ApiError, getStockLevel, getLoyaltyLevel };

// Default export with all functions
export default {
  // Core Profile Functions
  getBusinessProfile,
  createBusinessProfile,
  updateBusinessProfile,
  fetchBusinessProfile,
  
  // Dashboard & Analytics
  getBusinessDashboard,
  getBusinessReports, // ADD NEW FUNCTION
  
  // Inventory Management
  getBusinessInventory,
  createInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
  
  // Order Management
  getBusinessOrders,
  
  // Customer Management
  getBusinessCustomers,
  
  // Notification Management
  getBusinessNotifications,
  markNotificationAsRead,
  
  // Auto-refresh Functions
  autoRefreshIfNeeded,
  refreshBusinessProfile,
  getCachedBusinessProfile,
  clearBusinessProfileCache,
  onBusinessRefresh,
  
  // Utility Functions
  ApiError,
  getStockLevel,
  getLoyaltyLevel,
};