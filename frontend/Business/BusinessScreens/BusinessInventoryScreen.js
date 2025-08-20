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

      // Normalize + filter out inactive
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
    // sort categories by name
    grouped.sort((a, b) => a.title.localeCompare(b.title));
    // sort items within each category by name
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
      activeOpacity={0.7}
      onPress={() => {
        // navigate to edit/details if you have it
        navigation.navigate?.('EditProductScreen', { product: item.raw });
      }}
    >
      <View style={styles.itemLeftGutter}>
        <MaterialCommunityIcons
          name={item.category?.toLowerCase().includes('plant') ? 'leaf' : 'cube-outline'}
          size={20}
          color="#4CAF50"
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

        {/* THE IMPORTANT BIT: single-line price + stock row */}
        <View style={styles.metaRow}>
          <Text style={styles.metaPrice} numberOfLines={1}>
            ₪{item.price.toFixed(2)}
          </Text>
          <Text style={styles.metaStock} numberOfLines={1}>
            Stock: {item.quantity}
          </Text>
        </View>
      </View>

      <MaterialIcons name="chevron-right" size={22} color="#c0c6cc" />
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
          placeholder="Search name, scientific name, or category…"
          placeholderTextColor="#a0aec0"
          style={styles.searchInput}
        />
        {!!search && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <MaterialIcons name="close" size={18} color="#a0aec0" />
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f7fa' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { marginTop: 12, color: '#667085' },

  header: {
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#edf2f7',
  },
  headerBtn: {
    padding: 8,
    borderRadius: 10,
    backgroundColor: '#eef5f9',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    color: '#216a94',
    fontWeight: '700',
    fontSize: 18,
  },

  searchBar: {
    margin: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchInput: { flex: 1, color: '#1f2937', fontSize: 15 },

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

  listContent: {
    paddingHorizontal: 8,
    paddingBottom: 20,
  },

  // CATEGORY HEADER with clean indent
  sectionHeader: {
    paddingTop: 16,
    paddingBottom: 8,
    paddingLeft: 16, // header left pad
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
    fontSize: 13,
    maxWidth: 280,
  },

  // ITEM ROW neatly indented under header
  itemRow: {
    marginHorizontal: 10,
    marginBottom: 8,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#edf2f7',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingRight: 10,
    // subtle elevation
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  // left “gutter” ensures visual indent from header
  itemLeftGutter: {
    width: 28,
    alignItems: 'center',
    marginLeft: 16, // actual indent from the screen edge
    marginRight: 8,
  },
  itemBody: {
    flex: 1,
    minWidth: 0, // allow text to ellipsize
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  itemSci: {
    fontSize: 13,
    color: '#6b7280',
    fontStyle: 'italic',
    marginTop: 2,
  },

  // *** CRITICAL LAYOUT FIX ***
  // keep on one line, baseline aligned, no wrapping
  metaRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    flexWrap: 'nowrap',
    width: '100%',
    marginTop: 6,
  },
  metaPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: '#216a94',
    flexShrink: 0,
    marginRight: 8,
  },
  metaStock: {
    fontSize: 14,
    color: '#64748b',
    flexShrink: 0,
    marginLeft: 8,
    textAlign: 'right',
    minWidth: 90, // keeps it from collapsing and wrapping
  },

  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { color: '#94a3b8', marginTop: 10 },
});
