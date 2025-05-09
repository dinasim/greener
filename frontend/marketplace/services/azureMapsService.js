// locationService.js

/**
 * Azure Maps Service for geocoding and location services
 * This service interacts with the Azure Maps API through your Azure Functions backend
 */

// Replace this with your actual Azure Functions endpoint
const API_BASE_URL = 'https://your-function-app-name.azurewebsites.net/api';

/**
 * Geocode an address to get coordinates
 */
export async function geocodeAddress(address) {
  try {
    if (!address || address === 'Unknown location' || address.length < 3) {
      throw new Error('Invalid address for geocoding');
    }

    const response = await fetch(`${API_BASE_URL}/geocode?address=${encodeURIComponent(address)}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${global.googleAuthToken || ''}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Geocoding failed with status: ${response.status}`);
    }

    const data = await response.json();

    if (!data?.latitude || !data?.longitude) {
      throw new Error('No coordinates returned from geocoding service');
    }

    return { latitude: data.latitude, longitude: data.longitude };
  } catch (error) {
    console.error('Error geocoding address:', error);
    if (__DEV__) return getMockCoordinates(address);
    throw error;
  }
}

/**
 * Get products with location data
 */
export async function getProductsWithLocation(options = {}) {
  try {
    const queryParams = new URLSearchParams();

    if (options.category) queryParams.append('category', options.category);
    if (options.minPrice) queryParams.append('minPrice', options.minPrice);
    if (options.maxPrice) queryParams.append('maxPrice', options.maxPrice);
    queryParams.append('withLocation', 'true');

    const response = await fetch(`${API_BASE_URL}/productsWithLocation?${queryParams.toString()}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${global.googleAuthToken || ''}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get products with location: ${response.status}`);
    }

    const data = await response.json();

    if (!data || !Array.isArray(data.products)) {
      throw new Error('Invalid response format from productsWithLocation endpoint');
    }

    return data.products;
  } catch (error) {
    console.error('Error getting products with location:', error);
    if (__DEV__) return getMockProductsWithLocation(options);
    throw error;
  }
}

/**
 * Reverse geocode coordinates to an address
 */
export async function reverseGeocode(latitude, longitude) {
  try {
    const response = await fetch(`${API_BASE_URL}/reverseGeocode?lat=${latitude}&lon=${longitude}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${global.googleAuthToken || ''}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Reverse geocoding failed: ${response.status}`);
    }

    const data = await response.json();

    if (!data?.address) {
      throw new Error('No address returned from reverse geocoding');
    }

    return data.address;
  } catch (error) {
    console.error('Error reverse geocoding:', error);
    if (__DEV__) return getMockAddress(latitude, longitude);
    throw error;
  }
}

/**
 * Get nearby products within a radius from location
 */
export async function getNearbyProducts(latitude, longitude, radius = 10) {
  try {
    const response = await fetch(
      `${API_BASE_URL}/nearbyProducts?lat=${latitude}&lon=${longitude}&radius=${radius}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${global.googleAuthToken || ''}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to get nearby products: ${response.status}`);
    }

    const data = await response.json();

    if (!data?.products || !Array.isArray(data.products)) {
      throw new Error('Invalid response format from nearbyProducts');
    }

    return data.products;
  } catch (error) {
    console.error('Error getting nearby products:', error);
    if (__DEV__) return getMockNearbyProducts(latitude, longitude, radius);
    throw error;
  }
}

// -----------------------------
// MOCK FUNCTIONS (for __DEV__)
// -----------------------------

function getMockCoordinates(address) {
  const hash = address.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return {
    latitude: 47.6062 + (hash % 20 - 10) / 100,
    longitude: -122.3321 + (hash % 20 - 10) / 100,
  };
}

function getMockAddress(lat, lon) {
  const cities = ['Seattle', 'Portland', 'San Francisco', 'Los Angeles'];
  const streets = ['Maple', 'Oak', 'Pine', 'Cedar'];
  const hash = Math.floor((lat * 100 + lon * 100) % 100);
  return `${100 + hash} ${streets[hash % streets.length]} St, ${cities[hash % cities.length]}, WA`;
}

function getMockProductsWithLocation() {
  return [
    {
      id: '1',
      title: 'Mock Monstera',
      price: 25.0,
      category: 'indoor',
      location: {
        address: 'Seattle, WA',
        latitude: 47.6062,
        longitude: -122.3321,
      },
      image: 'https://via.placeholder.com/150?text=Monstera',
    },
  ];
}

function getMockNearbyProducts(lat, lon, radius) {
  return [
    {
      id: 'nearby-1',
      title: 'Nearby Pothos',
      price: 15.0,
      category: 'indoor',
      location: {
        address: 'Nearby Area',
        latitude: lat + 0.01,
        longitude: lon - 0.01,
      },
      image: 'https://via.placeholder.com/150?text=Pothos',
    },
  ];
}
