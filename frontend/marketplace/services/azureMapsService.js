// COST-OPTIMIZED Azure Maps Service - greener-marketplace-maps ONLY
// React-Native safe: replaces AbortSignal.timeout with a local fetch-with-timeout
import { Platform } from 'react-native';

// =================== Config ===================
const BASE_URL = 'https://usersfunctions.azurewebsites.net/api';
const CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days

let cachedKey = null;
let keyTimestamp = null;
const locationCache = new Map();
const reverseCache = new Map();

// Rate limit & memory protection
let lastApiCall = 0;
const MIN_API_INTERVAL = 1000; // 1s between calls
const MAX_CACHE_SIZE = 1000;

// Debounce queue
const requestQueue = new Map();

// ---------- RN-safe timeout wrapper ----------
const fetchWithTimeout = async (url, options = {}, timeoutMs = 15000) => {
  // Prefer AbortController if present in RN
  if (typeof AbortController === 'function') {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, { ...options, signal: controller.signal });
    } finally {
      clearTimeout(id);
    }
  }
  // Fallback race (older engines)
  return Promise.race([
    fetch(url, options),
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), timeoutMs)),
  ]);
};

// ---------- Rate-limited fetch that also times out ----------
const rateLimitedFetch = async (url, options, timeoutMs = 15000) => {
  const now = Date.now();
  const delta = now - lastApiCall;
  if (delta < MIN_API_INTERVAL) {
    await new Promise(r => setTimeout(r, MIN_API_INTERVAL - delta));
  }
  lastApiCall = Date.now();
  return fetchWithTimeout(url, options, timeoutMs);
};

const debouncedRequest = (key, requestFn, delay = 300) =>
  new Promise((resolve, reject) => {
    if (requestQueue.has(key)) clearTimeout(requestQueue.get(key).timeout);
    const timeout = setTimeout(async () => {
      try {
        const result = await requestFn();
        requestQueue.delete(key);
        resolve(result);
      } catch (e) {
        requestQueue.delete(key);
        reject(e);
      }
    }, delay);
    requestQueue.set(key, { timeout, resolve, reject });
  });

// =================== API ===================
/** Get Azure Maps key (cached & rate-limited) */
export const getAzureMapsKey = async () => {
  if (cachedKey && keyTimestamp && Date.now() - keyTimestamp < CACHE_DURATION) {
    return cachedKey;
  }
  try {
    const response = await rateLimitedFetch(
      `${BASE_URL}/marketplace/maps-config`,
      {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      },
      15000
    );
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Maps config error: ${response.status} - ${text}`);
    }
    const data = await response.json();
    if (!data.azureMapsKey) throw new Error('No Azure Maps key in response');
    if (data.accountName !== 'greener-marketplace-maps') {
      console.warn(`⚠️ Unexpected account: ${data.accountName} (expected greener-marketplace-maps)`);
    }
    cachedKey = data.azureMapsKey;
    keyTimestamp = Date.now();
    return cachedKey;
  } catch (err) {
    console.error('❌ Failed to get greener-marketplace-maps key:', err?.message || err);
    throw err;
  }
};

/** Geocode (address -> lat/lon), cached & debounced */
export const geocodeAddress = async (address) => {
  if (!address || address.trim().length < 3) throw new Error('Address must be at least 3 characters long');
  const normalized = address.trim().toLowerCase();

  if (locationCache.has(normalized)) {
    const { data, timestamp } = locationCache.get(normalized);
    if (Date.now() - timestamp < CACHE_DURATION) return data;
  }

  return debouncedRequest(`geocode_${normalized}`, async () => {
    try {
      const response = await rateLimitedFetch(
        `${BASE_URL}/marketplace/geocode`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ address: address.trim() }),
        },
        20000
      );

      if (!response.ok) {
        const text = await response.text();
        if (response.status === 429) throw new Error('Rate limit exceeded - please wait before making more requests');
        throw new Error(`Geocoding failed: ${response.status} - ${text}`);
      }

      const data = await response.json();
      if (!data.latitude || !data.longitude) throw new Error('Invalid geocoding response: missing coordinates');

      const result = {
        latitude: parseFloat(data.latitude),
        longitude: parseFloat(data.longitude),
        formattedAddress: data.formattedAddress || address,
        city: data.city || '',
        street: data.street || '',
        houseNumber: data.houseNumber || '',
        postalCode: data.postalCode || '',
        country: data.country || 'Israel',
        source: data.source || 'greener-marketplace-maps',
      };
      if (isNaN(result.latitude) || isNaN(result.longitude)) throw new Error('Invalid coordinates in response');

      manageCacheSize(locationCache);
      locationCache.set(normalized, { data: result, timestamp: Date.now() });
      return result;
    } catch (err) {
      console.error('❌ Geocoding error:', err?.message || err);
      throw err;
    }
  });
};

/** Reverse geocode (lat/lon -> address), cached & debounced */
export const reverseGeocode = async (latitude, longitude) => {
  if (!latitude || !longitude) throw new Error('Latitude and longitude are required');
  const lat = parseFloat(latitude);
  const lon = parseFloat(longitude);
  if (isNaN(lat) || isNaN(lon)) throw new Error('Invalid latitude or longitude values');
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) throw new Error('Coordinates out of valid range');

  const key = `${lat.toFixed(4)},${lon.toFixed(4)}`;
  if (reverseCache.has(key)) {
    const { data, timestamp } = reverseCache.get(key);
    if (Date.now() - timestamp < CACHE_DURATION) return data;
  }

  return debouncedRequest(`reverse_${key}`, async () => {
    try {
      const response = await rateLimitedFetch(
        `${BASE_URL}/marketplace/reverseGeocode?lat=${lat}&lon=${lon}`,
        {
          method: 'GET',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        },
        20000
      );

      if (!response.ok) {
        const text = await response.text();
        if (response.status === 429) throw new Error('Rate limit exceeded - please wait before making more requests');
        throw new Error(`Reverse geocoding failed: ${response.status} - ${text}`);
      }

      const data = await response.json();
      const result = {
        latitude: lat,
        longitude: lon,
        formattedAddress: data.formattedAddress || `${lat.toFixed(4)}, ${lon.toFixed(4)}`,
        city: data.city || '',
        street: data.street || '',
        houseNumber: data.houseNumber || '',
        postalCode: data.postalCode || '',
        country: data.country || 'Israel',
        countryCode: data.countryCode || '',
        source: data.source || 'greener-marketplace-maps',
        ...(data.cityHe ? { cityHe: data.cityHe } : {}),
        ...(data.streetHe ? { streetHe: data.streetHe } : {}),
        ...(data.regionHe ? { regionHe: data.regionHe } : {}),
        ...(data.neighborhood ? { neighborhood: data.neighborhood } : {}),
      };

      manageCacheSize(reverseCache);
      reverseCache.set(key, { data: result, timestamp: Date.now() });
      return result;
    } catch (err) {
      console.error('❌ Reverse geocoding error:', err?.message || err);
      throw err;
    }
  });
};

// =================== Helpers ===================
const manageCacheSize = (cache) => {
  if (cache.size >= MAX_CACHE_SIZE) {
    const entries = Array.from(cache.entries()).sort((a, b) => a[1].timestamp - b[1].timestamp);
    const toRemove = Math.floor(MAX_CACHE_SIZE * 0.2);
    for (let i = 0; i < toRemove; i++) cache.delete(entries[i][0]);
    console.log(`🧹 Cache cleanup: removed ${toRemove} old entries`);
  }
};

// periodic cleanup
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of locationCache.entries()) if (now - v.timestamp > CACHE_DURATION) locationCache.delete(k);
  for (const [k, v] of reverseCache.entries()) if (now - v.timestamp > CACHE_DURATION) reverseCache.delete(k);
}, 60 * 60 * 1000);

export const formatCoordinates = (lat, lon, precision = 4) => {
  const la = parseFloat(lat);
  const lo = parseFloat(lon);
  if (isNaN(la) || isNaN(lo)) return 'Invalid coordinates';
  return `${la.toFixed(precision)}, ${lo.toFixed(precision)}`;
};

export const validateCoordinates = (lat, lon) => {
  const la = parseFloat(lat);
  const lo = parseFloat(lon);
  return !isNaN(la) && !isNaN(lo) && la >= -90 && la <= 90 && lo >= -180 && lo <= 180;
};

export const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371;
  const toRad = (v) => (v * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

export const isInIsrael = (lat, lon) => {
  const la = parseFloat(lat);
  const lo = parseFloat(lon);
  return la >= 29.5 && la <= 33.4 && lo >= 34.2 && lo <= 35.9;
};

export const getCacheStats = () => ({
  locationCacheSize: locationCache.size,
  reverseCacheSize: reverseCache.size,
  totalCacheEntries: locationCache.size + reverseCache.size,
  maxCacheSize: MAX_CACHE_SIZE,
  cacheUtilization:
    (((locationCache.size + reverseCache.size) / (MAX_CACHE_SIZE * 2)) * 100).toFixed(1) + '%',
});

export default {
  getAzureMapsKey,
  geocodeAddress,
  reverseGeocode,
  formatCoordinates,
  validateCoordinates,
  calculateDistance,
  isInIsrael,
  getCacheStats,
};
