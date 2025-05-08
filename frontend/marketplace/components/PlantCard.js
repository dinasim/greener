import React, { useState } from 'react';
import { 
  View, 
  Text, 
  Image, 
  StyleSheet, 
  TouchableOpacity,
  Platform 
} from 'react-native';
import { MaterialIcons, FontAwesome } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { wishProduct } from '../services/productData';

/**
 * Plant Card component for displaying plant listings
 * @param {Object} props - Component props
 * @param {Object} props.plant - Plant data
 * @param {boolean} props.showActions - Whether to show action buttons
 */
const PlantCard = ({ plant, showActions = true }) => {
  const navigation = useNavigation();
  const [isFavorite, setIsFavorite] = useState(plant.isFavorite || false);
  const [isLoading, setIsLoading] = useState(false);

  const handleViewDetails = () => {
    navigation.navigate('PlantDetail', { 
      plantId: plant.id || plant._id,
      category: plant.category
    });
  };

  const handleToggleFavorite = async () => {
    if (isLoading) return;
    
    try {
      setIsLoading(true);
      // Toggle state immediately for better UI experience
      setIsFavorite(!isFavorite);
      
      // Call the API to update wishlist status
      await wishProduct(plant.id || plant._id);
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

  // Format price display
  const formatPrice = () => {
    const price = parseFloat(plant.price);
    return isNaN(price) ? '0.00' : price.toFixed(2);
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
      style={styles.card}
      activeOpacity={0.9}
      onPress={handleViewDetails}
    >
      <View style={styles.imageContainer}>
        <Image
          source={{ 
            uri: plant.imageUrl || plant.image || 'https://via.placeholder.com/150?text=Plant' 
          }}
          style={styles.image}
          resizeMode="cover"
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

      <View style={styles.infoContainer}>
        <View style={styles.titleRow}>
          <Text style={styles.name} numberOfLines={1}>
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
            <TouchableOpacity 
              style={styles.chatButton}
              onPress={handleStartChat}
            >
              <MaterialIcons name="chat" size={16} color="#4CAF50" />
              <Text style={styles.chatText}>Contact</Text>
            </TouchableOpacity>
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
  imageContainer: {
    position: 'relative',
  },
  image: {
    height: 160,
    width: '100%',
    backgroundColor: '#f0f0f0',
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
  chatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f9f0',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  chatText: {
    fontSize: 12,
    color: '#4CAF50',
    marginLeft: 4,
  },
});

export default PlantCard;