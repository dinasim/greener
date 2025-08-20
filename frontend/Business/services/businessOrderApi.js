// Business/services/businessOrderApi.js
import AsyncStorage from '@react-native-async-storage/async-storage';

export const API_BASE_URL = 'https://usersfunctions.azurewebsites.net/api';

// -------- headers ----------
export const getHeaders = async () => {
  try {
    const userEmail = await AsyncStorage.getItem('userEmail');
    const businessId = (await AsyncStorage.getItem('businessId')) || userEmail;

    const headers = { 'Content-Type': 'application/json' };
    if (userEmail) headers['X-User-Email'] = userEmail;
    if (businessId) headers['X-Business-ID'] = businessId;

    return headers;
  } catch (err) {
    console.error('getHeaders error:', err);
    return { 'Content-Type': 'application/json' };
  }
};

// -------- response helper ----------
const handleResponse = async (response, context = 'API Request') => {
  const text = await response.text().catch(() => '');
  if (!response.ok) {
    let msg = `HTTP ${response.status}`;
    try {
      const j = text ? JSON.parse(text) : null;
      msg = j?.error || j?.message || msg;
    } catch {
      if (text) msg = `${msg} — ${text}`;
    }
    throw new Error(msg);
  }
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { success: true, data: text };
  }
};

// ===================== ORDERS =====================

// CREATE order — route: /business/orders/create
export const createOrder = async (orderData) => {
  if (!orderData) throw new Error('Order data is required');

  const required = ['businessId', 'customerEmail', 'customerName', 'items'];
  const missing = required.filter((k) => !orderData[k] || (k === 'items' && !orderData.items.length));
  if (missing.length) throw new Error(`Missing required fields: ${missing.join(', ')}`);

  const headers = await getHeaders();
  const url = `${API_BASE_URL}/business/orders/create`; // matches your function.json
  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(orderData) });
  const data = await handleResponse(res, 'Create Order');

  // Normalize to a predictable shape for the UI
  const order = data?.order || data;
  return {
    ...data,
    order: {
      ...order,
      id: order.id || order.orderId,        // UI can use either id or orderId
      orderId: order.orderId || order.id,
    },
  };
};

// Get orders — existing route kept: /business-orders-get
export const getBusinessOrders = async (businessId, options = {}) => {
  if (!businessId) throw new Error('Business ID is required');

  const headers = await getHeaders();
  const qs = new URLSearchParams();
  qs.append('businessId', businessId);
  if (options.status && options.status !== 'all') qs.append('status', options.status);
  if (options.limit) qs.append('limit', options.limit);
  if (options.offset) qs.append('offset', options.offset);

  const url = `${API_BASE_URL}/business-orders-get?${qs.toString()}`;
  const res = await fetch(url, { method: 'GET', headers });
  const data = await handleResponse(res, 'Get Business Orders');

  let orders = [];
  if (Array.isArray(data)) orders = data;
  else if (Array.isArray(data?.orders)) orders = data.orders;
  else if (Array.isArray(data?.data)) orders = data.data;

  return {
    orders,
    totalOrders: data.totalOrders ?? orders.length,
    pendingOrders: data.pendingOrders ?? orders.filter(o => o.status === 'pending').length,
    completedOrders: data.completedOrders ?? orders.filter(o => o.status === 'completed').length,
    summary: data.summary || {},
    pagination: data.pagination || {},
  };
};

// UPDATE status — NEW route: /business-orders-update (PATCH)
export const updateOrderStatus = async (orderId, newStatus, note = '') => {
  if (!orderId || !newStatus) throw new Error('Order ID and new status are required');
  const headers = await getHeaders();
  const url = `${API_BASE_URL}/business-orders-update`; // <-- updated to your new function
  const res = await fetch(url, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ orderId, status: newStatus, note }),
  });
  const data = await handleResponse(res, 'Update Order Status');

  // Normalize order object if present
  if (data?.order) {
    data.order = {
      ...data.order,
      id: data.order.id || data.order.orderId,
      orderId: data.order.orderId || data.order.id,
    };
  }
  return data;
};

export const getBusinessCustomers = async (businessId) => {
  if (!businessId) throw new Error('Business ID is required');
  const headers = await getHeaders();
  const url = `${API_BASE_URL}/business/customers`;
  const res = await fetch(url, { method: 'GET', headers });
  const data = await handleResponse(res, 'Get Business Customers');

  if (Array.isArray(data?.customers)) return data.customers;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data)) return data;
  return [];
};

export const createOrUpdateCustomer = async (customerData) => {
  if (!customerData?.email || !customerData?.name) {
    throw new Error('Customer email and name are required');
  }
  const headers = await getHeaders();
  const url = `${API_BASE_URL}/business/customers`;
  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(customerData) });
  return handleResponse(res, 'Create/Update Customer');
};

export default {
  createOrder,
  getBusinessOrders,
  updateOrderStatus,
  getBusinessCustomers,
  createOrUpdateCustomer,
  getHeaders,
};
