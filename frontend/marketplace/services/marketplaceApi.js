// services/marketplaceApi.js - ENHANCED WITH BUSINESS PRODUCTS
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import config from './config';

// Base URL for API requests
const API_BASE_URL = config.API_BASE_URL || 'https://usersfunctions.azurewebsites.net/api';

/**
 * Helper function to handle API requests with proper error handling
 * @param {string} endpoint - API endpoint to call
 * @param {Object} options - Fetch options
 * @returns {Promise<Object>} - Response data
 */
const apiRequest = async (endpoint, options = {}) => {
  try {
    // Get authentication token and user email
    const token = await AsyncStorage.getItem('googleAuthToken');
    const userEmail = await AsyncStorage.getItem('userEmail');
    
    // Default headers with authentication
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };
    
    // Add authentication headers if available
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    if (userEmail) {
      headers['X-User-Email'] = userEmail;
    }
    
    // Full URL with endpoint
    const url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;
    
    // Make the request
    const response = await fetch(url, {
      ...options,
      headers,
    });
    
    // Parse response
    let data;
    try {
      data = await response.json();
    } catch (e) {
      console.warn('Error parsing JSON response:', e);
      data = { error: 'Invalid response format' };
    }
    
    // Check for errors
    if (!response.ok) {
      throw new Error(data.error || data.message || `Request failed with status ${response.status}`);
    }
    
    return data;
  } catch (error) {
    console.error(`API request failed (${endpoint}):`, error);
    throw error;
  }
};

/**
 * Get all marketplace products WITH BUSINESS PRODUCTS
 * @param {number} page - Page number
 * @param {string} category - Category filter
 * @param {string} search - Search query
 * @param {Object} options - Additional options (minPrice, maxPrice, sortBy, sellerType)
 * @returns {Promise<Object>} - Response with products array and pagination info
 */
export const getAll = async (page = 1, category = null, search = null, options = {}) => {
  try {
    console.log('🛒 Loading marketplace with business products...', { page, category, search, options });
    
    let allProducts = [];
    let sellerTypeCounts = { all: 0, individual: 0, business: 0 };
    
    // 1. Get Individual Products (existing marketplace)
    if (!options.sellerType || options.sellerType === 'all' || options.sellerType === 'individual') {
      try {
        const individualResponse = await getIndividualProducts(page, category, search, options);
        const individualProducts = (individualResponse.products || []).map(product => ({
          ...product,
          sellerType: 'individual',
          isBusinessListing: false,
          seller: {
            ...product.seller,
            isBusiness: false
          }
        }));
        allProducts.push(...individualProducts);
        sellerTypeCounts.individual = individualProducts.length;
      } catch (error) {
        console.warn('⚠️ Failed to load individual products:', error.message);
      }
    }

    // 2. Get Business Products (from inventory)
    if (!options.sellerType || options.sellerType === 'all' || options.sellerType === 'business') {
      try {
        const businessProducts = await getBusinessProducts(category, search, options);
        allProducts.push(...businessProducts);
        sellerTypeCounts.business = businessProducts.length;
      } catch (error) {
        console.warn('⚠️ Failed to load business products:', error.message);
      }
    }

    // 3. Apply filters and sorting
    let filteredProducts = allProducts;

    // Filter by seller type
    if (options.sellerType && options.sellerType !== 'all') {
      filteredProducts = allProducts.filter(product => 
        product.sellerType === options.sellerType
      );
    }

    // Apply price filters
    if (options.minPrice !== undefined || options.maxPrice !== undefined) {
      filteredProducts = filteredProducts.filter(product => {
        const price = parseFloat(product.price || 0);
        if (options.minPrice !== undefined && price < options.minPrice) return false;
        if (options.maxPrice !== undefined && price > options.maxPrice) return false;
        return true;
      });
    }

    // Apply sorting
    if (options.sortBy) {
      filteredProducts = sortProducts(filteredProducts, options.sortBy);
    } else {
      // Default: newest first
      filteredProducts.sort((a, b) => 
        new Date(b.addedAt || b.listedDate || 0) - new Date(a.addedAt || a.listedDate || 0)
      );
    }

    // 4. Pagination
    const pageSize = 20;
    const totalItems = filteredProducts.length;
    const totalPages = Math.ceil(totalItems / pageSize);
    const startIndex = (page - 1) * pageSize;
    const paginatedProducts = filteredProducts.slice(startIndex, startIndex + pageSize);

    // Update total counts
    sellerTypeCounts.all = allProducts.length;

    console.log(`✅ Loaded ${allProducts.length} total products (${sellerTypeCounts.individual} individual, ${sellerTypeCounts.business} business)`);

    return {
      products: paginatedProducts,
      page: page,
      pages: totalPages,
      count: totalItems,
      currentPage: page,
      filters: {
        category,
        search,
        ...options
      },
      sellerTypeCounts
    };

  } catch (error) {
    console.error('❌ Enhanced marketplace load error:', error);
    throw error;
  }
};

/**
 * Get individual products (existing marketplace functionality)
 */
const getIndividualProducts = async (page, category, search, options) => {
  const queryParams = new URLSearchParams();
  
  queryParams.append('page', page);
  if (category) queryParams.append('category', category);
  if (search) queryParams.append('search', search);
  if (options.minPrice !== undefined) queryParams.append('minPrice', options.minPrice);
  if (options.maxPrice !== undefined) queryParams.append('maxPrice', options.maxPrice);
  if (options.sortBy) queryParams.append('sortBy', options.sortBy);
  
  const endpoint = `marketplace/products?${queryParams.toString()}`;
  return apiRequest(endpoint);
};

/**
 * Get business products from all business inventories using existing endpoints
 */
const getBusinessProducts = async (category, search, options) => {
  try {
    console.log('🏢 Loading business products...');
    
    // Get list of all businesses using your existing endpoint
    const businesses = await getAllBusinesses();
    console.log(`📋 Found ${businesses.length} businesses`);
    
    let allBusinessProducts = [];
    
    // Get inventory for each business using your existing business profile endpoint
    for (const business of businesses) {
      try {
        // Use your existing endpoint that gets business profile + inventory
        const response = await apiRequest(`marketplace/business-profile/${business.id || business.email}`);
        const businessProfile = response.business || response;
        const inventory = businessProfile.inventory || [];
        
        console.log(`📦 Business ${business.businessName}: ${inventory.length} items`);
        
        const businessProducts = convertInventoryToMarketplaceProducts(inventory, businessProfile);
        
        // Apply filters to business products
        let filteredBusinessProducts = businessProducts;
        
        // Category filter
        if (category && category !== 'All') {
          filteredBusinessProducts = filteredBusinessProducts.filter(product =>
            product.category?.toLowerCase() === category.toLowerCase()
          );
        }
        
        // Search filter
        if (search) {
          const searchLower = search.toLowerCase();
          filteredBusinessProducts = filteredBusinessProducts.filter(product =>
            product.title?.toLowerCase().includes(searchLower) ||
            product.name?.toLowerCase().includes(searchLower) ||
            product.description?.toLowerCase().includes(searchLower) ||
            product.seller?.name?.toLowerCase().includes(searchLower)
          );
        }
        
        allBusinessProducts.push(...filteredBusinessProducts);
        
      } catch (inventoryError) {
        console.warn(`⚠️ Failed to load inventory for business ${business.id}:`, inventoryError.message);
      }
    }
    
    console.log(`✅ Loaded ${allBusinessProducts.length} business products`);
    return allBusinessProducts;
    
  } catch (error) {
    console.error('❌ Error loading business products:', error);
    return [];
  }
};

/**
 * Get all businesses using your existing endpoint
 */
const getAllBusinesses = async () => {
  try {
    const response = await apiRequest('marketplace/businesses');
    return response.businesses || [];
  } catch (error) {
    console.warn('⚠️ Businesses endpoint not available, using fallback');
    
    // Fallback: return known test businesses
    return [
      { 
        id: 'dina2@mail.tau.ac.il', 
        email: 'dina2@mail.tau.ac.il',
        businessName: 'Dina\'s Plant Shop',
        name: 'Dina\'s Plant Shop'
      }
    ];
  }
};

/**
 * Convert business inventory items to marketplace product format
 */
const convertInventoryToMarketplaceProducts = (inventory, business) => {
  return inventory
    .filter(item => {
      // Only include active items with stock
      return item.status === 'active' && (item.quantity || 0) > 0;
    })
    .map(item => ({
      // Product identifiers
      id: item.id,
      _id: item.id,
      
      // Product info
      title: item.name || item.common_name || 'Business Product',
      name: item.name || item.common_name || 'Business Product',
      common_name: item.common_name,
      scientific_name: item.scientific_name || item.scientificName,
      description: item.description || `${item.name || item.common_name} available at ${business.businessName || business.name}`,
      
      // Pricing
      price: item.finalPrice || item.price || 0,
      originalPrice: item.price || 0,
      discount: item.discount || 0,
      
      // Category and type
      category: item.category || 'Plants',
      productType: item.productType || 'plant',
      
      // Images
      images: item.images || [],
      mainImage: item.mainImage,
      
      // Business-specific fields
      businessId: business.id || business.email,
      sellerId: business.id || business.email,
      sellerType: 'business',
      isBusinessListing: true,
      inventoryId: item.id, // Link back to inventory
      
      // Seller information
      seller: {
        _id: business.id || business.email,
        name: business.businessName || business.name || 'Business',
        email: business.email || business.id,
        isBusiness: true,
        businessName: business.businessName || business.name,
        logo: business.logo,
        rating: business.rating || 0,
        reviewCount: business.reviewCount || 0,
        totalReviews: business.reviewCount || 0
      },
      
      // Availability
      availability: {
        inStock: (item.quantity || 0) > 0,
        quantity: item.quantity || 0,
        showQuantity: true
      },
      
      // Location from business
      location: business.address ? {
        city: business.address.city,
        latitude: business.address.latitude,
        longitude: business.address.longitude,
        formattedAddress: business.address.formattedAddress
      } : {},
      
      // Timestamps
      addedAt: item.addedAt || item.dateAdded || new Date().toISOString(),
      listedDate: item.addedAt || item.dateAdded || new Date().toISOString(),
      lastUpdated: item.updatedAt || item.lastUpdated,
      
      // Stats
      stats: {
        views: item.viewCount || 0,
        wishlistCount: 0,
        messageCount: 0
      },
      
      // Make it clear this is from business inventory
      source: 'business_inventory'
    }));
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
 * Process business product purchase - Uses existing order creation endpoint
 */
export const purchaseBusinessProduct = async (productId, businessId, quantity = 1, customerInfo) => {
  try {
    console.log('🛒 Processing business product purchase:', { productId, businessId, quantity });
    
    // Use your existing order creation endpoint
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
    
    console.log('✅ Purchase successful:', response);
    
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
// ALL EXISTING FUNCTIONS REMAIN THE SAME
// ==========================================

/**
 * Get specific product details by ID
 * @param {string} id - Product ID
 * @returns {Promise<Object>} - Product details
 */
export const getSpecific = async (id) => {
  if (!id) {
    throw new Error('Product ID is required');
  }
  
  const endpoint = `marketplace/products/specific/${id}`;
  
  return apiRequest(endpoint);
};

/**
 * Add or remove product from wishlist
 * @param {string} productId - Product ID to toggle
 * @returns {Promise<Object>} - Response with updated wishlist status
 */
export const wishProduct = async (productId) => {
  if (!productId) {
    throw new Error('Product ID is required');
  }
  
  const endpoint = `marketplace/products/wish/${productId}`;
  
  return apiRequest(endpoint, {
    method: 'POST',
  });
};

/**
 * Create new product listing
 * @param {Object} productData - Product data to create
 * @returns {Promise<Object>} - Response with created product info
 */
export const createProduct = async (productData) => {
  const endpoint = 'marketplace/products/create';
  
  return apiRequest(endpoint, {
    method: 'POST',
    body: JSON.stringify(productData),
  });
};

/**
 * Update existing product
 * @param {string} productId - Product ID to update
 * @param {Object} productData - Updated product data
 * @returns {Promise<Object>} - Response with updated product
 */
export const updateProduct = async (productId, productData) => {
  const endpoint = `marketplace/products/${productId}`;
  
  return apiRequest(endpoint, {
    method: 'PATCH',
    body: JSON.stringify(productData),
  });
};

/**
 * Delete product
 * @param {string} productId - Product ID to delete
 * @returns {Promise<Object>} - Response with deletion status
 */
export const deleteProduct = async (productId) => {
  const endpoint = `marketplace/products/${productId}`;
  
  return apiRequest(endpoint, {
    method: 'DELETE',
  });
};

/**
 * Mark product as sold
 * @param {string} productId - Product ID to mark as sold
 * @param {Object} data - Optional data with buyer info
 * @returns {Promise<Object>} - Response with updated status
 */
export const markAsSold = async (productId, data = {}) => {
  const endpoint = `marketplace/products/${productId}/sold`;
  
  return apiRequest(endpoint, {
    method: 'POST',
    body: JSON.stringify(data),
  });
};

/**
 * Get user profile by ID
 * @param {string} userId - User ID to fetch
 * @returns {Promise<Object>} - User profile data
 */
export const fetchUserProfile = async (userId) => {
  if (!userId) {
    throw new Error('User ID is required');
  }
  
  const endpoint = `marketplace/users/${userId}`;
  
  return apiRequest(endpoint);
};

/**
 * Get business profile with inventory (for business seller profile) - Uses existing endpoint
 */
export const fetchBusinessProfile = async (businessId) => {
  try {
    console.log('🏢 Fetching business profile:', businessId);
    
    // Use your existing endpoint that gets business profile + inventory
    const response = await apiRequest(`marketplace/business-profile/${businessId}`);
    return response;
    
  } catch (error) {
    console.error('❌ Error fetching business profile:', error);
    throw error;
  }
};

/**
 * Update user profile
 * @param {string} userId - User ID to update
 * @param {Object} profileData - Updated profile data
 * @returns {Promise<Object>} - Response with updated profile
 */
export const updateUserProfile = async (userId, profileData) => {
  const endpoint = `marketplace/users/${userId}`;
  
  return apiRequest(endpoint, {
    method: 'PATCH',
    body: JSON.stringify(profileData),
  });
};

/**
 * Get user's listings
 * @param {string} userId - User ID
 * @param {string} status - Filter by status (active, sold, all)
 * @returns {Promise<Object>} - Response with user's listings
 */
export const getUserListings = async (userId, status = 'all') => {
  const endpoint = `marketplace/users/${userId}/listings?status=${status}`;
  
  return apiRequest(endpoint);
};

/**
 * Get user's wishlist
 * @param {string} userId - User ID
 * @returns {Promise<Object>} - Response with user's wishlist
 */
export const getUserWishlist = async (userId) => {
  const endpoint = `marketplace/users/${userId}/wishlist`;
  
  return apiRequest(endpoint);
};

/**
 * Upload an image and get URL
 * @param {string|Blob} imageData - Image data (URI or Blob)
 * @param {string} type - Image type (plant, user, etc.)
 * @returns {Promise<Object>} - Response with image URL
 */
export const uploadImage = async (imageData, type = 'plant') => {
  if (!imageData) {
    throw new Error('Image data is required');
  }
  
  const endpoint = 'marketplace/uploadImage';
  
  // Handle different image formats based on platform
  if (Platform.OS === 'web') {
    if (imageData instanceof Blob) {
      // For web with Blob/File
      const formData = new FormData();
      formData.append('file', imageData);
      formData.append('type', type);
      
      return apiRequest(endpoint, {
        method: 'POST',
        body: formData,
        headers: {}, // Let browser set content-type with boundary
      });
    } else if (imageData.startsWith('data:')) {
      // For web with data URI
      return apiRequest(endpoint, {
        method: 'POST',
        body: JSON.stringify({ image: imageData, type }),
      });
    }
  }
  
  // For React Native with local URI
  // Create form data for file upload
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

    // Clean up the transcription text
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

/**
 * Get SignalR negotiate token for real-time messaging
 * @returns {Promise<Object>} - SignalR connection info
 */
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

/**
 * Get user conversations (chat rooms)
 * @param {string} userId - User ID
 * @returns {Promise<Array>} - List of conversations
 */
export const fetchConversations = async (userId) => {
  if (!userId) {
    throw new Error('User ID is required');
  }
  
  const endpoint = 'marketplace/messages/getUserConversations';
  
  return apiRequest(endpoint);
};

/**
 * Get messages for a specific conversation
 * @param {string} chatId - Conversation ID
 * @param {string} userId - User ID
 * @returns {Promise<Object>} - Response with messages
 */
export const fetchMessages = async (chatId, userId) => {
  if (!chatId) {
    throw new Error('Chat ID is required');
  }
  
  const endpoint = `marketplace/messages/getMessages/${chatId}`;
  
  return apiRequest(endpoint);
};

/**
 * Send a message in an existing conversation
 * @param {string} chatId - Conversation ID
 * @param {string} message - Message text
 * @param {string} senderId - Sender ID
 * @returns {Promise<Object>} - Response with sent message info
 */
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

/**
 * Start a new conversation
 * @param {string} sellerId - Seller ID
 * @param {string} plantId - Plant ID
 * @param {string} message - Initial message
 * @param {string} sender - Sender ID (current user)
 * @returns {Promise<Object>} - Response with new conversation info
 */
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

/**
 * Mark messages as read
 * @param {string} conversationId - Conversation ID
 * @param {Array} messageIds - Optional specific message IDs to mark as read
 * @returns {Promise<Object>} - Response with updated read status
 */
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

/**
 * Send typing indicator to other user
 * @param {string} conversationId - Conversation ID
 * @param {boolean} isTyping - Whether user is typing
 * @returns {Promise<Object>} - Response with status
 */
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

/**
 * Fetch reviews for a seller or product
 * @param {string} targetType - Target type ('seller' or 'product')
 * @param {string} targetId - Target ID
 * @returns {Promise<Object>} - Response with reviews
 */
export const fetchReviews = async (targetType, targetId) => {
  if (!targetType || !targetId) {
    throw new Error('Target type and ID are required');
  }
  
  const endpoint = `marketplace/reviews/${targetType}/${targetId}`;
  
  return apiRequest(endpoint);
};

/**
 * Submit a review for a seller or product
 * @param {string} targetId - Target ID
 * @param {string} targetType - Target type ('seller' or 'product')
 * @param {Object} reviewData - Review data {rating, text}
 * @returns {Promise<Object>} - Response with submitted review
 */
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

/**
 * Delete a review
 * @param {string} targetType - Target type ('seller' or 'product')
 * @param {string} targetId - Target ID
 * @param {string} reviewId - Review ID to delete
 * @returns {Promise<Object>} - Response with deletion status
 */
export const deleteReview = async (targetType, targetId, reviewId) => {
  if (!targetType || !targetId || !reviewId) {
    throw new Error('Target type, target ID, and review ID are required');
  }
  
  const endpoint = `marketplace/reviews/${targetType}/${targetId}/${reviewId}`;
  
  return apiRequest(endpoint, {
    method: 'DELETE',
  });
};

// Export all functions
export default {
  getAll,
  getSpecific,
  wishProduct,
  createProduct,
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
  
  // New business functions
  purchaseBusinessProduct
};