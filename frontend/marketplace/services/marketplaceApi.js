// services/marketplaceApi.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import config from './config';
import syncBridge, {
  addBusinessProfileSync,
  addInventorySync,
  invalidateMarketplaceCache,
} from './BusinessMarketplaceSyncBridge';

// ----------------------------
// Base URL & simple caches
// ----------------------------
const API_BASE_URL =
  config.API_BASE_URL || 'https://usersfunctions.azurewebsites.net/api';

const businessCache = new Map();
const cacheTimeout = 5 * 60 * 1000; // 5 minutes

// ----------------------------
// Auth token storage
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
// Generic API requester
// ----------------------------
async function apiRequest(endpoint, options = {}, retries = 3) {
  try {
    const token = await AsyncStorage.getItem('googleAuthToken');
    const userEmail = await AsyncStorage.getItem('userEmail');
    const userType = await AsyncStorage.getItem('userType');
    const businessId = await AsyncStorage.getItem('businessId');

    const headers = {
      ...(options.headers || {}),
    };

    // Only set JSON header if body is not FormData
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
        const response = await fetch(url, {
          ...options,
          headers,
        });

        if (!response.ok) {
          console.error(`❌ API Error ${response.status}:`, response.statusText);

          let errorData = { error: `Request failed with status ${response.status}` };
          try {
            const text = await response.text();
            if (text) {
              try { errorData = JSON.parse(text); } catch { errorData = { error: text }; }
            }
          } catch {}

          lastError = new Error(
            errorData?.error ||
              errorData?.message ||
              errorData?.ExceptionMessage ||
              `Request failed with status ${response.status}`
          );

          // Do not retry 4xx
          if (response.status >= 400 && response.status < 500) throw lastError;
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
        if (
          err.name === 'TypeError' ||
          (err.message && err.message.toLowerCase().includes('network')) ||
          attempt === retries
        ) {
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
// Helpers
// ----------------------------
export function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function sortProducts(products, sortBy) {
  switch (sortBy) {
    case 'recent':
      return products.sort(
        (a, b) => new Date(b.addedAt) - new Date(a.addedAt)
      );
    case 'priceAsc':
      return products.sort(
        (a, b) => parseFloat(a.price) - parseFloat(b.price)
      );
    case 'priceDesc':
      return products.sort(
        (a, b) => parseFloat(b.price) - parseFloat(a.price)
      );
    default:
      return products;
  }
}

// ----------------------------
// Business endpoints
// ----------------------------
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

  // unified cache
  try {
    const unifiedCache = await AsyncStorage.getItem(
      'unified_business_inventory'
    );
    if (unifiedCache) {
      const cached = JSON.parse(unifiedCache);
      if (
        Date.now() - cached.timestamp < 180000 &&
        cached.businessId === businessId
      ) {
        console.log('📱 Using unified cached business inventory');
        return { success: true, inventory: cached.data };
      }
    }
  } catch {}

  const response = await apiRequest(
    `marketplace/business/${encodeURIComponent(businessId)}/inventory`
  );

  await AsyncStorage.setItem(
    'unified_business_inventory',
    JSON.stringify({
      data: response.inventory || response.items || response.data || [],
      businessId,
      timestamp: Date.now(),
      source: 'marketplace',
    })
  );

  return {
    success: true,
    inventory: response.inventory || response.items || response.data || [],
  };
}

export async function fetchBusinessProfile(businessId) {
  if (!businessId) throw new Error('Business ID is required');

  try {
    const unifiedCache = await AsyncStorage.getItem('unified_business_profile');
    if (unifiedCache) {
      const cached = JSON.parse(unifiedCache);
      if (Date.now() - cached.timestamp < 300000) {
        console.log('📱 Using unified cached business profile');
        return { success: true, business: cached.data };
      }
    }
  } catch {}

  const response = await apiRequest(
    `marketplace/business/${encodeURIComponent(businessId)}/profile`
  );

  await AsyncStorage.setItem(
    'unified_business_profile',
    JSON.stringify({
      data: response.business || response.profile || response.data || response,
      timestamp: Date.now(),
      source: 'marketplace',
    })
  );

  return {
    success: true,
    business: response.business || response.profile || response.data || response,
  };
}

// ----------------------------
// User endpoints
// ----------------------------
export async function fetchUserProfile(userId) {
  if (!userId) throw new Error('User ID is required');
  return apiRequest(`marketplace/users/${encodeURIComponent(userId)}`);
}

export async function updateUserProfile(userId, userData) {
  const endpoint = `marketplace/users/${userId}`;

  const result = await apiRequest(endpoint, {
    method: 'PUT',
    body: JSON.stringify(userData),
  });

  if (userData.isBusiness || userData.userType === 'business') {
    await addBusinessProfileSync(userData, 'marketplace');
  }

  await invalidateMarketplaceCache([
    `user_profile_${userId}`,
    `seller_profile_${userId}`,
    'marketplace_plants',
  ]);

  return result;
}

export const getUserListings = async (userId, status = 'all') =>
  apiRequest(`marketplace/users/${userId}/listings?status=${status}`);

export const getUserWishlist = async (userId) =>
  apiRequest(`marketplace/users/${userId}/wishlist`);

// ----------------------------
// Image processing helpers
// ----------------------------
export function processBusinessProductImages(item, business) {
  const allImageSources = [];

  if (item.mainImage) allImageSources.push(item.mainImage);
  if (item.image && item.image !== item.mainImage) allImageSources.push(item.image);

  if (Array.isArray(item.images)) {
    item.images.forEach((img) => img && !allImageSources.includes(img) && allImageSources.push(img));
  }
  if (Array.isArray(item.imageUrls)) {
    item.imageUrls.forEach((img) => img && !allImageSources.includes(img) && allImageSources.push(img));
  }
  if (Array.isArray(item.productImages)) {
    item.productImages.forEach((img) => img && !allImageSources.includes(img) && allImageSources.push(img));
  }

  const validImages = allImageSources.filter((img) => {
    if (!img || typeof img !== 'string') return false;
    if (img.startsWith('http://') || img.startsWith('https://')) return true;
    if (img.startsWith('data:image/')) return true;
    if (img.startsWith('/') || img.startsWith('./') || img.startsWith('../')) return true;
    return false;
  });

  return {
    mainImage: validImages[0] || null,
    images: validImages,
    hasImages: validImages.length > 0,
    imageCount: validImages.length,
    allSources: allImageSources,
  };
}

export function processIndividualProductImages(product) {
  const images = [];
  if (product.image) images.push(product.image);
  if (product.mainImage && product.mainImage !== product.image)
    images.push(product.mainImage);
  if (Array.isArray(product.images)) {
    product.images.forEach((img) => img && !images.includes(img) && images.push(img));
  }
  const validImages = images.filter(
    (img) =>
      img &&
      typeof img === 'string' &&
      (img.startsWith('http') || img.startsWith('data:') || img.startsWith('/'))
  );
  return {
    mainImage: validImages[0] || null,
    images: validImages,
    hasImages: validImages.length > 0,
  };
}

function processProductImages(item) {
  const images = [];
  if (item.mainImage) images.push(item.mainImage);
  if (item.image && item.image !== item.mainImage) images.push(item.image);
  if (Array.isArray(item.images)) {
    item.images.forEach((img) => img && !images.includes(img) && images.push(img));
  }
  if (Array.isArray(item.imageUrls)) {
    item.imageUrls.forEach((img) => img && !images.includes(img) && images.push(img));
  }
  const validImages = images.filter(
    (img) => img && typeof img === 'string' && (img.startsWith('http') || img.startsWith('data:'))
  );
  return {
    mainImage: validImages[0] || null,
    images: validImages,
    hasImages: validImages.length > 0,
  };
}

// ----------------------------
// Product conversion
// ----------------------------
export function convertInventoryToProducts(inventory, business, category, search) {
  if (!Array.isArray(inventory)) {
    console.warn('⚠️ Inventory is not an array:', inventory);
    return [];
  }

  return inventory
    .filter((item) => {
      if (item.status !== 'active' || (item.quantity || 0) <= 0) return false;

      if (category && category !== 'All' && category !== 'all') {
        const itemCategory = item.category || item.productType || '';
        const categoryVariations = [
          category.toLowerCase(),
          category.toLowerCase().replace(/s$/, ''),
          `${category.toLowerCase()}s`,
        ];
        if (
          !categoryVariations.some((cat) =>
            itemCategory.toLowerCase().includes(cat)
          )
        ) {
          return false;
        }
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
      const businessLocation = business.address || business.location || {};

      return {
        id: item.id,
        _id: item.id,
        title: item.name || item.common_name || 'Business Product',
        name: item.name || item.common_name || 'Business Product',
        common_name: item.common_name,
        scientific_name: item.scientific_name || item.scientificName,
        description:
          item.description ||
          item.notes ||
          `${item.name || item.common_name} from ${
            business.businessName || business.name
          }`,
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
            city: businessLocation.city || 'Contact for location',
            address: businessLocation.address || '',
            latitude: businessLocation.latitude,
            longitude: businessLocation.longitude,
          },
        },

        location: {
          city: businessLocation.city || 'Contact for location',
          state: businessLocation.state || '',
          country: businessLocation.country || '',
          latitude: businessLocation.latitude,
          longitude: businessLocation.longitude,
          formattedAddress:
            businessLocation.formattedAddress || businessLocation.address || '',
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
// Business products aggregator (DECLARATION -> hoisted)
// ----------------------------
async function getBusinessProducts(category, search) {
  const cacheKey = `business_products_${category || 'all'}_${search || 'none'}`;
  const cached = businessCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < cacheTimeout) {
    return cached.data;
  }

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
    } catch (profileError) {
      console.warn(
        `⚠️ Profile endpoint failed for ${businessId}:`,
        profileError?.message
      );
    }

    if (!inventory.length) {
      const invResp = await fetchBusinessInventory(businessId);
      if (invResp?.success && Array.isArray(invResp.inventory)) {
        inventory = invResp.inventory;
      } else if (Array.isArray(invResp)) {
        inventory = invResp;
      }
    }

    console.log(
      `📦 Business ${businessProfile.businessName || businessProfile.name}: ${
        inventory.length
      } items`
    );

    return convertInventoryToProducts(inventory, businessProfile, category, search);
  });

  const businessProductArrays = await Promise.all(businessPromises);
  const allBusinessProducts = businessProductArrays.flat();

  console.log(`✅ Total business products: ${allBusinessProducts.length}`);

  businessCache.set(cacheKey, { data: allBusinessProducts, timestamp: Date.now() });
  return allBusinessProducts;
}

// ----------------------------
// Individual products
// ----------------------------
async function getIndividualProducts(page, category, search, options) {
  const queryParams = new URLSearchParams();
  queryParams.append('page', page);
  if (category && category !== 'All' && category !== 'all')
    queryParams.append('category', category);
  if (search) queryParams.append('search', search);
  if (options.minPrice !== undefined) queryParams.append('minPrice', options.minPrice);
  if (options.maxPrice !== undefined) queryParams.append('maxPrice', options.maxPrice);
  if (options.sortBy) queryParams.append('sortBy', options.sortBy);

  return apiRequest(`marketplace-products?${queryParams.toString()}`);
}

// ----------------------------
// Marketplace: getAll (main loader)
// ----------------------------
export async function getAll(page = 1, category = null, search = null, options = {}) {
  console.log('🛒 Loading marketplace...', {
    page,
    category,
    search,
    sellerType: options.sellerType,
  });

  let products = [];
  let paginationInfo = { page: 1, pages: 1, count: 0 };

  if (options.sellerType === 'individual') {
    const data = await getIndividualProducts(page, category, search, options);
    const individualProducts = (data.products || []).map((product) => ({
      ...product,
      sellerType: 'individual',
      isBusinessListing: false,
      seller: { ...(product.seller || {}), isBusiness: false },
    }));
    products = individualProducts;
    paginationInfo = {
      page: data.page || page,
      pages: data.pages || 1,
      count: data.count || products.length,
    };
  } else if (options.sellerType === 'business') {
    const businessProducts = await getBusinessProducts(category, search);
    const pageSize = 20;
    const totalItems = businessProducts.length;
    const startIndex = (page - 1) * pageSize;
    products = businessProducts.slice(startIndex, startIndex + pageSize);

    paginationInfo = {
      page,
      pages: Math.ceil(totalItems / pageSize),
      count: totalItems,
    };
  } else {
    const [individualData, businessProducts] = await Promise.all([
      getIndividualProducts(page, category, search, options),
      getBusinessProducts(category, search),
    ]);

    const individualProducts = (individualData.products || []).map((product) => ({
      ...product,
      sellerType: 'individual',
      isBusinessListing: false,
      seller: { ...(product.seller || {}), isBusiness: false },
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
    products.sort(
      (a, b) =>
        new Date(b.addedAt || b.listedDate || 0) -
        new Date(a.addedAt || a.listedDate || 0)
    );
  }

  console.log(`✅ Returning ${products.length} products`);

  return {
    products,
    page: paginationInfo.page,
    pages: paginationInfo.pages,
    count: paginationInfo.count,
    currentPage: page,
    filters: { category, search, ...options },
  };
}

// ----------------------------
// Product CRUD / misc
// ----------------------------
export async function getSpecific(productId) {
  if (!productId) throw new Error('Product ID is required');

  const response = await apiRequest(
    `marketplace/products/specific/${encodeURIComponent(productId)}`
  );

  if (response.product) {
    const processed = processIndividualProducts([response.product]);
    return processed[0];
  }

  throw new Error('Product not found');
}

export const wishProduct = async (productId, userId) => {
  if (!productId || !userId) throw new Error('Product ID and User ID are required');
  return apiRequest('marketplace/wishlist/add', {
    method: 'POST',
    body: JSON.stringify({ productId, userId }),
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

export const markAsSold = async (productId) => {
  if (!productId) throw new Error('Product ID is required');
  return apiRequest(`marketplace/products/${productId}/sold`, { method: 'PATCH' });
};

export const clearMarketplaceCache = () => {
  businessCache.clear();
  console.log('🧹 Marketplace cache cleared');
};

// ----------------------------
// Image upload
// ----------------------------
export async function uploadImage(imageData, type = 'plant') {
  if (!imageData) throw new Error('Image data is required');

  if (typeof imageData === 'string' && imageData.startsWith('data:')) {
    return apiRequest('marketplace/uploadImage', {
      method: 'POST',
      body: JSON.stringify({ image: imageData, type }),
    });
  }

  const formData = new FormData();
  formData.append('file', imageData);
  formData.append('type', type);

  return apiRequest('marketplace/uploadImage', {
    method: 'POST',
    body: formData,
    headers: {}, // let the browser set multipart boundary
  });
}

// ----------------------------
// Business purchase
// ----------------------------
export async function purchaseBusinessProduct(
  productId,
  businessId,
  quantity = 1,
  customerInfo
) {
  return apiRequest('business-order-create', {
    method: 'POST',
    body: JSON.stringify({
      businessId,
      customerEmail: customerInfo.email,
      customerName: customerInfo.name,
      customerPhone: customerInfo.phone || '',
      items: [{ id: productId, quantity }],
      notes: customerInfo.notes || '',
      communicationPreference: 'messages',
    }),
  });
}

// ----------------------------
// Location & Maps
// ----------------------------
export async function getNearbyProducts(latitude, longitude, radius = 10, category = null) {
  const latNum = Number(latitude);
  const lonNum = Number(longitude);
  const radNum = Number(radius);

  if (!Number.isFinite(latNum) || !Number.isFinite(lonNum)) {
    throw new Error('Valid coordinates required');
  }
  const r = Number.isFinite(radNum) ? radNum : 10;

  // backend route per function.json: route: "marketplace/nearbyProducts"
  let query = `lat=${latNum}&lon=${lonNum}&radius=${r}`;
  if (category && category !== 'All') query += `&category=${encodeURIComponent(category)}`;
  return apiRequest(`marketplace/nearbyProducts?${query}`);
}

export async function getNearbyBusinesses(latitude, longitude, radius = 10, businessType = null) {
  const latNum = Number(latitude);
  const lonNum = Number(longitude);
  const radNum = Number(radius);

  if (!Number.isFinite(latNum) || !Number.isFinite(lonNum)) {
    throw new Error('Valid coordinates required');
  }
  const r = Number.isFinite(radNum) ? radNum : 10;

  // backend route per function.json: route: "marketplace/nearby-businesses"
  let query = `lat=${latNum}&lon=${lonNum}&radius=${r}`;
  if (businessType && businessType !== 'all') {
    query += `&businessType=${encodeURIComponent(businessType)}`;
  }
  return apiRequest(`marketplace/nearby-businesses?${query}`);
}

export const geocodeAddress = async (address) => {
  if (!address) throw new Error('Address is required');
  return apiRequest(`geocode?address=${encodeURIComponent(address)}`);
};

export const reverseGeocode = async (latitude, longitude) => {
  if (typeof latitude !== 'number' || typeof longitude !== 'number') {
    throw new Error('Valid coordinates required');
  }
  return apiRequest(`reverse-geocode?lat=${latitude}&lon=${longitude}`);
};

// ----------------------------
// Messaging
// ----------------------------
export const getNegotiateToken = async () => {
  const userEmail = await AsyncStorage.getItem('userEmail');
  if (!userEmail) throw new Error('User email is required for messaging');
  return apiRequest('signalr-negotiate', {
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
  if (!sellerId || !message || !sender)
    throw new Error('Seller ID, message, and sender are required');

  // Matches your function.json route: marketplace/messages/createChatRoom
  return apiRequest('marketplace/messages/createChatRoom', {
    method: 'POST',
    body: JSON.stringify({
      receiver: sellerId,
      plantId,
      message,
      sender,
    }),
  });
};

export const markMessagesAsRead = async (conversationId, messageIds = []) => {
  if (!conversationId) throw new Error('Conversation ID is required');
  return apiRequest('marketplace/messages/markAsRead', {
    method: 'POST',
    body: JSON.stringify({ conversationId, messageIds }),
  });
};

export const sendTypingIndicator = async (conversationId, isTyping) => {
  if (!conversationId) throw new Error('Conversation ID is required');
  return apiRequest('marketplace/messages/typing', {
    method: 'POST',
    body: JSON.stringify({ conversationId, isTyping }),
  });
};

export const sendOrderMessage = async (
  recipientId,
  message,
  senderId,
  context = {}
) => {
  if (!recipientId || !message || !senderId)
    throw new Error('recipientId, message, and senderId are required');

  try {
    const conversations = await fetchConversations(senderId);
    let conversation = null;
    if (Array.isArray(conversations)) {
      conversation = conversations.find(
        (conv) =>
          conv.sellerId === recipientId ||
          conv.otherUserEmail === recipientId ||
          conv.otherUserId === recipientId
      );
    }
    if (conversation) {
      return sendMessage(conversation.id, message, senderId);
    }
    return startConversation(recipientId, context?.orderId || null, message, senderId);
  } catch {
    return startConversation(recipientId, context?.orderId || null, message, senderId);
  }
};

// ----------------------------
// Reviews
// ----------------------------
export const fetchReviews = async (targetType, targetId) => {
  if (!targetType || !targetId) throw new Error('Target type and ID are required');
  return apiRequest(
    `marketplace/reviews/${encodeURIComponent(targetType)}/${encodeURIComponent(
      targetId
    )}`
  );
};

export const submitReview = async (targetId, targetType, reviewData) => {
  if (!targetId || !targetType || !reviewData)
    throw new Error('Target ID, type, and review data are required');
  if (!reviewData.rating || !reviewData.text)
    throw new Error('Rating and text are required for review');

  return apiRequest('reviews-submit', {
    method: 'POST',
    body: JSON.stringify({ targetId, targetType, ...reviewData }),
  });
};

export const deleteReview = async (targetType, targetId, reviewId) => {
  if (!targetType || !targetId || !reviewId)
    throw new Error('Target type, target ID, and review ID are required');
  return apiRequest('reviews-delete', {
    method: 'DELETE',
    body: JSON.stringify({ targetType, targetId, reviewId }),
  });
};

// ----------------------------
// Utilities
// ----------------------------
export const getAzureMapsKey = async () => {
  const response = await apiRequest('maps-config');
  if (!response.azureMapsKey && !response.subscriptionKey) {
    throw new Error('No Azure Maps key returned from server');
  }
  return response.azureMapsKey || response.subscriptionKey;
};

export const speechToText = async (audioUrl, language = 'he-IL') => {
  if (!audioUrl) throw new Error('Audio URL is required');
  const response = await apiRequest('marketplace/speechtotext', {
    method: 'POST',
    body: JSON.stringify({ audioUrl, language }),
  });
  const text = response.text || '';
  return text.replace(/[.,!?;:'"()\[\]{}]/g, '').replace(/\s+/g, ' ').trim();
};

// ----------------------------
// Transform helpers
// ----------------------------
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
        formattedAddress:
          product.location?.address || product.location?.city || '',
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
// Default export (for callers using default import)
// ----------------------------
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

  // Images
  uploadImage,

  // Utils
  getAzureMapsKey,
  speechToText,
  clearMarketplaceCache,
  setAuthToken,

  // Helpers
  processBusinessProductImages,
  processIndividualProductImages,
  convertInventoryToProducts,
  processIndividualProducts,
  calculateDistance,
};
