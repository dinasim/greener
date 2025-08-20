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

// Safe icon mapping → MaterialCommunityIcons glyphs only
const ICON_MAP = {
  'shopping-cart': 'cart',
  cart: 'cart',
  'attach-money': 'currency-ils',
  'currency-usd': 'currency-usd',
  'currency-ils': 'currency-ils',
  'cash': 'cash',
  'cash-multiple': 'cash-multiple',
  'request-quote': 'cash-multiple',
  'alert': 'alert-circle',
  'alert-circle': 'alert-circle',
  'check-circle': 'check-circle',
  'package-variant': 'package-variant',
  'account-group': 'account-group',
  'account-plus': 'account-plus',
  'star': 'star',
  'trending-up': 'trending-up',
  'trending-down': 'trending-down',
  'trending-flat': 'trending-neutral',
};
const getValidIconName = (name) => ICON_MAP[name] || 'chart-line';

// money helpers
const DEFAULT_CURRENCY = 'ILS';
const DEFAULT_SYMBOL = '₪';
const formatMoney = (val, currency = DEFAULT_CURRENCY, currencySymbol = DEFAULT_SYMBOL, locale) => {
  const n = Number(val) || 0;
  // Try Intl first
  try {
    const loc = locale || (currency === 'ILS' ? 'he-IL' : undefined);
    const out = new Intl.NumberFormat(loc, {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(n);
    // Some Androids show "ILS 1,234" → replace code with symbol if provided
    return out.replace(/ILS/gi, currencySymbol || DEFAULT_SYMBOL);
  } catch {
    // Fallback: simple prefix
    return `${currencySymbol || DEFAULT_SYMBOL}${Math.round(n).toLocaleString()}`;
  }
};

export default function KPIWidget({
  title = 'KPI',
  value = 0,
  change,
  icon = 'chart-line',
  color = '#216a94',            // app blue as default
  format = 'number',            // 'number' | 'currency' | 'percentage'
  subtitle,
  onPress,
  trend,
  isLoading = false,
  autoRefresh = false,
  currency = DEFAULT_CURRENCY,
  currencySymbol = DEFAULT_SYMBOL,
  locale,                       // optional
}) {
  // Animation refs
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1, duration: 600, useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.spring(scaleAnim, {
        toValue: 1, tension: 100, friction: 8, useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start();
  }, []);

  useEffect(() => {
    Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 1.1, duration: 150, useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(pulseAnim, { toValue: 1, duration: 150, useNativeDriver: Platform.OS !== 'web' }),
    ]).start();
  }, [value]);

  useEffect(() => {
    if (autoRefresh && isLoading) {
      const loop = Animated.loop(Animated.timing(rotateAnim, {
        toValue: 1, duration: 1000, useNativeDriver: Platform.OS !== 'web',
      }));
      loop.start();
      return () => loop.stop();
    }
  }, [autoRefresh, isLoading]);

  // Format value
  const formatValue = (val) => {
    const n = Number(val) || 0;
    if (format === 'currency') return formatMoney(n, currency, currencySymbol, locale);
    if (format === 'percentage') return `${n.toFixed(1)}%`;
    return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
  };

  const getTrendColor = () => (change === undefined || change === null) ? '#666' : (change >= 0 ? '#4CAF50' : '#f44336');
  const getTrendIcon  = () => (change === undefined || change === null) ? 'trending-flat' : (change >= 0 ? 'trending-up' : 'trending-down');

  const Widget = onPress ? TouchableOpacity : View;
  const rotateInterpolate = rotateAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const validIconName = getValidIconName(icon);

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
      <Widget style={[styles.widget, { borderLeftColor: color }]} onPress={onPress} activeOpacity={onPress ? 0.7 : 1}>
        <View style={styles.header}>
          <View style={[styles.iconContainer, { backgroundColor: color }]}>
            {isLoading && autoRefresh ? (
              <Animated.View style={{ transform: [{ rotate: rotateInterpolate }] }}>
                <MaterialIcons name="refresh" size={20} color="#fff" />
              </Animated.View>
            ) : (
              <MaterialCommunityIcons name={validIconName} size={20} color="#fff" />
            )}
          </View>

          {change !== undefined && change !== null && (
            <View style={styles.trendContainer}>
              <MaterialIcons name={getTrendIcon()} size={14} color={getTrendColor()} />
              <Text style={[styles.trendText, { color: getTrendColor() }]}>{Math.abs(change).toFixed(1)}%</Text>
            </View>
          )}
        </View>

        <Text style={styles.title}>{title}</Text>

        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
          <Text style={[styles.value, { color }]}>{formatValue(value)}</Text>
        </Animated.View>

        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}

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
  container: { flex: 1, minWidth: 120 },
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
    borderLeftColor: '#216a94', // overridden per-instance
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  iconContainer: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  trendContainer: { flexDirection: 'row', alignItems: 'center' },
  trendText: { fontSize: 12, fontWeight: '600', marginLeft: 2 },
  title: { fontSize: 12, color: '#666', marginBottom: 4, fontWeight: '500' },
  value: { fontSize: 20, fontWeight: '700', marginBottom: 2 },
  subtitle: { fontSize: 10, color: '#999', fontStyle: 'italic' },
  pressHint: { position: 'absolute', top: 8, right: 8, opacity: 0.5 },
});
