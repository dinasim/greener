// Business/services/index.js - Centralized Business Services Export
// Following Azure best practices for service organization and dependency management

// Core Business API Services
export { 
  getBusinessProfile, 
  getBusinessDashboard,
  getBusinessInventory,
  createInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
  bulkUpdateInventory,
  getBusinessOrders,
  getBusinessCustomers,
  createBusinessProfile,
  updateBusinessProfile,
  fetchBusinessProfile,
  uploadBusinessImages,
  checkApiHealth,
  getBusinessAnalytics,
  getBusinessReports,
  searchPlantsForBusiness,
  getBusinessWeatherAdvice,
  publishInventoryToMarketplace,
  generatePlantBarcode,
  getBusinessNotificationSettings,
  updateBusinessNotificationSettings,
  // Utility functions
  ApiError,
  getStockLevel,
  getLoyaltyLevel
} from './businessApi';

// Marketplace-specific Business Services
export {
  getBusinessMarketplaceProfile,
  updateBusinessMarketplaceProfile,
  getBusinessMarketplaceProducts,
  publishProductsToMarketplace,
  getNearbyBusinesses,
  getAllBusinesses
} from './businessMarketplaceApi';

// Business Reports & Analytics Services
export {
  getDetailedAnalytics,
  generateBusinessReport,
  exportBusinessData
} from './businessReportsApi';

// Plant-specific Business Services
export {
  searchPlantsForBusiness as searchBusinessPlants,
  getBusinessWeatherAdvice as getWeatherAdvice,
  generatePlantBarcode,
  markPlantsAsWatered,
  getBusinessWateringChecklist,
  optimizeWateringRoute
} from './businessPlantApi';

// Existing specialized services
export * from './businessAnalyticsApi';
export * from './businessOrderApi';
export * from './businessWateringApi';
export * from './businessFirebaseNotifications';
export * from './BusinessFirebaseNotificationService';
export * from './notificationPollingApi';

// Service health check function - Azure best practice
export const checkAllBusinessServicesHealth = async () => {
  try {
    const healthChecks = await Promise.allSettled([
      checkApiHealth(),
      // Add other service health checks as needed
    ]);
    
    return {
      healthy: healthChecks.every(check => check.status === 'fulfilled' && check.value.healthy),
      services: healthChecks.map((check, index) => ({
        service: ['businessApi'][index],
        healthy: check.status === 'fulfilled' && check.value?.healthy,
        error: check.status === 'rejected' ? check.reason : null
      }))
    };
  } catch (error) {
    return { healthy: false, error: error.message };
  }
};