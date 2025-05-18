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

  return (
    <View style={styles.container}>
      <TouchableOpacity 
        style={styles.closeButton}
        onPress={onClose}
      >
        <MaterialIcons name="close" size={20} color="#666" />
      </TouchableOpacity>
      
      <View style={styles.contentContainer}>
        <Image source={getImageSource()} style={styles.image} />
        
        <View style={styles.detailsContainer}>
          <Text style={styles.title} numberOfLines={1}>
            {plant.title || plant.name || 'Plant'}
          </Text>
          
          <Text style={styles.price}>${formatPrice(plant.price)}</Text>
          
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
    borderRadius: 8,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    position: 'relative',
  },
  closeButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 10,
    padding: 4,
  },
  contentContainer: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  image: {
    width: 80,
    height: 80,
    borderRadius: 6,
    backgroundColor: '#f0f0f0',
  },
  detailsContainer: {
    flex: 1,
    marginLeft: 12,
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
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  detailsButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4CAF50',
    marginRight: 6,
  },
});

export default PlantDetailMiniCard;