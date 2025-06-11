// Business/services/businessApi.js - ENHANCED VERSION WITH MAP FEATURES
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

// Enhanced response handler
const handleApiResponse = async (response, context = 'API Request') => {
  console.log(`📡 ${context} - Status: ${response.status}`);
  
  let responseText;
  try {
    responseText = await response.text();
    console.log(`📝 ${context} - Response:`, responseText.substring(0, 500));
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
      console.log(`🚀 Attempt ${attempt}/${retries} - ${context}: ${url}`);
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
      console.log(`⏱️ Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
};

/**
 * Get Business Dashboard Data
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
 * Get Business Inventory
 */
export const getBusinessInventory = async (businessId) => {
  try {
    console.log('📦 Loading inventory for business:', businessId);
    const headers = await getEnhancedHeaders();
    
    const url = `${API_BASE_URL}/business/inventory/${encodeURIComponent(businessId)}`;
    console.log('📦 Calling inventory URL:', url);
    
    const response = await apiRequest(url, {
      method: 'GET',
      headers,
    }, 3, 'Business Inventory');
    
    // Process the inventory data
    const inventory = response.inventory || response.items || response.data || [];
    
    return {
      success: true,
      businessId: response.businessId || businessId,
      inventory: inventory.map(item => ({
        ...item,
        isLowStock: (item.quantity || 0) <= (item.minThreshold || 5),
        finalPrice: item.finalPrice || (item.price - (item.price * (item.discount || 0) / 100)),
        lastUpdated: item.updatedAt || item.dateAdded || new Date().toISOString()
      })),
      totalItems: response.totalItems || inventory.length,
      activeItems: response.activeItems || inventory.filter(i => i.status === 'active').length,
      lowStockItems: response.lowStockItems || inventory.filter(i => (i.quantity || 0) <= (i.minThreshold || 5)).length,
      lastRefreshed: new Date().toISOString()
    };
  } catch (error) {
    console.error('❌ Inventory error:', error);
    throw error;
  }
};

/**
 * Search Plants Database
 */
export const searchPlants = async (query, options = {}) => {
  if (!query || query.length < 2) {
    throw new ApiError('Search query must be at least 2 characters');
  }
  
  try {
    console.log('🔍 Plant search:', query, options);
    const headers = await getEnhancedHeaders();
    
    const queryParams = new URLSearchParams();
    queryParams.append('q', query);
    if (options.limit) queryParams.append('limit', options.limit);
    
    const url = `${API_BASE_URL}/business/plants/search?${queryParams.toString()}`;
    const response = await apiRequest(url, {
      method: 'GET',
      headers,
    }, 3, 'Plant Search');
    
    const plants = response.plants || response.data || [];
    
    return {
      plants: plants.map(plant => ({
        ...plant,
        searchScore: plant.searchScore || 1,
        careComplexity: plant.difficulty ? 
          (plant.difficulty > 7 ? 'Advanced' : plant.difficulty > 4 ? 'Intermediate' : 'Beginner') : 
          'Unknown'
      })),
      count: response.count || plants.length,
      total: response.total || plants.length
    };
  } catch (error) {
    console.error('❌ Plant search error:', error);
    throw error;
  }
};

/**
 * Create Inventory Item
 */
export const createInventoryItem = async (inventoryData) => {
  try {
    console.log('➕ Creating inventory item:', inventoryData);
    
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
    
    const url = `${API_BASE_URL}/business/inventory/create`;
    const response = await apiRequest(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(enhancedData),
    }, 3, 'Create Inventory');
    
    console.log('✅ Inventory item created successfully');
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
    console.log('🔄 Updating inventory item:', inventoryId);
    const headers = await getEnhancedHeaders();
    
    const enhancedUpdateData = {
      ...updateData,
      lastUpdated: new Date().toISOString(),
      finalPrice: updateData.price ? 
        updateData.price - (updateData.price * (updateData.discount || 0) / 100) : 
        undefined
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
    console.error('❌ Inventory delete error:', error);
    throw error;
  }
};

/**
 * Publish Inventory to Marketplace
 */
export const publishInventoryToMarketplace = async (inventoryIds) => {
  try {
    console.log('📢 Publishing inventory to marketplace:', inventoryIds);
    const headers = await getEnhancedHeaders();
    
    const url = `${API_BASE_URL}/business/inventory/publish`;
    const response = await apiRequest(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ inventoryIds }),
    }, 3, 'Publish to Marketplace');
    
    console.log('✅ Inventory published to marketplace');
    return response;
  } catch (error) {
    console.error('❌ Publish to marketplace error:', error);
    throw error;
  }
};

/**
 * Create/Update Business Profile
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
 * Get Business Profile (Enhanced for Map Usage)
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

/**
 * Fetch Business Profile with Inventory (For Map Display)
 */
export const fetchBusinessProfile = async (businessId) => {
  try {
    console.log('🏢 Fetching complete business profile for map:', businessId);
    const headers = await getEnhancedHeaders();
    
    const url = `${API_BASE_URL}/marketplace/business-profile/${encodeURIComponent(businessId)}`;
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
        const isStale = Date.now() - timestamp > 600000; // 10 minutes
        
        if (!isStale) {
          console.log('📱 Returning cached business profile');
          return { ...data, fromCache: true };
        }
      }
    } catch (cacheError) {
      console.warn('⚠️ Failed to load cached business profile:', cacheError);
    }
    
    throw error;
  }
};

/**
 * Get Nearby Businesses (For Map Feature)
 */
export const getNearbyBusinesses = async (latitude, longitude, radius = 10, businessType = null) => {
  try {
    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      throw new ApiError('Valid coordinates required');
    }
    
    console.log('🗺️ Getting nearby businesses:', { latitude, longitude, radius, businessType });
    const headers = await getEnhancedHeaders();
    
    let queryParams = `lat=${latitude}&lon=${longitude}&radius=${radius}`;
    if (businessType && businessType !== 'all') {
      queryParams += `&businessType=${encodeURIComponent(businessType)}`;
    }
    
    const url = `${API_BASE_URL}/marketplace/nearby-businesses?${queryParams}`;
    const response = await apiRequest(url, {
      method: 'GET',
      headers,
    }, 3, 'Get Nearby Businesses');
    
    // Process and enhance business data
    const businesses = (response.businesses || []).map(business => ({
      ...business,
      distance: business.distance || 0,
      isBusiness: true,
      // Ensure consistent data structure for map display
      location: business.location || {
        latitude: business.address?.latitude,
        longitude: business.address?.longitude,
        city: business.address?.city || 'Unknown location'
      }
    }));
    
    // Cache nearby businesses
    try {
      await AsyncStorage.setItem('cached_nearby_businesses', JSON.stringify({
        data: { ...response, businesses },
        location: { latitude, longitude, radius },
        timestamp: Date.now()
      }));
    } catch (cacheError) {
      console.warn('⚠️ Failed to cache nearby businesses:', cacheError);
    }
    
    return {
      ...response,
      businesses,
      count: businesses.length
    };
  } catch (error) {
    console.error('❌ Get nearby businesses error:', error);
    
    // Try to return cached businesses on error
    try {
      const cached = await AsyncStorage.getItem('cached_nearby_businesses');
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        const isStale = Date.now() - timestamp > 300000; // 5 minutes
        
        if (!isStale) {
          console.log('📱 Returning cached nearby businesses');
          return { ...data, fromCache: true };
        }
      }
    } catch (cacheError) {
      console.warn('⚠️ Failed to load cached nearby businesses:', cacheError);
    }
    
    throw error;
  }
};

/**
 * Get Business Hours Status
 */
export const getBusinessHoursStatus = (businessHours) => {
  if (!businessHours || !Array.isArray(businessHours)) {
    return { status: 'unknown', message: 'Hours not available' };
  }
  
  const now = new Date();
  const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][now.getDay()];
  const todayHours = businessHours.find(h => h.day === dayName);
  
  if (!todayHours || todayHours.isClosed) {
    return { status: 'closed', message: 'Closed Today' };
  }
  
  // Check if currently open (simplified)
  const currentTime = now.getHours() * 60 + now.getMinutes();
  const [openHour, openMin] = todayHours.open.split(':').map(Number);
  const [closeHour, closeMin] = todayHours.close.split(':').map(Number);
  const openTime = openHour * 60 + openMin;
  const closeTime = closeHour * 60 + closeMin;
  
  if (currentTime >= openTime && currentTime < closeTime) {
    return { status: 'open', message: 'Open Now' };
  } else {
    return { status: 'closed', message: 'Closed Now' };
  }
};

/**
 * Calculate Distance Between Two Points
 */
export const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

/**
 * Clear Business Cache
 */
export const clearBusinessCache = async () => {
  try {
    console.log('🧹 Clearing business cache...');
    
    const keys = await AsyncStorage.getAllKeys();
    const cacheKeys = keys.filter(key => 
      key.startsWith('cached_dashboard') || 
      key.startsWith('cached_business_profile_') ||
      key.startsWith('cached_nearby_businesses')
    );
    
    if (cacheKeys.length > 0) {
      await AsyncStorage.multiRemove(cacheKeys);
      console.log(`✅ Cleared ${cacheKeys.length} business cache items`);
    }
    
    return { success: true, clearedItems: cacheKeys.length };
  } catch (error) {
    console.error('❌ Error clearing business cache:', error);
    return { success: false, error: error.message };
  }
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

// Export all functions
export default {
  // Existing functions
  getBusinessDashboard,
  getBusinessInventory,
  searchPlants,
  createInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
  publishInventoryToMarketplace,
  createBusinessProfile,
  getBusinessProfile,
  checkApiHealth,
  
  // New map-related functions
  fetchBusinessProfile,
  getNearbyBusinesses,
  getBusinessHoursStatus,
  calculateDistance,
  clearBusinessCache
};