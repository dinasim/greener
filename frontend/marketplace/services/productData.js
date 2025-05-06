// frontend/services/productData.js

const baseUrl = 'https://usersfunctions.azurewebsites.net/api'; // ✅ Your Azure Function base URL

export async function getAll(page, category, query) {
  let url = `${baseUrl}/products?page=${page}`;
  if (query) {
    url += `&search=${query}`;
  } else if (category && category !== 'all') {
    url = `${baseUrl}/products/${category}?page=${page}`;
  }

  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  return res.json();
}

export async function getSpecific(id) {
  const res = await fetch(`${baseUrl}/products/specific/${id}`, {
    headers: {
      'Content-Type': 'application/json',
    },
  });
  return res.json();
}

export async function createProduct(product) {
  const res = await fetch(`${baseUrl}/products/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(product),
  });
  return res.json();
}

export async function editProduct(id, product) {
  const res = await fetch(`${baseUrl}/products/edit/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(product),
  });
  return res.json();
}

export async function activateSell(id) {
  const res = await fetch(`${baseUrl}/products/enable/${id}`, {
    headers: {
      'Content-Type': 'application/json',
    },
  });
  return res.json();
}

export async function archiveSell(id) {
  const res = await fetch(`${baseUrl}/products/archive/${id}`, {
    headers: {
      'Content-Type': 'application/json',
    },
  });
  return res.json();
}

export async function wishProduct(id) {
  const res = await fetch(`${baseUrl}/products/wish/${id}`, {
    headers: {
      'Content-Type': 'application/json',
    },
  });
  return res.json();
}
