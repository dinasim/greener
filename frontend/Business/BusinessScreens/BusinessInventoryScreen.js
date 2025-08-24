import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  SectionList,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  Platform,
} from 'react-native';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getBusinessInventory } from '../services/businessApi';

const groupBy = (arr, keyGetter) => {
  const map = new Map();
  arr.forEach((item) => {
    const key = keyGetter(item);
    const list = map.get(key);
    if (list) list.push(item);
    else map.set(key, [item]);
  });
  return Array.from(map, ([title, data]) => ({ title, data }));
};

export default function BusinessInventoryScreen({ navigation, route }) {
  const { businessId: routeBizId } = route.params || {};

  const [businessId, setBusinessId] = useState(routeBizId || null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [inventory, setInventory] = useState([]);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    try {
      setError(null);
      setLoading(true);
      let id = routeBizId;
      if (!id) {
        const [email, storedBiz] = await Promise.all([
          AsyncStorage.getItem('userEmail'),
          AsyncStorage.getItem('businessId'),
        ]);
        id = storedBiz || email;
        setBusinessId(id);
      }
      if (!id) throw new Error('Business ID not found');

      const res = await getBusinessInventory(id);

      let items = [];
      if (Array.isArray(res)) items = res;
      else if (res?.inventory) items = res.inventory;
      else if (res?.data) items = res.data;

      items = (items || [])
        .filter((i) => (i?.status || 'active') === 'active')
        .map((i) => ({
          id: i.id || i._id || i.productId,
          name: i.name || i.common_name || i.productName || 'Unnamed',
          scientific_name: i.scientific_name,
          price: Number(i.finalPrice ?? i.price ?? 0),
          quantity: Number(i.quantity ?? 0),
          category: i.category || i.productType || 'Uncategorized',
          isLowStock: !!i.isLowStock,
          raw: i,
        }));

      setInventory(items);
    } catch (e) {
      console.error('Inventory load error:', e);
      setError(e.message || 'Failed to load inventory');
      setInventory([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [routeBizId]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    if (!search.trim()) return inventory;
    const q = search.trim().toLowerCase();
    return inventory.filter(
      (i) =>
        i.name.toLowerCase().includes(q) ||
        (i.scientific_name || '').toLowerCase().includes(q) ||
        (i.category || '').toLowerCase().includes(q)
    );
  }, [inventory, search]);

  const sections = useMemo(() => {
    const grouped = groupBy(filtered, (i) => i.category || 'Uncategorized');
    grouped.sort((a, b) => a.title.localeCompare(b.title));
    grouped.forEach((s) => s.data.sort((a, b) => a.name.localeCompare(b.name)));
    return grouped;
  }, [filtered]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const renderSectionHeader = ({ section }) => (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionHeaderChip}>
        <MaterialCommunityIcons name="shape" size={16} color="#216a94" />
        <Text style={styles.sectionHeaderText} numberOfLines={1}>
          {section.title}
        </Text>
      </View>
    </View>
  );

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={styles.itemRow}
      activeOpacity={0.75}
      onPress={() => {
        navigation.navigate?.('EditProductScreen', { product: item.raw });
      }}
    >
      {/* fixed-width gutter keeps rows aligned */}
      <View style={styles.itemLeftGutter}>
        <MaterialCommunityIcons
          name={item.category?.toLowerCase().includes('plant') ? 'leaf' : 'cube-outline'}
          size={22}
          color="#2e7d32"
        />
      </View>

      <View style={styles.itemBody}>
        <Text style={styles.itemName} numberOfLines={1}>
          {item.name}
        </Text>
        {!!item.scientific_name && (
          <Text style={styles.itemSci} numberOfLines={1}>
            {item.scientific_name}
          </Text>
        )}

        {/* single, stable line for price + stock */}
        <View style={styles.metaRow}>
          <Text style={styles.metaPrice} numberOfLines={1}>
            ₪{item.price.toFixed(2)}
          </Text>
          <Text style={styles.metaStock} numberOfLines={1}>
            Stock: {item.quantity}
          </Text>
        </View>
      </View>

      <View style={styles.chevronHitbox}>
        <MaterialIcons name="chevron-right" size={22} color="#b0bac5" />
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#216a94" />
          <Text style={styles.loadingText}>Loading inventory…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <MaterialIcons name="arrow-back" size={22} color="#216a94" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Inventory</Text>
        <TouchableOpacity onPress={onRefresh} style={styles.headerBtn}>
          <MaterialIcons name="refresh" size={22} color="#216a94" />
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchBar}>
        <MaterialIcons name="search" size={20} color="#7b8794" />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search products…"
          placeholderTextColor="#a0aec0"
          style={styles.searchInput}
          returnKeyType="search"
        />
        {!!search && (
          <TouchableOpacity onPress={() => setSearch('')} style={styles.clearBtn}>
            <MaterialIcons name="close" size={18} color="#8fa1b3" />
          </TouchableOpacity>
        )}
      </View>

      {/* Error */}
      {!!error && (
        <View style={styles.errorBox}>
          <MaterialIcons name="error-outline" size={18} color="#f44336" />
          <Text style={styles.errorText} numberOfLines={2}>
            {error}
          </Text>
        </View>
      )}

      {/* List */}
      <SectionList
        sections={sections}
        keyExtractor={(it) => String(it.id)}
        renderSectionHeader={renderSectionHeader}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        stickySectionHeadersEnabled={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#216a94']} tintColor="#216a94" />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <MaterialCommunityIcons name="package-variant-closed" size={54} color="#e2e8f0" />
            <Text style={styles.emptyText}>No inventory yet</Text>
          </View>
        }
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

/* ==== Design tokens (keeps proportions consistent) ==== */
const RADIUS = 12;
const PAD = 12;
const GAP = 8;
const ROW_MIN_HEIGHT = 76; // stable visual rhythm
const CONTROL = 44;        // touch target (search/header buttons)

const isWeb = Platform.OS === 'web';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f7fa' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { marginTop: 12, color: '#667085' },

  /* Header */
  header: {
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 56,
    borderBottomWidth: 1,
    borderBottomColor: '#edf2f7',
  },
  headerBtn: {
    width: CONTROL,
    height: CONTROL,
    borderRadius: 10,
    backgroundColor: '#eef5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    color: '#216a94',
    fontWeight: '800',
    fontSize: 18,
  },

  /* Search */
  searchBar: {
    marginHorizontal: 12,
    marginTop: 10,
    marginBottom: 6,
    paddingHorizontal: 12,
    height: CONTROL,
    borderRadius: RADIUS,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    flexDirection: 'row',
    alignItems: 'center',
    gap: GAP,
    ...(isWeb
      ? { boxShadow: '0 1px 2px rgba(16,24,40,0.05)' }
      : { elevation: 1, shadowColor: '#000', shadowOpacity: 0.05, shadowOffset: { width: 0, height: 1 }, shadowRadius: 2 }),
  },
  searchInput: { flex: 1, color: '#1f2937', fontSize: 15, paddingVertical: 0 },
  clearBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },

  /* Error */
  errorBox: {
    marginHorizontal: 12,
    marginBottom: 6,
    padding: 10,
    backgroundColor: '#fff5f5',
    borderLeftWidth: 3,
    borderLeftColor: '#f44336',
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  errorText: { color: '#9b2c2c', flex: 1, fontSize: 13 },

  /* List container */
  listContent: { paddingHorizontal: 10, paddingBottom: 24 },

  /* Section header */
  sectionHeader: {
    paddingTop: 14,
    paddingBottom: 6,
    paddingLeft: 16,
  },
  sectionHeaderChip: {
    alignSelf: 'flex-start',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#eef5f9',
    borderWidth: 1,
    borderColor: '#cfe3ef',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionHeaderText: {
    color: '#216a94',
    fontWeight: '700',
    fontSize: 12,
    maxWidth: 280,
  },

  /* Item row */
  itemRow: {
    marginHorizontal: 6,
    marginBottom: 10,
    backgroundColor: '#fff',
    borderRadius: RADIUS,
    borderWidth: 1,
    borderColor: '#edf2f7',
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: ROW_MIN_HEIGHT,
    paddingRight: 6,
    ...(isWeb
      ? { boxShadow: '0 1px 4px rgba(16,24,40,0.06)' }
      : { elevation: 1, shadowColor: '#000', shadowOpacity: 0.06, shadowOffset: { width: 0, height: 1 }, shadowRadius: 2 }),
  },
  itemLeftGutter: {
    width: 44,              // fixed gutter keeps alignment
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
    marginRight: 6,
  },
  itemBody: { flex: 1, minWidth: 0, paddingVertical: 8 },

  itemName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1f2937',
  },
  itemSci: {
    fontSize: 12,
    color: '#6b7280',
    fontStyle: 'italic',
    marginTop: 1,
  },

  /* Price + stock line (no wrapping) */
  metaRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  metaPrice: {
    fontSize: 16,
    fontWeight: '800',
    color: '#216a94',
    flexShrink: 0,
    maxWidth: '55%',
  },
  metaStock: {
    fontSize: 14,
    color: '#64748b',
    flexShrink: 0,
    minWidth: 92,          // stable width to avoid jitter
    textAlign: 'right',
    marginLeft: 8,
  },

  /* Chevron */
  chevronHitbox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },

  /* Empty */
  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { color: '#94a3b8', marginTop: 10 },
});
