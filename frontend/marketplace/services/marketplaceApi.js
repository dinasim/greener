// Frontend: services/marketplaceApi.js
import config from './config';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';
const API_BASE_URL = config.api.baseUrl;
let authToken = null;
export const setAuthToken = async (token) => {
  try {
    authToken = token;
    global.googleAuthToken = token;
    await AsyncStorage.setItem('googleAuthToken', token);
    console.log('Auth token set successfully');
    return true;
  } catch (error) {
    console.error('Error setting auth token:', error);
    return false;
  }
};
export const initializeAuthToken = async () => {
  try {
    const token = await AsyncStorage.getItem('googleAuthToken');
    if (token) {
      authToken = token;
      global.googleAuthToken = token;
      console.log('Auth token initialized from storage');
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error initializing auth token:', error);
    return false;
  }
};
const apiRequest = async (endpoint, method = 'GET', body = null) => {
  try {
    const userEmail = await AsyncStorage.getItem('userEmail');
    const headers = { 'Content-Type': 'application/json' };
    if (authToken) { headers['Authorization'] = `Bearer ${authToken}`; }
    if (userEmail) {
      headers['X-User-Email'] = userEmail;
      if (!endpoint.includes('userId=') && !endpoint.includes('email=')) {
        endpoint += endpoint.includes('?') ? `&userId=${encodeURIComponent(userEmail)}` : `?userId=${encodeURIComponent(userEmail)}`;
      }
    }
    const options = { method, headers };
    if (body) {
      if (userEmail && body && typeof body === 'object' && !body.userId && !body.email && method !== 'GET') {
        body.userId = userEmail;
      }
      options.body = JSON.stringify(body);
    }
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Request timeout')), config.api.timeout);
    });
    const fetchPromise = fetch(`${API_BASE_URL}/${endpoint}`, options);
    const response = await Promise.race([fetchPromise, timeoutPromise]);
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `API error: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error(`API Error (${endpoint}):`, error);
    if (config.features.useMockOnError) {
      console.log('Using mock data due to API error');
      if (endpoint.includes('products') || endpoint.includes('plants')) {
        return getMockProductData(endpoint);
      } else if (endpoint.includes('user')) {
        return { user: MOCK_USER };
      } else if (endpoint.includes('messages')) {
        return getMockMessageData(endpoint);
      } else {
        return { success: true, mockData: true };
      }
    }
    throw error;
  }
};

const getMockProductData = (endpoint) => {
  if (endpoint.includes('specific')) {
    const id = endpoint.split('/').pop();
    return getMockProductById(id);
  } else if (endpoint.includes('wish')) {
    return { success: true, isWished: Math.random() > 0.5, message: 'Wishlist updated (mock)', status: 'success' };
  } else {
    const params = new URLSearchParams(endpoint.split('?')[1] || '');
    const category = params.get('category');
    const search = params.get('search');
    return getMockProducts(category, search);
  }
};
export const getAll = async (page = 1, category = null, search = '', filters = {}) => {
  try {
    let endpoint = `marketplace/products?page=${page}`;
    if (search) endpoint += `&search=${encodeURIComponent(search)}`;
    if (category && category !== 'All') endpoint += `&category=${encodeURIComponent(category)}`;
    if (filters) {
      if (filters.minPrice) endpoint += `&minPrice=${filters.minPrice}`;
      if (filters.maxPrice) endpoint += `&maxPrice=${filters.maxPrice}`;
      if (filters.sortBy) endpoint += `&sortBy=${filters.sortBy}`;
      if (filters.sortOrder) endpoint += `&sortOrder=${filters.sortOrder}`;
    }
    return await apiRequest(endpoint);
  } catch (error) {
    console.error('Error fetching products:', error);
    if (config.features.useMockOnError) {
      return getMockProducts(category, search);
    }
    throw error;
  }
};
export const getSpecific = async (id) => {
  try {
    return await apiRequest(`marketplace/products/specific/${id}`);
  } catch (error) {
    console.error(`Error fetching product ${id}:`, error);
    if (config.features.useMockOnError) {
      return getMockProductById(id);
    }
    throw error;
  }
};
export const createPlant = async (plantData) => {
  try {
    const userEmail = await AsyncStorage.getItem('userEmail');
    if (userEmail) { plantData.sellerId = userEmail; }
    return await apiRequest('marketplace/products/create', 'POST', plantData);
  } catch (error) {
    console.error('Error creating plant:', error);
    throw error;
  }
};
export const wishProduct = async (id) => {
  try {
    return await apiRequest(`marketplace/products/wish/${id}`, 'POST');
  } catch (error) {
    console.error(`Error toggling wishlist for product ${id}:`, error);
    if (config.features.useMockOnError) {
      return { success: true, message: 'Wishlist toggled (mock)' };
    }
    throw error;
  }
};


export const deleteProduct = async (productId) => {
  try {
    return await apiRequest(`marketplace/products/${productId}`, 'DELETE');
  } catch (error) {
    console.error(`Error deleting product ${productId}:`, error);
    if (config.features.useMockOnError) {
      return { success: true, message: 'Product deleted successfully (mock)' };
    }
    throw error;
  }
};
export const updateProduct = async (productId, updateData) => {
  try {
    if (!productId) { throw new Error('Product ID is required'); }
    console.log(`Updating product ${productId}:`, updateData);
    const processedUpdateData = { ...updateData };
    if (processedUpdateData.image && typeof processedUpdateData.image === 'string' && 
        (processedUpdateData.image.startsWith('file:') || processedUpdateData.image.startsWith('data:'))) {
      try {
        console.log('Uploading updated main image...');
        const uploadResult = await uploadImage(processedUpdateData.image, 'plant');
        if (uploadResult && uploadResult.url) {
          console.log('Main image uploaded successfully:', uploadResult.url);
          processedUpdateData.image = uploadResult.url;
        } else {
          console.warn('Image upload returned unexpected result:', uploadResult);
        }
      } catch (err) {
        console.error('Failed to upload updated main image:', err);
        delete processedUpdateData.image;
      }
    }
    if (Array.isArray(processedUpdateData.images)) {
      const processedImages = [];
      let uploadFailed = false;
      console.log(`Processing ${processedUpdateData.images.length} additional images...`);
      for (const imgUri of processedUpdateData.images) {
        if (typeof imgUri === 'string' && (imgUri.startsWith('file:') || imgUri.startsWith('data:'))) {
          try {
            const uploadResult = await uploadImage(imgUri, 'plant');
            if (uploadResult && uploadResult.url) {
              processedImages.push(uploadResult.url);
            } else {
              console.warn('Additional image upload returned unexpected result:', uploadResult);
              uploadFailed = true;
            }
          } catch (err) {
            console.error('Failed to upload additional image:', err);
            uploadFailed = true;
          }
        } else { processedImages.push(imgUri); }
      }
      if (uploadFailed) {
        console.warn('Some images failed to upload. Proceeding with the images that succeeded.');
      }
      processedUpdateData.images = processedImages;
    }
    try {
      console.log(`Sending PATCH request to marketplace/products/${productId}`);
      const result = await apiRequest(`marketplace/products/${productId}`, 'PATCH', processedUpdateData);
      console.log('Update successful with PATCH:', result);
      return result;
    } catch (patchError) {
      if (patchError.message && (patchError.message.includes('404') || patchError.message.includes('405') ||
          patchError.message.includes('Method Not Allowed'))) {
        console.log('PATCH failed, trying PUT instead...');
        try {
          const result = await apiRequest(`marketplace/products/${productId}`, 'PUT', processedUpdateData);
          console.log('Update successful with PUT:', result);
          return result;
        } catch (putError) {
          console.error('Both PATCH and PUT failed:', putError);
          throw putError;
        }
      } else { throw patchError; }
    }
  } catch (error) {
    console.error(`Error updating product ${productId}:`, error);
    throw error;
  }
};
export const fetchConversations = async () => {
  try {
    return await apiRequest(`marketplace/messages/getUserConversations`);
  } catch (error) {
    console.error('Error fetching conversations:', error);
    if (config.features.useMockOnError) {
      return getMockMessageData('getUserConversations');
    }
    throw error;
  }
};
export const fetchMessages = async (conversationId) => {
  try {
    return await apiRequest(`marketplace/messages/getMessages/${conversationId}`);
  } catch (error) {
    console.error('Error fetching messages:', error);
    if (config.features.useMockOnError) {
      return getMockMessageData(`messages/${conversationId}`);
    }
    throw error;
  }
};
export const sendMessage = async (chatId, message) => {
  try {
    return await apiRequest('marketplace/messages/sendMessage', 'POST', { chatId, message });
  } catch (error) {
    console.error('Error sending message:', error);
    if (config.features.useMockOnError) {
      return getMockMessageData('sendMessage');
    }
    throw error;
  }
};
export const startConversation = async (receiver, plantId, message) => {
  try {
    const userEmail = await AsyncStorage.getItem('userEmail');
    return await apiRequest('marketplace/messages/createChatRoom', 'POST', { receiver, plantId, message, sender: userEmail });
  } catch (error) {
    console.error('Error starting conversation:', error);
    if (config.features.useMockOnError) {
      return getMockMessageData('createChatRoom');
    }
    throw error;
  }
};
export const sendTypingIndicator = async (conversationId, isTyping) => {
  try {
    return await apiRequest('marketplace/messages/typing', 'POST', { conversationId, isTyping });
  } catch (error) {
    console.error('Error sending typing indicator:', error);
    return { success: false };
  }
};
export const markMessagesAsRead = async (conversationId, messageIds = []) => {
  try {
    return await apiRequest('marketplace/messages/markAsRead', 'POST', { conversationId, messageIds });
  } catch (error) {
    console.error('Error marking messages as read:', error);
    return { success: false };
  }
};
export const fetchUserProfile = async (userId) => {
  try {
    const API_BASE_URL = 'https://usersfunctions.azurewebsites.net/api';
    const userEmail = await AsyncStorage.getItem('userEmail');
    const url = `${API_BASE_URL}/marketplace/users/${userId}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Email': userEmail || userId
      }
    });
    if (!response.ok) {
      throw new Error(`Error fetching user profile: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error in fetchUserProfile:', error);
    throw error;
  }
};
/**
 * Update user profile
 * @param {string} userId User ID or email
 * @param {Object} profileData Updated profile data
 * @returns {Promise<Object>} Updated user data
 */
export const updateUserProfile = async (userId, profileData) => {
  return await apiRequest(`marketplace/users/${userId}`, {
    method: 'PATCH',
    body: JSON.stringify(profileData),
  });
};


export const getUserWishlist = async () => {
  try {
    const userEmail = await AsyncStorage.getItem('userEmail');
    if (!userEmail) { throw new Error('User is not authenticated'); }
    return await apiRequest(`marketplace/users/${encodeURIComponent(userEmail)}/wishlist`);
  } catch (error) {
    console.error('Error fetching user wishlist:', error);
    if (config.features.useMockOnError) {
      return { wishlist: MOCK_USER.favorites || [] };
    }
    throw error;
  }
};
export const getUserListings = async (status = null) => {
  try {
    const userEmail = await AsyncStorage.getItem('userEmail');
    if (!userEmail) { throw new Error('User is not authenticated'); }
    let endpoint = `marketplace/users/${encodeURIComponent(userEmail)}/listings`;
    if (status) { endpoint += `?status=${status}`; }
    return await apiRequest(endpoint);
  } catch (error) {
    console.error('Error fetching user listings:', error);
    if (config.features.useMockOnError) {
      const listings = MOCK_USER.listings || [];
      if (status === 'active') {
        return { listings: listings.filter(l => l.status === 'active') };
      } else if (status === 'sold') {
        return { listings: listings.filter(l => l.status === 'sold') };
      } else {
        return { 
          active: listings.filter(l => l.status === 'active'),
          sold: listings.filter(l => l.status === 'sold'),
          deleted: [],
          count: {
            active: listings.filter(l => l.status === 'active').length,
            sold: listings.filter(l => l.status === 'sold').length,
            deleted: 0,
            total: listings.length
          }
        };
      }
    }
    throw error;
  }
};
export const uploadImage = async (fileUri, type = 'plant') => {
  try {
    if (!fileUri) { throw new Error('File URI is required'); }
    console.log(`Uploading ${type} file from: ${fileUri.substring(0, 50)}...`);
    const userEmail = await AsyncStorage.getItem('userEmail');
    const uploadEndpoint = `${API_BASE_URL}/marketplace/uploadImage`;
    let contentType = 'image/jpeg';
    if (type === 'speech') {
      contentType = Platform.OS === 'web' ? 'audio/webm' : 'audio/wav';
    } else if (fileUri) {
      if (fileUri.endsWith('.png')) {
        contentType = 'image/png';
      } else if (fileUri.endsWith('.gif')) {
        contentType = 'image/gif';
      } else if (fileUri.endsWith('.webm')) {
        contentType = 'audio/webm';
      } else if (fileUri.endsWith('.wav')) {
        contentType = 'audio/wav';
      } else if (fileUri.endsWith('.mp3')) {
        contentType = 'audio/mp3';
      } else if (fileUri.startsWith('data:')) {
        const mimeMatch = fileUri.match(/^data:([^;]+);/);
        if (mimeMatch && mimeMatch[1]) { contentType = mimeMatch[1]; }
      }
    }
    if (Platform.OS === 'web') {
      console.log('Using web upload method with content type:', contentType);
      if (fileUri.startsWith('data:')) {
        console.log('Direct upload of data URI');
        const body = { image: fileUri, type, userId: userEmail, contentType };
        const response = await fetch(uploadEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {})
          },
          body: JSON.stringify(body)
        });
        if (!response.ok) {
          let errorText;
          try {
            const errorJson = await response.json();
            errorText = errorJson.error || errorJson.message || JSON.stringify(errorJson);
          } catch (e) {
            errorText = await response.text();
          }
          throw new Error(`Upload failed (${response.status}): ${errorText}`);
        }
        const result = await response.json();
        console.log('Direct upload successful');
        return result;
      } else if (fileUri.startsWith('blob:')) {
        console.log('Processing blob URI');
        const response = await fetch(fileUri);
        const blob = await response.blob();
        const formData = new FormData();
        let extension = '.jpg';
        if (contentType === 'audio/webm') {
          extension = '.webm';
        } else if (contentType === 'audio/wav') {
          extension = '.wav';
        } else if (contentType === 'image/png') {
          extension = '.png';
        }
        const timestamp = Date.now();
        const filename = `${type}_${timestamp}${extension}`;
        formData.append('file', blob, filename);
        formData.append('type', type);
        formData.append('contentType', contentType);
        if (userEmail) { formData.append('userId', userEmail); }
        console.log(`Uploading ${filename} with content type ${contentType}`);
        const uploadResponse = await fetch(uploadEndpoint, {
          method: 'POST',
          body: formData,
          headers: authToken ? { 'Authorization': `Bearer ${authToken}` } : {},
        });
        if (!uploadResponse.ok) {
          let errorMessage = '';
          try {
            const errorJson = await uploadResponse.json();
            errorMessage = errorJson.error || errorJson.message || '';
          } catch (e) {
            errorMessage = await uploadResponse.text();
          }
          throw new Error(`Upload failed (${uploadResponse.status}): ${errorMessage}`);
        }
        const result = await uploadResponse.json();
        console.log('Upload successful:', result);
        return result;
      }
    } else {
      console.log('Using native upload method');
      if (fileUri.startsWith('data:')) {
        console.log('Uploading data URI directly');
        const body = { image: fileUri, type, userId: userEmail, contentType };
        const response = await fetch(uploadEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {})
          },
          body: JSON.stringify(body)
        });
        if (!response.ok) {
          throw new Error(`Upload failed with status: ${response.status}`);
        }
        const result = await response.json();
        console.log('Direct upload successful');
        return result;
      }
      try {
        console.log('Checking file info...');
        const fileInfo = await FileSystem.getInfoAsync(fileUri);
        if (!fileInfo.exists) {
          throw new Error(`File does not exist at path: ${fileUri}`);
        }
        console.log(`Reading file as base64. Size: ${fileInfo.size} bytes`);
        try {
          console.log('Reading file as base64...');
          const base64 = await FileSystem.readAsStringAsync(fileUri, {
            encoding: FileSystem.EncodingType.Base64,
          });
          console.log(`File read successful, base64 length: ${base64.length}`);
          const dataUri = `data:${contentType};base64,${base64}`;
          console.log(`Sending base64 data to server with content type: ${contentType}`);
          const result = await apiRequest('marketplace/uploadImage', 'POST', {
            image: dataUri, type, userId: userEmail, contentType
          });
          console.log('Upload successful:', result);
          return result;
        } catch (readError) {
          console.error('Error reading as base64, falling back to FormData:', readError);
          const timestamp = Date.now();
          const filename = `${type}_${timestamp}${type === 'speech' ? '.wav' : '.jpg'}`;
          const formData = new FormData();
          formData.append('image', {
            uri: fileUri,
            name: filename,
            type: contentType,
          });
          formData.append('type', type);
          formData.append('contentType', contentType);
          if (userEmail) { formData.append('userId', userEmail); }
          console.log(`Sending file using FormData fallback with content type: ${contentType}`);
          const response = await fetch(uploadEndpoint, {
            method: 'POST',
            body: formData,
            headers: authToken ? { 'Authorization': `Bearer ${authToken}` } : {},
          });
          if (!response.ok) {
            let errorText;
            try {
              const errorJson = await response.json();
              errorText = errorJson.error || errorJson.message || JSON.stringify(errorJson);
            } catch (e) {
              errorText = await response.text();
            }
            throw new Error(`Upload failed (${response.status}): ${errorText}`);
          }
          const result = await response.json();
          console.log('FormData upload successful:', result);
          return result;
        }
      } catch (fileError) {
        console.error('File error:', fileError);
        throw new Error(`File processing error: ${fileError.message}`);
      }
    }
  } catch (error) {
    console.error('File upload error:', error);
    throw error;
  }
}
export const getNegotiateToken = async () => {
  try {
    const userEmail = await AsyncStorage.getItem('userEmail');
    if (!userEmail) { throw new Error('User not authenticated'); }
    return await apiRequest(`marketplace/signalr-negotiate?userId=${encodeURIComponent(userEmail)}`, 'POST');
  } catch (error) {
    console.error('Error getting SignalR negotiate token:', error);
    throw error;
  }
};
export const geocodeAddress = async (address) => {
  try {
    if (!address || address === 'Unknown location' || address.length < 3) {
      throw new Error('Invalid address for geocoding');
    }
    const cacheKey = `geocode_${address.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
    try {
      const cachedData = await AsyncStorage.getItem(cacheKey);
      if (cachedData) { return JSON.parse(cachedData); }
    } catch (e) { console.warn('Failed to check geocode cache:', e); }
    if (config.isDevelopment && !config.features.useRealApi) {
      const hash = address.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      const mockResult = {
        latitude: 32.0853 + (hash % 20 - 10) / 100,
        longitude: 34.7818 + (hash % 20 - 10) / 100,
        city: address.split(',')[0],
        country: 'Israel'
      };
      try { await AsyncStorage.setItem(cacheKey, JSON.stringify(mockResult)); } 
      catch (e) { console.warn('Failed to cache geocode result:', e); }
      return mockResult;
    }
    const response = await apiRequest(`marketplace/geocode?address=${encodeURIComponent(address)}`);
    if (response && response.latitude && response.longitude) {
      try { await AsyncStorage.setItem(cacheKey, JSON.stringify(response)); } 
      catch (e) { console.warn('Failed to cache geocode result:', e); }
    }
    return response;
  } catch (error) {
    console.error('Error geocoding address:', error);
    throw error;
  }
};
export const getNearbyProducts = async (latitude, longitude, radius = 10, category = null) => {
  try {
    let endpoint = `marketplace/nearbyProducts?lat=${latitude}&lon=${longitude}&radius=${radius}`;
    if (category && category !== 'All') {
      endpoint += `&category=${encodeURIComponent(category)}`;
    }
    return await apiRequest(endpoint);
  } catch (error) {
    console.error('Error getting nearby products:', error);
    if (config.features.useMockOnError || (config.isDevelopment && !config.features.useRealApi)) {
      const mockProducts = [];
      const count = 5 + Math.floor(Math.random() * 6);
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const distance = Math.random() * radius;
        const latOffset = distance * Math.cos(angle) / 111;
        const lonOffset = distance * Math.sin(angle) / (111 * Math.cos(latitude * Math.PI / 180));
        mockProducts.push({
          id: `nearby-${i}`,
          title: `${category || 'Plant'} ${i+1}`,
          price: (Math.random() * 50 + 5).toFixed(2),
          category: category || 'Indoor Plants',
          location: {
            latitude: latitude + latOffset,
            longitude: longitude + lonOffset,
            city: 'Nearby Location'
          },
          image: `https://via.placeholder.com/150?text=Plant${i+1}`,
          description: 'This is a mock plant generated for the map view.',
          distance: distance,
          seller: {
            name: 'Local Seller',
            _id: `seller-${i}`
          }
        });
      }
      return { 
        products: mockProducts,
        count: mockProducts.length,
        center: { latitude, longitude },
        radius
      };
    }
    throw error;
  }
};
export const getUserPlantsByLocation = async (location) => {
  try {
    const userEmail = await AsyncStorage.getItem('userEmail');
    return await apiRequest(`getUserPlantsByLocation?email=${encodeURIComponent(userEmail)}&location=${encodeURIComponent(location)}`);
  } catch (error) {
    console.error('Error getting user plants by location:', error);
    throw error;
  }
};
export const getUserLocations = async () => {
  try {
    const userEmail = await AsyncStorage.getItem('userEmail');
    return await apiRequest(`getUserLocations?email=${encodeURIComponent(userEmail)}`);
  } catch (error) {
    console.error('Error getting user locations:', error);
    throw error;
  }
};
export const identifyPlantPhoto = async (photoFormData) => {
  try {
    const response = await fetch(`${API_BASE_URL}/identifyPlantPhoto`, {
      method: 'POST',
      body: photoFormData,
      headers: {
        'Authorization': authToken ? `Bearer ${authToken}` : '',
      }
    });
    if (!response.ok) {
      throw new Error(`Plant identification failed: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error identifying plant photo:', error);
    throw error;
  }
};
export const createImageFormData = async (uri, name = 'image', type = 'image/jpeg') => {
  const formData = new FormData();
  formData.append('image', {
    uri,
    name: name,
    type: type,
  });
  return formData;
};
export const markProductAsSold = async (productId, transactionInfo = {}) => {
  try {
    return await apiRequest(`marketplace/products/${productId}/sold`, 'POST', transactionInfo);
  } catch (error) {
    console.error(`Error marking product ${productId} as sold:`, error);
    if (config.features.useMockOnError || (config.isDevelopment && !config.features.useRealApi)) {
      return { success: true, message: 'Product marked as sold successfully (mock)', productId };
    }
    throw error;
  }
};
export const getCurrentLocation = async () => {
  try {
    const cachedLocation = await AsyncStorage.getItem('@UserLocation');
    if (cachedLocation) {
      return JSON.parse(cachedLocation);
    }
    if (Platform.OS !== 'web') {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        throw new Error('Location permission denied');
      }
    }
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced
    });
    const result = {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      accuracy: location.coords.accuracy,
      timestamp: location.timestamp
    };
    await AsyncStorage.setItem('@UserLocation', JSON.stringify(result));
    return result;
  } catch (error) {
    console.error('Error getting current location:', error);
    throw error;
  }
};
export const fetchReviews = async (targetType, targetId) => {
  try {
    if (!targetId || !targetType) {
      throw new Error('Target ID and type are required');
    }
    const encodedTargetId = encodeURIComponent(targetId);
    const endpoint = `marketplace/reviews/${targetType}/${encodedTargetId}`;
    console.log(`Fetching reviews for ${targetType} ${targetId}...`);
    console.log(`Using endpoint: ${endpoint}`);
    return await apiRequest(endpoint);
  } catch (error) {
    console.error(`Error fetching ${targetType} reviews:`, error);
    if (config.features.useMockOnError) {
      return {
        reviews: [
          {
            id: '1',
            rating: 5,
            text: 'Great seller! Plants arrived in perfect condition.',
            userName: 'Plant Lover',
            userId: 'user1@example.com',
            createdAt: new Date().toISOString(),
            isOwnReview: Math.random() > 0.5,
          },
          {
            id: '2',
            rating: 4,
            text: 'Good communication and nice plants.',
            userName: 'Green Thumb',
            userId: 'user2@example.com',
            createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
            isOwnReview: false,
          },
        ],
        averageRating: 4.5,
        count: 2
      };
    }
    throw error;
  }
};
export const submitReview = async (targetId, targetType = 'seller', reviewData) => {
  try {
    if (!targetId) {
      throw new Error('Target ID is required');
    }
    if (!reviewData || !reviewData.rating || !reviewData.text) {
      throw new Error('Review must include both rating and text');
    }
    const encodedTargetId = encodeURIComponent(targetId);
    console.log(`Submitting ${targetType} review for ${targetId}:`, reviewData);
    const endpoint = `submitreview/${targetType}/${encodedTargetId}`;
    const response = await apiRequest(endpoint, 'POST', reviewData);
    console.log('Review submission response:', response);
    return response;
  } catch (error) {
    console.error(`Error submitting ${targetType} review:`, error);
    error.message = `Failed to submit review: ${error.message}`;
    throw error;
  }
};
export const deleteReview = async (reviewId, targetType, targetId) => {
  console.log('[API] deleteReview API function is called but not used, using direct fetch instead');
  console.log('[API] Parameters:', { reviewId, targetType, targetId });
  try {
    if (!reviewId) {
      throw new Error('Review ID is required');
    }
    const userEmail = await AsyncStorage.getItem('userEmail');
    const token = await AsyncStorage.getItem('googleAuthToken');
    const API_BASE_URL = 'https://usersfunctions.azurewebsites.net/api';
    const encodedTargetType = encodeURIComponent(targetType);
    const encodedTargetId = encodeURIComponent(targetId);
    const encodedReviewId = encodeURIComponent(reviewId);
    const endpoint = `marketplace/reviews/${encodedTargetType}/${encodedTargetId}/${encodedReviewId}`;
    const fullUrl = `${API_BASE_URL}/${endpoint}`;
    console.log(`[API] DELETE request URL: ${fullUrl}`);
    const headers = { 'Content-Type': 'application/json' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    headers['X-User-Email'] = userEmail;
    const response = await fetch(fullUrl, {
      method: 'DELETE',
      headers
    });
    let responseData;
    try {
      responseData = await response.json();
    } catch (e) {
      const textResponse = await response.text();
      responseData = { 
        success: response.ok, 
        message: response.ok ? 'Review deleted successfully' : textResponse 
      };
    }
    if (!response.ok) {
      throw new Error(`Server returned ${response.status}: ${responseData?.message || 'Unknown error'}`);
    }
    return responseData;
  } catch (error) {
    console.error('[API] Error deleting review:', error);
    throw error;
  }
};
export const speechToText = async (audioUrl, language = 'en-US') => {
  try {
    console.log(`Starting speech-to-text for audio: ${audioUrl}`);
    if (!audioUrl) {
      throw new Error('Audio URL is required');
    }
    const API_URL = `${API_BASE_URL}/marketplace/speechToText`;
    console.log(`Using speech-to-text API URL: ${API_URL}`);
    console.log(`Request details:
      URL: ${API_URL}
      Method: POST
      Headers: Content-Type: application/json
      Body: {
        audioUrl: ${audioUrl.substring(0, 50)}...,
        language: ${language}
      }
    `);
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {})
      },
      body: JSON.stringify({ audioUrl, language })
    });
    console.log(`Speech-to-text API response status: ${response.status}`);
    let responseData;
    try {
      responseData = await response.json();
      console.log('Speech-to-text response data:', responseData);
    } catch (parseError) {
      const textResponse = await response.text();
      console.error('Failed to parse JSON response:', textResponse);
      responseData = { error: textResponse || 'Invalid response format' };
    }
    if (!response.ok) {
      let errorMessage;
      if (responseData && responseData.error) {
        errorMessage = typeof responseData.error === 'string' 
          ? responseData.error 
          : JSON.stringify(responseData.error);
      } else if (responseData && responseData.message) {
        errorMessage = responseData.message;
      } else {
        errorMessage = `HTTP error ${response.status}`;
      }
      console.error('Speech-to-text error response:', responseData);
      throw new Error(`Speech recognition failed: ${errorMessage}`);
    }
    if (!responseData || typeof responseData.text !== 'string') {
      console.error('Invalid speech-to-text response format:', responseData);
      throw new Error('Received invalid response format from speech service');
    }
    const cleanText = cleanupTranscriptionText(responseData.text);
    console.log('Speech-to-text successful, result:', cleanText);
    return cleanText;
  } catch (error) {
    console.error('Speech-to-text error:', error);
    throw error;
  }
}
const cleanupTranscriptionText = (text) => {
  if (!text) return '';
  return text
    .replace(/[.,!?;:'"()\[\]{}]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
};
export default {
  setAuthToken,
  initializeAuthToken,
  getAll,
  getSpecific,
  createPlant,
  updateProduct,
  deleteProduct,
  wishProduct,
  markProductAsSold,
  fetchReviews,
  submitReview,
  deleteReview,
  fetchUserProfile,
  updateUserProfile,
  getUserWishlist,
  getUserListings,
  fetchConversations,
  fetchMessages,
  sendMessage,
  startConversation,
  markMessagesAsRead,
  sendTypingIndicator,
  getNegotiateToken,
  geocodeAddress,
  getNearbyProducts,
  uploadImage,
  createImageFormData,
  speechToText,
  getUserPlantsByLocation,
  getUserLocations,
  identifyPlantPhoto
};