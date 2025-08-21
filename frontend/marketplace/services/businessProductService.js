// services/businessProductService.js
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = 'https://usersfunctions.azurewebsites.net/api';

// ---- helpers ---------------------------------------------------------------
const ID_FIELDS = ['id', '_id', 'plantId', 'productId', 'docId'];

const normalizeId = (obj = {}) => {
  for (const k of ID_FIELDS) {
    if (obj[k]) {
      obj.id = String(obj[k]);
      return obj.id;
    }
  }
  if (obj.id == null) obj.id = undefined;
  return obj.id;
};

const normalizeLocation = (obj = {}) => {
  const loc = obj.location || obj.address || {};
  const lat = Number(loc.latitude ?? loc.lat);
  const lon = Number(loc.longitude ?? loc.lng ?? loc.lon);
  if (Number.isFinite(lat) && Number.isFinite(lon)) {
    obj.location = { ...(obj.location || {}), latitude: lat, longitude: lon };
  }
  return obj;
};

const addAuthHeaders = async () => {
  const headers = { 'Content-Type': 'application/json' };
  const userEmail = await AsyncStorage.getItem('userEmail');
  const token = await AsyncStorage.getItem('googleAuthToken');
  if (userEmail) headers['X-User-Email'] = userEmail;
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
};

const fetchJSON = async (url, options = {}) => {
  const res = await fetch(url, options);
  let body = null;
  try {
    body = await res.json();
  } catch {
    // ignore – some 204/empty responses
  }
  if (!res.ok) {
    const err = new Error((body && (body.message || body.error)) || `HTTP ${res.status}`);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return body;
};

// ---- business product ------------------------------------------------------
export const getBusinessProduct = async (productId, businessId) => {
  if (!productId || !businessId) throw new Error('Product ID and Business ID are required');
  try {
    const headers = await addAuthHeaders();
    headers['X-Business-ID'] = businessId;

    const url = `${API_BASE_URL}/marketplace/business/${encodeURIComponent(businessId)}/inventory`;
    const data = await fetchJSON(url, { method: 'GET', headers });

    const inventory = data?.inventory || data?.items || data?.data || [];
    // normalize ids & locations up front
    for (const item of inventory) {
      normalizeId(item);
      normalizeLocation(item);
    }

    const pid = String(productId);
    const product = inventory.find((it) => it.id === pid);
    if (!product) {
      const err = new Error('Product not found in business inventory');
      err.status = 404;
      throw err;
    }

    return {
      ...product,
      id: product.id, // normalized
      isBusinessListing: true,
      sellerType: 'business',
      businessId,
    };
  } catch (error) {
    console.error('Error fetching business product:', error);
    throw error;
  }
};

// ---- generic specific product (individual first; fallback to business) -----
export const getSpecificProduct = async (
  productId,
  productType = 'auto',
  businessId = null
) => {
  if (!productId) throw new Error('Product ID is required');

  // Try individual product endpoint first (unless caller forces 'business')
  if (productType !== 'business') {
    try {
      const headers = await addAuthHeaders();
      const url = `${API_BASE_URL}/marketplace/products/specific/${encodeURIComponent(productId)}`;
      const data = await fetchJSON(url, { method: 'GET', headers });

      normalizeId(data);
      normalizeLocation(data);

      return {
        ...data,
        id: data.id,
        isBusinessListing: false,
        sellerType: 'individual',
      };
    } catch (err) {
      // If caller asked for 'auto' and we have a businessId, try business fallback on 404
      if (err?.status === 404 && productType === 'auto' && businessId) {
        return await getBusinessProduct(productId, businessId);
      }
      throw err;
    }
  }

  // Forced business lookup
  if (productType === 'business') {
    if (!businessId) throw new Error('Business ID is required for business product');
    return await getBusinessProduct(productId, businessId);
  }

  // Shouldn’t get here
  const e = new Error('Unable to resolve product');
  e.status = 404;
  throw e;
};

// ---- extra exports ---------------------------------------------------------
export const getBusinessProfile = async (businessId) => {
  if (!businessId) throw new Error('Business ID is required');
  try {
    const headers = await addAuthHeaders();
    const url = `${API_BASE_URL}/get_business_profile/${encodeURIComponent(businessId)}`;
    return await fetchJSON(url, { method: 'GET', headers });
  } catch (error) {
    console.error('Error fetching business profile:', error);
    throw error;
  }
};

export const getBusinessInventory = async (businessId) => {
  if (!businessId) throw new Error('Business ID is required');
  try {
    const headers = await addAuthHeaders();
    headers['X-Business-ID'] = businessId;
    const url = `${API_BASE_URL}/marketplace/business/${encodeURIComponent(businessId)}/inventory`;
    return await fetchJSON(url, { method: 'GET', headers });
  } catch (error) {
    console.error('Error fetching business inventory:', error);
    throw error;
  }
};

export default {
  getBusinessProduct,
  getSpecificProduct,
  getBusinessProfile,
  getBusinessInventory,
};
