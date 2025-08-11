import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';

const TABS = [
  { key: 'home',       label: 'Home',      icon: <MaterialIcons name="dashboard" size={22} color="#fff" /> },
  { key: 'inventory',  label: 'Inventory', icon: <MaterialIcons name="inventory" size={22} color="#fff" /> },
  { key: 'orders',     label: 'Orders',    icon: <MaterialIcons name="receipt-long" size={22} color="#fff" /> },
  { key: 'customers',  label: 'Customers', icon: <MaterialIcons name="people" size={22} color="#fff" /> },
  { key: 'water',      label: 'Watering',  icon: <MaterialCommunityIcons name="water" size={22} color="#fff" /> },
  { key: 'disease',    label: 'Disease',   icon: <MaterialCommunityIcons name="microscope" size={22} color="#fff" /> },
  { key: 'forum',      label: 'Forum',     icon: <MaterialCommunityIcons name="forum" size={22} color="#fff" /> },
];

export default function BusinessNavigationBar({
  currentTab = 'home',
  navigation,
  businessId,
  compact = false,          // set true for tight screens
  badges = {}               // e.g., { orders: 3, lowStock: 2 }
}) {
  const go = (key) => {
    switch (key) {
      case 'home':
        navigation.navigate('BusinessHomeScreen', { businessId }); break;
      case 'inventory':
        navigation.navigate('AddInventoryScreen', { businessId, showInventory: true }); break;
      case 'orders':
        navigation.navigate('BusinessOrdersScreen', { businessId }); break;
      case 'customers':
        navigation.navigate('BusinessCustomersScreen', { businessId }); break;
      case 'water':
        navigation.navigate('WateringChecklistScreen', { businessId }); break;
      case 'disease':
        navigation.navigate('DiseaseChecker',  { fromBusiness: true, businessId }); break;
      case 'forum':
        navigation.navigate('PlantCareForumScreen', { fromBusiness: true }); break;
      default:
        break;
    }
  };

  return (
    <View style={[styles.wrap, compact && { paddingVertical: 6 }]}>
      {TABS.map(tab => {
        const active = tab.key === currentTab;
        const badge = badges[tab.key];
        return (
          <TouchableOpacity
            key={tab.key}
            style={styles.item}
            onPress={() => go(tab.key)}
            activeOpacity={0.8}
          >
            <View style={[styles.iconWrap, active ? styles.iconActive : styles.iconIdle]}>
              {tab.icon}
              {!!badge && <View style={styles.badge}><Text style={styles.badgeText}>{badge}</Text></View>}
            </View>
            <Text style={[styles.label, active && styles.labelActive]} numberOfLines={1}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: Platform.OS === 'ios' ? 18 : 12,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    paddingVertical: 8,
    paddingHorizontal: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    borderWidth: 1,
    borderColor: '#e6eef6',
  },
  item: { alignItems: 'center', flex: 1 },
  iconWrap: {
    width: 38, height: 38, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 4,
  },
  iconIdle: { backgroundColor: '#9dbdda' },
  iconActive: { backgroundColor: '#216a94' },
  label: { fontSize: 11, color: '#5b6b7a', fontWeight: '600' },
  labelActive: { color: '#216a94' },
  badge: {
    position: 'absolute', top: -6, right: -6,
    minWidth: 16, height: 16, borderRadius: 8,
    backgroundColor: '#F44336', alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
});
