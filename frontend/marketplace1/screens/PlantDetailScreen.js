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
  Linking,
  Share,
} from 'react-native';
import { MaterialIcons, FontAwesome, Ionicons, Feather } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';
import MapView, { Marker } from '../components/maps';

// API Services
import { fetchPlantById } from '../services/marketplaceApi';

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

  useEffect(() => {
    loadPlantDetail();
  }, [plantId]);

  const loadPlantDetail = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Call Azure Function to get plant details
      const data = await fetchPlantById(plantId);
      setPlant(data);
      
      // Check if this plant is in favorites
      // This would typically come from your user preferences in Azure
      setIsFavorite(false);
      
      setIsLoading(false);
    } catch (err) {
      setError('Failed to load plant details. Please try again later.');
      setIsLoading(false);
      console.error('Error fetching plant details:', err);
    }
  };

  const toggleFavorite = async () => {
    try {
      // Toggle favorite state optimistically for better UX
      setIsFavorite(!isFavorite);
      
      // Call Azure Function to toggle favorite status
      // Example: await toggleFavoritePlant(plantId);
    } catch (err) {
      // Revert if API call fails
      setIsFavorite(!isFavorite);
      Alert.alert('Error', 'Failed to update favorites. Please try again.');
      console.error('Error toggling favorite:', err);
    }
  };

  const handleContactSeller = () => {
    // Navigate to chat with seller
    navigation.navigate('Messages', { 
      sellerId: plant.sellerId,
      plantId: plant.id,
      plantName: plant.name
    });
  };

  const handleShareListing = async () => {
    try {
      await Share.share({
        message: `Check out this ${plant.name} on Greener: ${plant.price}`,
        url: `https://greenerapp.com/plants/${plant.id}`, // You would need to implement deep linking
      });
    } catch (error) {
      Alert.alert('Error', 'Could not share this listing');
    }
  };

  const handleViewLocation = () => {
    // Open in maps app if coordinates available
    if (plant.coordinates) {
      const url = `https://www.google.com/maps/search/?api=1&query=${plant.coordinates.latitude},${plant.coordinates.longitude}`;
      Linking.openURL(url);
    } else {
      Alert.alert('Location', `This plant is available for pickup in ${plant.location}`);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text style={styles.loadingText}>Loading plant details...</Text>
      </View>
    );
  }

  if (error || !plant) {
    return (
      <View style={styles.centerContainer}>
        <MaterialIcons name="error-outline" size={48} color="#f44336" />
        <Text style={styles.errorText}>{error || 'Plant not found'}</Text>
      </View>
    );
  }

  // For demonstration - in a real app, the plant would have multiple images
  const images = plant.images && plant.images.length > 0 ? plant.images : [plant.imageUrl || 'https://via.placeholder.com/400'];

  return (
    <ScrollView style={styles.container}>
      {/* Plant Images */}
      <View style={styles.imageContainer}>
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(event) => {
            const slideIndex = Math.floor(
              event.nativeEvent.contentOffset.x / width
            );
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
        
        {/* Image pagination dots */}
        {images.length > 1 && (
          <View style={styles.pagination}>
            {images.map((_, index) => (
              <View
                key={index}
                style={[
                  styles.paginationDot,
                  activeImageIndex === index && styles.paginationDotActive,
                ]}
              />
            ))}
          </View>
        )}
        
        <TouchableOpacity 
          style={styles.favoriteButton}
          onPress={toggleFavorite}
        >
          <MaterialIcons 
            name={isFavorite ? "favorite" : "favorite-border"} 
            size={28} 
            color={isFavorite ? "#f44336" : "#fff"} 
          />
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.shareButton}
          onPress={handleShareListing}
        >
          <Feather name="share" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Plant Info */}
      <View style={styles.infoContainer}>
        <Text style={styles.name}>{plant.name}</Text>
        <Text style={styles.category}>{plant.category}</Text>
        <Text style={styles.price}>${plant.price.toFixed(2)}</Text>
        
        {/* Status and Date */}
        <View style={styles.statusContainer}>
          <View style={styles.statusPill}>
            <Text style={styles.statusText}>Available</Text>
          </View>
          <Text style={styles.listedDate}>
            Listed {plant.listedDate ? new Date(plant.listedDate).toLocaleDateString() : 'recently'}
          </Text>
        </View>

        {/* Location */}
        <View style={styles.locationContainer}>
          <View style={styles.locationHeader}>
            <MaterialIcons name="location-on" size={20} color="#4CAF50" />
            <Text style={styles.locationTitle}>Location</Text>
          </View>
          <Text style={styles.locationText}>{plant.location || 'Local pickup'}</Text>
          
          {plant.coordinates && (
            <TouchableOpacity onPress={handleViewLocation}>
              <View style={styles.mapPreview}>
                <MapView
                  style={styles.map}
                  initialRegion={{
                    latitude: plant.coordinates.latitude,
                    longitude: plant.coordinates.longitude,
                    latitudeDelta: 0.01,
                    longitudeDelta: 0.01,
                  }}
                  scrollEnabled={false}
                  zoomEnabled={false}
                  rotateEnabled={false}
                >
                  <Marker
                    coordinate={{
                      latitude: plant.coordinates.latitude,
                      longitude: plant.coordinates.longitude,
                    }}
                    pinColor="#4CAF50"
                  />
                </MapView>
                <View style={styles.mapOverlay}>
                  <Text style={styles.viewOnMapText}>Tap to view on map</Text>
                </View>
              </View>
            </TouchableOpacity>
          )}
        </View>

        {/* Description */}
        <Text style={styles.sectionTitle}>Description</Text>
        <Text style={styles.description}>{plant.description}</Text>

        {/* Care Information */}
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

        {/* Seller Information */}
        <Text style={styles.sectionTitle}>About the Seller</Text>
        <TouchableOpacity 
          style={styles.sellerContainer}
          onPress={() => navigation.navigate('SellerProfile', { sellerId: plant.sellerId })}
        >
          <Image 
            source={{ uri: plant.sellerAvatar || 'https://via.placeholder.com/50' }} 
            style={styles.sellerAvatar} 
          />
          <View style={styles.sellerInfo}>
            <Text style={styles.sellerName}>{plant.sellerName || 'Plant Enthusiast'}</Text>
            <View style={styles.sellerRatingContainer}>
              <MaterialIcons name="star" size={16} color="#FFC107" />
              <Text style={styles.sellerRating}>
                {plant.sellerRating || '4.8'} ({plant.sellerReviews || '24'} reviews)
              </Text>
            </View>
            <Text style={styles.sellerMember}>
              Member since {plant.sellerJoinDate ? new Date(plant.sellerJoinDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short' }) : 'January 2023'}
            </Text>
          </View>
          <MaterialIcons name="chevron-right" size={24} color="#999" />
        </TouchableOpacity>

        {/* Seller's other listings preview */}
        {plant.sellerOtherListings && plant.sellerOtherListings.length > 0 && (
          <View style={styles.otherListingsContainer}>
            <Text style={styles.otherListingsTitle}>More from this seller</Text>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              style={styles.otherListingsScroll}
            >
              {plant.sellerOtherListings.map((listing) => (
                <TouchableOpacity 
                  key={listing.id}
                  style={styles.otherListingItem}
                  onPress={() => navigation.replace('PlantDetail', { plantId: listing.id })}
                >
                  <Image
                    source={{ uri: listing.imageUrl }}
                    style={styles.otherListingImage}
                    resizeMode="cover"
                  />
                  <Text style={styles.otherListingName} numberOfLines={1}>{listing.name}</Text>
                  <Text style={styles.otherListingPrice}>${listing.price}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={styles.seeAllButton}
                onPress={() => navigation.navigate('SellerProfile', { sellerId: plant.sellerId })}
              >
                <Text style={styles.seeAllText}>See All</Text>
                <MaterialIcons name="arrow-forward" size={16} color="#4CAF50" />
              </TouchableOpacity>
            </ScrollView>
          </View>
        )}

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
            <Text style={styles.actionButtonText}>
              {isFavorite ? 'Saved' : 'Save'}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.contactButton}
            onPress={handleContactSeller}
          >
            <MaterialIcons name="chat" size={24} color="#fff" />
            <Text style={styles.contactButtonText}>Message Seller</Text>
          </TouchableOpacity>
        </View>

        {/* Safety tips */}
        <View style={styles.safetyContainer}>
          <MaterialIcons name="shield" size={20} color="#4CAF50" />
          <Text style={styles.safetyText}>
            <Text style={styles.safetyBold}>Safety Tips: </Text>
            Meet in a public place and inspect the plant before purchasing
          </Text>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
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
    color: '#666',
  },
  errorText: {
    marginTop: 10,
    fontSize: 16,
    color: '#f44336',
    textAlign: 'center',
  },
  imageContainer: {
    position: 'relative',
    width: '100%',
    height: 300,
  },
  image: {
    width: width,
    height: 300,
  },
  pagination: {
    position: 'absolute',
    bottom: 16,
    flexDirection: 'row',
    alignSelf: 'center',
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    margin: 3,
  },
  paginationDotActive: {
    backgroundColor: '#fff',
  },
  favoriteButton: {
    position: 'absolute',
    top: 15,
    right: 15,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButton: {
    position: 'absolute',
    top: 15,
    left: 15,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  shareButton: {
    position: 'absolute',
    top: 15,
    right: 65,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoContainer: {
    padding: 16,
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  category: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
  },
  price: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginBottom: 8,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    justifyContent: 'space-between',
  },
  statusPill: {
    backgroundColor: '#e0f2f1',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  statusText: {
    color: '#00897b',
    fontSize: 12,
    fontWeight: '600',
  },
  listedDate: {
    fontSize: 12,
    color: '#999',
  },
  locationContainer: {
    backgroundColor: '#f9f9f9',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  locationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  locationTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 6,
  },
  locationText: {
    fontSize: 14,
    color: '#555',
    marginBottom: 8,
  },
  mapPreview: {
    height: 150,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  map: {
    width: '100%',
    height: '100%',
  },
  mapOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 8,
  },
  viewOnMapText: {
    color: '#fff',
    fontSize: 12,
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    color: '#333',
  },
  careInfoContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 12,
  },
  careItem: {
    alignItems: 'center',
    flex: 1,
    padding: 8,
  },
  careLabel: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  careValue: {
    fontSize: 14,
    fontWeight: '500',
    marginTop: 4,
    textAlign: 'center',
  },
  sellerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    marginVertical: 8,
  },
  sellerAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  sellerInfo: {
    flex: 1,
    marginLeft: 12,
  },
  sellerName: {
    fontSize: 16,
    fontWeight: '500',
  },
  sellerRatingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  sellerRating: {
    fontSize: 14,
    color: '#666',
    marginLeft: 4,
  },
  sellerMember: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  otherListingsContainer: {
    marginTop: 16,
    marginBottom: 16,
  },
  otherListingsTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  otherListingsScroll: {
    marginLeft: -8,
  },
  otherListingItem: {
    width: 120,
    marginLeft: 8,
  },
  otherListingImage: {
    width: 120,
    height: 120,
    borderRadius: 8,
  },
  otherListingName: {
    fontSize: 14,
    marginTop: 4,
  },
  otherListingPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4CAF50',
  },
  seeAllButton: {
    width: 120,
    height: 120,
    borderRadius: 8,
    marginLeft: 8,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  seeAllText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4CAF50',
    marginBottom: 4,
  },
  actionsContainer: {
    flexDirection: 'row',
    marginTop: 24,
    marginBottom: 16,
  },
  favoriteActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#4CAF50',
    borderRadius: 8,
    padding: 12,
    marginRight: 12,
    flex: 1,
  },
  actionButtonText: {
    fontSize: 16,
    color: '#4CAF50',
    fontWeight: '500',
    marginLeft: 8,
  },
  contactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    padding: 12,
    flex: 2,
  },
  contactButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '500',
    marginLeft: 8,
  },
  safetyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f1f8e9',
    borderRadius: 8,
    marginBottom: 24,
  },
  safetyText: {
    fontSize: 14,
    color: '#333',
    marginLeft: 8,
    flex: 1,
  },
  safetyBold: {
    fontWeight: '600',
  },
});

export default PlantDetailScreen;