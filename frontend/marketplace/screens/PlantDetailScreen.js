import React, { useState, useEffect } from 'react';
import {
  View, Text, Image, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert,
  Dimensions, Share, Platform, SafeAreaView, Modal, Linking,
} from 'react-native';
import { MaterialIcons, FontAwesome, Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MarketplaceHeader from '../components/MarketplaceHeader';
import { getSpecific, wishProduct } from '../services/marketplaceApi';
import PlantLocationMap from '../components/PlantLocationMap';
import ReviewForm from '../components/ReviewForm';

const { width } = Dimensions.get('window');

const PlantDetailScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const { plantId } = route.params;
  const [plant, setPlant] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [mapModalVisible, setMapModalVisible] = useState(false);
  const [showReviewForm, setShowReviewForm] = useState(false);

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

  // screens/PlantDetailScreen.js - getSellerAvatarUrl function fix

const getSellerAvatarUrl = () => {
  // Try to get a valid avatar URL from the seller object
  if (plant.seller && plant.seller.avatar && typeof plant.seller.avatar === 'string' && plant.seller.avatar.startsWith('http')) {
    return plant.seller.avatar;
  }
  
  // Fall back to other possible avatar locations
  if (plant.avatar && typeof plant.avatar === 'string' && plant.avatar.startsWith('http')) {
    return plant.avatar;
  }
  
  if (plant.sellerAvatar && typeof plant.sellerAvatar === 'string' && plant.sellerAvatar.startsWith('http')) {
    return plant.sellerAvatar;
  }
  
  // Get seller name for placeholder
  const sellerName = 
    (plant.seller && plant.seller.name) ? 
    plant.seller.name : 
    (plant.sellerName || 'Unknown');
  
  // If no avatar, use a name-based placeholder
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(sellerName.substring(0, 1))}&background=4CAF50&color=fff&size=256`;
};

  const toggleFavorite = async () => {
    try {
      setIsFavorite(!isFavorite);
      const result = await wishProduct(plantId);
      if (result && 'isWished' in result) {
        setIsFavorite(result.isWished);
      }
      AsyncStorage.setItem('FAVORITES_UPDATED', Date.now().toString())
        .catch(err => console.warn('Failed to set favorites update flag:', err));
    } catch (err) {
      setIsFavorite(isFavorite);
      Alert.alert('Error', 'Failed to update favorites. Please try again.');
      console.error('Error toggling favorite:', err);
    }
  };

  const handleContactSeller = () => {
    if (!plant.sellerId && !plant.seller?._id) {
      Alert.alert('Error', 'Seller information is not available.');
      return;
    }
    
    // Try different navigation approaches to handle various navigation structures
    try {
      const params = { 
        sellerId: plant.sellerId || plant.seller?._id, 
        plantId: plant._id || plant.id,
        plantName: plant.title || plant.name,
        sellerName: plant.seller?.name || 'Plant Seller'
      };

      // Try navigating with MarketplaceTabs first
      if (navigation.getParent()) {
        const parent = navigation.getParent();
        if (parent.navigate) {
          parent.navigate('Messages', params);
          return;
        }
      }

      // Next try direct navigation
      navigation.navigate('Messages', params);
    } catch (err) {
      console.error('Error navigating to messages:', err);
      Alert.alert('Navigation Error', 'Could not open messages. Please try again.');
    }
  };

  const getLocationText = () => {
    if (typeof plant.location === 'string') {
      return plant.location;
    } else if (plant.location && typeof plant.location === 'object') {
      return plant.location.city || 'Local pickup';
    } else if (plant.city) {
      return plant.city;
    }
    return 'Local pickup';
  };

  const handleGetDirections = () => {
    try {
      if (!plant.location || typeof plant.location !== 'object' || 
          !plant.location.latitude || !plant.location.longitude) {
        Alert.alert('Error', 'Location coordinates not available');
        return;
      }
      const { latitude, longitude } = plant.location;
      const label = plant.title || plant.name || 'Plant location';
      let url;
      if (Platform.OS === 'ios') {
        url = `maps:0,0?q=${label}@${latitude},${longitude}`;
      } else {
        url = `geo:0,0?q=${latitude},${longitude}(${encodeURI(label)})`;
      }
      Linking.canOpenURL(url).then(supported => {
        if (supported) {
          Linking.openURL(url);
        } else {
          Linking.openURL(
            `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`
          );
        }
      });
    } catch (error) {
      console.error('Error opening directions:', error);
      Alert.alert('Error', 'Could not open directions. Please try again later.');
    }
  };

  const handleExpandMap = () => {
    setMapModalVisible(true);
  };

  const handleShareListing = async () => {
    try {
      const plantName = plant.title || plant.name || 'Amazing plant';
      const plantPrice = parseFloat(plant.price).toFixed(2);
      const sellerName = plant.seller?.name || 'a trusted seller';
      const plantCategory = plant.category || 'Plants';
      const plantLocation = getLocationText();
      const plantDescription = plant.description 
        ? (plant.description.length > 100 
           ? plant.description.substring(0, 100) + '...' 
           : plant.description)
        : 'Check out this amazing plant!';
      const appURL = Platform.OS === 'ios' 
        ? `greenerapp://plants/${plantId}` 
        : `https://greenerapp.com/plants/${plantId}`;
      const shareMessage = 
        `🌿 ${plantName} - $${plantPrice} 🌿\n\n` +
        `${plantDescription}\n\n` +
        `📋 Details:\n` +
        `🏷️ Category: ${plantCategory}\n` +
        `📍 Location: ${plantLocation}\n` +
        `👤 Seller: ${sellerName}\n\n` +
        `💬 Visit Greener app to contact the seller and see more amazing plants!`;
      const result = await Share.share(
        {
          title: `Greener: ${plantName}`,
          message: shareMessage,
          url: appURL,
        },
        {
          dialogTitle: 'Share This Plant With Friends',
          subject: `Check out this ${plantName} on Greener!`,
          tintColor: '#4CAF50',
          excludedActivityTypes: [
            'com.apple.UIKit.activity.Print',
            'com.apple.UIKit.activity.AssignToContact',
          ],
        }
      );
      if (result.action === Share.sharedAction) {
        console.log('Plant shared successfully');
      }
    } catch (error) {
      console.error('Error sharing plant:', error);
      Alert.alert('Error', 'Could not share this listing');
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Recently listed';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString(undefined, { 
        year: 'numeric', month: 'long', day: 'numeric' 
      });
    } catch (e) {
      return 'Recently listed';
    }
  };

  const handleReviewButtonPress = () => {
    setShowReviewForm(true);
  };

  const handleReviewSubmitted = () => {
    setShowReviewForm(false);
    // Refresh the plant details to show updated reviews
    loadPlantDetail();
  };

  const renderLocationSection = () => {
    const hasLocation = !!(
      plant.location && 
      typeof plant.location === 'object' && 
      plant.location.latitude && 
      plant.location.longitude
    );
    if (!hasLocation && !plant.city) {
      return null;
    }
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Location</Text>
        <PlantLocationMap
          plant={plant}
          onGetDirections={handleGetDirections}
          onExpandMap={handleExpandMap}
        />
      </View>
    );
  };

  const renderMapModal = () => {
    return (
      <Modal
        visible={mapModalVisible}
        onRequestClose={() => setMapModalVisible(false)}
        animationType="slide"
        statusBarTranslucent
      >
        <View style={styles.modalContainer}>
          <StatusBar style="light" />
          <View style={styles.modalHeader}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setMapModalVisible(false)}
            >
              <MaterialIcons name="close" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {plant.title || plant.name || 'Plant Location'}
            </Text>
          </View>
          <PlantLocationMap
            plant={plant}
            onGetDirections={handleGetDirections}
            expanded={true}
          />
        </View>
      </Modal>
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <MarketplaceHeader 
          title="Plant Details"
          showBackButton={true}
          onBackPress={() => navigation.goBack()}
          onNotificationsPress={() => navigation.navigate('Messages')}
        />
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text style={styles.loadingText}>Loading plant details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !plant) {
    return (
      <SafeAreaView style={styles.container}>
        <MarketplaceHeader 
          title="Plant Details"
          showBackButton={true}
          onBackPress={() => navigation.goBack()}
          onNotificationsPress={() => navigation.navigate('Messages')}
        />
        <View style={styles.centerContainer}>
          <MaterialIcons name="error-outline" size={48} color="#f44336" />
          <Text style={styles.errorText}>{error || 'Plant not found'}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadPlantDetail}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
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
      <ScrollView>
        <View style={styles.imageContainer}>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(event) => {
              const slideIndex = Math.floor(event.nativeEvent.contentOffset.x / width);
              setActiveImageIndex(slideIndex);
            }}
          >
            {images.map((image, index) => (
              <Image key={index} source={{ uri: image }} style={styles.image} resizeMode="contain" />
            ))}
          </ScrollView>
          {images.length > 1 && (
            <View style={styles.pagination}>
              {images.map((_, index) => (
                <View
                  key={index}
                  style={[styles.paginationDot, activeImageIndex === index && styles.paginationDotActive]}
                />
              ))}
            </View>
          )}
          <TouchableOpacity style={styles.favoriteButton} onPress={toggleFavorite}>
            <MaterialIcons 
              name={isFavorite ? "favorite" : "favorite-border"} 
              size={28} 
              color={isFavorite ? "#f44336" : "#fff"} 
            />
          </TouchableOpacity>
          <TouchableOpacity style={styles.shareButton} onPress={handleShareListing}>
            <MaterialIcons name="share" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
        <View style={styles.infoContainer}>
          <Text style={styles.name}>{plant.title || plant.name}</Text>
          <Text style={styles.category}>{plant.category}</Text>
          <Text style={styles.price}>${parseFloat(plant.price).toFixed(2)}</Text>
          <View style={styles.statusContainer}>
            <View style={styles.statusPill}>
              <Text style={styles.statusText}>Available</Text>
            </View>
            <Text style={styles.listedDate}>Listed {formatDate(plant.addedAt || plant.listedDate)}</Text>
          </View>
          <View style={styles.locationContainer}>
            <View style={styles.locationHeader}>
              <MaterialIcons name="location-on" size={20} color="#4CAF50" />
              <Text style={styles.locationTitle}>Location</Text>
            </View>
            <Text style={styles.locationText}>{getLocationText()}</Text>
          </View>
          {renderLocationSection()}
          <Text style={styles.sectionTitle}>Description</Text>
          <Text style={styles.description}>{plant.description}</Text>
          {plant.careInfo && (
            <>
              <Text style={styles.sectionTitle}>Care Information</Text>
              <View style={styles.careInfoContainer}>
                <View style={styles.careItem}>
                  <FontAwesome name="tint" size={24} color="#4CAF50" />
                  <Text style={styles.careLabel}>Water</Text>
                  <Text style={styles.careValue}>{plant.careInfo?.water || 'Moderate'}</Text>
                </View>
                <View style={styles.careItem}>
                  <Ionicons name="sunny" size={24} color="#4CAF50" />
                  <Text style={styles.careLabel}>Light</Text>
                  <Text style={styles.careValue}>{plant.careInfo?.light || 'Bright indirect'}</Text>
                </View>
                <View style={styles.careItem}>
                  <MaterialIcons name="thermostat" size={24} color="#4CAF50" />
                  <Text style={styles.careLabel}>Temperature</Text>
                  <Text style={styles.careValue}>{plant.careInfo?.temperature || '65-80°F'}</Text>
                </View>
              </View>
            </>
          )}
          <Text style={styles.sectionTitle}>About the Seller</Text>
          <TouchableOpacity 
            style={styles.sellerContainer} 
            onPress={() => navigation.navigate('SellerProfile', { 
              sellerId: plant.sellerId || plant.seller?._id,
              sellerData: {
                name: plant.seller?.name || 'Unknown Seller',
                avatar: getSellerAvatarUrl(),
                rating: plant.seller?.rating || 0,
                plantsCount: plant.seller?.plantsCount || 0,
                salesCount: plant.seller?.salesCount || 0
              }
            })}
          >
            <Image source={{ uri: getSellerAvatarUrl() }} style={styles.sellerAvatar} />
            <View style={styles.sellerInfo}>
              <Text style={styles.sellerName}>{plant.seller?.name || 'Plant Enthusiast'}</Text>
              {plant.seller?.rating && (
                <View style={styles.sellerRatingContainer}>
                  <MaterialIcons name="star" size={16} color="#FFC107" />
                  <Text style={styles.sellerRating}>
                    {typeof plant.seller.rating === 'number' ? plant.seller.rating.toFixed(1) : plant.seller.rating} 
                    ({plant.seller.totalReviews || plant.seller.totalSells || 0})
                  </Text>
                </View>
              )}
            </View>
            <MaterialIcons name="chevron-right" size={24} color="#999" />
          </TouchableOpacity>
          <View style={styles.actionsContainer}>
            <TouchableOpacity style={styles.favoriteActionButton} onPress={toggleFavorite}>
              <MaterialIcons 
                name={isFavorite ? "favorite" : "favorite-border"} 
                size={24} 
                color={isFavorite ? "#f44336" : "#4CAF50"} 
              />
              <Text style={styles.actionButtonText}>{isFavorite ? 'Favorited' : 'Favorite'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.contactButton} onPress={handleContactSeller}>
              <MaterialIcons name="chat" size={24} color="#fff" />
              <Text style={styles.contactButtonText}>Message Seller</Text>
            </TouchableOpacity>
          </View>
          
          {/* Review button section */}
          <TouchableOpacity style={styles.reviewButton} onPress={handleReviewButtonPress}>
            <MaterialIcons name="rate-review" size={24} color="#4CAF50" />
            <Text style={styles.reviewButtonText}>Write a Review</Text>
          </TouchableOpacity>
          
          <View style={styles.safetyContainer}>
            <MaterialIcons name="shield" size={20} color="#4CAF50" />
            <Text style={styles.safetyText}>
              <Text style={styles.safetyBold}>Safety Tips: </Text>
              Meet in a public place and inspect the plant before purchasing
            </Text>
          </View>
        </View>
      </ScrollView>
      {renderMapModal()}
      
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
  container: { flex: 1, backgroundColor: '#fff' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  loadingText: { marginTop: 10, fontSize: 16, color: '#4CAF50' },
  errorText: { marginTop: 10, fontSize: 16, color: '#f44336', textAlign: 'center', marginBottom: 10 },
  retryButton: { marginTop: 10, padding: 10, backgroundColor: '#4CAF50', borderRadius: 5 },
  retryText: { color: '#fff', fontWeight: '600' },
  imageContainer: { position: 'relative', height: 250 },
  image: { width, height: 250, backgroundColor: '#f0f0f0' },
  section: { marginVertical: 16 },
  pagination: { position: 'absolute', bottom: 10, flexDirection: 'row', alignSelf: 'center' },
  paginationDot: { width: 8, height: 8, margin: 4, backgroundColor: 'rgba(255,255,255,0.6)', borderRadius: 4 },
  paginationDotActive: { backgroundColor: '#4CAF50' },
  favoriteButton: { position: 'absolute', top: 20, right: 20, backgroundColor: 'rgba(0, 0, 0, 0.5)', borderRadius: 50, padding: 10 },
  shareButton: { position: 'absolute', top: 20, right: 70, backgroundColor: 'rgba(0, 0, 0, 0.5)', borderRadius: 50, padding: 10 },
  infoContainer: { padding: 16 },
  name: { fontSize: 24, fontWeight: 'bold', color: '#333' },
  category: { fontSize: 16, color: '#777' },
  price: { fontSize: 20, color: '#4CAF50', marginVertical: 10, fontWeight: 'bold' },
  statusContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  statusPill: { paddingVertical: 4, paddingHorizontal: 8, backgroundColor: '#a5d6a7', borderRadius: 10 },
  statusText: { fontSize: 14, color: '#fff', fontWeight: '500' },
  listedDate: { fontSize: 14, color: '#999' },
  locationContainer: { marginBottom: 16, padding: 12, backgroundColor: '#f9f9f9', borderRadius: 8 },
  locationHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  locationTitle: { fontSize: 16, marginLeft: 8, fontWeight: '600', color: '#333' },
  locationText: { fontSize: 14, color: '#555', marginLeft: 32 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginVertical: 12, color: '#333' },
  description: { fontSize: 14, color: '#333', lineHeight: 20, marginBottom: 16 },
  careInfoContainer: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', marginBottom: 16 },
  careItem: { alignItems: 'center', width: '30%', backgroundColor: '#f9f9f9', borderRadius: 8, padding: 12 },
  careLabel: { fontSize: 14, marginTop: 8, color: '#333', fontWeight: '600' },
  careValue: { fontSize: 12, color: '#777', marginTop: 4, textAlign: 'center' },
  sellerContainer: { flexDirection: 'row', alignItems: 'center', marginVertical: 12, padding: 16, backgroundColor: '#f9f9f9', borderRadius: 10 },
  sellerAvatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#e0e0e0' },
  sellerInfo: { marginLeft: 10, flex: 1 },
  sellerName: { fontSize: 16, fontWeight: 'bold' },
  sellerRatingContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  sellerRating: { fontSize: 14, marginLeft: 5, color: '#666' },
  actionsContainer: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20, marginBottom: 16 },
  favoriteActionButton: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, borderWidth: 1, borderColor: '#4CAF50', borderRadius: 8 },
  actionButtonText: { fontSize: 16, color: '#4CAF50', marginLeft: 8, fontWeight: '600' },
  contactButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#4CAF50', borderRadius: 8, paddingVertical: 12, paddingHorizontal: 16 },
  contactButtonText: { color: '#fff', marginLeft: 8, fontWeight: '600', fontSize: 16 },
  reviewButton: { 
    flexDirection: 'row', 
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0f9f0',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#4CAF50',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 16 
  },
  reviewButtonText: { 
    color: '#4CAF50', 
    fontSize: 16,
    marginLeft: 8, 
    fontWeight: '600' 
  },
  safetyContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f0f9f0', padding: 12, borderRadius: 8, marginBottom: 40 },
  safetyText: { fontSize: 14, marginLeft: 8, color: '#555', flex: 1 },
  safetyBold: { fontWeight: 'bold', color: '#333' },
  modalContainer: { flex: 1, backgroundColor: '#000' },
  modalHeader: { height: 60, backgroundColor: '#4CAF50', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 },
  closeButton: { padding: 8 },
  modalTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold', flex: 1, marginLeft: 16 },
});

export default PlantDetailScreen;