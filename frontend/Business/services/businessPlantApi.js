// Business/services/businessPlantApi.js
// Plant-specific business functions for Greener (mobile)

import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = 'https://usersfunctions.azurewebsites.net/api';

// -----------------------------
// Shared helpers
// -----------------------------
const getEnhancedHeaders = async () => {
  try {
    const [userEmail, userType, businessId, authToken] = await Promise.all([
      AsyncStorage.getItem('userEmail'),
      AsyncStorage.getItem('userType'),
      AsyncStorage.getItem('businessId'),
      AsyncStorage.getItem('googleAuthToken'),
    ]);

    const headers = {
      'Content-Type': 'application/json',
      'X-API-Version': '1.0',
      'X-Client': 'greener-mobile',
    };

    if (userEmail) headers['X-User-Email'] = userEmail;
    if (userType) headers['X-User-Type'] = userType;
    if (businessId) headers['X-Business-ID'] = businessId;
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

    return headers;
  } catch (error) {
    console.error('❌ Error getting headers:', error);
    return { 'Content-Type': 'application/json' };
  }
};

const apiRequest = async (url, options = {}, retries = 3, context = 'Request') => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      // Note: RN fetch doesn't support "timeout" natively; kept for parity.
      const response = await fetch(url, { timeout: 15000, ...options });
      const responseText = await response.text();

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${responseText}`);
      }

      try {
        return JSON.parse(responseText);
      } catch {
        return { success: true, data: responseText };
      }
    } catch (error) {
      if (attempt === retries) {
        console.error(`❌ ${context} failed after ${attempt} attempts:`, error);
        throw error;
      }
      await new Promise((resolve) =>
        setTimeout(resolve, Math.min(1000 * Math.pow(2, attempt - 1), 5000))
      );
    }
  }
};

// -----------------------------
// Search plants (for inventory add flow)
// -----------------------------
export const searchPlantsForBusiness = async (query, filters = {}) => {
  try {
    console.log('🔍 Searching plants for business:', query);
    const headers = await getEnhancedHeaders();

    const url = `${API_BASE_URL}/business-plant-search`;
    const response = await apiRequest(
      url,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ query, ...filters }),
      },
      3,
      'Business Plant Search'
    );

    return {
      success: true,
      query,
      plants: response.plants || response.results || [],
      totalResults: response.totalResults || 0,
      suggestions: response.suggestions || [],
      filters: response.appliedFilters || filters,
    };
  } catch (error) {
    console.error('❌ Business plant search error:', error);
    throw error;
  }
};

// -----------------------------
// Inventory (used by AddInventoryScreen)
// -----------------------------
/**
 * Get Business Inventory
 * Backend route: GET /marketplace/business/{businessId}/inventory
 */
export const getBusinessInventory = async (businessId) => {
  try {
    const headers = await getEnhancedHeaders();
    const id =
      businessId ||
      headers['X-Business-ID'] ||
      (await AsyncStorage.getItem('businessId'));

    if (!id) {
      console.warn('ℹ️ No businessId found; returning empty inventory');
      return { success: true, inventory: [] };
    }

    const url = `${API_BASE_URL}/marketplace/business/${encodeURIComponent(id)}/inventory`;

    const resp = await apiRequest(url, { method: 'GET', headers }, 3, 'Get Business Inventory');

    const inventory =
      resp.inventory ||
      resp.items ||
      resp.products ||
      (Array.isArray(resp) ? resp : resp?.data) ||
      [];

    return { success: true, inventory: Array.isArray(inventory) ? inventory : [] };
  } catch (error) {
    console.error('❌ Get business inventory error:', error);
    return { success: true, inventory: [] };
  }
};

/**
 * Create Inventory Item
 * Your route: POST /business/inventory  (anonymous)
 */
export const createInventoryItem = async (item) => {
  try {
    const headers = await getEnhancedHeaders();
    const businessId =
      item.businessId ||
      headers['X-Business-ID'] ||
      (await AsyncStorage.getItem('businessId'));

    // Normalize fields to match backend expectations
    const payload = {
      ...item,
      businessId, // backend actually derives this from headers, but safe to send
      productName: item.productName || item.name,
      common_name: item.common_name || item.name,
      scientific_name: item.scientific_name || item.scientificName,
      plantInfo: item.plantInfo || item.plantData || {},
    };

    // Primary route (from your function.json)
    const url = `${API_BASE_URL}/business/inventory`;

    const resp = await apiRequest(
      url,
      { method: 'POST', headers, body: JSON.stringify(payload) },
      1,
      'Create Inventory Item'
    );

    const created = resp.inventoryItem || resp.item || resp.product || resp.data || resp;
    if (created) return { success: true, item: created };

    throw new Error('Create inventory: unexpected response shape.');
  } catch (error) {
    console.error('❌ Create inventory item error:', error);
    throw error;
  }
};

// -----------------------------
// Watering / ops utilities
// -----------------------------
/**
 * Get Business Weather Advice
 */
export const getBusinessWeatherAdvice = async (location) => {
  try {
    console.log('🌤️ Getting business weather advice');
    const headers = await getEnhancedHeaders();

    let url = `${API_BASE_URL}/business/weather`;
    if (location?.latitude != null && location?.longitude != null) {
      const qs = `lat=${encodeURIComponent(location.latitude)}&lon=${encodeURIComponent(location.longitude)}`;
      url = `${url}?${qs}`;
    }

    const response = await apiRequest(
      url,
      { method: 'GET', headers },
      3,
      'Business Weather Advice'
    );

    return {
      success: true,
      weather: response.weather || response.data || {},
      advice: response.advice || response.plantCareAdvice || [],
      location: response.location || location,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error('❌ Business weather advice error:', error);
    throw error;
  }
};

/**
 * Generate Plant Barcode
 */
export const generatePlantBarcode = async (plantData) => {
  try {
    console.log('📊 Generating plant barcode');
    const headers = await getEnhancedHeaders();

    const url = `${API_BASE_URL}/generate_plant_barcode`;
    const response = await apiRequest(
      url,
      {
        method: 'POST',
        headers,
        body: JSON.stringify(plantData),
      },
      3,
      'Generate Plant Barcode'
    );

    return {
      success: true,
      barcode: response.barcode || '',
      barcodeImage: response.barcodeImage || '',
      plantData: response.plantData || plantData,
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error('❌ Generate barcode error:', error);
    throw error;
  }
};

/**
 * Mark Plants as Watered
 */
export const markPlantsAsWatered = async (plantIds, wateringData = {}) => {
  try {
    console.log('💧 Marking plants as watered:', plantIds.length);
    const headers = await getEnhancedHeaders();

    const url = `${API_BASE_URL}/business-mark-watered`;
    const response = await apiRequest(
      url,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          plantIds,
          wateringDate: new Date().toISOString(),
          ...wateringData,
        }),
      },
      3,
      'Mark Plants Watered'
    );

    return {
      success: true,
      wateredPlants: response.wateredPlants || plantIds,
      wateringRecord: response.wateringRecord || {},
      nextWateringDates: response.nextWateringDates || {},
      updatedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error('❌ Mark plants watered error:', error);
    throw error;
  }
};

/**
 * Get Business Watering Checklist
 */
export const getBusinessWateringChecklist = async () => {
  try {
    console.log('✅ Getting business watering checklist');
    const headers = await getEnhancedHeaders();

    const url = `${API_BASE_URL}/business-watering-checklist`;
    const response = await apiRequest(
      url,
      {
        method: 'GET',
        headers,
      },
      3,
      'Business Watering Checklist'
    );

    return {
      success: true,
      checklist: response.checklist || [],
      summary: {
        totalPlants: response.totalPlants || 0,
        plantsNeedingWater: response.plantsNeedingWater || 0,
        overdueWatering: response.overdueWatering || 0,
        completedToday: response.completedToday || 0,
      },
      lastUpdated: response.lastUpdated || new Date().toISOString(),
    };
  } catch (error) {
    console.error('❌ Business watering checklist error:', error);
    throw error;
  }
};

/**
 * Optimize Watering Route
 */
export const optimizeWateringRoute = async (plantsToWater) => {
  try {
    console.log('🗺️ Optimizing watering route for', plantsToWater.length, 'plants');
    const headers = await getEnhancedHeaders();

    const url = `${API_BASE_URL}/business-watering-route`;
    const response = await apiRequest(
      url,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ plants: plantsToWater }),
      },
      3,
      'Optimize Watering Route'
    );

    return {
      success: true,
      optimizedRoute: response.optimizedRoute || [],
      routeMap: response.routeMap || [],
      estimatedTime: response.estimatedTime || 0,
      totalDistance: response.totalDistance || 0,
      routeEfficiency: response.routeEfficiency || 'optimal',
    };
  } catch (error) {
    console.error('❌ Optimize Watering Route error:', error);
    throw error;
  }
};

// -----------------------------
// AI helper
// -----------------------------
/**
 * AI Plant Care Chat
 */
export const getAIPlantCareAdvice = async (message, plantData = null, context = null) => {
  try {
    console.log('🤖 Getting AI plant care advice');

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      throw new Error('Message is required and cannot be empty');
    }

    const headers = await getEnhancedHeaders();

    const requestBody = {
      message: message.trim(),
      ...(plantData && { plantData }),
      ...(context && { context }),
      timestamp: new Date().toISOString(),
    };

    const url = `${API_BASE_URL}/ai-plant-care-chat`;
    const response = await apiRequest(
      url,
      {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
      },
      3,
      'AI Plant Care Chat'
    );

    return {
      success: true,
      response:
        response.response ||
        response.advice ||
        response.message ||
        'I apologize, but I could not generate a response at this time.',
      confidence: response.confidence || 0.8,
      suggestions: response.suggestions || [],
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error('❌ AI plant care advice error:', error);
    throw error;
  }
};

// -----------------------------
// Default export (for namespace imports)
// -----------------------------
export default {
  // search & inventory
  searchPlantsForBusiness,
  getBusinessInventory,
  createInventoryItem,

  // ops
  getBusinessWeatherAdvice,
  generatePlantBarcode,
  markPlantsAsWatered,
  getBusinessWateringChecklist,
  optimizeWateringRoute,

  // ai
  getAIPlantCareAdvice,
};
