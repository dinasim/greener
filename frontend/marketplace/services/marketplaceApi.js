// services/marketplaceApi.js - FIXED: Removed duplicate fetchBusinessProfile definition
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import config from './config';

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
 * FIXED: Enhanced API request function with proper error handling and retry logic
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
    
    // FIXED: Add retry logic with exponential backoff
    let lastError;
    const retries = 2;
    
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const response = await fetch(url, {
          timeout: 15000,
          ...options,
          headers,
        });
        
        let data;
        try {
          // FIXED: Always check response.ok before parsing JSON
          if (!response.ok) {
            console.error(`❌ API Error ${response.status}:`, response.statusText);
            
            // Try to get error details if response has content
            const textResponse = await response.text();
            let errorData = { error: `Request failed with status ${response.status}` };
            
            if (textResponse) {
              try {
                errorData = JSON.parse(textResponse);
              } catch (parseError) {
                errorData = { error: textResponse };
              }
            }
            
            // Don't retry on client errors (4xx), only on server errors (5xx) or network issues
            if (response.status >= 400 && response.status < 500 && attempt === 1) {
              throw new Error(errorData.error || errorData.message || `Request failed with status ${response.status}`);
            }
            
            lastError = new Error(errorData.error || errorData.message || `Request failed with status ${response.status}`);
          } else {
            // Only parse JSON if response is OK
            const textResponse = await response.text();
            data = textResponse ? JSON.parse(textResponse) : {};
            console.log(`✅ API Success: ${endpoint}`);
            return data;
          }
        } catch (parseError) {
          console.error('❌ JSON parse error:', parseError);
          // If we can't parse the response, treat it as an error
          lastError = new Error('Invalid response format from server');
        }
        
        lastError = new Error(data.error || data.message || `Request failed with status ${response.status}`);
        
        // If this is not a server error, don't retry
        if (response.status < 500) {
          throw lastError;
        }
        
      } catch (error) {
        lastError = error;
        
        // Don't retry on client-side errors
        if (error.name === 'TypeError' || error.message.includes('network') || attempt === retries) {
          break;
        }
        
        // Exponential backoff
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        console.log(`⚠️ Attempt ${attempt} failed, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError;
  } catch (error) {
    console.error(`❌ API request failed (${endpoint}):`, error);
    throw error;
  }
};

// ==========================================
// RESTORED: ENHANCED IMAGE PROCESSING FUNCTIONS
// ==========================================

/**
 * RESTORED: Process business product images for marketplace display with enhanced handling
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
 * RESTORED: Enhanced product image processing for individual listings
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
 * RESTORED: Generate fallback image based on product category
 */
const generateFallbackImage = (product, business) => {
  const category = product.category || product.productType || 'general';
  const businessName = business?.businessName || business?.name || 'Business';
  
  // You could implement a service that generates placeholder images here
  // For now, return a standard placeholder
  return `https://via.placeholder.com/300x200/4CAF50/white?text=${encodeURIComponent(category)}`;
};

/**
 * RESTORED: Simplified image processing for business products (backward compatibility)
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
// RESTORED: ENHANCED PRODUCT CONVERSION FUNCTIONS
// ==========================================

/**
 * RESTORED: Convert inventory items to marketplace products with enhanced features
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
        image: processedImages.mainImage || generateFallbackImage(item, business),
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
 * RESTORED: Enhanced individual product processing
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
 * FIXED: Get all businesses with enhanced caching and error handling
 */
const getAllBusinesses = async () => {
  const cacheKey = 'all_businesses';
  const cached = businessCache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < cacheTimeout) {
    console.log('📱 Using cached businesses data');
    return cached.data;
  }
  
  try {
    const response = await apiRequest('marketplace/businesses');
    const businesses = response.businesses || [];
    
    businessCache.set(cacheKey, {
      data: businesses,
      timestamp: Date.now()
    });
    
    console.log(`✅ Loaded ${businesses.length} businesses`);
    return businesses;
  } catch (error) {
    console.error('❌ Get businesses failed:', error);
    
    // Return cached data if available, even if stale
    if (cached) {
      console.log('📱 Using stale cached businesses data due to error');
      return cached.data;
    }
    
    return [];
  }
};

/**
 * FIXED: Get business profile using the corrected endpoint
 */
export const fetchBusinessProfile = async (businessId) => {
  if (!businessId) {
    throw new Error('Business ID is required');
  }
  
  // FIXED: Use the correct endpoint that matches the backend route
  const endpoint = `business-profile`;
  return apiRequest(endpoint);
};

/**
 * FIXED: Get business inventory using the corrected endpoint
 */
export const fetchBusinessInventory = async (businessId) => {
  if (!businessId) {
    throw new Error('Business ID is required');
  }
  
  // FIXED: Use the correct endpoint that matches the backend route
  const endpoint = `business-inventory`;
  return apiRequest(endpoint);
};

/**
 * FIXED: Get business products with proper endpoint calls and error handling
 */
const getBusinessProducts = async (category, search) => {
  const cacheKey = `business_products_${category || 'all'}_${search || 'none'}`;
  const cached = businessCache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < cacheTimeout) {
    return cached.data;
  }
  
  try {
    const businesses = await getAllBusinesses();
    if (businesses.length === 0) return [];
    
    console.log(`🏢 Processing ${businesses.length} businesses for products...`);
    
    const businessPromises = businesses.map(async business => {
      try {
        // FIXED: Use correct backend endpoints that actually exist
        const businessId = business.id || business.email;
        
        // Get business profile with inventory using the fixed endpoint
        let businessProfile = business;
        let inventory = [];
        
        try {
          const profileResponse = await fetchBusinessProfile(businessId);
          if (profileResponse && profileResponse.success && profileResponse.business) {
            businessProfile = { ...business, ...profileResponse.business };
            // If the profile response includes inventory, use it
            if (profileResponse.inventory && Array.isArray(profileResponse.inventory)) {
              inventory = profileResponse.inventory;
            }
          }
        } catch (profileError) {
          console.warn(`⚠️ Profile endpoint failed for ${businessId}:`, profileError.message);
        }
        
        // If we don't have inventory from profile, try the separate inventory endpoint
        if (inventory.length === 0) {
          try {
            const inventoryResponse = await fetchBusinessInventory(businessId);
            if (inventoryResponse && inventoryResponse.success && inventoryResponse.inventory) {
              inventory = inventoryResponse.inventory;
            } else if (Array.isArray(inventoryResponse)) {
              inventory = inventoryResponse;
            }
          } catch (invError) {
            console.warn(`⚠️ Could not fetch inventory for ${businessId}:`, invError.message);
            // Try fallback from profile if it has inventory
            if (businessProfile.inventory && Array.isArray(businessProfile.inventory)) {
              inventory = businessProfile.inventory;
            }
          }
        }
        
        console.log(`📦 Business ${businessProfile.businessName || businessProfile.name}: ${inventory.length} items`);
        
        return convertInventoryToProducts(inventory, businessProfile, category, search);
      } catch (error) {
        console.warn(`⚠️ Business ${business.id || business.email} failed:`, error.message);
        return [];
      }
    });
    
    const businessProductArrays = await Promise.all(businessPromises);
    const allBusinessProducts = businessProductArrays.flat();
    
    console.log(`✅ Total business products: ${allBusinessProducts.length}`);
    
    // Cache the result
    businessCache.set(cacheKey, {
      data: allBusinessProducts,
      timestamp: Date.now()
    });
    
    return allBusinessProducts;
    
  } catch (error) {
    console.error('❌ Business products failed:', error);
    return [];
  }
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
  
  const endpoint = `marketplace/products?${queryParams.toString()}`;
  return apiRequest(endpoint);
};

/**
 * FIXED: Main marketplace loading function
 */
export const getAll = async (page = 1, category = null, search = null, options = {}) => {
  console.log('🛒 Loading marketplace...', { page, category, search, sellerType: options.sellerType });
  
  try {
    let products = [];
    let paginationInfo = { page: 1, pages: 1, count: 0 };
    
    if (options.sellerType === 'individual') {
      // Individual products only
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
      // Business products only
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
      // All products - load both types
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
    
    // Apply price filters
    if (options.minPrice !== undefined || options.maxPrice !== undefined) {
      products = products.filter(product => {
        const price = parseFloat(product.price || 0);
        if (options.minPrice !== undefined && price < options.minPrice) return false;
        if (options.maxPrice !== undefined && price > options.maxPrice) return false;
        return true;
      });
    }
    
    // Apply sorting
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
    
  } catch (error) {
    console.error('❌ Marketplace error:', error);
    return {
      products: [],
      page: 1,
      pages: 1,
      count: 0,
      currentPage: 1,
      filters: { error: true }
    };
  }
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

/**
 * Clear cache when needed
 */
export const clearMarketplaceCache = () => {
  businessCache.clear();
  console.log('🧹 Marketplace cache cleared');
};

// ==========================================
// PRODUCT MANAGEMENT FUNCTIONS
// ==========================================

export const getSpecific = async (id) => {
  if (!id) {
    throw new Error('Product ID is required');
  }
  
  const endpoint = `marketplace/products/specific/${id}`;
  return apiRequest(endpoint);
};

export const wishProduct = async (productId) => {
  if (!productId) {
    throw new Error('Product ID is required');
  }
  
  const endpoint = `marketplace/products/wish/${productId}`;
  return apiRequest(endpoint, { method: 'POST' });
};

export const createProduct = async (productData) => {
  const endpoint = 'marketplace/products/create';
  return apiRequest(endpoint, {
    method: 'POST',
    body: JSON.stringify(productData),
  });
};

export const createPlant = async (plantData) => {
  return createProduct(plantData);
};

export const updateProduct = async (productId, productData) => {
  const endpoint = `marketplace/products/${productId}`;
  return apiRequest(endpoint, {
    method: 'PATCH',
    body: JSON.stringify(productData),
  });
};

export const deleteProduct = async (productId) => {
  const endpoint = `marketplace/products/${productId}`;
  return apiRequest(endpoint, { method: 'DELETE' });
};

export const markAsSold = async (productId, data = {}) => {
  const endpoint = `marketplace/products/${productId}/sold`;
  return apiRequest(endpoint, {
    method: 'POST',
    body: JSON.stringify(data),
  });
};

// ==========================================
// USER PROFILE FUNCTIONS
// ==========================================

export const fetchUserProfile = async (userId) => {
  if (!userId) {
    throw new Error('User ID is required');
  }
  
  const endpoint = `marketplace/users/${userId}`;
  return apiRequest(endpoint);
};

export const updateUserProfile = async (userId, profileData) => {
  const endpoint = `marketplace/users/${userId}`;
  return apiRequest(endpoint, {
    method: 'PATCH',
    body: JSON.stringify(profileData),
  });
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
// IMAGE UPLOAD FUNCTIONS
// ==========================================

export const uploadImage = async (imageData, type = 'plant') => {
  if (!imageData) {
    throw new Error('Image data is required');
  }
  
  const endpoint = 'marketplace/uploadImage';
  
  if (typeof imageData === 'string' && imageData.startsWith('data:')) {
    return apiRequest(endpoint, {
      method: 'POST',
      body: JSON.stringify({ image: imageData, type }),
    });
  }
  
  const formData = new FormData();
  formData.append('file', imageData);
  formData.append('type', type);
  
  return apiRequest(endpoint, {
    method: 'POST',
    body: formData,
    headers: {},
  });
};

// ==========================================
// BUSINESS PURCHASE FUNCTIONS
// ==========================================

export const purchaseBusinessProduct = async (productId, businessId, quantity = 1, customerInfo) => {
  const endpoint = 'business/orders/create';
  
  return apiRequest(endpoint, {
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
};

// ==========================================
// LOCATION FUNCTIONS
// ==========================================

export const getNearbyProducts = async (latitude, longitude, radius = 10, category = null) => {
  if (typeof latitude !== 'number' || typeof longitude !== 'number') {
    throw new Error('Valid coordinates required');
  }
  
  let queryParams = `lat=${latitude}&lon=${longitude}&radius=${radius}`;
  if (category && category !== 'All') {
    queryParams += `&category=${encodeURIComponent(category)}`;
  }
  
  const endpoint = `marketplace/nearbyProducts?${queryParams}`;
  return apiRequest(endpoint);
};

export const getNearbyBusinesses = async (latitude, longitude, radius = 10, businessType = null) => {
  if (typeof latitude !== 'number' || typeof longitude !== 'number') {
    throw new Error('Valid coordinates required');
  }
  
  let queryParams = `lat=${latitude}&lon=${longitude}&radius=${radius}`;
  if (businessType && businessType !== 'all') {
    queryParams += `&businessType=${encodeURIComponent(businessType)}`;
  }
  
  const endpoint = `marketplace/nearby-businesses?${queryParams}`;
  return apiRequest(endpoint);
};

export const geocodeAddress = async (address) => {
  if (!address) {
    throw new Error('Address is required');
  }
  
  const endpoint = `marketplace/geocode?address=${encodeURIComponent(address)}`;
  return apiRequest(endpoint);
};

export const reverseGeocode = async (latitude, longitude) => {
  if (typeof latitude !== 'number' || typeof longitude !== 'number') {
    throw new Error('Valid coordinates required');
  }
  
  const endpoint = `marketplace/reverseGeocode?lat=${latitude}&lon=${longitude}`;
  return apiRequest(endpoint);
};

// ==========================================
// UTILITY FUNCTIONS
// ==========================================

export const speechToText = async (audioUrl, language = 'en-US') => {
  if (!audioUrl) {
    throw new Error('Audio URL is required');
  }

  const endpoint = 'marketplace/speechToText';
  const response = await apiRequest(endpoint, {
    method: 'POST',
    body: JSON.stringify({ audioUrl, language }),
  });

  const text = response.text || '';
  return text.replace(/[.,!?;:'"()\[\]{}]/g, '').replace(/\s+/g, ' ').trim();
};

export const getAzureMapsKey = async () => {
  const endpoint = 'marketplace/maps-config';
  const data = await apiRequest(endpoint);
  
  if (!data.azureMapsKey) {
    throw new Error('No Azure Maps key returned from server');
  }
  
  return data.azureMapsKey;
};

// ==========================================
// MESSAGING FUNCTIONALITY
// ==========================================

export const getNegotiateToken = async () => {
  const userEmail = await AsyncStorage.getItem('userEmail');
  
  if (!userEmail) {
    throw new Error('User email is required for messaging');
  }
  
  const endpoint = 'marketplace/signalr-negotiate';
  return apiRequest(endpoint, {
    method: 'POST',
    body: JSON.stringify({ userId: userEmail }),
  });
};

export const fetchConversations = async (userId) => {
  if (!userId) {
    throw new Error('User ID is required');
  }
  
  const endpoint = 'marketplace/messages/getUserConversations';
  return apiRequest(endpoint);
};

export const fetchMessages = async (chatId, userId) => {
  if (!chatId) {
    throw new Error('Chat ID is required');
  }
  
  const endpoint = `marketplace/messages/getMessages/${chatId}`;
  return apiRequest(endpoint);
};

export const sendMessage = async (chatId, message, senderId) => {
  if (!chatId || !message) {
    throw new Error('Chat ID and message are required');
  }
  
  const endpoint = 'marketplace/messages/sendMessage';
  return apiRequest(endpoint, {
    method: 'POST',
    body: JSON.stringify({
      chatId,
      message,
      senderId,
    }),
  });
};

export const startConversation = async (sellerId, plantId, message, sender) => {
  if (!sellerId || !message || !sender) {
    throw new Error('Seller ID, message, and sender are required');
  }
  
  const endpoint = 'marketplace/messages/createChatRoom';
  return apiRequest(endpoint, {
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
 * Send an order-related message (auto chat for order events)
 * If a conversation exists, sends a message. Otherwise, starts a new conversation.
 * @param {string} recipientId - The user or business to message
 * @param {string} message - The message text
 * @param {string} senderId - The sender's user id/email
 * @param {object} [context] - Optional context (e.g. orderId, confirmationNumber)
 * @returns {Promise<object>} - Result of sending/starting conversation
 */
export const sendOrderMessage = async (recipientId, message, senderId, context = {}) => {
  if (!recipientId || !message || !senderId) throw new Error('recipientId, message, and senderId are required');
  // Try to find an existing conversation
  try {
    // Fetch all conversations for sender
    const conversations = await fetchConversations(senderId);
    let conversation = null;
    if (Array.isArray(conversations)) {
      conversation = conversations.find(
        conv => (conv.sellerId === recipientId || conv.otherUserEmail === recipientId || conv.otherUserId === recipientId)
      );
    }
    if (conversation) {
      // Send message in existing conversation
      return await sendMessage(conversation.id, message, senderId);
    } else {
      // Start new conversation
      return await startConversation(recipientId, context?.orderId || null, message, senderId);
    }
  } catch (err) {
    // Fallback: try to start conversation
    return await startConversation(recipientId, context?.orderId || null, message, senderId);
  }
};

// ==========================================
// REVIEWS FUNCTIONALITY
// ==========================================

export const fetchReviews = async (targetType, targetId) => {
  if (!targetType || !targetId) {
    throw new Error('Target type and ID are required');
  }
  
  const endpoint = `marketplace/reviews/${targetType}/${targetId}`;
  return apiRequest(endpoint);
};

export const submitReview = async (targetId, targetType, reviewData) => {
  if (!targetId || !targetType || !reviewData) {
    throw new Error('Target ID, type, and review data are required');
  }
  
  if (!reviewData.rating || !reviewData.text) {
    throw new Error('Rating and text are required for review');
  }
  
  const endpoint = `submitreview/${targetType}/${targetId}`;
  return apiRequest(endpoint, {
    method: 'POST',
    body: JSON.stringify(reviewData),
  });
};

export const deleteReview = async (targetType, targetId, reviewId) => {
  if (!targetType || !targetId || !reviewId) {
    throw new Error('Target type, target ID, and review ID are required');
  }
  
  const endpoint = `marketplace/reviews/${targetType}/${targetId}/${reviewId}`;
  return apiRequest(endpoint, { method: 'DELETE' });
};

// ==========================================
// EXPORT ALL FUNCTIONS
// ==========================================

export default {
  getAll,
  getSpecific,
  wishProduct,
  createProduct,
  createPlant,
  updateProduct,
  deleteProduct,
  markAsSold,
  fetchUserProfile,
  fetchBusinessProfile,
  updateUserProfile,
  getUserListings,
  getUserWishlist,
  uploadImage,
  getNearbyProducts,
  getNearbyBusinesses, 
  geocodeAddress,
  reverseGeocode,
  speechToText,
  getAzureMapsKey,
  getNegotiateToken,
  fetchConversations,
  fetchMessages,
  sendMessage,
  startConversation,
  markMessagesAsRead,
  fetchReviews,
  submitReview,
  deleteReview,
  purchaseBusinessProduct,
  setAuthToken,
  clearMarketplaceCache,
  sendTypingIndicator,
  sendOrderMessage
};