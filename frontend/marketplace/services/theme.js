// services/theme.js
export const colors = {
  primary: { main: '#4CAF50', dark: '#2E7D32', light: '#A5D6A7', veryLight: '#f0f9f0', medium: '#C8E6C9' },
  text: { primary: '#333', secondary: '#666', tertiary: '#999', light: '#777', extraLight: '#888', medium: '#555' },
  neutral: { lightBorder: '#eee', mediumBorder: '#ddd', darkBorder: '#e0e0e0', lightBackground: '#f5f5f5', veryLightBackground: '#f9f9f9', mediumBackground: '#f0f0f0' },
  accent: { error: '#f44336', warning: '#FFC107', gold: '#FFD700', white: '#fff', black: '#000' }
};
export const spacing = { xs: 4, s: 8, m: 16, l: 24, xl: 32, xxl: 48, xxxl: 64 };
export const typography = {
  size: { xs: 10, s: 12, m: 14, l: 16, xl: 18, xxl: 20, xxxl: 24, xxxxl: 32 },
  weight: { light: '300', regular: '400', medium: '500', semiBold: '600', bold: '700', extraBold: '800' },
  lineHeight: { tight: 1.2, normal: 1.5, loose: 1.8 },
  letterSpacing: { tight: -0.5, normal: 0, wide: 0.5, extraWide: 1.0 }
};
export const borderRadius = { xs: 4, s: 8, m: 16, l: 20, xl: 28, circle: 9999 };
export const shadows = {
  none: { shadowColor: 'transparent', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0, shadowRadius: 0, elevation: 0 },
  xs: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 1, elevation: 1 },
  s: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 },
  m: { shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 4 },
  l: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 6, elevation: 8 },
  xl: { shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 12 }
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
export default { colors, spacing, typography, borderRadius, shadows, animation, buttons, buttonText, inputs, helperText, cards, headers, getColor, getSpacing, getTypography };