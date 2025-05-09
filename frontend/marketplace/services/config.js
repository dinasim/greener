// services/config.js
// Configuration for API services
const config = {
    // Base URL for API services
    API_BASE_URL: 'https://usersfunctions.azurewebsites.net/api',
    
    // Feature flags
    features: {
      // Set to true to use real API, false to use mock data
      useRealApi: false,
      
      // Enable/disable map view
      enableMapView: true,
      
      // Enable/disable image uploads
      enableImageUploads: true,
    },
    
    // Azure Maps key - replace with your actual key in production
    AZURE_MAPS_KEY: 'YOUR_AZURE_MAPS_KEY',
    
    // Google Sign-In configuration
    GOOGLE_CLIENT_ID: {
      expoClientId: 'YOUR_EXPO_CLIENT_ID',
      iosClientId: 'YOUR_IOS_CLIENT_ID',
      androidClientId: 'YOUR_ANDROID_CLIENT_ID',
      webClientId: 'YOUR_WEB_CLIENT_ID',
    },
  };
  
  export default config;