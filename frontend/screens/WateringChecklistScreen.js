import React from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';

const WateringChecklistScreen = ({ weatherData }) => {
  const weatherFadeAnim = new Animated.Value(0);

  const renderWeatherCard = () => {
    if (!weatherData) return null;
    
    return (
      <Animated.View style={[
        styles.weatherCard,
        { 
          opacity: weatherFadeAnim,
          transform: [{ scale: weatherFadeAnim }],
          marginTop: 70, // Ensure it's below the header
        }
      ]}>
        <Text style={styles.weatherText}>{`Temperature: ${weatherData.temperature}°C`}</Text>
        <Text style={styles.weatherText}>{`Condition: ${weatherData.condition}`}</Text>
      </Animated.View>
    );
  };

  return (
    <View style={styles.container}>
      {renderWeatherCard()}
      {/* ...other components... */}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#fff',
  },
  weatherCard: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: '#f1f1f1',
    borderRadius: 8,
    elevation: 2,
  },
  weatherText: {
    fontSize: 16,
    color: '#333',
  },
});

export default WateringChecklistScreen;