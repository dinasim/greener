const baseUrl = 'https://usersfunctions.azurewebsites.net/api'; // Your Azure backend

export async function registerUser(userData) {
  const res = await fetch(`${baseUrl}/auth/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(userData),
  });
  return res.json();
}

export async function loginUser(userData) {
  const res = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(userData),
  });
  return res.json();
}

export async function getUser() {
  const res = await fetch(`${baseUrl}/auth/getUser`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  return res.json();
}

export async function getUserActiveSells(id) {
  const res = await fetch(`${baseUrl}/products/sells/active/${id}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  return res.json();
}

export async function getUserArchivedSells() {
  const res = await fetch(`${baseUrl}/products/sells/archived`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  return res.json();
}

export async function getUserWishlist() {
  const res = await fetch(`${baseUrl}/products/wishlist/getWishlist`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  return res.json();
}

export async function editUserProfile(id, data) {
  const res = await fetch(`${baseUrl}/user/edit-profile/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function getUserById(id) {
  const res = await fetch(`${baseUrl}/user/getUserById/${id}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  return res.json();
}
