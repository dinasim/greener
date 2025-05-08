/**
 * productData.js
 * Service for handling plant product data with Azure Functions
 * Uses Google Sign-In for authentication
 */

import { Platform } from 'react-native';

// Base URL for Azure Functions
const baseUrl = 'https://usersfunctions.azurewebsites.net/api';

/**
 * Get all products with optional filtering
 * @param {number} page - Page number for pagination
 * @param {string} category - Optional category filter
 * @param {string} query - Optional search query
 * @returns {Promise<Object>} - Products with pagination info
 */
export async function getAll(page = 1, category = 'all', query = '') {
  try {
    let endpoint = `${baseUrl}/products?page=${page}`;

    if (query) {
      endpoint += `&search=${encodeURIComponent(query)}`;
    } else if (category && category !== 'all') {
      endpoint = `${baseUrl}/products/${encodeURIComponent(category)}?page=${page}`;
    }

    const res = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${global.googleAuthToken}`,
      },
    });

    return await res.json();
  } catch (error) {
    console.error('Error fetching all products:', error);

    // During development, return mock data on error
    if (__DEV__) {
      return getMockProducts(category, query);
    }

    throw error;
  }
}

/**
 * Get a specific product by ID
 * @param {string} id - Product ID
 * @returns {Promise<Object>} - Product details
 */
export async function getSpecific(id) {
  try {
    const res = await fetch(`${baseUrl}/products/specific/${id}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${global.googleAuthToken}`,
      },
    });

    return await res.json();
  } catch (error) {
    console.error(`Error fetching product with ID ${id}:`, error);

    // During development, return mock data on error
    if (__DEV__) {
      return getMockProductById(id);
    }

    throw error;
  }
}

/**
 * Create a new product
 * @param {Object} product - Product data
 * @returns {Promise<Object>} - Created product result
 */
export async function createProduct(product) {
  try {
    let productData = { ...product };

    if (typeof productData.image === 'string' && !productData.image.startsWith('data:')) {
      productData.image = await getBase64FromUri(productData.image);
    }

    const res = await fetch(`${baseUrl}/products/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${global.googleAuthToken}`,
      },
      body: JSON.stringify(productData),
    });

    return await res.json();
  } catch (error) {
    console.error('Error creating product:', error);
    throw error;
  }
}

/**
 * Edit an existing product
 * @param {string} id - Product ID
 * @param {Object} product - Updated product data
 * @returns {Promise<Object>} - Edit result
 */
export async function editProduct(id, product) {
  try {
    let productData = { ...product };

    if (typeof productData.image === 'string' && !productData.image.startsWith('data:')) {
      productData.image = await getBase64FromUri(productData.image);
    }

    const res = await fetch(`${baseUrl}/products/edit/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${global.googleAuthToken}`,
      },
      body: JSON.stringify(productData),
    });

    return await res.json();
  } catch (error) {
    console.error(`Error editing product ${id}:`, error);
    throw error;
  }
}

/**
 * Activate a previously archived product
 * @param {string} id - Product ID
 * @returns {Promise<Object>} - Activation result
 */
export async function activateSell(id) {
  try {
    const res = await fetch(`${baseUrl}/products/enable/${id}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${global.googleAuthToken}`,
      },
    });

    return await res.json();
  } catch (error) {
    console.error(`Error activating product ${id}:`, error);
    throw error;
  }
}

/**
 * Archive a product (hide from marketplace)
 * @param {string} id - Product ID
 * @returns {Promise<Object>} - Archive result
 */
export async function archiveSell(id) {
  try {
    const res = await fetch(`${baseUrl}/products/archive/${id}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${global.googleAuthToken}`,
      },
    });

    return await res.json();
  } catch (error) {
    console.error(`Error archiving product ${id}:`, error);
    throw error;
  }
}

/**
 * Add/remove a product to user's wishlist
 * @param {string} id - Product ID
 * @returns {Promise<Object>} - Wishlist update result
 */
export async function wishProduct(id) {
  try {
    const res = await fetch(`${baseUrl}/products/wish/${id}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${global.googleAuthToken}`,
      },
    });

    return await res.json();
  } catch (error) {
    console.error(`Error toggling wishlist for product ${id}:`, error);
    throw error;
  }
}

// Helper function to convert a local image URI to base64
export async function getBase64FromUri(uri) {
  if (Platform.OS === 'web') {
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error('Error converting image to base64:', error);
      throw error;
    }
  } else {
    const FileSystem = require('expo-file-system');
    try {
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      return `data:image/jpeg;base64,${base64}`;
    } catch (error) {
      console.error('Error converting image to base64:', error);
      throw error;
    }
  }
}

// MOCK DATA IMPLEMENTATION FOR DEVELOPMENT/TESTING
// -------------------------------

const MOCK_PLANTS = [
  {
    id: '1',
    title: 'Monstera Deliciosa',
    name: 'Monstera Deliciosa',
    description: 'Beautiful Swiss Cheese Plant with large fenestrated leaves. Perfect for adding a tropical feel to your home.',
    price: 29.99,
    image: 'https://via.placeholder.com/150?text=Monstera',
    sellerName: 'PlantLover123',
    location: 'Seattle, WA',
    category: 'indoor',
    rating: 4.7,
    isFavorite: false,
  },
  // Add more mock plants as needed...
];

// Mock function to simulate fetching products
function getMockProducts(category, query) {
  let filtered = [...MOCK_PLANTS];

  if (category && category !== 'all') {
    filtered = filtered.filter((p) => p.category.toLowerCase() === category.toLowerCase());
  }

  if (query) {
    const lowercaseQuery = query.toLowerCase();
    filtered = filtered.filter((p) => p.title.toLowerCase().includes(lowercaseQuery));
  }

  return {
    products: filtered,
    pages: 1,
    currentPage: 1,
    count: filtered.length,
  };
}

// Mock function to simulate fetching a product by ID
function getMockProductById(id) {
  const product = MOCK_PLANTS.find((p) => p.id === id);
  if (!product) {
    throw new Error('Product not found');
  }
  return product;
}
