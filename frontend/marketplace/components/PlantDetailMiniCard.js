// components/PlantDetailMiniCard.js
import React, { useMemo, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import PropTypes from 'prop-types';

/**
 * Mini plant detail card that shows in the map view
 * when a plant pin is clicked, without navigating away
 */
const PlantDetailMiniCard = React.memo(({ plant, onClose, onViewDetails }) => {
  if (!plant) return null;

  // Memoize expensive calculations
  const plantData = useMemo(() => {
    const formatPrice = (price) => {
      if (typeof price === 'number') {
        return price.toFixed(2);
      } else if (typeof price === 'string') {
        const parsedPrice = parseFloat(price);
        return isNaN(parsedPrice) ? '0.00' : parsedPrice.toFixed(2);
      }
      return '0.00';
    };

    const getDistanceText = () => {
      if (plant.distance) {
        return `${plant.distance.toFixed(1)} km away`;
      }
      return null;
    };

    const getImageSource = () => {
      const imageUrl = plant.image || plant.imageUrl || (plant.images && plant.images.length > 0 ? plant.images[0] : null);
      return { uri: imageUrl || 'https://via.placeholder.com/100?text=Plant' };
    };

    return {
      formattedPrice: formatPrice(plant.price),
      distanceText: getDistanceText(),
      imageSource: getImageSource(),
      title: plant.title || plant.name || 'Plant',
      location: plant.location?.city || plant.city || 'Unknown location',
      sellerName: plant.seller?.name || plant.sellerName || 'Unknown seller'
    };
  }, [
    plant.price, 
    plant.distance, 
    plant.image, 
    plant.imageUrl, 
    plant.images, 
    plant.title, 
    plant.name, 
    plant.location?.city, 
    plant.city, 
    plant.seller?.name, 
    plant.sellerName
  ]);

  // Render rating - based on availability
  const renderRating = useCallback(() => {
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
  }, [plant.rating, plant.reviewCount]);

  return (
    <View style={styles.container}>
      <TouchableOpacity 
        style={styles.closeButton}
        onPress={onClose}
        hitSlop={{ top: 20, right: 20, bottom: 20, left: 20 }}
        accessibilityLabel="Close plant details"
        accessibilityRole="button"
      >
        <MaterialIcons name="close" size={20} color="#666" />
      </TouchableOpacity>
      
      <View style={styles.contentContainer}>
        <Image 
          source={plantData.imageSource} 
          style={styles.image}
          resizeMode="cover"
        />
        
        <View style={styles.detailsContainer}>
          <Text style={styles.title} numberOfLines={1}>
            {plantData.title}
          </Text>
          
          <Text style={styles.price}>${plantData.formattedPrice}</Text>
          
          {renderRating()}
          
          <View style={styles.locationContainer}>
            <MaterialIcons name="place" size={14} color="#666" />
            <Text style={styles.locationText} numberOfLines={1}>
              {plantData.location}
            </Text>
          </View>
          
          {plantData.distanceText && (
            <Text style={styles.distanceText}>{plantData.distanceText}</Text>
          )}
          
          <Text style={styles.sellerText} numberOfLines={1}>
            Seller: {plantData.sellerName}
          </Text>
        </View>
      </View>
      
      <TouchableOpacity 
        style={styles.detailsButton}
        onPress={onViewDetails}
        accessibilityLabel="View plant details"
        accessibilityRole="button"
      >
        <Text style={styles.detailsButtonText}>View Details</Text>
        <MaterialIcons name="arrow-forward" size={16} color="#4CAF50" />
      </TouchableOpacity>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
      web: {
        boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
      },
    }),
    position: 'relative',
    margin: 8,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  closeButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 10,
    padding: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  contentContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    alignItems: 'flex-start',
  },
  image: {
    width: 88,
    height: 88,
    borderRadius: 12,
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  detailsContainer: {
    flex: 1,
    marginLeft: 16,
    justifyContent: 'flex-start',
    paddingTop: 2,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: '#2d3436',
    marginBottom: 6,
    lineHeight: 22,
  },
  price: {
    fontSize: 18,
    fontWeight: '700',
    color: '#4CAF50',
    marginBottom: 6,
  },
  ratingContainer: {
    flexDirection: 'row', 
    alignItems: 'center',
    marginBottom: 6,
    backgroundColor: '#fff9c4',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  ratingText: {
    marginLeft: 3,
    fontSize: 12,
    fontWeight: '600',
    color: '#f57f17',
  },
  newProductText: {
    fontSize: 12,
    color: '#6c757d',
    fontStyle: 'italic',
    marginBottom: 6,
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  locationText: {
    fontSize: 13,
    color: '#6c757d',
    marginLeft: 4,
    fontWeight: '500',
  },
  distanceText: {
    fontSize: 12,
    color: '#9ca3af',
    marginBottom: 4,
    fontWeight: '500',
  },
  sellerText: {
    fontSize: 12,
    color: '#6c757d',
    fontWeight: '500',
  },
  detailsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0f9f3',
    borderWidth: 1.5,
    borderColor: '#4CAF50',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#4CAF50',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  detailsButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#4CAF50',
    marginRight: 6,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
    ...Platform.select({
      web: { boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.1)' },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
      }
    })
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    flex: 1,
    marginHorizontal: 4,
    ...Platform.select({
      web: { boxShadow: '0px 2px 4px rgba(76, 175, 80, 0.3)' },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 3,
        elevation: 2,
      }
    })
  }
});

PlantDetailMiniCard.propTypes = {
  plant: PropTypes.shape({
    title: PropTypes.string,
    name: PropTypes.string,
    price: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    distance: PropTypes.number,
    image: PropTypes.string,
    imageUrl: PropTypes.string,
    images: PropTypes.array,
    rating: PropTypes.number,
    reviewCount: PropTypes.number,
    location: PropTypes.shape({
      city: PropTypes.string,
    }),
    city: PropTypes.string,
    seller: PropTypes.shape({
      name: PropTypes.string,
    }),
    sellerName: PropTypes.string,
  }),
  onClose: PropTypes.func.isRequired,
  onViewDetails: PropTypes.func.isRequired,
};

PlantDetailMiniCard.defaultProps = {
  plant: null,
};

export default PlantDetailMiniCard;