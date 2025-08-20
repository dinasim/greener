// Business/BusinessScreens/BusinessInsightsScreen.js
// Blue theme, robust matching (id/sku/name/scientific + fuzzy), no duplicate sections
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Platform,
  Animated,
  RefreshControl,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

import BusinessLayout from '../components/BusinessLayout';
import KPIWidget from '../components/KPIWidget';
import TopSellingProductsList from '../components/TopSellingProductsList';

import AsyncStorage from '@react-native-async-storage/async-storage';

// Primary analytics service (may be flaky)
import { getBusinessAnalytics, createAnalyticsStream } from '../services/businessAnalyticsApi';
// Stable fallbacks
import { getBusinessDashboard, getBusinessInventory } from '../services/businessApi';
import { getBusinessOrders } from '../services/businessOrderApi';

const PRIMARY = '#216a94'; // app blue
const WARN = '#FF9800';
const DANGER = '#F44336';
const MUTED = '#9E9E9E';

const CURRENCY = 'ILS';
const CURRENCY_SYMBOL = '₪';
const fmt = (v) => `${CURRENCY_SYMBOL}${(Number(v) || 0).toFixed(2)}`;
const toNum = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const TF_DAYS = { week: 7, month: 30, quarter: 90, year: 365 };

// ---------- string helpers ----------
const normalize = (s = '') =>
  String(s)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const tokenize = (s = '') => new Set(normalize(s).split(' ').filter(Boolean));

const jaccard = (aSet, bSet) => {
  if (!aSet.size || !bSet.size) return 0;
  let inter = 0;
  aSet.forEach(t => { if (bSet.has(t)) inter += 1; });
  const union = aSet.size + bSet.size - inter;
  return union ? inter / union : 0;
};

/** Robust key builder for any object that might be an inventory item or an order-line */
const makeKey = (obj = {}) => {
  const id = obj.productId || obj.id || obj._id || obj.sku;
  const nm = obj.name || obj.title || obj.common_name;
  const sci = obj.scientific_name || obj?.plantData?.scientific_name;
  return (id && String(id)) || normalize(nm) || normalize(sci) || '';
};

export default function BusinessInsightsScreen({ navigation, route }) {
  const initialTab = route?.params?.tab || 'sales';
  const initialTf = route?.params?.timeframe || 'month';
  const [activeTab, setActiveTab] = useState(initialTab);
  const [timeframe, setTimeframe] = useState(initialTf);
  const [salesSortBy, setSalesSortBy] = useState('totalRevenue'); // Sales tab segment

  const [bizId, setBizId] = useState(route?.params?.businessId || null);
  const [data, setData] = useState(null);
  const [invInsights, setInvInsights] = useState(null);
  const [salesExtras, setSalesExtras] = useState(null);

  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    (async () => {
      if (!bizId) {
        const stored = await AsyncStorage.getItem('businessId');
        setBizId(stored || null);
      }
    })();
  }, []);

  useEffect(() => {
    loadData();
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 250,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, timeframe, bizId]);

  useEffect(() => {
    if (!bizId) return;
    let timer;
    try {
      if (typeof createAnalyticsStream === 'function') {
        const stop = createAnalyticsStream(timeframe, () => loadData(true), () => { }, 60000);
        return () => stop && stop();
      }
      timer = setInterval(() => loadData(true), 60000);
    } catch {
      timer = setInterval(() => loadData(true), 60000);
    }
    return () => timer && clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, timeframe, bizId]);

  // ---------- Normalizers ----------
  const normalizeFromDashboard = (dash) => {
    const metrics = dash?.metrics || {};
    const chart = dash?.chartData || {};

    const salesVals = Array.isArray(chart?.sales?.values) ? chart.sales.values.map(toNum) : [];
    let total = toNum(chart?.sales?.total);
    if (!total) total = salesVals.reduce((s, v) => s + v, 0);
    const avg = salesVals.length ? total / salesVals.length : 0;

    return {
      kpis: [
        // NOTE: icon names are MaterialCommunityIcons to avoid "?" glyphs inside KPIWidget
        { title: 'Total Revenue', value: total || toNum(metrics.totalSales), icon: 'currency-ils', color: PRIMARY, format: 'currency', currency: CURRENCY, currencySymbol: CURRENCY_SYMBOL },
        { title: 'Total Orders', value: toNum(metrics.totalOrders) || toNum(chart?.orders?.total), icon: 'cart', color: PRIMARY, format: 'number' },
        { title: 'Avg Order Value', value: (toNum(metrics.totalOrders) ? total / (toNum(metrics.totalOrders) || 1) : toNum(chart?.sales?.aov)), icon: 'cash-multiple', color: PRIMARY, format: 'currency', currency: CURRENCY, currencySymbol: CURRENCY_SYMBOL },
        { title: 'Customers', value: toNum(dash?.customers?.totalCustomers), icon: 'account-group', color: PRIMARY, format: 'number' },
      ],
      chartData: {
        sales: { labels: chart?.sales?.labels || [], values: salesVals, total, average: avg },
        orders: chart?.orders || { pending: 0, confirmed: 0, ready: 0, completed: 0, total: toNum(metrics.totalOrders) },
        inventory: chart?.inventory || { inStock: 0, lowStock: 0, outOfStock: 0 },
      },
      topProducts: dash?.topProducts || [],
      topCustomers: dash?.topCustomers || [],
      currency: dash?.currency || CURRENCY,
      generatedAt: dash?.generatedAt || new Date().toISOString(),
      fromCache: false,
    };
  };

  const normalizeFromAnalytics = (api) => {
    const sales = api?.sales || {};
    const inv = api?.inventory || {};
    const cust = api?.customers || {};

    const salesVals = Array.isArray(sales.weeklyValues) ? sales.weeklyValues.map(toNum) : [];
    let total = toNum(sales.totalRevenue);
    if (!total) total = salesVals.reduce((s, v) => s + v, 0);
    const avg = salesVals.length ? total / salesVals.length : 0;

    return {
      kpis: [
        { title: 'Total Revenue', value: total, icon: 'currency-ils', color: PRIMARY, format: 'currency', currency: CURRENCY, currencySymbol: CURRENCY_SYMBOL },
        { title: 'Total Orders', value: toNum(sales.totalOrders), icon: 'cart', color: PRIMARY, format: 'number' },
        { title: 'Avg Order Value', value: toNum(sales.averageOrderValue) || (toNum(sales.totalOrders) ? total / toNum(sales.totalOrders) : 0), icon: 'cash-multiple', color: PRIMARY, format: 'currency', currency: CURRENCY, currencySymbol: CURRENCY_SYMBOL },
        { title: 'Customers', value: toNum(cust.totalCustomers), icon: 'account-group', color: PRIMARY, format: 'number' },
      ],
      chartData: {
        sales: { labels: sales.weeklyLabels || [], values: salesVals, total, average: avg },
        orders: {
          pending: toNum(sales.pendingOrders),
          confirmed: toNum(sales.confirmedOrders),
          ready: toNum(sales.readyOrders),
          completed: toNum(sales.completedOrders),
          total: toNum(sales.totalOrders),
        },
        inventory: {
          inStock: toNum(inv.inStockItems),
          lowStock: toNum(inv.lowStockItems),
          outOfStock: toNum(inv.outOfStockItems),
        },
      },
      topProducts: Array.isArray(sales.topProducts) ? sales.topProducts : [],
      topCustomers: Array.isArray(cust.topCustomers) ? cust.topCustomers : [],
      currency: api?.currency || CURRENCY,
      generatedAt: api?.generatedAt || new Date().toISOString(),
      fromCache: false,
    };
  };

  // ---------- Customers enrichment ----------
  const fetchCustomersService = async () => {
    const userEmail = await AsyncStorage.getItem('userEmail');
    const authToken = await AsyncStorage.getItem('googleAuthToken');

    if (!userEmail) return [];

    const headers = { 'Content-Type': 'application/json', 'X-User-Email': userEmail };
    if (authToken) headers.Authorization = `Bearer ${authToken}`;

    const res = await fetch('https://usersfunctions.azurewebsites.net/api/business/customers', { method: 'GET', headers });
    if (!res.ok) return [];
    const json = await res.json();
    if (!json?.success) return [];
    return json.customers || [];
  };

  const computeCustomersFromOrders = (orders) => {
    const map = new Map();
    (orders || []).forEach((o) => {
      if (o?.status !== 'completed') return;
      if (!o?.customerEmail && !o?.customerName) return;
      const key = (o.customerEmail || o.customerName).toLowerCase();
      if (!map.has(key)) {
        map.set(key, {
          name: o.customerName || 'Customer',
          email: o.customerEmail || '',
          orders: 0,
          spent: 0,
        });
      }
      const c = map.get(key);
      c.orders += 1;
      c.spent += toNum(o.total);
    });
    return Array.from(map.values()).sort((a, b) => b.spent - a.spent).slice(0, 20);
  };

  const computeSalesExtras = (orders, tf = 'month') => {
    const days = TF_DAYS[tf] || 30;
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    const filtered = (orders || []).filter(o => o?.status === 'completed' && new Date(o.completedAt || o.createdAt || o.updatedAt || Date.now()).getTime() >= cutoff);

    let revenue = 0, orderCount = 0, itemsSold = 0;
    const weekday = Array(7).fill(0); // 0..6
    filtered.forEach(o => {
      const when = new Date(o.completedAt || o.createdAt || o.updatedAt || Date.now());
      const dow = when.getDay();
      revenue += toNum(o.total);
      orderCount += 1;
      (o.items || []).forEach(it => { itemsSold += toNum(it.quantity || 1); });
      weekday[dow] += toNum(o.total);
    });

    const aov = orderCount ? revenue / orderCount : 0;
    return { revenue, orderCount, itemsSold, aov, weekday };
  };

  /** Inventory analytics with robust identity matching + ONLY completed orders */
  const buildInventoryInsights = (inventory, orders) => {
    const inv = Array.isArray(inventory) ? inventory : [];
    const ord = Array.isArray(orders) ? orders.filter(o => o?.status === 'completed') : [];

    const now = Date.now();
    const d30 = now - 30 * 24 * 60 * 60 * 1000;
    const d60 = now - 60 * 24 * 60 * 60 * 1000;

    // Index any way we might find an item, but also keep a canonical key (normalized name)
    const index = new Map();          // anyKey -> { name, qty, min, price, canon }
    const canonMeta = new Map();      // canon -> meta (latest wins)
    const allKeys = [];

    inv.forEach(i => {
      const meta = {
        name: i.name || i.title || i.common_name || i?.plantData?.common_name || 'Item',
        qty: toNum(i.quantity),
        min: toNum(i.minThreshold) || 5,
        price: toNum(i.price),
      };
      const canon = normalize(meta.name);
      const keys = new Set([
        String(i.id || i._id || i.sku || ''),
        normalize(i.name || i.title || i.common_name),
        normalize(i?.plantData?.scientific_name || i.scientific_name || ''),
        normalize(i.sku || ''),
      ].filter(Boolean));

      keys.forEach(k => {
        index.set(k, { ...meta, canon });
        allKeys.push({ k, tokens: tokenize(k) });
      });
      canonMeta.set(canon, meta); // store one row per physical item
    });

    // Helper: resolve an order item to our canonical key
    const resolveCanon = (item) => {
      const direct = [
        String(item.productId || item.id || item._id || item.sku || ''),
        normalize(item.name || item.title || item.common_name || ''),
        normalize(item.scientific_name || ''),
      ].filter(Boolean);

      for (const k of direct) {
        if (index.has(k)) return index.get(k).canon;
      }

      // fuzzy by tokens
      const candTokens = tokenize(item.name || item.title || item.common_name || item.scientific_name || '');
      let best = { canon: null, score: 0 };
      for (const { k, tokens } of allKeys) {
        const score = jaccard(candTokens, tokens);
        if (score > best.score) best = { canon: index.get(k)?.canon || null, score };
      }
      return best.score >= 0.6 ? best.canon : null;
    };

    const recentCount = new Map(); // canon -> qty sold in 30d
    const lastSale = new Map(); // canon -> last timestamp

    ord.forEach(o => {
      const when = new Date(o.completedAt || o.createdAt || o.updatedAt || now).getTime();
      (o.items || []).forEach(it => {
        const canon = resolveCanon(it);
        if (!canon) return;
        const qty = toNum(it.quantity || 1);
        if (when >= d30) recentCount.set(canon, (recentCount.get(canon) || 0) + qty);
        if (!lastSale.has(canon) || when > lastSale.get(canon)) lastSale.set(canon, when);
      });
    });

    const lowStock = [];
    const outOfStock = [];
    const fastMovers = [];
    const deadStock = [];

    // one pass over *canonical* items only
    canonMeta.forEach((meta, canon) => {
      const recent = recentCount.get(canon) || 0;
      const last = lastSale.get(canon);

      if (meta.qty <= meta.min && meta.qty > 0) {
        lowStock.push({ name: meta.name, quantity: meta.qty, minThreshold: meta.min, price: meta.price });
      }
      if (meta.qty === 0) {
        +   outOfStock.push({
          name: meta.name,
          quantity: 0,
          minThreshold: meta.min,
          price: meta.price,
        });
      }
      if (recent > 0) {
        fastMovers.push({ name: meta.name, recentSales: recent, stock: meta.qty, price: meta.price });
      } else if (meta.qty > 0 && (!last || last < d60)) {
        deadStock.push({ name: meta.name });
      }
    });

    fastMovers.sort((a, b) => b.recentSales - a.recentSales);
    const valueAtRisk = lowStock.reduce((s, i) => s + toNum(i.price) * toNum(i.quantity), 0);

    const reorderSuggestions = [...lowStock, ...outOfStock];
    return {
      lowStock,
      outOfStock,
      fastMovers: fastMovers.slice(0, 5),
      deadStock: deadStock.slice(0, 5),
      valueAtRisk,
      counts: { total: inv.length, low: lowStock.length, oos: outOfStock.length },
      reorderSuggestions,
    };
  };


  // ---------- Load ----------
  const loadData = async (silent = false) => {
    if (!bizId) return;
    try {
      if (!silent) setIsLoading(true);
      setError(null);

      // try analytics first
      let response;
      try {
        response = await getBusinessAnalytics(bizId, timeframe);
      } catch {
        try {
          response = await getBusinessAnalytics(timeframe, 'all', false);
        } catch {
          response = null;
        }
      }

      let formatted;
      if (response && (response.data || response.sales || response.inventory)) {
        const apiData = response.data || response;
        formatted = normalizeFromAnalytics(apiData);
      } else {
        const dashboard = await getBusinessDashboard(bizId);
        formatted = normalizeFromDashboard(dashboard);
      }

      // customers enrichment
      try {
        const svcCustomers = await fetchCustomersService();
        if (svcCustomers?.length) {
          formatted.topCustomers = svcCustomers
            .sort((a, b) => (b.totalSpent || 0) - (a.totalSpent || 0))
            .slice(0, 10)
            .map((c) => ({ name: c.name || c.email || 'Customer', orders: c.orderCount || 0, spent: toNum(c.totalSpent || 0) }));
        } else {
          const orders = await getBusinessOrders(bizId);
          const ordersArr = orders?.orders || orders || [];
          formatted.topCustomers = computeCustomersFromOrders(ordersArr);
        }
      } catch { }

      setData(formatted);

      // inventory + orders for insights + sales extras
      try {
        const [invRes, ordRes] = await Promise.all([
          getBusinessInventory(bizId),
          getBusinessOrders(bizId),
        ]);
        const inventory = invRes?.inventory || invRes?.data || invRes || [];
        const orders = ordRes?.orders || ordRes || [];

        setInvInsights(buildInventoryInsights(inventory, orders));
        setSalesExtras(computeSalesExtras(orders, timeframe));
      } catch {
        setInvInsights(null);
        setSalesExtras(null);
      }

      await AsyncStorage.setItem('cached_analytics', JSON.stringify({ data: formatted, savedAt: Date.now() }));
    } catch (e) {
      setError(`Failed to load data: ${e?.message || e}`);
      try {
        const cached = await AsyncStorage.getItem('cached_analytics');
        if (cached) {
          const parsed = JSON.parse(cached);
          setData({ ...(parsed?.data || {}), fromCache: true });
          setError(null);
        }
      } catch { }
    } finally {
      if (!silent) setIsLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  // ---------- UI helpers ----------
  const tabs = [
    { key: 'sales', label: 'Sales', icon: 'trending-up' },
    { key: 'inventory', label: 'Inventory', icon: 'inventory' },
    { key: 'customers', label: 'Customers', icon: 'people' },
  ];
  const timeframes = ['week', 'month', 'quarter', 'year'];

  const renderInventoryInsights = () => {
    if (!invInsights) {
      return (
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Inventory Insights</Text>
          <Text style={styles.listItem}>No inventory analytics available.</Text>
        </View>
      );
    }

    const { lowStock, outOfStock, fastMovers, deadStock, valueAtRisk, counts, reorderSuggestions } = invInsights;

    return (
      <View>
        <View style={styles.kpiGrid}>
          {/* All icons below are MaterialCommunityIcons names to avoid "?" */}
          <KPIWidget title="Total products type" value={counts.total} icon="package-variant" color={PRIMARY} format="number" />
          <KPIWidget title="Low Stock" value={counts.low} icon="alert" color={counts.low ? WARN : MUTED} format="number" />
          <KPIWidget title="Out of Stock" value={counts.oos} icon="close" color={counts.oos ? DANGER : MUTED} format="number" />
          <KPIWidget title="Value at Risk" value={valueAtRisk} icon="currency-ils" color={PRIMARY} format="currency" currency={CURRENCY} currencySymbol={CURRENCY_SYMBOL} />
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Reorder Suggestions</Text>
            <TouchableOpacity
              style={styles.linkBtn}
              onPress={() => navigation.navigate('AddInventoryScreen', { businessId: bizId, showInventory: true })}
            >
              <Text style={styles.linkBtnText}>Manage</Text>
              <MaterialIcons name="arrow-forward" size={16} color={PRIMARY} />
            </TouchableOpacity>
          </View>
          {(() => {
            const base = (reorderSuggestions && reorderSuggestions.length) ? reorderSuggestions : lowStock;
            const list = base
              .slice() // don’t mutate source
              // most urgent first: the bigger the gap below min, the higher it goes
              .sort((a, b) =>
                (toNum(a.quantity) - toNum(a.minThreshold || 5)) -
                (toNum(b.quantity) - toNum(b.minThreshold || 5))
              )
              .slice(0, 6);

            return list.length ? (
              list.map((i, idx) => (
                <Text key={idx} style={styles.listItem}>
                  • {i.name || 'Item'} — {toNum(i.quantity)} in stock (min {toNum(i.minThreshold) || 5}) • {fmt(toNum(i.price) * toNum(i.quantity))}
                </Text>
              ))
            ) : (
              <Text style={styles.listItem}>No items to reorder 🎉</Text>
            );
          })()}
        </View>
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Fast Movers (30d)</Text>
          {fastMovers.length ? fastMovers.map((m, idx) => (
            <Text key={idx} style={styles.listItem}>
              • {m.name || 'Item'} — {m.recentSales} sold • {m.stock} in stock
            </Text>
          )) : <Text style={styles.listItem}>No recent movers yet.</Text>}
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Dead Stock (no sale in 60d)</Text>
          {deadStock.length ? deadStock.map((d, idx) => (
            <Text key={idx} style={styles.listItem}>• {d.name || 'Item'}</Text>
          )) : <Text style={styles.listItem}>No dead stock detected.</Text>}
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Out of Stock</Text>
          {outOfStock.length ? outOfStock.slice(0, 6).map((i, idx) => (
            <Text key={idx} style={styles.listItem}>• {i.name || 'Item'}</Text>
          )) : <Text style={styles.listItem}>Great! Nothing is completely out.</Text>}
        </View>
      </View>
    );
  };

  const renderSalesSummary = () => {
    if (!salesExtras) return null;
    const { revenue, orderCount, itemsSold, aov, weekday } = salesExtras;
    const maxWk = Math.max(...weekday, 1);
    return (
      <View>
        <View style={styles.kpiGrid}>
          {/* MaterialCommunityIcons names: */}
          <KPIWidget title="Revenue" value={revenue} icon="currency-ils" color={PRIMARY} format="currency" currency={CURRENCY} currencySymbol={CURRENCY_SYMBOL} />
          <KPIWidget title="Orders" value={orderCount} icon="cart" color={PRIMARY} format="number" />
          <KPIWidget title="Items Sold" value={itemsSold} icon="package-variant" color={PRIMARY} format="number" />
          <KPIWidget title="AOV" value={aov} icon="cash-multiple" color={PRIMARY} format="currency" currency={CURRENCY} currencySymbol={CURRENCY_SYMBOL} />
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>By Weekday (last {TF_DAYS[timeframe] || 30} days)</Text>
          {weekday.map((val, i) => {
            const labels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            return (
              <View key={i} style={styles.weekdayRow}>
                <Text style={styles.weekdayLabel}>{labels[i]}</Text>
                <View style={styles.weekdayBarTrack}>
                  <View style={[styles.weekdayBarFill, { flex: (val / maxWk) || 0.01 }]} />
                  <View style={{ flex: 1 - (val / maxWk || 0.01) }} />
                </View>
                <Text style={styles.weekdayValue}>{fmt(val)}</Text>
              </View>
            );
          })}
        </View>
      </View>
    );
  };

  const renderTabContent = () => {
    if (!data) return null;
    if (activeTab === 'sales') {
      // No extra chart/table redundancy. Just summary + weekday + one Top Products list
      return (
        <View>
          {renderSalesSummary()}

          {/* Sorter for top products inside Sales tab */}
          <View style={[styles.sectionCard, { paddingTop: 12 }]}>
            <View style={[styles.segment, { marginBottom: 12 }]}>
              {[
                { k: 'totalRevenue', label: 'Revenue' },
                { k: 'totalSold', label: 'Sold' },
                { k: 'recentSales', label: 'Recent' },
                { k: 'growthRate', label: 'Growth' },
                { k: 'averagePrice', label: 'Avg Price' },
              ].map(opt => (
                <TouchableOpacity
                  key={opt.k}
                  style={[styles.segmentBtn, salesSortBy === opt.k && styles.segmentBtnActive]}
                  onPress={() => setSalesSortBy(opt.k)}
                >
                  <Text style={[styles.segmentText, salesSortBy === opt.k && styles.segmentTextActive]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TopSellingProductsList
              businessId={bizId}
              limit={10}
              sortBy={salesSortBy}
              refreshTrigger={`${timeframe}-${activeTab}-${salesSortBy}`}
              onProductPress={(p) => navigation.navigate('BusinessProductDetailScreen', { productId: p.id, businessId: bizId })}
            />
          </View>
        </View>
      );
    }

    if (activeTab === 'inventory') {
      return renderInventoryInsights();
    }

    if (activeTab === 'customers') {
      return (
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Top Customers</Text>
            <TouchableOpacity
              style={styles.linkBtn}
              onPress={() => navigation.navigate('BusinessCustomersScreen', { businessId: bizId })}
            >
              <Text style={styles.linkBtnText}>Open Customers</Text>
              <MaterialIcons name="arrow-forward" size={16} color={PRIMARY} />
            </TouchableOpacity>
          </View>
          {Array.isArray(data.topCustomers) && data.topCustomers.length > 0 ? (
            data.topCustomers.slice(0, 10).map((c, i) => (
              <Text key={i} style={styles.listItem}>
                {`${i + 1}. ${c?.name || 'Customer'} • ${c?.orders ?? 0} orders • ${fmt(c?.spent ?? 0)}`}
              </Text>
            ))
          ) : (
            <Text style={styles.listItem}>No customers found.</Text>
          )}
        </View>
      );
    }

    return null;
  };

  // ---------- States ----------
  if (isLoading) {
    return (
      <BusinessLayout navigation={navigation} businessId={bizId} currentTab="insights">
        <SafeAreaView style={styles.container}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={PRIMARY} />
            <Text style={styles.loadingText}>Loading insights...</Text>
          </View>
        </SafeAreaView>
      </BusinessLayout>
    );
  }

  if (error && !data) {
    return (
      <BusinessLayout navigation={navigation} businessId={bizId} currentTab="insights">
        <SafeAreaView style={styles.container}>
          <View style={styles.errorContainer}>
            <MaterialIcons name="error-outline" size={48} color={DANGER} />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={() => loadData()}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </BusinessLayout>
    );
  }

  if (!data) {
    return (
      <BusinessLayout navigation={navigation} businessId={bizId} currentTab="insights">
        <SafeAreaView style={styles.container}>
          <View style={styles.errorContainer}>
            <MaterialIcons name="info-outline" size={48} color={PRIMARY} />
            <Text style={styles.noDataText}>No data available for this timeframe</Text>
          </View>
        </SafeAreaView>
      </BusinessLayout>
    );
  }

  // ---------- Main ----------
  return (
    <BusinessLayout navigation={navigation} businessId={bizId} currentTab="insights">
      <SafeAreaView style={styles.container}>
        {/* Header (blue) */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <MaterialIcons name="arrow-back" size={24} color={PRIMARY} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Business Insights</Text>
          <View style={{ width: 32 }} />
        </View>

        {/* Tabs */}
        <View style={styles.tabBar}>
          {tabs.map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, activeTab === tab.key && styles.activeTab]}
              onPress={() => setActiveTab(tab.key)}
            >
              <MaterialIcons
                name={tab.icon}
                size={20}
                color={activeTab === tab.key ? PRIMARY : '#999'}
              />
              <Text style={[styles.tabText, activeTab === tab.key && styles.activeTabText]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Timeframe */}
        <View style={styles.timeframeBar}>
          {['week', 'month', 'quarter', 'year'].map((tf) => (
            <TouchableOpacity
              key={tf}
              style={[styles.timeframeBtn, timeframe === tf && styles.activeTimeframeBtn]}
              onPress={() => setTimeframe(tf)}
            >
              <Text style={[styles.timeframeText, timeframe === tf && styles.activeTimeframeText]}>
                {tf.charAt(0).toUpperCase() + tf.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Content */}
        <ScrollView
          style={styles.scrollView}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View style={{ opacity: fadeAnim, padding: 16 }}>
            {data.fromCache && (
              <View style={styles.cacheNotice}>
                <MaterialIcons name="info-outline" size={16} color={WARN} />
                <Text style={styles.cacheText}>
                  Showing cached data from {new Date(data.generatedAt).toLocaleString()}
                </Text>
              </View>
            )}
            {renderTabContent()}
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </BusinessLayout>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#fff', padding: 16, borderBottomWidth: 1, borderBottomColor: '#e0e0e0'
  },
  backButton: { padding: 8, borderRadius: 8, backgroundColor: '#f0f8ff' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: PRIMARY },

  tabBar: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12 },
  activeTab: { borderBottomWidth: 2, borderBottomColor: PRIMARY },
  tabText: { fontSize: 12, color: '#999', marginLeft: 6 },
  activeTabText: { color: PRIMARY, fontWeight: '600' },

  timeframeBar: { flexDirection: 'row', backgroundColor: '#fff', paddingHorizontal: 8, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  timeframeBtn: { flex: 1, alignItems: 'center', paddingVertical: 6, borderRadius: 12, backgroundColor: '#f5f5f5', marginHorizontal: 4 },
  activeTimeframeBtn: { backgroundColor: PRIMARY },
  timeframeText: { fontSize: 13, color: '#666' },
  activeTimeframeText: { color: '#fff', fontWeight: '600' },

  scrollView: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 16, fontSize: 16, color: '#666' },

  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 20 },

  sectionCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 16 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#333', marginBottom: 8 },
  listItem: { fontSize: 14, color: '#555', marginBottom: 6 },

  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  errorText: { color: DANGER, fontSize: 16, marginVertical: 12, textAlign: 'center' },
  retryButton: { backgroundColor: PRIMARY, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 8, marginTop: 8 },
  retryButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  noDataText: { color: PRIMARY, fontSize: 16, marginVertical: 12, textAlign: 'center' },

  cacheNotice: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#EAF3FB', padding: 8, borderRadius: 8, marginBottom: 12 },
  cacheText: { color: PRIMARY, marginLeft: 6, fontSize: 13 },

  // Sales tab segment control
  segment: {
    flexDirection: 'row',
    backgroundColor: '#f5f7fa',
    borderRadius: 10,
    padding: 4,
    borderWidth: 1,
    borderColor: '#e6eef5',
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  segmentBtnActive: {
    backgroundColor: '#eaf3fb',
    borderWidth: 1,
    borderColor: PRIMARY,
  },
  segmentText: { fontSize: 12, color: '#555' },
  segmentTextActive: { color: PRIMARY, fontWeight: '700' },

  // Weekday bars
  weekdayRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  weekdayLabel: { width: 32, fontSize: 12, color: '#666' },
  weekdayBarTrack: {
    flex: 1,
    height: 10,
    borderRadius: 6,
    backgroundColor: '#f0f8ff',
    marginHorizontal: 8,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  weekdayBarFill: {
    height: '100%',
    backgroundColor: PRIMARY,
    borderTopRightRadius: 6,
    borderBottomRightRadius: 6,
  },
  weekdayValue: { width: 72, textAlign: 'right', fontSize: 12, color: '#666' },

  linkBtn: { flexDirection: 'row', alignItems: 'center', padding: 4 },
  linkBtnText: { color: PRIMARY, fontSize: 14, marginRight: 4 },
});
