// services/config.js
const config = {
  // API Configuration
  api: {
    baseUrl: 'https://usersfunctions.azurewebsites.net/api',
    timeout: 10000, // 10 seconds
  },
  
  // Feature Flags
  features: {
    useRealApi: false, // Set to true in production
    enableMapView: true,
    enableImageUploads: true,
    enableNotifications: false, // Not yet implemented
  },
  
  // Azure Maps Configuration
  azureMaps: {
    subscriptionKey: process.env.AZURE_MAPS_KEY || 'YOUR_AZURE_MAPS_KEY',
    renderMode: 'hybrid', // 'vector', 'raster', or 'hybrid'
  },
  
  // Google Sign-In Configuration
  auth: {
    googleClientId: {
      expoClientId: process.env.EXPO_GOOGLE_CLIENT_ID || 'YOUR_EXPO_CLIENT_ID',
      iosClientId: process.env.IOS_GOOGLE_CLIENT_ID || 'YOUR_IOS_CLIENT_ID',
      androidClientId: process.env.ANDROID_GOOGLE_CLIENT_ID || 'YOUR_ANDROID_CLIENT_ID',
      webClientId: process.env.WEB_GOOGLE_CLIENT_ID || 'YOUR_WEB_CLIENT_ID',
    },
    // How long tokens remain valid, in milliseconds
    // How long tokens remain valid, in milliseconds (1 hour)
    tokenExpiryTime: 60 * 60 * 1000,
  },
  
  // App Configuration
  app: {
    name: 'Greener',
    version: '1.0.0',
    defaultLocation: {
      latitude: 47.6062,
      longitude: -122.3321,
      city: 'Seattle',
    },
    // Limits
    maxImageSize: 5 * 1024 * 1024, // 5MB
    maxImageCount: 5,
    maxPriceRange: 10000,
  },
  
  // Environment Detection
  isDevelopment: process.env.NODE_ENV === 'development' || __DEV__,
};

export default config;