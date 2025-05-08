/**
 * userData.js
 * Service for handling user-related operations with Azure Functions
 * Uses Google Sign-In authentication
 */

// Base URL for Azure Functions
const baseUrl = 'https://usersfunctions.azurewebsites.net/api';

/**
 * Get the current authenticated user from the backend
 * The Google Auth token should be stored in global.googleAuthToken after signin
 * @returns {Promise<Object>} - User data
 */
export async function getUser() {
  try {
    const res = await fetch(`${baseUrl}/auth/getUser`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${global.googleAuthToken}`
      },
    });

    return await res.json();
  } catch (error) {
    console.error('Error fetching user:', error);
    
    // During development, return mock data
    if (__DEV__) {
      return getMockUser();
    }
    
    throw error;
  }
}

/**
 * Get active listings for a user
 * @param {string} id - User ID
 * @returns {Promise<Object>} - User's active listings
 */
export async function getUserActiveSells(id) {
  try {
    const res = await fetch(`${baseUrl}/products/sells/active/${id}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${global.googleAuthToken}`
      },
    });

    return await res.json();
  } catch (error) {
    console.error(`Error fetching active sells for user ${id}:`, error);
    
    // During development, return mock data
    if (__DEV__) {
      return getMockActiveSells(id);
    }
    
    throw error;
  }
}

/**
 * Get archived/inactive listings for the current user
 * @returns {Promise<Object>} - User's archived listings
 */
export async function getUserArchivedSells() {
  try {
    const res = await fetch(`${baseUrl}/products/sells/archived`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${global.googleAuthToken}`
      },
    });

    return await res.json();
  } catch (error) {
    console.error('Error fetching archived sells:', error);
    
    // During development, return mock data
    if (__DEV__) {
      return getMockArchivedSells();
    }
    
    throw error;
  }
}

/**
 * Get wishlist items for the current user
 * @returns {Promise<Object>} - User's wishlist
 */
export async function getUserWishlist() {
  try {
    const res = await fetch(`${baseUrl}/products/wishlist/getWishlist`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${global.googleAuthToken}`
      },
    });

    return await res.json();
  } catch (error) {
    console.error('Error fetching wishlist:', error);
    
    // During development, return mock data
    if (__DEV__) {
      return getMockWishlist();
    }
    
    throw error;
  }
}

/**
 * Edit user profile
 * @param {string} id - User ID
 * @param {Object} data - Updated profile data
 * @returns {Promise<Object>} - Update result
 */
export async function editUserProfile(id, data) {
  try {
    // Handle avatar upload if it's a file URI
    let profileData = { ...data };
    
    if (profileData.avatar && typeof profileData.avatar === 'string' && !profileData.avatar.startsWith('data:')) {
      // Convert avatar to base64
      const response = await fetch(profileData.avatar);
      const blob = await response.blob();
      profileData.avatar = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(blob);
      });
    }
    
    const res = await fetch(`${baseUrl}/user/edit-profile/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${global.googleAuthToken}`
      },
      body: JSON.stringify(profileData),
    });

    return await res.json();
  } catch (error) {
    console.error(`Error editing user profile ${id}:`, error);
    throw error;
  }
}

/**
 * Get another user's profile
 * @param {string} id - User ID to fetch
 * @returns {Promise<Object>} - User profile data
 */
export async function getUserById(id) {
  try {
    const res = await fetch(`${baseUrl}/user/getUserById/${id}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${global.googleAuthToken}`
      },
    });

    return await res.json();
  } catch (error) {
    console.error(`Error fetching user ${id}:`, error);
    
    // During development, return mock data
    if (__DEV__) {
      return getMockUserById(id);
    }
    
    throw error;
  }
}

// MOCK DATA IMPLEMENTATION FOR DEVELOPMENT/TESTING
// -------------------------------

// Mock user data
const MOCK_USERS = [
  {
    _id: 'user1',
    name: 'Plant Enthusiast',
    email: 'plant.lover@example.com',
    phoneNumber: '+1 (555) 123-4567',
    avatar: 'https://via.placeholder.com/150?text=User',
    bio: 'Passionate plant enthusiast with a love for tropical houseplants.',
    location: 'Seattle, WA',
    totalSells: 8
  },
  {
    _id: 'user2',
    name: 'Green Thumb',
    email: 'green.thumb@example.com',
    phoneNumber: '+1 (555) 987-6543',
    avatar: 'https://via.placeholder.com/150?text=User2',
    bio: 'Professional gardener with 10+ years of experience.',
    location: 'Portland, OR',
    totalSells: 15
  }
];

// Mock plant listings
const MOCK_LISTINGS = [
  {
    _id: 'plant1',
    title: 'Monstera Deliciosa',
    price: 29.99,
    description: 'Beautiful Swiss Cheese Plant with large fenestrated leaves.',
    image: 'https://via.placeholder.com/150?text=Monstera',
    category: 'indoor',
    city: 'Seattle',
    active: true,
    addedAt: new Date().toISOString()
  },
  {
    _id: 'plant2',
    title: 'Snake Plant',
    price: 19.99,
    description: 'Low maintenance indoor plant, perfect for beginners.',
    image: 'https://via.placeholder.com/150?text=Snake+Plant',
    category: 'indoor',
    city: 'Portland',
    active: true,
    addedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    _id: 'plant3',
    title: 'Fiddle Leaf Fig',
    price: 34.99,
    description: 'Trendy houseplant with violin-shaped leaves.',
    image: 'https://via.placeholder.com/150?text=Fiddle+Leaf',
    category: 'indoor',
    city: 'San Francisco',
    active: false,
    addedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()
  }
];

// Mock function to get the current user
function getMockUser() {
  return {
    user: MOCK_USERS[0]
  };
}

// Mock function to get user by ID
function getMockUserById(id) {
  return {
    user: MOCK_USERS.find(user => user._id === id) || MOCK_USERS[0]
  };
}

// Mock function to get active sells
function getMockActiveSells(id) {
  return {
    sells: MOCK_LISTINGS.filter(listing => listing.active),
    user: MOCK_USERS.find(user => user._id === id) || MOCK_USERS[0]
  };
}

// Mock function to get archived sells
function getMockArchivedSells() {
  return {
    sells: MOCK_LISTINGS.filter(listing => !listing.active),
    user: MOCK_USERS[0]
  };
}

// Mock function to get wishlist
function getMockWishlist() {
  return {
    wishlist: [MOCK_LISTINGS[0], MOCK_LISTINGS[1]].filter(listing => listing.active)
  };
}
