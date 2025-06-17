// services/theme.js
import { Platform } from 'react-native';

export const colors = {
  primary: { main: '#4CAF50', light: '#81C784', dark: '#388E3C', veryLight: '#E8F5E8' },
  secondary: { main: '#FF9800', light: '#FFB74D', dark: '#F57C00' },
  accent: { success: '#4CAF50', warning: '#FF9800', error: '#f44336', info: '#2196F3', white: '#FFFFFF' },
  text: { primary: '#212121', secondary: '#757575', disabled: '#BDBDBD', hint: '#9E9E9E' },
  neutral: { lightBackground: '#FAFAFA', mediumBackground: '#F5F5F5', veryLightBackground: '#FCFCFC', lightBorder: '#E0E0E0', mediumBorder: '#BDBDBD' }
};

export const spacing = { xs: 4, s: 8, m: 16, l: 24, xl: 32, xxl: 48, xxxl: 64 };

export const typography = {
  size: { xs: 10, s: 12, m: 14, l: 16, xl: 18, xxl: 20, xxxl: 24, xxxxl: 32 },
  weight: { light: '300', regular: '400', medium: '500', semiBold: '600', bold: '700', extraBold: '800' },
  lineHeight: { tight: 1.2, normal: 1.5, loose: 1.8 },
  letterSpacing: { tight: -0.5, normal: 0, wide: 0.5, extraWide: 1.0 }
};

export const borderRadius = { xs: 4, s: 8, m: 16, l: 20, xl: 28, circle: 9999 };

// FIXED: Enhanced cross-platform shadow styles with proper web compatibility
export const shadows = {
  none: Platform.select({
    web: {
      boxShadow: 'none'
    },
    default: {
      shadowColor: 'transparent',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0,
      shadowRadius: 0,
      elevation: 0
    }
  }),
  xs: Platform.select({
    web: {
      boxShadow: '0px 1px 2px rgba(0, 0, 0, 0.1)'
    },
    default: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 1,
      elevation: 1
    }
  }),
  s: Platform.select({
    web: {
      boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)'
    },
    default: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
      elevation: 2
    }
  }),
  m: Platform.select({
    web: {
      boxShadow: '0px 3px 8px rgba(0, 0, 0, 0.15)'
    },
    default: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.15,
      shadowRadius: 4,
      elevation: 4
    }
  }),
  l: Platform.select({
    web: {
      boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.2)'
    },
    default: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 6,
      elevation: 6
    }
  }),
  xl: Platform.select({
    web: {
      boxShadow: '0px 6px 16px rgba(0, 0, 0, 0.25)'
    },
    default: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.25,
      shadowRadius: 8,
      elevation: 12
    }
  })
};

export const animation = { short: 150, medium: 300, long: 500 };

export const buttons = {
  primary: { backgroundColor: colors.primary.main, padding: spacing.m, borderRadius: borderRadius.m, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', ...shadows.s },
  secondary: { backgroundColor: colors.primary.veryLight, padding: spacing.m, borderRadius: borderRadius.m, borderWidth: 1, borderColor: colors.primary.main, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  tertiary: { padding: spacing.m, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  danger: { backgroundColor: colors.accent.error, padding: spacing.m, borderRadius: borderRadius.m, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', ...shadows.s },
  disabled: { opacity: 0.6 }
};

export const buttonText = {
  primary: { color: colors.accent.white, fontSize: typography.size.l, fontWeight: typography.weight.semiBold },
  secondary: { color: colors.primary.main, fontSize: typography.size.l, fontWeight: typography.weight.semiBold },
  tertiary: { color: colors.primary.main, fontSize: typography.size.l, fontWeight: typography.weight.regular },
  danger: { color: colors.accent.white, fontSize: typography.size.l, fontWeight: typography.weight.semiBold }
};

export const inputs = {
  default: { borderWidth: 1, borderColor: colors.neutral.mediumBorder, borderRadius: borderRadius.s, padding: spacing.m, fontSize: typography.size.l, backgroundColor: colors.neutral.veryLightBackground, color: colors.text.primary },
  focused: { borderColor: colors.primary.main },
  error: { borderColor: colors.accent.error },
  disabled: { backgroundColor: colors.neutral.mediumBackground, opacity: 0.7 }
};

export const helperText = {
  default: { fontSize: typography.size.s, color: colors.text.secondary, marginTop: spacing.xs },
  error: { fontSize: typography.size.s, color: colors.accent.error, marginTop: spacing.xs }
};

export const cards = {
  default: { backgroundColor: colors.accent.white, borderRadius: borderRadius.s, padding: spacing.m, ...shadows.s },
  flat: { backgroundColor: colors.accent.white, borderRadius: borderRadius.s, padding: spacing.m, borderWidth: 1, borderColor: colors.neutral.lightBorder },
  elevated: { backgroundColor: colors.accent.white, borderRadius: borderRadius.s, padding: spacing.m, ...shadows.m }
};

export const headers = {
  screen: { height: 60, backgroundColor: colors.primary.main, paddingHorizontal: spacing.m, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', ...shadows.s },
  title: { fontSize: typography.size.xl, fontWeight: typography.weight.semiBold, color: colors.accent.white }
};

// FIXED: Helper function to get cross-platform shadow styles
export const getShadow = (size = 's') => {
  return shadows[size] || shadows.s;
};

// FIXED: Helper function specifically for web-safe shadows
export const getWebSafeShadow = (size = 's') => {
  const shadow = shadows[size] || shadows.s;
  
  if (Platform.OS === 'web') {
    // Return only boxShadow for web
    return { boxShadow: shadow.boxShadow };
  } else {
    // Return all shadow properties for native
    return shadow;
  }
};

// FIXED: Helper function to create custom web-safe shadows
export const createShadow = (offset = { width: 0, height: 2 }, opacity = 0.1, radius = 4, elevation = 2) => {
  return Platform.select({
    web: {
      boxShadow: `${offset.width}px ${offset.height}px ${radius}px rgba(0, 0, 0, ${opacity})`
    },
    default: {
      shadowColor: '#000',
      shadowOffset: offset,
      shadowOpacity: opacity,
      shadowRadius: radius,
      elevation: elevation
    }
  });
};

// FIXED: Helper function to remove deprecated shadow props for web
export const getCleanStyle = (style) => {
  if (Platform.OS !== 'web') {
    return style;
  }
  
  // For web, remove deprecated shadow properties
  const {
    shadowColor,
    shadowOffset,
    shadowOpacity,
    shadowRadius,
    elevation,
    ...cleanStyle
  } = style || {};
  
  return cleanStyle;
};

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
  getTypography,
  getShadow,
  getWebSafeShadow,
  createShadow,
  getCleanStyle
};