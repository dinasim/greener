// components/PlantCard.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { MaterialIcons, FontAwesome } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { formatDistanceToNow } from 'date-fns';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { wishProduct } from '../services/marketplaceApi';
import { triggerUpdate, UPDATE_TYPES } from '../services/MarketplaceUpdates';

const PlantCard = ({ plant, showActions = true, layout = 'grid', isOffline = false }) => {
  const navigation = useNavigation();
  const [isFavorite, setIsFavorite] = useState(plant.isFavorite || plant.isWished || false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Update favorite state when plant prop changes
  useEffect(() => {
    setIsFavorite(plant.isFavorite || plant.isWished || false);
  }, [plant.isFavorite, plant.isWished]);

  const handlePress = () => {
    navigation.navigate('PlantDetail', { plantId: plant.id || plant._id });
  };

  const handleSellerPress = (e) => {
    e.stopPropagation();
    navigation.navigate('SellerProfile', {
      sellerId: plant.seller?._id || plant.sellerId || 'unknown',
    });
  };

  const toggleFavorite = async (e) => {
    e.stopPropagation();
    if (isSubmitting) return;

    try {
      setIsSubmitting(true);
      // Optimistically update UI
      setIsFavorite(!isFavorite);

      // Call API
      const result = await wishProduct(plant.id || plant._id);
      
      // Trigger global update with associated data
      await triggerUpdate(UPDATE_TYPES.WISHLIST, {
        plantId: plant.id || plant._id,
        isFavorite: !isFavorite,
        timestamp: Date.now()
      });
    } catch (err) {
      // Revert on error
      setIsFavorite(isFavorite);
      console.error('Error updating favorites:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleShare = (e) => {
    e.stopPropagation();
    // Implement sharing functionality
  };

  const handleContact = (e) => {
    e.stopPropagation();
    navigation.navigate('Messages', {
      sellerId: plant.seller?._id || plant.sellerId,
      plantId: plant.id || plant._id,
      plantName: plant.title || plant.name,
    });
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Recently';
    
    try {
      const date = new Date(dateString);
      return formatDistanceToNow(date, { addSuffix: true });
    } catch (e) {
      return 'Recently';
    }
  };

  const getLocationText = () => {
    if (typeof plant.location === 'string') {
      return plant.location;
    } else if (plant.location && typeof plant.location === 'object') {
      // If we have a formatted city name, use it
      if (plant.location.city) {
        return plant.location.city;
      }
      
      // If we have coordinates but no city, format them nicely
      if (plant.location.latitude && plant.location.longitude) {
        return `Near ${plant.location.latitude.toFixed(2)}, ${plant.location.longitude.toFixed(2)}`;
      }
      
      return 'Local pickup';
    } else if (plant.city) {
      return plant.city;
    }
    return 'Local pickup';
  };

  const isList = layout === 'list';

  return (
    <TouchableOpacity
      style={[
        styles.card,
        isList && styles.listCard,
        isOffline && styles.offlineCard,
      ]}
      onPress={handlePress}
      activeOpacity={0.8}
    >
      <View style={[styles.imageContainer, isList && styles.listImageContainer]}>
        <Image
          source={{ uri: plant.image || plant.imageUrl || 'https://via.placeholder.com/150?text=Plant' }}
          style={isList ? styles.listImage : styles.image}
          resizeMode="contain"
        />
        
        {isOffline && (
          <View style={styles.offlineIndicator}>
            <MaterialIcons name="cloud-off" size={12} color="#fff" />
          </View>
        )}
        
        <TouchableOpacity style={styles.favoriteButton} onPress={toggleFavorite}>
          <MaterialIcons
            name={isFavorite ? 'favorite' : 'favorite-border'}
            size={18}
            color={isFavorite ? '#f44336' : '#fff'}
          />
        </TouchableOpacity>
      </View>
      
      <View style={isList ? styles.listInfoContainer : styles.infoContainer}>
        <View style={styles.titleRow}>
          <Text style={[styles.name, isList && styles.listName]} numberOfLines={isList ? 2 : 1}>
            {plant.title || plant.name}
          </Text>
          <Text style={styles.price}>${parseFloat(plant.price).toFixed(2)}</Text>
        </View>
        
        {/* Location information */}
        <View style={styles.locationRow}>
          <MaterialIcons name="location-on" size={12} color="#666" />
          <Text style={styles.locationText} numberOfLines={1}>{getLocationText()}</Text>
        </View>
        
        {!isList && <Text style={styles.category} numberOfLines={1}>{plant.category}</Text>}
        
        <View style={styles.sellerRow}>
          <TouchableOpacity onPress={handleSellerPress}>
            <Text style={styles.sellerName} numberOfLines={1}>
              {plant.seller?.name || 'Unknown Seller'}
            </Text>
          </TouchableOpacity>
          
          {plant.rating && (
            <View style={styles.ratingContainer}>
              <FontAwesome name="star" size={12} color="#FFC107" />
              <Text style={styles.ratingText}>{plant.rating}</Text>
            </View>
          )}
        </View>
        
        <View style={styles.footer}>
          <Text style={styles.date}>
            {formatDate(plant.addedAt || plant.listedDate)}
          </Text>
          
          {showActions && (
            <View style={styles.actionButtons}>
              <TouchableOpacity style={styles.actionButton} onPress={handleShare}>
                <MaterialIcons name="share" size={14} color="#4CAF50" />
                <Text style={styles.actionText}>Share</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.actionButton}
                onPress={handleContact}
              >
                <MaterialIcons name="chat" size={14} color="#4CAF50" />
                <Text style={[styles.actionText, isSubmitting && styles.disabledText]}>
                  Contact
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
    maxWidth: Platform.OS === 'web' ? '31%' : '47%',
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
    height: 180,
    width: '100%',
    backgroundColor: '#f0f0f0',
  },
  listImage: {
    height: 130,
    width: 130,
    backgroundColor: '#f0f0f0',
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
  // New location row styles
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  locationText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
    flex: 1,
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