// Business/components/TopSellingProductsList.js - FIXED IMPORTS & PROP FORWARDING
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

// FIXED: Import from existing API files
import { getBusinessOrders } from '../services/businessOrderApi';
import { getBusinessInventory } from '../services/businessApi'; // Use existing businessApi.js

const TopSellingProductsList = ({
  businessId,
  sortBy = 'totalSold',
  limit = 10,
  onProductPress,
  // 🔽 NEW: forwardable view/scroll props from parent (Sales tab)
  style,
  contentContainerStyle,
  ListHeaderComponent,
  ListFooterComponent,
  refreshing: refreshingProp,
  onRefresh: onRefreshProp,
  showsVerticalScrollIndicator,
  refreshTrigger,
}) => {
  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  /**
   * Load REAL sales data from orders and inventory
   */
  const loadTopSellingProducts = async (silent = false) => {
    try {
      if (!silent) setIsLoading(true);
      setError(null);

      const toNum = (v) => {
        const n = Number(v);
        return Number.isFinite(n) ? n : 0;
      };

      const currentBusinessId =
        businessId || (await AsyncStorage.getItem('businessId'));
      if (!currentBusinessId) throw new Error('Business ID not available');

      // Load REAL orders and inventory data in parallel
      const [ordersResponse, inventoryResponse] = await Promise.all([
        getBusinessOrders(currentBusinessId),
        getBusinessInventory(currentBusinessId),
      ]);

      // Handle different response formats from your APIs
      const ordersData =
        ordersResponse?.orders ||
        ordersResponse?.data?.orders ||
        ordersResponse ||
        [];
      const inventoryData =
        inventoryResponse?.inventory ||
        inventoryResponse?.data ||
        inventoryResponse ||
        [];

      // Build a quick lookup from inventory to enrich names if they’re missing
      const invById = new Map(
        (Array.isArray(inventoryData) ? inventoryData : []).map((p) => [
          p.id || p.productId || p._id,
          p,
        ])
      );

      let productData = [];

      // Process REAL order data to calculate sales statistics
      if (Array.isArray(ordersData) && ordersData.length > 0) {
        const salesMap = new Map();

        ordersData.forEach((order) => {
          const status = String(order.status || '').toLowerCase();
          // Count revenue for completed/paid orders only
          const isRevenueOrder = ['completed', 'paid'].includes(status);

          if (!isRevenueOrder || !Array.isArray(order.items)) return;

          order.items.forEach((item) => {
            // Robust product id detection
            const productId =
              item.productId ??
              item.id ??
              item.product?.id ??
              item.sku ??
              item.title ??
              item.name;
            if (!productId) return;

            const qty = toNum(item.quantity ?? item.qty ?? 1);

            // Prefer explicit line total; else use unit price * qty
            const unit = toNum(
              item.unitPrice ??
                item.price ??
                item.unit_price ??
                item.amount ??
                item.cost
            );
            const lineTotal = toNum(
              item.total ?? item.lineTotal ?? item.extendedPrice ?? item.subtotal
            );
            const revenue = lineTotal > 0 ? lineTotal : unit * qty;

            // Best-effort name
            const inv = invById.get(productId);
            const name =
              item.productName ??
              item.name ??
              item.title ??
              inv?.name ??
              inv?.title ??
              'Unknown Product';

            const existing = salesMap.get(productId);
            if (existing) {
              existing.totalSold += qty;
              existing.totalRevenue += revenue;
              const candidate = new Date(
                order.completedAt || order.createdAt || order.date || 0
              );
              if (!existing.lastSaleDate || candidate > existing.lastSaleDate) {
                existing.lastSaleDate = candidate;
              }
            } else {
              salesMap.set(productId, {
                id: productId,
                name,
                scientific_name: item.scientific_name || '',
                productType: item.productType || 'plant',
                category: item.category || 'houseplants',
                totalSold: qty,
                totalRevenue: revenue,
                lastSaleDate: new Date(
                  order.completedAt || order.createdAt || order.date || Date.now()
                ),
              });
            }
          });
        });

        // Convert sales map to array and calculate metrics
        productData = Array.from(salesMap.values()).map((product) => {
          const averagePrice =
            product.totalSold > 0
              ? product.totalRevenue / product.totalSold
              : 0;

          // Calculate growth rate based on recent sales vs older sales
          const recentSales = ordersData
            .filter((order) => {
              const d = new Date(order.createdAt || order.completedAt || 0);
              const thirtyDaysAgo = new Date(
                Date.now() - 30 * 24 * 60 * 60 * 1000
              );
              const status = String(order.status || '').toLowerCase();
              const completed = ['completed', 'paid'].includes(status);
              return (
                completed &&
                d >= thirtyDaysAgo &&
                order.items?.some(
                  (it) =>
                    (it.productId || it.id || it.product?.id) === product.id
                )
              );
            })
            .reduce((sum, order) => {
              const it = order.items?.find(
                (i) => (i.productId || i.id || i.product?.id) === product.id
              );
              return sum + toNum(it?.quantity ?? it?.qty ?? 0);
            }, 0);

          const oldSales = product.totalSold - recentSales;
          const growthRate =
            oldSales > 0
              ? ((recentSales - oldSales) / oldSales) * 100
              : recentSales > 0
              ? 100
              : 0;

          return {
            ...product,
            averagePrice: Math.round(averagePrice * 100) / 100,
            growthRate: Math.round(growthRate),
            recentSales,
            oldSales,
          };
        });
      }

      // If no sales data available, show empty state instead of mock data
      if (productData.length === 0) {
        setProducts([]);
        if (!silent) setIsLoading(false);
        return;
      }

      // Sort products based on sortBy parameter
      let sortedProducts = [...productData];
      switch (sortBy) {
        case 'totalRevenue':
          sortedProducts.sort((a, b) => b.totalRevenue - a.totalRevenue);
          break;
        case 'averagePrice':
          sortedProducts.sort((a, b) => b.averagePrice - a.averagePrice);
          break;
        case 'growthRate':
          sortedProducts.sort((a, b) => b.growthRate - a.growthRate);
          break;
        case 'recentSales':
          sortedProducts.sort((a, b) => b.recentSales - a.recentSales);
          break;
        default: // totalSold
          sortedProducts.sort((a, b) => b.totalSold - a.totalSold);
          break;
      }

      // Limit results
      const limitedProducts = sortedProducts.slice(0, limit);

      setProducts(limitedProducts);
    } catch (err) {
      console.error('❌ Error loading top selling products:', err);
      setError(err.message);
      setProducts([]);
    } finally {
      if (!silent) setIsLoading(false);
      setRefreshing(false);
    }
  };

  // Load data on component mount and when refresh is triggered
  useEffect(() => {
    loadTopSellingProducts();
  }, [businessId, sortBy, limit, refreshTrigger]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadTopSellingProducts(true);
  };

  // Prefer external refreshing if provided (from parent Sales tab)
  const effectiveRefreshing =
    typeof refreshingProp === 'boolean' ? refreshingProp : refreshing;
  const effectiveOnRefresh =
    typeof onRefreshProp === 'function' ? onRefreshProp : handleRefresh;

  if (isLoading) {
    return (
      <View style={styles.cardWrap}>
        <View style={styles.card}>
          <ActivityIndicator size="large" color="#216a94" />
          <Text style={styles.loadingText}>Loading sales data...</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.cardWrap}>
        <View style={styles.card}>
          <MaterialCommunityIcons
            name="alert-circle-outline"
            size={48}
            color="#F44336"
          />
          <Text style={styles.emptyTitle}>Unable to load</Text>
          <Text style={styles.emptyText}>{error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => loadTopSellingProducts()}
          >
            <Text style={styles.retryText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (products.length === 0) {
    return (
      <View style={styles.cardWrap}>
        <View style={styles.card}>
          <MaterialCommunityIcons
            name="chart-line-variant"
            size={48}
            color="#E0E0E0"
          />
          <Text style={styles.emptyTitle}>No Sales Data Available</Text>
          <Text style={styles.emptyText}>
            Start selling products to see your top performers here
          </Text>
        </View>
      </View>
    );
  }

  // ✅ FlatList is now the ONLY scroll container and receives header/footer & styles
  return (
    <FlatList
      data={products}
      keyExtractor={(item) => String(item.id)}
      renderItem={({ item }) => (
        <TouchableOpacity
          style={styles.productCard}
          activeOpacity={0.8}
          onPress={() => onProductPress && onProductPress(item)}
        >
          {/* header row: name + pill */}
          <View style={styles.cardHeader}>
            <Text style={styles.productName} numberOfLines={1}>
              {item.name}
            </Text>
            <View style={[styles.pill, { backgroundColor: '#2196F3' }]}>
              <Text style={styles.pillText}>{item.totalSold} sold</Text>
            </View>
          </View>

          {/* details row */}
          <View style={styles.cardDetails}>
            <Text style={styles.detailLeft} numberOfLines={1}>
              Last sale:{' '}
              {item.lastSaleDate
                ? new Date(item.lastSaleDate).toLocaleDateString()
                : '—'}
            </Text>
          </View>

          {/* footer row */}
          <View style={styles.cardFooter}>
            <Text style={styles.totalText}>
              ₪{(item.totalRevenue || 0).toFixed(2)}
            </Text>
            <Text style={styles.itemsText}>
              Avg ₪{(item.averagePrice || 0).toFixed(2)}
            </Text>
          </View>
        </TouchableOpacity>
      )}
      style={[{ flex: 1 }, style]}
      contentContainerStyle={[{ paddingHorizontal: 16, paddingBottom: 24 }, contentContainerStyle]}
      ListHeaderComponent={ListHeaderComponent}
      ListFooterComponent={ListFooterComponent}
      refreshing={effectiveRefreshing}
      onRefresh={effectiveOnRefresh}
      showsVerticalScrollIndicator={showsVerticalScrollIndicator ?? false}
      keyboardShouldPersistTaps="handled"
      removeClippedSubviews
      initialNumToRender={10}
      windowSize={11}
    />
  );
};

const styles = StyleSheet.create({
  // wrappers for non-list states
  cardWrap: { marginHorizontal: 16, marginBottom: 24 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },

  loadingText: {
    marginTop: 10,
    color: '#216a94',
    fontSize: 16,
  },

  // Product item styled like an order card
  productCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 13,
    marginBottom: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },

  // Header row: name + small pill (like status)
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  productName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
    marginRight: 8,
  },
  pill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#2196F3',
  },
  pillText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },

  // Middle row: small details
  cardDetails: { marginBottom: 8 },
  detailLeft: { fontSize: 12, color: '#666' },

  // Footer row: totals
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  totalText: { fontSize: 16, fontWeight: 'bold', color: '#216a94' },
  itemsText: { fontSize: 12, color: '#666' },

  emptyTitle: { fontSize: 16, color: '#666', marginTop: 12, textAlign: 'center' },
  emptyText: { fontSize: 12, color: '#999', marginTop: 4, textAlign: 'center' },

  retryButton: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#216a94',
    backgroundColor: '#f0f8ff',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  retryText: { color: '#216a94', fontSize: 14, fontWeight: '600' },
});

export default TopSellingProductsList;
