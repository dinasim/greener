// Business/services/businessApi.js - Enhanced version
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = 'https://usersfunctions.azurewebsites.net/api';

// Helper function to get headers with authentication
const getHeaders = async () => {
  try {
    const userEmail = await AsyncStorage.getItem('userEmail');
    const userType = await AsyncStorage.getItem('userType');
    const businessId = await AsyncStorage.getItem('businessId');
    
    const headers = {
      'Content-Type': 'application/json',
    };
    
    if (userEmail) {
      headers['X-User-Email'] = userEmail;
    }
    
    if (userType) {
      headers['X-User-Type'] = userType;
    }
    
    if (businessId) {
      headers['X-Business-ID'] = businessId;
    }
    
    console.log('API Headers:', headers);
    return headers;
  } catch (error) {
    console.error('Error getting headers:', error);
    return {
      'Content-Type': 'application/json',
    };
  }
};

// Enhanced response handler with detailed logging
const handleResponse = async (response, context = 'API Request') => {
  console.log(`${context} - Response Status:`, response.status);
  console.log(`${context} - Response Headers:`, response.headers);
  
  let responseText;
  try {
    responseText = await response.text();
    console.log(`${context} - Response Text:`, responseText);
  } catch (textError) {
    console.error(`${context} - Error reading response text:`, textError);
    throw new Error(`Failed to read response: ${textError.message}`);
  }
  
  if (!response.ok) {
    let errorMessage = `HTTP ${response.status}`;
    try {
      const errorData = JSON.parse(responseText);
      errorMessage = errorData.error || errorData.message || errorMessage;
      console.error(`${context} - Error Details:`, errorData);
    } catch (parseError) {
      console.error(`${context} - Error parsing error response:`, parseError);
      errorMessage = responseText || errorMessage;
    }
    throw new Error(errorMessage);
  }
  
  try {
    const jsonData = JSON.parse(responseText);
    console.log(`${context} - Parsed JSON:`, jsonData);
    return jsonData;
  } catch (parseError) {
    console.log(`${context} - Response is not JSON, returning as text`);
    return { success: true, data: responseText };
  }
};

/**
 * Search plants from the main plants database
 * @param {string} query Search query
 * @returns {Promise<Array>} Array of plant objects
 */
export const searchPlants = async (query) => {
  if (!query || query.length < 2) {
    throw new Error('Search query must be at least 2 characters');
  }
  
  try {
    console.log('Searching plants with query:', query);
    const headers = await getHeaders();
    
    const url = `${API_BASE_URL}/business/plants/search?q=${encodeURIComponent(query)}`;
    console.log('Search URL:', url);
    
    const response = await fetch(url, {
      method: 'GET',
      headers,
    });
    
    const data = await handleResponse(response, 'Plant Search');
    
    // Handle different response formats
    if (data.plants && Array.isArray(data.plants)) {
      console.log(`Found ${data.plants.length} plants`);
      return data.plants;
    } else if (Array.isArray(data)) {
      console.log(`Found ${data.length} plants (direct array)`);
      return data;
    } else {
      console.log('No plants array found in response');
      return [];
    }
  } catch (error) {
    console.error('Error searching plants:', error);
    throw new Error(`Plant search failed: ${error.message}`);
  }
};

/**
 * Create a new inventory item
 * @param {Object} inventoryData Inventory item data
 * @returns {Promise<Object>} Created inventory item
 */
export const createInventoryItem = async (inventoryData) => {
  if (!inventoryData) {
    throw new Error('Inventory data is required');
  }
  
  try {
    console.log('Creating inventory item:', inventoryData);
    const headers = await getHeaders();
    
    const url = `${API_BASE_URL}/business/inventory/create`;
    console.log('Create URL:', url);
    
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(inventoryData),
    });
    
    const data = await handleResponse(response, 'Create Inventory Item');
    
    console.log('Inventory item created successfully:', data);
    return data;
  } catch (error) {
    console.error('Error creating inventory item:', error);
    throw new Error(`Failed to create inventory item: ${error.message}`);
  }
};

/**
 * Get business inventory
 * @param {string} businessId Business ID
 * @returns {Promise<Array>} Array of inventory items
 */
export const getBusinessInventory = async (businessId) => {
  if (!businessId) {
    throw new Error('Business ID is required');
  }
  
  try {
    console.log('Getting business inventory for:', businessId);
    const headers = await getHeaders();
    
    const url = `${API_BASE_URL}/business/inventory/${encodeURIComponent(businessId)}`;
    console.log('Inventory URL:', url);
    
    const response = await fetch(url, {
      method: 'GET',
      headers,
    });
    
    const data = await handleResponse(response, 'Get Business Inventory');
    
    // Handle different response formats
    let inventory = [];
    
    if (data.inventory && Array.isArray(data.inventory)) {
      inventory = data.inventory;
    } else if (data.items && Array.isArray(data.items)) {
      inventory = data.items;
    } else if (Array.isArray(data)) {
      inventory = data;
    } else if (data.data && Array.isArray(data.data)) {
      inventory = data.data;
    }
    
    console.log(`Business inventory loaded: ${inventory.length} items`);
    return inventory;
  } catch (error) {
    console.error('Error getting business inventory:', error);
    
    // Return empty array instead of throwing for inventory listing
    if (error.message.includes('404') || error.message.includes('not found')) {
      console.log('No inventory found, returning empty array');
      return [];
    }
    
    throw new Error(`Failed to get inventory: ${error.message}`);
  }
};

/**
 * Update inventory item
 * @param {string} inventoryId Inventory item ID
 * @param {Object} updateData Data to update
 * @returns {Promise<Object>} Updated inventory item
 */
export const updateInventoryItem = async (inventoryId, updateData) => {
  if (!inventoryId) {
    throw new Error('Inventory ID is required');
  }
  
  if (!updateData) {
    throw new Error('Update data is required');
  }
  
  try {
    console.log('Updating inventory item:', inventoryId, updateData);
    const headers = await getHeaders();
    
    const url = `${API_BASE_URL}/business/inventory/${inventoryId}`;
    console.log('Update URL:', url);
    
    const response = await fetch(url, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(updateData),
    });
    
    const data = await handleResponse(response, 'Update Inventory Item');
    
    console.log('Inventory item updated successfully:', data);
    return data;
  } catch (error) {
    console.error('Error updating inventory item:', error);
    throw new Error(`Failed to update inventory item: ${error.message}`);
  }
};

/**
 * Delete inventory item
 * @param {string} inventoryId Inventory item ID
 * @returns {Promise<Object>} Deletion confirmation
 */
export const deleteInventoryItem = async (inventoryId) => {
  if (!inventoryId) {
    throw new Error('Inventory ID is required');
  }
  
  try {
    console.log('Deleting inventory item:', inventoryId);
    const headers = await getHeaders();
    
    const url = `${API_BASE_URL}/business/inventory/${inventoryId}`;
    console.log('Delete URL:', url);
    
    const response = await fetch(url, {
      method: 'DELETE',
      headers,
    });
    
    const data = await handleResponse(response, 'Delete Inventory Item');
    
    console.log('Inventory item deleted successfully:', data);
    return data;
  } catch (error) {
    console.error('Error deleting inventory item:', error);
    throw new Error(`Failed to delete inventory item: ${error.message}`);
  }
};

/**
 * Get low stock items
 * @param {string} businessId Business ID
 * @returns {Promise<Array>} Array of low stock items
 */
export const getLowStockItems = async (businessId) => {
  if (!businessId) {
    throw new Error('Business ID is required');
  }
  
  try {
    console.log('Getting low stock items for:', businessId);
    const headers = await getHeaders();
    
    const url = `${API_BASE_URL}/business/inventory/low-stock?businessId=${encodeURIComponent(businessId)}`;
    console.log('Low Stock URL:', url);
    
    const response = await fetch(url, {
      method: 'GET',
      headers,
    });
    
    const data = await handleResponse(response, 'Get Low Stock Items');
    
    // Handle different response formats
    let lowStockItems = [];
    
    if (data.lowStockItems && Array.isArray(data.lowStockItems)) {
      lowStockItems = data.lowStockItems;
    } else if (data.items && Array.isArray(data.items)) {
      lowStockItems = data.items;
    } else if (Array.isArray(data)) {
      lowStockItems = data;
    }
    
    console.log(`Low stock items loaded: ${lowStockItems.length} items`);
    return lowStockItems;
  } catch (error) {
    console.error('Error getting low stock items:', error);
    
    // Return empty array instead of throwing for low stock listing
    if (error.message.includes('404') || error.message.includes('not found')) {
      console.log('No low stock items found, returning empty array');
      return [];
    }
    
    throw new Error(`Failed to get low stock items: ${error.message}`);
  }
};

/**
 * Create or update business profile
 * @param {Object} businessData Business profile data
 * @returns {Promise<Object>} Created/updated business profile
 */
export const createBusinessProfile = async (businessData) => {
  if (!businessData) {
    throw new Error('Business data is required');
  }
  
  try {
    console.log('Creating/updating business profile:', businessData);
    const headers = await getHeaders();
    
    const url = `${API_BASE_URL}/business/profile`;
    console.log('Business Profile URL:', url);
    
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(businessData),
    });
    
    const data = await handleResponse(response, 'Create Business Profile');
    
    console.log('Business profile created/updated successfully:', data);
    return data;
  } catch (error) {
    console.error('Error creating business profile:', error);
    throw new Error(`Failed to create business profile: ${error.message}`);
  }
};

/**
 * Get business profile
 * @param {string} businessId Business ID
 * @returns {Promise<Object>} Business profile data
 */
export const getBusinessProfile = async (businessId) => {
  if (!businessId) {
    throw new Error('Business ID is required');
  }
  
  try {
    console.log('Getting business profile for:', businessId);
    const headers = await getHeaders();
    
    const url = `${API_BASE_URL}/business/profile?businessId=${encodeURIComponent(businessId)}`;
    console.log('Get Business Profile URL:', url);
    
    const response = await fetch(url, {
      method: 'GET',
      headers,
    });
    
    const data = await handleResponse(response, 'Get Business Profile');
    
    console.log('Business profile loaded successfully');
    return data;
  } catch (error) {
    console.error('Error getting business profile:', error);
    throw new Error(`Failed to get business profile: ${error.message}`);
  }
};

/**
 * Get business orders with filtering
 * @param {string} businessId Business ID
 * @param {Object} filters Filter options
 * @returns {Promise<Object>} Orders data
 */
export const getBusinessOrders = async (businessId, filters = {}) => {
  if (!businessId) {
    throw new Error('Business ID is required');
  }
  
  try {
    console.log('Getting business orders for:', businessId, 'with filters:', filters);
    const headers = await getHeaders();
    
    // Build query parameters
    const queryParams = new URLSearchParams({
      businessId: businessId,
      status: filters.status || 'all',
      limit: filters.limit || '50',
      offset: filters.offset || '0'
    });
    
    const url = `${API_BASE_URL}/business/orders?${queryParams.toString()}`;
    console.log('Orders URL:', url);
    
    const response = await fetch(url, {
      method: 'GET',
      headers,
    });
    
    const data = await handleResponse(response, 'Get Business Orders');
    
    console.log(`Business orders loaded: ${data.orders?.length || 0} orders`);
    return data;
  } catch (error) {
    console.error('Error getting business orders:', error);
    
    // Return empty data instead of throwing for orders listing
    if (error.message.includes('404') || error.message.includes('not found')) {
      console.log('No orders found, returning empty data');
      return {
        success: true,
        orders: [],
        summary: { totalOrders: 0, statusCounts: {}, pendingCount: 0, readyCount: 0, completedCount: 0 },
        communicationInfo: { messagesEnabled: true, emailEnabled: true, smsEnabled: true }
      };
    }
    
    throw new Error(`Failed to get orders: ${error.message}`);
  }
};

/**
 * Get orders that need messaging attention
 * @param {string} businessId Business ID
 * @returns {Promise<Array>} Orders that need communication
 */
export const getOrdersNeedingCommunication = async (businessId) => {
  try {
    const ordersData = await getBusinessOrders(businessId, { status: 'pending' });
    
    // Filter orders that prefer messages and haven't been contacted recently
    const needingAttention = ordersData.orders.filter(order => 
      order.communication?.preferredMethod === 'messages' &&
      order.status === 'pending' &&
      !order.communication?.lastContactDate
    );
    
    return needingAttention;
  } catch (error) {
    console.error('Error getting orders needing communication:', error);
    return [];
  }
};

/**
 * Create order conversation using existing chat API
 * @param {Object} conversationData Conversation data from order creation
 * @returns {Promise<Object>} Created conversation
 */
export const createOrderConversation = async (conversationData) => {
  if (!conversationData) {
    throw new Error('Conversation data is required');
  }
  
  try {
    console.log('Creating order conversation:', conversationData);
    const headers = await getHeaders();
    
    const url = `${API_BASE_URL}/marketplace/messages/createChatRoom`;
    console.log('Create Chat URL:', url);
    
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(conversationData),
    });
    
    const data = await handleResponse(response, 'Create Order Conversation');
    
    console.log('Order conversation created successfully:', data);
    return data;
  } catch (error) {
    console.error('Error creating order conversation:', error);
    throw new Error(`Failed to create conversation: ${error.message}`);
  }
};

/**
 * Get business dashboard data - FIXED
 * @returns {Promise<Object>} Business dashboard data
 */
export const getBusinessDashboard = async () => {
  try {
    console.log('Getting business dashboard data...');
    const headers = await getHeaders();
    
    const url = `${API_BASE_URL}/business/dashboard`;
    console.log('Dashboard URL:', url);
    
    const response = await fetch(url, {
      method: 'GET',
      headers,
    });
    
    const data = await handleResponse(response, 'Get Business Dashboard');
    console.log('Dashboard data received:', data);
    return data;
  } catch (error) {
    console.error('Error getting business dashboard:', error);
    // Return fallback data instead of throwing
    console.log('Returning fallback dashboard data due to error');
    return {
      businessInfo: {
        businessName: 'Your Business',
        businessType: 'Plant Business',
        businessLogo: null,
        email: 'business@example.com',
        rating: 0,
        reviewCount: 0
      },
      metrics: {
        totalSales: 0,
        salesToday: 0,
        newOrders: 0,
        lowStockItems: 0,
        totalInventory: 0,
        activeInventory: 0,
        totalOrders: 0,
        inventoryValue: 0
      },
      topProducts: [],
      recentOrders: [],
      lowStockDetails: []
    };
  }
};

/**
 * Upload business logo to Azure Blob Storage
 * @param {string} imageUri Image URI or blob
 * @param {string} businessId Business ID
 * @returns {Promise<Object>} Upload result with URL
 */
export const uploadBusinessLogo = async (imageUri, businessId) => {
  if (!imageUri) {
    throw new Error('Image URI is required');
  }
  
  if (!businessId) {
    throw new Error('Business ID is required');
  }
  
  try {
    console.log('Uploading business logo:', imageUri, 'for business:', businessId);
    const headers = await getHeaders();
    
    // Remove content-type for file upload
    delete headers['Content-Type'];
    
    const formData = new FormData();
    formData.append('image', {
      uri: imageUri,
      type: 'image/jpeg',
      name: `business_logo_${businessId}.jpg`,
    });
    formData.append('businessId', businessId);
    
    const url = `${API_BASE_URL}/business/upload-logo`;
    console.log('Upload Logo URL:', url);
    
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: formData,
    });
    
    const data = await handleResponse(response, 'Upload Business Logo');
    
    console.log('Business logo uploaded successfully:', data);
    return data;
  } catch (error) {
    console.error('Error uploading business logo:', error);
    throw new Error(`Failed to upload logo: ${error.message}`);
  }
};

/**
 * Test API connection
 * @returns {Promise<Object>} Connection test result
 */
export const testConnection = async () => {
  try {
    console.log('Testing API connection...');
    const headers = await getHeaders();
    
    const url = `${API_BASE_URL}/health`;
    console.log('Health Check URL:', url);
    
    const response = await fetch(url, {
      method: 'GET',
      headers,
    });
    
    const data = await handleResponse(response, 'API Health Check');
    
    console.log('API connection test successful');
    return data;
  } catch (error) {
    console.error('API connection test failed:', error);
    throw new Error(`API connection failed: ${error.message}`);
  }
};




// Export all functions
export default {
  searchPlants,
  createInventoryItem,
  getBusinessInventory,
  updateInventoryItem,
  deleteInventoryItem,
  getLowStockItems,
  createBusinessProfile,
  getBusinessProfile,
  uploadBusinessLogo,
  testConnection,
};