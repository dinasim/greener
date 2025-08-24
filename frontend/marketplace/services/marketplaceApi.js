// services/marketplaceApi.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import config from './config';
import {
  addBusinessProfileSync,
  invalidateMarketplaceCache,
} from './BusinessMarketplaceSyncBridge';
import * as FileSystem from 'expo-file-system';

// ----------------------------
const API_BASE_URL = config.API_BASE_URL || 'https://usersfunctions.azurewebsites.net/api';
const businessCache = new Map();
const cacheTimeout = 5 * 60 * 1000;

// Prefer explicit key in config; allow runtime override via AsyncStorage('maptilerKey')
async function getMaptilerKey() {
  const fromCfg =
    config.MAPTILER_KEY ||
    config.maptilerKey ||
    config.MAP_TILER_KEY ||
    config.MAPTILER_TOKEN ||
    '';
  const stored = (await AsyncStorage.getItem('maptilerKey')) || '';
  return (stored || fromCfg || '').trim();
}

// ----------------------------
export const setAuthToken = async (token) => {
  try {
    if (token) {
      await AsyncStorage.setItem('googleAuthToken', token);
    } else {
      await AsyncStorage.removeItem('googleAuthToken');
    }
    return true;
  } catch (error) {
    console.error('❌ Error saving auth token:', error);
    return false;
  }
};

// ----------------------------
async function apiRequest(endpoint, options = {}, retries = 3) {
  try {
    const token = await AsyncStorage.getItem('googleAuthToken');
    const userEmail = await AsyncStorage.getItem('userEmail');
    const userType = await AsyncStorage.getItem('userType');
    const businessId = await AsyncStorage.getItem('businessId');

    const headers = { ...(options.headers || {}) };
    const isFormData = (options.body && typeof options.body.append === 'function');
    if (!isFormData) headers['Content-Type'] = headers['Content-Type'] || 'application/json';
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (userEmail) headers['X-User-Email'] = userEmail;
    if (userType) headers['X-User-Type'] = userType;
    if (businessId) headers['X-Business-ID'] = businessId;

    const url = `${API_BASE_URL}/${endpoint.replace(/^\//, '')}`;
    console.log(`🌐 API Request: ${options.method || 'GET'} ${url}`);

    let lastError = null;
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const response = await fetch(url, { ...options, headers });
        if (!response.ok) {
          let errorData = { error: `Request failed with status ${response.status}` };
          try {
            const text = await response.text();
            if (text) { try { errorData = JSON.parse(text); } catch { errorData = { error: text }; } }
          } catch {}
          lastError = new Error(
            errorData?.error || errorData?.message || errorData?.ExceptionMessage || `Request failed with status ${response.status}`
          );
          lastError.status = response.status; 

          if (response.status >= 400 && response.status < 500) throw lastError; // don't retry 4xx
        } else {
          const text = await response.text();
          const data = text ? JSON.parse(text) : {};
          console.log(`✅ API Success: ${endpoint}`);
          return data;
        }
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        await new Promise((r) => setTimeout(r, delay));
      } catch (err) {
        lastError = err;
        if (err.name === 'TypeError' || (err.message && err.message.toLowerCase().includes('network')) || attempt === retries) {
          break;
        }
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
    throw lastError || new Error(`Request failed: ${endpoint}`);
  } catch (error) {
    console.error(`❌ API request failed (${endpoint}):`, error);
    throw error;
  }
}

// ----------------------------
function sortProducts(products, sortBy) {
  switch (sortBy) {
    case 'recent': return products.sort((a, b) => new Date(b.addedAt) - new Date(a.addedAt));
    case 'priceAsc': return products.sort((a, b) => parseFloat(a.price) - parseFloat(b.price));
    case 'priceDesc': return products.sort((a, b) => parseFloat(b.price) - parseFloat(a.price));
    default: return products;
  }
}

// ----------------------------
// Business endpoints
async function getAllBusinesses() {
  const cacheKey = 'all_businesses';
  const cached = businessCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < cacheTimeout) {
    console.log('📱 Using cached businesses data');
    return cached.data;
  }
  const response = await apiRequest('get-all-businesses');
  const businesses = response.businesses || response.data || response || [];
  businessCache.set(cacheKey, { data: businesses, timestamp: Date.now() });
  console.log(`✅ Loaded ${businesses.length} businesses`);
  return businesses;
}

export async function fetchBusinessInventory(businessId) {
  if (!businessId) throw new Error('Business ID is required');

  try {
    const unifiedCache = await AsyncStorage.getItem('unified_business_inventory');
    if (unifiedCache) {
      const cached = JSON.parse(unifiedCache);
      if (Date.now() - cached.timestamp < 180000 && cached.businessId === businessId) {
        console.log('📱 Using unified cached business inventory');
        return { success: true, inventory: cached.data };
      }
    }
  } catch {}

  const response = await apiRequest(`marketplace/business/${encodeURIComponent(businessId)}/inventory`);

  await AsyncStorage.setItem('unified_business_inventory', JSON.stringify({
    data: response.inventory || response.items || response.data || [],
    businessId,
    timestamp: Date.now(),
    source: 'marketplace',
  }));

  return {
    success: true,
    inventory: response.inventory || response.items || response.data || [],
  };
}

export async function fetchBusinessProfile(businessId) {
  if (!businessId) throw new Error('Business ID is required');

  const CACHE_KEY = `unified_business_profile:${businessId}`; // <-- per business key

  // try cache
  try {
    const cachedStr = await AsyncStorage.getItem(CACHE_KEY);
    if (cachedStr) {
      const cached = JSON.parse(cachedStr);
      if (Date.now() - cached.timestamp < 300000) { // 5 min
        console.log('📱 Using unified cached business profile', businessId);
        return { success: true, business: normalizeBusiness(cached.data) };
      }
    }
  } catch {}

  // fetch fresh
  const response = await apiRequest(`marketplace/business/${encodeURIComponent(businessId)}/profile`);
  const raw = response.business || response.profile || response.data || response || {};
  const normalized = normalizeBusiness(raw);

  try {
    await AsyncStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ data: normalized, businessId, timestamp: Date.now(), source: 'marketplace' })
    );
  } catch {}

  return { success: true, business: normalized };
}


// ----------------------------
// User endpoints
export async function fetchUserProfile(userId) {
  if (!userId) throw new Error('User ID is required');
  return apiRequest(`marketplace/users/${encodeURIComponent(userId)}`);
}

export async function updateUserProfile(userId, userData) {
  const endpoint = `marketplace/users/${userId}`;

  const result = await apiRequest(endpoint, {
    method: 'PATCH',  // Changed from PUT to PATCH
    body: JSON.stringify(userData),
  });

  if (userData.isBusiness || userData.userType === 'business') {
    await addBusinessProfileSync(userData, 'marketplace');
  }
  await invalidateMarketplaceCache([`user_profile_${userId}`, `seller_profile_${userId}`, 'marketplace_plants']);
  return result;
}

export async function fetchSellerProfile(id, type = 'user') {
  if (!id) throw new Error('Seller ID is required');

  try {
    if (type === 'business') {
      const businessRes = await fetchBusinessProfile(id);
      if (businessRes?.success && businessRes.business) {
        return { type: 'business', ...businessRes.business };
      }
    }

    // fallback to user
    const userRes = await fetchUserProfile(id);
    if (userRes?.user) {
      return { type: 'user', ...userRes.user };
    }

    throw new Error('Seller not found');
  } catch (err) {
    console.error('[fetchSellerProfile] error:', err);
    throw err;
  }
}

export const getUserListings  = async (userId, status = 'all') => apiRequest(`marketplace/users/${userId}/listings?status=${status}`);
export const getUserWishlist = async (userId) => {
  const id = userId || (await AsyncStorage.getItem('userEmail'));
  if (!id) throw new Error('User ID (email) is required');

  // Preferred: pretty route (likely if function.json sets "route": "marketplace/users/{id}/wishlist")
  try {
    return await apiRequest(`marketplace/users/${encodeURIComponent(id)}/wishlist`);
  } catch (e) {
    // Fallback: default function-name route (no custom route)
    if ((e.message || '').includes('404')) {
      // Some implementations read X-User-Email header and ignore path params; send both.
      return await apiRequest('user-wishlist', {
        method: 'POST', // or GET in some implementations; try POST first
        body: JSON.stringify({ userId: id }),
      });
    }
    throw e;
  }
};



// ----------------------------
// Images
export function processBusinessProductImages(item, business) {
  const all = [];
  if (item.mainImage) all.push(item.mainImage);
  if (item.image && item.image !== item.mainImage) all.push(item.image);
  (item.images || []).forEach((img) => img && !all.includes(img) && all.push(img));
  (item.imageUrls || []).forEach((img) => img && !all.includes(img) && all.push(img));
  (item.productImages || []).forEach((img) => img && !all.includes(img) && all.push(img));
  const valid = all.filter((img) => img && typeof img === 'string' && (img.startsWith('http') || img.startsWith('data:') || img.startsWith('/') || img.startsWith('./') || img.startsWith('../')));
  return { mainImage: valid[0] || null, images: valid, hasImages: valid.length > 0, imageCount: valid.length, allSources: all };
}
export function processIndividualProductImages(product) {
  const images = [];
  if (product.image) images.push(product.image);
  if (product.mainImage && product.mainImage !== product.image) images.push(product.mainImage);
  (product.images || []).forEach((img) => img && !images.includes(img) && images.push(img));
  const valid = images.filter((img) => img && typeof img === 'string' && (img.startsWith('http') || img.startsWith('data:') || img.startsWith('/')));
  return { mainImage: valid[0] || null, images: valid, hasImages: valid.length > 0 };
}

// ----------------------------
// Product conversion
export function convertInventoryToProducts(inventory, business, category, search) {
  if (!Array.isArray(inventory)) {
    console.warn('⚠️ Inventory is not an array:', inventory);
    return [];
  }

  return inventory
    .filter((item) => {
const status = String(item.status ?? 'active').toLowerCase();
      const qty =
        Number(item.quantity ?? item.availableQuantity ?? item.inventory?.quantity ?? 0);
      if (status !== 'active' || qty <= 0) return false
      if (category && category !== 'All' && category !== 'all') {
        const itemCategory = item.category || item.productType || '';
        const categoryVariations = [category.toLowerCase(), category.toLowerCase().replace(/s$/, ''), `${category.toLowerCase()}s`];
        if (!categoryVariations.some((cat) => itemCategory.toLowerCase().includes(cat))) return false;
      }

      if (search) {
        const searchLower = search.toLowerCase();
        const searchableFields = [
          item.name || '',
          item.common_name || '',
          item.description || '',
          item.notes || '',
          business.businessName || '',
          business.name || '',
          item.category || '',
          item.productType || '',
        ];
        const searchableText = searchableFields.join(' ').toLowerCase();
        const terms = searchLower.split(' ').filter(Boolean);
        if (!terms.every((t) => searchableText.includes(t))) return false;
      }

      return true;
    })
    .map((item) => {
      const processedImages = processBusinessProductImages(item, business);
      const businessLocation = business.location || business.address || {};

      return {
        id: item.id,
        _id: item.id,
        title: item.name || item.common_name || 'Business Product',
        name: item.name || item.common_name || 'Business Product',
        common_name: item.common_name,
        scientific_name: item.scientific_name || item.scientificName,
        description: item.description || item.notes || `${item.name || item.common_name} from ${business.businessName || business.name}`,
        price: item.finalPrice || item.price || 0,
        originalPrice: item.price || 0,
        discount: item.discount || 0,
        category: item.category || item.productType || 'Plants',
        productType: item.productType || 'plant',

        image: processedImages.mainImage,
        mainImage: processedImages.mainImage,
        images: processedImages.images,
        hasImages: processedImages.hasImages,
        imageCount: processedImages.imageCount,

        businessId: business.id || business.email,
        sellerId: business.id || business.email,
        sellerType: 'business',
        isBusinessListing: true,
        inventoryId: item.id,

        seller: {
          _id: business.id || business.email,
          id: business.id || business.email,
          name: business.businessName || business.name || 'Business',
          email: business.email || business.id,
          isBusiness: true,
          businessName: business.businessName || business.name,
          businessType: business.businessType || 'Business',
          rating: business.rating || 0,
          reviewCount: business.reviewCount || 0,
          description: business.description || '',
          phone: business.phone || '',
          website: business.website || '',
          socialMedia: business.socialMedia || {},
          verified: business.verified || false,
          location: {
            city: businessLocation.city || '',
            address: businessLocation.address || '',
            latitude: businessLocation.latitude,
            longitude: businessLocation.longitude,
          },
        },

        location: {
          city: businessLocation.city || '',
          state: businessLocation.state || '',
          country: businessLocation.country || '',
          latitude: businessLocation.latitude,
          longitude: businessLocation.longitude,
          formattedAddress: businessLocation.formattedAddress || businessLocation.address || '',
        },

        specifications: {
          size: item.size || '',
          weight: item.weight || '',
          dimensions: item.dimensions || '',
          material: item.material || '',
          color: item.color || '',
          condition: item.condition || 'new',
          warranty: item.warranty || '',
        },

        inventory: {
          quantity: item.quantity || 0,
          minThreshold: item.minThreshold || 5,
          maxQuantity: item.maxQuantity || item.quantity || 1,
          restockDate: item.restockDate || '',
          supplier: item.supplier || '',
        },

        pricing: {
          basePrice: item.price || 0,
          finalPrice: item.finalPrice || item.price || 0,
          discount: item.discount || 0,
          currency: item.currency || 'ILS',
          negotiable: item.negotiable || false,
          bulkPricing: item.bulkPricing || [],
        },

        addedAt: item.addedAt || item.dateAdded || new Date().toISOString(),
        updatedAt: item.updatedAt || item.lastUpdated || new Date().toISOString(),
        status: 'active',

        stats: {
          views: item.viewCount || 0,
          wishlistCount: item.wishlistCount || 0,
          messageCount: item.messageCount || 0,
          purchaseCount: item.purchaseCount || 0,
          rating: item.rating || 0,
          reviewCount: item.reviewCount || 0,
        },

        tags: item.tags || [],
        keywords: item.keywords || [],
        features: item.features || [],
        benefits: item.benefits || [],

        source: 'business_inventory',
        platform: 'greener',
        lastSync: new Date().toISOString(),
      };
    });
}

// ----------------------------
// Business products aggregator
async function getBusinessProducts(category, search) {
  const cacheKey = `business_products_${category || 'all'}_${search || 'none'}`;
  const cached = businessCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < cacheTimeout) return cached.data;

  const businesses = await getAllBusinesses();
  if (!businesses.length) throw new Error('No businesses found');

  console.log(`🏢 Processing ${businesses.length} businesses for products...`);
  const businessPromises = businesses.map(async (business) => {
    const businessId = business.id || business.email;
    let businessProfile = business;
    let inventory = [];
    try {
      const profileResponse = await fetchBusinessProfile(businessId);
      if (profileResponse?.success && profileResponse.business) {
        businessProfile = { ...business, ...profileResponse.business };
        if (Array.isArray(profileResponse.inventory)) {
          inventory = profileResponse.inventory;
        }
      }
    } catch (e) {
      console.warn(`⚠️ Profile endpoint failed for ${businessId}:`, e?.message);
    }
    if (!inventory.length) {
      const invResp = await fetchBusinessInventory(businessId);
      if (invResp?.success && Array.isArray(invResp.inventory)) {
        inventory = invResp.inventory;
      } else if (Array.isArray(invResp)) {
        inventory = invResp;
      }
    }
    console.log(`📦 Business ${businessProfile.businessName || businessProfile.name}: ${inventory.length} items`);
    return convertInventoryToProducts(inventory, businessProfile, category, search);
  });

  const allBusinessProducts = (await Promise.all(businessPromises)).flat();
  console.log(`✅ Total business products: ${allBusinessProducts.length}`);
  businessCache.set(cacheKey, { data: allBusinessProducts, timestamp: Date.now() });
  return allBusinessProducts;
}

// ----------------------------
// Individual products
async function getIndividualProducts(page, category, search, options) {
  const queryParams = new URLSearchParams();
  queryParams.append('page', page);
  if (category && category !== 'All' && category !== 'all') queryParams.append('category', category);
  if (search) queryParams.append('search', search);
  if (options.minPrice !== undefined) queryParams.append('minPrice', options.minPrice);
  if (options.maxPrice !== undefined) queryParams.append('maxPrice', options.maxPrice);
  if (options.sortBy) queryParams.append('sortBy', options.sortBy);
  return apiRequest(`marketplace-products?${queryParams.toString()}`);
}

// ----------------------------
// Marketplace: getAll
export async function getAll(page = 1, category = null, search = null, options = {}) {
  console.log('🛒 Loading marketplace...', { page, category, search, sellerType: options.sellerType });

  let products = [];
  let paginationInfo = { page: 1, pages: 1, count: 0 };

  if (options.sellerType === 'individual') {
    const data = await getIndividualProducts(page, category, search, options);
    const individualProducts = (data.products || []).map((p) => ({
      ...p, sellerType: 'individual', isBusinessListing: false, seller: { ...(p.seller || {}), isBusiness: false },
    }));
    products = individualProducts;
    paginationInfo = { page: data.page || page, pages: data.pages || 1, count: data.count || products.length };
  } else if (options.sellerType === 'business') {
    const businessProducts = await getBusinessProducts(category, search);
    const pageSize = 20;
    const totalItems = businessProducts.length;
    const startIndex = (page - 1) * pageSize;
    products = businessProducts.slice(startIndex, startIndex + pageSize);
    paginationInfo = { page, pages: Math.ceil(totalItems / pageSize), count: totalItems };
  } else {
    const [individualData, businessProducts] = await Promise.all([
      getIndividualProducts(page, category, search, options),
      getBusinessProducts(category, search),
    ]);
    const individualProducts = (individualData.products || []).map((p) => ({
      ...p, sellerType: 'individual', isBusinessListing: false, seller: { ...(p.seller || {}), isBusiness: false },
    }));
    products = [...individualProducts, ...businessProducts];
    paginationInfo = {
      page: individualData.page || page,
      pages: Math.max(individualData.pages || 1, Math.ceil(products.length / 20)),
      count: products.length,
    };
  }

  if (options.minPrice !== undefined || options.maxPrice !== undefined) {
    products = products.filter((product) => {
      const price = parseFloat(product.price || 0);
      if (options.minPrice !== undefined && price < options.minPrice) return false;
      if (options.maxPrice !== undefined && price > options.maxPrice) return false;
      return true;
    });
  }

  if (options.sortBy) {
    products = sortProducts(products, options.sortBy);
  } else {
    products.sort((a, b) => new Date(b.addedAt || b.listedDate || 0) - new Date(a.addedAt || a.listedDate || 0));
  }

  console.log(`✅ Returning ${products.length} products`);
  return { products, page: paginationInfo.page, pages: paginationInfo.pages, count: paginationInfo.count, currentPage: page, filters: { category, search, ...options } };
}

// ----------------------------
// Product CRUD / misc
export async function getSpecific(productId) {
  if (!productId) throw new Error('Product ID is required');
  try {
    const response = await apiRequest(`marketplace/products/specific/${encodeURIComponent(productId)}`);
    if (response?.product) {
      const processed = processIndividualProducts([response.product]);
      return processed[0];
    }
    // Graceful miss – business inventory or deleted item
    return null;
  } catch (e) {
    // Treat 404/“not found” as a soft miss
    return null;
  }
}
export const updateProductPrice = async (productId, newPrice) => {
  if (!productId) throw new Error('Product ID is required');
  const price = Number(newPrice);
  if (!Number.isFinite(price) || price < 0) throw new Error('Invalid price');

  // Preferred: price patch endpoint
  try {
    return await apiRequest(`marketplace/products/${encodeURIComponent(productId)}/price`, {
      method: 'PATCH',
      body: JSON.stringify({ price }),
    });
  } catch (e) {
    // Fallback: generic update if your backend only supports PUT /marketplace/products/{id}
    return apiRequest(`marketplace/products/${encodeURIComponent(productId)}`, {
      method: 'PUT',
      body: JSON.stringify({ price }),
    });
  }
};

export const wishProduct = async (productId) => {
  if (!productId) throw new Error('Product ID is required');

  // Optional: include user for backends that read from body as well
  const userEmail = await AsyncStorage.getItem('userEmail');

  // Matches function.json: "route": "marketplace/products/wish/{id}"
  return apiRequest(`marketplace/products/wish/${encodeURIComponent(productId)}`, {
    method: 'POST',
    body: JSON.stringify(userEmail ? { userId: userEmail } : {}),
  });
};




export const createProduct = async (productData) => {
  if (!productData) throw new Error('Product data is required');
  return apiRequest('marketplace/products/create', {
    method: 'POST',
    body: JSON.stringify(productData),
  });
};

export const createPlant = async (plantData) => createProduct(plantData);

export const updateProduct = async (productId, productData) => {
  if (!productId || !productData) throw new Error('Product ID and data are required');
  return apiRequest(`marketplace/products/${productId}`, {
    method: 'PUT',
    body: JSON.stringify(productData),
  });
};

export const deleteProduct = async (productId) => {
  if (!productId) throw new Error('Product ID is required');
  return apiRequest(`marketplace/products/${productId}`, { method: 'DELETE' });
};

export const markAsSold = async (productId, { buyerId = null, notes = '' } = {}) => {
 if (!productId) throw new Error('Product ID is required');
 return apiRequest(`marketplace/products/${encodeURIComponent(productId)}/sold`, {
      method: 'POST',
       body: JSON.stringify({ buyerId, notes })
  });
};

export const clearMarketplaceCache = () => {
  businessCache.clear();
  console.log('🧹 Marketplace cache cleared');
};

// ----------------------------
// Image/audio upload

// Enhanced file format detection
const detectFileFormat = async (fileUri) => {
  try {
    const fileInfo = await FileSystem.getInfoAsync(fileUri);
    if (!fileInfo.exists) return null;

    // Read file header for magic number detection
    const headerBase64 = await FileSystem.readAsStringAsync(fileUri, {
      encoding: FileSystem.EncodingType.Base64,
      length: 64,
      position: 0,
    });
    
    const headerBytes = atob(headerBase64);
    
    // Detect various audio formats
    if (headerBytes.includes('#!AMR') || headerBytes.includes('#!AMR-WB')) {
      return { format: 'audio/3gpp', extension: '.3gp', supported: false };
    }
    
    if (headerBytes.includes('ftyp')) {
      if (headerBytes.includes('3gp')) {
        return { format: 'audio/3gpp', extension: '.3gp', supported: false };
      }
      if (headerBytes.includes('M4A') || headerBytes.includes('isom') || headerBytes.includes('mp42')) {
        return { format: 'audio/mp4', extension: '.m4a', supported: true };
      }
    }
    
    if (headerBytes.startsWith('RIFF') && headerBytes.includes('WAVE')) {
      return { format: 'audio/wav', extension: '.wav', supported: true };
    }
    
    if (headerBytes.startsWith('ID3') || headerBytes.startsWith('\xff\xfb')) {
      return { format: 'audio/mpeg', extension: '.mp3', supported: true };
    }
    
    // Default to M4A if no clear detection
    return { format: 'audio/mp4', extension: '.m4a', supported: true };
  } catch (error) {
    console.warn('File format detection failed:', error);
    return { format: 'audio/mp4', extension: '.m4a', supported: true };
  }
};

export async function uploadImage(fileUri, fileType = 'speech') {
  try {
    console.log(`[uploadImage] Starting upload: ${fileUri}, type: ${fileType}`);
    
    let filename, contentType;
    
    if (fileType === 'speech') {
      // Detect the actual file format
      const formatInfo = await detectFileFormat(fileUri);
      
      if (!formatInfo.supported) {
        console.warn(`[uploadImage] Unsupported format detected: ${formatInfo.format}`);
        // The server will handle transcoding, but warn the user
      }
      
      filename = `speech_${Date.now()}${formatInfo.extension}`;
      contentType = formatInfo.format;
      
      console.log(`[uploadImage] Detected format: ${contentType}, filename: ${filename}`);
    } else {
      // For non-speech files, use original logic
      filename = fileUri.split('/').pop() || `file_${Date.now()}`;
      contentType = 'application/octet-stream';
    }

    // Read the file and send JSON (base64)
    const base64 = await FileSystem.readAsStringAsync(fileUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    const payload = {
      file: base64,
      type: fileType,
      filename,
      contentType,
    };

    // Try upload endpoints
    const candidates = [
      `${API_BASE_URL}/marketplace/uploadImage`,
    ];

    let lastErrText = '';
    for (const url of candidates) {
      try {
        console.log(`[uploadImage] Trying endpoint: ${url}`);
        const resp = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const text = await resp.text();
        if (!resp.ok) {
          lastErrText = `HTTP ${resp.status} ${text || ''}`;
          console.warn(`[uploadImage] ${url} failed -> ${lastErrText}`);
          continue;
        }
        
        const result = text ? JSON.parse(text) : {};
        console.log(`[uploadImage] Success:`, result);
        return result;
      } catch (e) {
        lastErrText = String(e?.message || e);
        console.warn(`[uploadImage] ${url} network error -> ${lastErrText}`);
      }
    }
    throw new Error(`Upload failed: ${lastErrText || 'no endpoint succeeded'}`);
  } catch (err) {
    console.error('❌ uploadImage error:', err);
    throw err;
  }
}

// Convenience wrapper for audio uploads
export async function uploadAudio(file, contentType = (Platform.OS === 'web' ? 'audio/wav' : 'audio/mp4')) {
  return uploadImage(file, 'speech', contentType);
}

// ----------------------------
// STT
export async function getSpeechToken() {
  const API_BASE_URL = 'https://usersfunctions.azurewebsites.net/api';
  const region = 'eastus'; // or read from config
  const r = await fetch(`${API_BASE_URL}/speechToken?region=${region}`);
  if (!r.ok) {
    const t = await r.text();
    const err = new Error(`speechToken failed: ${r.status}`);
    err.status = r.status;
    err.body = t;
    throw err;
  }
  return r.json();
}

export async function fetchSpeechToken() {
  const API_BASE_URL = 'https://usersfunctions.azurewebsites.net/api';
  const r = await fetch(`${API_BASE_URL}/speechToken`);
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`speechToken failed: ${r.status} ${t}`);
  }
  return r.json(); // { token, region, expiresAt }
}

// Full response (text, status, confidence, debug if server returns it)
export const speechToTextRaw = async (audioUrl, language = 'en-US') => {
  if (!audioUrl) throw new Error('Audio URL is required');
  console.log(`[speechToTextRaw] Transcribing: ${audioUrl} (${language})`);
  
  try {
    const result = await apiRequest('marketplace/speechtotext', {
      method: 'POST',
      body: JSON.stringify({ audioUrl, language })
    });
    
    console.log(`[speechToTextRaw] Result:`, result);
    return result;
  } catch (error) {
    console.error(`[speechToTextRaw] Error:`, error);
    throw error;
  }
};

// Backward-compatible helper: returns cleaned text string only
export const speechToText = async (audioUrl, language = 'en-US') => {
  try {
    const res = await speechToTextRaw(audioUrl, language);
    const text = res?.text || '';
    const cleaned = text.replace(/[.,!?;:'"()\[\]{}]/g, '').replace(/\s+/g, ' ').trim();
    console.log(`[speechToText] Cleaned result: "${cleaned}"`);
    return cleaned;
  } catch (error) {
    console.error(`[speechToText] Error:`, error);
    return '';
  }
};

// ----------------------------
// Business purchase
// services/marketplaceApi.js
export async function purchaseBusinessProduct(productId, businessId, quantity = 1, customerInfo) {
  const body = {
    businessId,
    customerEmail: customerInfo.email,
    customerName: customerInfo.name,
    customerPhone: customerInfo.phone || '',
    items: [{ id: productId, quantity: Number(quantity) }],
    notes: customerInfo.notes || '',
    communicationPreference: 'messages',
  };

  // Primary: correct route per your function.json
  try {
    return await apiRequest('business/orders/create', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  } catch (err) {
    throw err;
  }
}


// ----------------------------
// Location & Maps

// CLIENT-SIDE geocode via MapTiler (no server call)
export async function geocodeAddress(address) {
  if (!address) throw new Error('Address is required');

  const bad = new Set([
    'contact for location', 'unknown', 'n/a', 'na', 'none', 'לא זמין', '—', '-', ''
  ]);
  const norm = String(address).trim().toLowerCase();
  if (!norm || bad.has(norm)) {
    return { latitude: null, longitude: null, skipped: true };
  }

  const cacheKey = `geocode_cache_v1:${norm}`;
  try {
    const cached = await AsyncStorage.getItem(cacheKey);
    if (cached) {
      const obj = JSON.parse(cached);
      // 30 days cache
      if (Date.now() - (obj.timestamp || 0) < 30 * 24 * 60 * 60 * 1000) {
        return obj.result;
      }
    }
  } catch {}

  const key = await getMaptilerKey();
  if (!key) {
    console.warn('[geocodeAddress] Missing MapTiler key');
    return { latitude: null, longitude: null, noKey: true };
  }

  const url = `https://api.maptiler.com/geocoding/${encodeURIComponent(address)}.json?limit=1&key=${encodeURIComponent(key)}`;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      // Treat 404 as not-found without throwing
      if (res.status === 404) return { latitude: null, longitude: null, notFound: true };
      throw new Error(`Geocoding failed (${res.status})`);
    }
    const data = await res.json();
    const feat = data?.features?.[0];
    if (!feat?.center?.length) return { latitude: null, longitude: null, notFound: true };
    const [lon, lat] = feat.center;
    const result = {
      latitude: Number(lat),
      longitude: Number(lon),
      formattedAddress: feat.place_name || address,
      source: 'maptiler',
    };
    try {
      await AsyncStorage.setItem(cacheKey, JSON.stringify({ timestamp: Date.now(), result }));
    } catch {}
    return result;
  } catch (e) {
    console.warn('[geocodeAddress] error:', e?.message || String(e));
    return { latitude: null, longitude: null, error: true };
  }
}

export async function reverseGeocode(latitude, longitude) {
  if (typeof latitude !== 'number' || typeof longitude !== 'number') {
    throw new Error('Valid coordinates required');
  }
  const key = await getMaptilerKey();
  if (!key) return { address: '', noKey: true };

  const url = `https://api.maptiler.com/geocoding/${longitude},${latitude}.json?limit=1&key=${encodeURIComponent(key)}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return { address: '', notFound: res.status === 404 };
    const data = await res.json();
    const place = data?.features?.[0]?.place_name || '';
    return { address: place };
  } catch {
    return { address: '' };
  }
}

// Safe fallback: don't throw if backend is down; return empty result instead
export async function getNearbyProducts(latitude, longitude, radius = 10, category = null) {
  const latNum = Number(latitude);
  const lonNum = Number(longitude);
  const radNum = Number(radius);
  if (!Number.isFinite(latNum) || !Number.isFinite(lonNum)) throw new Error('Valid coordinates required');
  const r = Number.isFinite(radNum) ? radNum : 10;
  let query = `lat=${latNum}&lon=${lonNum}&radius=${r}`;
  if (category && category !== 'All') query += `&category=${encodeURIComponent(category)}`;
  try {
    return await apiRequest(`marketplace/nearbyProducts?${query}`);
  } catch (e) {
    console.warn('⚠️ nearbyProducts unavailable, returning empty set:', e?.message || e);
    return {
      products: [],
      count: 0,
      center: { latitude: latNum, longitude: lonNum },
      radius: r,
      fallback: true,
    };
  }
}

export async function getNearbyBusinesses(latitude, longitude, radius = 10, businessType = null) {
  const latNum = Number(latitude);
  const lonNum = Number(longitude);
  const radNum = Number(radius);
  if (!Number.isFinite(latNum) || !Number.isFinite(lonNum)) throw new Error('Valid coordinates required');
  const r = Number.isFinite(radNum) ? radNum : 10;
  let query = `lat=${latNum}&lon=${lonNum}&radius=${r}`;
  if (businessType && businessType !== 'all') query += `&businessType=${encodeURIComponent(businessType)}`;
  return apiRequest(`marketplace/nearby-businesses?${query}`);
}

// ----------------------------
// Messaging
export const getNegotiateToken = async () => {
  const userEmail = await AsyncStorage.getItem('userEmail');
  if (!userEmail) throw new Error('User email is required for messaging');
  return apiRequest('marketplace/signalr-negotiate', {
    method: 'POST',
    body: JSON.stringify({ userId: userEmail }),
  });
};

export const fetchConversations = async (/* userId */) => {
  // If your function expects the user from header, no param is needed
  return apiRequest('conversations');
};

export const fetchMessages = async (chatId /*, userId */) => {
  if (!chatId) throw new Error('Chat ID is required');
  return apiRequest(`marketplace/messages/getMessages/${encodeURIComponent(chatId)}`);
};

export const sendMessage = async (chatId, message, senderId) => {
  if (!chatId || !message) throw new Error('Chat ID and message are required');
  return apiRequest('marketplace/messages/sendMessage', {
    method: 'POST',
    body: JSON.stringify({ chatId, message, senderId }),
  });
};

export const startConversation = async (sellerId, plantId, message, sender) => {
  if (!sellerId || !message || !sender) throw new Error('Seller ID, message, and sender are required');
  return apiRequest('marketplace/messages/createChatRoom', {
    method: 'POST',
    body: JSON.stringify({ receiver: sellerId, plantId, message, sender }),
  });
};

export const markMessagesAsRead = async (conversationId, messageIds = []) => {
  if (!conversationId) throw new Error('Conversation ID is required');
  return apiRequest('marketplace/messages/markAsRead', { method: 'POST', body: JSON.stringify({ conversationId, messageIds }) });
};

export const sendTypingIndicator = async (conversationId, isTyping) => {
  if (!conversationId) throw new Error('Conversation ID is required');
  return apiRequest('marketplace/messages/typing', { method: 'POST', body: JSON.stringify({ conversationId, isTyping }) });
};

export const sendOrderMessage = async (recipientId, message, senderId, context = {}) => {
  if (!recipientId || !message || !senderId) throw new Error('recipientId, message, and senderId are required');
  try {
    const conversations = await fetchConversations(senderId);
    let conversation = null;
    if (Array.isArray(conversations)) {
      conversation = conversations.find((conv) =>
        conv.sellerId === recipientId || conv.otherUserEmail === recipientId || conv.otherUserId === recipientId
      );
    }
    if (conversation) return sendMessage(conversation.id, message, senderId);
    return startConversation(recipientId, context?.orderId || null, message, senderId);
  } catch {
    return startConversation(recipientId, context?.orderId || null, message, senderId);
  }
};

// ----------------------------
// Reviews

// GET reviews (this already matches your working fetch path)
export const fetchReviews = async (targetType, targetId) => {
  if (!targetType || !targetId) throw new Error('Target type and ID are required');
  return apiRequest(
    `marketplace/reviews/${encodeURIComponent(targetType)}/${encodeURIComponent(targetId)}`
  );
};

/**
 * Submit a review.
 * Supports both signatures:
 * 1) submitReview(targetId, targetType, { rating, text|comment, ... })
 * 2) submitReview({ targetId, targetType, rating, text|comment, ... })
 */
export const submitReview = async (...args) => {
  let targetId, targetType, reviewData;
  if (typeof args[0] === 'object' && args[0] !== null && !args[1]) {
    ({ targetId, targetType, ...reviewData } = args[0]);
  } else {
    [targetId, targetType, reviewData] = args;
  }

  if (!targetId || !targetType || !reviewData) {
    throw new Error('Target ID, type, and review data are required');
  }

  const rating = Number(reviewData.rating);
  const commentStr = (reviewData.comment ?? reviewData.text ?? '').toString().trim();

  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    throw new Error('Rating is required (1–5)');
  }
  if (!commentStr) {
    throw new Error('Review text/comment is required');
  }

  const userEmail = (await AsyncStorage.getItem('userEmail')) || undefined;

  const payload = {
    targetId,
    targetType,
    rating,
    text: commentStr,  // Changed from 'comment' to 'text'
    userId: userEmail,
  };
  const endpoint = `submitreview/${encodeURIComponent(targetType)}/${encodeURIComponent(targetId)}`;
  
  return await apiRequest(endpoint, { 
    method: 'POST', 
    body: JSON.stringify(payload) 
  });
};


export const deleteReview = async (targetType, targetId, reviewId) => {
  if (!targetType || !targetId || !reviewId) {
    throw new Error('Target type, target ID, and review ID are required');
  }
  try {
    return await apiRequest('marketplace/reviews/delete', {
      method: 'DELETE',
      body: JSON.stringify({ targetType, targetId, reviewId }),
    });
  } catch (err) {
    if (/404|not found/i.test(String(err?.message || ''))) {
      return apiRequest('reviews-delete', {
        method: 'DELETE',
        body: JSON.stringify({ targetType, targetId, reviewId }),
      });
    }
    throw err;
  }
};

// ----------------------------
// Utilities
export const getAzureMapsKey = async () => {
  const response = await apiRequest('maps-config');
  if (!response.azureMapsKey && !response.subscriptionKey) throw new Error('No Azure Maps key returned from server');
  return response.azureMapsKey || response.subscriptionKey;
};

const normalizeBusiness = (b = {}) => {
  const addr = b.address || {};
  const loc  = b.location || {};
  const mergedAddress = {
    ...addr,
    latitude:  addr.latitude  ?? loc.latitude,
    longitude: addr.longitude ?? loc.longitude,
    formattedAddress: addr.formattedAddress || addr.street || loc.formattedAddress || ''
  };
  const mergedLocation = {
    latitude:  loc.latitude  ?? addr.latitude,
    longitude: loc.longitude ?? addr.longitude,
    city:   addr.city    || loc.city    || '',
    country:addr.country || loc.country || '',
    formattedAddress: mergedAddress.formattedAddress
  };
  return { ...b, address: mergedAddress, location: mergedLocation };
};

// ----------------------------
// Transform helpers
export function processIndividualProducts(products) {
  if (!Array.isArray(products)) {
    console.warn('⚠️ Products is not an array:', products);
    return [];
  }
  return products.map((product) => {
    const processedImages = processIndividualProductImages(product);
    return {
      ...product,
      image: processedImages.mainImage,
      mainImage: processedImages.mainImage,
      images: processedImages.images,
      hasImages: processedImages.hasImages,
      sellerType: 'individual',
      isBusinessListing: false,
      seller: { ...(product.seller || {}), isBusiness: false },
      location: {
        ...(product.location || {}),
        formattedAddress: product.location?.address || product.location?.city || '',
      },
      stats: {
        views: product.views || 0,
        wishlistCount: product.wishlistCount || 0,
        messageCount: product.messageCount || 0,
        ...(product.stats || {}),
      },
      source: 'individual_listing',
      platform: 'greener',
      lastSync: new Date().toISOString(),
    };
  });
}

// ----------------------------
// Default export
export default {
  // Core marketplace
  getAll,
  getSpecific,
  createProduct,
  createPlant,
  updateProduct,
  deleteProduct,
  markAsSold,
  wishProduct,
  updateProductPrice,

  // User
  fetchUserProfile,
  updateUserProfile,
  getUserListings,
  getUserWishlist,

  // Business
  getAllBusinesses,
  fetchBusinessProfile,
  fetchBusinessInventory,
  purchaseBusinessProduct,
  getSpeechToken,
  // Location
  getNearbyProducts,
  getNearbyBusinesses,
  geocodeAddress,
  reverseGeocode,

  // Messaging
  getNegotiateToken,
  fetchConversations,
  fetchMessages,
  sendMessage,
  startConversation,
  markMessagesAsRead,
  sendTypingIndicator,
  sendOrderMessage,

  // Reviews
  fetchReviews,
  submitReview,
  deleteReview,

  // Images / Audio
  uploadImage,
  uploadAudio,

  // Utils
  getAzureMapsKey,
  speechToTextRaw,
  speechToText,
  // cache helpers
  clearMarketplaceCache: () => { businessCache.clear(); console.log('🧹 Marketplace cache cleared'); },

  // Helpers
  processBusinessProductImages,
  processIndividualProductImages,
  convertInventoryToProducts,
  processIndividualProducts,
};