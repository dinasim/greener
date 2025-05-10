// services/config.js - Improved version
import { Platform } from 'react-native';

// Define environments
const ENV = {
  DEV: 'development',
  STAGING: 'staging',
  PROD: 'production'
};

// Determine current environment
// In a real app, this might come from environment variables or build config
const currentEnv = __DEV__ ? ENV.DEV : ENV.PROD;

// Base configs that apply to all environments
const baseConfig = {
  app: {
    name: 'Greener',
    version: '1.0.0',
    defaultLocation: {
      latitude: 32.0853, // Tel Aviv, Israel
      longitude: 34.7818,
      city: 'Tel Aviv',
    },
    // Limits
    maxImageSize: 5 * 1024 * 1024, // 5MB
    maxImageCount: 5,
    maxPriceRange: 10000,
  },
  
  // Feature toggles
  features: {
    enableMapView: true,
    enableImageUploads: true,
    enableNotifications: false,
  },
};

// Environment specific configurations
const envSpecificConfigs = {
  [ENV.DEV]: {
    api: {
      baseUrl: 'https://greener-dev-api.azurewebsites.net/api',
      timeout: 10000, // 10 seconds
    },
    useRealApi: false, // Use mock data in development
    logLevel: 'debug',
  },
  [ENV.STAGING]: {
    api: {
      baseUrl: 'https://greener-staging-api.azurewebsites.net/api',
      timeout: 10000,
    },
    useRealApi: true,
    logLevel: 'info',
  },
  [ENV.PROD]: {
    api: {
      baseUrl: 'https://greener-api.azurewebsites.net/api',
      timeout: 15000, // 15 seconds
    },
    useRealApi: true,
    logLevel: 'error',
  }
};

// Merge the base config with the environment-specific config
const config = {
  ...baseConfig,
  ...envSpecificConfigs[currentEnv],
  
  // Environment helpers
  isDevelopment: currentEnv === ENV.DEV,
  isStaging: currentEnv === ENV.STAGING,
  isProduction: currentEnv === ENV.PROD,
  
  // Platform helpers
  isIOS: Platform.OS === 'ios',
  isAndroid: Platform.OS === 'android',
  isWeb: Platform.OS === 'web',
  
  // Google Auth configuration
  auth: {
    googleClientId: {
      expoClientId: process.env.EXPO_GOOGLE_CLIENT_ID || 'YOUR_EXPO_CLIENT_ID',
      iosClientId: process.env.IOS_GOOGLE_CLIENT_ID || 'YOUR_IOS_CLIENT_ID',
      androidClientId: process.env.ANDROID_GOOGLE_CLIENT_ID || 'YOUR_ANDROID_CLIENT_ID',
      webClientId: process.env.WEB_GOOGLE_CLIENT_ID || 'YOUR_WEB_CLIENT_ID',
    },
    tokenExpiryTime: 60 * 60 * 1000, // 1 hour
  },
  
  // Azure Maps configuration
  azureMaps: {
    subscriptionKey: process.env.AZURE_MAPS_KEY || 'dummy-key-for-development',
    renderMode: 'hybrid', // 'vector', 'raster', or 'hybrid'
    centerCoordinates: {
      latitude: 31.5, // Center of Israel
      longitude: 34.8,
    }
  },
};

export default config;