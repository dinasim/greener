// components/PlantCard.js - Updated with seller rating display
import React, { useState, useMemo } from 'react';
import { 
  View, 
  Text, 
  Image, 
  StyleSheet, 
  TouchableOpacity,
  Platform,
  Share,
  Alert,
  ActivityIndicator
} from 'react-native';
import { MaterialIcons, FontAwesome } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import syncService from '../services/SyncService';
import { wishProduct } from '../services/marketplaceApi';

/**
 * Enhanced PlantCard component with improved error handling, offline support, and seller rating
 * @param {Object} props - Component props
 * @param {Object} props.plant - Plant data
 * @param {boolean} props.showActions - Whether to show action buttons
 * @param {string} props.layout - Layout type: 'grid' or 'list'
 */
const PlantCard = ({ plant, showActions = true, layout = 'grid' }) => {
  const navigation = useNavigation();
  const [isFavorite, setIsFavorite] = useState(() => {
    return (
      plant.isFavorite === true ||
      plant.isWished === true ||
      plant.isInWishlist === true ||
      false
    );
  });
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [imageError, setImageError] = useState(false);
  
  // Track online status for offline mode UI
  const [isOnline, setIsOnline] = useState(true);
  
  // Subscribe to sync service for online status
  React.useEffect(() => {
    const unsubscribe = syncService.registerSyncListener((event) => {
      if (event.type === 'CONNECTION_CHANGE') {
        setIsOnline(event.isOnline);
      }
    });
    
    // Get initial status
    const status = syncService.getSyncStatus();
    setIsOnline(status.isOnline);
    
    return unsubscribe;
  }, []);

  const isListLayout = layout === 'list';

  const handleViewDetails = () => {
    navigation.navigate('PlantDetail', { 
      plantId: plant.id || plant._id,
      category: plant.category
    });
  };

/**
 * Toggle wishlist/favorite status with improved error handling and online/offline support
 */
const handleToggleFavorite = async () => {
  if (isActionLoading) return;
  
  try {
    setIsActionLoading(true);
    
    // Toggle state immediately for better UI experience
    setIsFavorite(prevState => !prevState);
    
    // Determine the plant ID
    const plantId = plant.id || plant._id;
    
    if (!plantId) {
      throw new Error('Invalid plant ID');
    }
    
    console.log(`Toggling favorite for plant ${plantId}, current state: ${isFavorite}`);
    
    // Check if we're online
    const syncStatus = syncService.getSyncStatus();
    
    if (syncStatus.isOnline) {
      // We're online, try to update immediately
      try {
        const result = await wishProduct(plantId);
        
        console.log('Wishlist API response:', result);
        
        // If the API returns a specific wishlist state, use that
        if (result && 'isWished' in result) {
          setIsFavorite(result.isWished);
          console.log(`Favorite state set to ${result.isWished} from API`);
        }
      } catch (error) {
        console.error('Direct wishlist update failed:', error);
        
        // Add to sync queue for retry
        await syncService.addToSyncQueue({
          type: 'TOGGLE_WISHLIST',
          data: {
            plantId: plantId
          }
        });
        
        // Don't revert UI state - the sync service will handle it
      }
    } else {
      // We're offline, add to sync queue
      console.log('Device is offline, adding to sync queue');
      
      await syncService.addToSyncQueue({
        type: 'TOGGLE_WISHLIST',
        data: {
          plantId: plantId
        }
      });
    }
    
    setIsActionLoading(false);
  } catch (error) {
    // Revert state if the operation failed completely
    setIsFavorite(prevState => !prevState);
    setIsActionLoading(false);
    
    console.error('Error toggling favorite:', error);
    
    // Only show alert if a serious error occurred
    Alert.alert(
      'Error', 
      'Failed to update favorites. Please try again later.',
      [{ text: 'OK' }]
    );
  }
};

  const handleStartChat = () => {
    navigation.navigate('Messages', { 
      sellerId: plant.sellerId || plant.seller?._id,
      plantId: plant.id || plant._id,
      plantName: plant.name || plant.title
    });
  };

  /**
   * Enhanced share functionality with error handling
   */
  const handleShare = async () => {
    try {
      const plantName = plant.name || plant.title || 'Amazing plant';
      const price = formatPrice();
      const seller = plant.sellerName || plant.seller?.name || 'a seller';
      const category = plant.category || 'Plants';
      const locationText = getLocationText();
      
      // Create a rich message with emojis and details
      const message = `🌱 Check out this ${plantName} for $${price} on Greener!\n\n` +
                     `🏷️ Category: ${category}\n` +
                     `👤 Sold by: ${seller}\n` +
                     `📍 Location: ${locationText}\n\n` +
                     `Download Greener to view more amazing plants!`;
      
      // Try to create a deep link for the app
      let appURL = '';
      try {
        appURL = Platform.OS === 'ios' 
          ? `greenerapp://plants/${plant.id || plant._id}` 
          : `https://greenerapp.com/plants/${plant.id || plant._id}`;
      } catch (e) {
        // If deep link fails, just share the message without URL
        console.log('Error creating deep link', e);
      }
      
      const result = await Share.share(
        {
          title: `Greener: ${plantName}`,
          message: message,
          url: appURL, // Only iOS supports URL as a separate field
        },
        {
          // Only iOS supports dialogTitle
          dialogTitle: 'Share this plant with friends',
          // Only Android supports these options
          subject: `Check out this ${plantName} on Greener!`,
          tintColor: '#4CAF50'
        }
      );
      
      if (result.action === Share.sharedAction) {
        // Track share analytics in a real app
        console.log('Shared successfully');
      }
    } catch (error) {
      console.error('Error sharing plant:', error);
      Alert.alert('Error', 'Could not share this plant. Please try again.');
    }
  };

  /**
   * Get formatted location display text
   */
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

  /**
   * Get image source with error handling and fallback
   */
  const getImageSource = useMemo(() => {
    if (!imageError) {
      let imageUrl = plant.imageUrl || plant.image || null;
      
      // Additional checks for image URLs
      if (typeof imageUrl === 'string') {
        // Handle relative URLs
        if (imageUrl.startsWith('/')) {
          imageUrl = `https://greenerapp.com${imageUrl}`;
        }
        
        // Check if URL is valid
        if (imageUrl.startsWith('http')) {
          return { uri: imageUrl };
        }
      }
    }
    
    // Return a local placeholder image
    try {
      return require('../../assets/images/plant-placeholder.png');
    } catch(err) {
      // Fallback to a hardcoded URL as last resort
      return { uri: 'https://placehold.co/150x150/4CAF50/FFFFFF?text=Plant' };
    }
  }, [plant.imageUrl, plant.image, imageError]);

  /**
   * Format price display with error handling
   */
  const formatPrice = () => {
    // Handle different price formats
    let price;
    
    if (typeof plant.price === 'number') {
      price = plant.price;
    } else if (typeof plant.price === 'string') {
      // Remove any non-numeric chars except decimal point
      const cleanedPrice = plant.price.replace(/[^0-9.]/g, '');
      price = parseFloat(cleanedPrice);
    } else {
      price = 0;
    }
    
    // Ensure price is a valid number and not negative
    if (isNaN(price) || price < 0) {
      price = 0;
    }
    
    // Format with 2 decimal places
    return price.toFixed(2);
  };

  /**
   * Format date display with relative time
   */
  const formatDate = () => {
    const dateString = plant.listedDate || plant.addedAt;
    if (!dateString) return 'Recently listed';
    
    try {
      const date = new Date(dateString);
      const now = new Date();
      
      // Check for invalid date
      if (isNaN(date.getTime())) {
        return 'Recently listed';
      }
      
      const diffTime = Math.abs(now - date);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      const diffHours = Math.ceil(diffTime / (1000 * 60 * 60));
      
      if (diffHours < 1) {
        return 'Just now';
      } else if (diffHours < 24) {
        return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
      } else if (diffDays < 7) {
        return `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`;
      } else if (diffDays < 30) {
        const weeks = Math.floor(diffDays / 7);
        return `${weeks} ${weeks === 1 ? 'week' : 'weeks'} ago`;
      } else {
        return date.toLocaleDateString();
      }
    } catch (e) {
      console.error('Error formatting date:', e);
      return 'Recently listed';
    }
  };

  /**
   * Get seller rating if available
   */
  const getSellerRating = () => {
    // Check all possible places where seller rating might be stored
    if (plant.seller && typeof plant.seller.rating !== 'undefined') {
      return plant.seller.rating;
    } else if (plant.sellerRating) {
      return plant.sellerRating;
    } else if (plant.rating) {
      // Some plants might store the seller rating directly
      return plant.rating;
    }
    return null;
  };

  // Get the seller's rating
  const sellerRating = getSellerRating();

  return (
    <TouchableOpacity
      style={[
        styles.card,
        isListLayout && styles.listCard,
        !isOnline && styles.offlineCard
      ]}
      activeOpacity={0.9}
      onPress={handleViewDetails}
      accessible={true}
      accessibilityLabel={`${plant.name || plant.title} for $${formatPrice()}`}
      accessibilityRole="button"
    >
      <View style={[styles.imageContainer, isListLayout && styles.listImageContainer]}>
        <Image
          source={getImageSource}
          style={[styles.image, isListLayout && styles.listImage]}
          resizeMode="cover"
          onError={() => {
            console.log('Image failed to load for plant', plant.id || plant._id);
            setImageError(true);
          }}
        />
        
        {/* Location pill */}
        <View style={styles.locationPill}>
          <MaterialIcons name="location-on" size={12} color="#fff" />
          <Text style={styles.locationText} numberOfLines={1}>
            {getLocationText()}
          </Text>
        </View>
        
        {/* Offline indicator */}
        {!isOnline && (
          <View style={styles.offlineIndicator}>
            <MaterialIcons name="cloud-off" size={12} color="#fff" />
          </View>
        )}
        
        {/* Favorite button over image */}
        {showActions && (
          <TouchableOpacity 
            style={styles.favoriteButton}
            onPress={handleToggleFavorite}
            activeOpacity={0.8}
            disabled={isActionLoading}
          >
            {isActionLoading ? (
              <ActivityIndicator size="small" color="#f44336" />
            ) : (
              <MaterialIcons 
                name={isFavorite ? "favorite" : "favorite-border"} 
                size={20} 
                color={isFavorite ? "#f44336" : "#fff"} 
              />
            )}
          </TouchableOpacity>
        )}
      </View>

      <View style={[styles.infoContainer, isListLayout && styles.listInfoContainer]}>
        <View style={styles.titleRow}>
          <Text style={[styles.name, isListLayout && styles.listName]} numberOfLines={isListLayout ? 2 : 1}>
            {plant.name || plant.title}
          </Text>
          <Text style={styles.price}>${formatPrice()}</Text>
        </View>
        
        <Text style={styles.category} numberOfLines={1}>
          {plant.category}
        </Text>
        
        <View style={styles.sellerRow}>
          <Text style={styles.sellerName} numberOfLines={1}>
            {plant.sellerName || plant.seller?.name || 'Plant Seller'}
          </Text>
          
          {/* Display seller rating if available */}
          {sellerRating !== null && (
            <View style={styles.ratingContainer}>
              <FontAwesome name="star" size={12} color="#FFD700" />
              <Text style={styles.ratingText}>
                {typeof sellerRating === 'number' ? sellerRating.toFixed(1) : sellerRating}
              </Text>
            </View>
          )}
        </View>
        
        <View style={styles.footer}>
          <Text style={styles.date}>
            {formatDate()}
          </Text>
          
          {showActions && (
            <View style={styles.actionButtons}>
              {/* Share Button */}
              <TouchableOpacity 
                style={styles.actionButton}
                onPress={handleShare}
              >
                <MaterialIcons name="share" size={16} color="#4CAF50" />
                <Text style={styles.actionText}>Share</Text>
              </TouchableOpacity>

              {/* Contact Button */}
              <TouchableOpacity 
                style={styles.actionButton}
                onPress={handleStartChat}
                disabled={!isOnline}
              >
                <MaterialIcons name="chat" size={16} color={isOnline ? "#4CAF50" : "#aaa"} />
                <Text style={[styles.actionText, !isOnline && styles.disabledText]}>
                  {isOnline ? "Contact" : "Offline"}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 8,
    margin: 8,
    overflow: 'hidden',
    flex: 1,
    maxWidth: '47%', // For grid layout (2 columns)
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
      web: {
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      },
    }),
  },
  listCard: {
    flexDirection: 'row',
    maxWidth: '100%',
    height: 130,
  },
  offlineCard: {
    opacity: 0.9,
    ...Platform.select({
      ios: {
        shadowColor: '#999',
      },
      android: {
        elevation: 1,
      },
    }),
  },
  imageContainer: {
    position: 'relative',
  },
  listImageContainer: {
    width: 130,
  },
  image: {
    height: 160,
    width: '100%',
    backgroundColor: '#f0f0f0',
  },
  listImage: {
    height: 130,
    width: 130,
  },
  locationPill: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  locationText: {
    color: '#fff',
    fontSize: 10,
    marginLeft: 3,
    maxWidth: 90,
  },
  offlineIndicator: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 12,
    padding: 4,
  },
  favoriteButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 16,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoContainer: {
    padding: 12,
  },
  listInfoContainer: {
    flex: 1,
    padding: 12,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  name: {
    fontSize: 16,
    fontWeight: 'bold',
    flex: 1,
    marginRight: 8,
    color: '#333',
  },
  listName: {
    fontSize: 17,
  },
  price: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  category: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  sellerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sellerName: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
    flex: 1,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    marginLeft: 4,
    fontSize: 12,
    color: '#888',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  date: {
    fontSize: 12,
    color: '#999',
  },
  actionButtons: {
    flexDirection: 'row',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f9f0',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
    marginLeft: 8,
  },
  actionText: {
    fontSize: 12,
    color: '#4CAF50',
    marginLeft: 4,
  },
  disabledText: {
    color: '#aaa',
  },
});

export default PlantCard;