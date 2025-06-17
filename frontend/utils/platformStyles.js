// utils/platformStyles.js - Cross-platform styling utilities
import { Platform } from 'react-native';

/**
 * Cross-platform styling utility to handle differences between web and native
 */
export const platformStyles = {
  /**
   * Create shadow styles that work on both web and native
   * @param {Object} shadowConfig Shadow configuration
   * @returns {Object} Platform-specific shadow styles
   */
  shadow: (shadowConfig = {}) => {
    const {
      color = '#000',
      offset = { width: 0, height: 2 },
      opacity = 0.1,
      radius = 4,
      elevation = 3
    } = shadowConfig;

    return Platform.select({
      web: {
        boxShadow: `${offset.width}px ${offset.height}px ${radius}px rgba(0, 0, 0, ${opacity})`,
      },
      default: {
        shadowColor: color,
        shadowOffset: offset,
        shadowOpacity: opacity,
        shadowRadius: radius,
        elevation: elevation,
      }
    });
  },

  /**
   * Handle pointer events in a cross-platform way - FIXED: Use style.pointerEvents for web
   * @param {string} pointerEvents Pointer events value
   * @returns {Object} Platform-specific pointer events style
   */
  pointerEvents: (pointerEvents) => {
    return Platform.select({
      web: {
        // FIXED: Use style.pointerEvents instead of deprecated prop
        pointerEvents: pointerEvents
      },
      default: {
        // For native, still use as prop
        pointerEvents: pointerEvents
      }
    });
  },

  /**
   * Create animation configuration that respects platform capabilities
   * @param {Object} config Animation configuration
   * @returns {Object} Platform-specific animation config
   */
  animation: (config = {}) => {
    return {
      ...config,
      useNativeDriver: Platform.OS !== 'web' && config.useNativeDriver !== false
    };
  },

  /**
   * Handle text selection styles
   * @param {boolean} selectable Whether text should be selectable
   * @returns {Object} Platform-specific text selection styles
   */
  textSelection: (selectable = true) => {
    return Platform.select({
      web: {
        userSelect: selectable ? 'text' : 'none',
        WebkitUserSelect: selectable ? 'text' : 'none',
      },
      default: {}
    });
  }
};

/**
 * Enhanced Animated timing that automatically handles platform differences
 * @param {Animated.Value} value Animated value to animate
 * @param {Object} config Animation configuration
 * @returns {Animated.CompositeAnimation} Animation object
 */
export const createPlatformAnimation = (value, config) => {
  const { Animated } = require('react-native');
  
  return Animated.timing(value, {
    ...config,
    useNativeDriver: Platform.OS !== 'web' && config.useNativeDriver !== false
  });
};

export default platformStyles;