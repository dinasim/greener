// screens/PlantDetailScreen.js - FIXED: Proper seller name preservation for individual products
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, StyleSheet, ScrollView, SafeAreaView, Modal, Alert, Text, Platform, Linking
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Components
import MarketplaceHeader from '../components/MarketplaceHeader';
import PlantLocationMap from '../components/PlantLocationMap';
import ReviewForm from '../components/ReviewForm';
import ToastMessage from '../components/ToastMessage';

// Extracted parts
import ImageGallery from './PlantDetailScreen-parts/ImageGallery';
import PlantInfoHeader from './PlantDetailScreen-parts/PlantInfoHeader';
import DescriptionSection from './PlantDetailScreen-parts/DescriptionSection';
import SellerCard from './PlantDetailScreen-parts/SellerCard';
import ActionButtons from './PlantDetailScreen-parts/ActionButtons';
import CareInfoSection from './PlantDetailScreen-parts/CareInfoSection';
import LoadingError from './PlantDetailScreen-parts/LoadingError';

// Services
import marketplaceApi, {
  getSpecific,               // individual product endpoint
  fetchBusinessInventory,    // business inventory
  fetchBusinessProfile,      // business profile (for location/name)
  convertInventoryToProducts, // normalize business inventory to products
  fetchSellerProfile,        // individual seller profile
  fetchUserProfile,          // Add this import for user profiles
} from '../services/marketplaceApi';

import * as WishlistService from '../services/WishlistService';
import PlaceholderService from '../services/placeholderService';
import { deriveListingFlags } from '../utils/listingFlags';

const PlantDetailScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();

  // ----------- Params & typing -----------
  const plantId =
    route?.params?.plantId ||
    route?.params?.plant?.id ||
    route?.params?.plant?._id ||
    route?.params?.plant?.inventoryId;

  const businessId =
    route?.params?.businessId ||
    route?.params?.plant?.businessId ||
    route?.params?.plant?.sellerId ||
    route?.params?.plant?.seller?._id ||
    route?.params?.plant?.ownerEmail;

  const typeParam =
    route?.params?.type ||
    route?.params?.productType ||
    route?.params?.plant?.sellerType;

  const isBusinessParam = typeParam === 'business' || (!!businessId && typeParam !== 'individual');

  console.log('[PlantDetail params]', { businessId, plantId, typeParam });

  // ----------- State -----------
  const [plant, setPlant] = useState(route?.params?.plant || null);
  const [isLoading, setIsLoading] = useState(!route?.params?.plant);
  const [error, setError] = useState(null);
  const [isFavorite, setIsFavorite] = useState(Boolean(route?.params?.plant?.isWished || route?.params?.plant?.isFavorite));
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [mapModalVisible, setMapModalVisible] = useState(false);
  const [isProcessingOrder, setIsProcessingOrder] = useState(false);
  const [toast, setToast] = useState({ visible: false, message: '', type: 'info' });

  const { isBusiness, isIndividual } = useMemo(
    () => deriveListingFlags(plant, isBusinessParam),
    [plant, isBusinessParam]
  );

  // ----------- Loader (business-aware) -----------
  const loadPlantDetail = useCallback(async () => {
    if (!plantId) {
      setError('Plant ID is missing');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      let data = null;

      console.log('[PlantDetail] loading', {
        plantId,
        isBusinessParam,
        businessId: businessId || '—',
      });

      if (isBusinessParam && businessId) {
        // BUSINESS PATH: fetch inventory + profile, then convert and find
        try {
          const invResp = await fetchBusinessInventory(businessId);
          const inventory = invResp?.inventory || [];

          const profResp = await fetchBusinessProfile(businessId);
          const bizProfile = profResp?.business || {};

          const products = convertInventoryToProducts(inventory, bizProfile, null, null);
          data = products.find(
            (p) =>
              (p.id || p._id) === plantId ||
              p.inventoryId === plantId
          ) || null;

          if (data) {
            console.log('[PlantDetail] business fetch OK');
          } else {
            console.log('[PlantDetail] business fetch: product not found in inventory');
          }
        } catch (e1) {
          console.log('[PlantDetail] business fetch failed:', e1?.message);
        }
      }

      // INDIVIDUAL PATH (or fallback if business path didn't find it)
      if (!data) {
        try {
          const res = await getSpecific(plantId);
          data = res?.data ?? res ?? null;
          if (data) {
            console.log('[PlantDetail] global fetch OK (/products/specific)');
            
            // For individual products, ALWAYS fetch seller info to get the correct name
            if (data.sellerId || data.seller?.email || data.ownerEmail) {
              try {
                const sellerId = data.sellerId || data.seller?.email || data.ownerEmail;
                console.log('[PlantDetail] fetching seller profile for:', sellerId);
                
                // Try to fetch user profile first (this is what SellerProfile screen uses)
                let sellerProfile = null;
                try {
                  const profileResp = await fetchUserProfile(sellerId);
                  sellerProfile = profileResp?.user || profileResp?.data || profileResp;
                } catch (e) {
                  console.log('[PlantDetail] fetchUserProfile failed, trying fetchSellerProfile:', e.message);
                  try {
                    sellerProfile = await fetchSellerProfile(sellerId, 'user');
                  } catch (e2) {
                    console.log('[PlantDetail] fetchSellerProfile also failed:', e2.message);
                  }
                }
                
                if (sellerProfile && sellerProfile.name) {
                  // Replace seller information with fresh data from profile
                  data.seller = {
                    _id: sellerProfile.id || sellerProfile._id || sellerId,
                    email: sellerProfile.email || sellerId,
                    name: sellerProfile.name,
                    avatar: sellerProfile.avatar || sellerProfile.profileImage,
                    rating: sellerProfile.stats?.rating || sellerProfile.rating || 0,
                    totalReviews: sellerProfile.stats?.reviewCount || sellerProfile.reviewCount || 0,
                    joinDate: sellerProfile.joinDate || sellerProfile.createdAt,
                    bio: sellerProfile.bio,
                    isBusiness: false,
                    isIndividual: true,
                  };
                  data.sellerName = sellerProfile.name;
                  
                  console.log('[PlantDetail] seller profile loaded successfully:', sellerProfile.name);
                } else {
                  console.log('[PlantDetail] no valid seller profile found');
                }
              } catch (sellerErr) {
                console.log('[PlantDetail] failed to fetch seller info:', sellerErr.message);
              }
            }
          }
        } catch (e2) {
          console.log('[PlantDetail] global fetch failed:', e2?.message);
        }
      }

      if (!data) throw new Error('Product not found');

      // FIXED: Simplified seller data preservation that prioritizes fetched seller info
      const initialPlantData = route.params?.plant || {};
      
      // Start with fetched data and only add from initial data if missing
      const finalPlantData = {
        ...data,
        // Preserve some initial data fields that might not come from API
        ...initialPlantData,
        // But override with fresh API data
        ...data,
      };

      // FIXED: Ensure seller object is properly constructed with name priority
      if (finalPlantData.seller) {
        finalPlantData.seller = {
          ...finalPlantData.seller,
          // Ensure name is set with proper priority
          name: finalPlantData.seller.name || 
                finalPlantData.sellerName || 
                initialPlantData.seller?.name || 
                initialPlantData.sellerName ||
                'Plant Enthusiast',
        };
        
        // Set consistent seller name fields
        finalPlantData.sellerName = finalPlantData.seller.name;
        finalPlantData.sellerDisplayName = finalPlantData.seller.name;
      } else {
        // Fallback seller object creation
        finalPlantData.seller = {
          _id: finalPlantData.sellerId || 'unknown',
          email: finalPlantData.sellerId || 'unknown',
          name: finalPlantData.sellerName || 
                initialPlantData.seller?.name || 
                initialPlantData.sellerName ||
                'Plant Enthusiast',
          avatar: null,
          rating: 0,
          totalReviews: 0,
          isBusiness: false,
          isIndividual: true,
        };
        finalPlantData.sellerName = finalPlantData.seller.name;
      }

      // Normalize images
      finalPlantData.images = Array.isArray(finalPlantData.images) && finalPlantData.images.length > 0
        ? finalPlantData.images
        : finalPlantData.image
        ? [finalPlantData.image]
        : finalPlantData.photoUrl
        ? [finalPlantData.photoUrl]
        : [];

      console.log('[PlantDetail] Final seller name:', finalPlantData.seller?.name);
      setPlant(finalPlantData);

      // Update wishlist status
      try {
        const has = await WishlistService.has(
          data.id || data._id || data.inventoryId || plantId
        );
        setIsFavorite(!!has);
      } catch {
        setIsFavorite(Boolean(data.isWished || data.isFavorite));
      }
      setIsLoading(false);
    } catch (err) {
      console.error('Error fetching plant details:', err?.message || err);
      setError('Failed to load plant details. Please try again later.');
      setIsLoading(false);
    }
  }, [plantId, businessId, isBusinessParam]);

  useEffect(() => {
    if (plantId && !plant) {
      loadPlantDetail();
    } else if (!plantId) {
      setError('Plant ID is missing');
      setIsLoading(false);
    }
  }, [plantId, loadPlantDetail]);

  // ----------- Toast helpers -----------
  const showToast = useCallback((message, type = 'info') => setToast({ visible: true, message, type }), []);
  const hideToast = useCallback(() => setToast((prev) => ({ ...prev, visible: false })), []);

  // ----------- Favorite toggle (centralized service) -----------
  const toggleFavorite = useCallback(async () => {
    const id = plant?.id || plant?._id || plant?.inventoryId || plantId;
    if (!id) return showToast('Plant ID is missing', 'error');

    try {
      // optimistic
      setIsFavorite((prev) => !prev);

      // build snapshot for offline/fallback favorites
      const snapshot = {
        id,
        name: plant?.title || plant?.name || plant?.common_name || 'Plant',
        title: plant?.title || plant?.name || plant?.common_name || 'Plant',
        image:
          plant?.image ||
          plant?.mainImage ||
          (Array.isArray(plant?.images) && plant.images[0]) ||
          plant?.imageUrl ||
          null,
        price:
          plant?.price ??
          plant?.finalPrice ??
          plant?.pricing?.finalPrice ??
          0,
        seller: plant?.seller || null,
        isBusinessListing:
          !!(plant?.seller?.isBusiness || plant?.sellerType === 'business' || isBusinessParam),
      };

      const { wished } = await WishlistService.toggle(id, { snapshot });
      setIsFavorite(!!wished);

      try { await AsyncStorage.setItem('FAVORITES_UPDATED', Date.now().toString()); } catch {}
      showToast(wished ? 'Added to your favorites' : 'Removed from favorites', 'success');
    } catch (e) {
      // rollback
      setIsFavorite((prev) => !prev);
      console.error('Error toggling favorite:', e?.message || e);
      showToast('Failed to update favorites. Please try again.', 'error');
    }
  }, [plant, plantId, isBusinessParam, showToast]);

  // ----------- Contact seller -----------
  const handleContactSeller = useCallback(() => {
    const id = plant?._id || plant?.id || plant?.inventoryId || plantId;
    const sellerId =
      plant?.sellerId ||
      plant?.seller?._id ||
      plant?.seller?.email ||
      (isBusinessParam ? (plant?.businessId || businessId) : null);

    if (!id || !sellerId) {
      return showToast('Seller information is not available.', 'error');
    }

    const params = {
      sellerId,
      plantId: id,
      plantName: plant?.title || plant?.name || 'Plant',
      sellerName: plant?.seller?.name || plant?.sellerName || 'Plant Seller',
      isBusiness: !!(plant?.seller?.isBusiness || plant?.sellerType === 'business' || isBusinessParam)
    };

    try {
      // Try multiple navigation paths to reach Messages
      navigation.navigate('MarketplaceTabs', { 
        screen: 'Messages', 
        params 
      });
      showToast('Starting conversation with seller', 'info');
    } catch (e1) {
      try {
        navigation.navigate('MainTabs', { 
          screen: 'Messages', 
          params 
        });
        showToast('Starting conversation with seller', 'info');
      } catch (e2) {
        try {
          navigation.navigate('Messages', params);
          showToast('Starting conversation with seller', 'info');
        } catch (e3) {
          console.error('Error navigating to messages:', e3);
          showToast('Could not open messages. Please try again.', 'error');
        }
      }
    }
  }, [plant, plantId, isBusinessParam, businessId, navigation, showToast]);

  // ----------- Order business product -----------
  const handleOrderProduct = useCallback(async () => {
    const isBiz =
      plant?.isBusinessListing || plant?.sellerType === 'business' || plant?.seller?.isBusiness || isBusinessParam;

    if (!isBiz) return showToast('This is not a business product.', 'error');

    try {
      setIsProcessingOrder(true);
      const userEmail = await AsyncStorage.getItem('userEmail');
      const userName = (await AsyncStorage.getItem('userName')) || 'Customer';
      if (!userEmail) {
        setIsProcessingOrder(false);
        return showToast('Please log in to place an order.', 'error');
      }

      const price =
        plant?.price ??
        plant?.finalPrice ??
        plant?.pricing?.finalPrice ??
        0;

      Alert.alert(
        'Confirm Order',
        `Order ${plant?.title || plant?.name} for $${Math.round(price)}?\n\nThe business will contact you about pickup details.`,
        [
          { text: 'Cancel', style: 'cancel', onPress: () => setIsProcessingOrder(false) },
          {
            text: 'Order',
            onPress: async () => {
              try {
                showToast('Processing your order...', 'info');
                const productId = plant?.inventoryId || plant?.id || plant?._id || plantId;
                const bizId = plant?.businessId || plant?.sellerId || plant?.seller?._id || businessId;

                const result = await marketplaceApi.purchaseBusinessProduct(productId, bizId, 1, {
                  email: userEmail, name: userName, phone: '', notes: `Order for ${plant?.title || plant?.name}`,
                });
                if (result?.success) showToast('Order placed successfully!', 'success');
                else throw new Error(result?.message || 'Order failed');
              } catch (e) {
                console.error('Error placing order:', e);
                showToast('Failed to place order. Please try again.', 'error');
              } finally {
                setIsProcessingOrder(false);
              }
            },
          },
        ]
      );
    } catch (e) {
      console.error('Error preparing order:', e);
      showToast('Failed to prepare order. Please try again.', 'error');
      setIsProcessingOrder(false);
    }
  }, [plant, showToast, isBusinessParam, businessId, plantId]);

  const handleReviewButtonPress = useCallback(async () => {
    if (!plant && !plantId) return showToast('Plant information is not available', 'error');
    try {
      const userEmail = await AsyncStorage.getItem('userEmail');
      const sellerId = plant?.sellerId || plant?.seller?._id;
      if (userEmail && sellerId && userEmail === sellerId) {
        return showToast('You cannot review your own listing', 'error');
      }
      setShowReviewForm(true);
    } catch {
      showToast('User verification failed, proceeding anyway', 'warning');
      setShowReviewForm(true);
    }
  }, [plant, plantId, showToast]);

  const handleShareListing = useCallback(() => {
    try { showToast('Plant shared successfully', 'success'); }
    catch (e) { console.error('Error sharing plant:', e); showToast('Could not share this listing', 'error'); }
  }, [showToast]);

  const handleReviewSubmitted = useCallback(() => {
    setShowReviewForm(false);
    showToast('Your review has been submitted successfully!', 'success');
    loadPlantDetail();
  }, [showToast, loadPlantDetail]);

  const handleGetDirections = useCallback(() => {
    if (!plant?.location?.latitude || !plant?.location?.longitude) {
      return showToast('Location information is not available for this plant', 'error');
    }
    const lat = plant.location.latitude;
    const lng = plant.location.longitude;
    const label = encodeURIComponent(plant.title || plant.name || 'Plant Location');
    let url;
    if (Platform.OS === 'ios') url = `maps://app?daddr=${lat},${lng}&ll=${lat},${lng}&q=${label}`;
    else if (Platform.OS === 'android') url = `google.navigation:q=${lat},${lng}`;
    else url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&destination_place_id=${label}`;
    showToast('Opening directions...', 'info');
    Linking.openURL(url).catch(() => {
      const fallback = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
      Linking.openURL(fallback).catch(() =>
        showToast('Could not open maps application. Please check if you have a maps app installed.', 'error')
      );
    });
  }, [plant, showToast]);

  const handleExpandMap = useCallback(() => setMapModalVisible(true), []);
  const handleBackPress = useCallback(() => navigation.goBack(), [navigation]);
  const handleNotificationsPress = useCallback(() => {
    try { navigation.navigate('Messages'); } catch (e) { console.error('Nav error to messages:', e); }
  }, [navigation]);

  const handleSellerPress = useCallback(() => {
    if (!plant || (!plant.sellerId && !plant.seller?._id && !businessId)) {
      return showToast('Seller information is not available', 'error');
    }
    
    const sellerId = plant.sellerId || plant.seller?._id || businessId;
    const isBiz = plant.isBusinessListing || plant.sellerType === 'business' || plant.seller?.isBusiness || isBusinessParam;

    console.log('[PlantDetail] handleSellerPress:', {
      sellerId,
      isBiz,
      sellerType: plant.sellerType,
      isBusinessListing: plant.isBusinessListing,
      sellerIsBusiness: plant.seller?.isBusiness,
      isBusinessParam,
      businessId
    });

    if (isBiz) {
      // FIXED: Ensure we pass the correct businessId parameter
      const finalBusinessId = plant.businessId || businessId || sellerId;
      
      console.log('[PlantDetail] Navigating to BusinessSellerProfileScreen with businessId:', finalBusinessId);
      
      navigation.navigate('BusinessSellerProfileScreen', {
        sellerId: finalBusinessId, // Use the business ID as seller ID for businesses
        businessId: finalBusinessId, // Pass the same ID as businessId
        sellerName: plant.seller?.businessName || plant.seller?.name || plant.sellerName,
        isBusiness: true,
      });
    } else {
      // Navigate to individual seller profile
      console.log('[PlantDetail] Navigating to SellerProfile for individual:', sellerId);
      navigation.navigate('SellerProfile', {
        sellerId: sellerId,
      });
    }
  }, [plant, navigation, showToast, businessId, isBusinessParam]);

  // Images
  const images = useMemo(() => {
    if (!plant) return [];
    const imageSource = Array.isArray(plant.images) && plant.images.length > 0
        ? plant.images
        : plant.image
        ? [plant.image]
        : plant.photoUrl
        ? [plant.photoUrl]
        : [];
    return PlaceholderService.processImageArray(
      imageSource,
      plant.category
    );
  }, [plant]);

  // FIXED: Make sure business detection is comprehensive
  const isBusinessProduct = useMemo(
    () => {
      const isBiz = plant?.isBusinessListing || 
                   plant?.sellerType === 'business' || 
                   plant?.seller?.isBusiness || 
                   isBusinessParam ||
                   !!businessId;
      
      console.log('[PlantDetail] isBusinessProduct calculation:', {
        isBusinessListing: plant?.isBusinessListing,
        sellerType: plant?.sellerType,
        sellerIsBusiness: plant?.seller?.isBusiness,
        isBusinessParam,
        businessId: !!businessId,
        result: isBiz
      });
      
      return isBiz;
    },
    [plant?.isBusinessListing, plant?.sellerType, plant?.seller?.isBusiness, isBusinessParam, businessId]
  );

  // ----------- Loading / Error states -----------
  if (isLoading || error || !plant) {
    return (
      <SafeAreaView style={styles.container}>
        <MarketplaceHeader
          title="Plant Details"
          showBackButton
          onBackPress={handleBackPress}
          onNotificationsPress={handleNotificationsPress}
        />
        <LoadingError
          isLoading={isLoading}
          loadingText="Loading plant details..."
          error={error || (!plant && !isLoading ? 'Plant not found' : null)}
          onRetry={loadPlantDetail}
        />
      </SafeAreaView>
    );
  }

  // ----------- Main render -----------
  return (
    <SafeAreaView style={styles.container}>
      <MarketplaceHeader
        title={plant.title || plant.name || 'Plant Details'}
        showBackButton
        onBackPress={handleBackPress}
        onNotificationsPress={handleNotificationsPress}
      />

      <ToastMessage visible={toast.visible} message={toast.message} type={toast.type} onHide={hideToast} duration={3000} />

      <ScrollView style={styles.scrollView}>
        <ImageGallery
          images={images}
          plant={plant}
          onFavoritePress={toggleFavorite}
          onSharePress={handleShareListing}
          isFavorite={isFavorite}
        />

        <PlantInfoHeader
          name={plant.title || plant.name}
          category={plant.category}
          price={plant.price ?? plant.finalPrice ?? plant.pricing?.finalPrice}
          listedDate={plant.addedAt || plant.listedDate || plant.createdAt}
          location={plant.location || plant.city}
        />

        {/* FIXED: Restore the business badge structure from working code */}
        {isBusinessProduct && (
          <View style={styles.businessBadgeContainer}>
            <View style={styles.businessBadge}>
              <MaterialIcons name="store" size={16} color="#4CAF50" />
              <Text style={styles.businessBadgeText}>
                Business Product • Pickup at {plant.seller?.businessName || plant.businessInfo?.name || 'Business Location'}
              </Text>
              {plant.availability?.inStock !== false && (
                <View style={styles.availabilityIndicator}><Text style={styles.availabilityText}>Available</Text></View>
              )}
            </View>
            {plant.businessInfo?.verified && (
              <View style={styles.verifiedBusinessBadge}>
                <MaterialIcons name="verified" size={12} color="#2196F3" />
                <Text style={styles.verifiedBusinessText}>Verified Business</Text>
              </View>
            )}
          </View>
        )}

        <DescriptionSection description={plant.description} />
        <CareInfoSection careInfo={plant.careInfo || plant.careInstructions} />

        {plant.location && typeof plant.location === 'object' && plant.location.latitude && plant.location.longitude && (
          <View style={styles.section}>
            <PlantLocationMap plant={plant} onGetDirections={handleGetDirections} onExpandMap={handleExpandMap} />
          </View>
        )}

        <SellerCard
          seller={{
            // FIXED: Simplified seller data passing like the old code
            name: plant.seller?.name || plant.sellerName || 'Plant Enthusiast',
            avatar: plant.seller?.avatar || plant.seller?.profileImage,
            _id: plant.seller?._id || plant.sellerId,
            rating: plant.seller?.rating || plant.seller?.averageRating,
            totalReviews: plant.seller?.totalReviews || plant.seller?.reviewCount,
            isBusiness: isBusinessProduct,
            businessName: plant.seller?.businessName || plant.businessInfo?.name,
          }}
          onPress={handleSellerPress}
        />

        <ActionButtons
          isFavorite={isFavorite}
          onFavoritePress={toggleFavorite}
          onContactPress={handleContactSeller}
          onOrderPress={handleOrderProduct}
          onReviewPress={handleReviewButtonPress}
          isSending={isProcessingOrder}
          isBusinessProduct={isBusiness}
          plant={plant}
        />
      </ScrollView>

      <Modal visible={mapModalVisible} onRequestClose={() => setMapModalVisible(false)} animationType="slide" statusBarTranslucent>
        <View style={styles.modalContainer}>
          <StatusBar style="light" />
          <PlantLocationMap plant={plant} onGetDirections={handleGetDirections} expanded onClose={() => setMapModalVisible(false)} />
        </View>
      </Modal>

      <ReviewForm
        targetId={plant.id || plant._id || plant.inventoryId || plantId}
        targetType="product"
        isVisible={showReviewForm}
        onClose={() => setShowReviewForm(false)}
        onReviewSubmitted={handleReviewSubmitted}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  scrollView: { flex: 1 },
  section: { marginVertical: 16, paddingHorizontal: 16 },
  modalContainer: { flex: 1, backgroundColor: '#000' },
  businessBadgeContainer: { paddingHorizontal: 16, paddingVertical: 8 },
  businessBadge: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#e8f5e8',
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#4CAF50', marginBottom: 4,
  },
  businessBadgeText: { fontSize: 14, color: '#2E7D32', marginLeft: 6, fontWeight: '600', flex: 1 },
  availabilityIndicator: { backgroundColor: '#4CAF50', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  availabilityText: { fontSize: 10, color: '#fff', fontWeight: '600' },
  verifiedBusinessBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E3F2FD', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, alignSelf: 'flex-start' },
  verifiedBusinessText: { fontSize: 12, color: '#2196F3', marginLeft: 4, fontWeight: '500' },
});

export default PlantDetailScreen;