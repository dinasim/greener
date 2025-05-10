// services/theme.js
/**
 * Central theme file for Greener app
 * Contains colors, spacing, typography, and other theme constants
 */

// Color palette
export const colors = {
    // Primary brand colors
    primary: {
      main: '#4CAF50',      // Main green - use for primary buttons, active states
      dark: '#2E7D32',      // Dark green - use for header, touch states
      light: '#A5D6A7',     // Light green - use for secondary elements
      veryLight: '#f0f9f0', // Very light green - use for backgrounds, inactive buttons
      medium: '#C8E6C9',    // Medium light green - use for selected items
    },
    
    // Text colors
    text: {
      primary: '#333',      // Primary text
      secondary: '#666',    // Secondary text
      tertiary: '#999',     // Dates, subtle text
      light: '#777',        // Light secondary text
      extraLight: '#888',   // Very light text
      medium: '#555',       // Medium text for subtitles
    },
    
    // Neutral colors for borders, backgrounds
    neutral: {
      lightBorder: '#eee',       // Very light borders, dividers
      mediumBorder: '#ddd',      // Medium borders like inputs
      darkBorder: '#e0e0e0',     // Darker borders for contrast
      lightBackground: '#f5f5f5', // Light backgrounds
      veryLightBackground: '#f9f9f9', // Very light backgrounds
      mediumBackground: '#f0f0f0', // Medium light backgrounds
    },
    
    // Accent/status colors
    accent: {
      error: '#f44336',     // Error states, delete buttons, favorites
      warning: '#FFC107',   // Warning, stars
      gold: '#FFD700',      // Gold accents, premium features
      white: '#fff',        // White text, backgrounds
      black: '#000',        // Black text, shadows
    }
  };
  
  // Spacing system (in 4px increments)
  export const spacing = {
    xs: 4,     // Extra small spacing
    s: 8,      // Small spacing
    m: 16,     // Medium spacing (base)
    l: 24,     // Large spacing
    xl: 32,    // Extra large spacing
    xxl: 48,   // Double extra large spacing
    xxxl: 64,  // Triple extra large spacing
  };
  
  // Typography
  export const typography = {
    // Font sizes
    size: {
      xs: 10,     // Extra small text
      s: 12,      // Small text (captions, helpers)
      m: 14,      // Medium text (body)
      l: 16,      // Large text (buttons, important body)
      xl: 18,     // Extra large (subtitles)
      xxl: 20,    // Section headers
      xxxl: 24,   // Screen titles
      xxxxl: 32   // Large headers
    },
    
    // Font weights - use string values for maximum compatibility
    weight: {
      light: '300',
      regular: '400',
      medium: '500',
      semiBold: '600',
      bold: '700',
      extraBold: '800'
    },
    
    // Line heights (multiplier of font size)
    lineHeight: {
      tight: 1.2,   // For headings
      normal: 1.5,  // For body text
      loose: 1.8    // For readable text blocks
    },
    
    // Letter spacing
    letterSpacing: {
      tight: -0.5,
      normal: 0,
      wide: 0.5,
      extraWide: 1.0
    }
  };
  
  // Border radius
  export const borderRadius = {
    xs: 4,    // Subtle rounded corners
    s: 8,     // Standard for inputs, cards
    m: 16,    // Medium roundness for buttons
    l: 20,    // Rounded pills, tags
    xl: 28,   // Very rounded elements
    circle: 9999 // Fully circular elements
  };
  
  // Shadows (for elevation)
  export const shadows = {
    none: {
      shadowColor: 'transparent',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0,
      shadowRadius: 0,
      elevation: 0
    },
    xs: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 1,
      elevation: 1
    },
    s: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
      elevation: 2
    },
    m: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.15,
      shadowRadius: 4,
      elevation: 4
    },
    l: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 6,
      elevation: 8
    },
    xl: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.25,
      shadowRadius: 8,
      elevation: 12
    }
  };
  
  // Animation timings
  export const animation = {
    short: 150,  // Quick feedback animations
    medium: 300, // Standard transitions
    long: 500    // Full screen transitions
  };
  
  // Common button styles
  export const buttons = {
    primary: {
      backgroundColor: colors.primary.main,
      padding: spacing.m,
      borderRadius: borderRadius.m,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      ...shadows.s
    },
    secondary: {
      backgroundColor: colors.primary.veryLight,
      padding: spacing.m,
      borderRadius: borderRadius.m,
      borderWidth: 1,
      borderColor: colors.primary.main,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center'
    },
    tertiary: {
      padding: spacing.m,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center'
    },
    danger: {
      backgroundColor: colors.accent.error,
      padding: spacing.m,
      borderRadius: borderRadius.m,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      ...shadows.s
    },
    disabled: {
      opacity: 0.6
    }
  };
  
  // Text styles for buttons
  export const buttonText = {
    primary: {
      color: colors.accent.white,
      fontSize: typography.size.l,
      fontWeight: typography.weight.semiBold
    },
    secondary: {
      color: colors.primary.main,
      fontSize: typography.size.l,
      fontWeight: typography.weight.semiBold
    },
    tertiary: {
      color: colors.primary.main,
      fontSize: typography.size.l,
      fontWeight: typography.weight.regular
    },
    danger: {
      color: colors.accent.white,
      fontSize: typography.size.l,
      fontWeight: typography.weight.semiBold
    }
  };
  
  // Common input styles
  export const inputs = {
    default: {
      borderWidth: 1,
      borderColor: colors.neutral.mediumBorder,
      borderRadius: borderRadius.s,
      padding: spacing.m,
      fontSize: typography.size.l,
      backgroundColor: colors.neutral.veryLightBackground,
      color: colors.text.primary
    },
    focused: {
      borderColor: colors.primary.main
    },
    error: {
      borderColor: colors.accent.error
    },
    disabled: {
      backgroundColor: colors.neutral.mediumBackground,
      opacity: 0.7
    }
  };
  
  // Helper text styles
  export const helperText = {
    default: {
      fontSize: typography.size.s,
      color: colors.text.secondary,
      marginTop: spacing.xs
    },
    error: {
      fontSize: typography.size.s,
      color: colors.accent.error,
      marginTop: spacing.xs
    }
  };
  
  // Card styles
  export const cards = {
    default: {
      backgroundColor: colors.accent.white,
      borderRadius: borderRadius.s,
      padding: spacing.m,
      ...shadows.s
    },
    flat: {
      backgroundColor: colors.accent.white,
      borderRadius: borderRadius.s,
      padding: spacing.m,
      borderWidth: 1,
      borderColor: colors.neutral.lightBorder
    },
    elevated: {
      backgroundColor: colors.accent.white,
      borderRadius: borderRadius.s,
      padding: spacing.m,
      ...shadows.m
    }
  };
  
  // Common header styles
  export const headers = {
    screen: {
      height: 60,
      backgroundColor: colors.primary.main,
      paddingHorizontal: spacing.m,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      ...shadows.s
    },
    title: {
      fontSize: typography.size.xl,
      fontWeight: typography.weight.semiBold,
      color: colors.accent.white
    }
  };
  
  // Helper functions to get theme values
  export const getColor = (path) => {
    const parts = path.split('.');
    return parts.reduce((obj, key) => obj && obj[key], colors);
  };
  
  export const getSpacing = (size) => {
    return spacing[size] || spacing.m;
  };
  
  export const getTypography = (path) => {
    const parts = path.split('.');
    return parts.reduce((obj, key) => obj && obj[key], typography);
  };
  
  export default {
    colors,
    spacing,
    typography,
    borderRadius,
    shadows,
    animation,
    buttons,
    buttonText,
    inputs,
    helperText,
    cards,
    headers,
    getColor,
    getSpacing,
    getTypography
  };