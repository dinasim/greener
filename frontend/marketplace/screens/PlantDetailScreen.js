// screens/PlantDetailScreen.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Dimensions,
  Share,
  Platform,
  SafeAreaView,
} from 'react-native';
import { MaterialIcons, FontAwesome, Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';

// Import fixed header component
import MarketplaceHeader from '../components/MarketplaceHeader';

// Import services
import { getSpecific, wishProduct } from '../services/marketplaceApi';

const { width } = Dimensions.get('window');

/**
 * PlantDetailScreen - Displays detailed information about a plant listing
 * Now with consistent header and back button
 */
const PlantDetailScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const { plantId } = route.params;

  // State
  const [plant, setPlant] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  // Load plant details when component mounts
  useEffect(() => {
    loadPlantDetail();
  }, [plantId]);

  // Function to load plant details
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

  // Toggle favorite/wishlist status
  const toggleFavorite = async () => {
    try {
      // Update UI immediately for better user experience
      setIsFavorite(!isFavorite);
      
      // Call API to update wishlist status
      await wishProduct(plantId);
    } catch (err) {
      // Revert UI state if API call fails
      setIsFavorite(isFavorite);
      Alert.alert('Error', 'Failed to update favorites. Please try again.');
      console.error('Error toggling favorite:', err);
    }
  };

  // Navigate to contact seller screen
  const handleContactSeller = () => {
    navigation.navigate('Messages', { 
      sellerId: plant.sellerId, 
      plantId: plant._id,
      plantName: plant.title || plant.name
    });
  };

  // Share plant listing
  const handleShareListing = async () => {
    try {
      await Share.share({
        message: `Check out this ${plant.title || plant.name} on Greener: $${plant.price}`,
        url: Platform.OS === 'ios' ? `greenerapp://plants/${plantId}` : undefined,
      });
    } catch (error) {
      Alert.alert('Error', 'Could not share this listing');
    }
  };

  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return 'Recently listed';
    
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString(undefined, { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
    } catch (e) {
      return 'Recently listed';
    }
  };

  // Loading state with consistent header
  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <MarketplaceHeader 
          title="Plant Details"
          showBackButton={true}
          onNotificationsPress={() => navigation.navigate('Messages')}
        />
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text style={styles.loadingText}>Loading plant details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Error state with consistent header
  if (error || !plant) {
    return (
      <SafeAreaView style={styles.container}>
        <MarketplaceHeader 
          title="Plant Details"
          showBackButton={true}
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

  // Prepare images array (handle different data formats)
  const images = plant.images && plant.images.length > 0 
    ? plant.images 
    : [plant.image || plant.imageUrl || 'https://via.placeholder.com/400?text=Plant'];

  return (
    <SafeAreaView style={styles.container}>
      {/* Use the consistent header with back button */}
      <MarketplaceHeader 
        title={plant.title || plant.name || "Plant Details"}
        showBackButton={true}
        onNotificationsPress={() => navigation.navigate('Messages')}
      />
      
      <ScrollView>
        {/* Plant Image Gallery */}
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
              <Image 
                key={index} 
                source={{ uri: image }} 
                style={styles.image} 
                resizeMode="cover" 
              />
            ))}
          </ScrollView>

          {/* Image Pagination Dots */}
          {images.length > 1 && (
            <View style={styles.pagination}>
              {images.map((_, index) => (
                <View
                  key={index}
                  style={[
                    styles.paginationDot, 
                    activeImageIndex === index && styles.paginationDotActive
                  ]}
                />
              ))}
            </View>
          )}

          {/* Favorite Button */}
          <TouchableOpacity style={styles.favoriteButton} onPress={toggleFavorite}>
            <MaterialIcons 
              name={isFavorite ? "favorite" : "favorite-border"} 
              size={28} 
              color={isFavorite ? "#f44336" : "#fff"} 
            />
          </TouchableOpacity>

          {/* Share Button */}
          <TouchableOpacity style={styles.shareButton} onPress={handleShareListing}>
            <MaterialIcons name="share" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Plant Details */}
        <View style={styles.infoContainer}>
          {/* Plant Name & Price */}
          <Text style={styles.name}>{plant.title || plant.name}</Text>
          <Text style={styles.category}>{plant.category}</Text>
          <Text style={styles.price}>${parseFloat(plant.price).toFixed(2)}</Text>

          {/* Status & Date */}
          <View style={styles.statusContainer}>
            <View style={styles.statusPill}>
              <Text style={styles.statusText}>Available</Text>
            </View>
            <Text style={styles.listedDate}>
              Listed {formatDate(plant.addedAt || plant.listedDate)}
            </Text>
          </View>

          {/* Location */}
          <View style={styles.locationContainer}>
            <View style={styles.locationHeader}>
              <MaterialIcons name="location-on" size={20} color="#4CAF50" />
              <Text style={styles.locationTitle}>Location</Text>
            </View>
            <Text style={styles.locationText}>{plant.city || plant.location || 'Local pickup'}</Text>
          </View>

          {/* Description */}
          <Text style={styles.sectionTitle}>Description</Text>
          <Text style={styles.description}>{plant.description}</Text>

          {/* Care Information (if available) */}
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

          {/* Seller Information */}
          <Text style={styles.sectionTitle}>About the Seller</Text>
          <TouchableOpacity 
            style={styles.sellerContainer} 
            onPress={() => navigation.navigate('SellerProfile', { sellerId: plant.sellerId })}
          >
            <Image 
              source={{ uri: plant.avatar || 'https://via.placeholder.com/50?text=Seller' }} 
              style={styles.sellerAvatar} 
            />
            <View style={styles.sellerInfo}>
              <Text style={styles.sellerName}>{plant.name || 'Plant Enthusiast'}</Text>
              {plant.rating && (
                <View style={styles.sellerRatingContainer}>
                  <MaterialIcons name="star" size={16} color="#FFC107" />
                  <Text style={styles.sellerRating}>
                    {plant.rating} ({plant.totalSells || 0} plants)
                  </Text>
                </View>
              )}
            </View>
            <MaterialIcons name="chevron-right" size={24} color="#999" />
          </TouchableOpacity>

          {/* Action Buttons */}
          <View style={styles.actionsContainer}>
            <TouchableOpacity 
              style={styles.favoriteActionButton} 
              onPress={toggleFavorite}
            >
              <MaterialIcons 
                name={isFavorite ? "favorite" : "favorite-border"} 
                size={24} 
                color={isFavorite ? "#f44336" : "#4CAF50"} 
              />
              <Text style={styles.actionButtonText}>{isFavorite ? 'Saved' : 'Save'}</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.contactButton} 
              onPress={handleContactSeller}
            >
              <MaterialIcons name="chat" size={24} color="#fff" />
              <Text style={styles.contactButtonText}>Message Seller</Text>
            </TouchableOpacity>
          </View>

          {/* Safety Tips */}
          <View style={styles.safetyContainer}>
            <MaterialIcons name="shield" size={20} color="#4CAF50" />
            <Text style={styles.safetyText}>
              <Text style={styles.safetyBold}>Safety Tips: </Text>
              Meet in a public place and inspect the plant before purchasing
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#fff' 
  },
  centerContainer: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center',
    padding: 20,
  },
  loadingText: { 
    marginTop: 10, 
    fontSize: 16, 
    color: '#4CAF50' 
  },
  errorText: { 
    marginTop: 10, 
    fontSize: 16, 
    color: '#f44336',
    textAlign: 'center',
    marginBottom: 10,
  },
  retryButton: { 
    marginTop: 10, 
    padding: 10, 
    backgroundColor: '#4CAF50', 
    borderRadius: 5 
  },
  retryText: { 
    color: '#fff',
    fontWeight: '600',
  },
  imageContainer: { 
    position: 'relative',
    height: 250,
  },
  image: { 
    width, 
    height: 250,
    backgroundColor: '#f0f0f0',
  },
  pagination: { 
    position: 'absolute', 
    bottom: 10, 
    flexDirection: 'row', 
    alignSelf: 'center' 
  },
  paginationDot: { 
    width: 8, 
    height: 8, 
    margin: 4, 
    backgroundColor: 'rgba(255,255,255,0.6)', 
    borderRadius: 4 
  },
  paginationDotActive: { 
    backgroundColor: '#4CAF50' 
  },
  favoriteButton: { 
    position: 'absolute', 
    top: 20, 
    right: 20, 
    backgroundColor: 'rgba(0, 0, 0, 0.5)', 
    borderRadius: 50, 
    padding: 10 
  },
  shareButton: { 
    position: 'absolute', 
    top: 20, 
    right: 70, 
    backgroundColor: 'rgba(0, 0, 0, 0.5)', 
    borderRadius: 50, 
    padding: 10 
  },
  infoContainer: { 
    padding: 16,
  },
  name: { 
    fontSize: 24, 
    fontWeight: 'bold', 
    color: '#333' 
  },
  category: { 
    fontSize: 16, 
    color: '#777' 
  },
  price: { 
    fontSize: 20, 
    color: '#4CAF50', 
    marginVertical: 10,
    fontWeight: 'bold',
  },
  statusContainer: { 
    flexDirection: 'row', 
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  statusPill: { 
    paddingVertical: 4, 
    paddingHorizontal: 8, 
    backgroundColor: '#a5d6a7', 
    borderRadius: 10 
  },
  statusText: { 
    fontSize: 14, 
    color: '#fff',
    fontWeight: '500',
  },
  listedDate: { 
    fontSize: 14, 
    color: '#999' 
  },
  locationContainer: { 
    marginBottom: 16,
    padding: 12,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
  },
  locationHeader: { 
    flexDirection: 'row', 
    alignItems: 'center',
    marginBottom: 4,
  },
  locationTitle: { 
    fontSize: 16, 
    marginLeft: 8,
    fontWeight: '600',
    color: '#333',
  },
  locationText: { 
    fontSize: 14, 
    color: '#555',
    marginLeft: 32,
  },
  sectionTitle: { 
    fontSize: 18, 
    fontWeight: 'bold', 
    marginVertical: 12,
    color: '#333',
  },
  description: { 
    fontSize: 14, 
    color: '#333',
    lineHeight: 20,
    marginBottom: 16,
  },
  careInfoContainer: { 
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  careItem: { 
    alignItems: 'center', 
    width: '30%',
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 12,
  },
  careLabel: { 
    fontSize: 14, 
    marginTop: 8,
    color: '#333',
    fontWeight: '600',
  },
  careValue: { 
    fontSize: 12, 
    color: '#777',
    marginTop: 4,
    textAlign: 'center',
  },
  sellerContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginVertical: 12,
    padding: 16,
    backgroundColor: '#f9f9f9',
    borderRadius: 10,
  },
  sellerAvatar: { 
    width: 50, 
    height: 50, 
    borderRadius: 25,
    backgroundColor: '#e0e0e0',
  },
  sellerInfo: { 
    marginLeft: 10, 
    flex: 1 
  },
  sellerName: { 
    fontSize: 16, 
    fontWeight: 'bold' 
  },
  sellerRatingContainer: { 
    flexDirection: 'row', 
    alignItems: 'center',
    marginTop: 4,
  },
  sellerRating: { 
    fontSize: 14, 
    marginLeft: 5,
    color: '#666',
  },
  actionsContainer: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    marginTop: 20,
    marginBottom: 16,
  },
  favoriteActionButton: { 
    flexDirection: 'row', 
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#4CAF50',
    borderRadius: 8,
  },
  actionButtonText: { 
    fontSize: 16, 
    color: '#4CAF50', 
    marginLeft: 8,
    fontWeight: '600',
  },
  contactButton: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#4CAF50', 
    borderRadius: 8, 
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  contactButtonText: { 
    color: '#fff', 
    marginLeft: 8,
    fontWeight: '600',
    fontSize: 16,
  },
  safetyContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#f0f9f0',
    padding: 12,
    borderRadius: 8,
    marginBottom: 40,
  },
  safetyText: { 
    fontSize: 14, 
    marginLeft: 8,
    color: '#555',
    flex: 1,
  },
  safetyBold: { 
    fontWeight: 'bold',
    color: '#333',
  },
});

export default PlantDetailScreen;