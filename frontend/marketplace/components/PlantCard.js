// components/PlantCard.js
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Image, Alert, Platform, Dimensions, Share
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import PropTypes from 'prop-types';
import * as WishlistService from '../services/WishlistService'; // ⬅️ use the centralized service
import { triggerUpdate, UPDATE_TYPES } from '../services/MarketplaceUpdates';

const { width: screenWidth } = Dimensions.get('window');
const isWeb = Platform.OS === 'web';

const PlantCard = React.memo(({ plant, showActions = true, layout = 'grid', style, onContactPress, onOrderPress }) => {
  const navigation = useNavigation();
  const isGrid = layout === 'grid';

  // --- Product core data (memoized)
  const plantData = useMemo(() => {
    const formatPrice = (price) => {
      const num = parseFloat(price);
      return Number.isNaN(num) ? '0' : num.toFixed(0);
    };

    const getImage = () => {
      const imageUrl =
        plant.image ||
        plant.mainImage ||
        (plant.images && plant.images[0]) ||
        plant.imageUrl;
      if (imageUrl && imageUrl.startsWith('http')) return { uri: imageUrl };
      return { uri: `https://picsum.photos/300/200?random=${plant.id || Math.random()}` };
    };

    const seller = plant.seller || {};
    const sellerInfo = {
      name: seller.name || plant.sellerName || 'Plant Seller',
      isBusiness: seller.isBusiness || plant.sellerType === 'business',
      location: plant.location?.city || plant.city || 'Location not specified',
      id: plant.sellerId || seller._id || seller.email
    };

    return {
      formattedPrice: formatPrice(plant.price || plant.finalPrice || 0),
      imageSource: getImage(),
      title: plant.title || plant.name || plant.common_name || 'Unnamed Plant',
      description: plant.description,
      sellerInfo,
      // Be robust about IDs
      plantId: plant.id || plant._id || plant.inventoryId
    };
  }, [plant]);

  // --- Wishlist state
  // seed from props if present; will be reconciled with persisted state below
  const [isWished, setIsWished] = useState(!!(plant.isFavorite || plant.isWished));
  const [isWishing, setIsWishing] = useState(false);

  // ensure heart reflects persisted state (e.g., after app restart or list refresh)
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!plantData.plantId) return;
      try {
        const has = await WishlistService.has(plantData.plantId);
        if (mounted) setIsWished(has);
      } catch {
        // ignore – render falls back to initial state
      }
    })();
    return () => { mounted = false; };
  }, [plantData.plantId]);

  const navigateToDetails = useCallback(() => {
    try {
      navigation.navigate('PlantDetails', { plant, plantId: plantData.plantId });
    } catch {
      navigation.navigate('ProductDetails', { product: plant, productId: plantData.plantId });
    }
  }, [navigation, plant, plantData.plantId]);

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
    if (!plantData.sellerInfo.id) return Alert.alert('Error', 'Seller information not available');
    openMessages({
      sellerId: plantData.sellerInfo.id,
      plantId: plantData.plantId,
      plantName: plantData.title,
      sellerName: plantData.sellerInfo.name,
      autoMessage: `Hi! I'm interested in your ${plantData.title}. Is it still available?`,
      isBusiness: plantData.sellerInfo.isBusiness
    });
  }, [plant, onContactPress, openMessages, plantData]);

  const handleOrder = useCallback((event) => {
    event?.stopPropagation();
    if (onOrderPress) return onOrderPress(plant);
    if (!plantData.sellerInfo.id) return Alert.alert('Error', 'Seller information not available');
    openMessages({
      sellerId: plantData.sellerInfo.id,
      plantId: plantData.plantId,
      plantName: plantData.title,
      sellerName: plantData.sellerInfo.name,
      autoMessage: plantData.sellerInfo.isBusiness
        ? `Hello, I'd like to order "${plantData.title}" ($${plantData.formattedPrice}). How do I pick it up?`
        : `Hello, is "${plantData.title}" still available for $${plantData.formattedPrice}?`,
      isBusiness: plantData.sellerInfo.isBusiness,
      isOrderInquiry: true
    });
  }, [plant, onOrderPress, openMessages, plantData]);

  // --- Wishlist toggle (optimistic UI + persisted sync)
  const handleWishToggle = useCallback(async (event) => {
    event?.stopPropagation();
    if (isWishing || !plantData.plantId) return;

    try {
      setIsWishing(true);

      // optimistic flip
      setIsWished((prev) => !prev);

      // call centralized service (handles server + cache)
      const snapshot = {
        id: plantData.plantId,
        name: plantData.title,
        title: plantData.title,
        image: plant.image || plant.mainImage || (plant.images && plant.images[0]) || plant.imageUrl || null,
        price: plant.price ?? plant.finalPrice ?? plant.pricing?.finalPrice ?? 0,
        seller: plant.seller || null,
        isBusinessListing: !!(plant.seller?.isBusiness || plant.sellerType === 'business'),
      };
      const { wished } = await WishlistService.toggle(plantData.plantId, { snapshot });


      // reconcile with truth
      setIsWished(!!wished);

      // notify other screens that depend on wishlist
      triggerUpdate(UPDATE_TYPES.WISHLIST, {
        plantId: plantData.plantId,
        isFavorite: !!wished,
        timestamp: Date.now()
      });
    } catch (e) {
      // rollback if it failed
      setIsWished((prev) => !prev);
      Alert.alert('Error', 'Failed to update wishlist. Please try again.');
    } finally {
      setIsWishing(false);
    }
  }, [isWishing, plantData.plantId]);

  const handleShare = useCallback(async (event) => {
    event?.stopPropagation();
    try {
      await Share.share({
        title: plantData.title,
        message: `${plantData.title}\nPrice: $${plantData.formattedPrice}\n${plantData.description || ''}`
      });
    } catch {
      Alert.alert('Error', 'Could not share this product.');
    }
  }, [plantData]);

  const renderSellerInfo = () => (
    <View style={styles.sellerContainer}>
      <View style={styles.sellerInfo}>
        <Text style={styles.sellerName} numberOfLines={1}>
          {plantData.sellerInfo.name}
        </Text>
        {plantData.sellerInfo.isBusiness && (
          <View style={styles.businessBadge}>
            <MaterialIcons name="store" size={10} color="#FF9800" />
            <Text style={styles.businessText}>Business</Text>
          </View>
        )}
      </View>
      <View style={styles.locationRow}>
        <MaterialIcons name="place" size={14} color="#2e7d32" />
        <Text style={styles.location} numberOfLines={1}>
          {plantData.sellerInfo.location}
        </Text>
      </View>
    </View>
  );

  const cardStyle = [
    styles.card,
    isGrid ? styles.cardGrid : styles.listCard,
    isWeb && styles.webCard,
    style
  ];

  return (
    <TouchableOpacity
      style={cardStyle}
      onPress={navigateToDetails}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={`View details for ${plantData.title}`}
    >
      {/* Image */}
      <View style={styles.imageContainer}>
        <Image
          source={plantData.imageSource}
          style={[styles.image, isGrid ? styles.imageGrid : styles.imageList]}
          resizeMode="cover"
        />
        {/* Wish */}
        {showActions && (
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
        {plantData.sellerInfo.isBusiness && (
          <View style={styles.businessImageBadge}>
            <MaterialIcons name="store" size={12} color="#fff" />
            <Text style={styles.businessImageText}>Business</Text>
          </View>
        )}
      </View>

      {/* Content */}
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={[styles.name, isGrid && styles.nameGrid]} numberOfLines={isGrid ? 1 : 2}>
            {plantData.title}
          </Text>
          <Text style={styles.price}>${plantData.formattedPrice}</Text>
        </View>

        {!!plantData.description && (
          <Text
            style={[styles.description, isGrid ? styles.descriptionGrid : styles.descriptionList]}
            numberOfLines={isGrid ? 2 : 3}
          >
            {plantData.description}
          </Text>
        )}

        {renderSellerInfo()}

        {/* Actions */}
        {showActions && (
          isGrid ? (
            <View style={styles.actionsIconRow}>
              <IconPill icon="chat-bubble-outline" onPress={handleContact} />
              {plantData.sellerInfo.isBusiness && (
                <IconPill icon="shopping-cart" onPress={handleOrder} />
              )}
              <IconPill icon="share" onPress={handleShare} outlined />
            </View>
          ) : (
            <View style={styles.actionsRow}>
              <Cta label="Contact" onPress={handleContact} primary />
              {plantData.sellerInfo.isBusiness && (
                <Cta label="Order" onPress={handleOrder} />
              )}
              <Cta label="Share" onPress={handleShare} outlined />
            </View>
          )
        )}
      </View>
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
        {label}
      </Text>
    </TouchableOpacity>
  );
}

// Styles
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
  cardGrid: {
    minHeight: 300, // keeps both columns aligned
  },
  listCard: {},
  webCard: isWeb ? { cursor: 'pointer' } : null,

  imageContainer: { position: 'relative' },
  image: { width: '100%', backgroundColor: '#f2f4f3' },
  imageGrid: { aspectRatio: 4 / 3 }, // uniform height in grid
  imageList: { height: 160 },        // taller image in list

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

  content: { padding: 12 },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 6 },
  name: { fontSize: 17, fontWeight: '700', color: '#2d3436', flex: 1, marginRight: 12, lineHeight: 22 },
  nameGrid: { fontSize: 16, lineHeight: 20 },
  price: { fontSize: 18, fontWeight: '800', color: '#4CAF50' },

  description: { color: '#636e72', lineHeight: 20, marginBottom: 8 },
  descriptionGrid: { fontSize: 13, minHeight: 38 }, // ~2 lines
  descriptionList: { fontSize: 14 },

  sellerContainer: { marginVertical: 6 },
  sellerInfo: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
  sellerName: { fontSize: 14, color: '#2d3436', fontWeight: '600', flex: 1 },
  businessBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff3e0', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 3, marginLeft: 8 },
  businessText: { fontSize: 10, color: '#FF9800', fontWeight: '700', marginLeft: 3 },

  locationRow: { flexDirection: 'row', alignItems: 'center' },
  location: { marginLeft: 4, fontSize: 13, color: '#607d8b', fontWeight: '500', flex: 1 },

  // Grid actions: icon-only
  actionsIconRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  iconBtn: { flex: 1, marginHorizontal: 4, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#2e7d32' },
  iconBtnOutline: { backgroundColor: '#E8F5E9', borderWidth: 1, borderColor: '#2e7d32' },

  // List actions: full buttons
  actionsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 10 },
  ctaBtnBase: { flex: 1, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E8F5E9', borderWidth: 1.5, borderColor: '#C8E6C9' },
  ctaPrimary: { backgroundColor: '#2e7d32', borderColor: '#2e7d32' },
  ctaOutline: { backgroundColor: '#fff', borderColor: '#2e7d32' },
  ctaTextBase: { fontWeight: '700', color: '#2e7d32' },
  ctaTextPrimary: { color: '#fff' },
  ctaTextOutline: { color: '#2e7d32' },
});

PlantCard.propTypes = {
  plant: PropTypes.object.isRequired,
  showActions: PropTypes.bool,
  layout: PropTypes.oneOf(['grid', 'list']),
  style: PropTypes.oneOfType([PropTypes.object, PropTypes.array]),
  onContactPress: PropTypes.func,
  onOrderPress: PropTypes.func,
};

PlantCard.defaultProps = {
  showActions: true,
  layout: 'grid',
  style: null,
  onContactPress: null,
  onOrderPress: null,
};

export default PlantCard;
