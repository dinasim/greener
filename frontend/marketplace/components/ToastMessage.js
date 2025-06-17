// components/ToastMessage.js
import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

/**
 * Toast message component for temporary user feedback
 * 
 * @param {Object} props Component props
 * @param {string} props.message Message to display
 * @param {string} props.type Type of message ('error', 'success', 'info', 'warning')
 * @param {boolean} props.visible Whether the toast is visible
 * @param {Function} props.onHide Callback when toast hides
 * @param {number} props.duration Duration in ms (default: 3000)
 */
const ToastMessage = ({ 
  message, 
  type = 'info', 
  visible = false, 
  onHide,
  duration = 3000 
}) => {
  // Animation values
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-20)).current;

  // Determine if we can use native driver (not on web)
  const useNativeDriver = Platform.OS !== 'web';

  // Determine icon and color based on type
  const getIconAndColor = () => {
    switch (type) {
      case 'success':
        return {
          icon: 'check-circle',
          backgroundColor: '#4CAF50',
          textColor: '#fff'
        };
      case 'error':
        return {
          icon: 'error',
          backgroundColor: '#f44336',
          textColor: '#fff'
        };
      case 'warning':
        return {
          icon: 'warning',
          backgroundColor: '#FFC107',
          textColor: '#333'
        };
      case 'info':
      default:
        return {
          icon: 'info',
          backgroundColor: '#2196F3',
          textColor: '#fff'
        };
    }
  };
  
  const { icon, backgroundColor, textColor } = getIconAndColor();
  
  // Show/hide the toast when visibility changes
  useEffect(() => {
    let hideTimeout;
    
    if (visible) {
      // Show animation
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 300,
          useNativeDriver
        })
      ]).start();
      
      // Set timeout to hide
      hideTimeout = setTimeout(() => {
        // Hide animation
        Animated.parallel([
          Animated.timing(opacity, {
            toValue: 0,
            duration: 300,
            useNativeDriver
          }),
          Animated.timing(translateY, {
            toValue: -20,
            duration: 300,
            useNativeDriver
          })
        ]).start(() => {
          if (onHide) onHide();
        });
      }, duration);
    } else {
      // Reset animation values
      opacity.setValue(0);
      translateY.setValue(-20);
    }
    
    // Clean up timeout
    return () => {
      if (hideTimeout) clearTimeout(hideTimeout);
    };
  }, [visible, duration, opacity, translateY, onHide, useNativeDriver]);
  
  if (!visible && opacity._value === 0) return null;
  
  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor,
          opacity,
          transform: [{ translateY }],
        }
      ]}
    >
      <MaterialIcons name={icon} size={20} color={textColor} style={styles.icon} />
      <Text style={[styles.message, { color: textColor }]} numberOfLines={2}>
        {message}
      </Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 50,
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    zIndex: 9999,
    // Use boxShadow instead of shadow* properties for web compatibility
    ...Platform.select({
      web: {
        boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.15)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
        elevation: 5,
      }
    }),
  },
  icon: {
    marginRight: 12,
  },
  message: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 18,
  },
});

export default ToastMessage;