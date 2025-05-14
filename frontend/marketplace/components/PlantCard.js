import React, { useState } from 'react';
import { 
  View, 
  Text, 
  Image, 
  StyleSheet, 
  TouchableOpacity,
  Platform,
  Share,
  Alert
} from 'react-native';
import { MaterialIcons, FontAwesome } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { wishProduct } from '../services/marketplaceApi';

/**
 * Plant Card component for displaying plant listings
 * @param {Object} props - Component props
 * @param {Object} props.plant - Plant data
 * @param {boolean} props.showActions - Whether to show action buttons
 * @param {string} props.layout - Layout type: 'grid' or 'list'
 */
const PlantCard = ({ plant, showActions = true, layout = 'grid' }) => {
  const navigation = useNavigation();
  const [isFavorite, setIsFavorite] = useState(plant.isFavorite || false);
  const [isLoading, setIsLoading] = useState(false);
  const [imageError, setImageError] = useState(false);

  const isListLayout = layout === 'list';

  const handleViewDetails = () => {
    navigation.navigate('PlantDetail', { 
      plantId: plant.id || plant._id,
      category: plant.category
    });
  };

// SEARCH_KEY: MARKETPLACE_CARD_TOGGLE_FAVORITE
const handleToggleFavorite = async () => {
  if (isLoading) return;
  
  try {
    setIsLoading(true);
    // Toggle state immediately for better UI experience
    setIsFavorite(!isFavorite);
    
    // Call the API to update wishlist status
    const result = await wishProduct(plant.id || plant._id);
    
    // If the API returns a specific wishlist state, use that
    if (result && 'isWished' in result) {
      setIsFavorite(result.isWished);
    }
    
    setIsLoading(false);
  } catch (error) {
    // Revert state if the API call fails
    setIsFavorite(isFavorite);
    setIsLoading(false);
    console.error('Failed to update wishlist:', error);
  }
};

  const handleStartChat = () => {
    navigation.navigate('Messages', { 
      sellerId: plant.sellerId || plant.seller?._id,
      plantId: plant.id || plant._id,
      plantName: plant.name || plant.title
    });
  };

  // Enhanced share functionality
  const handleShare = async () => {
    try {
      const plantName = plant.name || plant.title || 'Amazing plant';
      const price = formatPrice();
      const seller = plant.sellerName || plant.seller?.name || 'a seller';
      const category = plant.category || 'Plants';
      const appURL = Platform.OS === 'ios' 
        ? `greenerapp://plants/${plant.id || plant._id}` 
        : `https://greenerapp.com/plants/${plant.id || plant._id}`;
        
      // Create a rich message with emojis and details
      const message = `🌱 Check out this ${plantName} for $${price} on Greener!\n\n` +
                     `🏷️ Category: ${category}\n` +
                     `👤 Sold by: ${seller}\n` +
                     `📍 Location: ${getLocationText()}\n\n` +
                     `Download Greener to view more amazing plants!`;
      
      const result = await Share.share(
        {
          title: `Greener: ${plantName}`,
          message: message,
          url: appURL,
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
        if (result.activityType) {
          // Shared with activity type of result.activityType
          console.log(`Shared via ${result.activityType}`);
        } else {
          // Shared
          console.log('Shared successfully');
        }
      } else if (result.action === Share.dismissedAction) {
        // Dismissed
        console.log('Share dismissed');
      }
    } catch (error) {
      Alert.alert('Error', 'Could not share this plant');
      console.error('Error sharing plant:', error);
    }
  };

  // Format location display
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

  // Prepare image URL with error handling
  const getImageSource = () => {
    if (!imageError) {
      let imageUrl = plant.imageUrl || plant.image || null;
      
      // Check if URL is valid
      if (typeof imageUrl === 'string' && imageUrl.startsWith('http')) {
        return { uri: imageUrl };
      }
    }
    
    // Return a local placeholder image
    try {
      return require('../../assets/images/plant-placeholder.png');
    } catch(err) {
      // Fallback to a hardcoded URL as last resort
      return { uri: 'https://placehold.co/150x150/4CAF50/FFFFFF?text=Plant' };
    }
  };

  // Format price display
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

  // Format date display
  const formatDate = (dateString) => {
    if (!dateString) return 'Recently listed';
    
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffTime = Math.abs(now - date);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays < 1) {
        return 'Today';
      } else if (diffDays === 1) {
        return 'Yesterday';
      } else if (diffDays < 7) {
        return `${diffDays} days ago`;
      } else {
        return date.toLocaleDateString();
      }
    } catch (e) {
      return 'Recently listed';
    }
  };

  return (
    <TouchableOpacity
      style={[
        styles.card,
        isListLayout && styles.listCard
      ]}
      activeOpacity={0.9}
      onPress={handleViewDetails}
    >
      <View style={[styles.imageContainer, isListLayout && styles.listImageContainer]}>
        <Image
          source={getImageSource()}
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
        
        {/* Favorite button over image */}
        {showActions && (
          <TouchableOpacity 
            style={styles.favoriteButton}
            onPress={handleToggleFavorite}
            activeOpacity={0.8}
          >
            <MaterialIcons 
              name={isFavorite ? "favorite" : "favorite-border"} 
              size={20} 
              color={isFavorite ? "#f44336" : "#fff"} 
            />
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
          
          {/* Display rating if available */}
          {plant.rating && (
            <View style={styles.ratingContainer}>
              <FontAwesome name="star" size={12} color="#FFD700" />
              <Text style={styles.ratingText}>
                {typeof plant.rating === 'number' ? plant.rating.toFixed(1) : plant.rating}
              </Text>
            </View>
          )}
        </View>
        
        <View style={styles.footer}>
          <Text style={styles.date}>
            {formatDate(plant.listedDate || plant.addedAt)}
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
              >
                <MaterialIcons name="chat" size={16} color="#4CAF50" />
                <Text style={styles.actionText}>Contact</Text>
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
    alignItems: 'center',
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
});

export default PlantCard;