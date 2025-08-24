// Weather Service for Consumer & Business Users - REAL API ONLY
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const BASE_URL = 'https://usersfunctions.azurewebsites.net/api';
const WEATHER_CACHE_DURATION = 30 * 60 * 1000;   // 30 minutes
const LOCATION_CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

const weatherCache = new Map();

const toNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
};

function fetchWithTimeout(resource, options = {}, timeout = 15000) {
  return Promise.race([
    fetch(resource, options),
    new Promise((_, reject) => setTimeout(() => reject(new Error('Request timeout')), timeout)),
  ]);
}

async function getEmail() {
  return (await AsyncStorage.getItem('userEmail')) || null;
}

async function saveLocationToCache(location, source = 'db') {
  await AsyncStorage.setItem(
    'user_weather_location',
    JSON.stringify({ location: { ...location, _source: source }, timestamp: Date.now() })
  );
}

// --- NEW: fetch location from private function (supports consumer + business) ---
async function getUserLocationFromPrivate() {
  const email = await getEmail();
  if (!email) throw new Error('No email available for private location fetch');

  const res = await fetchWithTimeout(
    `${BASE_URL}/user-location-get?email=${encodeURIComponent(email)}`,
    {
      method: 'GET',
      headers: {
        'X-User-Email': email,
        'X-Business-ID': email, // harmless for consumers, required for some business requests
      },
    },
    15000
  );

  if (res.status === 404) throw new Error('User not found in DB');
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error || `Location fetch failed (${res.status})`);

  const loc = json.location || {};
  const lat = toNum(loc.latitude);
  const lon = toNum(loc.longitude);

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    // doc exists but lacks coords → let caller decide (e.g., geocode & save)
    throw new Error('DB location missing numeric coordinates');
  }

  const location = {
    latitude: lat,
    longitude: lon,
    city: loc.city || 'Unknown',
    country: loc.country || 'Israel',
    formattedAddress: loc.formattedAddress || '',
  };

  await saveLocationToCache(location, json.database || 'db');
  return location;
}

async function getUserLocationFromCache() {
  const cached = await AsyncStorage.getItem('user_weather_location');
  if (!cached) return null;
  const parsed = JSON.parse(cached);
  if (Date.now() - parsed.timestamp > LOCATION_CACHE_DURATION) return null;
  return parsed.location;
}

async function getUserLocationFromDevice() {
  if (Platform.OS === 'web') throw new Error('Device location unavailable on web');
  const { Location } = require('expo-location');
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') throw new Error('Location permission denied');
  const pos = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced, timeout: 10000,
  });
  const location = {
    latitude: pos.coords.latitude,
    longitude: pos.coords.longitude,
    city: 'Current Location',
    country: 'Unknown',
  };
  await saveLocationToCache(location, 'device');
  return location;
}

/**
 * Public: getUserLocation
 * Order:
 *   1) Private DB endpoint (supports both consumer & business)
 *   2) Fresh cache
 *   3) Device GPS
 */
export const getUserLocation = async () => {
  try {
    return await getUserLocationFromPrivate();
  } catch (e) {
    console.warn('[weather] DB location failed:', e?.message || e);
  }

  try {
    const c = await getUserLocationFromCache();
    if (c) return c;
  } catch {}

  try {
    return await getUserLocationFromDevice();
  } catch (e) {
    console.warn('[weather] Device location failed:', e?.message || e);
  }

  throw new Error('No location available (DB, cache, and device all failed)');
};


/**
 * Fetch weather via Azure Function
 */
export const getWeatherData = async (location = null) => {
  const loc = location || (await getUserLocation());
  const lat = toNum(loc.latitude);
  const lon = toNum(loc.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    throw new Error('Invalid coordinates for weather fetch');
  }

  const cacheKey = `${lat.toFixed(4)}_${lon.toFixed(4)}`;

  if (weatherCache.has(cacheKey)) {
    const cached = weatherCache.get(cacheKey);
    if (Date.now() - cached.timestamp < WEATHER_CACHE_DURATION) {
      console.log('✅ Using cached weather data');
      return cached.data;
    }
  }

  console.log('🌤️ Fetching REAL weather data for coords:', lat, lon);

  const response = await fetchWithTimeout(
    `${BASE_URL}/weather-get`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ latitude: lat, longitude: lon }),
    },
    15000
  );

  if (!response.ok) {
    if (response.status === 503) throw new Error('Weather API is temporarily unavailable');
    if (response.status === 500) throw new Error('Weather service configuration error');
    throw new Error(`Weather API error: ${response.status}`);
  }

  const data = await response.json();
  if (!data || !data.current) throw new Error('Invalid weather response');
  if (data.source && data.source !== 'OpenWeatherMap-RealAPI') {
    throw new Error('Weather service not using real API');
  }

  const apiCity =
    data?.city?.name ||
    data?.location?.city ||
    data?.timezone?.split('/')?.[1]?.replace('_', ' ') ||
    loc.city || 'Location';

  const weatherData = {
    current: {
      temperature: Math.round(data.current.temp),
      humidity: data.current.humidity,
      description: data.current.weather?.[0]?.description || '',
      icon: data.current.weather?.[0]?.icon || '01d',
      windSpeed: data.current.wind_speed,
      uvIndex: data.current.uvi || 0,
      visibility: typeof data.current.visibility === 'number' ? data.current.visibility / 1000 : 0,
      feelsLike: Math.round(data.current.feels_like),
    },
    forecast: Array.isArray(data.daily)
      ? data.daily.slice(0, 5).map((day) => ({
          date: new Date(day.dt * 1000).toISOString().split('T')[0],
          tempMax: Math.round(day.temp?.max ?? day.temp?.day ?? 0),
          tempMin: Math.round(day.temp?.min ?? day.temp?.night ?? 0),
          humidity: day.humidity,
          description: day.weather?.[0]?.description || '',
          icon: day.weather?.[0]?.icon || '01d',
          precipitation: day.rain || 0,
          windSpeed: day.wind_speed,
        }))
      : [],
    location: { ...loc, city: apiCity },
    timestamp: Date.now(),
    sunrise: new Date(data.current.sunrise * 1000),
    sunset: new Date(data.current.sunset * 1000),
    precipitation: {
      last24h: data.current.rain ? Object.values(data.current.rain)[0] || 0 : 0,
      next24h: data.daily && data.daily[0] ? data.daily[0].rain || 0 : 0,
    },
    isRealData: true,
  };

  weatherCache.set(cacheKey, { data: weatherData, timestamp: Date.now() });
  return weatherData;
};


/**
 * Watering advice (unchanged)
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

  if (precipitation.last24h > 5) {
    advice.push('🌧️ Recent rainfall detected - consider delaying watering by 1-2 days');
    urgency = 'low'; icon = 'rainy-outline'; color = '#2196F3';
  }

  const upcomingRain = Array.isArray(forecast) &&
    forecast.some((d) => (d.precipitation || 0) > 3 &&
      new Date(d.date) <= new Date(Date.now() + 48 * 60 * 60 * 1000));
  if (upcomingRain && precipitation.last24h < 2) {
    advice.push('🌦️ Rain expected in next 2 days - you may skip watering');
    urgency = 'low'; icon = 'rainy-outline'; color = '#2196F3';
  }

  if (current.temperature > 30) {
    advice.push('🌡️ High temperatures - plants may need more frequent watering');
    if (urgency !== 'low') { urgency = 'high'; icon = 'thermometer-outline'; color = '#FF5722'; }
  }

  if (current.humidity > 80 && current.temperature < 25) {
    advice.push('💧 High humidity - reduce watering frequency slightly');
    if (urgency === 'normal') { urgency = 'low'; icon = 'water-percent'; color = '#03A9F4'; }
  }

  if (current.humidity < 40) {
    advice.push('🏜️ Low humidity - consider misting plants or using humidity trays');
    if (urgency !== 'high') { urgency = 'medium'; icon = 'water-outline'; color = '#FF9800'; }
  }

  if (current.temperature < 10) {
    advice.push('❄️ Cold weather - reduce watering as plants grow slower');
    urgency = 'low'; icon = 'snowflake-outline'; color = '#607D8B';
  }

  if (current.windSpeed > 20) {
    advice.push('💨 Windy conditions - outdoor plants may dry faster');
    if (urgency === 'normal') urgency = 'medium';
  }

  if (current.uvIndex > 8) {
    advice.push('☀️ High UV index - provide shade for sensitive plants');
  }

  if (advice.length === 0) {
    advice.push('🌿 Weather conditions are normal - follow your regular watering schedule');
  }

  const plantsNeedingWater = (plants || []).filter((p) => {
    const d = daysUntil(p?.next_water);
    return d <= 0;
  });

  if (plantsNeedingWater.length > 0) {
    advice.push(`📋 ${plantsNeedingWater.length} plant${plantsNeedingWater.length !== 1 ? 's' : ''} need${plantsNeedingWater.length === 1 ? 's' : ''} watering today`);
  }

  return {
    general: advice.join('\n\n'),
    urgency, icon, color,
    details: {
      temperature: current.temperature,
      humidity: current.humidity,
      precipitation: precipitation.last24h,
      windSpeed: current.windSpeed,
      uvIndex: current.uvIndex,
    },
    plantsNeedingWater: plantsNeedingWater.length,
    isRealData: true,
  };
};

const daysUntil = (dateStr) => {
  if (!dateStr) return 9999;
  const today = new Date(); today.setHours(0,0,0,0);
  const target = new Date(dateStr); target.setHours(0,0,0,0);
  return Math.floor((target - today) / (1000*60*60*24));
};

export const getWeatherIconUrl = (iconCode) =>
  `https://openweathermap.org/img/wn/${iconCode}@2x.png`;

export const clearWeatherCache = async () => {
  weatherCache.clear();
  await AsyncStorage.removeItem('user_weather_location');
};

export default {
  getUserLocation,
  getWeatherData,
  generateWateringAdvice,
  getWeatherIconUrl,
  clearWeatherCache,
};
