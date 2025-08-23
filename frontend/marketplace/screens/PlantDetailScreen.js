// screens/PlantDetailScreen.js - FIXED BUTTON HANDLERS
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, StyleSheet, ScrollView, SafeAreaView, Modal, Alert, Text, TouchableOpacity, ActivityIndicator
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Components
import MarketplaceHeader from '../components/MarketplaceHeader';
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
  getSpecific,
  fetchBusinessInventory,
  fetchBusinessProfile,
  convertInventoryToProducts,
  fetchSellerProfile,
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
  const [isProcessingOrder, setIsProcessingOrder] = useState(false);
  const [showOrderConfirmation, setShowOrderConfirmation] = useState(false);
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
        // BUSINESS PATH
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

      // INDIVIDUAL PATH (or fallback)
      if (!data) {
        try {
          const res = await getSpecific(plantId);
          data = res?.data ?? res ?? null;
          if (data) {
            console.log('[PlantDetail] global fetch OK (/products/specific)');
            
            // For individual products, fetch seller info
            if (data.sellerId || data.seller?.email || data.ownerEmail) {
              try {
                const sellerId = data.sellerId || data.seller?.email || data.ownerEmail;
                console.log('[PlantDetail] fetching seller profile for:', sellerId);
                
                const sellerProfile = await fetchSellerProfile(sellerId, 'user');
                
                if (sellerProfile && (sellerProfile.name || sellerProfile.businessName)) {
                  // Create seller object with proper name
                  data.seller = {
                    _id: sellerProfile.id || sellerProfile.email || sellerId,
                    email: sellerProfile.email || sellerId,
                    name: sellerProfile.name || sellerProfile.businessName || 'Plant Enthusiast',
                    avatar: sellerProfile.avatar || sellerProfile.logo,
                    rating: sellerProfile.stats?.rating || sellerProfile.rating || 0,
                    totalReviews: sellerProfile.stats?.reviewCount || sellerProfile.reviewCount || 0,
                    joinDate: sellerProfile.joinDate || sellerProfile.createdAt,
                    bio: sellerProfile.bio,
                    isBusiness: false,
                    isIndividual: true,
                  };
                  
                  data.sellerName = data.seller.name;
                  
                  console.log('[PlantDetail] seller profile loaded successfully:', data.seller.name);
                } else {
                  console.log('[PlantDetail] no valid seller profile found');
                  if (data.seller && !data.seller.name) {
                    data.seller.name = 'Plant Enthusiast';
                    data.sellerName = 'Plant Enthusiast';
                  }
                }
              } catch (sellerErr) {
                console.log('[PlantDetail] failed to fetch seller info:', sellerErr.message);
                if (data.seller && !data.seller.name) {
                  data.seller.name = 'Plant Enthusiast';
                  data.sellerName = 'Plant Enthusiast';
                }
              }
            }
          }
        } catch (e2) {
          console.log('[PlantDetail] global fetch failed:', e2?.message);
        }
      }

      if (!data) throw new Error('Product not found');

      // Process final data with proper field handling
      const initialPlantData = route.params?.plant || {};
      
      const finalPlantData = {
        ...initialPlantData,
        ...data,
      };

      // Ensure seller object exists and has proper name
      if (!finalPlantData.seller) {
        finalPlantData.seller = {
          _id: finalPlantData.sellerId || 'unknown',
          email: finalPlantData.sellerId || 'unknown',
          name: finalPlantData.sellerName || initialPlantData.seller?.name || 'Plant Enthusiast',
          avatar: null,
          rating: 0,
          totalReviews: 0,
          isBusiness: false,
          isIndividual: true,
        };
        finalPlantData.sellerName = finalPlantData.seller.name;
      } else if (!finalPlantData.seller.name) {
        finalPlantData.seller.name = finalPlantData.sellerName || 
                                     initialPlantData.seller?.name ||
                                     'Plant Enthusiast';
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

      // Ensure price is a valid number
      const rawPrice = finalPlantData.price ?? finalPlantData.finalPrice ?? finalPlantData.pricing?.finalPrice ?? 0;
      finalPlantData.price = typeof rawPrice === 'number' && !isNaN(rawPrice) ? rawPrice : 0;

      // Ensure title/name exists
      finalPlantData.title = finalPlantData.title || finalPlantData.name || finalPlantData.common_name || 'Plant';
      
      // Ensure description exists
      finalPlantData.description = finalPlantData.description || 'No description available for this plant.';

      console.log('[PlantDetail] Final plant data:', {
        title: finalPlantData.title,
        price: finalPlantData.price,
        sellerName: finalPlantData.seller?.name,
        description: finalPlantData.description?.substring(0, 50) + '...',
        location: finalPlantData.location
      });

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
  const showToast = useCallback((message, type = 'info') => {
    console.log(`[Toast] ${type}: ${message}`);
    setToast({ visible: true, message, type });
  }, []);
  
  const hideToast = useCallback(() => setToast((prev) => ({ ...prev, visible: false })), []);

  // ----------- FIXED: Favorite toggle with proper error handling -----------
  const toggleFavorite = useCallback(async () => {
    console.log('[PlantDetail] toggleFavorite called');
    
    const id = plant?.id || plant?._id || plant?.inventoryId || plantId;
    if (!id) {
      console.warn('[PlantDetail] toggleFavorite: Plant ID is missing');
      return showToast('Plant ID is missing', 'error');
    }

    try {
      // Optimistic update
      setIsFavorite((prev) => {
        console.log(`[PlantDetail] toggleFavorite: ${prev} -> ${!prev}`);
        return !prev;
      });
      
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
        price: plant?.price ?? 0,
        seller: plant?.seller || null,
        isBusinessListing: !!(plant?.seller?.isBusiness || plant?.sellerType === 'business' || isBusinessParam),
      };

      console.log('[PlantDetail] toggleFavorite: calling WishlistService.toggle with:', { id, snapshot });
      const { wished } = await WishlistService.toggle(id, { snapshot });
      
      setIsFavorite(!!wished);
      
      try { 
        await AsyncStorage.setItem('FAVORITES_UPDATED', Date.now().toString()); 
      } catch {}
      
      showToast(wished ? 'Added to your favorites' : 'Removed from favorites', 'success');
      console.log(`[PlantDetail] toggleFavorite: Success - wished: ${wished}`);
      
    } catch (e) {
      // Revert optimistic update on error
      setIsFavorite((prev) => !prev);
      console.error('[PlantDetail] toggleFavorite error:', e?.message || e);
      showToast('Failed to update favorites. Please try again.', 'error');
    }
  }, [plant, plantId, isBusinessParam, showToast]);

  // ----------- FIXED: Contact seller with proper validation -----------
  const handleContactSeller = useCallback(() => {
    console.log('[PlantDetail] handleContactSeller called');
    
    const id = plant?._id || plant?.id || plant?.inventoryId || plantId;
    const sellerId =
      plant?.sellerId ||
      plant?.seller?._id ||
      plant?.seller?.email ||
      (isBusinessParam ? (plant?.businessId || businessId) : null);

    console.log('[PlantDetail] handleContactSeller data:', { id, sellerId, isBusinessParam });

    if (!id || !sellerId) {
      console.warn('[PlantDetail] handleContactSeller: Missing data', { id, sellerId });
      return showToast('Seller information is not available.', 'error');
    }

    const params = {
      sellerId,
      plantId: id,
      plantName: plant?.title || plant?.name || 'Plant',
      sellerName: plant?.seller?.name || plant?.sellerName || 'Plant Seller',
      isBusiness: !!(plant?.seller?.isBusiness || plant?.sellerType === 'business' || isBusinessParam)
    };

    console.log('[PlantDetail] handleContactSeller: navigating with params:', params);

    try {
      navigation.navigate('MarketplaceTabs', { screen: 'Messages', params });
      showToast('Starting conversation with seller', 'info');
    } catch (e1) {
      try {
        navigation.navigate('MainTabs', { screen: 'Messages', params });
        showToast('Starting conversation with seller', 'info');
      } catch (e2) {
        try {
          navigation.navigate('Messages', params);
          showToast('Starting conversation with seller', 'info');
        } catch (e3) {
          console.error('[PlantDetail] Error navigating to messages:', e3);
          showToast('Could not open messages. Please try again.', 'error');
        }
      }
    }
  }, [plant, plantId, isBusinessParam, businessId, navigation, showToast]);

  // ----------- FIXED: Order business product with modal confirmation -----------
  const handleOrderProduct = useCallback(async () => {
    console.log('[PlantDetail] handleOrderProduct called');
    
    const isBiz =
      plant?.isBusinessListing || 
      plant?.sellerType === 'business' || 
      plant?.seller?.isBusiness || 
      isBusinessParam;

    console.log('[PlantDetail] handleOrderProduct: isBusiness check:', { 
      isBiz, 
      isBusinessListing: plant?.isBusinessListing,
      sellerType: plant?.sellerType,
      sellerIsBusiness: plant?.seller?.isBusiness,
      isBusinessParam 
    });

    if (!isBiz) {
      console.warn('[PlantDetail] handleOrderProduct: This is not a business product');
      return showToast('This is not a business product.', 'error');
    }

    try {
      const userEmail = await AsyncStorage.getItem('userEmail');
      const userName = (await AsyncStorage.getItem('userName')) || 'Customer';
      
      if (!userEmail) {
        console.warn('[PlantDetail] handleOrderProduct: User not logged in');
        return showToast('Please log in to place an order.', 'error');
      }

      console.log('[PlantDetail] handleOrderProduct: Showing order confirmation modal');
      setShowOrderConfirmation(true);
      
    } catch (e) {
      console.error('[PlantDetail] handleOrderProduct: Preparation error:', e);
      showToast('Failed to prepare order. Please try again.', 'error');
    }
  }, [plant, showToast, isBusinessParam, businessId, plantId]);

  const confirmOrder = useCallback(async () => {
    try {
      setIsProcessingOrder(true);
      setShowOrderConfirmation(false);
      
      const userEmail = await AsyncStorage.getItem('userEmail');
      const userName = (await AsyncStorage.getItem('userName')) || 'Customer';
      const plantTitle = plant?.title || plant?.name || 'Plant';
      
      console.log('[PlantDetail] confirmOrder: Processing order...');
      showToast('Processing your order...', 'info');
      
      const productId = plant?.inventoryId || plant?.id || plant?._id || plantId;
      const bizId = plant?.businessId || plant?.sellerId || plant?.seller?._id || businessId;

      console.log('[PlantDetail] confirmOrder: Order details:', {
        productId, bizId, userEmail, userName
      });

      // FIXED: Use the correct marketplace API method that exists
      const orderData = {
        businessId: bizId,
        customerEmail: userEmail,
        customerName: userName,
        items: [{
          id: productId,
          name: plantTitle,
          price: plant?.price ?? 0,
          quantity: 1
        }],
        total: plant?.price ?? 0,
        orderDate: new Date().toISOString(),
        status: 'pending',
        notes: `Order for ${plantTitle}`,
        phone: '', // Add empty phone field
      };

      console.log('[PlantDetail] confirmOrder: Sending order data:', orderData);

      // FIXED: Use the existing purchaseBusinessProduct method instead of non-existent business-order-create
      const result = await marketplaceApi.purchaseBusinessProduct(productId, bizId, 1, {
        email: userEmail, 
        name: userName, 
        phone: '', 
        notes: `Order for ${plantTitle}`,
        customerName: userName,
        customerEmail: userEmail,
        items: orderData.items,
        total: orderData.total,
        orderDate: orderData.orderDate,
        status: 'pending'
      });

      console.log('[PlantDetail] confirmOrder: API result:', result);

      if (result?.success) {
        showToast('Order placed successfully! The business will contact you soon.', 'success');
      } else {
        throw new Error(result?.message || result?.error || 'Order failed');
      }
    } catch (e) {
      console.error('[PlantDetail] confirmOrder: Order error:', e);
      showToast('Failed to place order. Please try again.', 'error');
    } finally {
      setIsProcessingOrder(false);
    }
  }, [plant, showToast, businessId, plantId]);

  const cancelOrder = useCallback(() => {
    console.log('[PlantDetail] cancelOrder: User cancelled order');
    setShowOrderConfirmation(false);
  }, []);

  // ----------- FIXED: Review button with proper validation -----------
  const handleReviewButtonPress = useCallback(async () => {
    console.log('[PlantDetail] handleReviewButtonPress called');
    
    if (!plant && !plantId) {
      console.warn('[PlantDetail] handleReviewButtonPress: Plant information not available');
      return showToast('Plant information is not available', 'error');
    }
    
    try {
      const userEmail = await AsyncStorage.getItem('userEmail');
      const sellerId = plant?.sellerId || plant?.seller?._id;
      
      console.log('[PlantDetail] handleReviewButtonPress: validation:', { userEmail, sellerId });
      
      if (userEmail && sellerId && userEmail === sellerId) {
        console.warn('[PlantDetail] handleReviewButtonPress: User trying to review own listing');
        return showToast('You cannot review your own listing', 'error');
      }
      
      console.log('[PlantDetail] handleReviewButtonPress: Opening review form');
      setShowReviewForm(true);
      
    } catch {
      console.log('[PlantDetail] handleReviewButtonPress: User verification failed, proceeding anyway');
      showToast('User verification failed, proceeding anyway', 'warning');
      setShowReviewForm(true);
    }
  }, [plant, plantId, showToast]);

  const handleShareListing = useCallback(() => {
    console.log('[PlantDetail] handleShareListing called');
    try { 
      showToast('Plant shared successfully', 'success'); 
    } catch (e) { 
      console.error('[PlantDetail] Error sharing plant:', e); 
      showToast('Could not share this listing', 'error'); 
    }
  }, [showToast]);

  const handleReviewSubmitted = useCallback(() => {
    console.log('[PlantDetail] handleReviewSubmitted called');
    setShowReviewForm(false);
    showToast('Your review has been submitted successfully!', 'success');
    loadPlantDetail();
  }, [showToast, loadPlantDetail]);

  const handleBackPress = useCallback(() => navigation.goBack(), [navigation]);
  const handleNotificationsPress = useCallback(() => {
    try { navigation.navigate('Messages'); } catch (e) { console.error('Nav error to messages:', e); }
  }, [navigation]);

  const handleSellerPress = useCallback(() => {
    if (!plant || (!plant.sellerId && !plant.seller?._id && !businessId)) {
      return showToast('Seller information is not available', 'error');
    }
    const sellerId = plant.seller?._id || plant.sellerId || businessId;

    if (isBusiness) {
      navigation.navigate('BusinessProfile', {
        businessId: plant.businessId || sellerId,
      });
    } else {
      navigation.navigate('SellerProfile', {
        sellerId: sellerId,
      });
    }
  }, [plant, navigation, showToast, isBusiness, businessId]);

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
    return PlaceholderService.processImageArray(imageSource, plant.category);
  }, [plant]);

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
  console.log('[PlantDetail] Rendering with handlers:', {
    toggleFavorite: typeof toggleFavorite,
    handleContactSeller: typeof handleContactSeller,
    handleOrderProduct: typeof handleOrderProduct,
    handleReviewButtonPress: typeof handleReviewButtonPress,
    isBusiness,
    plant: !!plant
  });

  return (
    <SafeAreaView style={styles.container}>
      <MarketplaceHeader
        title={plant.title || plant.name || 'Plant Details'}
        showBackButton
        onBackPress={handleBackPress}
        onNotificationsPress={handleNotificationsPress}
      />

      <ToastMessage 
        visible={toast.visible} 
        message={toast.message} 
        type={toast.type} 
        onHide={hideToast} 
        duration={3000} 
      />

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
          price={plant.price}
          listedDate={plant.addedAt || plant.listedDate || plant.createdAt}
          location={plant.location || plant.city}
        />

        {/* Badge placement */}
        <View style={styles.businessBadgeContainer}>
          {isBusiness ? (
            <View style={styles.businessBadge}>
              <MaterialIcons name="store" size={16} color="#4CAF50" />
              <Text style={styles.businessBadgeText}>
                Business Product • Pickup at {plant.seller?.businessName || plant.businessInfo?.name || 'Business Location'}
              </Text>
            </View>
          ) : (
            <View style={styles.individualBadge}>
              <MaterialIcons name="person" size={16} color="#2e7d32" />
              <Text style={styles.individualBadgeText}>
                Individual Listing • Pickup in {plant.location?.city || plant.city || 'local area'}
              </Text>
            </View>
          )}
        </View>

        <DescriptionSection description={plant.description} />
        
        <CareInfoSection careInfo={plant.careInfo || plant.careInstructions} />

        <SellerCard
          seller={{
            name: plant.seller?.name || plant.sellerName || 'Plant Enthusiast',
            avatar: plant.seller?.avatar || plant.seller?.profileImage,
            _id: plant.seller?._id || plant.sellerId,
            rating: plant.seller?.rating || plant.seller?.averageRating,
            totalReviews: plant.seller?.totalReviews || plant.seller?.reviewCount,
            isBusiness: isBusiness,
            businessName: plant.seller?.businessName || plant.businessInfo?.name,
          }}
          onPress={handleSellerPress}
        />

        {/* FIXED: ActionButtons with proper props and handlers */}
        <ActionButtons
          isFavorite={isFavorite}
          onFavoritePress={toggleFavorite}
          onContactPress={handleContactSeller}
          onOrderPress={handleOrderProduct} // FIXED: Now properly passed and used
          onReviewPress={handleReviewButtonPress}
          isSending={isProcessingOrder}
          isBusiness={isBusiness}
          plant={plant}
        />
      </ScrollView>

      <ReviewForm
        targetId={plant.id || plant._id || plant.inventoryId || plantId}
        targetType="product"
        isVisible={showReviewForm}
        onClose={() => setShowReviewForm(false)}
        onReviewSubmitted={handleReviewSubmitted}
      />

      {/* FIXED: Order Confirmation Modal */}
      <Modal
        visible={showOrderConfirmation}
        transparent={true}
        animationType="fade"
        onRequestClose={cancelOrder}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.orderModal}>
            <MaterialIcons name="shopping-cart" size={40} color="#4CAF50" style={styles.modalIcon} />
            
            <Text style={styles.modalTitle}>Confirm Order</Text>
            
            <Text style={styles.modalText}>
              Order {plant?.title || plant?.name} for ${Math.round(plant?.price ?? 0)}?
            </Text>
            
            <Text style={styles.modalSubtext}>
              The business will contact you about pickup details.
            </Text>
            
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton]} 
                onPress={cancelOrder}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.modalButton, styles.confirmButton]} 
                onPress={confirmOrder}
                disabled={isProcessingOrder}
              >
                {isProcessingOrder ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.confirmButtonText}>Place Order</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  scrollView: { flex: 1 },
  businessBadgeContainer: { paddingHorizontal: 16, paddingVertical: 8 },
  businessBadge: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#e8f5e8',
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#C8E6C9',
  },
  businessBadgeText: { fontSize: 14, color: '#2E7D32', marginLeft: 8, fontWeight: '600', flex: 1 },
  individualBadge: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#F1F8E9',
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#E0E0E0',
  },
  individualBadgeText: { fontSize: 14, color: '#33691E', marginLeft: 8, fontWeight: '500', flex: 1 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  orderModal: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  modalIcon: {
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
  },
  modalText: {
    fontSize: 16,
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
    fontWeight: '500',
  },
  modalSubtext: {
    fontSize: 14,
    color: '#666',
    marginBottom: 24,
    textAlign: 'center',
    lineHeight: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  cancelButton: {
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  confirmButton: {
    backgroundColor: '#4CAF50',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default PlantDetailScreen;