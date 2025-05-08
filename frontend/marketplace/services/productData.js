// This is a sample implementation - replace with your actual data service
// Adjust according to your actual API or data source

import { Platform } from 'react-native';

// Sample data for testing - you should replace this with your actual data fetching logic
const sampleProducts = [
  {
    id: '1',
    title: 'Monstera Deliciosa',
    price: 25.99,
    image: 'https://via.placeholder.com/150?text=Monstera',
    rating: 4.7,
    location: 'Brooklyn, NY',
    seller: { name: 'Green Thumb', id: 'seller1' },
    category: 'indoor'
  },
  {
    id: '2',
    title: 'Snake Plant',
    price: 18.50,
    image: 'https://via.placeholder.com/150?text=Snake+Plant',
    rating: 4.5,
    location: 'Manhattan, NY',
    seller: { name: 'Plant Paradise', id: 'seller2' },
    category: 'indoor'
  },
  {
    id: '3',
    title: 'Rose Bush',
    price: 22.00,
    image: 'https://via.placeholder.com/150?text=Rose+Bush',
    rating: 4.2,
    location: 'Queens, NY',
    seller: { name: 'Garden World', id: 'seller3' },
    category: 'outdoor'
  },
  {
    id: '4',
    title: 'Echeveria Succulent',
    price: 12.99,
    image: 'https://via.placeholder.com/150?text=Succulent',
    rating: 4.8,
    location: 'Bronx, NY',
    seller: { name: 'Desert Plants', id: 'seller4' },
    category: 'succulent'
  },
  {
    id: '5',
    title: 'Tulip Bulbs',
    price: 15.75,
    image: 'https://via.placeholder.com/150?text=Tulips',
    rating: 4.3,
    location: 'Staten Island, NY',
    seller: { name: 'Spring Blooms', id: 'seller5' },
    category: 'flowers'
  }
];

// Function to simulate getting all products with filtering
export const getAll = async (category = 'all', searchQuery = '') => {
  try {
    // In a real application, you would make an API call here
    // For example:
    // const response = await fetch(`https://your-api.com/products?category=${category}&search=${searchQuery}`);
    // const data = await response.json();
    // return data;
    
    // Simulating API call delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Filter based on category and search query
    let filteredProducts = [...sampleProducts];
    
    if (category !== 'all') {
      filteredProducts = filteredProducts.filter(product => product.category === category);
    }
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filteredProducts = filteredProducts.filter(product => 
        product.title.toLowerCase().includes(query) ||
        product.seller.name.toLowerCase().includes(query) ||
        product.location.toLowerCase().includes(query)
      );
    }
    
    return filteredProducts;
  } catch (error) {
    console.error('Error fetching products:', error);
    throw error;
  }
};

// Function to get a single product by ID
export const getById = async (id) => {
  try {
    // In a real application, you would make an API call here
    // For example:
    // const response = await fetch(`https://your-api.com/products/${id}`);
    // const data = await response.json();
    // return data;
    
    // Simulating API call delay
    await new Promise(resolve => setTimeout(resolve, 300));
    
    const product = sampleProducts.find(p => p.id === id);
    if (!product) {
      throw new Error('Product not found');
    }
    
    return product;
  } catch (error) {
    console.error(`Error fetching product with ID ${id}:`, error);
    throw error;
  }
};



/*
// ✅ Azure Functions base URL – change this if you deploy to a different domain
const baseUrl = 'https://usersfunctions.azurewebsites.net/api';

// ⚠️ Replace with your Azure URL if different
// Get all products (with optional category and search query)
export async function getAll(page, category, query) {
  let url = `${baseUrl}/products?page=${page}`;

  if (query) {
    url += `&search=${encodeURIComponent(query)}`;
  } else if (category && category !== 'all') {
    url = `${baseUrl}/products/${encodeURIComponent(category)}?page=${page}`;
  }

  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      // 'Authorization': `Bearer ${firebaseIdToken}`, // Optional if your backend requires it
    },
  });

  return await res.json();
}

// Get details of a specific product by ID
export async function getSpecific(id) {
  const res = await fetch(`${baseUrl}/products/specific/${id}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  return await res.json();
}

// Create a new product listing
export async function createProduct(product) {
  const res = await fetch(`${baseUrl}/products/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(product),
  });

  return await res.json();
}

// Edit a product by ID
export async function editProduct(id, product) {
  const res = await fetch(`${baseUrl}/products/edit/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(product),
  });

  return await res.json();
}

// Activate (re-enable) a previously archived product
export async function activateSell(id) {
  const res = await fetch(`${baseUrl}/products/enable/${id}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  return await res.json();
}

// Archive a product (set it to hidden/inactive)
export async function archiveSell(id) {
  const res = await fetch(`${baseUrl}/products/archive/${id}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  return await res.json();
}

// Add a product to the user's wishlist
export async function wishProduct(id) {
  const res = await fetch(`${baseUrl}/products/wish/${id}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  return await res.json();
}
*/