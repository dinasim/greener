// components/MapToggle.js
import React from 'react';
import { View, TouchableOpacity, StyleSheet, Text, Dimensions } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

const MapToggle = ({
  viewMode,
  onViewModeChange,
  style,
  compact = true,
  labels = 'auto', // 'auto' | 'text' | 'icons'
}) => {
  const width = Dimensions.get('window').width;
  const iconsOnly = labels === 'icons' || (labels === 'auto' && width < 380);

  const S = {
    icon: compact ? 16 : 20,
    fs: compact ? 12 : 14,
    padV: compact ? 6 : 8,
    padH: compact ? (iconsOnly ? 8 : 10) : 12,
    minW: iconsOnly ? 34 : undefined,
  };

  const Btn = ({ active, icon, label, mode }) => (
    <TouchableOpacity
      style={[
        styles.toggleButton,
        { paddingVertical: S.padV, paddingHorizontal: S.padH, minWidth: S.minW },
        active && styles.activeToggle,
        mode === 'map' && styles.mapButton,
      ]}
      onPress={() => viewMode !== mode && onViewModeChange(mode)}
      accessibilityRole="button"
      accessibilityLabel={`${label} View`}
      accessibilityState={{ selected: active }}
      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
      activeOpacity={0.85}
    >
      <MaterialIcons name={icon} size={S.icon} color={active ? '#4CAF50' : '#999'} />
      {!iconsOnly && (
        <Text style={[styles.toggleText, { fontSize: S.fs }, active && styles.activeToggleText]}>
          {label}
        </Text>
      )}
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, style]}>
      {/* grid/list segmented */}
      <View style={styles.viewToggles}>
        <Btn active={viewMode === 'grid'} icon="grid-view" label="Grid" mode="grid" />
        <Btn active={viewMode === 'list'} icon="view-list" label="List" mode="list" />
      </View>
      {/* map chip */}
      <Btn active={viewMode === 'map'} icon="map" label="Map" mode="map" />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  viewToggles: {
    flexDirection: 'row',
    borderWidth: 1, borderColor: '#ddd', borderRadius: 8, overflow: 'hidden',
  },
  toggleButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f5f5f5' },
  mapButton: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8 },
  activeToggle: { backgroundColor: '#e6f7e6' },
  toggleText: { color: '#999', marginLeft: 6 },
  activeToggleText: { color: '#4CAF50', fontWeight: '600' },
});

export default MapToggle;
