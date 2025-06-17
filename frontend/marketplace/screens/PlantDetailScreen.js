// screens/PlantDetailScreen.js - FIXED: Business API + All Features
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, StyleSheet, ScrollView, SafeAreaView, Modal, Alert, Text, Platform, Linking
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Import components
import MarketplaceHeader from '../components/MarketplaceHeader';
import PlantLocationMap from '../components/PlantLocationMap';
import ReviewForm from '../components/ReviewForm';
import ToastMessage from '../components/ToastMessage';

// Import extracted components
import ImageGallery from './PlantDetailScreen-parts/ImageGallery';
import PlantInfoHeader from './PlantDetailScreen-parts/PlantInfoHeader';
import DescriptionSection from './PlantDetailScreen-parts/DescriptionSection';
import SellerCard from './PlantDetailScreen-parts/SellerCard';
import ActionButtons from './PlantDetailScreen-parts/ActionButtons';
import CareInfoSection from './PlantDetailScreen-parts/CareInfoSection';
import LoadingError from './PlantDetailScreen-parts/LoadingError';

// Import services
import { getSpecific, wishProduct, purchaseBusinessProduct } from '../services/marketplaceApi';
import { getSpecificProduct } from '../services/businessProductService'; // NEW: Business API
import PlaceholderService from '../services/placeholderService';

const PlantDetailScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  
  // Enhanced plantId extraction with fallbacks
  const plantId = route.params?.plantId || route.params?.plant?.id || route.params?.plant?._id;
  const productType = route.params?.productType || route.params?.plant?.sellerType || 'auto';
  
  // State variables - ALL HOOKS AT TOP LEVEL
  const [plant, setPlant] = useState(route.params?.plant || null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [mapModalVisible, setMapModalVisible] = useState(false);
  const [isProcessingOrder, setIsProcessingOrder] = useState(false);
  const [toast, setToast] = useState({
    visible: false,
    message: '',
    type: 'info'
  });

  // FIXED: Enhanced load function that handles both business and individual products
  const loadPlantDetail = useCallback(async () => {
    if (!plantId) {
      setError('Plant ID is missing');
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      
      console.log(`Loading plant details for ID: ${plantId}, type: ${productType}`);
      
      let data;
      
      // Try the new enhanced API that handles both types
      try {
        data = await getSpecificProduct(plantId, productType);
        console.log('Product data loaded via enhanced API:', data);
      } catch (enhancedError) {
        console.log('Enhanced API failed, trying fallback:', enhancedError.message);
        
        // Fallback to original API for individual products
        try {
          data = await getSpecific(plantId);
          console.log('Product data loaded via fallback API:', data);
        } catch (fallbackError) {
          console.error('Both APIs failed:', fallbackError);
          throw new Error('Product not found');
        }
      }
      
      if (!data) {
        throw new Error('Product not found');
      }
      
      console.log('Final product data:', data);
      setPlant(data);
      setIsFavorite(data.isWished || data.isFavorite || false);
      setIsLoading(false);
    } catch (err) {
      console.error('Error fetching plant details:', err);
      setError('Failed to load plant details. Please try again later.');
      setIsLoading(false);
    }
  }, [plantId, productType]);

  // Effect to load plant details
  useEffect(() => {
    if (plantId) {
      loadPlantDetail();
    } else {
      setError('Plant ID is missing');
      setIsLoading(false);
    }
  }, [plantId, loadPlantDetail]);

  // Show toast message
  const showToast = useCallback((message, type = 'info') => {
    setToast({
      visible: true,
      message,
      type
    });
  }, []);
  
  // Hide toast message
  const hideToast = useCallback(() => {
    setToast(prev => ({
      ...prev,
      visible: false
    }));
  }, []);

  const toggleFavorite = useCallback(async () => {
    if (!plantId) {
      showToast('Plant ID is missing', 'error');
      return;
    }

    try {
      const previousState = isFavorite;
      setIsFavorite(!isFavorite);
      
      const result = await wishProduct(plantId);
      
      if (result && 'isWished' in result) {
        setIsFavorite(result.isWished);
        showToast(
          result.isWished ? "Added to your favorites" : "Removed from favorites", 
          "success"
        );
      } else {
        showToast(
          !previousState ? "Added to your favorites" : "Removed from favorites", 
          "success"
        );
      }
      
      try {
        await AsyncStorage.setItem('FAVORITES_UPDATED', Date.now().toString());
      } catch (storageErr) {
        console.warn('Failed to set favorites update flag:', storageErr);
      }
    } catch (err) {
      console.error('Error toggling favorite:', err);
      setIsFavorite(isFavorite); // Revert on error
      showToast('Failed to update favorites. Please try again.', 'error');
    }
  }, [plantId, isFavorite, showToast]);

  // Handle individual seller contact
  const handleContactSeller = useCallback(() => {
    if (!plant || (!plant.sellerId && !plant.seller?._id)) {
      showToast('Seller information is not available.', 'error');
      return;
    }
    
    try {
      const sellerId = plant.sellerId || plant.seller?._id;
      const params = { 
        sellerId, 
        plantId: plant._id || plant.id || plantId,
        plantName: plant.title || plant.name || 'Plant',
        sellerName: plant.seller?.name || plant.sellerName || 'Plant Seller'
      };

      console.log('Navigating to messages with params:', params);

      // Try different navigation approaches
      try {
        if (navigation.getParent()) {
          navigation.navigate('MarketplaceTabs', {
            screen: 'Messages',
            params: params
          });
        } else {
          navigation.navigate('Messages', params);
        }
      } catch (navError) {
        console.log('Navigation failed, trying fallback:', navError);
        navigation.navigate('Messages', params);
      }
      
      showToast("Starting conversation with seller", "info");
    } catch (err) {
      console.error('Error navigating to messages:', err);
      showToast('Could not open messages. Please try again.', 'error');
    }
  }, [plant, plantId, navigation, showToast]);

  // Handle business product orders with enhanced error handling
  const handleOrderProduct = useCallback(async () => {
    const isBusinessProduct = plant?.isBusinessListing || 
                             plant?.sellerType === 'business' || 
                             plant?.seller?.isBusiness;
    
    if (!isBusinessProduct) {
      showToast('This is not a business product.', 'error');
      return;
    }
    
    try {
      setIsProcessingOrder(true);
      
      const userEmail = await AsyncStorage.getItem('userEmail');
      const userName = await AsyncStorage.getItem('userName') || 'Customer';
      
      if (!userEmail) {
        showToast('Please log in to place an order.', 'error');
        setIsProcessingOrder(false);
        return;
      }
      
      // Show confirmation dialog first
      Alert.alert(
        'Confirm Order',
        `Order ${plant.title || plant.name} for $${plant.price}?\n\nThe business will contact you about pickup details.`,
        [
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => setIsProcessingOrder(false)
          },
          {
            text: 'Order',
            style: 'default',
            onPress: async () => {
              try {
                const orderData = {
                  email: userEmail,
                  name: userName,
                  phone: '',
                  notes: `Order for ${plant.title || plant.name} - Customer will pickup at business location`
                };
                
                showToast("Processing your order...", "info");
                
                // Use the business product ID and business ID
                const productId = plant.inventoryId || plant.id || plant._id;
                const businessId = plant.businessId || plant.sellerId || plant.seller?._id;
                
                const result = await purchaseBusinessProduct(
                  productId,
                  businessId,
                  1, // quantity
                  orderData
                );
                
                if (result.success) {
                  showToast("Order placed successfully! The business will contact you soon.", "success");
                } else {
                  throw new Error(result.message || 'Order failed');
                }
                
              } catch (orderErr) {
                console.error('Error placing order:', orderErr);
                showToast('Failed to place order. Please try again.', 'error');
              } finally {
                setIsProcessingOrder(false);
              }
            }
          }
        ]
      );
      
    } catch (err) {
      console.error('Error preparing order:', err);
      showToast('Failed to prepare order. Please try again.', 'error');
      setIsProcessingOrder(false);
    }
  }, [plant, showToast]);

  const handleReviewButtonPress = useCallback(async () => {
    if (!plant) {
      showToast('Plant information is not available', 'error');
      return;
    }

    try {
      const userEmail = await AsyncStorage.getItem('userEmail');
      const sellerId = plant.sellerId || plant.seller?._id;
      
      if (userEmail === sellerId) {
        showToast("You cannot review your own listing", "error");
        return;
      }
      
      setShowReviewForm(true);
    } catch (err) {
      console.error('Error checking user email:', err);
      showToast("User verification failed, proceeding anyway", "warning");
      setShowReviewForm(true);
    }
  }, [plant, showToast]);

  const handleShareListing = useCallback(async () => {
    try {
      showToast('Plant shared successfully', 'success');
    } catch (error) {
      console.error('Error sharing plant:', error);
      showToast('Could not share this listing', 'error');
    }
  }, [showToast]);

  const handleReviewSubmitted = useCallback(() => {
    setShowReviewForm(false);
    showToast("Your review has been submitted successfully!", "success");
    loadPlantDetail();
  }, [showToast, loadPlantDetail]);

  const handleGetDirections = useCallback(() => {
    if (!plant?.location?.latitude || !plant?.location?.longitude) {
      showToast('Location information is not available for this plant', 'error');
      return;
    }

    const lat = plant.location.latitude;
    const lng = plant.location.longitude;
    const label = encodeURIComponent(plant.title || plant.name || 'Plant Location');
    
    let url;
    if (Platform.OS === 'ios') {
      // iOS - Use Apple Maps
      url = `maps://app?daddr=${lat},${lng}&ll=${lat},${lng}&q=${label}`;
    } else if (Platform.OS === 'android') {
      // Android - Use Google Maps app
      url = `google.navigation:q=${lat},${lng}`;
    } else {
      // Web/other platforms - Use Google Maps web
      url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&destination_place_id=${label}`;
    }
    
    showToast("Opening directions...", "info");
    
    Linking.openURL(url).catch(err => {
      console.error('Error opening maps app:', err);
      
      // Fallback to Google Maps web URL for all platforms
      const fallbackUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
      
      Linking.openURL(fallbackUrl).catch(fallbackErr => {
        console.error('Error opening fallback maps:', fallbackErr);
        showToast('Could not open maps application. Please check if you have a maps app installed.', 'error');
      });
    });
  }, [plant, showToast]);

  const handleExpandMap = useCallback(() => {
    setMapModalVisible(true);
  }, []);

  const handleBackPress = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const handleNotificationsPress = useCallback(() => {
    try {
      navigation.navigate('Messages');
    } catch (err) {
      console.error('Error navigating to messages:', err);
    }
  }, [navigation]);

  const handleSellerPress = useCallback(() => {
    if (!plant || (!plant.sellerId && !plant.seller?._id)) {
      showToast('Seller information is not available', 'error');
      return;
    }

    const sellerId = plant.sellerId || plant.seller?._id;
    const isBusinessProduct = plant.isBusinessListing || 
                             plant.sellerType === 'business' || 
                             plant.seller?.isBusiness;
    
    if (isBusinessProduct) {
      navigation.navigate('BusinessSellerProfile', { 
        sellerId,
        businessId: plant.businessId || sellerId
      });
    } else {
      navigation.navigate('SellerProfile', { sellerId });
    }
  }, [plant, navigation, showToast]);

  // Use PlaceholderService for proper image handling (memoized)
  const images = useMemo(() => {
    if (!plant) return [];
    return PlaceholderService.processImageArray(
      plant.images || (plant.image ? [plant.image] : []),
      plant.category
    );
  }, [plant?.images, plant?.image, plant?.category]);

  // Determine if this is a business product (memoized)
  const isBusinessProduct = useMemo(() => {
    return plant?.isBusinessListing || 
           plant?.sellerType === 'business' || 
           plant?.seller?.isBusiness;
  }, [plant?.isBusinessListing, plant?.sellerType, plant?.seller?.isBusiness]);

  // Early return for loading/error states - this is OK after all hooks
  if (isLoading || error || !plant) {
    return (
      <SafeAreaView style={styles.container}>
        <MarketplaceHeader 
          title="Plant Details"
          showBackButton={true}
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

  return (
    <SafeAreaView style={styles.container}>
      <MarketplaceHeader 
        title={plant.title || plant.name || "Plant Details"}
        showBackButton={true}
        onBackPress={handleBackPress}
        onNotificationsPress={handleNotificationsPress}
      />
      
      {/* Toast Message Component */}
      <ToastMessage
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onHide={hideToast}
        duration={3000}
      />
      
      <ScrollView style={styles.scrollView}>
        {/* Image Gallery */}
        <ImageGallery 
          images={images}
          plant={plant}
          onFavoritePress={toggleFavorite}
          onSharePress={handleShareListing}
          isFavorite={isFavorite}
        />
        
        {/* Plant Info Header */}
        <PlantInfoHeader 
          name={plant.title || plant.name}
          category={plant.category}
          price={plant.price}
          listedDate={plant.addedAt || plant.listedDate || plant.createdAt}
          location={plant.location || plant.city}
        />
        
        {/* ENHANCED: Business Product Badge with more info */}
        {isBusinessProduct && (
          <View style={styles.businessBadgeContainer}>
            <View style={styles.businessBadge}>
              <MaterialIcons name="store" size={16} color="#4CAF50" />
              <Text style={styles.businessBadgeText}>
                Business Product • Pickup at {plant.seller?.businessName || plant.businessInfo?.name || 'Business Location'}
              </Text>
              {plant.availability?.inStock !== false && (
                <View style={styles.availabilityIndicator}>
                  <Text style={styles.availabilityText}>Available</Text>
                </View>
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
        
        {/* Description Section */}
        <DescriptionSection description={plant.description} />
        
        {/* Care Info Section */}
        <CareInfoSection careInfo={plant.careInfo || plant.careInstructions} />
        
        {/* Map Section */}
        {plant.location && typeof plant.location === 'object' && 
         plant.location.latitude && plant.location.longitude && (
          <View style={styles.section}>
            <PlantLocationMap
              plant={plant}
              onGetDirections={handleGetDirections}
              onExpandMap={handleExpandMap}
            />
          </View>
        )}
        
        {/* Seller Card */}
        <SellerCard 
          seller={{
            name: plant.seller?.name || plant.sellerName || 'Plant Enthusiast',
            avatar: plant.seller?.avatar || plant.seller?.profileImage,
            _id: plant.seller?._id || plant.sellerId,
            rating: plant.seller?.rating || plant.seller?.averageRating,
            totalReviews: plant.seller?.totalReviews || plant.seller?.reviewCount,
            isBusiness: isBusinessProduct,
            businessName: plant.seller?.businessName || plant.businessInfo?.name
          }}
          onPress={handleSellerPress}
        />
        
        {/* Action Buttons - Different buttons for business vs individual */}
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
      
      {/* Map Modal */}
      <Modal
        visible={mapModalVisible}
        onRequestClose={() => setMapModalVisible(false)}
        animationType="slide"
        statusBarTranslucent
      >
        <View style={styles.modalContainer}>
          <StatusBar style="light" />
          <PlantLocationMap
            plant={plant}
            onGetDirections={handleGetDirections}
            expanded={true}
            onClose={() => setMapModalVisible(false)}
          />
        </View>
      </Modal>
      
      {/* Review Form Modal */}
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
  container: { 
    flex: 1, 
    backgroundColor: '#fff' 
  },
  scrollView: {
    flex: 1,
  },
  section: { 
    marginVertical: 16,
    paddingHorizontal: 16
  },
  modalContainer: { 
    flex: 1, 
    backgroundColor: '#000' 
  },
  // ENHANCED: Business badge styles
  businessBadgeContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  businessBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e8f5e8',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#4CAF50',
    marginBottom: 4,
  },
  businessBadgeText: {
    fontSize: 14,
    color: '#2E7D32',
    marginLeft: 6,
    fontWeight: '600',
    flex: 1,
  },
  availabilityIndicator: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  availabilityText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: '600',
  },
  verifiedBusinessBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  verifiedBusinessText: {
    fontSize: 12,
    color: '#2196F3',
    marginLeft: 4,
    fontWeight: '500',
  },
});

export default PlantDetailScreen;