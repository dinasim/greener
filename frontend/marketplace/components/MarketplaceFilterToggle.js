// components/MarketplaceFilterToggle.js - COMPACT & EQUAL WIDTH
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';

const GREEN = '#2e7d32';
const BORDER = '#DDE7DD';
const INACTIVE_TEXT = '#444';
const INACTIVE_ICON = '#777';

const MarketplaceFilterToggle = ({
  sellerType,
  onSellerTypeChange,
  style,
}) => {
  const width = Dimensions.get('window').width;
  const narrow = width < 370;      // shrink a bit more on small phones

  const HEIGHT     = narrow ? 34 : 36;
  const ICON       = narrow ? 14 : 16;
  const FS_LABEL   = narrow ? 13 : 14;
  const FS_COUNT   = narrow ? 11 : 12;

  const labelIndividual = narrow ? 'Indiv.' : 'Individual';
  const labelBusiness   = narrow ? 'Business' : 'Business';

  const handlePress = (type) => {
    if (type !== sellerType) onSellerTypeChange?.(type);
  };

  const fmt = (n) => (n == null ? '0' : n > 999 ? `${Math.floor(n / 1000)}k+` : String(n));

  const Chip = ({ active, onPress, icon, label, count }) => (
    <TouchableOpacity
      style={[styles.chip, { height: HEIGHT }, active && styles.chipActive]}
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      {icon(ICON, active ? GREEN : INACTIVE_ICON)}
      <Text
        numberOfLines={1}
        ellipsizeMode="tail"
        style={[
          styles.label,
          { fontSize: FS_LABEL, color: active ? GREEN : INACTIVE_TEXT },
        ]}
      >
        {label}{' '}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, style]}>
      <View style={styles.row}>
        <Chip
          active={sellerType === 'all'}
          onPress={() => handlePress('all')}
          icon={(s, c) => <MaterialIcons name="apps" size={s} color={c} />}
          label="All"
        />
        <Chip
          active={sellerType === 'individual'}
          onPress={() => handlePress('individual')}
          icon={(s, c) => <MaterialIcons name="person" size={s} color={c} />}
          label={labelIndividual}
        />
        <Chip
          active={sellerType === 'business'}
          onPress={() => handlePress('business')}
          icon={(s, c) => <MaterialCommunityIcons name="store" size={s} color={c} />}
          label={labelBusiness}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chip: {
    flex: 1,                      // equal widths
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 10,
  },
  chipActive: {
    backgroundColor: '#E8F6ED',
    borderColor: '#CBE6CF',
  },
  label: {
    marginLeft: 8,
    fontWeight: '700',
    includeFontPadding: false,
  },
  count: {
    color: '#7aa87a',
    fontWeight: '600',
  },
});

export default MarketplaceFilterToggle;
