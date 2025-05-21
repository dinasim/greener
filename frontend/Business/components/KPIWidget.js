// Business/components/KPIWidget.js
import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Platform,
} from 'react-native';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';

export default function KPIWidget({
  title,
  value,
  change,
  icon,
  color = '#4CAF50',
  format = 'number',
  subtitle,
  onPress,
  trend,
  isLoading = false,
  autoRefresh = false
}) {
  // Animation refs
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Entrance animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 100,
        friction: 8,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start();
  }, []);

  useEffect(() => {
    // Value change pulse animation
    if (value !== undefined && value !== null) {
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 150,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 150,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]).start();
    }
  }, [value]);

  useEffect(() => {
    // Auto-refresh rotation animation
    if (autoRefresh && isLoading) {
      const rotateAnimation = Animated.loop(
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: Platform.OS !== 'web',
        })
      );
      rotateAnimation.start();

      return () => rotateAnimation.stop();
    }
  }, [autoRefresh, isLoading]);

  // Format value based on type
  const formatValue = (val) => {
    if (val === undefined || val === null) return '0';
    
    switch (format) {
      case 'currency':
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }).format(val);
      case 'percentage':
        return `${parseFloat(val).toFixed(1)}%`;
      case 'number':
      default:
        return new Intl.NumberFormat('en-US', {
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }).format(val);
    }
  };

  // Get trend color
  const getTrendColor = () => {
    if (change === undefined || change === null) return '#666';
    return change >= 0 ? '#4CAF50' : '#f44336';
  };

  // Get trend icon
  const getTrendIcon = () => {
    if (change === undefined || change === null) return 'trending-flat';
    return change >= 0 ? 'trending-up' : 'trending-down';
  };

  // Handle press with animation
  const handlePress = () => {
    if (!onPress) return;

    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start();

    onPress();
  };

  const Widget = onPress ? TouchableOpacity : View;
  const rotateInterpolate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: fadeAnim,
          transform: [{ scale: scaleAnim }],
        },
      ]}
    >
      <Widget
        style={styles.widget}
        onPress={onPress ? handlePress : undefined}
        activeOpacity={onPress ? 0.7 : 1}
      >
        <View style={styles.header}>
          <View style={[styles.iconContainer, { backgroundColor: color }]}>
            {isLoading && autoRefresh ? (
              <Animated.View style={{ transform: [{ rotate: rotateInterpolate }] }}>
                <MaterialIcons name="refresh" size={20} color="#fff" />
              </Animated.View>
            ) : (
              <MaterialCommunityIcons name={icon} size={20} color="#fff" />
            )}
          </View>
          
          {change !== undefined && change !== null && (
            <View style={styles.trendContainer}>
              <MaterialIcons 
                name={getTrendIcon()} 
                size={14} 
                color={getTrendColor()} 
              />
              <Text style={[styles.trendText, { color: getTrendColor() }]}>
                {Math.abs(change).toFixed(1)}%
              </Text>
            </View>
          )}
        </View>

        <Text style={styles.title}>{title}</Text>
        
        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
          <Text style={[styles.value, { color: color }]}>
            {formatValue(value)}
          </Text>
        </Animated.View>

        {subtitle && (
          <Text style={styles.subtitle}>{subtitle}</Text>
        )}

        {onPress && (
          <View style={styles.pressHint}>
            <MaterialIcons name="touch-app" size={12} color="#999" />
          </View>
        )}
      </Widget>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minWidth: 120,
  },
  widget: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  trendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  trendText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 2,
  },
  title: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
    fontWeight: '500',
  },
  value: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 10,
    color: '#999',
    fontStyle: 'italic',
  },
  pressHint: {
    position: 'absolute',
    top: 8,
    right: 8,
    opacity: 0.5,
  },
});