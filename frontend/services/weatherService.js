// Weather Service for Consumer Plants - REAL API ONLY
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const BASE_URL = 'https://usersfunctions.azurewebsites.net/api';
const WEATHER_CACHE_DURATION = 30 * 60 * 1000; // 30 minutes cache
const LOCATION_CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours cache

// Weather cache
const weatherCache = new Map();

/**
 * Get user's current location - now with backend fallback!
 */
export const getUserLocation = async () => {
  try {
    // 1. Try cached location (if recent)
    const cachedLocation = await AsyncStorage.getItem('user_weather_location');
    if (cachedLocation) {
      const parsed = JSON.parse(cachedLocation);
      if (Date.now() - parsed.timestamp < LOCATION_CACHE_DURATION) {
        return parsed.location;
      }
    }

    // 2. Try AsyncStorage userProfile
    let userProfile = await AsyncStorage.getItem('userProfile');
    let profile = userProfile ? JSON.parse(userProfile) : null;

    // 3. If missing, fetch from backend by email
    let user = profile && profile.user ? profile.user : profile;

    if (
      !user ||
      !user.location ||
      typeof user.location.latitude !== "number" ||
      typeof user.location.longitude !== "number"
    ) {
      // Get user's email
      let email =
        (user && user.email) ||
        (profile && profile.email) ||
        (profile && profile.user && profile.user.email) ||
        (await AsyncStorage.getItem('userEmail'));

      if (email) {
        try {
          const res = await fetch(
            `https://usersfunctions.azurewebsites.net/api/marketplace/users/${encodeURIComponent(email)}`
          );
          if (res.ok) {
            const data = await res.json();
            user = data.user || data;
            profile = { user }; // Save as { user: ... } for consistency
            await AsyncStorage.setItem('userProfile', JSON.stringify(profile));
          }
        } catch (fetchErr) {
          // Just warn, will try device location next
          console.warn('Failed to fetch user profile from backend:', fetchErr);
        }
      }
    }

    // DEBUG LOGGING
    console.log("Fetched user profile (user):", user);
    if (user && user.location) {
      console.log("Profile location:", user.location);
      console.log("Latitude:", user.location.latitude, "Longitude:", user.location.longitude);
    }

    // 4. If user has location, use it and cache
    if (
      user &&
      user.location &&
      typeof user.location.latitude === "number" &&
      typeof user.location.longitude === "number"
    ) {
      const location = {
        latitude: user.location.latitude,
        longitude: user.location.longitude,
        city: user.location.city || user.city || 'Unknown',
        country: user.location.country || 'Israel',
      };
      // Cache
      await AsyncStorage.setItem('user_weather_location', JSON.stringify({
        location,
        timestamp: Date.now()
      }));
      return location;
    }

    // 5. Try device location if available (mobile only)
    if (Platform.OS !== 'web') {
      try {
        const { Location } = require('expo-location');
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const position = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
            timeout: 10000
          });
          const location = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            city: 'Current Location',
            country: 'Unknown'
          };
          // Cache
          await AsyncStorage.setItem('user_weather_location', JSON.stringify({
            location,
            timestamp: Date.now()
          }));
          return location;
        }
      } catch (locationError) {
        console.warn('Device location not available:', locationError);
      }
    }

    // NO DEFAULT FALLBACK LOCATION - Must have real location
    throw new Error('No location available - user must set location in profile or enable device location');

  } catch (error) {
    console.error('Error getting user location:', error);
    throw error; // Re-throw to force user to provide location
  }
};

/**
 * Get weather data from OpenWeatherMap via Azure Function - REAL API ONLY
 */
export const getWeatherData = async (location = null) => {
  try {
    const userLocation = location || await getUserLocation();
    const cacheKey = `${userLocation.latitude.toFixed(4)}_${userLocation.longitude.toFixed(4)}`;
    
    // Check cache first
    if (weatherCache.has(cacheKey)) {
      const cached = weatherCache.get(cacheKey);
      if (Date.now() - cached.timestamp < WEATHER_CACHE_DURATION) {
        console.log('✅ Using cached weather data');
        return cached.data;
      }
    }

    console.log('🌤️ Fetching REAL weather data for:', userLocation.city);
    
    const response = await fetch(`${BASE_URL}/weather-get`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        latitude: userLocation.latitude,
        longitude: userLocation.longitude
      }),
      signal: AbortSignal.timeout(15000)
    });

    if (!response.ok) {
      if (response.status === 503) {
        throw new Error('Weather API is temporarily unavailable');
      } else if (response.status === 500) {
        throw new Error('Weather service configuration error');
      }
      throw new Error(`Weather API error: ${response.status}`);
    }

    const data = await response.json();
    
    if (!data.current || !data.source) {
      throw new Error('Invalid weather response - API may be down');
    }

    // Verify this is real API data
    if (data.source !== 'OpenWeatherMap-RealAPI') {
      throw new Error('Weather service not using real API');
    }

    const weatherData = {
      current: {
        temperature: Math.round(data.current.temp),
        humidity: data.current.humidity,
        description: data.current.weather[0].description,
        icon: data.current.weather[0].icon,
        windSpeed: data.current.wind_speed,
        uvIndex: data.current.uvi || 0,
        visibility: data.current.visibility / 1000, // km
        feelsLike: Math.round(data.current.feels_like)
      },
      forecast: data.daily ? data.daily.slice(0, 5).map(day => ({
        date: new Date(day.dt * 1000).toISOString().split('T')[0],
        tempMax: Math.round(day.temp.max),
        tempMin: Math.round(day.temp.min),
        humidity: day.humidity,
        description: day.weather[0].description,
        icon: day.weather[0].icon,
        precipitation: day.rain || 0,
        windSpeed: day.wind_speed
      })) : [],
      location: userLocation,
      timestamp: Date.now(),
      sunrise: new Date(data.current.sunrise * 1000),
      sunset: new Date(data.current.sunset * 1000),
      precipitation: {
        last24h: data.current.rain ? Object.values(data.current.rain)[0] || 0 : 0,
        next24h: data.daily && data.daily[0] ? (data.daily[0].rain || 0) : 0
      },
      isRealData: true // Flag to confirm real data
    };

    // Cache the REAL result
    weatherCache.set(cacheKey, {
      data: weatherData,
      timestamp: Date.now()
    });

    console.log('✅ Real weather data loaded successfully');
    return weatherData;

  } catch (error) {
    console.error('❌ Weather API error:', error);
    // NO FALLBACK - Let the error propagate
    throw error;
  }
};

/**
 * Generate watering advice based on weather conditions - REAL DATA ONLY
 */
export const generateWateringAdvice = (weatherData, plants = []) => {
  if (!weatherData || !weatherData.current || !weatherData.isRealData) {
    throw new Error('Cannot generate advice without real weather data');
  }

  const { current, forecast, precipitation } = weatherData;
  const advice = [];
  let urgency = 'normal';
  let icon = 'water-outline';
  let color = '#4CAF50';

  // Check for recent rain
  if (precipitation.last24h > 5) {
    advice.push('🌧️ Recent rainfall detected - consider delaying watering by 1-2 days');
    urgency = 'low';
    icon = 'rainy-outline';
    color = '#2196F3';
  }

  // Check for upcoming rain
  const upcomingRain = forecast.some(day => 
    day.precipitation > 3 && 
    new Date(day.date) <= new Date(Date.now() + 48 * 60 * 60 * 1000)
  );

  if (upcomingRain && precipitation.last24h < 2) {
    advice.push('🌦️ Rain expected in next 2 days - you may skip watering');
    urgency = 'low';
    icon = 'rainy-outline';
    color = '#2196F3';
  }

  // High temperature advice
  if (current.temperature > 30) {
    advice.push('🌡️ High temperatures - plants may need more frequent watering');
    if (urgency !== 'low') {
      urgency = 'high';
      icon = 'thermometer-outline';
      color = '#FF5722';
    }
  }

  // High humidity advice
  if (current.humidity > 80 && current.temperature < 25) {
    advice.push('💧 High humidity - reduce watering frequency slightly');
    if (urgency === 'normal') {
      urgency = 'low';
      icon = 'water-percent';
      color = '#03A9F4';
    }
  }

  // Low humidity advice
  if (current.humidity < 40) {
    advice.push('🏜️ Low humidity - consider misting plants or using humidity trays');
    if (urgency !== 'high') {
      urgency = 'medium';
      icon = 'water-outline';
      color = '#FF9800';
    }
  }

  // Cold weather advice
  if (current.temperature < 10) {
    advice.push('❄️ Cold weather - reduce watering as plants grow slower');
    urgency = 'low';
    icon = 'snowflake-outline';
    color = '#607D8B';
  }

  // Wind advice
  if (current.windSpeed > 20) {
    advice.push('💨 Windy conditions - outdoor plants may dry faster');
    if (urgency === 'normal') {
      urgency = 'medium';
    }
  }

  // UV Index advice
  if (current.uvIndex > 8) {
    advice.push('☀️ High UV index - provide shade for sensitive plants');
  }

  // Default advice if no specific conditions
  if (advice.length === 0) {
    advice.push('🌿 Weather conditions are normal - follow your regular watering schedule');
  }

  // Add plant-specific advice
  const plantsNeedingWater = plants.filter(plant => {
    const days = daysUntil(plant.next_water);
    return days <= 0;
  });

  if (plantsNeedingWater.length > 0) {
    advice.push(`📋 ${plantsNeedingWater.length} plant${plantsNeedingWater.length !== 1 ? 's' : ''} need${plantsNeedingWater.length === 1 ? 's' : ''} watering today`);
  }

  return {
    general: advice.join('\n\n'),
    urgency,
    icon,
    color,
    details: {
      temperature: current.temperature,
      humidity: current.humidity,
      precipitation: precipitation.last24h,
      windSpeed: current.windSpeed,
      uvIndex: current.uvIndex
    },
    plantsNeedingWater: plantsNeedingWater.length,
    isRealData: true
  };
};

/**
 * Helper function to calculate days until watering
 */
const daysUntil = (dateStr) => {
  if (!dateStr) return 9999;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  return Math.floor((target - today) / (1000 * 60 * 60 * 24));
};

/**
 * Get weather icon URL from OpenWeatherMap
 */
export const getWeatherIconUrl = (iconCode) => {
  return `https://openweathermap.org/img/wn/${iconCode}@2x.png`;
};

/**
 * Clear weather cache
 */
export const clearWeatherCache = () => {
  weatherCache.clear();
  AsyncStorage.removeItem('user_weather_location');
};

export default {
  getUserLocation,
  getWeatherData,
  generateWateringAdvice,
  getWeatherIconUrl,
  clearWeatherCache
};
