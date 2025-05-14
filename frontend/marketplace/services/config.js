// marketplace/services/config.js
import { Platform } from 'react-native';

const ENV = {
  DEV: 'development',
  STAGING: 'staging',
  PROD: 'production'
};

// Determine current environment
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
  },
  
  // Feature toggles
  features: {
    enableMapView: true,
    enableImageUploads: true,
    enableNotifications: false,
    useRealApi: true, // Set to true to use real Azure backend
    useMockOnError: false, // Fall back to mock data on API error
  },
};

// Environment specific configurations
const envSpecificConfigs = {
  [ENV.DEV]: {
    api: {
      baseUrl: 'https://usersfunctions.azurewebsites.net/api',
      timeout: 10000, // 10 seconds
    },
    logLevel: 'debug',
  },
  [ENV.STAGING]: {
    api: {
      baseUrl: 'https://usersfunctions.azurewebsites.net/api',
      timeout: 10000,
    },
    logLevel: 'info',
  },
  [ENV.PROD]: {
    api: {
      baseUrl: 'https://usersfunctions.azurewebsites.net/api',
      timeout: 15000, // 15 seconds
    },
    logLevel: 'error',
  }
};

// Merge configs
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
};

export default config;