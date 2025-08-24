// components/PlantCard.js
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Image, Alert, Platform, Share,
  Modal, TextInput, ActivityIndicator
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import PropTypes from 'prop-types';
import AsyncStorage from '@react-native-async-storage/async-storage';

import * as WishlistService from '../services/WishlistService';
import { triggerUpdate, UPDATE_TYPES } from '../services/MarketplaceUpdates';
import marketplaceApi, { markAsSold, updateProductPrice } from '../services/marketplaceApi';

const isWeb = Platform.OS === 'web';

const formatPrice = (price) => {
  const num = parseFloat(price);
  return Number.isNaN(num) ? '0' : num.toFixed(0);
};

// ----- helpers -----
const nameFromEmail = (email) => {
  if (!email) return '';
  const base = email.split('@')[0].replace(/[._+-]+/g, ' ').trim();
  if (!base) return '';
  return base.charAt(0).toUpperCase() + base.slice(1);
};

async function getCurrentUserNiceName() {
  const email = await AsyncStorage.getItem('userEmail');
  let name = await AsyncStorage.getItem('userName');
  if (!name || /customer/i.test(name)) {
    try {
      if (email) {
        const res = await marketplaceApi.fetchUserProfile(email);
        const u = res?.user || res;
        name = u?.name || u?.username || nameFromEmail(email) || 'Customer';
      } else {
        name = 'Customer';
      }
      try { await AsyncStorage.setItem('userName', name); } catch {}
    } catch {
      name = nameFromEmail(email) || 'Customer';
    }
  }
  return name;
}
// -------------------

const PlantCard = React.memo(({ plant, showActions = true, layout = 'grid', style, onContactPress, onOrderPress, onMarkedSold, onPriceChanged }) => {
  const navigation = useNavigation();
  const isGrid = layout === 'grid';

  const plantId = useMemo(() => (plant.id || plant._id || plant.inventoryId), [plant]);

  const [resolvedSellerName, setResolvedSellerName] = useState(null);

  const sellerInfo = useMemo(() => {
    const seller = plant.seller || {};
    const sellerId = plant.sellerId || seller._id || seller.email || plant.ownerEmail || '';
    const isBusiness = !!(seller.isBusiness || plant.sellerType === 'business' || plant.isBusinessListing);
    const baseName =
      seller.name ||
      plant.sellerName ||
      (isBusiness ? (seller.businessName || 'Business') : nameFromEmail(sellerId) || 'Plant Seller');

    return {
      id: sellerId,
      isBusiness,
      name: resolvedSellerName || baseName,
      location: plant.location?.city || plant.city || 'Location not specified',
    };
  }, [plant, resolvedSellerName]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!sellerInfo.id || sellerInfo.isBusiness) return;
      if (sellerInfo.name && !/plant\s*seller|plant\s*enthusiast/i.test(sellerInfo.name)) return;
      try {
        const res = await marketplaceApi.fetchUserProfile(sellerInfo.id);
        const u = res?.user || res;
        const nice = u?.name || u?.username || nameFromEmail(sellerInfo.id);
        if (!cancelled && nice) setResolvedSellerName(nice);
      } catch {
        const nice = nameFromEmail(sellerInfo.id);
        if (!cancelled && nice) setResolvedSellerName(nice);
      }
    })();
    return () => { cancelled = true; };
  }, [sellerInfo.id, sellerInfo.isBusiness, sellerInfo.name]);

  const initialPrice = useMemo(() => {
    const p = plant.price ?? plant.finalPrice ?? plant.pricing?.finalPrice ?? 0;
    const n = Number(p);
    return Number.isFinite(n) ? n : 0;
  }, [plant]);
  const [price, setPrice] = useState(initialPrice);
  const [status, setStatus] = useState(plant.status || 'active');

  const imageSource = useMemo(() => {
    const imageUrl =
      plant.image ||
      plant.mainImage ||
      (plant.images && plant.images[0]) ||
      plant.imageUrl;
    if (imageUrl && imageUrl.startsWith('http')) return { uri: imageUrl };
    return { uri: `https://picsum.photos/300/200?random=${plantId || Math.random()}` };
  }, [plant, plantId]);

  const title = plant.title || plant.name || plant.common_name || 'Unnamed Plant';
  const description = plant.description;

  // string-safe
  const safeTitle = String(title ?? '');
  const safeDesc = description != null ? String(description) : '';
  const safeSellerName = String(sellerInfo.name ?? '');
  const safeLocation = String(sellerInfo.location ?? '');
  const safePriceText = `₪${formatPrice(price)}`;

  const [isOwner, setIsOwner] = useState(false);
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [email, currentUserId] = await Promise.all([
          AsyncStorage.getItem('userEmail'),
          AsyncStorage.getItem('currentUserId'),
        ]);
        const me = (currentUserId || email || '').trim().toLowerCase();
        const seller = String(sellerInfo.id || '').trim().toLowerCase();
        if (mounted) setIsOwner(!!me && !!seller && me === seller);
      } catch {
        if (mounted) setIsOwner(false);
      }
    })();
    return () => { mounted = false; };
  }, [sellerInfo.id]);

  const [isWished, setIsWished] = useState(!!(plant.isFavorite || plant.isWished));
  const [isWishing, setIsWishing] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!plantId) return;
      try {
        const has = await WishlistService.has(plantId);
        if (mounted) setIsWished(has);
      } catch {}
    })();
    return () => { mounted = false; };
  }, [plantId]);

  const navigateToDetails = useCallback(() => {
    try {
      navigation.navigate('PlantDetails', { plant, plantId });
    } catch {
      navigation.navigate('ProductDetails', { product: plant, productId: plantId });
    }
  }, [navigation, plant, plantId]);

  const openMessages = useCallback((params = {}) => {
    try {
      navigation.navigate('MarketplaceTabs', { screen: 'Messages', params });
    } catch {
      navigation.navigate('Messages', params);
    }
  }, [navigation]);

  const handleContact = useCallback((event) => {
    event?.stopPropagation();
    if (onContactPress) return onContactPress(plant);
    if (!sellerInfo.id) return Alert.alert('Error', 'Seller information not available');
    openMessages({
      sellerId: sellerInfo.id,
      plantId,
      plantName: safeTitle,
      sellerName: safeSellerName,
      autoMessage: `Hi! I'm interested in your ${safeTitle}. Is it still available?`,
      isBusiness: sellerInfo.isBusiness
    });
  }, [plant, onContactPress, openMessages, sellerInfo, plantId, safeTitle, safeSellerName]);

  // ----- ORDER -----
  const [showOrderConfirmation, setShowOrderConfirmation] = useState(false);
  const [isOrdering, setIsOrdering] = useState(false);

  const handleOrder = useCallback(async (event) => {
    event?.stopPropagation();
    if (onOrderPress) {
      const handled = onOrderPress(plant);
      if (handled) return;
    }
    const isBiz = !!(plant.isBusinessListing || plant.sellerType === 'business' || plant.seller?.isBusiness || sellerInfo.isBusiness);
    if (!isBiz) {
      return Alert.alert('Not available', 'This is not a business product.');
    }
    try {
      const userEmail = await AsyncStorage.getItem('userEmail');
      if (!userEmail) return Alert.alert('Login required', 'Please log in to place an order.');
      setShowOrderConfirmation(true);
    } catch {
      Alert.alert('Error', 'Failed to prepare order. Please try again.');
    }
  }, [plant, onOrderPress, sellerInfo.isBusiness]);

  const confirmOrder = useCallback(async () => {
    try {
      setIsOrdering(true);
      setShowOrderConfirmation(false);

      const userEmail = await AsyncStorage.getItem('userEmail');
      // business sees "Customer" (not real user name)
      const userName = 'Customer';

      const productId = plant?.inventoryId || plant?.id || plant?._id || plantId;
      const bizId = plant?.businessId || plant?.sellerId || plant?.seller?._id || sellerInfo.id;

      const res = await marketplaceApi.purchaseBusinessProduct(productId, bizId, 1, {
        email: userEmail,
        name: userName,
        phone: '',
        notes: `Order for ${safeTitle}`,
      });

      if (res?.success) {
        Alert.alert('Order placed', 'The business will contact you soon for pickup details.');
      } else {
        throw new Error(res?.message || res?.error || 'Order failed');
      }
    } catch (e) {
      Alert.alert('Order failed', e?.message || 'Failed to place order. Please try again.');
    } finally {
      setIsOrdering(false);
    }
  }, [plantId, plant, sellerInfo.id, safeTitle]);

  const cancelOrder = useCallback(() => setShowOrderConfirmation(false), []);
  // ------------------

  const handleWishToggle = useCallback(async (event) => {
    event?.stopPropagation();
    if (isWishing || !plantId) return;
    try {
      setIsWishing(true);
      setIsWished((prev) => !prev);
      const snapshot = {
        id: plantId,
        name: safeTitle,
        title: safeTitle,
        image: plant.image || plant.mainImage || (plant.images && plant.images[0]) || plant.imageUrl || null,
        price: price,
        seller: plant.seller || null,
        isBusinessListing: !!(plant.seller?.isBusiness || plant.sellerType === 'business'),
      };
      const { wished } = await WishlistService.toggle(plantId, { snapshot });
      setIsWished(!!wished);
      triggerUpdate(UPDATE_TYPES.WISHLIST, { plantId, isFavorite: !!wished, timestamp: Date.now() });
    } catch {
      setIsWished((prev) => !prev);
      Alert.alert('Error', 'Failed to update wishlist. Please try again.');
    } finally {
      setIsWishing(false);
    }
  }, [isWishing, plantId, plant, safeTitle, price]);

  const handleShare = useCallback(async (event) => {
    event?.stopPropagation();
    try {
      await Share.share({
        title: safeTitle,
        message: `${safeTitle}\nPrice: ${safePriceText}\n${safeDesc}`
      });
    } catch {
      Alert.alert('Error', 'Could not share this product.');
    }
  }, [safeTitle, safePriceText, safeDesc]);

  // OWNER ACTIONS
  const [isProcessing, setIsProcessing] = useState(false);
  const [priceModal, setPriceModal] = useState(false);
  const [newPrice, setNewPrice] = useState(String(initialPrice));

  const doMarkSold = useCallback(async (event) => {
    event?.stopPropagation();
    if (!plantId || status === 'sold' || isProcessing) return;
    try {
      setIsProcessing(true);
      await markAsSold(plantId);
      setStatus('sold');
      triggerUpdate(UPDATE_TYPES.PRODUCT, { productId: plantId, status: 'sold', timestamp: Date.now() });
      await AsyncStorage.setItem('PRODUCT_UPDATED', '1');
      onMarkedSold?.(plantId);
      Alert.alert('Marked as sold', 'Your listing is now marked as sold.');
    } catch (e) {
      Alert.alert('Error', e?.message || 'Failed to mark as sold');
    } finally {
      setIsProcessing(false);
    }
  }, [plantId, status, isProcessing, onMarkedSold]);

  const doChangePrice = useCallback(async () => {
    const val = Number(newPrice);
    if (!Number.isFinite(val) || val < 0) {
      Alert.alert('Invalid price', 'Enter a valid non-negative number.');
      return;
    }
    try {
      setIsProcessing(true);
      await updateProductPrice(plantId, val);
      setPrice(val);
      setPriceModal(false);
      triggerUpdate(UPDATE_TYPES.PRODUCT, { productId: plantId, price: val, timestamp: Date.now() });
      await AsyncStorage.setItem('PRODUCT_UPDATED', '1');
      onPriceChanged?.(plantId, val);
    } catch (e) {
      Alert.alert('Error', e?.message || 'Failed to update price');
    } finally {
      setIsProcessing(false);
    }
  }, [plantId, newPrice, onPriceChanged]);

  const cardStyle = [
    styles.card,
    isGrid ? styles.cardGrid : styles.listCard,
    isWeb && styles.webCard,
    style
  ];

  const isSold = status === 'sold';

  return (
    <TouchableOpacity
      style={cardStyle}
      onPress={navigateToDetails}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={`View details for ${safeTitle}`}
    >
      {/* Image */}
      <View style={styles.imageContainer}>
        <Image
          source={imageSource}
          style={[styles.image, isGrid ? styles.imageGrid : styles.imageList]}
          resizeMode="cover"
        />

        {/* Wish (hide for owner or sold) */}
        {showActions && !isOwner && !isSold && (
          <TouchableOpacity
            style={styles.wishButton}
            onPress={handleWishToggle}
            disabled={isWishing}
            accessibilityRole="button"
            accessibilityLabel={isWished ? 'Remove from wishlist' : 'Add to wishlist'}
          >
            <MaterialIcons
              name={isWished ? 'favorite' : 'favorite-border'}
              size={20}
              color={isWished ? '#ff4444' : '#666'}
            />
          </TouchableOpacity>
        )}

        {/* Business badge */}
        {sellerInfo.isBusiness && (
          <View style={styles.businessImageBadge}>
            <MaterialIcons name="store" size={12} color="#fff" />
            <Text style={styles.businessImageText}>Business</Text>
          </View>
        )}

        {/* Sold badge overlay */}
        {isSold && (
          <View style={styles.soldBadge}>
            <MaterialIcons name="check-circle" size={18} color="#fff" />
            <Text style={styles.soldText}>SOLD</Text>
          </View>
        )}
      </View>

      {/* Content */}
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={[styles.name, isGrid && styles.nameGrid]} numberOfLines={isGrid ? 1 : 2}>
            {safeTitle}
          </Text>
          <Text style={[styles.price, isSold && { color: '#999', textDecorationLine: 'line-through' }]}>
            {safePriceText}
          </Text>
        </View>

        {!!safeDesc && (
          <Text
            style={[styles.description, isGrid ? styles.descriptionGrid : styles.descriptionList]}
            numberOfLines={isGrid ? 2 : 3}
          >
            {safeDesc}
          </Text>
        )}

        {/* Seller info */}
        <View style={styles.sellerContainer}>
          <View style={styles.sellerInfo}>
            <Text style={styles.sellerName} numberOfLines={1}>
              {safeSellerName}
            </Text>
            {sellerInfo.isBusiness && (
              <View style={styles.businessBadge}>
                <MaterialIcons name="store" size={10} color="#FF9800" />
                <Text style={styles.businessText}>Business</Text>
              </View>
            )}
          </View>
          <View style={styles.locationRow}>
            <MaterialIcons name="place" size={14} color="#2e7d32" />
            <Text style={styles.location} numberOfLines={1}>
              {safeLocation}
            </Text>
          </View>
        </View>

        {/* Actions */}
        {isOwner ? (
          isGrid ? (
            <View style={styles.actionsIconRow}>
              <IconPill icon="check-circle" onPress={doMarkSold} />
              <IconPill icon="edit" onPress={() => setPriceModal(true)} />
              <IconPill icon="share" onPress={handleShare} outlined />
            </View>
          ) : (
            <View style={styles.actionsRow}>
              <Cta label={isSold ? 'Marked as sold' : 'Mark as sold'} onPress={doMarkSold} primary />
              <Cta label="Change price" onPress={() => setPriceModal(true)} />
              <Cta label="Share" onPress={handleShare} outlined />
            </View>
          )
        ) : (
          showActions && !isSold && (
            isGrid ? (
              <View style={styles.actionsIconRow}>
                <IconPill icon="chat-bubble-outline" onPress={handleContact} />
                {sellerInfo.isBusiness && <IconPill icon="shopping-cart" onPress={handleOrder} />}
                <IconPill icon="share" onPress={handleShare} outlined />
              </View>
            ) : (
              <View style={styles.actionsRow}>
                <Cta label="Contact" onPress={handleContact} primary />
                {sellerInfo.isBusiness && <Cta label="Order" onPress={handleOrder} />}
                <Cta label="Share" onPress={handleShare} outlined />
              </View>
            )
          )
        )}
      </View>

      {/* Price modal */}
      <Modal transparent visible={priceModal} animationType="fade" onRequestClose={() => setPriceModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Update price</Text>
            <TextInput
              value={newPrice}
              onChangeText={setNewPrice}
              keyboardType="decimal-pad"
              placeholder="Enter new price"
              style={styles.modalInput}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity onPress={() => setPriceModal(false)}>
                <Text style={styles.modalCancel}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={doChangePrice} disabled={isProcessing}>
                {isProcessing ? (
                  <ActivityIndicator size="small" />
                ) : (
                  <Text style={styles.modalSave}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Order confirmation modal */}
      <Modal transparent visible={showOrderConfirmation} animationType="fade" onRequestClose={cancelOrder}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={{ alignItems: 'center', marginBottom: 10 }}>
              <MaterialIcons name="shopping-cart" size={36} color="#4CAF50" />
            </View>
            <Text style={styles.modalTitle}>Confirm Order</Text>
            <Text style={{ textAlign: 'center', marginBottom: 6 }}>
              {`Order ${safeTitle} for ₪${Math.round(Number(price) || 0)}?`}
            </Text>
            <Text style={{ textAlign: 'center', color: '#666', marginBottom: 14 }}>
              The business will contact you about pickup details.
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity onPress={cancelOrder}>
                <Text style={styles.modalCancel}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={confirmOrder} disabled={isOrdering}>
                {isOrdering ? (
                  <ActivityIndicator size="small" />
                ) : (
                  <Text style={styles.modalSave}>Place Order</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </TouchableOpacity>
  );
});

function IconPill({ icon, onPress, outlined }) {
  const handlePress = useCallback((event) => {
    event?.stopPropagation();
    onPress?.(event);
  }, [onPress]);

  return (
    <TouchableOpacity
      onPress={handlePress}
      style={[styles.iconBtn, outlined && styles.iconBtnOutline]}
      activeOpacity={0.85}
    >
      <MaterialIcons name={icon} size={18} color={outlined ? '#2e7d32' : '#fff'} />
    </TouchableOpacity>
  );
}

function Cta({ label, onPress, primary, outlined }) {
  const handlePress = useCallback((event) => {
    event?.stopPropagation();
    onPress?.(event);
  }, [onPress]);

  return (
    <TouchableOpacity
      onPress={handlePress}
      style={[
        styles.ctaBtnBase,
        primary && styles.ctaPrimary,
        outlined && styles.ctaOutline,
      ]}
      activeOpacity={0.85}
    >
      <Text
        style={[
          styles.ctaTextBase,
          primary && styles.ctaTextPrimary,
          outlined && styles.ctaTextOutline,
        ]}
        numberOfLines={1}
      >
        {String(label ?? '')}
      </Text>
    </TouchableOpacity>
  );
}

PlantCard.propTypes = {
  plant: PropTypes.object.isRequired,
  showActions: PropTypes.bool,
  layout: PropTypes.oneOf(['grid', 'list']),
  style: PropTypes.oneOfType([PropTypes.object, PropTypes.array]),
  onContactPress: PropTypes.func,
  onOrderPress: PropTypes.func,
  onMarkedSold: PropTypes.func,
  onPriceChanged: PropTypes.func,
};

PlantCard.defaultProps = {
  showActions: true,
  layout: 'grid',
  style: null,
  onContactPress: null,
  onOrderPress: null,
  onMarkedSold: null,
  onPriceChanged: null,
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
    ...Platform.select({
      web: { boxShadow: '0px 2px 8px rgba(0,0,0,0.1)' },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
      },
    }),
  },
  cardGrid: { minHeight: 300 },
  listCard: {},
  webCard: isWeb ? { cursor: 'pointer' } : null,

  imageContainer: { position: 'relative' },
  image: { width: '100%', backgroundColor: '#f2f4f3' },
  imageGrid: { aspectRatio: 4 / 3 },
  imageList: { height: 160 },

  wishButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 22,
    padding: 8,
    zIndex: 1,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2 },
      android: { elevation: 2 },
    }),
  },
  businessImageBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: 'rgba(255, 152, 0, 0.95)',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 1,
  },
  businessImageText: { color: '#fff', fontSize: 11, fontWeight: '700', marginLeft: 3 },

  soldBadge: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    backgroundColor: 'rgba(46, 125, 50, 0.95)',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 1,
  },
  soldText: { color: '#fff', fontSize: 12, fontWeight: '800', marginLeft: 6 },

  content: { padding: 12 },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 6 },
  name: { fontSize: 17, fontWeight: '700', color: '#2d3436', flex: 1, marginRight: 12, lineHeight: 22 },
  nameGrid: { fontSize: 16, lineHeight: 20 },
  price: { fontSize: 18, fontWeight: '800', color: '#4CAF50' },

  description: { color: '#636e72', lineHeight: 20, marginBottom: 8 },
  descriptionGrid: { fontSize: 13, minHeight: 38 },
  descriptionList: { fontSize: 14 },

  sellerContainer: { marginVertical: 6 },
  sellerInfo: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
  sellerName: { fontSize: 14, color: '#2d3436', fontWeight: '600', flex: 1 },
  businessBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff3e0', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 3, marginLeft: 8 },
  businessText: { fontSize: 10, color: '#FF9800', fontWeight: '700', marginLeft: 3 },

  locationRow: { flexDirection: 'row', alignItems: 'center' },
  location: { marginLeft: 4, fontSize: 13, color: '#607d8b', fontWeight: '500', flex: 1 },

  actionsIconRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  iconBtn: { flex: 1, marginHorizontal: 4, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#2e7d32' },
  iconBtnOutline: { backgroundColor: '#E8F5E9', borderWidth: 1, borderColor: '#2e7d32' },

  actionsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 10 },
  ctaBtnBase: { flex: 1, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E8F5E9', borderWidth: 1.5, borderColor: '#C8E6C9' },
  ctaPrimary: { backgroundColor: '#2e7d32', borderColor: '#2e7d32' },
  ctaOutline: { backgroundColor: '#fff', borderColor: '#2e7d32' },
  ctaTextBase: { fontWeight: '700', color: '#2e7d32' },
  ctaTextPrimary: { color: '#fff' },
  ctaTextOutline: { color: '#2e7d32' },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  modalCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, width: '80%', maxWidth: 420 },
  modalTitle: { fontWeight: '700', fontSize: 16, marginBottom: 8, color: '#2d3436', textAlign: 'center' },
  modalInput: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, marginBottom: 12 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 18 },
  modalCancel: { color: '#666', fontWeight: '600' },
  modalSave: { color: '#0277bd', fontWeight: '700' },
});

export default PlantCard;
