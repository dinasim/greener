// frontend/Business/services/businessApi.js
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = 'https://usersfunctions.azurewebsites.net/api';

// Helper function to get headers with authentication
const getHeaders = async () => {
  const userEmail = await AsyncStorage.getItem('userEmail');
  const headers = {
    'Content-Type': 'application/json',
  };
  
  if (userEmail) {
    headers['X-User-Email'] = userEmail;
  }
  
  return headers;
};

// Helper function to handle API responses
const handleResponse = async (response) => {
  const text = await response.text();
  
  if (!response.ok) {
    let errorMessage = `HTTP ${response.status}`;
    try {
      const errorData = JSON.parse(text);
      errorMessage = errorData.error || errorMessage;
    } catch (e) {
      errorMessage = text || errorMessage;
    }
    throw new Error(errorMessage);
  }
  
  try {
    return JSON.parse(text);
  } catch (e) {
    return { success: true, data: text };
  }
};

/**
 * Search plants from the main plants database
 * @param {string} query Search query
 * @returns {Promise<Array>} Array of plant objects
 */
export const searchPlants = async (query) => {
  try {
    const headers = await getHeaders();
    
    const response = await fetch(
      `${API_BASE_URL}/plant_search?name=${encodeURIComponent(query)}`,
      {
        method: 'GET',
        headers,
      }
    );
    
    const data = await handleResponse(response);
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error('Error searching plants:', error);
    throw error;
  }
};

/**
 * Create a new inventory item
 * @param {Object} inventoryData Inventory item data
 * @returns {Promise<Object>} Created inventory item
 */
export const createInventoryItem = async (inventoryData) => {
  try {
    const headers = await getHeaders();
    
    const response = await fetch(`${API_BASE_URL}/business/inventory/create`, {
      method: 'POST',
      headers,
      body: JSON.stringify(inventoryData),
    });
    
    return await handleResponse(response);
  } catch (error) {
    console.error('Error creating inventory item:', error);
    throw error;
  }
};

/**
 * Get business inventory
 * @param {string} businessId Business ID
 * @returns {Promise<Array>} Array of inventory items
 */
export const getBusinessInventory = async (businessId) => {
  try {
    const headers = await getHeaders();
    
    const response = await fetch(`${API_BASE_URL}/business/inventory/${businessId}`, {
      method: 'GET',
      headers,
    });
    
    const data = await handleResponse(response);
    return data.inventory || [];
  } catch (error) {
    console.error('Error getting business inventory:', error);
    throw error;
  }
};

/**
 * Update inventory item
 * @param {string} inventoryId Inventory item ID
 * @param {Object} updateData Data to update
 * @returns {Promise<Object>} Updated inventory item
 */
export const updateInventoryItem = async (inventoryId, updateData) => {
  try {
    const headers = await getHeaders();
    
    const response = await fetch(`${API_BASE_URL}/business/inventory/${inventoryId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(updateData),
    });
    
    return await handleResponse(response);
  } catch (error) {
    console.error('Error updating inventory item:', error);
    throw error;
  }
};

/**
 * Delete inventory item
 * @param {string} inventoryId Inventory item ID
 * @returns {Promise<Object>} Deletion confirmation
 */
export const deleteInventoryItem = async (inventoryId) => {
  try {
    const headers = await getHeaders();
    
    const response = await fetch(`${API_BASE_URL}/business/inventory/${inventoryId}`, {
      method: 'DELETE',
      headers,
    });
    
    return await handleResponse(response);
  } catch (error) {
    console.error('Error deleting inventory item:', error);
    throw error;
  }
};

/**
 * Get low stock items
 * @param {string} businessId Business ID
 * @returns {Promise<Array>} Array of low stock items
 */
export const getLowStockItems = async (businessId) => {
  try {
    const headers = await getHeaders();
    
    const response = await fetch(`${API_BASE_URL}/business/inventory/${businessId}/low-stock`, {
      method: 'GET',
      headers,
    });
    
    const data = await handleResponse(response);
    return data.lowStockItems || [];
  } catch (error) {
    console.error('Error getting low stock items:', error);
    throw error;
  }
};