// marketplace/services/config.js
import { Platform } from 'react-native';
const ENV = { DEV: 'development', STAGING: 'staging', PROD: 'production' };
const currentEnv = __DEV__ ? ENV.DEV : ENV.PROD;
const baseConfig = {
  app: {
    name: 'Greener',
    version: '1.0.0',
    defaultLocation: { latitude: 32.0853, longitude: 34.7818, city: 'Tel Aviv' },
  },
  features: { enableMapView: true, enableImageUploads: true, enableNotifications: false, useRealApi: true, useMockOnError: false },
};
const envSpecificConfigs = {
  [ENV.DEV]: { api: { baseUrl: 'https://usersfunctions.azurewebsites.net/api', timeout: 10000 }, logLevel: 'debug' },
  [ENV.STAGING]: { api: { baseUrl: 'https://usersfunctions.azurewebsites.net/api', timeout: 10000 }, logLevel: 'info' },
  [ENV.PROD]: { api: { baseUrl: 'https://usersfunctions.azurewebsites.net/api', timeout: 15000 }, logLevel: 'error' }
};
const config = {
  ...baseConfig,
  ...envSpecificConfigs[currentEnv],
  isDevelopment: currentEnv === ENV.DEV,
  isStaging: currentEnv === ENV.STAGING,
  isProduction: currentEnv === ENV.PROD,
  isIOS: Platform.OS === 'ios',
  isAndroid: Platform.OS === 'android',
  isWeb: Platform.OS === 'web',
};
export default config;