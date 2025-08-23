// components/AppHeader.js
import React from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

const isWeb = Platform.OS === 'web';

export default function AppHeader({
  title = '',
  subtitle = '',
  showBack = false,
  onBack,
  right = null,
  showBrandWhenNoBack = true,
}) {
  return (
    <View style={styles.header}>
      {/* Left */}
      <View style={styles.left}>
        {showBack ? (
          <TouchableOpacity
            onPress={onBack}
            style={styles.backBtn}
            accessibilityLabel="Back"
            accessibilityRole="button"
          >
            <MaterialIcons name="arrow-back" size={24} color="#4CAF50" />
          </TouchableOpacity>
        ) : (
          showBrandWhenNoBack && (
            <View style={styles.brandRow}>
              <Image source={require('../assets/icon.png')} style={styles.logo} resizeMode="contain" />
              <Text style={styles.brand}>Greener</Text>
            </View>
          )
        )}
      </View>

      {/* Center */}
      <View style={styles.center}>
        {!!title && <Text numberOfLines={1} style={styles.title}>{title}</Text>}
        {!!subtitle && <Text numberOfLines={1} style={styles.subtitle}>{subtitle}</Text>}
      </View>

      {/* Right */}
      <View style={styles.right}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16, backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#e8f5e8', elevation: 2,
    ...(isWeb
      ? { boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }
      : {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
        }),
  },
  left: { width: 60, alignItems: 'flex-start', justifyContent: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', minWidth: 0 },
  right: { width: 60, alignItems: 'flex-end', justifyContent: 'center' },

  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  brandRow: { flexDirection: 'row', alignItems: 'center' },
  logo: { width: 36, height: 36, marginRight: 10 },
  brand: { fontSize: 24, fontWeight: 'bold', color: '#2e7d32' },

  title: { fontSize: 20, fontWeight: 'bold', color: '#2e7d32' },
  subtitle: { fontSize: 12, color: '#66bb6a', marginTop: 2 },
});
