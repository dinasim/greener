// services/marketplaceApi.js - ENHANCED PRODUCTION VERSION WITH IMPROVED IMAGE HANDLING
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
 * Helper function to handle API requests with proper error handling
 */
const apiRequest = async (endpoint, options = {}) => {
  try {
    const token = await AsyncStorage.getItem('googleAuthToken');
    const userEmail = await AsyncStorage.getItem('userEmail');
    
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
    
    const url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;
    
    const response = await fetch(url, {
      ...options,
      headers,
    });
    
    let data;
    try {
      data = await response.json();
    } catch (e) {
      data = { error: 'Invalid response format' };
    }
    
    if (!response.ok) {
      throw new Error(data.error || data.message || `Request failed with status ${response.status}`);
    }
    
    return data;
  } catch (error) {
    console.error(`❌ API request failed (${endpoint}):`, error);
    throw error;
  }
};

// ==========================================
// ENHANCED IMAGE PROCESSING FUNCTIONS
// ==========================================

/**
 * Process business product images for marketplace display
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
  
  // Filter out empty/null images and ensure they're valid URLs
  const validImages = allImageSources.filter(img => {
    if (!img || typeof img !== 'string') return false;
    // Basic URL validation and exclude malformed URLs
    if (img.startsWith('http') && img.length > 20) {
      // Exclude obvious malformed URLs
      if (img.includes('FFFFFF') || img.includes('500') || img.match(/^[A-F0-9]{1,6}$/i)) {
        return false;
      }
      return true;
    }
    return img.startsWith('data:') || img.startsWith('/');
  });
  
  // Process images for different display needs
  const mainImage = validImages[0] || null;
  const additionalImages = validImages.slice(1);
  const allImages = validImages;
  
  // Create different image sizes for optimization
  const thumbnails = validImages.map(url => createThumbnailUrl(url));
  const highRes = validImages.map(url => createHighResUrl(url));
  
  return {
    mainImage,
    additionalImages,
    allImages,
    hasImages: validImages.length > 0,
    imageCount: validImages.length,
    thumbnails,
    highRes,
  };
};

/**
 * Create thumbnail URL
 */
const createThumbnailUrl = (originalUrl) => {
  if (!originalUrl) return null;
  
  // In a real implementation, this would integrate with an image processing service
  if (originalUrl.includes('?')) {
    return `${originalUrl}&thumbnail=true`;
  }
  return `${originalUrl}?thumbnail=true`;
};

/**
 * Create high-res URL
 */
const createHighResUrl = (originalUrl) => {
  if (!originalUrl) return null;
  
  // In a real implementation, this would ensure high quality
  if (originalUrl.includes('?')) {
    return `${originalUrl}&quality=high`;
  }
  return `${originalUrl}?quality=high`;
};

/**
 * Get difficulty text for plants
 */
const getDifficultyText = (difficulty) => {
  if (!difficulty) return 'Unknown';
  
  const level = parseInt(difficulty);
  if (level <= 3) return 'Beginner-friendly';
  if (level <= 6) return 'Moderate care';
  if (level <= 8) return 'Advanced care';
  return 'Expert level';
};

/**
 * Get business location display text
 */
const getBusinessLocationDisplay = (business) => {
  const location = business.address || business.location || {};
  
  if (location.city && location.address) {
    return `${location.address}, ${location.city}`;
  } else if (location.city) {
    return location.city;
  } else if (location.address) {
    return location.address;
  } else if (business.businessName) {
    return `${business.businessName} - Contact for pickup`;
  } else {
    return 'Contact seller for pickup location';
  }
};

/**
 * Get formatted address
 */
const getFormattedAddress = (location) => {
  if (!location) return '';
  
  const parts = [];
  if (location.address || location.street) parts.push(location.address || location.street);
  if (location.city) parts.push(location.city);
  if (location.country) parts.push(location.country);
  
  return parts.join(', ') || '';
};

/**
 * Get pickup information
 */
const getPickupInfo = (business) => {
  const location = business.address || business.location || {};
  
  return {
    available: true, // Business products are always pickup
    location: getBusinessLocationDisplay(business),
    businessName: business.businessName || business.name || 'Business',
    businessType: business.businessType || 'Business',
    phone: business.phone || business.contactPhone || '',
    email: business.email || business.contactEmail || '',
    hours: business.businessHours || [],
    instructions: business.pickupInstructions || 'Contact business for pickup details',
    logo: business.logo || business.businessImage || business.avatar,
  };
};

/**
 * ENHANCED: Convert inventory to products with comprehensive image handling
 */
const convertInventoryToMarketplaceProductsFast = (inventory, business, category, search) => {
  return inventory
    .filter(item => {
      // Basic active/stock filter
      if (item.status !== 'active' || (item.quantity || 0) <= 0) return false;
      
      // Category filter
      if (category && category !== 'All') {
        if (item.category?.toLowerCase() !== category.toLowerCase()) return false;
      }
      
      // Search filter
      if (search) {
        const searchLower = search.toLowerCase();
        const itemName = (item.name || item.common_name || '').toLowerCase();
        const itemDesc = (item.description || '').toLowerCase();
        const businessName = (business.businessName || business.name || '').toLowerCase();
        const businessType = (business.businessType || '').toLowerCase();
        
        if (!itemName.includes(searchLower) && 
            !itemDesc.includes(searchLower) && 
            !businessName.includes(searchLower) &&
            !businessType.includes(searchLower)) return false;
      }
      
      return true;
    })
    .map(item => {
      // ENHANCED: Process images properly for marketplace display
      const processedImages = processBusinessProductImages(item, business);
      
      // ENHANCED: Better business location handling
      const businessLocation = business.address || business.location || {};
      const locationDisplay = getBusinessLocationDisplay(business);
      
      return {
        id: item.id,
        _id: item.id,
        title: item.name || item.common_name || 'Business Product',
        name: item.name || item.common_name || 'Business Product',
        common_name: item.common_name,
        scientific_name: item.scientific_name || item.scientificName,
        description: item.description || `${item.name || item.common_name} from ${business.businessName || business.name}`,
        price: item.finalPrice || item.price || 0,
        originalPrice: item.price || 0,
        discount: item.discount || 0,
        category: item.category || 'Plants',
        productType: item.productType || 'plant',
        
        // ENHANCED: Proper image handling for PlantCard component
        image: processedImages.mainImage, // Main image for PlantCard
        mainImage: processedImages.mainImage,
        images: processedImages.allImages, // All images array
        imageUrls: processedImages.allImages, // Alternative field name
        hasImages: processedImages.hasImages,
        imageCount: processedImages.imageCount,
        
        // Enhanced image metadata for better display
        imageInfo: {
          main: processedImages.mainImage,
          additional: processedImages.additionalImages,
          count: processedImages.imageCount,
          hasImages: processedImages.hasImages,
          thumbnails: processedImages.thumbnails,
          highRes: processedImages.highRes,
        },
        
        businessId: business.id || business.email,
        sellerId: business.id || business.email,
        sellerType: 'business',
        isBusinessListing: true,
        inventoryId: item.id,
        
        // ENHANCED: Better seller info
        seller: {
          _id: business.id || business.email,
          name: business.businessName || business.name || 'Business',
          email: business.email || business.id,
          isBusiness: true,
          businessName: business.businessName || business.name,
          businessType: business.businessType || 'Business',
          logo: business.logo || business.businessImage || business.avatar,
          hasLogo: !!(business.logo || business.businessImage || business.avatar),
          rating: business.rating || 0,
          reviewCount: business.reviewCount || 0,
          description: business.description || '',
          phone: business.phone || business.contactPhone || '',
          
          location: {
            address: businessLocation.address || businessLocation.street || '',
            city: businessLocation.city || 'Unknown location',
            country: businessLocation.country || '',
            latitude: businessLocation.latitude,
            longitude: businessLocation.longitude,
            formattedAddress: getFormattedAddress(businessLocation)
          }
        },
        
        // ENHANCED: Better availability display
        availability: {
          inStock: (item.quantity || 0) > 0,
          quantity: item.quantity || 0,
          showQuantity: true,
          pickupLocation: locationDisplay,
          businessType: business.businessType || 'Business',
          pickupOnly: true,
          deliveryOptions: [],
        },
        
        // ENHANCED: Location for product display
        location: {
          city: businessLocation.city || 'Unknown location',
          address: businessLocation.address || businessLocation.street || '',
          latitude: businessLocation.latitude,
          longitude: businessLocation.longitude,
          formattedAddress: getFormattedAddress(businessLocation),
          displayText: locationDisplay,
          isBusinessLocation: true,
        },
        
        addedAt: item.addedAt || item.dateAdded || new Date().toISOString(),
        listedDate: item.addedAt || item.dateAdded || new Date().toISOString(),
        lastUpdated: item.updatedAt || item.lastUpdated,
        
        stats: {
          views: item.viewCount || 0,
          wishlistCount: 0,
          messageCount: 0
        },
        
        source: 'business_inventory',
        
        // Business-specific display info
        businessInfo: {
          type: business.businessType || 'Business',
          name: business.businessName || business.name || 'Business',
          verified: business.verificationStatus === 'verified' || business.isVerified || false,
          description: business.description || '',
          logo: business.logo || business.businessImage || business.avatar,
          hasLogo: !!(business.logo || business.businessImage || business.avatar),
          pickupInfo: getPickupInfo(business),
          galleryImages: business.galleryImages || [],
          hasGallery: !!(business.galleryImages && business.galleryImages.length > 0),
        },
        
        // Enhanced care information for plants
        careInfo: item.plantData ? {
          watering: item.plantData.water_days ? `Every ${item.plantData.water_days} days` : 'Standard watering',
          light: item.plantData.light || 'Bright indirect light',
          humidity: item.plantData.humidity || 'Average humidity',
          temperature: item.plantData.temperature || 'Room temperature',
          difficulty: item.plantData.difficulty || 5,
          difficultyText: getDifficultyText(item.plantData.difficulty),
          pets: item.plantData.pets || 'Unknown pet safety',
          repot: item.plantData.repot || 'As needed',
          feed: item.plantData.feed || 'Monthly during growing season',
          commonProblems: item.plantData.common_problems || [],
        } : null,
        
        // Marketplace optimization flags
        marketplaceOptimized: true,
        displayReady: true,
        searchable: true,
        imagesProcessed: true,
      };
    });
};

// ==========================================
// CORE MARKETPLACE FUNCTIONS
// ==========================================

/**
 * OPTIMIZED: Get marketplace products - Fast and reliable
 */
export const getAll = async (page = 1, category = null, search = null, options = {}) => {
  console.log('🛒 [FAST] Loading marketplace...', { 
    sellerType: options.sellerType, 
    page,
    category,
    search,
    options 
  });
  
  try {
    // Quick seller type counts (from cache if available)
    const counts = await getSellerTypeCountsFast();
    
    let products = [];
    let paginationInfo = { page: 1, pages: 1, count: 0 };
    
    // DEBUG: Log the actual sellerType value
    console.log('🔍 [DEBUG] sellerType value:', `"${options.sellerType}"`, 'type:', typeof options.sellerType);
    
    // Branch by seller type for maximum efficiency
    if (options.sellerType === 'individual') {
      // INDIVIDUAL ONLY - Direct API call
      console.log('👤 [FAST] Individual only...');
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
      // BUSINESS ONLY - Optimized business loading
      console.log('🏢 [FAST] Business only...');
      const businessProducts = await getBusinessProductsFast(category, search, options);
      
      // Simple pagination for business products
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
      // ALL - Load both types efficiently
      console.log('👥 [FAST] All types...');
      
      // Load individual products (primary)
      const individualData = await getIndividualProducts(page, category, search, options);
      const individualProducts = (individualData.products || []).map(product => ({
        ...product,
        sellerType: 'individual',
        isBusinessListing: false,
        seller: { ...product.seller, isBusiness: false }
      }));
      
      // Load business products (additional)
      const businessProducts = await getBusinessProductsFast(category, search, options);
      
      products = [...individualProducts, ...businessProducts];
      paginationInfo = {
        page: individualData.page || page,
        pages: Math.max(individualData.pages || 1, Math.ceil(products.length / 20)),
        count: products.length
      };
    }
    
    // Apply final filters
    let filteredProducts = products;
    
    // Price filter
    if (options.minPrice !== undefined || options.maxPrice !== undefined) {
      filteredProducts = filteredProducts.filter(product => {
        const price = parseFloat(product.price || 0);
        if (options.minPrice !== undefined && price < options.minPrice) return false;
        if (options.maxPrice !== undefined && price > options.maxPrice) return false;
        return true;
      });
    }
    
    // Sorting
    if (options.sortBy) {
      filteredProducts = sortProducts(filteredProducts, options.sortBy);
    } else {
      filteredProducts.sort((a, b) => 
        new Date(b.addedAt || b.listedDate || 0) - new Date(a.addedAt || a.listedDate || 0)
      );
    }
    
    console.log(`✅ [FAST] Returning ${filteredProducts.length} products`);
    
    return {
      products: filteredProducts,
      page: paginationInfo.page,
      pages: paginationInfo.pages,
      count: paginationInfo.count,
      currentPage: page,
      filters: { category, search, ...options },
      sellerTypeCounts: counts
    };
    
  } catch (error) {
    console.error('❌ [FAST] Marketplace error:', error);
    
    // Fallback to individual products only
    try {
      const fallbackData = await getIndividualProducts(1, null, null, {});
      return {
        products: fallbackData.products || [],
        page: 1,
        pages: fallbackData.pages || 1,
        count: fallbackData.count || 0,
        currentPage: 1,
        filters: { fallback: true },
        sellerTypeCounts: { all: 0, individual: 0, business: 0 },
        fromFallback: true
      };
    } catch (fallbackError) {
      throw error;
    }
  }
};

/**
 * FAST: Get seller type counts with caching
 */
const getSellerTypeCountsFast = async () => {
  const cacheKey = 'seller_counts';
  const cached = businessCache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < cacheTimeout) {
    return cached.data;
  }
  
  try {
    // Get counts in parallel for speed
    const [individualCount, businessCount] = await Promise.all([
      getIndividualProducts(1, null, null, {})
        .then(data => data.count || 0)
        .catch(() => 0),
      getBusinessCountFast()
    ]);
    
    const counts = {
      all: individualCount + businessCount,
      individual: individualCount,
      business: businessCount
    };
    
    // Cache the result
    businessCache.set(cacheKey, {
      data: counts,
      timestamp: Date.now()
    });
    
    return counts;
  } catch (error) {
    return { all: 0, individual: 0, business: 0 };
  }
};

/**
 * FAST: Get business count only
 */
const getBusinessCountFast = async () => {
  const cacheKey = 'business_count';
  const cached = businessCache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < cacheTimeout) {
    return cached.data;
  }
  
  try {
    const businesses = await getAllBusinessesFast();
    let totalCount = 0;
    
    // Process up to 3 businesses in parallel for speed
    const businessPromises = businesses.slice(0, 3).map(async business => {
      try {
        const response = await apiRequest(`marketplace/business-profile/${business.id || business.email}`);
        const inventory = response.business?.inventory || response.inventory || [];
        return inventory.filter(item => item.status === 'active' && (item.quantity || 0) > 0).length;
      } catch (e) {
        return 0;
      }
    });
    
    const counts = await Promise.all(businessPromises);
    totalCount = counts.reduce((sum, count) => sum + count, 0);
    
    // Cache the result
    businessCache.set(cacheKey, {
      data: totalCount,
      timestamp: Date.now()
    });
    
    return totalCount;
  } catch (error) {
    return 0;
  }
};

/**
 * ENHANCED: Get business products with comprehensive image support
 */
const getBusinessProductsFast = async (category, search, options) => {
  const cacheKey = `business_products_${category || 'all'}_${search || 'none'}_${options.includeImages ? 'with_images' : 'no_images'}`;
  const cached = businessCache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < cacheTimeout) {
    console.log('🚀 [CACHE] Using cached business products with images');
    return cached.data;
  }
  
  try {
    const businesses = await getAllBusinessesFast();
    
    if (businesses.length === 0) {
      return [];
    }
    
    // Process businesses in parallel for speed (max 5 for better image loading)
    const businessPromises = businesses.slice(0, 5).map(async business => {
      try {
        const response = await apiRequest(`marketplace/business-profile/${business.id || business.email}`, {
          headers: {
            'X-Include-Images': 'true',
            'X-Image-Quality': 'marketplace',
            'X-Generate-Thumbnails': 'true',
          }
        });
        
        const businessProfile = response.business || response;
        const inventory = businessProfile.inventory || [];
        
        return convertInventoryToMarketplaceProductsFast(inventory, businessProfile, category, search);
      } catch (error) {
        console.warn(`Business ${business.id} failed (images):`, error.message);
        return [];
      }
    });
    
    const businessProductArrays = await Promise.all(businessPromises);
    const allBusinessProducts = businessProductArrays.flat();
    
    // ENHANCED: Validate that products have proper image data
    const validatedProducts = allBusinessProducts.map(product => ({
      ...product,
      // Ensure image fields are properly set for PlantCard component
      image: product.image || product.mainImage || null,
      images: product.images || product.allImages || [],
      hasValidImages: !!(product.image || product.mainImage),
      
      // Add marketplace display metadata
      displayMetadata: {
        hasImages: !!(product.image || product.mainImage),
        imageCount: (product.images || []).length + (product.image ? 1 : 0),
        businessName: product.seller?.businessName || 'Business',
        businessType: product.seller?.businessType || 'Business',
        pickupLocation: product.location?.displayText || 'Contact for pickup',
        verified: product.businessInfo?.verified || false,
      }
    }));
    
    // Cache the result with image metadata
    businessCache.set(cacheKey, {
      data: validatedProducts,
      timestamp: Date.now(),
      metadata: {
        totalProducts: validatedProducts.length,
        productsWithImages: validatedProducts.filter(p => p.hasValidImages).length,
        businesses: businesses.length,
      }
    });
    
    console.log(`✅ [FAST] Loaded ${validatedProducts.length} business products with images`);
    console.log(`📸 [IMAGES] ${validatedProducts.filter(p => p.hasValidImages).length} products have images`);
    
    return validatedProducts;
    
  } catch (error) {
    console.error('❌ Business products with images failed:', error);
    return [];
  }
};

/**
 * FAST: Get businesses with caching
 */
const getAllBusinessesFast = async () => {
  const cacheKey = 'all_businesses';
  const cached = businessCache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < cacheTimeout) {
    return cached.data;
  }
  
  try {
    const response = await apiRequest('marketplace/businesses');
    const businesses = response.businesses || [];
    
    // Cache the result
    businessCache.set(cacheKey, {
      data: businesses,
      timestamp: Date.now()
    });
    
    return businesses;
  } catch (error) {
    // Fallback to test business
    const fallback = [{
      id: 'dina2@mail.tau.ac.il',
      email: 'dina2@mail.tau.ac.il',
      businessName: 'Dina\'s Plant Shop',
      name: 'Dina\'s Plant Shop'
    }];
    
    // Cache fallback too
    businessCache.set(cacheKey, {
      data: fallback,
      timestamp: Date.now()
    });
    
    return fallback;
  }
};

/**
 * Get individual products (existing marketplace functionality)
 */
const getIndividualProducts = async (page, category, search, options) => {
  const queryParams = new URLSearchParams();
  
  queryParams.append('page', page);
  if (category && category !== 'All') queryParams.append('category', category);
  if (search) queryParams.append('search', search);
  if (options.minPrice !== undefined) queryParams.append('minPrice', options.minPrice);
  if (options.maxPrice !== undefined) queryParams.append('maxPrice', options.maxPrice);
  if (options.sortBy) queryParams.append('sortBy', options.sortBy);
  
  const endpoint = `marketplace/products?${queryParams.toString()}`;
  return apiRequest(endpoint);
};

/**
 * Sort products helper
 */
const sortProducts = (products, sortBy) => {
  switch (sortBy) {
    case 'recent':
      return products.sort((a, b) => new Date(b.addedAt) - new Date(a.addedAt));
    case 'oldest':
      return products.sort((a, b) => new Date(a.addedAt) - new Date(b.addedAt));
    case 'priceAsc':
      return products.sort((a, b) => parseFloat(a.price) - parseFloat(b.price));
    case 'priceDesc':
      return products.sort((a, b) => parseFloat(b.price) - parseFloat(a.price));
    case 'rating':
      return products.sort((a, b) => (b.seller?.rating || 0) - (a.seller?.rating || 0));
    case 'title':
      return products.sort((a, b) => (a.title || a.name || '').localeCompare(b.title || b.name || ''));
    default:
      return products;
  }
};

/**
 * Clear cache when needed (call this on logout or data changes)
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
  
  return apiRequest(endpoint, {
    method: 'POST',
  });
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
  
  return apiRequest(endpoint, {
    method: 'DELETE',
  });
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

export const fetchBusinessProfile = async (businessId) => {
  try {
    const response = await apiRequest(`marketplace/business-profile/${businessId}`);
    return response;
  } catch (error) {
    console.error('❌ Error fetching business profile:', error);
    throw error;
  }
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
  
  if (Platform.OS === 'web') {
    if (imageData instanceof Blob) {
      const formData = new FormData();
      formData.append('file', imageData);
      formData.append('type', type);
      
      return apiRequest(endpoint, {
        method: 'POST',
        body: formData,
        headers: {},
      });
    } else if (imageData.startsWith('data:')) {
      return apiRequest(endpoint, {
        method: 'POST',
        body: JSON.stringify({ image: imageData, type }),
      });
    }
  }
  
  const formData = new FormData();
  formData.append('file', {
    uri: imageData,
    type: 'image/jpeg',
    name: 'upload.jpg',
  });
  formData.append('type', type);
  
  return apiRequest(endpoint, {
    method: 'POST',
    body: formData,
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
};

// ==========================================
// BUSINESS PURCHASE FUNCTIONS
// ==========================================

export const purchaseBusinessProduct = async (productId, businessId, quantity = 1, customerInfo) => {
  try {
    const response = await apiRequest('business/orders/create', {
      method: 'POST',
      body: JSON.stringify({
        businessId: businessId,
        customerEmail: customerInfo.email,
        customerName: customerInfo.name,
        customerPhone: customerInfo.phone,
        items: [{
          id: productId,
          quantity: quantity
        }],
        notes: customerInfo.notes || '',
        communicationPreference: 'messages'
      })
    });
    
    return {
      success: true,
      orderId: response.order?.orderId,
      confirmationNumber: response.order?.confirmationNumber,
      message: 'Order placed successfully! You can pick up your plant at the business location.',
      ...response
    };
    
  } catch (error) {
    console.error('❌ Purchase error:', error);
    throw error;
  }
};

// ==========================================
// LOCATION FUNCTIONS
// ==========================================

export const getNearbyProducts = async (latitude, longitude, radius = 10, category = null) => {
  try {
    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      throw new Error('Valid coordinates required');
    }
    
    let queryParams = `lat=${latitude}&lon=${longitude}&radius=${radius}`;
    if (category && category !== 'All') {
      queryParams += `&category=${encodeURIComponent(category)}`;
    }
    
    const headers = {
      'Content-Type': 'application/json',
    };
    
    const userEmail = await AsyncStorage.getItem('userEmail');
    if (userEmail) {
      headers['X-User-Email'] = userEmail;
    }
    
    const response = await fetch(`${API_BASE_URL}/marketplace/nearbyProducts?${queryParams}`, {
      method: 'GET',
      headers: headers,
    });
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching nearby products:', error);
    throw error;
  }
};

export const getNearbyBusinesses = async (latitude, longitude, radius = 10, businessType = null) => {
  try {
    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      throw new Error('Valid coordinates required');
    }
    
    console.log('🗺️ Getting nearby businesses:', { latitude, longitude, radius, businessType });
    
    const headers = {
      'Content-Type': 'application/json',
    };
    
    const userEmail = await AsyncStorage.getItem('userEmail');
    if (userEmail) {
      headers['X-User-Email'] = userEmail;
    }
    
    let queryParams = `lat=${latitude}&lon=${longitude}&radius=${radius}`;
    if (businessType && businessType !== 'all') {
      queryParams += `&businessType=${encodeURIComponent(businessType)}`;
    }
    
    const response = await fetch(`${API_BASE_URL}/marketplace/nearby-businesses?${queryParams}`, {
      method: 'GET',
      headers: headers,
    });
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Process and enhance business data
    const businesses = (data.businesses || []).map(business => ({
      ...business,
      distance: business.distance || 0,
      isBusiness: true,
      location: business.location || {
        latitude: business.address?.latitude,
        longitude: business.address?.longitude,
        city: business.address?.city || 'Unknown location'
      }
    }));
    
    // Cache nearby businesses
    try {
      const cacheKey = `nearby_businesses_${latitude}_${longitude}_${radius}`;
      businessCache.set(cacheKey, {
        data: { ...data, businesses },
        timestamp: Date.now()
      });
    } catch (cacheError) {
      console.warn('⚠️ Failed to cache nearby businesses:', cacheError);
    }
    
    return {
      ...data,
      businesses,
      count: businesses.length
    };
  } catch (error) {
    console.error('❌ Get nearby businesses error:', error);
    
    // Try to return cached businesses on error
    try {
      const cacheKey = `nearby_businesses_${latitude}_${longitude}_${radius}`;
      const cached = businessCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < cacheTimeout) {
        console.log('📱 Returning cached nearby businesses');
        return { ...cached.data, fromCache: true };
      }
    } catch (cacheError) {
      console.warn('⚠️ Failed to load cached nearby businesses:', cacheError);
    }
    
    throw error;
  }
};

export const geocodeAddress = async (address) => {
  try {
    if (!address) {
      throw new Error('Address is required');
    }
    
    const response = await fetch(`${API_BASE_URL}/marketplace/geocode?address=${encodeURIComponent(address)}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error geocoding address:', error);
    throw error;
  }
};

export const reverseGeocode = async (latitude, longitude) => {
  try {
    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      throw new Error('Valid coordinates required');
    }
    
    const response = await fetch(`${API_BASE_URL}/marketplace/reverseGeocode?lat=${latitude}&lon=${longitude}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error reverse geocoding:', error);
    throw error;
  }
};

// ==========================================
// UTILITY FUNCTIONS
// ==========================================

export const speechToText = async (audioUrl, language = 'en-US') => {
  if (!audioUrl) {
    throw new Error('Audio URL is required');
  }

  const endpoint = 'marketplace/speechToText';

  try {
    const response = await apiRequest(endpoint, {
      method: 'POST',
      body: JSON.stringify({ audioUrl, language }),
    });

    const text = response.text;

    const cleanupTranscriptionText = (text) => {
      return typeof text === 'string'
        ? text.replace(/[.,!?;:'"()\[\]{}]/g, '').replace(/\s+/g, ' ').trim()
        : '';
    };

    return cleanupTranscriptionText(text);
  } catch (error) {
    console.error('Error in speechToText:', error);
    throw error;
  }
};

export const getAzureMapsKey = async () => {
  try {
    const userEmail = await AsyncStorage.getItem('userEmail');
    
    const headers = {
      'Content-Type': 'application/json',
    };
    
    if (userEmail) {
      headers['X-User-Email'] = userEmail;
    }
    
    const response = await fetch(`${API_BASE_URL}/marketplace/maps-config`, {
      method: 'GET',
      headers: headers,
    });
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.azureMapsKey) {
      throw new Error('No Azure Maps key returned from server');
    }
    
    return data.azureMapsKey;
  } catch (error) {
    console.error('Error getting Azure Maps key:', error);
    throw error;
  }
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
  
  return apiRequest(endpoint, {
    method: 'DELETE',
  });
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
  sendTypingIndicator,
  fetchReviews,
  submitReview,
  deleteReview,
  purchaseBusinessProduct,
  setAuthToken,
  clearMarketplaceCache
};