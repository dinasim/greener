// screens/PlantDetailScreen.js (corrected imports)
import React, { useState, useEffect } from 'react';
import {
  View, StyleSheet, ScrollView, SafeAreaView, Modal
} from 'react-native';
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
import { getSpecific, wishProduct } from '../services/marketplaceApi';

const PlantDetailScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const { plantId } = route.params;
  
  // State variables
  const [plant, setPlant] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [mapModalVisible, setMapModalVisible] = useState(false);
  const [toast, setToast] = useState({
    visible: false,
    message: '',
    type: 'info'
  });

  useEffect(() => {
    loadPlantDetail();
  }, [plantId]);

  const loadPlantDetail = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await getSpecific(plantId);
      if (!data) {
        throw new Error('Plant not found');
      }
      setPlant(data);
      setIsFavorite(data.isWished || false);
      setIsLoading(false);
    } catch (err) {
      setError('Failed to load plant details. Please try again later.');
      setIsLoading(false);
      console.error('Error fetching plant details:', err);
    }
  };

  // Show toast message
  const showToast = (message, type = 'info') => {
    setToast({
      visible: true,
      message,
      type
    });
  };
  
  // Hide toast message
  const hideToast = () => {
    setToast(prev => ({
      ...prev,
      visible: false
    }));
  };

  const toggleFavorite = async () => {
    try {
      setIsFavorite(!isFavorite);
      const result = await wishProduct(plantId);
      if (result && 'isWished' in result) {
        setIsFavorite(result.isWished);
        showToast(
          result.isWished ? "Added to your favorites" : "Removed from favorites", 
          "success"
        );
      }
      AsyncStorage.setItem('FAVORITES_UPDATED', Date.now().toString())
        .catch(err => console.warn('Failed to set favorites update flag:', err));
    } catch (err) {
      setIsFavorite(isFavorite);
      showToast('Failed to update favorites. Please try again.', 'error');
      console.error('Error toggling favorite:', err);
    }
  };

  // Updated handleContactSeller function for PlantDetailScreen.js
const handleContactSeller = () => {
  if (!plant.sellerId && !plant.seller?._id) {
    showToast('Seller information is not available.', 'error');
    return;
  }
  
  try {
    const params = { 
      sellerId: plant.sellerId || plant.seller?._id, 
      plantId: plant._id || plant.id,
      plantName: plant.title || plant.name,
      sellerName: plant.seller?.name || 'Plant Seller'
    };

    // Try different navigation approaches to handle various navigation structures
    if (navigation.getParent()) {
      // Navigate to nested Messages screen within tabs
      navigation.navigate('MarketplaceTabs', {
        screen: 'Messages',
        params: params
      });
    } else {
      // Direct navigation (fallback)
      navigation.navigate('Messages', params);
    }
    
    showToast("Starting conversation with seller", "info");
  } catch (err) {
    console.error('Error navigating to messages:', err);
    showToast('Could not open messages. Please try again.', 'error');
  }
};

  const handleReviewButtonPress = () => {
    AsyncStorage.getItem('userEmail')
      .then(userEmail => {
        if (userEmail === plant.sellerId || userEmail === plant.seller?._id) {
          showToast("You cannot review your own listing", "error");
          return;
        }
        
        setShowReviewForm(true);
      })
      .catch(err => {
        console.error('Error checking user email:', err);
        showToast("User verification failed, proceeding anyway", "warning");
        setShowReviewForm(true);
      });
  };

  const handleShareListing = async () => {
    try {
      // Share functionality (implementation not shown for brevity)
      showToast('Plant shared successfully', 'success');
    } catch (error) {
      console.error('Error sharing plant:', error);
      showToast('Could not share this listing', 'error');
    }
  };

  const handleReviewSubmitted = () => {
    setShowReviewForm(false);
    showToast("Your review has been submitted successfully!", "success");
    loadPlantDetail();
  };

  const handleGetDirections = () => {
    // Map directions functionality (implementation not shown for brevity)
    showToast("Opening map directions", "info");
  };

  const handleExpandMap = () => {
    setMapModalVisible(true);
  };

  if (isLoading || error || !plant) {
    return (
      <SafeAreaView style={styles.container}>
        <MarketplaceHeader 
          title="Plant Details"
          showBackButton={true}
          onBackPress={() => navigation.goBack()}
          onNotificationsPress={() => navigation.navigate('Messages')}
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

  const images = plant.images && plant.images.length > 0 
    ? plant.images 
    : [plant.image || plant.imageUrl || 'https://via.placeholder.com/400?text=Plant'];

  return (
    <SafeAreaView style={styles.container}>
      <MarketplaceHeader 
        title={plant.title || plant.name || "Plant Details"}
        showBackButton={true}
        onBackPress={() => navigation.goBack()}
        onNotificationsPress={() => navigation.navigate('Messages')}
      />
      
      {/* Toast Message Component */}
      <ToastMessage
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onHide={hideToast}
        duration={3000}
      />
      
      <ScrollView>
        {/* Image Gallery */}
        <ImageGallery 
          images={images}
          onFavoritePress={toggleFavorite}
          onSharePress={handleShareListing}
          isFavorite={isFavorite}
        />
        
        {/* Plant Info Header */}
        <PlantInfoHeader 
          name={plant.title || plant.name}
          category={plant.category}
          price={plant.price}
          listedDate={plant.addedAt || plant.listedDate}
          location={plant.location || plant.city}
        />
        
        {/* Description Section */}
        <DescriptionSection description={plant.description} />
        
        {/* Care Info Section */}
        <CareInfoSection careInfo={plant.careInfo} />
        
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
            name: plant.seller?.name || 'Plant Enthusiast',
            avatar: plant.seller?.avatar,
            _id: plant.seller?._id || plant.sellerId,
            rating: plant.seller?.rating,
            totalReviews: plant.seller?.totalReviews
          }}
          onPress={() => navigation.navigate('SellerProfile', { 
            sellerId: plant.sellerId || plant.seller?._id
          })}
        />
        
        {/* Action Buttons */}
        <ActionButtons 
          isFavorite={isFavorite}
          onFavoritePress={toggleFavorite}
          onContactPress={handleContactSeller}
          onReviewPress={handleReviewButtonPress}
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
        targetId={plant.id || plant._id}
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
  section: { 
    marginVertical: 16,
    paddingHorizontal: 16
  },
  modalContainer: { 
    flex: 1, 
    backgroundColor: '#000' 
  },
});

export default PlantDetailScreen;