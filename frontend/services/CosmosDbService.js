// CosmosDbService.js - Service for communicating with Azure Cosmos DB via Azure Functions
import AsyncStorage from '@react-native-async-storage/async-storage';

// Base API URL for Azure Functions
const API_BASE_URL = 'https://usersfunctions.azurewebsites.net/api';

/**
 * Service class to handle communication with Cosmos DB through Azure Functions
 * Production-ready implementation with direct Azure Cosmos DB storage
 * with no local fallbacks
 */
class CosmosDbService {
  constructor() {
    this.initializeToken();
    this.pendingRequests = [];
    this.isNetworkError = false;
  }

  // Initialize authentication token for API calls
  async initializeToken() {
    this.authToken = await AsyncStorage.getItem('token');
  }

  // Helper method for authenticated API calls with retry logic
  async callApi(endpoint, method = 'GET', data = null, retryCount = 3) {
    try {
      if (!this.authToken) {
        await this.initializeToken();
      }

      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.authToken}`
      };

      const options = {
        method,
        headers,
      };

      if (data) {
        options.body = JSON.stringify(data);
      }

      // Network request with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
      
      options.signal = controller.signal;

      const response = await fetch(`${API_BASE_URL}/${endpoint}`, options);
      clearTimeout(timeoutId);

      // If unauthorized, handle auth error
      if (response.status === 401) {
        console.log('Auth token expired or invalid');
        return { error: 'Unauthorized', status: 401 };
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`API error (${response.status}): ${errorText}`);
        
        // Retry on server errors if retries remain
        if (response.status >= 500 && retryCount > 0) {
          console.log(`Retrying request to ${endpoint}, ${retryCount} attempts remaining`);
          // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, 4-retryCount) * 500));
          return this.callApi(endpoint, method, data, retryCount - 1);
        }
        
        return { error: `API error: ${response.status}`, status: response.status };
      }

      const result = await response.json();
      this.isNetworkError = false;
      return { data: result, status: response.status };
      
    } catch (error) {
      console.error('API call failed:', error);
      
      // Network error with retry
      if ((error.name === 'AbortError' || error.message.includes('Network') || error.message.includes('Failed to fetch')) && retryCount > 0) {
        console.log(`Network issue detected. Retrying request to ${endpoint}, ${retryCount} attempts remaining`);
        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, 4-retryCount) * 500));
        return this.callApi(endpoint, method, data, retryCount - 1);
      }
      
      this.isNetworkError = true;
      return { error: error.message, status: 0 };
    }
  }

  // AI Chat Methods - Using plant-care-chat container
  async getChatHistory(sessionId, limit = 20) {
    const result = await this.callApi(`chat-history/${sessionId}?limit=${limit}`);
    
    if (result.error) {
      throw new Error(`Failed to retrieve chat history: ${result.error}`);
    }
    
    return result.data || [];
  }

  async saveChatMessages(sessionId, messages) {
    const result = await this.callApi('chat-history', 'POST', {
      sessionId,
      messages
    });
    
    if (result.error) {
      throw new Error(`Failed to save chat messages: ${result.error}`);
    }
    
    return result.data;
  }

  async deleteChatHistory(sessionId) {
    const result = await this.callApi(`chat-history/${sessionId}`, 'DELETE');
    
    if (result.error) {
      throw new Error(`Failed to delete chat history: ${result.error}`);
    }
    
    return result.data;
  }

  // User Preferences - Using Preferences container
  async getUserPreferences(userId) {
    const result = await this.callApi(`user-preferences/${userId}`);
    
    if (result.error) {
      throw new Error(`Failed to get user preferences: ${result.error}`);
    }
    
    return result.data || {};
  }

  async saveUserPreferences(userId, preferences) {
    const result = await this.callApi('user-preferences', 'POST', {
      userId,
      preferences
    });
    
    if (result.error) {
      throw new Error(`Failed to save user preferences: ${result.error}`);
    }
    
    return result.data;
  }

  // Authentication - Using authentication container
  async saveAuthData(userId, authData) {
    // Store token locally for immediate use, but metadata in Cosmos DB
    await AsyncStorage.setItem('token', authData.token);
    
    const result = await this.callApi('auth-data', 'POST', {
      userId,
      authData: {
        provider: authData.provider,
        lastLogin: new Date().toISOString(),
        expiresAt: authData.expiresAt
      }
    });
    
    if (result.error) {
      throw new Error(`Failed to save authentication data: ${result.error}`);
    }
    
    return result.data;
  }

  // Weather Data - Using Weather_data container
  async getWeatherData(locationId) {
    const result = await this.callApi(`weather-data/${locationId}`);
    
    if (result.error) {
      throw new Error(`Failed to get weather data: ${result.error}`);
    }
    
    return result.data;
  }

  async saveWeatherLocation(userId, locationData) {
    // Format the location data for storage
    const locationInfo = {
      userId,
      locationId: locationData.locationId || `loc_${new Date().getTime()}`,
      latitude: locationData.latitude,
      longitude: locationData.longitude,
      name: locationData.name,
      timestamp: new Date().toISOString()
    };
    
    const result = await this.callApi('user-locations', 'POST', locationInfo);
    
    if (result.error) {
      throw new Error(`Failed to save weather location: ${result.error}`);
    }
    
    return result.data;
  }

  // Notification settings - Using notifications container
  async getNotificationSettings(userId) {
    const result = await this.callApi(`notification-settings/${userId}`);
    
    if (result.error) {
      throw new Error(`Failed to get notification settings: ${result.error}`);
    }
    
    return result.data;
  }

  async saveNotificationSettings(userId, settings) {
    const result = await this.callApi('notification-settings', 'POST', {
      userId,
      settings
    });
    
    if (result.error) {
      throw new Error(`Failed to save notification settings: ${result.error}`);
    }
    
    return result.data;
  }

  async saveDeviceToken(userId, platform, token) {
    // Save to Cosmos DB
    const result = await this.callApi('device-tokens', 'POST', {
      userId,
      platform,
      token,
      lastUpdated: new Date().toISOString()
    });
    
    if (result.error) {
      throw new Error(`Failed to save device token: ${result.error}`);
    }
    
    // We still need to keep the token locally for push notifications to work
    await AsyncStorage.setItem(`fcm_token_${platform}`, token);
    
    return result.data;
  }
}

// Export singleton instance
export default new CosmosDbService();