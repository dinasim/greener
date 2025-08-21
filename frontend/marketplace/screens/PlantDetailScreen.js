// screens/PlantDetailScreen.js - FIXED: Business-aware fetch + safe fallbacks
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
import { getSpecific, wishProduct, purchaseBusinessProduct } from '../services/marketplaceApi';
import { getSpecificProduct } from '../services/businessProductService'; // business endpoint (newer)

import PlaceholderService from '../services/placeholderService';

const PlantDetailScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();

  // ----------- Params & typing -----------
  const plantId =
    route?.params?.plantId ||
    route?.params?.plant?.id ||
    route?.params?.plant?._id;

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

  const isBusinessParam = typeParam === 'business' || !!businessId;

  console.log('[PlantDetail params]', { plantId, businessId, typeParam });

  // ----------- State -----------
  const [plant, setPlant] = useState(route?.params?.plant || null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [mapModalVisible, setMapModalVisible] = useState(false);
  const [isProcessingOrder, setIsProcessingOrder] = useState(false);
  const [toast, setToast] = useState({ visible: false, message: '', type: 'info' });

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

      // 1) Prefer business-scoped endpoint when we have businessId
      if (isBusinessParam && businessId) {
        try {
          // correct signature: (productId, 'business', businessId)
          const res = await getSpecificProduct(plantId, 'business', businessId);
          data = res?.data ?? res;
          console.log('[PlantDetail] business fetch OK');
        } catch (e1) {
          console.log('[PlantDetail] business fetch failed:', e1?.message);
        }
      }

      // 2) Global fallback
      if (!data) {
        try {
          const res = await getSpecific(plantId);
          data = res?.data ?? res;
          console.log('[PlantDetail] global fetch OK (/products/specific)');
        } catch (e2) {
          console.log('[PlantDetail] global fetch failed:', e2?.message);
        }
      }

      if (!data) throw new Error('Product not found');

      setPlant(data);
      setIsFavorite(Boolean(data.isWished || data.isFavorite));
      setIsLoading(false);
    } catch (err) {
      console.error('Error fetching plant details:', err);
      setError('Failed to load plant details. Please try again later.');
      setIsLoading(false);
    }
  }, [plantId, businessId, isBusinessParam]);

  useEffect(() => {
    if (plantId) {
      loadPlantDetail();
    } else {
      setError('Plant ID is missing');
      setIsLoading(false);
    }
  }, [plantId, loadPlantDetail]);

  // ----------- Toast helpers -----------
  const showToast = useCallback((message, type = 'info') => {
    setToast({ visible: true, message, type });
  }, []);
  const hideToast = useCallback(() => setToast(prev => ({ ...prev, visible: false })), []);

  // ----------- Favorite toggle -----------
  const toggleFavorite = useCallback(async () => {
    if (!plantId) return showToast('Plant ID is missing', 'error');
    try {
      const prev = isFavorite;
      setIsFavorite(!prev);
      const result = await wishProduct(plantId);
      if (result && 'isWished' in result) {
        setIsFavorite(result.isWished);
        showToast(result.isWished ? 'Added to your favorites' : 'Removed from favorites', 'success');
      } else {
        showToast(!prev ? 'Added to your favorites' : 'Removed from favorites', 'success');
      }
      try { await AsyncStorage.setItem('FAVORITES_UPDATED', Date.now().toString()); } catch {}
    } catch (e) {
      console.error('Error toggling favorite:', e);
      showToast('Failed to update favorites. Please try again.', 'error');
    }
  }, [plantId, isFavorite, showToast]);

  // ----------- Contact seller -----------
  const handleContactSeller = useCallback(() => {
    if (!plant || (!plant.sellerId && !plant.seller?._id)) {
      return showToast('Seller information is not available.', 'error');
    }
    const sellerId = plant.sellerId || plant.seller?._id;
    const params = {
      sellerId,
      plantId: plant._id || plant.id || plantId,
      plantName: plant.title || plant.name || 'Plant',
      sellerName: plant.seller?.name || plant.sellerName || 'Plant Seller',
    };
    try {
      navigation.navigate('Messages', params);
      showToast('Starting conversation with seller', 'info');
    } catch (e) {
      console.error('Error navigating to messages:', e);
      showToast('Could not open messages. Please try again.', 'error');
    }
  }, [plant, plantId, navigation, showToast]);

  // ----------- Order business product -----------
  const handleOrderProduct = useCallback(async () => {
    const isBusinessProduct =
      plant?.isBusinessListing || plant?.sellerType === 'business' || plant?.seller?.isBusiness;

    if (!isBusinessProduct) return showToast('This is not a business product.', 'error');

    try {
      setIsProcessingOrder(true);
      const userEmail = await AsyncStorage.getItem('userEmail');
      const userName = (await AsyncStorage.getItem('userName')) || 'Customer';
      if (!userEmail) {
        setIsProcessingOrder(false);
        return showToast('Please log in to place an order.', 'error');
      }

      Alert.alert(
        'Confirm Order',
        `Order ${plant.title || plant.name} for $${plant.price}?\n\nThe business will contact you about pickup details.`,
        [
          { text: 'Cancel', style: 'cancel', onPress: () => setIsProcessingOrder(false) },
          {
            text: 'Order',
            onPress: async () => {
              try {
                showToast('Processing your order...', 'info');
                const productId = plant.inventoryId || plant.id || plant._id;
                const bizId = plant.businessId || plant.sellerId || plant.seller?._id;
                const result = await purchaseBusinessProduct(productId, bizId, 1, {
                  email: userEmail, name: userName, phone: '', notes: `Order for ${plant.title || plant.name}`,
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
  }, [plant, showToast]);

  const handleReviewButtonPress = useCallback(async () => {
    if (!plant) return showToast('Plant information is not available', 'error');
    try {
      const userEmail = await AsyncStorage.getItem('userEmail');
      const sellerId = plant.sellerId || plant.seller?._id;
      if (userEmail === sellerId) return showToast('You cannot review your own listing', 'error');
      setShowReviewForm(true);
    } catch {
      showToast('User verification failed, proceeding anyway', 'warning');
      setShowReviewForm(true);
    }
  }, [plant, showToast]);

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
    if (!plant || (!plant.sellerId && !plant.seller?._id)) {
      return showToast('Seller information is not available', 'error');
    }
    const sellerId = plant.sellerId || plant.seller?._id;
    const isBiz = plant.isBusinessListing || plant.sellerType === 'business' || plant.seller?.isBusiness;
    if (isBiz) {
      navigation.navigate('BusinessSellerProfile', { sellerId, businessId: plant.businessId || sellerId });
    } else {
      navigation.navigate('SellerProfile', { sellerId });
    }
  }, [plant, navigation, showToast]);

  // Images
  const images = useMemo(() => {
    if (!plant) return [];
    return PlaceholderService.processImageArray(
      plant.images || (plant.image ? [plant.image] : []),
      plant.category
    );
  }, [plant?.images, plant?.image, plant?.category]);

  const isBusinessProduct = useMemo(
    () => plant?.isBusinessListing || plant?.sellerType === 'business' || plant?.seller?.isBusiness,
    [plant?.isBusinessListing, plant?.sellerType, plant?.seller?.isBusiness]
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
          price={plant.price}
          listedDate={plant.addedAt || plant.listedDate || plant.createdAt}
          location={plant.location || plant.city}
        />

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
          isBusinessProduct={isBusinessProduct}
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
        targetId={plant.id || plant._id || plantId}
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
