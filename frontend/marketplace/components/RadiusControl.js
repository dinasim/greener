// components/RadiusControl.js
import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Animated,
  TextInput,
  Dimensions,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

/* ---------------------------------------------
   WebSlider: lightweight, RN Web–compatible slider
   (Mobile falls back to number input + quick chips)
---------------------------------------------- */
const WebSlider = ({
  value,
  minimumValue = 1,
  maximumValue = 100,
  step = 0.5,
  onValueChange,
  onSlidingComplete,
}) => {
  if (Platform.OS === 'web') {
    return (
      <input
        type="range"
        min={minimumValue}
        max={maximumValue}
        step={step}
        value={value}
        onChange={(e) => onValueChange?.(parseFloat(e.target.value))}
        onMouseUp={() => onSlidingComplete?.(value)}
        onTouchEnd={() => onSlidingComplete?.(value)}
        style={{
          width: '100%',
          height: 36,
          background: 'transparent',
          outline: 'none',
          cursor: 'pointer',
        }}
      />
    );
  }

  // Mobile: show nothing here (we render text input + quick chips below)
  return null;
};

/* ---------------------------------------------
   Pretty “chip” for quick radius presets
---------------------------------------------- */
const RadiusChip = ({ label, selected, onPress }) => (
  <TouchableOpacity
    onPress={onPress}
    style={[
      styles.chip,
      selected && styles.chipSelected,
    ]}
    activeOpacity={0.8}
  >
    <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
  </TouchableOpacity>
);

/* ---------------------------------------------
   RadiusControl
---------------------------------------------- */
const RadiusControl = ({
  radius = 10,
  onRadiusChange,
  onApply,
  products = [],
  isLoading = false,
  error = null,
  onProductSelect,
  onViewModeChange, // ✅ MapScreen passes onViewModeChange
  style,
  dataType = 'plants', // 'plants' | 'businesses' (for copy)
}) => {
  const prettyType = dataType === 'businesses' ? 'businesses' : 'plants';

  const [inputValue, setInputValue] = useState(String(radius || 10));
  const [sliderValue, setSliderValue] = useState(radius || 10);
  const [validationError, setValidationError] = useState('');
  const [expanded, setExpanded] = useState(true);

  // Animation
  const MIN_H = 120;
  const MAX_H = 420;
  const heightAnim = useRef(new Animated.Value(MAX_H)).current;
  const arrowAnim = useRef(new Animated.Value(0)).current; // 0=up, 1=down

  // Keep in sync with external radius
  useEffect(() => {
    const v = Number(radius) || 10;
    setInputValue(String(v));
    setSliderValue(v);
  }, [radius]);

  const applyRadius = (val) => {
    const v = Math.max(1, Math.min(100, Number(val) || 10));
    onRadiusChange?.(v);
    onApply?.(v);
  };

  const handleApply = () => {
    const v = Number(inputValue);
    if (!Number.isFinite(v) || v < 1) {
      setValidationError('Please enter a valid radius (1–100 km).');
      return;
    }
    if (v > 100) {
      setValidationError('Maximum radius is 100 km.');
      return;
    }
    setValidationError('');
    applyRadius(v);
  };

  const handleSliderChange = (v) => {
    const rounded = Math.round(v * 10) / 10;
    setSliderValue(rounded);
    setInputValue(String(rounded));
    setValidationError('');
  };

  const handleSliderComplete = (v) => applyRadius(v);

  const quickValues = useMemo(() => [5, 10, 25, 50, 100], []);
  const isSelectedQuick = (v) => Math.abs(Number(inputValue) - v) < 0.001;

  const pickQuick = (v) => {
    setInputValue(String(v));
    setSliderValue(v);
    setValidationError('');
    applyRadius(v);
  };

  const toggleExpanded = () => {
    const next = !expanded;
    setExpanded(next);
    Animated.spring(heightAnim, {
      toValue: next ? MAX_H : MIN_H,
      useNativeDriver: false,
      damping: 18,
      stiffness: 140,
      mass: 0.8,
    }).start();
    Animated.timing(arrowAnim, {
      toValue: next ? 0 : 1,
      duration: 220,
      useNativeDriver: true,
    }).start();
  };

  const arrowRotate = arrowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  const headerSubtitle =
    products.length > 0
      ? `${products.length} ${prettyType} within ${radius} km`
      : `No ${prettyType} within ${radius} km`;

  const EmptyList = () => {
    if (isLoading) {
      return (
        <View style={styles.emptyWrap}>
          <ActivityIndicator size="small" color="#2E7D32" />
          <Text style={styles.emptyText}>Searching nearby {prettyType}…</Text>
        </View>
      );
    }
    if (error) {
      return (
        <View style={styles.emptyWrap}>
          <MaterialIcons name="error-outline" size={22} color="#d32f2f" />
          <Text style={[styles.emptyText, { color: '#d32f2f' }]}>{error}</Text>
        </View>
      );
    }
    return (
      <View style={styles.emptyWrap}>
        <MaterialIcons name={prettyType === 'plants' ? 'eco' : 'store-mall-directory'} size={24} color="#BDBDBD" />
        <Text style={styles.emptyText}>No {prettyType} found.</Text>
        <Text style={styles.emptySub}>Try increasing the radius.</Text>
      </View>
    );
  };

  return (
    <Animated.View style={[styles.container, { height: heightAnim }, style]}>
      {/* Header */}
      <TouchableOpacity activeOpacity={0.9} onPress={toggleExpanded} style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <MaterialIcons name="radio-button-checked" size={20} color="#2E7D32" />
          <Text style={styles.headerTitle}>Search Radius</Text>
          <View style={styles.pill}>
            <Text style={styles.pillText}>{radius} km</Text>
          </View>
        </View>

        <View style={styles.headerRight}>
          <Text style={styles.subtitle} numberOfLines={1}>{headerSubtitle}</Text>
          <Animated.View style={{ transform: [{ rotate: arrowRotate }] }}>
            <MaterialIcons name="keyboard-arrow-up" size={24} color="#667085" />
          </Animated.View>
        </View>
      </TouchableOpacity>

      {/* Controls */}
      <View style={styles.controls}>
        {/* Web slider */}
        <WebSlider
          value={sliderValue}
          minimumValue={1}
          maximumValue={100}
          step={0.5}
          onValueChange={handleSliderChange}
          onSlidingComplete={handleSliderComplete}
        />
        <View style={styles.scaleRow}>
          <Text style={styles.scaleLabel}>1 km</Text>
          <Text style={styles.scaleLabel}>100 km</Text>
        </View>

        {/* Mobile input + quick chips (also shown on web for quick picks) */}
        <View style={styles.inputRow}>
          <View style={styles.inputWrap}>
            <TextInput
              style={styles.input}
              value={inputValue}
              onChangeText={(t) => {
                const cleaned = t.replace(/[^0-9.]/g, '');
                setInputValue(cleaned);
                setValidationError('');
              }}
              keyboardType="numeric"
              returnKeyType="done"
              maxLength={5}
              placeholder="10"
              onBlur={handleApply}
            />
            <Text style={styles.unit}>km</Text>
          </View>

          <TouchableOpacity onPress={handleApply} style={styles.applyBtn} activeOpacity={0.9}>
            <Text style={styles.applyText}>Apply</Text>
          </TouchableOpacity>
        </View>

        {validationError ? <Text style={styles.errorText}>{validationError}</Text> : null}

        <View style={styles.chipsRow}>
          {quickValues.map((v) => (
            <RadiusChip
              key={v}
              label={`${v} km`}
              selected={isSelectedQuick(v)}
              onPress={() => pickQuick(v)}
            />
          ))}
        </View>
      </View>

      {/* List header + "List View" action */}
      {expanded && (
        <View style={styles.listHeader}>
          <Text style={styles.listTitle} numberOfLines={1}>
            {products.length > 0
              ? `${products.length} ${prettyType} within ${radius} km`
              : `No ${prettyType} in this area`}
          </Text>

          <TouchableOpacity
            onPress={() => onViewModeChange?.()}
            style={styles.listBtn}
            activeOpacity={0.9}
          >
            <MaterialIcons name="view-list" size={18} color="#fff" />
            <Text style={styles.listBtnText}>List View</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Results */}
      {expanded && (
        <View style={styles.results}>
          {products.length > 0 ? (
            <FlatList
              data={products}
              keyExtractor={(item) => item.id || item._id || String(item._key || Math.random())}
              ItemSeparatorComponent={() => <View style={styles.sep} />}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.card}
                  activeOpacity={0.85}
                  onPress={() => onProductSelect?.(item.id || item._id)}
                >
                  <View style={styles.cardLeft}>
                    <Text style={styles.cardTitle} numberOfLines={1}>
                      {item.title || item.name || 'Item'}
                    </Text>
                    <View style={styles.metaRow}>
                      <MaterialIcons name="place" size={13} color="#757575" />
                      <Text numberOfLines={1} style={styles.metaText}>
                        {item.location?.city || item.city || 'Unknown'}
                      </Text>
                      {Number.isFinite(item.distance) && (
                        <Text style={styles.dot}>•</Text>
                      )}
                      {Number.isFinite(item.distance) && (
                        <Text style={styles.metaText}>{Number(item.distance).toFixed(1)} km</Text>
                      )}
                    </View>
                  </View>
                  <View style={styles.cardRight}>
                    <Text style={styles.priceText}>
                      {item.price != null ? `$${Number(item.price).toFixed(2)}` : ''}
                    </Text>
                    <MaterialIcons name="chevron-right" size={22} color="#BDBDBD" />
                  </View>
                </TouchableOpacity>
              )}
              contentContainerStyle={{ paddingBottom: 8 }}
            />
          ) : (
            <EmptyList />
          )}
        </View>
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    elevation: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    overflow: 'hidden',
  },

  /* Header */
  headerRow: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomColor: '#F0F2F4',
    borderBottomWidth: 1,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  headerTitle: { marginLeft: 8, fontSize: 16, fontWeight: '700', color: '#1F2937' },
  pill: {
    marginLeft: 8,
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  pillText: { color: '#2E7D32', fontWeight: '700', fontSize: 12 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  subtitle: { color: '#667085', fontSize: 12, marginRight: 6, maxWidth: width * 0.4 },

  /* Controls */
  controls: { paddingHorizontal: 16, paddingTop: 12 },
  scaleRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  scaleLabel: { fontSize: 11, color: '#9AA0A6' },

  inputRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 12 },
  inputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    backgroundColor: '#FAFAFA',
  },
  input: { flex: 1, fontSize: 16, color: '#111827', paddingVertical: Platform.OS === 'ios' ? 10 : 8 },
  unit: { marginLeft: 6, color: '#6B7280', fontSize: 15 },
  applyBtn: {
    backgroundColor: '#2E7D32',
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 12,
    elevation: 2,
  },
  applyText: { color: '#fff', fontWeight: '700', fontSize: 15, letterSpacing: 0.2 },

  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#F3F4F6',
  },
  chipSelected: { backgroundColor: '#E8F5E9', borderWidth: 1, borderColor: '#A5D6A7' },
  chipText: { fontSize: 13, color: '#4B5563', fontWeight: '600' },
  chipTextSelected: { color: '#1B5E20' },

  errorText: { color: '#d32f2f', fontSize: 12, marginTop: 6 },

  /* List */
  listHeader: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopColor: '#F0F2F4',
    borderTopWidth: 1,
  },
  listTitle: { flex: 1, fontSize: 14, fontWeight: '700', color: '#1F2937', paddingRight: 8 },
  listBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2E7D32',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    gap: 6,
  },
  listBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  results: { flex: 1 },
  sep: { height: 1, backgroundColor: '#F3F4F6', marginLeft: 16 },

  card: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardLeft: { flex: 1 },
  cardRight: { alignItems: 'flex-end', gap: 4 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#111827' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3, maxWidth: width - 140 },
  metaText: { fontSize: 12, color: '#6B7280' },
  dot: { color: '#9AA0A6', marginHorizontal: 2, fontSize: 12 },
  priceText: { color: '#2E7D32', fontWeight: '800', fontSize: 14 },

  /* Empty */
  emptyWrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: 28, gap: 8 },
  emptyText: { fontSize: 14, color: '#667085' },
  emptySub: { fontSize: 12, color: '#9AA0A6' },
});

export default RadiusControl;
