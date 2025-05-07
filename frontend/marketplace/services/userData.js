// ✅ Set your Azure Function base URL here
const baseUrl = 'https://usersfunctions.azurewebsites.net/api'; // Change this if your Azure Function URL differs

// ✅ Gets the currently authenticated user (make sure your backend extracts user from auth token)
export async function getUser() {
  const res = await fetch(`${baseUrl}/auth/getUser`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      /*
        🔐 If you are using authentication:
        Add an Authorization header to each request like so:

        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${yourToken}`,
        }
      */
    },
  });
  return res.json();
}

// ✅ Get all active products by user ID
export async function getUserActiveSells(id) {
  const res = await fetch(`${baseUrl}/products/sells/active/${id}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  return res.json();
}

// ✅ Get all archived/inactive sells of current user (assumes backend extracts user ID from token)
export async function getUserArchivedSells() {
  const res = await fetch(`${baseUrl}/products/sells/archived`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  return res.json();
}

// ✅ Get wishlist items for the logged-in user
export async function getUserWishlist() {
  const res = await fetch(`${baseUrl}/products/wishlist/getWishlist`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  return res.json();
}

// ✅ Update user profile (ID comes from client; verify permissions in backend)
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

// ✅ Fetch another user's profile by their ID (public profile view)
export async function getUserById(id) {
  const res = await fetch(`${baseUrl}/user/getUserById/${id}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  return res.json();
}
