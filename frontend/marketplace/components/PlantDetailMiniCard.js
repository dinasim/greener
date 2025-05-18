// components/PlantDetailMiniCard.js
import React from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

/**
 * Mini plant detail card that shows in the map view
 * when a plant pin is clicked, without navigating away
 */
const PlantDetailMiniCard = ({ plant, onClose, onViewDetails }) => {
  if (!plant) return null;

  // Format price as currency
  const formatPrice = (price) => {
    if (typeof price === 'number') {
      return price.toFixed(2);
    } else if (typeof price === 'string') {
      const parsedPrice = parseFloat(price);
      return isNaN(parsedPrice) ? '0.00' : parsedPrice.toFixed(2);
    }
    return '0.00';
  };
  
  // Calculate distance text
  const getDistanceText = () => {
    if (plant.distance) {
      return `${plant.distance.toFixed(1)} km away`;
    }
    return null;
  };

  // Get image source
  const getImageSource = () => {
    const imageUrl = plant.image || plant.imageUrl || (plant.images && plant.images.length > 0 ? plant.images[0] : null);
    return { uri: imageUrl || 'https://via.placeholder.com/100?text=Plant' };
  };

  // Render rating - based on availability
  const renderRating = () => {
    if (!plant.rating || plant.rating === 0) {
      return <Text style={styles.newProductText}>New Product</Text>;
    }
    
    return (
      <View style={styles.ratingContainer}>
        <MaterialIcons name="star" size={14} color="#FFD700" />
        <Text style={styles.ratingText}>
          {typeof plant.rating === 'number' ? plant.rating.toFixed(1) : plant.rating}
          {plant.reviewCount ? ` (${plant.reviewCount})` : ''}
        </Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity 
        style={styles.closeButton}
        onPress={onClose}
        hitSlop={{ top: 20, right: 20, bottom: 20, left: 20 }}
      >
        <MaterialIcons name="close" size={20} color="#666" />
      </TouchableOpacity>
      
      <View style={styles.contentContainer}>
        <Image 
          source={getImageSource()} 
          style={styles.image}
          defaultSource={require('../../assets/plant-placeholder.png')}
        />
        
        <View style={styles.detailsContainer}>
          <Text style={styles.title} numberOfLines={1}>
            {plant.title || plant.name || 'Plant'}
          </Text>
          
          <Text style={styles.price}>${formatPrice(plant.price)}</Text>
          
          {renderRating()}
          
          <View style={styles.locationContainer}>
            <MaterialIcons name="place" size={14} color="#666" />
            <Text style={styles.locationText} numberOfLines={1}>
              {plant.location?.city || plant.city || 'Unknown location'}
            </Text>
          </View>
          
          {getDistanceText() && (
            <Text style={styles.distanceText}>{getDistanceText()}</Text>
          )}
          
          <Text style={styles.sellerText} numberOfLines={1}>
            Seller: {plant.seller?.name || plant.sellerName || 'Unknown seller'}
          </Text>
        </View>
      </View>
      
      <TouchableOpacity 
        style={styles.detailsButton}
        onPress={onViewDetails}
      >
        <Text style={styles.detailsButtonText}>View Details</Text>
        <MaterialIcons name="arrow-forward" size={16} color="#4CAF50" />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
    position: 'relative',
    margin: 8,
  },
  closeButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 10,
    padding: 8,
  },
  contentContainer: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  image: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
  },
  detailsContainer: {
    flex: 1,
    marginLeft: 16,
    justifyContent: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  price: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4CAF50',
    marginBottom: 4,
  },
  ratingContainer: {
    flexDirection: 'row', 
    alignItems: 'center',
    marginBottom: 4,
  },
  ratingText: {
    marginLeft: 4,
    fontSize: 12,
    color: '#666',
  },
  newProductText: {
    fontSize: 12,
    color: '#888',
    fontStyle: 'italic',
    marginBottom: 4,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  locationText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
  distanceText: {
    fontSize: 12,
    color: '#888',
    marginBottom: 2,
  },
  sellerText: {
    fontSize: 12,
    color: '#666',
  },
  detailsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0f9f0',
    borderWidth: 1,
    borderColor: '#4CAF50',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  detailsButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4CAF50',
    marginRight: 8,
  },
});

export default PlantDetailMiniCard;