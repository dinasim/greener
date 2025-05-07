// ✅ Azure Functions base URL – change this if you deploy to a different domain
const baseUrl = 'https://usersfunctions.azurewebsites.net/api';

/**
 * Get all products (with optional category and search query)
 */
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

/**
 * Get details of a specific product by ID
 */
export async function getSpecific(id) {
  const res = await fetch(`${baseUrl}/products/specific/${id}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  return await res.json();
}

/**
 * Create a new product listing
 */
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

/**
 * Edit a product by ID
 */
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

/**
 * Activate (re-enable) a previously archived product
 */
export async function activateSell(id) {
  const res = await fetch(`${baseUrl}/products/enable/${id}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  return await res.json();
}

/**
 * Archive a product (set it to hidden/inactive)
 */
export async function archiveSell(id) {
  const res = await fetch(`${baseUrl}/products/archive/${id}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  return await res.json();
}

/**
 * Add a product to the user's wishlist
 */
export async function wishProduct(id) {
  const res = await fetch(`${baseUrl}/products/wish/${id}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  return await res.json();
}
