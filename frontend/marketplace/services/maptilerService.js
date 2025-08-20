// services/maptilerService.js
import Constants from 'expo-constants';

const FALLBACK = '6LEIELmBStgzi9h3tRj6'; // your key as a last resort

export const getMapTilerKey = () => {
  return (
    Constants?.expoConfig?.extra?.maptilerKey ||
    Constants?.manifest?.extra?.maptilerKey ||
    // some SDKs expose it differently — try multiple places
    Constants?.manifest2?.extra?.expoClient?.extra?.maptilerKey ||
    FALLBACK
  );
};

export async function reverseGeocode(lat, lon, key = getMapTilerKey()) {
  try {
    const url = `https://api.maptiler.com/geocoding/${encodeURIComponent(lon)},${encodeURIComponent(lat)}.json?key=${encodeURIComponent(key)}&language=en`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const first = (data.features || [])[0];
    const city =
      first?.context?.place?.name ||
      first?.properties?.locality ||
      first?.properties?.city ||
      first?.text ||
      'Location';
    const formattedAddress = first?.place_name || `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
    return { city, formattedAddress };
  } catch {
    return { city: 'Location', formattedAddress: `${lat.toFixed(5)}, ${lon.toFixed(5)}` };
  }
}
