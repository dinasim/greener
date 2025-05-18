// components/ToastMessage.js
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions } from 'react-native';
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
  
  // Determine icon and background color based on type
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
          useNativeDriver: true
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true
        })
      ]).start();
      
      // Set timeout to hide
      hideTimeout = setTimeout(() => {
        // Hide animation
        Animated.parallel([
          Animated.timing(opacity, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true
          }),
          Animated.timing(translateY, {
            toValue: -20,
            duration: 300,
            useNativeDriver: true
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
  }, [visible, duration, opacity, translateY, onHide]);
  
  if (!visible && opacity._value === 0) return null;
  
  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity,
          transform: [{ translateY }],
          backgroundColor
        }
      ]}
    >
      <MaterialIcons name={icon} size={24} color={textColor} />
      <Text style={[styles.message, { color: textColor }]}>{message}</Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 60,
    left: 20,
    right: 20,
    backgroundColor: '#333',
    borderRadius: 8,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 1000,
    maxWidth: Dimensions.get('window').width - 40
  },
  message: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    fontWeight: '500',
    color: '#fff'
  }
});

export default ToastMessage;