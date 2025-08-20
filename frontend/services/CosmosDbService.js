// CosmosDbService.js - Service for communicating with Azure Cosmos DB via Azure Functions
import AsyncStorage from '@react-native-async-storage/async-storage';

// Base API URL for Azure Functions
const API_BASE_URL = 'https://usersfunctions.azurewebsites.net/api';

// Helper: safely encode any dynamic path segment
const seg = (v) => encodeURIComponent(String(v ?? ''));

class CosmosDbService {
  constructor() {
    this.initializeToken();
    this.pendingRequests = [];
    this.isNetworkError = false;
    this.authToken = null;
  }

  // Initialize auth token for API calls
  async initializeToken() {
    try {
      this.authToken = await AsyncStorage.getItem('token');
    } catch {
      this.authToken = null;
    }
  }

  // Generic fetch with retries, exponential backoff, and timeout
  async callApi(endpoint, method = 'GET', data = null, retryCount = 3) {
    if (!this.authToken) {
      await this.initializeToken();
    }

    const headers = {
      'Content-Type': 'application/json',
      ...(this.authToken ? { Authorization: `Bearer ${this.authToken}` } : {}),
    };

    const options = { method, headers };
    if (data) options.body = JSON.stringify(data);

    for (let attempt = 1; attempt <= retryCount; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 25000); // 25s timeout
      try {
        const res = await fetch(`${API_BASE_URL}/${endpoint}`, {
          ...options,
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (res.status === 401) {
          // you can hook refresh logic here if needed
          return { error: 'Unauthorized', status: 401 };
        }

        const text = await res.text();

        if (!res.ok) {
          // Retry on 5xx
          if (res.status >= 500 && attempt < retryCount) {
            const delay = Math.min(1000 * 2 ** (attempt - 1), 5000);
            await new Promise((r) => setTimeout(r, delay));
            continue;
          }
          return { error: `API error: ${res.status}`, status: res.status, raw: text };
        }

        // Try parse JSON; if empty body, return empty object
        let json;
        try {
          json = text ? JSON.parse(text) : {};
        } catch {
          json = { data: text };
        }

        this.isNetworkError = false;
        return { data: json, status: res.status };
      } catch (err) {
        clearTimeout(timeoutId);
        // Network/timeout retry
        const isNet =
          err?.name === 'AbortError' ||
          /Network|Failed to fetch|timeout/i.test(String(err?.message || ''));
        if (isNet && attempt < retryCount) {
          const delay = Math.min(1000 * 2 ** (attempt - 1), 5000);
          await new Promise((r) => setTimeout(r, delay));
          continue;
        }
        this.isNetworkError = true;
        return { error: err?.message || 'Network error', status: 0 };
      }
    }

    return { error: 'Unknown error', status: 0 };
  }

  // -----------------------------
  // AI Chat (plant-care-chat container)
  // -----------------------------
  async getChatHistory(sessionId, limit = 20) {
    const result = await this.callApi(`chat-history/${seg(sessionId)}?limit=${limit}`);
    if (result.error) throw new Error(`Failed to retrieve chat history: ${result.error}`);

    // Backend returns a raw array; normalize defensively
    const d = result.data;
    return Array.isArray(d) ? d : Array.isArray(d?.data) ? d.data : [];
  }

  async saveChatMessages(sessionId, messages) {
    const result = await this.callApi('chat-history', 'POST', { sessionId, messages });
    if (result.error) throw new Error(`Failed to save chat messages: ${result.error}`);
    return result.data;
  }

  async deleteChatHistory(sessionId) {
    const result = await this.callApi(`chat-history/${seg(sessionId)}`, 'DELETE');
    if (result.error) throw new Error(`Failed to delete chat history: ${result.error}`);
    return result.data;
  }

  // -----------------------------
  // User Preferences
  // -----------------------------
  async getUserPreferences(userId) {
    const result = await this.callApi(`user-preferences/${seg(userId)}`);
    if (result.error) throw new Error(`Failed to get user preferences: ${result.error}`);
    return result.data || {};
  }

  async saveUserPreferences(userId, preferences) {
    const result = await this.callApi('user-preferences', 'POST', { userId, preferences });
    if (result.error) throw new Error(`Failed to save user preferences: ${result.error}`);
    return result.data;
  }

  // -----------------------------
  // Authentication metadata
  // -----------------------------
  async saveAuthData(userId, authData) {
    // Store token locally for immediate use
    await AsyncStorage.setItem('token', authData.token);
    this.authToken = authData.token;

    const result = await this.callApi('auth-data', 'POST', {
      userId,
      authData: {
        provider: authData.provider,
        lastLogin: new Date().toISOString(),
        expiresAt: authData.expiresAt,
      },
    });
    if (result.error) throw new Error(`Failed to save authentication data: ${result.error}`);
    return result.data;
  }

  // -----------------------------
  // Weather Data
  // -----------------------------
  async getWeatherData(locationId) {
    const result = await this.callApi(`weather-data/${seg(locationId)}`);
    if (result.error) throw new Error(`Failed to get weather data: ${result.error}`);
    return result.data;
  }

  async saveWeatherLocation(userId, locationData) {
    const locationInfo = {
      userId,
      locationId: locationData.locationId || `loc_${Date.now()}`,
      latitude: locationData.latitude,
      longitude: locationData.longitude,
      name: locationData.name,
      timestamp: new Date().toISOString(),
    };

    const result = await this.callApi('user-locations', 'POST', locationInfo);
    if (result.error) throw new Error(`Failed to save weather location: ${result.error}`);
    return result.data;
  }

  // -----------------------------
  // Notifications
  // -----------------------------
  async getNotificationSettings(userId) {
    const result = await this.callApi(`notification-settings/${seg(userId)}`);
    if (result.error) throw new Error(`Failed to get notification settings: ${result.error}`);
    return result.data;
  }

  async saveNotificationSettings(userId, settings) {
    const result = await this.callApi('notification-settings', 'POST', { userId, settings });
    if (result.error) throw new Error(`Failed to save notification settings: ${result.error}`);
    return result.data;
  }

  async saveDeviceToken(userId, platform, token) {
    const result = await this.callApi('device-tokens', 'POST', {
      userId,
      platform,
      token,
      lastUpdated: new Date().toISOString(),
    });
    if (result.error) throw new Error(`Failed to save device token: ${result.error}`);

    await AsyncStorage.setItem(`fcm_token_${platform}`, token);
    return result.data;
  }
}

export default new CosmosDbService();
