// Business/services/businessPlantApi.js - NEW: Plant-specific business functions
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = 'https://usersfunctions.azurewebsites.net/api';

// Reuse utility functions
const getEnhancedHeaders = async () => {
  try {
    const [userEmail, userType, businessId, authToken] = await Promise.all([
      AsyncStorage.getItem('userEmail'),
      AsyncStorage.getItem('userType'),
      AsyncStorage.getItem('businessId'),
      AsyncStorage.getItem('googleAuthToken')
    ]);

    const headers = {
      'Content-Type': 'application/json',
      'X-API-Version': '1.0',
      'X-Client': 'greener-mobile'
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
      const response = await fetch(url, { timeout: 15000, ...options });
      const responseText = await response.text();
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${responseText}`);
      try {
        return JSON.parse(responseText);
      } catch {
        return { success: true, data: responseText };
      }
    } catch (error) {
      if (attempt === retries) throw error;
      await new Promise(resolve => setTimeout(resolve, Math.min(1000 * Math.pow(2, attempt - 1), 5000)));
    }
  }
};

/**
 * Search Plants for Business Inventory
 */
export const searchPlantsForBusiness = async (query, filters = {}) => {
  try {
    console.log('🔍 Searching plants for business:', query);
    const headers = await getEnhancedHeaders();
    
    const url = `${API_BASE_URL}/business-plant-search`;
    const response = await apiRequest(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ query, ...filters }),
    }, 3, 'Business Plant Search');

    return {
      success: true,
      query,
      results: response.plants || response.results || [],
      totalResults: response.totalResults || 0,
      suggestions: response.suggestions || [],
      filters: response.appliedFilters || filters
    };
  } catch (error) {
    console.error('❌ Business plant search error:', error);
    throw error;
  }
};

/**
 * Get Weather Advice for Business
 */
export const getBusinessWeatherAdvice = async (location) => {
  try {
    console.log('🌤️ Getting business weather advice');
    const headers = await getEnhancedHeaders();
    
    const url = `${API_BASE_URL}/business-weather-get`;
    const response = await apiRequest(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ location }),
    }, 3, 'Business Weather Advice');

    return {
      success: true,
      location,
      weather: response.weather || {},
      advice: response.advice || [],
      plantCareRecommendations: response.plantCareRecommendations || [],
      businessInsights: response.businessInsights || [],
      lastUpdated: response.lastUpdated || new Date().toISOString()
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
    const response = await apiRequest(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(plantData),
    }, 3, 'Generate Plant Barcode');

    return {
      success: true,
      barcode: response.barcode || '',
      barcodeImage: response.barcodeImage || '',
      plantData: response.plantData || plantData,
      generatedAt: new Date().toISOString()
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
    const response = await apiRequest(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ 
        plantIds, 
        wateringDate: new Date().toISOString(),
        ...wateringData 
      }),
    }, 3, 'Mark Plants Watered');

    return {
      success: true,
      wateredPlants: response.wateredPlants || plantIds,
      wateringRecord: response.wateringRecord || {},
      nextWateringDates: response.nextWateringDates || {},
      updatedAt: new Date().toISOString()
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
    const response = await apiRequest(url, {
      method: 'GET',
      headers,
    }, 3, 'Business Watering Checklist');

    return {
      success: true,
      checklist: response.checklist || [],
      summary: {
        totalPlants: response.totalPlants || 0,
        plantsNeedingWater: response.plantsNeedingWater || 0,
        overdueWatering: response.overdueWatering || 0,
        completedToday: response.completedToday || 0
      },
      lastUpdated: response.lastUpdated || new Date().toISOString()
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
    const response = await apiRequest(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ plants: plantsToWater }),
    }, 3, 'Optimize Watering Route');

    return {
      success: true,
      optimizedRoute: response.optimizedRoute || [],
      routeMap: response.routeMap || [],
      estimatedTime: response.estimatedTime || 0,
      totalDistance: response.totalDistance || 0,
      routeEfficiency: response.routeEfficiency || 'optimal'
    };
  } catch (error) {
    console.error('❌ Optimize watering route error:', error);
    throw error;
  }
};

export default {
  searchPlantsForBusiness,
  getBusinessWeatherAdvice,
  generatePlantBarcode,
  markPlantsAsWatered,
  getBusinessWateringChecklist,
  optimizeWateringRoute,
};