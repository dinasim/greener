// src/marketplace/services/marketplaceApi.js
import { Platform } from 'react-native';
import { 
  mockPlants, 
  mockUser, 
  mockMessages, 
  mockConversations, 
  mockFavorites 
} from './mockData';

// Helper function to simulate network delay
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Flag to control whether we should use mock data
// Change this to false when your Azure backend is ready
const MOCK_DATA_ENABLED = true;

// Base URL for your API
const API_BASE_URL = 'https://usersfunctions.azurewebsites.net/api';

/**
 * Fetch all plants
 */
export const fetchPlants = async () => {
  // Use mock data if enabled or if on web platform
  if (MOCK_DATA_ENABLED || Platform.OS === 'web') {
    console.log('Using mock data for plants');
    // Add slight delay to simulate network request
    await delay(500);
    return mockPlants;
  }
  
  try {
    const response = await fetch(`${API_BASE_URL}/plants`);
    if (!response.ok) {
      throw new Error(`Failed to fetch plants: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error in fetchPlants:', error);
    // Fallback to mock data on error
    console.log('Falling back to mock data due to API error');
    return mockPlants;
  }
};

/**
 * Fetch plant details by ID
 */
export const fetchPlantById = async (id) => {
  if (MOCK_DATA_ENABLED || Platform.OS === 'web') {
    console.log(`Using mock data for plant ${id}`);
    await delay(300);
    const plant = mockPlants.find(p => p.id === id);
    
    if (!plant) {
      throw new Error(`Plant with ID ${id} not found`);
    }
    
    return plant;
  }
  
  try {
    const response = await fetch(`${API_BASE_URL}/plants/${id}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch plant: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error(`Error fetching plant ${id}:`, error);
    
    // Try to return mock data as fallback
    const mockPlant = mockPlants.find(p => p.id === id);
    if (mockPlant) {
      return mockPlant;
    }
    
    // Rethrow if no mock data found
    throw error;
  }
};

/**
 * Fetch the current user's profile
 */
export const fetchUserProfile = async () => {
  if (MOCK_DATA_ENABLED || Platform.OS === 'web') {
    console.log('Using mock data for user profile');
    await delay(300);
    return mockUser;
  }
  
  try {
    const response = await fetch(`${API_BASE_URL}/user/profile`);
    if (!response.ok) {
      throw new Error(`Failed to fetch user profile: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return mockUser;
  }
};

/**
 * Fetch conversations list
 */
export const fetchConversations = async () => {
  if (MOCK_DATA_ENABLED || Platform.OS === 'web') {
    console.log('Using mock data for conversations');
    await delay(400);
    return mockConversations;
  }
  
  try {
    const response = await fetch(`${API_BASE_URL}/messages/conversations`);
    if (!response.ok) {
      throw new Error(`Failed to fetch conversations: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching conversations:', error);
    return mockConversations;
  }
};

/**
 * Fetch messages for a conversation
 */
export const fetchMessages = async (conversationId) => {
  if (MOCK_DATA_ENABLED || Platform.OS === 'web') {
    console.log(`Using mock data for messages in conversation ${conversationId}`);
    await delay(300);
    return mockMessages.filter(msg => msg.conversationId === conversationId);
  }
  
  try {
    const response = await fetch(`${API_BASE_URL}/messages/${conversationId}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch messages: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error(`Error fetching messages for conversation ${conversationId}:`, error);
    return mockMessages.filter(msg => msg.conversationId === conversationId);
  }
};

/**
 * Send a message
 */
export const sendMessage = async (conversationId, messageText) => {
  if (MOCK_DATA_ENABLED || Platform.OS === 'web') {
    console.log(`Mock: Sending message to conversation ${conversationId}`);
    await delay(200);
    
    // Create a new message object
    const newMessage = {
      id: `new-${Date.now()}`,
      conversationId,
      sender: {
        id: 'current-user',
        name: mockUser.name,
        avatar: mockUser.avatar
      },
      message: messageText,
      timestamp: new Date().toISOString(),
      read: false
    };
    
    // In a real implementation, we would update the mock data
    // For now, just return the new message
    return newMessage;
  }
  
  try {
    const response = await fetch(`${API_BASE_URL}/messages/${conversationId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message: messageText }),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to send message: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error sending message:', error);
    throw error;
  }
};

/**
 * Fetch user's favorite plants
 */
export const fetchFavorites = async () => {
  if (MOCK_DATA_ENABLED || Platform.OS === 'web') {
    console.log('Using mock data for favorites');
    await delay(300);
    
    // Return the full plant objects for favorited items
    return mockPlants.filter(plant => mockFavorites.includes(plant.id));
  }
  
  try {
    const response = await fetch(`${API_BASE_URL}/user/favorites`);
    if (!response.ok) {
      throw new Error(`Failed to fetch favorites: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching favorites:', error);
    return mockPlants.filter(plant => mockFavorites.includes(plant.id));
  }
};

/**
 * Add a plant to favorites
 */
export const addToFavorites = async (plantId) => {
  if (MOCK_DATA_ENABLED || Platform.OS === 'web') {
    console.log(`Mock: Adding plant ${plantId} to favorites`);
    await delay(200);
    return { success: true };
  }
  
  try {
    const response = await fetch(`${API_BASE_URL}/user/favorites`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ plantId }),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to add favorite: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error adding to favorites:', error);
    throw error;
  }
};

/**
 * Remove a plant from favorites
 */
export const removeFromFavorites = async (plantId) => {
  if (MOCK_DATA_ENABLED || Platform.OS === 'web') {
    console.log(`Mock: Removing plant ${plantId} from favorites`);
    await delay(200);
    return { success: true };
  }
  
  try {
    const response = await fetch(`${API_BASE_URL}/user/favorites/${plantId}`, {
      method: 'DELETE',
    });
    
    if (!response.ok) {
      throw new Error(`Failed to remove favorite: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error removing from favorites:', error);
    throw error;
  }
};

/**
 * Add a new plant listing
 */
export const addPlantListing = async (plantData) => {
  if (MOCK_DATA_ENABLED || Platform.OS === 'web') {
    console.log('Mock: Adding new plant listing');
    console.log('Plant data:', plantData);
    await delay(500);
    
    // Generate a mock response with a new ID
    return {
      success: true,
      plant: {
        id: `new-${Date.now()}`,
        ...plantData,
        seller: {
          id: mockUser.id,
          name: mockUser.name,
          avatar: mockUser.avatar,
          rating: mockUser.rating
        },
        createdAt: new Date().toISOString(),
        isFavorite: false
      }
    };
  }
  
  try {
    const response = await fetch(`${API_BASE_URL}/plants`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(plantData),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to add plant listing: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error adding plant listing:', error);
    throw error;
  }
};