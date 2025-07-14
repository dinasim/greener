// services/marketplaceApi.js - CLEANED: Removed all fallback and mock data
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import config from './config';
import syncBridge, { addBusinessProfileSync, addInventorySync, invalidateMarketplaceCache } from './BusinessMarketplaceSyncBridge';

// Base URL for API requests
const API_BASE_URL = config.API_BASE_URL || 'https://usersfunctions.azurewebsites.net/api';

// Cache for business data to avoid repeated API calls
const businessCache = new Map();
const cacheTimeout = 5 * 60 * 1000; // 5 minutes

/**
 * Set authentication token for API requests
 */
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

/**
 * API request function with proper Azure Functions routing and error handling
 */
const apiRequest = async (endpoint, options = {}, retries = 3) => {
  try {
    const token = await AsyncStorage.getItem('googleAuthToken');
    const userEmail = await AsyncStorage.getItem('userEmail');
    const userType = await AsyncStorage.getItem('userType');
    const businessId = await AsyncStorage.getItem('businessId');
    
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    if (userEmail) {
      headers['X-User-Email'] = userEmail;
    }
    
    if (userType) {
      headers['X-User-Type'] = userType;
    }
    
    if (businessId) {
      headers['X-Business-ID'] = businessId;
    }
    
    const url = `${API_BASE_URL}/${endpoint.replace(/^\//, '')}`;
    console.log(`🌐 API Request: ${options.method || 'GET'} ${url}`);
    
    let lastError = null;
    
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const response = await fetch(url, {
          timeout: 15000,
          ...options,
          headers,
        });
        
        if (!response.ok) {
          console.error(`❌ API Error ${response.status}:`, response.statusText);
          
          let errorData = { error: `Request failed with status ${response.status}` };
          
          try {
            const textResponse = await response.text();
            if (textResponse) {
              try {
                errorData = JSON.parse(textResponse);
              } catch {
                errorData = { error: textResponse };
              }
            }
          } catch (parseError) {
            console.warn('Could not parse error response:', parseError);
          }
          
          lastError = new Error(
            errorData?.error || 
            errorData?.message || 
            errorData?.ExceptionMessage ||
            `Request failed with status ${response.status}`
          );
          
          // Don't retry on client errors (4xx), only on server errors (5xx)
          if (response.status >= 400 && response.status < 500) {
            throw lastError;
          }
          
        } else {
          const textResponse = await response.text();
          const data = textResponse ? JSON.parse(textResponse) : {};
          console.log(`✅ API Success: ${endpoint}`);
          return data;
        }
        
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        console.log(`⚠️ Attempt ${attempt} failed, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        
      } catch (error) {
        lastError = error;
        
        // Don't retry on network errors or final attempt
        if (error.name === 'TypeError' || error.message.includes('network') || attempt === retries) {
          break;
        }
        
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        console.log(`⚠️ Attempt ${attempt} failed, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError || new Error(`Request failed: ${endpoint}`);
  } catch (error) {
    console.error(`❌ API request failed (${endpoint}):`, error);
    throw error;
  }
};

// ==========================================
// HELPER FUNCTIONS
// ==========================================

/**
 * Calculate distance between two coordinates
 */
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Radius of the Earth in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const d = R * c; // Distance in kilometers
  return d;
};

/**
 * Sort products helper
 */
const sortProducts = (products, sortBy) => {
  switch (sortBy) {
    case 'recent':
      return products.sort((a, b) => new Date(b.addedAt) - new Date(a.addedAt));
    case 'priceAsc':
      return products.sort((a, b) => parseFloat(a.price) - parseFloat(b.price));
    case 'priceDesc':
      return products.sort((a, b) => parseFloat(b.price) - parseFloat(a.price));
    default:
      return products;
  }
};

// ==========================================
// BUSINESS FUNCTIONS
// ==========================================

/**
 * ENHANCED: Get all businesses with better caching and error handling
 */
const getAllBusinesses = async () => {
  const cacheKey = 'all_businesses';
  const cached = businessCache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < cacheTimeout) {
    console.log('📱 Using cached businesses data');
    return cached.data;
  }
  
  const response = await apiRequest('get-all-businesses');
  const businesses = response.businesses || response.data || response || [];
  
  businessCache.set(cacheKey, {
    data: businesses,
    timestamp: Date.now()
  });
  
  console.log(`✅ Loaded ${businesses.length} businesses`);
  return businesses;
};

/**
 * FIXED: Get business inventory with correct route matching backend documentation
 */
export const fetchBusinessInventory = async (businessId) => {
  if (!businessId) {
    throw new Error('Business ID is required');
  }
  
  // Check unified cache first
  try {
    const unifiedCache = await AsyncStorage.getItem('unified_business_inventory');
    if (unifiedCache) {
      const cached = JSON.parse(unifiedCache);
      if (Date.now() - cached.timestamp < 180000 && cached.businessId === businessId) { // 3 minutes
        console.log('📱 Using unified cached business inventory');
        return { success: true, inventory: cached.data };
      }
    }
  } catch (cacheError) {
    console.warn('Cache read error:', cacheError);
  }
  
  // FIXED: Use correct backend endpoint from documentation
  const response = await apiRequest(`marketplace/business/${encodeURIComponent(businessId)}/inventory`);
  
  // Update unified cache
  await AsyncStorage.setItem('unified_business_inventory', JSON.stringify({
    data: response.inventory || response.items || response.data || [],
    businessId,
    timestamp: Date.now(),
    source: 'marketplace'
  }));

  return {
    success: true,
    inventory: response.inventory || response.items || response.data || []
  };
};

/**
 * FIXED: Get business profile with correct route matching backend documentation
 */
export const fetchBusinessProfile = async (businessId) => {
  if (!businessId) {
    throw new Error('Business ID is required');
  }
  
  // Check unified cache first
  try {
    const unifiedCache = await AsyncStorage.getItem('unified_business_profile');
    if (unifiedCache) {
      const cached = JSON.parse(unifiedCache);
      if (Date.now() - cached.timestamp < 300000) { // 5 minutes
        console.log('📱 Using unified cached business profile');
        return { success: true, business: cached.data };
      }
    }
  } catch (cacheError) {
    console.warn('Cache read error:', cacheError);
  }
  
  // FIXED: Use correct backend endpoint from documentation - get_business_profile
  const response = await apiRequest(`marketplace/business/${encodeURIComponent(businessId)}/profile`);
  
  // Update unified cache
  await AsyncStorage.setItem('unified_business_profile', JSON.stringify({
    data: response.business || response.profile || response.data || response,
    timestamp: Date.now(),
    source: 'marketplace'
  }));

  return {
    success: true,
    business: response.business || response.profile || response.data || response
  };
};

// ==========================================
// USER FUNCTIONS
// ==========================================

/**
 * FIXED: Get user profile using correct Azure Function endpoint
 */
export const fetchUserProfile = async (userId) => {
  if (!userId) {
    throw new Error('User ID is required');
  }
  
  // FIXED: Use correct deployed endpoint route
  const response = await apiRequest(`marketplace/users/${encodeURIComponent(userId)}`);
  return response;
};

/**
 * ENHANCED: Update user profile with sync bridge integration
 */
export const updateUserProfile = async (userId, userData) => {
  const endpoint = `user-profile/${userId}`;
  
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
    'marketplace_plants'
  ]);

  return result;
};

export const getUserListings = async (userId, status = 'all') => {
  const endpoint = `marketplace/users/${userId}/listings?status=${status}`;
  return apiRequest(endpoint);
};

export const getUserWishlist = async (userId) => {
  const endpoint = `marketplace/users/${userId}/wishlist`;
  return apiRequest(endpoint);
};

// ==========================================
// IMAGE PROCESSING FUNCTIONS
// ==========================================

/**
 * ENHANCED: Process business product images for marketplace display
 */
const processBusinessProductImages = (item, business) => {
  // Collect all possible image sources
  const allImageSources = [];
  
  // Primary image sources
  if (item.mainImage) allImageSources.push(item.mainImage);
  if (item.image && item.image !== item.mainImage) allImageSources.push(item.image);
  
  // Additional images
  if (item.images && Array.isArray(item.images)) {
    item.images.forEach(img => {
      if (img && !allImageSources.includes(img)) {
        allImageSources.push(img);
      }
    });
  }
  
  // Alternative image field names
  if (item.imageUrls && Array.isArray(item.imageUrls)) {
    item.imageUrls.forEach(img => {
      if (img && !allImageSources.includes(img)) {
        allImageSources.push(img);
      }
    });
  }
  
  // Business-specific image processing
  if (item.productImages && Array.isArray(item.productImages)) {
    item.productImages.forEach(img => {
      if (img && !allImageSources.includes(img)) {
        allImageSources.push(img);
      }
    });
  }
  
  // Filter valid images
  const validImages = allImageSources.filter(img => {
    if (!img || typeof img !== 'string') return false;
    
    // Check for valid URL formats
    if (img.startsWith('http://') || img.startsWith('https://')) {
      return true;
    }
    
    // Check for data URLs
    if (img.startsWith('data:image/')) {
      return true;
    }
    
    // Check for relative paths that might be valid
    if (img.startsWith('/') || img.startsWith('./') || img.startsWith('../')) {
      return true;
    }
    
    return false;
  });
  
  return {
    mainImage: validImages[0] || null,
    images: validImages,
    hasImages: validImages.length > 0,
    imageCount: validImages.length,
    allSources: allImageSources, // Keep for debugging
  };
};

/**
 * ENHANCED: Product image processing for individual listings
 */
const processIndividualProductImages = (product) => {
  const images = [];
  
  // Primary image
  if (product.image) images.push(product.image);
  if (product.mainImage && product.mainImage !== product.image) images.push(product.mainImage);
  
  // Additional images
  if (product.images && Array.isArray(product.images)) {
    product.images.forEach(img => {
      if (img && !images.includes(img)) images.push(img);
    });
  }
  
  // Validate and filter images
  const validImages = images.filter(img => 
    img && typeof img === 'string' && 
    (img.startsWith('http') || img.startsWith('data:') || img.startsWith('/'))
  );
  
  return {
    mainImage: validImages[0] || null,
    images: validImages,
    hasImages: validImages.length > 0,
  };
};

/**
 * Simplified image processing for business products (backward compatibility)
 */
const processProductImages = (item) => {
  const images = [];
  
  if (item.mainImage) images.push(item.mainImage);
  if (item.image && item.image !== item.mainImage) images.push(item.image);
  if (item.images && Array.isArray(item.images)) {
    item.images.forEach(img => {
      if (img && !images.includes(img)) images.push(img);
    });
  }
  if (item.imageUrls && Array.isArray(item.imageUrls)) {
    item.imageUrls.forEach(img => {
      if (img && !images.includes(img)) images.push(img);
    });
  }
  
  const validImages = images.filter(img => 
    img && typeof img === 'string' && (img.startsWith('http') || img.startsWith('data:'))
  );
  
  return {
    mainImage: validImages[0] || null,
    images: validImages,
    hasImages: validImages.length > 0,
  };
};

// ==========================================
// PRODUCT CONVERSION FUNCTIONS
// ==========================================

/**
 * ENHANCED: Convert inventory items to marketplace products with comprehensive features
 */
const convertInventoryToProducts = (inventory, business, category, search) => {
  if (!Array.isArray(inventory)) {
    console.warn('⚠️ Inventory is not an array:', inventory);
    return [];
  }

  return inventory
    .filter(item => {
      // Basic filters
      if (item.status !== 'active' || (item.quantity || 0) <= 0) return false;
      
      // Category filter - enhanced matching
      if (category && category !== 'All' && category !== 'all') {
        const itemCategory = item.category || item.productType || '';
        const categoryVariations = [
          category.toLowerCase(),
          category.toLowerCase().replace(/s$/, ''), // Remove plural
          category.toLowerCase() + 's', // Add plural
        ];
        
        if (!categoryVariations.some(cat => itemCategory.toLowerCase().includes(cat))) {
          return false;
        }
      }
      
      // Enhanced search filter
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
        
        // Split search terms and check if all are present
        const searchTerms = searchLower.split(' ').filter(term => term.length > 0);
        if (!searchTerms.every(term => searchableText.includes(term))) {
          return false;
        }
      }
      
      return true;
    })
    .map(item => {
      const processedImages = processBusinessProductImages(item, business);
      const businessLocation = business.address || business.location || {};
      
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
        
        // Enhanced image handling
        image: processedImages.mainImage,
        mainImage: processedImages.mainImage,
        images: processedImages.images,
        hasImages: processedImages.hasImages,
        imageCount: processedImages.imageCount,
        
        // Business info
        businessId: business.id || business.email,
        sellerId: business.id || business.email,
        sellerType: 'business',
        isBusinessListing: true,
        inventoryId: item.id,
        
        // Enhanced seller info
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
          }
        },
        
        // Enhanced location
        location: {
          city: businessLocation.city || 'Contact for location',
          state: businessLocation.state || '',
          country: businessLocation.country || '',
          latitude: businessLocation.latitude,
          longitude: businessLocation.longitude,
          formattedAddress: businessLocation.formattedAddress || businessLocation.address || '',
        },
        
        // Enhanced product details
        specifications: {
          size: item.size || '',
          weight: item.weight || '',
          dimensions: item.dimensions || '',
          material: item.material || '',
          color: item.color || '',
          condition: item.condition || 'new',
          warranty: item.warranty || '',
        },
        
        // Enhanced inventory details
        inventory: {
          quantity: item.quantity || 0,
          minThreshold: item.minThreshold || 5,
          maxQuantity: item.maxQuantity || item.quantity || 1,
          restockDate: item.restockDate || '',
          supplier: item.supplier || '',
        },
        
        // Enhanced pricing
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
        
        // Enhanced stats
        stats: {
          views: item.viewCount || 0,
          wishlistCount: item.wishlistCount || 0,
          messageCount: item.messageCount || 0,
          purchaseCount: item.purchaseCount || 0,
          rating: item.rating || 0,
          reviewCount: item.reviewCount || 0,
        },
        
        // Enhanced tags and metadata
        tags: item.tags || [],
        keywords: item.keywords || [],
        features: item.features || [],
        benefits: item.benefits || [],
        
        source: 'business_inventory',
        platform: 'greener',
        lastSync: new Date().toISOString(),
      };
    });
};

/**
 * ENHANCED: Individual product processing
 */
const processIndividualProducts = (products) => {
  if (!Array.isArray(products)) {
    console.warn('⚠️ Products is not an array:', products);
    return [];
  }

  return products.map(product => {
    const processedImages = processIndividualProductImages(product);
    
    return {
      ...product,
      // Enhanced image handling
      image: processedImages.mainImage,
      mainImage: processedImages.mainImage,
      images: processedImages.images,
      hasImages: processedImages.hasImages,
      
      // Ensure consistent seller info
      sellerType: 'individual',
      isBusinessListing: false,
      seller: {
        ...product.seller,
        isBusiness: false,
      },
      
      // Enhanced location formatting
      location: {
        ...product.location,
        formattedAddress: product.location?.address || product.location?.city || '',
      },
      
      // Enhanced stats
      stats: {
        views: product.views || 0,
        wishlistCount: product.wishlistCount || 0,
        messageCount: product.messageCount || 0,
        ...product.stats,
      },
      
      source: 'individual_listing',
      platform: 'greener',
      lastSync: new Date().toISOString(),
    };
  });
};

/**
 * Get business products with enhanced processing and error handling
 */
const getBusinessProducts = async (category, search) => {
  const cacheKey = `business_products_${category || 'all'}_${search || 'none'}`;
  const cached = businessCache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < cacheTimeout) {
    return cached.data;
  }
  
  const businesses = await getAllBusinesses();
  if (businesses.length === 0) throw new Error('No businesses found');
  
  console.log(`🏢 Processing ${businesses.length} businesses for products...`);
  
  const businessPromises = businesses.map(async business => {
    const businessId = business.id || business.email;
    
    let businessProfile = business;
    let inventory = [];
    
    try {
      const profileResponse = await fetchBusinessProfile(businessId);
      if (profileResponse && profileResponse.success && profileResponse.business) {
        businessProfile = { ...business, ...profileResponse.business };
        if (profileResponse.inventory && Array.isArray(profileResponse.inventory)) {
          inventory = profileResponse.inventory;
        }
      }
    } catch (profileError) {
      console.warn(`⚠️ Profile endpoint failed for ${businessId}:`, profileError.message);
    }
    
    if (inventory.length === 0) {
      const inventoryResponse = await fetchBusinessInventory(businessId);
      if (inventoryResponse && inventoryResponse.success && inventoryResponse.inventory) {
        inventory = inventoryResponse.inventory;
      } else if (Array.isArray(inventoryResponse)) {
        inventory = inventoryResponse;
      }
    }
    
    console.log(`📦 Business ${businessProfile.businessName || businessProfile.name}: ${inventory.length} items`);
    
    return convertInventoryToProducts(inventory, businessProfile, category, search);
  });
  
  const businessProductArrays = await Promise.all(businessPromises);
  const allBusinessProducts = businessProductArrays.flat();
  
  console.log(`✅ Total business products: ${allBusinessProducts.length}`);
  
  businessCache.set(cacheKey, {
    data: allBusinessProducts,
    timestamp: Date.now()
  });
  
  return allBusinessProducts;
};

/**
 * Get individual products from regular marketplace
 */
const getIndividualProducts = async (page, category, search, options) => {
  const queryParams = new URLSearchParams();
  
  queryParams.append('page', page);
  if (category && category !== 'All' && category !== 'all') queryParams.append('category', category);
  if (search) queryParams.append('search', search);
  if (options.minPrice !== undefined) queryParams.append('minPrice', options.minPrice);
  if (options.maxPrice !== undefined) queryParams.append('maxPrice', options.maxPrice);
  if (options.sortBy) queryParams.append('sortBy', options.sortBy);
  
  const endpoint = `marketplace-products?${queryParams.toString()}`;
  return apiRequest(endpoint);
};

// ==========================================
// MARKETPLACE FUNCTIONS
// ==========================================

/**
 * ENHANCED: Main marketplace loading function with pagination and filtering
 */
export const getAll = async (page = 1, category = null, search = null, options = {}) => {
  console.log('🛒 Loading marketplace...', { page, category, search, sellerType: options.sellerType });
  
  let products = [];
  let paginationInfo = { page: 1, pages: 1, count: 0 };
  
  if (options.sellerType === 'individual') {
    const data = await getIndividualProducts(page, category, search, options);
    products = (data.products || []).map(product => ({
      ...product,
      sellerType: 'individual',
      isBusinessListing: false,
      seller: { ...product.seller, isBusiness: false }
    }));
    paginationInfo = {
      page: data.page || page,
      pages: data.pages || 1,
      count: data.count || products.length
    };
    
  } else if (options.sellerType === 'business') {
    const businessProducts = await getBusinessProducts(category, search);
    const pageSize = 20;
    const totalItems = businessProducts.length;
    const startIndex = (page - 1) * pageSize;
    products = businessProducts.slice(startIndex, startIndex + pageSize);
    
    paginationInfo = {
      page: page,
      pages: Math.ceil(totalItems / pageSize),
      count: totalItems
    };
    
  } else {
    const [individualData, businessProducts] = await Promise.all([
      getIndividualProducts(page, category, search, options),
      getBusinessProducts(category, search)
    ]);
    
    const individualProducts = (individualData.products || []).map(product => ({
      ...product,
      sellerType: 'individual',
      isBusinessListing: false,
      seller: { ...product.seller, isBusiness: false }
    }));
    
    products = [...individualProducts, ...businessProducts];
    paginationInfo = {
      page: individualData.page || page,
      pages: Math.max(individualData.pages || 1, Math.ceil(products.length / 20)),
      count: products.length
    };
  }
  
  if (options.minPrice !== undefined || options.maxPrice !== undefined) {
    products = products.filter(product => {
      const price = parseFloat(product.price || 0);
      if (options.minPrice !== undefined && price < options.minPrice) return false;
      if (options.maxPrice !== undefined && price > options.maxPrice) return false;
      return true;
    });
  }
  
  if (options.sortBy) {
    products = sortProducts(products, options.sortBy);
  } else {
    products.sort((a, b) => 
      new Date(b.addedAt || b.listedDate || 0) - new Date(a.addedAt || a.listedDate || 0)
    );
  }
  
  console.log(`✅ Returning ${products.length} products`);
  
  return {
    products: products,
    page: paginationInfo.page,
    pages: paginationInfo.pages,
    count: paginationInfo.count,
    currentPage: page,
    filters: { category, search, ...options }
  };
};

/**
 * FIXED: Get specific product using correct Azure Function endpoint
 */
export const getSpecific = async (productId) => {
  if (!productId) {
    throw new Error('Product ID is required');
  }
  
  // FIXED: Use correct deployed endpoint route with path parameter
  const response = await apiRequest(`marketplace/products/specific/${encodeURIComponent(productId)}`);
  
  if (response.product) {
    const processedProducts = processIndividualProducts([response.product]);
    return processedProducts[0];
  }
  
  throw new Error('Product not found');
};

/**
 * FIXED: Add product to wishlist
 */
export const wishProduct = async (productId, userId) => {
  if (!productId || !userId) {
    throw new Error('Product ID and User ID are required');
  }
  
  const endpoint = 'marketplace/wishlist/add';
  return apiRequest(endpoint, {
    method: 'POST',
    body: JSON.stringify({ productId, userId }),
  });
};

/**
 * FIXED: Create new product listing
 */
export const createProduct = async (productData) => {
  if (!productData) {
    throw new Error('Product data is required');
  }
  
  const endpoint = 'marketplace/products';
  return apiRequest(endpoint, {
    method: 'POST',
    body: JSON.stringify(productData),
  });
};

/**
 * FIXED: Create new plant listing (alias for createProduct)
 */
export const createPlant = async (plantData) => {
  return createProduct(plantData);
};

/**
 * FIXED: Update existing product
 */
export const updateProduct = async (productId, productData) => {
  if (!productId || !productData) {
    throw new Error('Product ID and data are required');
  }
  
  const endpoint = `marketplace/products/${productId}`;
  return apiRequest(endpoint, {
    method: 'PUT',
    body: JSON.stringify(productData),
  });
};

/**
 * FIXED: Delete product
 */
export const deleteProduct = async (productId) => {
  if (!productId) {
    throw new Error('Product ID is required');
  }
  
  const endpoint = `marketplace/products/${productId}`;
  return apiRequest(endpoint, {
    method: 'DELETE',
  });
};

/**
 * FIXED: Mark product as sold
 */
export const markAsSold = async (productId) => {
  if (!productId) {
    throw new Error('Product ID is required');
  }
  
  const endpoint = `marketplace/products/${productId}/sold`;
  return apiRequest(endpoint, {
    method: 'PATCH',
  });
};

/**
 * FIXED: Clear marketplace cache
 */
export const clearMarketplaceCache = () => {
  businessCache.clear();
  console.log('🧹 Marketplace cache cleared');
};

// ==========================================
// IMAGE UPLOAD FUNCTIONS
// ==========================================

/**
 * FIXED: Upload image using correct Azure Function endpoint
 */
export const uploadImage = async (imageData, type = 'plant') => {
  if (!imageData) {
    throw new Error('Image data is required');
  }
  
  if (typeof imageData === 'string' && imageData.startsWith('data:')) {
    const response = await apiRequest('marketplace/uploadImage', {
      method: 'POST',
      body: JSON.stringify({ image: imageData, type }),
    });
    return response;
  }
  
  const formData = new FormData();
  formData.append('file', imageData);
  formData.append('type', type);
  
  const response = await apiRequest('marketplace/uploadImage', {
    method: 'POST',
    body: formData,
    headers: {}, // Let browser set Content-Type for FormData
  });
  return response;
};

// ==========================================
// BUSINESS PURCHASE FUNCTIONS
// ==========================================

export const purchaseBusinessProduct = async (productId, businessId, quantity = 1, customerInfo) => {
  const response = await apiRequest('business-order-create', {
    method: 'POST',
    body: JSON.stringify({
      businessId: businessId,
      customerEmail: customerInfo.email,
      customerName: customerInfo.name,
      customerPhone: customerInfo.phone || '',
      items: [{
        id: productId,
        quantity: quantity
      }],
      notes: customerInfo.notes || '',
      communicationPreference: 'messages'
    })
  });
  
  return response;
};

// ==========================================
// LOCATION FUNCTIONS
// ==========================================

/**
 * FIXED: Get nearby products using correct Azure Function endpoint
 */
export const getNearbyProducts = async (latitude, longitude, radius = 10, category = null) => {
  if (typeof latitude !== 'number' || typeof longitude !== 'number') {
    throw new Error('Valid coordinates required');
  }
  
  let queryParams = `lat=${latitude}&lon=${longitude}&radius=${radius}`;
  if (category && category !== 'All') {
    queryParams += `&category=${encodeURIComponent(category)}`;
  }
  
  const response = await apiRequest(`nearby-products?${queryParams}`);
  return response;
};

/**
 * FIXED: Get nearby businesses using correct Azure Function endpoint
 */
export const getNearbyBusinesses = async (latitude, longitude, radius = 10, businessType = null) => {
  if (typeof latitude !== 'number' || typeof longitude !== 'number') {
    throw new Error('Valid coordinates required');
  }
  
  let queryParams = `lat=${latitude}&lon=${longitude}&radius=${radius}`;
  if (businessType && businessType !== 'all') {
    queryParams += `&businessType=${encodeURIComponent(businessType)}`;
  }
  
  const response = await apiRequest(`get_nearby_businesses?${queryParams}`);
  return response;
};

/**
 * ENHANCED: Geocode address using correct Azure Function endpoint
 */
export const geocodeAddress = async (address) => {
  if (!address) {
    throw new Error('Address is required');
  }
  
  const response = await apiRequest(`geocode?address=${encodeURIComponent(address)}`);
  return response;
};

/**
 * ENHANCED: Reverse geocode coordinates using correct Azure Function endpoint
 */
export const reverseGeocode = async (latitude, longitude) => {
  if (typeof latitude !== 'number' || typeof longitude !== 'number') {
    throw new Error('Valid coordinates required');
  }
  
  const response = await apiRequest(`reverse-geocode?lat=${latitude}&lon=${longitude}`);
  return response;
};

// ==========================================
// MESSAGING FUNCTIONS
// ==========================================

/**
 * FIXED: Messaging functions using correct Azure Function endpoints
 */
export const getNegotiateToken = async () => {
  const userEmail = await AsyncStorage.getItem('userEmail');
  
  if (!userEmail) {
    throw new Error('User email is required for messaging');
  }
  
  const response = await apiRequest('signalr-negotiate', {
    method: 'POST',
    body: JSON.stringify({ userId: userEmail }),
  });
  return response;
};

export const fetchConversations = async (userId) => {
  if (!userId) {
    throw new Error('User ID is required');
  }
  
  const response = await apiRequest('conversations');
  return response;
};

export const fetchMessages = async (chatId, userId) => {
  if (!chatId) {
    throw new Error('Chat ID is required');
  }
  
  const response = await apiRequest(`get-messages?chatId=${encodeURIComponent(chatId)}`);
  return response;
};

export const sendMessage = async (chatId, message, senderId) => {
  if (!chatId || !message) {
    throw new Error('Chat ID and message are required');
  }
  
  const response = await apiRequest('send-message', {
    method: 'POST',
    body: JSON.stringify({
      chatId,
      message,
      senderId,
    }),
  });
  return response;
};

export const startConversation = async (sellerId, plantId, message, sender) => {
  if (!sellerId || !message || !sender) {
    throw new Error('Seller ID, message, and sender are required');
  }
  
  const response = await apiRequest('create-chat', {
    method: 'POST',
    body: JSON.stringify({
      receiver: sellerId,
      plantId,
      message,
      sender,
    }),
  });
  return response;
};

export const markMessagesAsRead = async (conversationId, messageIds = []) => {
  if (!conversationId) {
    throw new Error('Conversation ID is required');
  }
  
  const endpoint = 'marketplace/messages/markAsRead';
  return apiRequest(endpoint, {
    method: 'POST',
    body: JSON.stringify({
      conversationId,
      messageIds,
    }),
  });
};

export const sendTypingIndicator = async (conversationId, isTyping) => {
  if (!conversationId) {
    throw new Error('Conversation ID is required');
  }
  
  const endpoint = 'marketplace/messages/typing';
  return apiRequest(endpoint, {
    method: 'POST',
    body: JSON.stringify({
      conversationId,
      isTyping,
    }),
  });
};

/**
 * ENHANCED: Send an order-related message (auto chat for order events)
 */
export const sendOrderMessage = async (recipientId, message, senderId, context = {}) => {
  if (!recipientId || !message || !senderId) {
    throw new Error('recipientId, message, and senderId are required');
  }
  
  try {
    const conversations = await fetchConversations(senderId);
    let conversation = null;
    if (Array.isArray(conversations)) {
      conversation = conversations.find(
        conv => (conv.sellerId === recipientId || conv.otherUserEmail === recipientId || conv.otherUserId === recipientId)
      );
    }
    if (conversation) {
      return await sendMessage(conversation.id, message, senderId);
    } else {
      return await startConversation(recipientId, context?.orderId || null, message, senderId);
    }
  } catch (err) {
    return await startConversation(recipientId, context?.orderId || null, message, senderId);
  }
};

// ==========================================
// REVIEWS FUNCTIONS
// ==========================================

/**
 * FIXED: Reviews functions using correct Azure Function endpoints
 */
export const fetchReviews = async (targetType, targetId) => {
  if (!targetType || !targetId) {
    throw new Error('Target type and ID are required');
  }
  
  const response = await apiRequest(`reviews-get?targetType=${targetType}&targetId=${encodeURIComponent(targetId)}`);
  return response;
};

export const submitReview = async (targetId, targetType, reviewData) => {
  if (!targetId || !targetType || !reviewData) {
    throw new Error('Target ID, type, and review data are required');
  }
  
  if (!reviewData.rating || !reviewData.text) {
    throw new Error('Rating and text are required for review');
  }
  
  const response = await apiRequest('reviews-submit', {
    method: 'POST',
    body: JSON.stringify({
      targetId,
      targetType,
      ...reviewData
    }),
  });
  return response;
};

export const deleteReview = async (targetType, targetId, reviewId) => {
  if (!targetType || !targetId || !reviewId) {
    throw new Error('Target type, target ID, and review ID are required');
  }
  
  const response = await apiRequest('reviews-delete', {
    method: 'DELETE',
    body: JSON.stringify({ targetType, targetId, reviewId })
  });
  return response;
};

// ==========================================
// UTILITY FUNCTIONS
// ==========================================

/**
 * ENHANCED: Get Azure Maps configuration using correct endpoint
 */
export const getAzureMapsKey = async () => {
  const response = await apiRequest('maps-config');
  
  if (!response.azureMapsKey && !response.subscriptionKey) {
    throw new Error('No Azure Maps key returned from server');
  }
  
  return response.azureMapsKey || response.subscriptionKey;
};

/**
 * ENHANCED: Speech to text conversion using correct Azure Function endpoint
 */
export const speechToText = async (audioUrl, language = 'he-IL') => {
  if (!audioUrl) {
    throw new Error('Audio URL is required');
  }
  
  // Updated to use the correct endpoint URL format
  const response = await apiRequest('marketplace/speechtotext', {
    method: 'POST',
    body: JSON.stringify({ audioUrl, language }),
  });
  
  const text = response.text || '';
  return text.replace(/[.,!?;:'"()\[\]{}]/g, '').replace(/\s+/g, ' ').trim();
};

// ==========================================
// EXPORT ALL FUNCTIONS
// ==========================================

export default {
  // Core marketplace functions
  getAll,
  getSpecific,
  createProduct,
  createPlant,
  updateProduct,
  deleteProduct,
  markAsSold,
  wishProduct,
  
  // User functions
  fetchUserProfile,
  updateUserProfile,
  getUserListings,
  getUserWishlist,
  
  // Business functions
  getAllBusinesses,
  fetchBusinessProfile,
  fetchBusinessInventory,
  purchaseBusinessProduct,
  
  // Location functions
  getNearbyProducts,
  getNearbyBusinesses,
  geocodeAddress,
  reverseGeocode,
  
  // Messaging functions
  getNegotiateToken,
  fetchConversations,
  fetchMessages,
  sendMessage,
  startConversation,
  markMessagesAsRead,
  sendTypingIndicator,
  sendOrderMessage,
  
  // Reviews functions
  fetchReviews,
  submitReview,
  deleteReview,
  
  // Image functions
  uploadImage,
  
  // Utility functions
  getAzureMapsKey,
  speechToText,
  clearMarketplaceCache,
  setAuthToken,
  
  // Helper functions for internal use
  processBusinessProductImages,
  processIndividualProductImages,
  convertInventoryToProducts,
  processIndividualProducts,
  calculateDistance,
};