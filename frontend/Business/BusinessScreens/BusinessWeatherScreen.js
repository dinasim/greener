// ENHANCED BusinessWeatherScreen with tabbed daily forecasts and detailed cards
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Platform,
  Animated,
  Modal,
} from 'react-native';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import CrossPlatformAzureMapView from '../../marketplace/components/CrossPlatformAzureMapView';

export default function BusinessWeatherScreen({ navigation, route }) {
  const { businessId } = route.params || {};
  
  // State management
  const [weatherData, setWeatherData] = useState(null);
  const [forecastData, setForecastData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [showForecast, setShowForecast] = useState(false);
  const [forecastLoading, setForecastLoading] = useState(false);
  const [forecastPeriod, setForecastPeriod] = useState(5); // 5, 7, or 14 days
  const [selectedDayIndex, setSelectedDayIndex] = useState(0); // Currently selected day tab
  const [expandedCard, setExpandedCard] = useState(false); // Detail card expansion
  const [showDayModal, setShowDayModal] = useState(false);
  const [selectedDayForModal, setSelectedDayForModal] = useState(null);
  
  // Location state
  const [locationMode, setLocationMode] = useState('business'); // 'business' or 'current'
  const [currentCoords, setCurrentCoords] = useState(null);
  const [businessCoords, setBusinessCoords] = useState(null);
  const [locationLoading, setLocationLoading] = useState(false);

  // Animation for detail card
  const [cardHeight] = useState(new Animated.Value(0));

  // Load initial data on component mount
  useEffect(() => {
    console.log('🌡️ BusinessWeatherScreen mounted');
    loadInitialData();
  }, []);

  // Handle location mode changes properly
  useEffect(() => {
    console.log('📍 Location mode changed to:', locationMode);
    
    if (locationMode === 'current') {
      getCurrentLocationAndWeather();
    } else if (locationMode === 'business') {
      loadBusinessWeather();
    }
  }, [locationMode]);

  const loadInitialData = async () => {
    console.log('🚀 Loading initial weather data...');
    setIsLoading(true);
    setError(null);
    
    // Start with business location by default
    await loadBusinessWeather();
  };

  // GPS location handling for web and mobile
  const getCurrentLocationAndWeather = async () => {
    console.log('📱 Getting current location with GPS...');
    setLocationLoading(true);
    setError(null);

    try {
      let coords;

      if (Platform.OS === 'web') {
        console.log('🌐 Using browser geolocation API...');
        
        if (!navigator.geolocation) {
          throw new Error('Geolocation is not supported by this browser');
        }

        coords = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              console.log('✅ Browser GPS permission granted');
              console.log(`📍 GPS coordinates: ${position.coords.latitude}, ${position.coords.longitude}`);
              
              resolve({
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracy: position.coords.accuracy
              });
            },
            (error) => {
              console.error('❌ Browser GPS error:', error);
              let errorMessage = 'Failed to get your location';
              
              switch(error.code) {
                case error.PERMISSION_DENIED:
                  errorMessage = 'Location access denied. Please allow location access in your browser settings.';
                  break;
                case error.POSITION_UNAVAILABLE:
                  errorMessage = 'Location information unavailable. Please check your GPS settings.';
                  break;
                case error.TIMEOUT:
                  errorMessage = 'Location request timed out. Please try again.';
                  break;
              }
              
              reject(new Error(errorMessage));
            },
            {
              enableHighAccuracy: true,
              timeout: 15000,
              maximumAge: 0
            }
          );
        });
      } else {
        console.log('📱 Using Expo Location for mobile...');
        
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          throw new Error('Location permission denied');
        }

        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.BestForNavigation,
          timeout: 15000,
          maximumAge: 0
        });

        coords = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          accuracy: location.coords.accuracy
        };
      }

      console.log(`🎯 GPS Success! Coordinates: ${coords.latitude}, ${coords.longitude}`);
      
      setCurrentCoords(coords);
      await loadWeatherData(coords);
      
    } catch (err) {
      console.error('❌ GPS location error:', err);
      Alert.alert('Location Error', err.message);
      setError(err.message);
      setLocationMode('business');
    } finally {
      setLocationLoading(false);
    }
  };

  const loadBusinessWeather = async () => {
    console.log('🏢 Loading business weather data...');
    await loadWeatherData();
  };

  // Centralized weather data loading
  const loadWeatherData = async (coords = null) => {
    try {
      setError(null);
      if (!refreshing) setIsLoading(true);

      const userEmail = await AsyncStorage.getItem('userEmail');
      const authToken = await AsyncStorage.getItem('googleAuthToken');
      
      if (!userEmail) {
        throw new Error('Business authentication required');
      }

      const headers = {
        'Content-Type': 'application/json',
        'X-User-Email': userEmail,
      };
      
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }

      let url;
      if (coords && coords.latitude && coords.longitude) {
        url = `https://usersfunctions.azurewebsites.net/api/business/weather?lat=${coords.latitude}&lon=${coords.longitude}`;
        console.log(`🌐 Fetching weather for coordinates: ${coords.latitude}, ${coords.longitude}`);
      } else {
        url = `https://usersfunctions.azurewebsites.net/api/business/weather?businessId=${userEmail}`;
        console.log('🏢 Fetching weather for business location');
      }

      console.log('📡 Making weather API request to:', url);
      
      const response = await fetch(url, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Weather data not available for this location');
        }
        
        const errorText = await response.text();
        console.error('❌ Weather API error response:', errorText);
        throw new Error(`Failed to load weather: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log('✅ Weather data loaded successfully:', data);
      
      setWeatherData(data);

      if (!coords && data.coordinates) {
        setBusinessCoords({
          latitude: data.coordinates.latitude,
          longitude: data.coordinates.longitude,
        });
        console.log('🏢 Business coordinates set:', data.coordinates);
      }

    } catch (err) {
      console.error('❌ Weather loading error:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  // Enhanced forecast data loading with 7-day and 14-day support
  const loadForecastData = async (days = forecastPeriod) => {
    console.log(`📊 Loading ${days}-day forecast data...`);
    setForecastLoading(true);
    setError(null);

    try {
      const userEmail = await AsyncStorage.getItem('userEmail');
      const authToken = await AsyncStorage.getItem('googleAuthToken');
      
      if (!userEmail) {
        throw new Error('Authentication required');
      }

      const headers = {
        'Content-Type': 'application/json',
        'X-User-Email': userEmail,
      };
      
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }

      let url;
      if (locationMode === 'current' && currentCoords) {
        url = `https://usersfunctions.azurewebsites.net/api/business/weather/forecast?lat=${currentCoords.latitude}&lon=${currentCoords.longitude}&days=${days}`;
        console.log(`📊 Fetching ${days}-day forecast for coordinates: ${currentCoords.latitude}, ${currentCoords.longitude}`);
      } else {
        url = `https://usersfunctions.azurewebsites.net/api/business/weather/forecast?businessId=${userEmail}&days=${days}`;
        console.log(`📊 Fetching ${days}-day forecast for business location`);
      }

      console.log('📡 Making forecast API request to:', url);
      
      const response = await fetch(url, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Forecast API error response:', errorText);
        throw new Error(`Failed to load forecast: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`✅ ${days}-day forecast data loaded successfully:`, data);
      setForecastData(data);
      setForecastPeriod(days);
      setShowForecast(true);
      setSelectedDayIndex(0); // Reset to first day when loading new forecast

    } catch (err) {
      console.error(`❌ ${days}-day forecast loading error:`, err);
      setError(err.message || 'Failed to load forecast');
      setShowForecast(false);
      setForecastData(null);
    } finally {
      setForecastLoading(false);
    }
  };

  // --- Replace processDailyForecast to fix date format and night temp ---
  const processDailyForecast = (forecastData) => {
    if (!forecastData || !forecastData.list) return [];

    const dailyData = {};
    
    forecastData.list.forEach(item => {
      const date = new Date(item.dt * 1000);
      // Format: 15.6
      const dayNum = date.getDate();
      const monthNum = date.getMonth() + 1;
      const dateKey = `${dayNum}.${monthNum}`;
      
      if (!dailyData[dateKey]) {
        dailyData[dateKey] = {
          date,
          dateKey,
          items: [],
          dayName: date.toLocaleDateString('en-US', { weekday: 'short' }),
          dayDate: `${dayNum}.${monthNum}`,
          month: date.toLocaleDateString('en-US', { month: 'short' })
        };
      }
      
      dailyData[dateKey].items.push(item);
    });

    // Calculate daily summaries
    return Object.values(dailyData).map(day => {
      const temps = day.items.map(item => item.main.temp);
      const humidities = day.items.map(item => item.main.humidity);
      const windSpeeds = day.items.map(item => item.wind.speed);
      const pops = day.items.map(item => item.pop || 0);
      
      // Night temp: use the min temp from 0:00-6:00 or fallback to min of all
      const nightTemps = day.items.filter(item => {
        const hour = new Date(item.dt * 1000).getHours();
        return hour < 7;
      }).map(item => item.main.temp);
      const temp_night = nightTemps.length > 0 ? Math.min(...nightTemps) : Math.min(...temps);
      
      // Day temp: use max from 12:00-18:00 or fallback to max of all
      const dayTemps = day.items.filter(item => {
        const hour = new Date(item.dt * 1000).getHours();
        return hour >= 12 && hour <= 18;
      }).map(item => item.main.temp);
      const temp_day = dayTemps.length > 0 ? Math.max(...dayTemps) : Math.max(...temps);

      // Most common weather
      const weatherCounts = {};
      day.items.forEach(item => {
        const weather = item.weather[0].main;
        weatherCounts[weather] = (weatherCounts[weather] || 0) + 1;
      });
      const dominantWeather = Object.keys(weatherCounts).reduce((a, b) => 
        weatherCounts[a] > weatherCounts[b] ? a : b
      );
      
      const dominantWeatherItem = day.items.find(item => item.weather[0].main === dominantWeather);
      
      return {
        ...day,
        summary: {
          temp_min: Math.min(...temps),
          temp_max: Math.max(...temps),
          temp_avg: temps.reduce((a, b) => a + b, 0) / temps.length,
          temp_day,
          temp_night,
          humidity_avg: humidities.reduce((a, b) => a + b, 0) / humidities.length,
          wind_avg: windSpeeds.reduce((a, b) => a + b, 0) / windSpeeds.length,
          pop_max: Math.max(...pops),
          weather: dominantWeatherItem.weather[0],
          pressure: day.items[Math.floor(day.items.length / 2)].main.pressure // Middle reading
        }
      };
    });
  };

  // Handle day tab selection
  const handleDaySelect = (index) => {
    setSelectedDayIndex(index);
    setSelectedDayForModal(dailyForecast[index]);
    setShowDayModal(true);
  };

  // Toggle detail card expansion
  const toggleDetailCard = () => {
    const isExpanding = !expandedCard;
    setExpandedCard(isExpanding);
    
    Animated.timing(cardHeight, {
      toValue: isExpanding ? 200 : 0,
      duration: 300,
      useNativeDriver: false,
    }).start();
  };

  // Refresh handler
  const onRefresh = async () => {
    console.log('🔄 Refreshing weather data...');
    setRefreshing(true);
    setForecastData(null);
    setShowForecast(false);
    setExpandedCard(false);
    setSelectedDayIndex(0);
    
    if (locationMode === 'current') {
      await getCurrentLocationAndWeather();
    } else {
      await loadWeatherData();
    }
  };

  // Forecast period selection handler
  const handleForecastPeriodChange = async (days) => {
    if (days === forecastPeriod && showForecast) {
      setShowForecast(false);
      setExpandedCard(false);
    } else {
      setForecastPeriod(days);
      await loadForecastData(days);
    }
  };

  // Weather icon mapping
  const getWeatherIcon = (iconCode) => {
    const iconMap = {
      '01d': 'weather-sunny', '01n': 'weather-night',
      '02d': 'weather-partly-cloudy', '02n': 'weather-night-partly-cloudy',
      '03d': 'weather-cloudy', '03n': 'weather-cloudy',
      '04d': 'weather-cloudy', '04n': 'weather-cloudy',
      '09d': 'weather-pouring', '09n': 'weather-pouring',
      '10d': 'weather-rainy', '10n': 'weather-rainy',
      '11d': 'weather-lightning', '11n': 'weather-lightning',
      '13d': 'weather-snowy', '13n': 'weather-snowy',
      '50d': 'weather-fog', '50n': 'weather-fog',
    };
    return iconMap[iconCode] || 'weather-cloudy';
  };

  const getPlantCareAdvice = (weather) => {
    const advice = [];
    
    if (weather.temperature > 30) {
      advice.push('🌡️ High temperature - provide extra shade for sensitive plants');
    }
    
    if (weather.humidity < 40) {
      advice.push('💧 Low humidity - consider misting plants or using humidity trays');
    } else if (weather.humidity > 80) {
      advice.push('🌬️ High humidity - ensure good air circulation to prevent fungal issues');
    }
    
    if (weather.windSpeed > 20) {
      advice.push('💨 Strong winds - secure tall plants and check for damage');
    }
    
    if (weather.rainToday) {
      advice.push('☔ Rain today - skip outdoor watering and check for overwatering');
    } else {
      advice.push('☀️ No rain - check soil moisture and water as needed');
    }
    
    if (weather.uvIndex && weather.uvIndex > 6) {
      advice.push('☀️ High UV - provide shade for sensitive plants during peak hours');
    }
    
    return advice;
  };

  // Get wind direction from degrees
  const getWindDirection = (degrees) => {
    const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    return directions[Math.round(degrees / 22.5) % 16];
  };

  // Loading state
  if (isLoading && !weatherData) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <MaterialIcons name="arrow-back" size={24} color="#216a94" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Weather</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#216a94" />
          <Text style={styles.loadingText}>Loading weather data...</Text>
          {locationLoading && (
            <Text style={styles.subLoadingText}>Getting your location...</Text>
          )}
        </View>
      </SafeAreaView>
    );
  }

  // Error state
  if (error && !weatherData) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <MaterialIcons name="arrow-back" size={24} color="#216a94" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Weather</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.centered}>
          <MaterialIcons name="error-outline" size={48} color="#f44336" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadInitialData}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Map coordinates and markers
  const mapCoords = locationMode === 'current' ? currentCoords : businessCoords;
  const mapMarkers = [];
  
  if (mapCoords) {
    mapMarkers.push({
      id: locationMode === 'current' ? 'current' : 'business',
      latitude: mapCoords.latitude,
      longitude: mapCoords.longitude,
      title: locationMode === 'current' ? 'Current Location' : 'Business Location',
      description: weatherData?.location || 'Weather Location',
      type: locationMode === 'current' ? 'user' : 'business',
    });
  }

  // Process daily forecast data
  const dailyForecast = showForecast && forecastData ? processDailyForecast(forecastData) : [];
  const selectedDay = dailyForecast[selectedDayIndex];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <MaterialIcons name="arrow-back" size={24} color="#216a94" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Weather</Text>
        <TouchableOpacity 
          style={styles.refreshButton} 
          onPress={onRefresh} 
          disabled={refreshing}
          accessibilityLabel="Refresh weather data"
        >
          <MaterialIcons 
            name="refresh" 
            size={24} 
            color={refreshing ? "#999" : "#216a94"} 
          />
        </TouchableOpacity>
      </View>

      {/* Location Mode Toggle */}
      <View style={styles.locationToggleContainer}>
        <TouchableOpacity
          style={[
            styles.locationToggleButton,
            locationMode === 'business' && styles.locationToggleButtonActive
          ]}
          onPress={() => setLocationMode('business')}
          disabled={isLoading}
        >
          <MaterialIcons 
            name="business" 
            size={16} 
            color={locationMode === 'business' ? '#fff' : '#666'} 
          />
          <Text style={[
            styles.locationToggleText,
            locationMode === 'business' && styles.locationToggleTextActive
          ]}>
            Business
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.locationToggleButton,
            locationMode === 'current' && styles.locationToggleButtonActive
          ]}
          onPress={() => setLocationMode('current')}
          disabled={isLoading || locationLoading}
        >
          {locationLoading ? (
            <ActivityIndicator size="small" color="#666" />
          ) : (
            <MaterialIcons 
              name="my-location" 
              size={16} 
              color={locationMode === 'current' ? '#fff' : '#666'} 
            />
          )}
          <Text style={[
            styles.locationToggleText,
            locationMode === 'current' && styles.locationToggleTextActive
          ]}>
            Current
          </Text>
        </TouchableOpacity>
      </View>

      {/* Map Display */}
      <View style={styles.mapContainer}>
        {mapCoords ? (
          <CrossPlatformAzureMapView
            region={{ 
              latitude: mapCoords.latitude, 
              longitude: mapCoords.longitude, 
              zoom: 14 
            }}
            markers={mapMarkers}
            style={styles.map}
            showUserLocation={locationMode === 'current'}
            myLocation={currentCoords}
          />
        ) : (
          <View style={styles.mapPlaceholder}>
            <MaterialIcons name="map" size={48} color="#ccc" />
            <Text style={styles.mapPlaceholderText}>
              {locationMode === 'current' ? 'Getting your location...' : 'Location not available'}
            </Text>
          </View>
        )}
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Weather Data Display */}
        {weatherData && (
          <>
            {/* Current Weather Card */}
            <View style={styles.currentWeatherCard}>
              <Text style={styles.location}>{weatherData.location}</Text>
              
              <View style={styles.currentWeatherContent}>
                <MaterialCommunityIcons 
                  name={getWeatherIcon(weatherData.icon)} 
                  size={80} 
                  color="#4CAF50" 
                />
                <View style={styles.temperatureSection}>
                  <Text style={styles.temperature}>{weatherData.temperature}°C</Text>
                  <Text style={styles.condition}>{weatherData.condition}</Text>
                  <Text style={styles.feelsLike}>Feels like {weatherData.feelsLike}°C</Text>
                </View>
              </View>
              
              <View style={styles.weatherDetails}>
                <View style={styles.weatherDetail}>
                  <MaterialCommunityIcons name="water-percent" size={20} color="#2196F3" />
                  <Text style={styles.detailText}>Humidity</Text>
                  <Text style={styles.detailValue}>{weatherData.humidity}%</Text>
                </View>
                <View style={styles.weatherDetail}>
                  <MaterialCommunityIcons name="weather-windy" size={20} color="#FF9800" />
                  <Text style={styles.detailText}>Wind</Text>
                  <Text style={styles.detailValue}>{weatherData.windSpeed} m/s</Text>
                </View>
                <View style={styles.weatherDetail}>
                  <MaterialCommunityIcons name="gauge" size={20} color="#9C27B0" />
                  <Text style={styles.detailText}>Pressure</Text>
                  <Text style={styles.detailValue}>{weatherData.pressure} hPa</Text>
                </View>
              </View>

              {/* Additional Details */}
              <View style={styles.additionalDetails}>
                <View style={styles.detailRow}>
                  <MaterialCommunityIcons name="eye" size={16} color="#666" />
                  <Text style={styles.detailLabel}>Visibility: {weatherData.visibility} km</Text>
                </View>
                {weatherData.sunrise && (
                  <View style={styles.detailRow}>
                    <MaterialCommunityIcons name="weather-sunset-up" size={16} color="#FF9800" />
                    <Text style={styles.detailLabel}>
                      Sunrise: {new Date(weatherData.sunrise).toLocaleTimeString('en-US', { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </Text>
                  </View>
                )}
                {weatherData.sunset && (
                  <View style={styles.detailRow}>
                    <MaterialCommunityIcons name="weather-sunset-down" size={16} color="#FF5722" />
                    <Text style={styles.detailLabel}>
                      Sunset: {new Date(weatherData.sunset).toLocaleTimeString('en-US', { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {/* Plant Care Advice */}
            <View style={styles.adviceCard}>
              <Text style={styles.sectionTitle}>Plant Care Advice</Text>
              <Text style={styles.adviceSubtitle}>Based on current weather conditions</Text>
              {getPlantCareAdvice(weatherData).map((advice, index) => (
                <View key={index} style={styles.adviceItem}>
                  <MaterialIcons name="lightbulb" size={16} color="#4CAF50" />
                  <Text style={styles.adviceText}>{advice}</Text>
                </View>
              ))}
            </View>

            {/* Forecast Period Selection */}
            <View style={styles.forecastPeriodContainer}>
              <Text style={styles.sectionTitle}>Weather Forecast</Text>
              <View style={styles.periodSelector}>
                {[5, 7, 14].map((days) => (
                  <TouchableOpacity
                    key={days}
                    style={[
                      styles.periodButton,
                      forecastPeriod === days && showForecast && styles.periodButtonActive,
                      forecastLoading && styles.buttonDisabled
                    ]}
                    onPress={() => handleForecastPeriodChange(days)}
                    disabled={forecastLoading}
                  >
                    {forecastLoading && forecastPeriod === days ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={[
                        styles.periodButtonText,
                        forecastPeriod === days && showForecast && styles.periodButtonTextActive
                      ]}>
                        {days} Days
                      </Text>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Daily Forecast Tabs */}
            {showForecast && forecastData && dailyForecast.length > 0 && (
              <View style={styles.forecastCard}>
                <Text style={styles.forecastSubtitle}>
                  {forecastPeriod}-day forecast • Tap a day for details
                </Text>
                {/* Day Tabs */}
                <ScrollView 
                  horizontal 
                  showsHorizontalScrollIndicator={false}
                  style={styles.dayTabsContainer}
                  contentContainerStyle={styles.dayTabsContent}
                >
                  {dailyForecast.map((day, index) => (
                    <TouchableOpacity
                      key={day.dateKey}
                      style={[
                        styles.dayTab,
                        selectedDayIndex === index && styles.dayTabActive
                      ]}
                      onPress={() => handleDaySelect(index)}
                    >
                      <Text style={[
                        styles.dayTabDay,
                        selectedDayIndex === index && styles.dayTabDayActive
                      ]}>
                        {day.dayName}
                      </Text>
                      <Text style={[
                        styles.dayTabDate,
                        selectedDayIndex === index && styles.dayTabDateActive
                      ]}>
                        {day.dayDate}
                      </Text>
                      <MaterialCommunityIcons 
                        name={getWeatherIcon(day.summary.weather.icon)} 
                        size={24} 
                        color={selectedDayIndex === index ? "#fff" : "#4CAF50"} 
                        style={styles.dayTabIcon}
                      />
                      <Text style={[
                        styles.dayTabTemp,
                        selectedDayIndex === index && styles.dayTabTempActive
                      ]}>
                        {Math.round(day.summary.temp_day)}°
                      </Text>
                      <Text style={[
                        styles.dayTabTempMin,
                        selectedDayIndex === index && styles.dayTabTempMinActive
                      ]}>
                        {Math.round(day.summary.temp_night)}°
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {/* Modal for Day Details */}
                <Modal
                  visible={showDayModal}
                  animationType="slide"
                  transparent={true}
                  onRequestClose={() => setShowDayModal(false)}
                >
                  <View style={styles.modalOverlay}>
                    <View style={styles.modalContainer}>
                      <TouchableOpacity style={styles.modalCloseButton} onPress={() => setShowDayModal(false)}>
                        <MaterialIcons name="close" size={28} color="#666" />
                      </TouchableOpacity>
                      {selectedDayForModal && (
                        <ScrollView style={styles.modalContent}>
                          <View style={styles.dayDetailHeaderContent}>
                            <MaterialCommunityIcons 
                              name={getWeatherIcon(selectedDayForModal.summary.weather.icon)} 
                              size={32} 
                              color="#4CAF50" 
                            />
                            <View style={styles.dayDetailHeaderText}>
                              <Text style={styles.dayDetailTitle}>
                                {selectedDayForModal.dayName}, {selectedDayForModal.month} {selectedDayForModal.dayDate}
                              </Text>
                              <Text style={styles.dayDetailCondition}>
                                {selectedDayForModal.summary.weather.description}
                              </Text>
                            </View>
                          </View>
                          <View style={styles.dayDetailGrid}>
                            <View style={styles.dayDetailItem}>
                              <MaterialCommunityIcons name="thermometer" size={20} color="#FF5722" />
                              <Text style={styles.dayDetailLabel}>Temperature</Text>
                              <Text style={styles.dayDetailValue}>
                                {Math.round(selectedDayForModal.summary.temp_day)}° / {Math.round(selectedDayForModal.summary.temp_night)}°
                              </Text>
                            </View>
                            <View style={styles.dayDetailItem}>
                              <MaterialCommunityIcons name="water-percent" size={20} color="#2196F3" />
                              <Text style={styles.dayDetailLabel}>Humidity</Text>
                              <Text style={styles.dayDetailValue}>
                                {Math.round(selectedDayForModal.summary.humidity_avg)}%
                              </Text>
                            </View>
                            <View style={styles.dayDetailItem}>
                              <MaterialCommunityIcons name="weather-windy" size={20} color="#FF9800" />
                              <Text style={styles.dayDetailLabel}>Wind</Text>
                              <Text style={styles.dayDetailValue}>
                                {selectedDayForModal.summary.wind_avg.toFixed(1)} m/s
                              </Text>
                            </View>
                            <View style={styles.dayDetailItem}>
                              <MaterialCommunityIcons name="umbrella" size={20} color="#9C27B0" />
                              <Text style={styles.dayDetailLabel}>Rain Chance</Text>
                              <Text style={styles.dayDetailValue}>
                                {Math.round(selectedDayForModal.summary.pop_max * 100)}%
                              </Text>
                            </View>
                            <View style={styles.dayDetailItem}>
                              <MaterialCommunityIcons name="gauge" size={20} color="#607D8B" />
                              <Text style={styles.dayDetailLabel}>Pressure</Text>
                              <Text style={styles.dayDetailValue}>
                                {Math.round(selectedDayForModal.summary.pressure)} hPa
                              </Text>
                            </View>
                            <View style={styles.dayDetailItem}>
                              <MaterialCommunityIcons name="thermometer-lines" size={20} color="#4CAF50" />
                              <Text style={styles.dayDetailLabel}>Feels Like</Text>
                              <Text style={styles.dayDetailValue}>
                                {Math.round(selectedDayForModal.summary.temp_avg)}°
                              </Text>
                            </View>
                          </View>
                          {/* Hourly breakdown for selected day (if available) */}
                          {selectedDayForModal.items.length > 1 && (
                            <View style={styles.hourlySection}>
                              <Text style={styles.hourlySectionTitle}>Hourly Breakdown</Text>
                              {selectedDayForModal.items.slice(0, 8).map((item, index) => (
                                <View key={index} style={styles.hourlyItem}>
                                  <Text style={styles.hourlyTime}>
                                    {new Date(item.dt * 1000).toLocaleTimeString('en-US', { 
                                      hour: '2-digit', 
                                      minute: '2-digit' 
                                    })}
                                  </Text>
                                  <MaterialCommunityIcons 
                                    name={getWeatherIcon(item.weather[0].icon)} 
                                    size={20} 
                                    color="#4CAF50" 
                                  />
                                  <Text style={styles.hourlyTemp}>{Math.round(item.main.temp)}°</Text>
                                  <Text style={styles.hourlyWind}>
                                    {item.wind.speed.toFixed(1)} m/s {getWindDirection(item.wind.deg)}
                                  </Text>
                                  <Text style={styles.hourlyPop}>
                                    {Math.round((item.pop || 0) * 100)}%
                                  </Text>
                                </View>
                              ))}
                            </View>
                          )}
                        </ScrollView>
                      )}
                    </View>
                  </View>
                </Modal>
              </View>
            )}
            {showForecast && (!forecastData || dailyForecast.length === 0) && (
              <View style={styles.errorContainer}>
                <MaterialIcons name="error-outline" size={24} color="#f44336" />
                <Text style={styles.errorText}>Failed to load forecast data.</Text>
              </View>
            )}

            {/* Weather Source */}
            <View style={styles.sourceCard}>
              <Text style={styles.sourceText}>
                Data from OpenWeatherMap • Last updated: {(() => {
                  // If timestamp is UTC, convert to local
                  const ts = weatherData.timestamp;
                  const dt = typeof ts === 'string' ? new Date(ts) : new Date(ts);
                  // If time difference from now and dt is ~0, it's local; if ~3h, it's UTC
                  const now = new Date();
                  const diff = Math.abs(now.getHours() - dt.getHours());
                  let localDate = dt;
                  if (diff >= 2 && diff <= 4) {
                    // Assume UTC, convert to local
                    localDate = new Date(dt.getTime() + (new Date().getTimezoneOffset() * -60000));
                  }
                  return localDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
                })()}
              </Text>
            </View>
          </>
        )}

        {/* Error Display */}
        {error && weatherData && (
          <View style={styles.errorContainer}>
            <MaterialIcons name="warning" size={20} color="#f44336" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  backButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#f8f9fa',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#216a94',
    flex: 1,
    textAlign: 'center',
  },
  refreshButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#f8f9fa',
  },
  placeholder: {
    width: 40,
  },
  locationToggleContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginVertical: 12,
    marginHorizontal: 16,
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 4,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  locationToggleButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 6,
    backgroundColor: 'transparent',
  },
  locationToggleButtonActive: {
    backgroundColor: '#216a94',
  },
  locationToggleText: {
    marginLeft: 6,
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  locationToggleTextActive: {
    color: '#fff',
  },
  mapContainer: {
    height: 200,
    margin: 16,
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  map: {
    flex: 1,
  },
  mapPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  mapPlaceholderText: {
    marginTop: 8,
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  subLoadingText: {
    marginTop: 8,
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  errorText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginLeft: 8,
  },
  retryButton: {
    marginTop: 16,
    backgroundColor: '#216a94',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '600',
    textAlign: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  currentWeatherCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  location: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 16,
  },
  currentWeatherContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  temperatureSection: {
    marginLeft: 20,
    alignItems: 'center',
  },
  temperature: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#216a94',
  },
  condition: {
    fontSize: 16,
    color: '#666',
    marginTop: 4,
  },
  feelsLike: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  weatherDetails: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  weatherDetail: {
    alignItems: 'center',
  },
  detailText: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginTop: 2,
  },
  additionalDetails: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailLabel: {
    fontSize: 12,
    color: '#666',
    marginLeft: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#216a94',
    marginBottom: 8,
  },
  adviceCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  adviceSubtitle: {
    fontSize: 12,
    color: '#666',
    marginBottom: 16,
  },
  adviceItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  adviceText: {
    flex: 1,
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
    lineHeight: 20,
  },
  forecastPeriodContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#216a94',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  periodSelector: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 12,
  },
  periodButton: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  periodButtonActive: {
    backgroundColor: '#216a94',
  },
  periodButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  periodButtonTextActive: {
    color: '#fff',
  },
  forecastCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  forecastSubtitle: {
    fontSize: 12,
    color: '#666',
    marginBottom: 16,
    textAlign: 'center',
  },
  dayTabsContainer: {
    marginBottom: 16,
  },
  dayTabsContent: {
    paddingHorizontal: 4,
  },
  dayTab: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 12,
    marginHorizontal: 4,
    minWidth: 70,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  dayTabActive: {
    backgroundColor: '#216a94',
    borderColor: '#1565C0',
  },
  dayTabDay: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 2,
  },
  dayTabDayActive: {
    color: '#fff',
  },
  dayTabDate: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 6,
  },
  dayTabDateActive: {
    color: '#fff',
  },
  dayTabIcon: {
    marginBottom: 4,
  },
  dayTabTemp: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 2,
  },
  dayTabTempActive: {
    color: '#fff',
  },
  dayTabTempMin: {
    fontSize: 11,
    color: '#999',
  },
  dayTabTempMinActive: {
    color: '#E3F2FD',
  },
  dayDetailCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 8,
  },
  dayDetailHeader: {
    backgroundColor: '#fff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  dayDetailHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dayDetailHeaderText: {
    flex: 1,
    marginLeft: 12,
  },
  dayDetailTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 2,
  },
  dayDetailCondition: {
    fontSize: 12,
    color: '#666',
    textTransform: 'capitalize',
  },
  dayDetailContent: {
    flex: 1,
    padding: 16,
  },
  dayDetailGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  dayDetailItem: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    width: '48%',
    marginBottom: 8,
    alignItems: 'center',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  dayDetailLabel: {
    fontSize: 11,
    color: '#666',
    marginTop: 4,
    textAlign: 'center',
  },
  dayDetailValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 2,
    textAlign: 'center',
  },
  hourlySection: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
  },
  hourlySectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  hourlyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  hourlyTime: {
    fontSize: 11,
    color: '#666',
    width: 50,
  },
  hourlyTemp: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#333',
    width: 35,
    marginLeft: 8,
  },
  hourlyWind: {
    fontSize: 10,
    color: '#666',
    flex: 1,
    marginLeft: 8,
  },
  hourlyPop: {
    fontSize: 10,
    color: '#2196F3',
    width: 30,
    textAlign: 'right',
  },
  sourceCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    marginBottom: 20,
  },
  sourceText: {
    fontSize: 10,
    color: '#999',
    textAlign: 'center',
    marginBottom: 2,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff3f3',
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#f44336',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    width: '90%',
    maxHeight: '85%',
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  modalCloseButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 10,
    padding: 8,
  },
  modalContent: {
    marginTop: 32,
    marginBottom: 8,
  },
});