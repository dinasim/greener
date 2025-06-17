// Business/services/businessOrderApi.js - FIXED VERSION
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = 'https://usersfunctions.azurewebsites.net/api';

/**
 * FIXED: Business Order API with corrected endpoint names and standardized error handling
 */

// Helper function to get headers with authentication
const getHeaders = async () => {
  try {
    const userEmail = await AsyncStorage.getItem('userEmail');
    const businessId = await AsyncStorage.getItem('businessId');
    
    const headers = {
      'Content-Type': 'application/json',
    };
    
    if (userEmail) {
      headers['X-User-Email'] = userEmail;
    }
    
    if (businessId) {
      headers['X-Business-ID'] = businessId;
    }
    
    return headers;
  } catch (error) {
    console.error('Error getting headers:', error);
    return {
      'Content-Type': 'application/json',
    };
  }
};

// Enhanced response handler
const handleResponse = async (response, context = 'API Request') => {
  console.log(`${context} - Response Status:`, response.status);
  
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
 * CRITICAL FIX: Correct all business order endpoint routing
 */

/**
 * FIXED: Create a new order for pickup with correct route
 */
export const createOrder = async (orderData) => {
  if (!orderData) {
    throw new Error('Order data is required');
  }
  
  // Validate required fields
  const requiredFields = ['businessId', 'customerEmail', 'customerName', 'items'];
  const missingFields = requiredFields.filter(field => !orderData[field]);
  
  if (missingFields.length > 0) {
    throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
  }
  
  if (!orderData.items || orderData.items.length === 0) {
    throw new Error('Order must contain at least one item');
  }
  
  try {
    console.log('Creating order:', orderData);
    const headers = await getHeaders();
    
    // FIXED: Use correct backend function name
    const url = `${API_BASE_URL}/business-order-create`;
    console.log('FIXED Create Order URL:', url);
    
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(orderData),
    });
    
    const data = await handleResponse(response, 'Create Order');
    console.log('Order created successfully:', data);
    return data;
  } catch (error) {
    console.error('Error creating order:', error);
    throw new Error(`Failed to create order: ${error.message}`);
  }
};

/**
 * FIXED: Get orders for business with correct route
 * @param {string} businessId Business ID
 * @param {Object} options Filter options
 * @returns {Promise<Array>} Array of orders
 */
export const getBusinessOrders = async (businessId, options = {}) => {
  if (!businessId) {
    throw new Error('Business ID is required');
  }
  
  try {
    console.log('Getting business orders for:', businessId);
    const headers = await getHeaders();
    
    const queryParams = new URLSearchParams();
    queryParams.append('businessId', businessId);
    
    if (options.status && options.status !== 'all') {
      queryParams.append('status', options.status);
    }
    
    if (options.limit) {
      queryParams.append('limit', options.limit);
    }
    
    if (options.offset) {
      queryParams.append('offset', options.offset);
    }
    
    // FIXED: Use correct backend function name
    const url = `${API_BASE_URL}/business-orders-get?${queryParams.toString()}`;
    console.log('FIXED Get Orders URL:', url);
    
    const response = await fetch(url, {
      method: 'GET',
      headers,
    });
    
    const data = await handleResponse(response, 'Get Business Orders');
    
    // Handle different response formats
    let orders = [];
    
    if (data.orders && Array.isArray(data.orders)) {
      orders = data.orders;
    } else if (Array.isArray(data)) {
      orders = data;
    } else if (data.data && Array.isArray(data.data)) {
      orders = data.data;
    }
    
    console.log(`Business orders loaded: ${orders.length} orders`);
    return {
      orders,
      totalOrders: data.totalOrders || orders.length,
      pendingOrders: data.pendingOrders || orders.filter(o => o.status === 'pending').length,
      completedOrders: data.completedOrders || orders.filter(o => o.status === 'completed').length,
      summary: data.summary || {},
      pagination: data.pagination || {}
    };
  } catch (error) {
    console.error('Error getting business orders:', error);
    throw new Error(`Failed to get business orders: ${error.message}`);
  }
};

/**
 * FIXED: Update order status with correct route
 * @param {string} orderId Order ID to update
 * @param {string} newStatus New status
 * @returns {Promise<Object>} Updated order
 */
export const updateOrderStatus = async (orderId, newStatus) => {
  if (!orderId || !newStatus) {
    throw new Error('Order ID and new status are required');
  }
  
  try {
    console.log('Updating order status:', orderId, 'to', newStatus);
    const headers = await getHeaders();
    
    // FIXED: Use correct backend function name for updates
    const url = `${API_BASE_URL}/business-orders`;
    console.log('FIXED Update Order Status URL:', url);
    
    const response = await fetch(url, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        orderId,
        status: newStatus
      }),
    });
    
    const data = await handleResponse(response, 'Update Order Status');
    console.log('Order status updated successfully:', data);
    return data;
  } catch (error) {
    console.error('Error updating order status:', error);
    throw new Error(`Failed to update order status: ${error.message}`);
  }
};

/**
 * FIXED: Get customers for business with correct route
 * @param {string} businessId Business ID
 * @returns {Promise<Array>} Array of customers
 */
export const getBusinessCustomers = async (businessId) => {
  if (!businessId) {
    throw new Error('Business ID is required');
  }
  
  try {
    console.log('Getting business customers for:', businessId);
    const headers = await getHeaders();
    
    // FIXED: Use correct backend function name
    const url = `${API_BASE_URL}/business-customers`;
    console.log('FIXED Get Customers URL:', url);
    
    const response = await fetch(url, {
      method: 'GET',
      headers,
    });
    
    const data = await handleResponse(response, 'Get Business Customers');
    
    // Handle different response formats
    let customers = [];
    if (data.customers && Array.isArray(data.customers)) {
      customers = data.customers;
    } else if (Array.isArray(data)) {
      customers = data;
    } else if (data.data && Array.isArray(data.data)) {
      customers = data.data;
    }
    
    console.log(`Business customers loaded: ${customers.length} customers`);
    return customers;
  } catch (error) {
    console.error('Error getting business customers:', error);
    
    // Return empty array for 404 or "not found" errors
    if (error.message.includes('404') || error.message.includes('not found')) {
      console.log('No customers found, returning empty array');
      return [];
    }
    
    throw new Error(`Failed to get customers: ${error.message}`);
  }
};

/**
 * FIXED: Create or update customer record with correct route
 * @param {Object} customerData Customer data
 * @returns {Promise<Object>} Customer record
 */
export const createOrUpdateCustomer = async (customerData) => {
  if (!customerData || !customerData.email || !customerData.name) {
    throw new Error('Customer email and name are required');
  }
  
  try {
    console.log('Creating/updating customer:', customerData);
    const headers = await getHeaders();
    
    // FIXED: Use correct route from backend
    const url = `${API_BASE_URL}/business/customers`;
    console.log('Create/Update Customer URL:', url);
    
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(customerData),
    });
    
    const data = await handleResponse(response, 'Create/Update Customer');
    
    console.log('Customer created/updated successfully:', data);
    return data;
  } catch (error) {
    console.error('Error creating/updating customer:', error);
    throw new Error(`Failed to create/update customer: ${error.message}`);
  }
};

// Export all functions
export default {
  createOrder,
  getBusinessOrders,
  updateOrderStatus,
  getBusinessCustomers,
  createOrUpdateCustomer,
};