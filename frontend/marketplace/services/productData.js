
// 🌿 MOCKED VERSION: productData.js
// Simulates all product-related API calls for local frontend testing without Azure backend.

export async function getAll(page, category, query) {
  return Promise.resolve([
    {
      _id: "1",
      title: "Aloe Vera",
      price: "10",
      image: "https://example.com/aloe.jpg",
      category: "cactus",
      city: "Tel Aviv",
      addedAt: "2024-01-01T08:30:00Z"
    },
    {
      _id: "2",
      title: "Monstera",
      price: "25",
      image: "https://example.com/monstera.jpg",
      category: "tropical",
      city: "Haifa",
      addedAt: "2024-02-15T10:45:00Z"
    }
  ]);
}


export async function getSpecific(id) {
  // ✅ Mock: Simulates fetching details of a specific product
  return Promise.resolve({
    _id: id,
    name: "Mock Plant",
    price: "15",
    imageUrl: "https://example.com/mock.jpg",
    description: "This is a mocked product for testing.",
    category: "mock",
  });
}

export async function createProduct(product) {
  // ✅ Mock: Simulates product creation
  return Promise.resolve({
    success: true,
    product: {
      ...product,
      _id: "mock-created-id"
    }
  });
}

export async function editProduct(id, product) {
  // ✅ Mock: Simulates product editing
  return Promise.resolve({
    success: true,
    updated: {
      id,
      ...product
    }
  });
}

export async function activateSell(id) {
  // ✅ Mock: Simulates reactivating a product
  return Promise.resolve({
    success: true,
    id
  });
}

export async function archiveSell(id) {
  // ✅ Mock: Simulates archiving a product
  return Promise.resolve({
    success: true,
    id
  });
}

export async function wishProduct(id) {
  // ✅ Mock: Simulates adding a product to the wishlist
  return Promise.resolve({
    success: true,
    wishedProductId: id
  });
}


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